import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@hooks/useAuth';
import {
  fetchCollectionStats,
  fetchRegionStats,
  fetchVisitLog,
  type RegionStat,
  type VisitLogRow,
} from '@services/collection';
import { buildBadgeProgress } from '@utils/badgeProgress';
import { toLocalDateString } from '@utils/localDate';
import { tsukimairiList, type TsukimairiEntry } from '@utils/tsukimairiList';
import type { BadgeProgress } from '@/types/badge';
import { fetchAllStamps } from '@services/stamps';
import type { StampWithSpot } from '@/types/supabase';
import { fetchPilgrimageProgress, type PilgrimageProgress } from '@services/pilgrimages';

/** 「最近の参拝」に出す件数。増やすと画面が伸びるだけなので、まず3件で始める */
export const RECENT_VISITS_COUNT = 3;

interface UseCollectionStatsReturn {
  spotCount: number;
  stampCount: number;
  regionStats: RegionStat[];
  /** 最近の参拝（直近3件）。地図が「どこ」を見せるので、こちらは「いつ・どの寺社か」を受ける */
  recentStamps: StampWithSpot[];
  /** バッジの判定に要る数字。参拝の記録から出す */
  badgeProgress: BadgeProgress;
  /** いま続いている月参り。満願に近い順 */
  tsukimairi: TsukimairiEntry[];
  pilgrimageProgress: PilgrimageProgress[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * CollectionScreen用。フォーカス時にコレクション統計をリフェッチする
 */
export function useCollectionStats(): UseCollectionStatsReturn {
  const { user } = useAuth();
  const [spotCount, setSpotCount] = useState(0);
  const [stampCount, setStampCount] = useState(0);
  const [regionStats, setRegionStats] = useState<RegionStat[]>([]);
  const [pilgrimageProgress, setPilgrimageProgress] = useState<PilgrimageProgress[]>([]);
  const [recentStamps, setRecentStamps] = useState<StampWithSpot[]>([]);
  const [visitLog, setVisitLog] = useState<VisitLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setSpotCount(0);
        setStampCount(0);
        setRegionStats([]);
        setPilgrimageProgress([]);
        setRecentStamps([]);
        setVisitLog([]);
        setIsLoading(false);
        return;
      }

      let cancelled = false;

      (async () => {
        try {
          setIsLoading(true);
          const [stats, regions, pilgrimages, recent, log] = await Promise.all([
            fetchCollectionStats(user.id),
            fetchRegionStats(user.id),
            fetchPilgrimageProgress(user.id),
            fetchAllStamps(user.id, RECENT_VISITS_COUNT),
            fetchVisitLog(user.id),
          ]);
          if (!cancelled) {
            setSpotCount(stats.spotCount);
            setStampCount(stats.stampCount);
            setRegionStats(regions);
            setPilgrimageProgress(pilgrimages);
            setRecentStamps(recent);
            setVisitLog(log);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) {
            setSpotCount(0);
            setStampCount(0);
            setRegionStats([]);
            setPilgrimageProgress([]);
            setRecentStamps([]);
            setVisitLog([]);
            setError(e instanceof Error ? e.message : '取得に失敗しました');
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [user, refreshKey])
  );

  // 今日の日付は1回だけ作る。DATE のまま扱う（Issue #204）
  const today = toLocalDateString(new Date());
  const badgeProgress = useMemo(() => buildBadgeProgress(visitLog, today), [visitLog, today]);
  const tsukimairi = useMemo(() => tsukimairiList(visitLog, today), [visitLog, today]);

  return {
    spotCount,
    stampCount,
    regionStats,
    recentStamps,
    badgeProgress,
    tsukimairi,
    pilgrimageProgress,
    isLoading,
    error,
    refetch,
  };
}
