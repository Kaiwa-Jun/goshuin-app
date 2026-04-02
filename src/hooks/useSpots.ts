import { useState, useEffect } from 'react';
import { fetchSpotsByBounds } from '@services/spots';
import { getBoundingBox, RADIUS_STEPS, MIN_SPOTS_THRESHOLD } from '@utils/geo';
import type { Spot } from '@/types/supabase';
import type { BoundingBox } from '@utils/geo';

type FilterMode = 'all' | 'visited';

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface UseSpotsReturn {
  spots: Spot[];
  allSpots: Spot[];
  isLoading: boolean;
  error: string | null;
}

function regionToBounds(region: MapRegion): BoundingBox {
  return {
    minLat: region.latitude - region.latitudeDelta / 2,
    maxLat: region.latitude + region.latitudeDelta / 2,
    minLng: region.longitude - region.longitudeDelta / 2,
    maxLng: region.longitude + region.longitudeDelta / 2,
  };
}

export function useSpots(
  location: { latitude: number; longitude: number } | null,
  mapRegion: MapRegion | null = null,
  filterMode: FilterMode = 'all',
  visitedSpotIds?: Set<string>
): UseSpotsReturn {
  const [allSpots, setAllSpots] = useState<Spot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location && !mapRegion) {
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

        if (mapRegion) {
          // マップ領域が指定されている場合、その範囲のスポットを取得
          const bounds = regionToBounds(mapRegion);
          spots = await fetchSpotsByBounds(bounds);
        } else if (location) {
          // 初期表示: 段階的に半径を拡大して最低5件取得
          for (const radius of RADIUS_STEPS) {
            const bounds = getBoundingBox(location.latitude, location.longitude, radius);
            spots = await fetchSpotsByBounds(bounds);
            if (cancelled) return;
            if (spots.length >= MIN_SPOTS_THRESHOLD) break;
          }
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
  }, [
    location?.latitude,
    location?.longitude,
    mapRegion?.latitude,
    mapRegion?.longitude,
    mapRegion?.latitudeDelta,
    mapRegion?.longitudeDelta,
  ]);

  const spots =
    filterMode === 'visited' && visitedSpotIds
      ? allSpots.filter(s => visitedSpotIds.has(s.id))
      : allSpots;

  return { spots, allSpots, isLoading, error };
}
