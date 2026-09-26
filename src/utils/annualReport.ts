import type { SealMark } from '@components/common/Seal';
import { prefectureTier } from '@components/collection/JapanMap';
import type { SpotType } from '@/types/supabase';

/**
 * 年報（画面では「{年}年のふりかえり」）の集計。Issue #274。
 *
 * 仕様: docs/issues/issue-274-annual-report.md（D-3〜D-10）。
 * 「その年」は `visited_at.slice(0, 4)` で見る。`new Date()` を挟まない（Issue #204）
 */

/** 年報を作る年。遡って記録した 2025年以前の年は入口に出さない（D-3） */
export const ANNUAL_REPORT_FIRST_YEAR = 2026;

export type AnnualSceneId =
  | 'cover'
  | 'count'
  | 'months'
  | 'map'
  | 'photos'
  | 'memory'
  | 'badges'
  | 'end';

/** シーンの長さ。動きの試作 v1 の SCENES[].ms（D-9）。締めは自動で次へ行かない */
export const SCENE_MS: Readonly<Record<AnnualSceneId, number>> = {
  cover: 4800,
  count: 5200,
  months: 5200,
  map: 6400,
  photos: 5400,
  memory: 5200,
  badges: 5600,
  end: 0,
};

/** 締めの中の動きが終わるまで（最後の動きの 1100 + 600） */
export const END_SETTLE_MS = 1700;
/** 視差効果を減らす のときに時計を置く所。すべての動きが clamp で最後の形になる */
export const FINAL_CLOCK_MS = 60000;
/** 年報を開く動き */
export const OPEN_MS = 350;
/** これより短く押して離したら「押した」（D-12） */
export const TAP_MAX_MS = 250;
/** 押したままこれだけ経ったら「止まっています」を出す */
export const PAUSE_TAG_DELAY_MS = 260;
/** 開発用「12月として自動再生を試す」の印（D-19） */
export const DEV_AS_DECEMBER_KEY = 'annual_report_dev_as_december';

/** 写真のシーンに並べる数 */
const MAX_PHOTOS = 16;
/** 県の名前の行に出す数 */
const MAX_PREFECTURE_NAMES = 12;

export interface AnnualVisit {
  id: string;
  spotId: string;
  /** YYYY-MM-DD（DATE 型のまま） */
  visitedAt: string;
  createdAt: string;
  imagePath: string | null;
  spotName: string;
  spotType: SpotType;
  prefecture: string | null;
}

export interface AnnualPilgrimage {
  id: string;
  name: string;
  spotIds: string[];
}

export type AnnualTier = 'tier1' | 'tier2' | 'tier3';

export interface AnnualReport {
  year: number;
  isCurrentYear: boolean;
  scenes: AnnualSceneId[];
  cover: { visitedAt: string; spotName: string; imagePath: string | null };
  count: { spots: number; stamps: number; shrines: number; temples: number };
  /** 長さ 12。1月が [0] */
  months: number[];
  topMonth: { month: number; stamps: number };
  /** Y の中で最初に参った順 */
  prefectures: { name: string; stamps: number; tier: AnnualTier }[];
  photos: { total: number; shown: { id: string; imagePath: string | null }[] };
  memory: {
    top: {
      spotName: string;
      prefecture: string | null;
      days: number;
      imagePath: string | null;
    } | null;
    newPrefecture: { name: string; visitedAt: string; spotName: string } | null;
  };
  /** BADGE_DEFINITIONS の順 */
  badges: { id: string; name: string; mark: SealMark }[];
  /** 満願の日の新しい順 */
  pilgrimages: { id: string; name: string; spots: number; completedAt: string }[];
}

/** 記録の並び: visited_at → created_at → id の昇順（D-4） */
function compareVisits(a: AnnualVisit, b: AnnualVisit): number {
  if (a.visitedAt !== b.visitedAt) return a.visitedAt < b.visitedAt ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

const yearOf = (visitedAt: string) => Number(visitedAt.slice(0, 4));

/** total 枚から max 枚を一年を通して散らして選ぶ。floor(i × total / max) */
export function pickEvenly(total: number, max: number): number[] {
  if (total <= max) return Array.from({ length: total }, (_, i) => i);
  return Array.from({ length: max }, (_, i) => Math.floor((i * total) / max));
}

interface BuildInput {
  year: number;
  /** 今の年（日本時間）。見出しの「今年」に使う */
  currentYear: number;
  /** 本人の全件（前の年も翌年も含んでよい） */
  visits: AnnualVisit[];
  pilgrimages: AnnualPilgrimage[];
}

export function buildAnnualReport({ year, currentYear, visits }: BuildInput): AnnualReport | null {
  const inYear = visits.filter(v => yearOf(v.visitedAt) === year).sort(compareVisits);
  if (inYear.length === 0) return null;

  const spotTypes = new Map(inYear.map(v => [v.spotId, v.spotType]));
  const shrines = [...spotTypes.values()].filter(t => t === 'shrine').length;

  const months = Array.from({ length: 12 }, () => 0);
  for (const v of inYear) months[Number(v.visitedAt.slice(5, 7)) - 1] += 1;
  const topStamps = Math.max(...months);

  // Map は入れた順を保つので、並べ替えた記録から作れば「最初に参った順」になる
  const byPrefecture = new Map<string, number>();
  for (const v of inYear) {
    if (v.prefecture === null) continue;
    byPrefecture.set(v.prefecture, (byPrefecture.get(v.prefecture) ?? 0) + 1);
  }

  const first = inYear[0];

  return {
    year,
    isCurrentYear: year === currentYear,
    scenes: ['cover', 'count', 'end'],
    cover: { visitedAt: first.visitedAt, spotName: first.spotName, imagePath: first.imagePath },
    count: {
      spots: spotTypes.size,
      stamps: inYear.length,
      shrines,
      temples: spotTypes.size - shrines,
    },
    months,
    topMonth: { month: months.indexOf(topStamps) + 1, stamps: topStamps },
    prefectures: [...byPrefecture].map(([name, stamps]) => ({
      name,
      stamps,
      tier: prefectureTier(stamps) as AnnualTier,
    })),
    photos: {
      total: inYear.length,
      shown: pickEvenly(inYear.length, MAX_PHOTOS).map(i => ({
        id: inYear[i].id,
        imagePath: inYear[i].imagePath,
      })),
    },
    memory: { top: null, newPrefecture: null },
    badges: [],
    pilgrimages: [],
  };
}

/** 末尾の「都」「府」「県」を取る。北海道はそのまま */
export function shortPrefectureName(name: string): string {
  return name === '北海道' ? name : name.replace(/[都府県]$/, '');
}

/** 地図のシーンの県の名前の行（D-10）。12県まで、それより多いときは「ほか{n}県」 */
export function prefectureNamesLine(names: string[]): string {
  const line = names.slice(0, MAX_PREFECTURE_NAMES).map(shortPrefectureName).join(' ・ ');
  const rest = names.length - MAX_PREFECTURE_NAMES;
  return rest > 0 ? `${line} ほか${rest}県` : line;
}

/** YYYY-MM-DD → 「5月2日」。Date にしない */
export function formatMonthDay(ymd: string): string {
  return `${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8, 10))}日`;
}
