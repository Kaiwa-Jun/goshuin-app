// 寺社の座標を選ぶ画面（#292 第2弾。Issue #301）。データは持たず、ローカルのサーバーの API から読む。
// 選ぶたびにサーバーへ保存し（作業フォルダの review/choices.json）、localStorage にも写す（予備）。
// 地理院の点（注記・記号・住所）は見るだけで、選ぶボタンは無い（出典の表示が未決。#292 D-12）。
'use strict';

const COLORS = {
  seed: '#6B7280',
  wd: '#2563EB',
  osm: '#16A34A',
  gsi: '#F59E0B',
  addr: '#9333EA',
  custom: '#DC2626',
};
const KIND_TEXT = {
  seed: '今の位置（seed）',
  wd: 'Wikidata',
  osm: 'OpenStreetMap',
  gsi: '地理院の注記・記号',
  addr: '地理院の住所（番地）',
  custom: '地図で置いた点',
};
const VERDICT_TEXT = { suggest: '提案あり', owner: '食い違い', investigate: '手がかりなし' };
const CHOICE_TEXT = {
  seed: '今のまま',
  wd: 'Wikidata の点',
  osm: 'OSM の点',
  custom: '地図で置いた点',
};
const TILES = {
  std: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
  photo: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
};
const ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">出典: 国土地理院</a>';
const STORAGE_KEY = 'spot-wikidata-301-choices';

const state = {
  data: null,
  items: [],
  choices: new Map(),
  selectedIdx: null,
  filter: 'all',
  placing: false,
  markers: [],
  map: null,
};

const $ = sel => document.querySelector(sel);
const byTestId = id => document.querySelector(`[data-testid="${id}"]`);

function distanceMeters(a, b) {
  const R = 6371000;
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const round6 = n => Number(n.toFixed(6));

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) throw new Error((json && json.error) || `サーバーが ${res.status} を返した`);
  return json;
}

function showError(text) {
  byTestId('error').textContent = text || '';
}

function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.choices.values()]));
  } catch {
    // 予備なので、書けなくても続ける
  }
}

function current() {
  return state.items.find(i => i.idx === state.selectedIdx) || null;
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function link(href, text) {
  const a = el('a', '', text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function gsiMapUrl(p) {
  return `https://maps.gsi.go.jp/#17/${round6(p.lat)}/${round6(p.lng)}/`;
}

// --- 上の帯 ---

function renderCounters() {
  const total = state.items.length;
  const chosen = state.items.filter(i => state.choices.has(i.idx)).length;
  byTestId('progress').textContent = `選んだ ${chosen} / ${total}`;
  const osm = [...state.choices.values()].filter(c => c.choice === 'osm').length;
  byTestId('osm-counter').textContent =
    `OSM 由来 ${state.data.ledgerOsmCount} + ${osm} / ${state.data.maxOsm}`;
}

// --- 左の一覧 ---

function filtered() {
  return state.items.filter(i => {
    if (state.filter === 'all') return true;
    if (state.filter === 'pending') return !state.choices.has(i.idx);
    return i.verdict === state.filter;
  });
}

function renderList() {
  const ul = byTestId('review-list');
  ul.textContent = '';
  for (const item of filtered()) {
    const li = el('li', item.idx === state.selectedIdx ? 'item selected' : 'item');
    li.setAttribute('data-testid', 'review-item');
    li.dataset.verdict = item.verdict;
    li.dataset.idx = String(item.idx);
    const chosen = state.choices.get(item.idx);
    li.dataset.chosen = chosen ? 'true' : 'false';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    const badge = el('span', 'badge', VERDICT_TEXT[item.verdict] || item.verdict);
    badge.dataset.verdict = item.verdict;
    li.append(
      badge,
      el('span', 'name', `${item.name}（${item.prefecture}）`),
      el('span', 'mark', chosen ? `✓ ${CHOICE_TEXT[chosen.choice] || chosen.choice}` : '')
    );
    li.addEventListener('click', () => select(item.idx));
    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(item.idx);
      }
    });
    ul.append(li);
  }
}

// --- 地図 ---

function pointsOf(item) {
  const pts = [
    {
      kind: 'seed',
      lat: item.seed.lat,
      lng: item.seed.lng,
      ref: null,
      label: item.address,
      distanceM: 0,
    },
    ...item.points,
  ];
  const c = state.choices.get(item.idx);
  if (c && c.choice === 'custom') {
    pts.push({
      kind: 'custom',
      lat: c.lat,
      lng: c.lng,
      ref: null,
      label: c.note || '',
      distanceM: Math.round(distanceMeters(item.seed, c)),
    });
  }
  return pts;
}

function popupContent(item, p) {
  const div = el('div', 'popup');
  div.append(el('strong', '', KIND_TEXT[p.kind] || p.kind));
  if (p.label) div.append(el('div', '', p.label));
  div.append(el('div', '', `seed から ${Math.round(distanceMeters(item.seed, p))}m`));
  const links = el('div', 'links');
  if (p.kind === 'wd' && p.ref) {
    links.append(link(`https://www.wikidata.org/wiki/${p.ref}`, `Wikidata の項目（${p.ref}）`));
  }
  if (p.kind === 'osm' && p.ref) {
    links.append(link(`https://www.openstreetmap.org/${p.ref}`, `OSM の要素（${p.ref}）`));
  }
  links.append(link(gsiMapUrl(p), '地理院地図'));
  div.append(links);
  return div;
}

function renderMap(item, fit) {
  if (!state.map) return;
  for (const m of state.markers) m.remove();
  state.markers = [];
  const pts = pointsOf(item);
  for (const p of pts) {
    const pin = el('button', 'pin');
    pin.type = 'button';
    pin.dataset.kind = p.kind;
    pin.style.backgroundColor = COLORS[p.kind];
    pin.title = `${KIND_TEXT[p.kind]}${p.label ? `: ${p.label}` : ''}`;
    pin.setAttribute('aria-label', pin.title);
    const marker = new maplibregl.Marker({ element: pin })
      .setLngLat([p.lng, p.lat])
      .setPopup(
        new maplibregl.Popup({ offset: 14, maxWidth: '320px' }).setDOMContent(popupContent(item, p))
      )
      .addTo(state.map);
    state.markers.push(marker);
  }
  if (!fit) return;
  if (pts.length === 1) {
    state.map.jumpTo({ center: [item.seed.lng, item.seed.lat], zoom: 16 });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const p of pts) bounds.extend([p.lng, p.lat]);
  state.map.fitBounds(bounds, { padding: 80, maxZoom: 17, duration: 0 });
}

function setBasemap(name) {
  if (!state.map) return;
  for (const id of ['std', 'photo']) {
    state.map.setLayoutProperty(id, 'visibility', id === name ? 'visible' : 'none');
  }
  document.querySelectorAll('[data-basemap]').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.basemap === name ? 'true' : 'false');
  });
}

function createMap() {
  if (typeof maplibregl === 'undefined') {
    showError('地図を読めない（ネットか CDN の問題）。一覧と選ぶボタンは使える');
    return;
  }
  const raster = url => ({
    type: 'raster',
    tiles: [url],
    tileSize: 256,
    maxzoom: 18,
    attribution: ATTRIBUTION,
  });
  state.map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: { std: raster(TILES.std), photo: raster(TILES.photo) },
      layers: [
        { id: 'std', type: 'raster', source: 'std' },
        { id: 'photo', type: 'raster', source: 'photo', layout: { visibility: 'none' } },
      ],
    },
    center: [137.5, 36.5],
    zoom: 5,
    maxZoom: 19,
    attributionControl: { compact: false },
  });
  state.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  state.map.on('click', e => {
    const item = current();
    if (!state.placing || !item) return;
    choose(item, 'custom', { lat: round6(e.lngLat.lat), lng: round6(e.lngLat.lng) });
  });
}

// --- 下の詳しいところと選ぶボタン ---

function renderDetail(item) {
  const box = byTestId('detail');
  box.textContent = '';
  const head = el('div', 'detail-head');
  const badge = el('span', 'badge', VERDICT_TEXT[item.verdict] || item.verdict);
  badge.dataset.verdict = item.verdict;
  head.append(badge, el('strong', '', `${item.name}（${item.prefecture}）`));
  box.append(head, el('div', 'muted', `${item.address}・ランク ${item.rank}`));
  const l = item.link;
  if (l && l.qid) {
    const line = el(
      'div',
      'muted',
      `Wikidata の結びつき: ${l.label || ''}（確かさ ${l.confidence}）`
    );
    line.append(' ', link(`https://www.wikidata.org/wiki/${l.qid}`, l.qid));
    box.append(line);
  }
  const dist = item.points.map(p => `${KIND_TEXT[p.kind]} ${p.distanceM}m`).join('・');
  box.append(
    el(
      'div',
      'muted',
      dist ? `seed からの距離: ${dist}` : '点が1つも無い（地図で置くか、今のまま）'
    )
  );
}

function renderChoices(item) {
  const box = byTestId('choices');
  box.textContent = '';
  const chosen = state.choices.get(item.idx);
  const add = (testId, text, onClick, pressed) => {
    const b = el('button', 'choice', text);
    b.type = 'button';
    b.setAttribute('data-testid', testId);
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.addEventListener('click', onClick);
    box.append(b);
  };
  if (item.suggestion) {
    const which = item.suggestion.choice === 'wd' ? 'Wikidata' : 'OSM';
    add(
      'choice-suggest',
      `提案のとおり（${which}）`,
      () => choose(item, item.suggestion.choice),
      false
    );
  }
  add('choice-seed', '今のまま', () => choose(item, 'seed'), chosen && chosen.choice === 'seed');
  if (item.points.some(p => p.kind === 'wd')) {
    add('choice-wd', 'Wikidata の点', () => choose(item, 'wd'), chosen && chosen.choice === 'wd');
  }
  if (item.points.some(p => p.kind === 'osm')) {
    add('choice-osm', 'OSM の点', () => choose(item, 'osm'), chosen && chosen.choice === 'osm');
  }
  add(
    'choice-custom',
    state.placing ? '地図で置く（やめる）' : '地図で置く',
    () => {
      state.placing = !state.placing;
      renderAll(false);
    },
    state.placing || (chosen && chosen.choice === 'custom')
  );
}

function renderAll(fit) {
  renderCounters();
  renderList();
  const item = current();
  byTestId('placing').hidden = !state.placing;
  if (state.map) state.map.getCanvas().style.cursor = state.placing ? 'crosshair' : '';
  if (!item) return;
  renderDetail(item);
  renderChoices(item);
  renderMap(item, fit);
}

function select(idx) {
  state.selectedIdx = idx;
  state.placing = false;
  const chosen = state.choices.get(idx);
  byTestId('note-input').value = (chosen && chosen.note) || '';
  showError('');
  renderAll(true);
}

async function choose(item, choice, at) {
  showError('');
  const note = byTestId('note-input').value.trim();
  const body = { idx: item.idx, choice, note };
  if (at) Object.assign(body, at);
  try {
    const res = await api('PUT', '/api/choices', body);
    state.choices.set(item.idx, res.item);
    saveLocal();
    state.placing = false;
    renderAll(false);
  } catch (e) {
    showError(e.message);
  }
}

async function exportChoices() {
  showError('');
  const out = byTestId('export-result');
  out.textContent = '';
  try {
    const r = await api('POST', '/api/export');
    out.textContent = `${r.file} に ${r.count} 件を書き出した（作業フォルダの review/）`;
  } catch (e) {
    showError(e.message);
  }
}

async function init() {
  createMap();
  byTestId('export-button').addEventListener('click', exportChoices);
  document.querySelectorAll('[data-filter]').forEach(b => {
    b.addEventListener('click', () => {
      state.filter = b.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(x => {
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      renderList();
    });
  });
  document.querySelectorAll('[data-basemap]').forEach(b => {
    b.addEventListener('click', () => setBasemap(b.dataset.basemap));
  });
  try {
    const [data, choices] = await Promise.all([
      api('GET', '/api/data'),
      api('GET', '/api/choices'),
    ]);
    state.data = data;
    state.items = data.items;
    for (const c of choices.items || []) state.choices.set(c.idx, c);
    saveLocal();
  } catch (e) {
    showError(`データを読めない: ${e.message}`);
    return;
  }
  if (state.items.length > 0) select(state.items[0].idx);
  else renderAll(false);
}

init();
