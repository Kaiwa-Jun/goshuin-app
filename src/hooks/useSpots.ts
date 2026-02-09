import { useState, useEffect } from 'react';
import { fetchSpotsByBounds } from '@services/spots';
import { getBoundingBox, RADIUS_STEPS, MIN_SPOTS_THRESHOLD } from '@utils/geo';
import type { Spot } from '@/types/supabase';

type FilterMode = 'all' | 'visited';

interface UseSpotsReturn {
  spots: Spot[];
  allSpots: Spot[];
  isLoading: boolean;
  error: string | null;
}

export function useSpots(
  location: { latitude: number; longitude: number } | null,
  filterMode: FilterMode = 'all',
  visitedSpotIds?: Set<string>
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
        let spots: Spot[] = [];

        for (const radius of RADIUS_STEPS) {
          const bounds = getBoundingBox(location.latitude, location.longitude, radius);
          spots = await fetchSpotsByBounds(bounds);
          if (cancelled) return;
          if (spots.length >= MIN_SPOTS_THRESHOLD) break;
        }

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

  const spots =
    filterMode === 'visited' && visitedSpotIds
      ? allSpots.filter(s => visitedSpotIds.has(s.id))
      : allSpots;

  return { spots, allSpots, isLoading, error };
}
