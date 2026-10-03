// 地図の検索で、寺社の名前に加えて住所と県でも当てる（Issue #311 の第1段。端末の中だけで探す）
import { PREFECTURE_NAMES } from '../../supabase/functions/_shared/prefectures';
import type { FocusRegion } from '@/navigation/types';
import type { Spot } from '@/types/supabase';
import { PREFECTURE } from '@utils/frequentArea';
import { normalizeSpotName } from '@utils/spotName';

/** 地名で当てる言葉の最短。1 文字（「中」）で住所に当てると何にでも当たる */
export const MIN_AREA_QUERY_LENGTH = 2;
/** 場所の行の最大数。4 つ目からの県の寺社も寺社の行には出る */
export const MAX_PLACE_ROWS = 3;

export interface SpotWithDistance {
  spot: Spot;
  distance: number;
}
export type SearchOrder = 'nearby' | 'popular';
export type SpotTypeFilter = 'all' | 'shrine' | 'temple';

export interface SpotRow {
  kind: 'spot';
  spot: Spot;
  distance: number;
}
export interface PlaceRow {
  kind: 'place';
  key: string;
  label: string;
  prefecture: string | null;
  count: number;
  region: FocusRegion;
  /** 外の地名検索から来た行。出典を出す */
  external: boolean;
}
export type SearchRow = SpotRow | PlaceRow;

/** 全角・半角と空白で当たり外れが変わらないようにそろえる */
export function normalizeQuery(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

/** 寺社の県（無ければ住所の先頭の県）と、住所から先頭の県を落とした残り（そろえた形） */
function areaOf(spot: Spot): { pref: string | null; rest: string } {
  const address = spot.address ? normalizeQuery(spot.address) : '';
  return {
    pref: spot.prefecture ?? address.match(PREFECTURE)?.[1] ?? null,
    rest: address.replace(PREFECTURE, ''),
  };
}

/**
 * 地名で当たるか。住所の全体に includes すると「京都」が「東京都…」に当たるので、
 * 県は丸ごとか「都府県」を落とした形（北海道は「北海道」だけ）でだけ当てる
 */
export function isAreaMatch(spot: Spot, normalizedQuery: string): boolean {
  const q = normalizedQuery;
  if (q.length < MIN_AREA_QUERY_LENGTH) return false;
  const { pref, rest } = areaOf(spot);
  if (pref) {
    const p = normalizeQuery(pref);
    if (q === p || q === p.replace(/[都府県]$/, '')) return true;
  }
  if (rest.includes(q)) return true;
  // 「神奈川県横浜市」: 県が合っていて、残りが住所にある
  const qPref = PREFECTURE_NAMES.find(name => q.startsWith(name));
  if (!qPref || qPref !== pref) return false;
  const after = q.slice(qPref.length);
  return after !== '' && rest.includes(after);
}

function isNameMatch(spot: Spot, normalizedQuery: string): boolean {
  return normalizeQuery(spot.name).includes(normalizedQuery);
}

/** 第1段で名前か地名に1件でも当たるか（神社・寺院の絞り込みの前） */
export function hasLocalHits(query: string, spots: SpotWithDistance[]): boolean {
  const q = normalizeQuery(query);
  if (!q) return false;
  return spots.some(({ spot }) => isNameMatch(spot, q) || isAreaMatch(spot, q));
}

/** 寺社が全部入る範囲。spotIds は入力の順 */
export function regionOfSpots(label: string, spots: Spot[]): FocusRegion {
  const lngs = spots.map(s => s.lng);
  const lats = spots.map(s => s.lat);
  return {
    label,
    bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
    spotIds: spots.map(s => s.id),
  };
}

/** JIS の県コード順。県が無い・知らない県は最後 */
function prefectureOrder(pref: string | null): number {
  const i = pref ? PREFECTURE_NAMES.indexOf(pref) : -1;
  return i === -1 ? PREFECTURE_NAMES.length : i;
}

/**
 * 場所の行（第1段）。地名で当たった寺社を県ごとにまとめ、まとまり1つに行を1つ。
 * 「府中」が東京都と山梨県の両方に当たるので、分けないと地図が両県をまたぐ広さに寄る
 */
function buildPlaceRows(label: string, hits: SpotWithDistance[], order: SearchOrder): PlaceRow[] {
  const groups = new Map<string | null, SpotWithDistance[]>();
  for (const hit of hits) {
    const { pref } = areaOf(hit.spot);
    const items = groups.get(pref);
    if (items) items.push(hit);
    else groups.set(pref, [hit]);
  }
  const ranked = [...groups].map(([pref, items]) => ({
    pref,
    items,
    nearest: Math.min(...items.map(i => i.distance)),
  }));
  ranked.sort(
    order === 'nearby'
      ? (a, b) => a.nearest - b.nearest
      : (a, b) =>
          b.items.length - a.items.length || prefectureOrder(a.pref) - prefectureOrder(b.pref)
  );
  return ranked.slice(0, MAX_PLACE_ROWS).map(({ pref, items }) => ({
    kind: 'place',
    key: `area:${pref ?? ''}`,
    label,
    prefecture: pref,
    count: items.length,
    region: regionOfSpots(
      label,
      items.map(i => i.spot)
    ),
    external: false,
  }));
}

const toSpotRow = ({ spot, distance }: SpotWithDistance): SpotRow => ({
  kind: 'spot',
  spot,
  distance,
});

/**
 * 検索の一覧。エンター = いちばん上の行なので、並べ方がそのままエンターの動きになる。
 * spots は自分から近い順（一致どうし・それ以外どうしはこの順を保つ）
 */
export function buildSearchRows({
  query,
  spots,
  filterType,
  order,
}: {
  query: string;
  spots: SpotWithDistance[];
  filterType: SpotTypeFilter;
  order: SearchOrder;
}): SearchRow[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const typed = spots.filter(s => filterType === 'all' || s.spot.type === filterType);

  // 名前がそのまま一致する寺社を先頭に（「明治神宮」のエンターで明治神宮が開く）
  const byName = typed.filter(s => isNameMatch(s.spot, q));
  const exactName = normalizeSpotName(query);
  const exact = byName.filter(s => normalizeSpotName(s.spot.name) === exactName);
  const names = [...exact, ...byName.filter(s => !exact.includes(s))];

  // 地名の寺社は名前でも当たる寺社を含む（地図に寄せたとき抜けないように。両方に数える）
  const byArea = typed.filter(s => isAreaMatch(s.spot, q));
  const placeRows = buildPlaceRows(query.trim(), byArea, order);
  const nameIds = new Set(byName.map(s => s.spot.id));
  const areaOnly = byArea.filter(s => !nameIds.has(s.spot.id));

  const placeFirst = exact.length === 0 && placeRows.length > 0 && byArea.length >= byName.length;
  const nameRows = names.map(toSpotRow);
  const areaRows = areaOnly.map(toSpotRow);
  return placeFirst
    ? [...placeRows, ...nameRows, ...areaRows]
    : [...nameRows, ...placeRows, ...areaRows];
}
