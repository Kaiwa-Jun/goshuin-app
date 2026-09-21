import type { BadgeProgress } from '@/types/badge';
import { tsukimairiOf } from '@utils/tsukimairi';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * 参拝日の季節。月で切る。
 *
 * ⚠️ `new Date()` を挟まない。`visited_at` は DATE 型（Issue #204）。
 */
export function seasonOf(visitedAt: string): Season {
  const month = Number(visitedAt.slice(5, 7));
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

interface VisitRow {
  visited_at: string;
  spot_id: string;
}

/** バッジの判定に要る数字を、記録からまとめて出す */
export function buildBadgeProgress(rows: VisitRow[], today: string): BadgeProgress {
  const bySpot = new Map<string, string[]>();
  const byDay = new Map<string, Set<string>>();
  const seasons = new Set<Season>();

  for (const row of rows) {
    bySpot.set(row.spot_id, [...(bySpot.get(row.spot_id) ?? []), row.visited_at]);
    byDay.set(row.visited_at, (byDay.get(row.visited_at) ?? new Set()).add(row.spot_id));
    seasons.add(seasonOf(row.visited_at));
  }

  let longestTsukimairi = 0;
  for (const dates of bySpot.values()) {
    longestTsukimairi = Math.max(longestTsukimairi, tsukimairiOf(dates, today).longest);
  }

  let maxSameDayVisits = 0;
  for (const spots of byDay.values()) {
    maxSameDayVisits = Math.max(maxSameDayVisits, spots.size);
  }

  return {
    visitCount: bySpot.size,
    longestTsukimairi,
    seasonCount: seasons.size,
    maxSameDayVisits,
  };
}
