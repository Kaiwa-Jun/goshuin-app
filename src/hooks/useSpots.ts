import { useState, useEffect } from 'react';
import { fetchAllActiveSpots } from '@services/spots';
import type { Spot } from '@/types/supabase';
import { spotFilterIds, type SpotFilterMode } from '@utils/spotGeoJson';

type FilterMode = SpotFilterMode;

interface UseSpotsReturn {
  spots: Spot[];
  allSpots: Spot[];
  isLoading: boolean;
  error: string | null;
}

export function useSpots(
  location: { latitude: number; longitude: number } | null,
  filterMode: FilterMode = 'all',
  visitedSpotIds?: Set<string>,
  wishlistSpotIds?: Set<string>
): UseSpotsReturn {
  const [allSpots, setAllSpots] = useState<Spot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // いまの一覧がどの位置で読んだものか。位置が届いた（変わった）描画では、effect が
  // 走るまでの 1 描画だけ前の一覧（位置が無いときの空の一覧）が isLoading:false で
  // 残る。そこで「読み終えた」と見せると、地図のカードが県の名前なしで一瞬出る（Issue #327 D-9）
  const locationKey = location ? `${location.latitude},${location.longitude}` : null;
  const [settledKey, setSettledKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!location) {
      setAllSpots([]);
      setIsLoading(false);
      setSettledKey(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const spots = await fetchAllActiveSpots();
        if (!cancelled) setAllSpots(spots);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setAllSpots([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setSettledKey(locationKey);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude]);

  // 絞り込みは地図のピンに効かせる。該当0件なら空のまま返す
  // （全件に戻すと「絞ったのに減らない」になる）
  const filterIds = spotFilterIds(filterMode, visitedSpotIds, wishlistSpotIds);
  const spots = filterIds ? allSpots.filter(s => filterIds.has(s.id)) : allSpots;

  return { spots, allSpots, isLoading: isLoading || settledKey !== locationKey, error };
}
