import type { VisitLogRow } from '@services/collection';
import { tsukimairiOf, type Tsukimairi } from '@utils/tsukimairi';

export interface TsukimairiEntry extends Tsukimairi {
  spotId: string;
  spotName: string;
}

/**
 * あゆみに出す月参りの一覧。**いま続いているものだけ**。
 *
 * 途切れたものを並べると、半年前に途切れた寺社まで残って重くなる。
 * 途切れた記録（最長N ヶ月）は、その寺社の詳細に1行で残る。
 */
export function tsukimairiList(rows: VisitLogRow[], today: string): TsukimairiEntry[] {
  const bySpot = new Map<string, { name: string; dates: string[] }>();
  for (const row of rows) {
    const entry = bySpot.get(row.spot_id) ?? { name: row.spotName, dates: [] };
    entry.dates.push(row.visited_at);
    bySpot.set(row.spot_id, entry);
  }

  return (
    [...bySpot.entries()]
      .map(([spotId, { name, dates }]) => ({
        ...tsukimairiOf(dates, today),
        spotId,
        spotName: name,
      }))
      .filter(entry => entry.shouldShowCard)
      // 満願に近いものから
      .sort((a, b) => b.current - a.current)
  );
}
