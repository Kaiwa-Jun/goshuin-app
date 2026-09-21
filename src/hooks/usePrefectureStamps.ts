import { useEffect, useMemo, useState } from 'react';

import { fetchSpotCountByPrefecture } from '@services/collection';
import { fetchStampsByPrefecture } from '@services/stamps';
import type { StampWithSpot } from '@/types/supabase';

interface PrefectureStat {
  stampCount: number;
  visitedCount: number;
  totalCount: number;
}

/**
 * 県別画面のデータ。
 *
 * 枚数と箇所数は取ってきた御朱印から数える。県ごとの集計をもう一度引くより軽いし、
 * 画面に出ている一覧と数字が必ず一致する。分母（その県の寺社の総数）だけ別に引く。
 */
export function usePrefectureStamps(userId: string | null, prefecture: string) {
  const [stamps, setStamps] = useState<StampWithSpot[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const [rows, total] = await Promise.all([
        userId ? fetchStampsByPrefecture(userId, prefecture) : Promise.resolve([]),
        fetchSpotCountByPrefecture(prefecture),
      ]);
      if (cancelled) return;
      setStamps(rows);
      setTotalCount(total);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, prefecture]);

  const stat = useMemo<PrefectureStat>(
    () => ({
      stampCount: stamps.length,
      visitedCount: new Set(stamps.map(s => s.spot_id)).size,
      totalCount,
    }),
    [stamps, totalCount]
  );

  return { stamps, stat, isLoading };
}
