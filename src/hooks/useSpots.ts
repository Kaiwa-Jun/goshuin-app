import { useState, useEffect } from 'react';
import { fetchAllActiveSpots } from '@services/spots';
import type { Spot } from '@/types/supabase';

type FilterMode = 'all' | 'visited' | 'wishlist';

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

  useEffect(() => {
    if (!location) {
      setAllSpots([]);
      setIsLoading(false);
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
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude]);

  // 絞り込みは地図のピンに効かせる。該当0件なら空のまま返す
  // （全件に戻すと「絞ったのに減らない」になる）
  const filterIds =
    filterMode === 'visited'
      ? visitedSpotIds
      : filterMode === 'wishlist'
        ? wishlistSpotIds
        : undefined;
  const spots = filterIds ? allSpots.filter(s => filterIds.has(s.id)) : allSpots;

  return { spots, allSpots, isLoading, error };
}
