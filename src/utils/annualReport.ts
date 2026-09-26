import type { SealMark } from '@components/common/Seal';
import { prefectureTier } from '@components/collection/JapanMap';
import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_BOXES,
  type PrefectureBox,
} from '@/constants/japanMap';
import { evaluateNewBadges } from '@services/badges';
import { buildBadgeProgress } from '@utils/badgeProgress';
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

type Memory = AnnualReport['memory'];

/**
 * いちばん多く参った寺社（D-5）。同じ日に何枚いただいても1回と数える。
 * 2回以上のときだけ。同じ回数なら Y の中で先に参った方
 */
function mostVisited(inYear: AnnualVisit[]): Memory['top'] {
  const days = new Map<string, Set<string>>();
  for (const v of inYear) days.set(v.spotId, (days.get(v.spotId) ?? new Set()).add(v.visitedAt));

  let best: { spotId: string; days: number } | null = null;
  // days は inYear の並び（最初に参った順）で入っているので、> だけで「先に参った方」が残る
  for (const [spotId, set] of days) {
    if (set.size >= 2 && (best === null || set.size > best.days)) best = { spotId, days: set.size };
  }
  if (best === null) return null;

  const records = inYear.filter(v => v.spotId === best.spotId);
  const latest = records[records.length - 1];
  return {
    spotName: latest.spotName,
    prefecture: latest.prefecture,
    days: best.days,
    imagePath: latest.imagePath,
  };
}

/**
 * はじめて足を運んだ県（D-5）。Y より前の記録に無い県のうち、Y の中でいちばん早い1県。
 * Y より前の記録が1件も無い人（使い始めた年）は出さない
 */
function firstNewPrefecture(inYear: AnnualVisit[], before: AnnualVisit[]): Memory['newPrefecture'] {
  if (before.length === 0) return null;
  const known = new Set(before.map(v => v.prefecture));
  const found = inYear.find(v => v.prefecture !== null && !known.has(v.prefecture));
  if (!found || found.prefecture === null) return null;
  return { name: found.prefecture, visitedAt: found.visitedAt, spotName: found.spotName };
}

const toBadgeRows = (visits: AnnualVisit[]) =>
  visits.map(v => ({ visited_at: v.visitedAt, spot_id: v.spotId }));

/**
 * その年に取った印（D-6）。取った日はどこにも保存していないので、
 * 「Y より前」と「Y の終わりまで」の判定の差を Y に取った印とする
 */
function badgesOfYear(
  year: number,
  before: AnnualVisit[],
  upToYear: AnnualVisit[]
): AnnualReport['badges'] {
  const was = buildBadgeProgress(toBadgeRows(before), `${year - 1}-12-31`);
  const now = buildBadgeProgress(toBadgeRows(upToYear), `${year}-12-31`);
  return evaluateNewBadges(was, now).map(({ id, name, mark }) => ({ id, name, mark }));
}

/**
 * その年に満願した巡礼（D-7）。札所がすべて記録済みのとき、
 * 満願の日 = 札所ごとの最初の記録のうちいちばん遅い日
 */
function completedPilgrimages(
  year: number,
  upToYear: AnnualVisit[],
  pilgrimages: AnnualPilgrimage[]
): AnnualReport['pilgrimages'] {
  const firstVisit = new Map<string, string>();
  for (const v of upToYear) {
    const known = firstVisit.get(v.spotId);
    if (known === undefined || v.visitedAt < known) firstVisit.set(v.spotId, v.visitedAt);
  }

  const done: AnnualReport['pilgrimages'] = [];
  for (const p of pilgrimages) {
    if (p.spotIds.length === 0) continue;
    const dates = p.spotIds.map(id => firstVisit.get(id));
    if (dates.some(d => d === undefined)) continue;
    const completedAt = (dates as string[]).reduce((a, b) => (a > b ? a : b));
    if (yearOf(completedAt) !== year) continue;
    done.push({ id: p.id, name: p.name, spots: p.spotIds.length, completedAt });
  }
  return done.sort((a, b) =>
    a.completedAt === b.completedAt ? 0 : a.completedAt > b.completedAt ? -1 : 1
  );
}

export function buildAnnualReport({
  year,
  currentYear,
  visits,
  pilgrimages,
}: BuildInput): AnnualReport | null {
  const inYear = visits.filter(v => yearOf(v.visitedAt) === year).sort(compareVisits);
  if (inYear.length === 0) return null;

  // 翌年以降の記録は必ず落とす（2027年に見ても 2026年の印・満願が変わらない）
  const before = visits.filter(v => yearOf(v.visitedAt) < year);
  const upToYear = visits.filter(v => yearOf(v.visitedAt) <= year);

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
  const memory: Memory = {
    top: mostVisited(inYear),
    newPrefecture: firstNewPrefecture(inYear, before),
  };
  const badges = badgesOfYear(year, before, upToYear);
  const completed = completedPilgrimages(year, upToYear, pilgrimages);

  // シーンと飛ばす規則（D-8）。順は固定
  const scenes: AnnualSceneId[] = ['cover', 'count'];
  if (months.filter(n => n > 0).length >= 2) scenes.push('months');
  if (byPrefecture.size >= 1) scenes.push('map');
  if (inYear.length >= 3) scenes.push('photos');
  if (memory.top !== null || memory.newPrefecture !== null) scenes.push('memory');
  if (badges.length >= 1 || completed.length >= 1) scenes.push('badges');
  scenes.push('end');

  return {
    year,
    isCurrentYear: year === currentYear,
    scenes,
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
    memory,
    badges,
    pilgrimages: completed,
  };
}

/* ── 地図の寄り（D-10） ── */

/** 寄りの余白（viewBox の単位） */
const FIT_PAD = 70;
/** これより寄らない */
const FIT_MAX_SCALE = 4;

export interface MapFit {
  scale: number;
  tx: number;
  ty: number;
}

const NO_FIT: MapFit = { scale: 1, tx: 0, ty: 0 };

/**
 * 足を運んだ県すべてが収まるように寄る（viewBox の単位。試作の fitTransform）。
 * 1倍以下になるとき（ほぼ全国）と県が0のときは寄らない
 */
export function fitPrefectures(names: string[]): MapFit {
  const boxes = names
    .map(name => JAPAN_PREFECTURE_BOXES[name])
    .filter((b): b is PrefectureBox => b !== undefined);
  if (boxes.length === 0) return { ...NO_FIT };

  const x0 = Math.min(...boxes.map(b => b.x)) - FIT_PAD;
  const y0 = Math.min(...boxes.map(b => b.y)) - FIT_PAD;
  const x1 = Math.max(...boxes.map(b => b.x + b.width)) + FIT_PAD;
  const y1 = Math.max(...boxes.map(b => b.y + b.height)) + FIT_PAD;
  const scale = Math.min(FIT_MAX_SCALE, JAPAN_MAP_WIDTH / (x1 - x0), JAPAN_MAP_HEIGHT / (y1 - y0));
  if (scale <= 1) return { ...NO_FIT };

  return {
    scale,
    tx: JAPAN_MAP_WIDTH / 2 - (scale * (x0 + x1)) / 2,
    ty: JAPAN_MAP_HEIGHT / 2 - (scale * (y0 + y1)) / 2,
  };
}

/**
 * viewBox の寄りを、RN の transform（中心が基準・[translateX, translateY, scale] の順）に直す。
 * `SaveMapReveal` と同じ並び
 */
export function toViewTransform(
  fit: MapFit,
  width: number
): { scale: number; translateX: number; translateY: number } {
  const k = width / JAPAN_MAP_WIDTH;
  const height = (width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;
  return {
    scale: fit.scale,
    translateX: fit.tx * k + ((fit.scale - 1) * width) / 2,
    translateY: fit.ty * k + ((fit.scale - 1) * height) / 2,
  };
}

/* ── 間隔（D-9）。多い人でもシーンの長さの中に収める ── */

/** 県の塗りの間隔。6県までは試作と同じ */
export function mapStepMs(n: number): number {
  return Math.min(380, Math.floor(2280 / n));
}

/** 印の間隔。6つまでは試作と同じ */
export function sealStepMs(n: number): number {
  return Math.min(650, Math.floor(4100 / n));
}

/** 見出しの「今年」。過ぎた年は「{年}年」にする（D-15） */
export function sceneCopy(
  year: number,
  isCurrentYear: boolean
): { countKick: string; photosKick: string; badgesKick: string; manganKick: string } {
  if (isCurrentYear) {
    return {
      countKick: '今年めぐった寺社',
      photosKick: '今年の御朱印',
      badgesKick: '今年いただいた印',
      manganKick: '今年の満願',
    };
  }
  return {
    countKick: `${year}年にめぐった寺社`,
    photosKick: `${year}年の御朱印`,
    badgesKick: `${year}年にいただいた印`,
    manganKick: `${year}年の満願`,
  };
}

/* ── あゆみの入口（D-16） ── */

export interface AnnualYearSummary {
  year: number;
  spots: number;
  stamps: number;
}

/**
 * card = 12月 かつ 今の年に記録があるとき、その年。
 * shelf = 最初の年から去年までで記録のある年（新しい順）
 */
export function annualReportEntries(
  visits: { visited_at: string; spot_id: string }[],
  now: { year: number; month: number }
): { card: AnnualYearSummary | null; shelf: AnnualYearSummary[] } {
  const byYear = new Map<number, { spots: Set<string>; stamps: number }>();
  for (const v of visits) {
    const y = yearOf(v.visited_at);
    const acc = byYear.get(y) ?? { spots: new Set<string>(), stamps: 0 };
    acc.spots.add(v.spot_id);
    acc.stamps += 1;
    byYear.set(y, acc);
  }
  const summary = (y: number): AnnualYearSummary | null => {
    const acc = byYear.get(y);
    return acc ? { year: y, spots: acc.spots.size, stamps: acc.stamps } : null;
  };

  const shelf = [...byYear.keys()]
    .filter(y => y >= ANNUAL_REPORT_FIRST_YEAR && y < now.year)
    .sort((a, b) => b - a)
    .map(y => summary(y) as AnnualYearSummary);

  return { card: now.month === 12 ? summary(now.year) : null, shelf };
}

/* ── 自動再生（D-17） ── */

export type AutoPlayDecision =
  | { play: true; year: number }
  | {
      play: false;
      reason: 'guest' | 'not-december' | 'already-shown' | 'error' | 'no-records';
    };

/** 判定の順: guest → not-december → already-shown → error（null）→ no-records（0）→ 出す */
export function decideAutoPlay({
  now,
  userId,
  shown,
  stampsInYear,
}: {
  now: { year: number; month: number };
  userId: string | null;
  shown: boolean;
  stampsInYear: number | null;
}): AutoPlayDecision {
  if (userId === null) return { play: false, reason: 'guest' };
  if (now.month !== 12) return { play: false, reason: 'not-december' };
  if (shown) return { play: false, reason: 'already-shown' };
  if (stampsInYear === null) return { play: false, reason: 'error' };
  if (stampsInYear === 0) return { play: false, reason: 'no-records' };
  return { play: true, year: now.year };
}

/** 自動再生を出したかの印。その年・そのアカウントごと */
export function autoPlayStorageKey(year: number, userId: string): string {
  return `annual_report_autoplayed:${year}:${userId}`;
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
