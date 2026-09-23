import { distanceOf, nearestUnearned } from '@services/badges';
import type { PilgrimageProgress } from '@services/pilgrimages';
import type { TsukimairiEntry } from '@utils/tsukimairiList';
import type { Badge, BadgeProgress } from '@/types/badge';

/** 巡礼の行を出す残りの社数。日帰りで回れるのはこのくらいまで */
const PILGRIMAGE_MAX_REMAINING = 2;
/** 月参りの行を出す、満願までの月数 */
const TSUKIMAIRI_MAX_REMAINING = 3;
/** 印の行を出す、残りの割合 */
const SEAL_MAX_RATIO = 0.2;
const MAX_ROWS = 3;
/** エリアのシートに並べる、まだの寺社の数 */
const AREA_MAX_SPOTS = 5;

export interface AreaSpot {
  id: string;
  name: string;
  address: string | null;
  type: 'shrine' | 'temple';
  distanceKm: number;
}

export type MouSukoshiRow =
  | { kind: 'pilgrimage'; pilgrimage: PilgrimageProgress; remaining: number }
  | { kind: 'tsukimairi'; entry: TsukimairiEntry; remaining: number }
  | { kind: 'seal'; badge: Badge; remaining: number; unit: string }
  | {
      kind: 'area';
      label: string;
      months: number;
      /** まだの寺社（近い順）。巡礼の行に出ている残りは含めない */
      spots: AreaSpot[];
      /** 巡礼の行に出ている残りの寺社。シートで「〇〇の、残りの1社」と薄く添える */
      alsoInCourse: (AreaSpot & { courseName: string; courseRemaining: number })[];
    };

export interface MouSukoshiInput {
  pilgrimages: PilgrimageProgress[];
  tsukimairi: TsukimairiEntry[];
  /** 今月すでに参拝した寺社 */
  visitedThisMonth: Set<string>;
  badgeProgress: BadgeProgress;
  /** よく行くエリアと、そこのまだの寺社（近い順） */
  area: { label: string; months: number; spots: AreaSpot[] } | null;
}

const KIND_ORDER = { pilgrimage: 0, tsukimairi: 1, seal: 2 } as const;

/**
 * あゆみの「もう少し」（Issue #245）。**暮らしの中で踏み出せる一歩だけ**を、最大3行。
 *
 * 地方の制覇や都道府県は出さない。「関東 あと2県」は旅行レベルの労力で、見るたびに
 * できていないことを突きつけるだけになる（月参りが効くのは、近く・周期があり・労力が小さいから）
 */
export function mouSukoshi(input: MouSukoshiInput): MouSukoshiRow[] {
  const rows: Exclude<MouSukoshiRow, { kind: 'area' }>[] = [];

  const courses = input.pilgrimages.filter(p => {
    const remaining = p.totalSpots - p.visitedCount;
    return p.totalSpots > 0 && remaining >= 1 && remaining <= PILGRIMAGE_MAX_REMAINING;
  });
  for (const p of courses)
    rows.push({ kind: 'pilgrimage', pilgrimage: p, remaining: p.totalSpots - p.visitedCount });

  for (const entry of input.tsukimairi) {
    if (entry.isBroken || entry.isMangan || entry.current <= 0) continue;
    if (entry.remaining < 1 || entry.remaining > TSUKIMAIRI_MAX_REMAINING) continue;
    // 今月もう来ているなら、今月できることはない
    if (input.visitedThisMonth.has(entry.spotId)) continue;
    rows.push({ kind: 'tsukimairi', entry, remaining: entry.remaining });
  }

  const badge = nearestUnearned(input.badgeProgress);
  // 満願の印は月参りの行と同じことを言うので出さない
  if (badge && badge.condition.type !== 'tsukimairi') {
    const d = distanceOf(badge.condition, input.badgeProgress);
    const remaining = d.target - d.current;
    const near =
      badge.condition.type === 'four_seasons'
        ? remaining === 1
        : remaining / d.target <= SEAL_MAX_RATIO;
    if (remaining > 0 && near) rows.push({ kind: 'seal', badge, remaining, unit: d.unit });
  }

  rows.sort((a, b) => a.remaining - b.remaining || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const out: MouSukoshiRow[] = rows.slice(0, MAX_ROWS);

  if (input.area && out.length < MAX_ROWS) {
    // まだの寺社のうち、巡礼の行に出ている残りはどのコースのものか
    const courseOf = new Map<string, { name: string; remaining: number }>();
    for (const r of out) {
      if (r.kind !== 'pilgrimage') continue;
      for (const id of r.pilgrimage.unvisitedSpotIds ?? [])
        courseOf.set(id, { name: r.pilgrimage.name, remaining: r.remaining });
    }
    // 除いてから数を絞る（先に絞ると、残りの寺社のぶんだけ一覧が短くなる）
    const spots = input.area.spots.filter(s => !courseOf.has(s.id)).slice(0, AREA_MAX_SPOTS);
    if (spots.length > 0) {
      out.push({
        kind: 'area',
        label: input.area.label,
        months: input.area.months,
        spots,
        alsoInCourse: input.area.spots
          .filter(s => courseOf.has(s.id))
          .map(s => {
            const c = courseOf.get(s.id)!;
            return { ...s, courseName: c.name, courseRemaining: c.remaining };
          }),
      });
    }
  }
  return out;
}
