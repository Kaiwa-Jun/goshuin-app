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
import { fetchSpotsByBounds } from '@services/spots';
import { AREA_RADIUS_KM, frequentArea } from '@utils/frequentArea';
import { calculateDistance, getBoundingBox } from '@utils/geo';
import { mouSukoshi, type AreaSpot, type MouSukoshiRow } from '@utils/mouSukoshi';

/** よく行くエリアで「まだの寺社」に数えるランク。小さな寺社まで並べると数が膨らむ */
const AREA_MIN_RANK = 3;

type AreaWithSpots = { label: string; months: number; spots: AreaSpot[] } | null;

/**
 * よく行くエリアと、そこのまだの寺社（Issue #245）。
 * 端末の位置は使わない。記録した寺社の位置から割り出す
 */
async function loadArea(log: VisitLogRow[]): Promise<AreaWithSpots> {
  const area = frequentArea(
    log
      .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number')
      .map(r => ({
        spotId: r.spot_id,
        visitedAt: r.visited_at,
        lat: r.lat as number,
        lng: r.lng as number,
        address: r.address ?? null,
        prefecture: r.prefecture ?? null,
      }))
  );
  if (!area) return null;

  const visited = new Set(log.map(r => r.spot_id));
  const { lat, lng } = area.center;
  const nearby = await fetchSpotsByBounds(getBoundingBox(lat, lng, AREA_RADIUS_KM));
  const spots = nearby
    .filter(s => s.rank >= AREA_MIN_RANK && !visited.has(s.id))
    .map(s => ({
      id: s.id,
      name: s.name,
      address: s.address,
      type: s.type,
      distanceKm: calculateDistance(lat, lng, s.lat, s.lng),
    }))
    .filter(s => s.distanceKm <= AREA_RADIUS_KM)
    // 数を絞るのは mouSukoshi（巡礼の残りを除いたあと）
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return { label: area.label, months: area.months, spots };
}

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
  /** あゆみの「もう少し」。暮らしの中で踏み出せる一歩だけ、最大3行（Issue #245） */
  mouSukoshi: MouSukoshiRow[];
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
  const [area, setArea] = useState<AreaWithSpots>(null);
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
        setArea(null);
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
          // エリアの寺社は取れなくても、あゆみの他は出す
          const nearArea = await loadArea(log).catch(() => null);
          if (!cancelled) {
            setSpotCount(stats.spotCount);
            setStampCount(stats.stampCount);
            setRegionStats(regions);
            setPilgrimageProgress(pilgrimages);
            setRecentStamps(recent);
            setVisitLog(log);
            setArea(nearArea);
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
            setArea(null);
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
  const rows = useMemo(
    () =>
      mouSukoshi({
        pilgrimages: pilgrimageProgress,
        tsukimairi,
        visitedThisMonth: new Set(
          visitLog.filter(r => r.visited_at.startsWith(today.slice(0, 7))).map(r => r.spot_id)
        ),
        badgeProgress,
        area,
      }),
    [pilgrimageProgress, tsukimairi, visitLog, today, badgeProgress, area]
  );

  return {
    spotCount,
    stampCount,
    regionStats,
    recentStamps,
    badgeProgress,
    tsukimairi,
    pilgrimageProgress,
    mouSukoshi: rows,
    isLoading,
    error,
    refetch,
  };
}
