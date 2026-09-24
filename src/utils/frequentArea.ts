import { calculateDistance } from '@utils/geo';

/** まとめる距離。仙台の街なかの有名どころが1つに入る大きさ */
export const AREA_RADIUS_KM = 5;
/** 「よく行く」とみなす、参拝した月の数。旅行（1〜2回）は入らない */
export const AREA_MIN_MONTHS = 3;

export interface AreaVisit {
  spotId: string;
  /** YYYY-MM-DD（DATE のまま。new Date() を挟まない） */
  visitedAt: string;
  lat: number;
  lng: number;
  address: string | null;
  prefecture: string | null;
}

export interface FrequentArea {
  center: { lat: number; lng: number };
  /** 参拝した月の数 */
  months: number;
  /** 記録の数 */
  count: number;
  /** 「〇〇のまわり」の〇〇 */
  label: string;
  /** まとまりに入った寺社 */
  spotIds: Set<string>;
}

/**
 * よく行くエリア（Issue #245）。**端末の位置情報は使わない**。記録した寺社の位置から割り出す。
 *
 * 住んでいる場所と御朱印を集めに行く場所は違うことが多い（実家から仙台の街へ回りに行く、など）。
 * 記録の位置なら「回りに行く街」が拾える。数えるのは**参拝した月の数**で、枚数ではない。
 * 旅行1回で10枚集めても、よく行く場所にはしない。
 */
export function frequentArea(visits: AreaVisit[]): FrequentArea | null {
  // ponytail: 貪欲にまとめる O(n × まとまり)。記録が数千件になったら格子で先に分ける
  const clusters: { lat: number; lng: number; items: AreaVisit[] }[] = [];
  for (const v of visits) {
    const hit = clusters.find(c => calculateDistance(c.lat, c.lng, v.lat, v.lng) < AREA_RADIUS_KM);
    if (hit) {
      hit.items.push(v);
      hit.lat = hit.items.reduce((s, x) => s + x.lat, 0) / hit.items.length;
      hit.lng = hit.items.reduce((s, x) => s + x.lng, 0) / hit.items.length;
    } else {
      clusters.push({ lat: v.lat, lng: v.lng, items: [v] });
    }
  }

  const scored = clusters
    .map(c => ({ c, months: new Set(c.items.map(v => v.visitedAt.slice(0, 7))).size }))
    .filter(x => x.months >= AREA_MIN_MONTHS)
    .sort((a, b) => b.months - a.months || b.c.items.length - a.c.items.length);

  for (const { c, months } of scored) {
    const label = areaLabel(c.items);
    if (!label) continue;
    return {
      center: { lat: c.lat, lng: c.lng },
      months,
      count: c.items.length,
      label,
      spotIds: new Set(c.items.map(v => v.spotId)),
    };
  }
  return null;
}

export const PREFECTURE = /^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/;

/**
 * 住所から市区町村（接尾辞つき）。郡は飛ばす（柴田郡村田町 → 村田町）。政令市は区まで行かない（仙台市青葉区 → 仙台市）
 */
export function cityNameOf(address: string): string | null {
  const rest = address.replace(PREFECTURE, '').replace(/^.+?郡/, '');
  // ponytail: 「四日市市」「十日町市」のように名前に市町村の字を含むものは途中で切れる。困ったら市区町村の一覧と突き合わせる
  const m = rest.match(/^(.+?[市区町村])/);
  return m ? m[1] : null;
}

/** エリアの名前用。接尾辞を落とす（仙台市 → 仙台） */
function cityOf(address: string): string | null {
  return cityNameOf(address)?.slice(0, -1) ?? null;
}

/**
 * エリアの名前。住所で一番多い市区町村から。取れなければ都道府県（「県」「府」「都」は落とす）
 */
export function areaLabel(items: Pick<AreaVisit, 'address' | 'prefecture'>[]): string | null {
  const count = new Map<string, number>();
  for (const it of items) {
    const city = it.address ? cityOf(it.address) : null;
    if (city) count.set(city, (count.get(city) ?? 0) + 1);
  }
  if (count.size > 0) return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const pref = items.find(it => it.prefecture)?.prefecture;
  if (!pref) return null;
  return pref === '北海道' ? pref : pref.replace(/[都府県]$/, '');
}
