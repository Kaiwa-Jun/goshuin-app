// 帯の写真を選ぶ画面（Issue #302 D-7）。データは持たず、ローカルのサーバーの API から読む。
// 選ぶたびにサーバーへ保存する（作業フォルダの review/choices.json）。写真は Commons の縮小版を直接読む。
import { PHOTO_NAME_HEIGHT, photoGeometry } from './geometry.js';

/** アプリの帯（試作の画面の幅 390・半分 80・大きく 208） */
const BAND_WIDTH = 390;
const BAND = { compact: 80, expanded: 208 };
const PAGE_SIZE = 12;
const REASONS = [
  ['person', '人が大きく写る'],
  ['other-place', '別の寺社・別の場所'],
  ['not-spot', '寺社が写っていない'],
  ['quality', '暗い・ぼけ・傾き'],
  ['other', 'そのほか'],
];

const state = {
  entries: [],
  /** idx → 保存した1件 */
  choices: new Map(),
  /** idx → 画面で選んでいる途中 { file, focusY, linkChecked, reason } */
  drafts: new Map(),
  filter: 'all',
  page: 0,
};

const byTestId = (id, root = document) => root.querySelector(`[data-testid="${id}"]`);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'testid') node.dataset.testid = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function draftOf(entry) {
  let d = state.drafts.get(entry.idx);
  if (!d) {
    const saved = state.choices.get(entry.idx);
    d = {
      file:
        saved && saved.decision === 'approve' && entry.files.some(f => f.file === saved.file)
          ? saved.file
          : entry.files[0].file,
      focusY: saved && saved.decision === 'approve' ? saved.focusY : 0.5,
      linkChecked: saved && saved.decision === 'approve' ? saved.linkChecked : false,
      reason: saved && saved.decision === 'reject' ? saved.reason : '',
    };
    state.drafts.set(entry.idx, d);
  }
  return d;
}

function visibleEntries() {
  return state.entries.filter(e => {
    const c = state.choices.get(e.idx);
    switch (state.filter) {
      case 'pending':
        return !c;
      case 'approve':
        return c?.decision === 'approve';
      case 'reject':
        return c?.decision === 'reject';
      case 'medium':
        return e.linkConfidence === 'medium';
      default:
        return true;
    }
  });
}

function renderCounters() {
  const all = state.entries.length;
  let approve = 0;
  let reject = 0;
  for (const c of state.choices.values()) {
    if (c.decision === 'approve') approve++;
    else reject++;
  }
  byTestId('progress').textContent = `決めた ${approve + reject} / ${all}`;
  byTestId('tally').textContent = `採る ${approve}・外す ${reject}`;
  for (const b of document.querySelectorAll('[data-filter]')) {
    b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter));
  }
}

/** 帯の見え方1つ（overflow: hidden の箱に写真を置き、下の 30 を白く重ねる） */
function preview(kind, file, focusY) {
  const height = BAND[kind];
  const g = photoGeometry({ width: file.width, height: file.height, focusY }, BAND_WIDTH, BAND);
  const top = kind === 'compact' ? g.compactY : g.expandedY;
  const img = el('img', {
    src: file.thumbUrl,
    alt: '',
    loading: 'lazy',
    referrerpolicy: 'no-referrer',
    draggable: 'false',
  });
  Object.assign(img.style, {
    left: `${g.left}px`,
    top: `${top}px`,
    width: `${g.width}px`,
    height: `${g.height}px`,
  });
  const box = el('div', { class: 'preview', testid: `preview-${kind}` }, [
    img,
    el('div', { class: 'name-row' }),
  ]);
  Object.assign(box.style, { width: `${BAND_WIDTH}px`, height: `${height}px` });
  box.querySelector('.name-row').style.height = `${PHOTO_NAME_HEIGHT}px`;
  return box;
}

function credit(file) {
  const license = file.licenseUrl
    ? el('a', { href: file.licenseUrl, target: '_blank', rel: 'noopener', text: file.license })
    : el('span', { text: file.license });
  return el('dl', { class: 'credit' }, [
    el('dt', { text: '撮影' }),
    el('dd', { text: file.author ?? '不明' }),
    el('dt', { text: 'ライセンス' }),
    el('dd', {}, [license]),
    el('dt', { text: '元の写真' }),
    el('dd', {}, [
      el('a', {
        href: file.sourceUrl,
        target: '_blank',
        rel: 'noopener',
        text: 'Wikimedia Commons',
      }),
    ]),
  ]);
}

async function save(entry, body, card) {
  const error = byTestId('error', card);
  error.textContent = '';
  try {
    const res = await fetch('/api/choices', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idx: entry.idx, ...body }),
    });
    const json = await res.json();
    if (!res.ok) {
      error.textContent = json.error ?? `保存できない（HTTP ${res.status}）`;
      return;
    }
    state.choices.set(entry.idx, json.choice);
    state.drafts.delete(entry.idx);
    render();
  } catch (e) {
    error.textContent = `保存できない: ${e.message}`;
  }
}

function card(entry) {
  const d = draftOf(entry);
  const saved = state.choices.get(entry.idx);
  const file = entry.files.find(f => f.file === d.file) ?? entry.files[0];
  const node = el('article', {
    class: 'card',
    testid: 'photo-card',
    'data-idx': entry.idx,
    'data-decision': saved?.decision,
  });

  const head = el('header', { class: 'card-head' }, [
    el('h2', { text: `${entry.name}（${entry.prefecture}）` }),
    el('span', { class: 'idx', text: `idx ${entry.idx}` }),
    saved
      ? el('span', {
          class: `badge ${saved.decision}`,
          text:
            saved.decision === 'approve' ? `採る（${saved.focusY}）` : `外す（${saved.reason}）`,
        })
      : null,
  ]);
  const meta = el('div', { class: 'meta' }, [
    el('div', { class: 'address', text: entry.address }),
    el('div', {}, [
      'Wikidata: ',
      el('a', {
        href: `https://www.wikidata.org/wiki/${entry.qid}`,
        target: '_blank',
        rel: 'noopener',
        text: `${entry.label ?? '（ラベルなし）'}（${entry.qid}）`,
      }),
    ]),
  ]);
  if (entry.linkConfidence === 'medium') {
    const box = el('input', {
      type: 'checkbox',
      testid: 'link-checked',
      checked: d.linkChecked,
      onchange: ev => {
        d.linkChecked = ev.target.checked;
      },
    });
    meta.append(
      el('div', { class: 'medium' }, [
        el('span', { class: 'badge medium', testid: 'link-medium', text: '結びつき: 中' }),
        el('label', {}, [box, ' Wikidata の項目がこの寺社だと確かめた']),
      ])
    );
  }

  const options =
    entry.files.length > 1
      ? el(
          'div',
          { class: 'files' },
          entry.files.map((f, i) =>
            el('button', {
              type: 'button',
              testid: 'file-option',
              'aria-pressed': String(f.file === file.file),
              title: f.file,
              text: `写真 ${i + 1}（${f.width} × ${f.height}）`,
              onclick: () => {
                d.file = f.file;
                render();
              },
            })
          )
        )
      : null;

  const previews = el('div', { class: 'previews' }, [
    el('div', { class: 'label', text: '半分' }),
    preview('compact', file, d.focusY),
    el('div', { class: 'label', text: '大きく' }),
    preview('expanded', file, d.focusY),
  ]);

  const focusValue = el('output', { text: d.focusY.toFixed(2) });
  const focus = el('input', {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
    value: String(d.focusY),
    testid: 'focus-input',
    oninput: ev => {
      d.focusY = Number(Number(ev.target.value).toFixed(2));
      focusValue.textContent = d.focusY.toFixed(2);
      for (const kind of ['compact', 'expanded']) {
        const box = byTestId(`preview-${kind}`, node);
        box.replaceWith(preview(kind, file, d.focusY));
      }
      dirty.hidden = !(saved?.decision === 'approve' && saved.focusY !== d.focusY);
    },
  });
  const dirty = el('span', {
    class: 'dirty',
    testid: 'dirty',
    text: '保存したのと違う（もう一度「採る」で保存）',
  });
  dirty.hidden = !(
    saved?.decision === 'approve' &&
    (saved.focusY !== d.focusY || saved.file !== file.file)
  );

  const reason = el(
    'select',
    {
      testid: 'reject-reason',
      onchange: ev => {
        d.reason = ev.target.value;
      },
    },
    [
      el('option', { value: '', text: '外す理由', selected: d.reason === '' }),
      ...REASONS.map(([v, t]) => el('option', { value: v, text: t, selected: d.reason === v })),
    ]
  );

  const actions = el('div', { class: 'actions' }, [
    el('label', { class: 'focus' }, ['見せる所（上 0 〜 下 1）', focus, focusValue]),
    dirty,
    el('button', {
      type: 'button',
      class: 'approve',
      testid: 'approve-button',
      text: '採る',
      onclick: () =>
        save(
          entry,
          {
            decision: 'approve',
            file: file.file,
            focusY: d.focusY,
            ...(entry.linkConfidence === 'medium' ? { linkChecked: d.linkChecked } : {}),
          },
          node
        ),
    }),
    reason,
    el('button', {
      type: 'button',
      class: 'reject',
      testid: 'reject-button',
      text: '外す',
      onclick: () => save(entry, { decision: 'reject', reason: d.reason }, node),
    }),
  ]);

  const parts = [
    head,
    meta,
    options,
    previews,
    credit(file),
    el('div', { class: 'file-name', text: file.file }),
    actions,
    el('p', { class: 'error', testid: 'error', role: 'alert' }),
  ];
  node.append(...parts.filter(Boolean));
  return node;
}

function render() {
  renderCounters();
  const list = visibleEntries();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const shown = list.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
  byTestId('cards').replaceChildren(...shown.map(card));
  byTestId('page').textContent = `${state.page + 1} / ${pages}（${list.length} 寺社）`;
  byTestId('page-prev').disabled = state.page === 0;
  byTestId('page-next').disabled = state.page >= pages - 1;
}

async function main() {
  const [data, saved] = await Promise.all([
    fetch('/api/data').then(r => r.json()),
    fetch('/api/choices').then(r => r.json()),
  ]);
  state.entries = data.entries;
  state.choices = new Map((saved.choices ?? []).map(c => [c.idx, c]));
  for (const b of document.querySelectorAll('[data-filter]')) {
    b.addEventListener('click', () => {
      state.filter = b.dataset.filter;
      state.page = 0;
      render();
    });
  }
  byTestId('page-prev').addEventListener('click', () => {
    state.page = Math.max(0, state.page - 1);
    render();
    window.scrollTo(0, 0);
  });
  byTestId('page-next').addEventListener('click', () => {
    state.page += 1;
    render();
    window.scrollTo(0, 0);
  });
  render();
}

main();
