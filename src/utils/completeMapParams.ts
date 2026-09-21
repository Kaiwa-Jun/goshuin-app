import type { RegionStat } from '@services/collection';

/**
 * 完了画面の地図に渡す値。**いま記録したぶんを足した状態**を渡す。
 * 足す前を渡すと、寄った先の県が塗られないまま「はじめて」と出る。
 */
export function buildMapParams(
  regionStats: RegionStat[] | null,
  prefecture: string | null | undefined,
  addedCount: number
) {
  if (!regionStats || !prefecture) return {};

  const before = Object.fromEntries(regionStats.map(s => [s.prefecture, s.stampCount]));
  const previous = before[prefecture] ?? 0;

  return {
    prefecture,
    isFirstInPrefecture: previous === 0,
    stampCountByPrefecture: { ...before, [prefecture]: previous + addedCount },
    totalStampCount: regionStats.reduce((sum, s) => sum + s.stampCount, 0) + addedCount,
  };
}
