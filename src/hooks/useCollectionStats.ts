import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@hooks/useAuth';
import { fetchCollectionStats, fetchRegionStats } from '@services/collection';
import { fetchPilgrimageProgress, type PilgrimageProgress } from '@services/pilgrimages';

interface RegionStat {
  prefecture: string;
  visitedCount: number;
  totalCount: number;
}

interface UseCollectionStatsReturn {
  spotCount: number;
  stampCount: number;
  regionStats: RegionStat[];
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
        setIsLoading(false);
        return;
      }

      let cancelled = false;

      (async () => {
        try {
          setIsLoading(true);
          const [stats, regions, pilgrimages] = await Promise.all([
            fetchCollectionStats(user.id),
            fetchRegionStats(user.id),
            fetchPilgrimageProgress(user.id),
          ]);
          if (!cancelled) {
            setSpotCount(stats.spotCount);
            setStampCount(stats.stampCount);
            setRegionStats(regions);
            setPilgrimageProgress(pilgrimages);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) {
            setSpotCount(0);
            setStampCount(0);
            setRegionStats([]);
            setPilgrimageProgress([]);
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

  return { spotCount, stampCount, regionStats, pilgrimageProgress, isLoading, error, refetch };
}
