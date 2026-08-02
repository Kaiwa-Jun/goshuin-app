import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PermissionStatus } from 'expo-location';
import { useSpots } from '@hooks/useSpots';
import { useLocation } from '@hooks/useLocation';
import { calculateDistance } from '@utils/geo';
import type { Spot } from '@/types/supabase';

interface SpotWithDistance {
  spot: Spot;
  distance: number;
}

export type SuggestionMode = 'nearby' | 'popular';

/** 未入力時に提案するスポットの最大件数 */
export const MAX_SUGGESTED_SPOTS = 10;

export interface UseSearchScreenReturn {
  query: string;
  setQuery: (text: string) => void;
  results: SpotWithDistance[];
  filterType: 'all' | 'shrine' | 'temple';
  setFilterType: (type: 'all' | 'shrine' | 'temple') => void;
  clearSearch: () => void;
  suggestedSpots: SpotWithDistance[];
  suggestionMode: SuggestionMode;
}

const DEBOUNCE_MS = 300;

export function useSearchScreen(): UseSearchScreenReturn {
  const { location, permissionStatus } = useLocation();
  const { allSpots } = useSpots(location, 'all', new Set());
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'shrine' | 'temple'>('all');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const spotsWithDistance = useMemo(() => {
    if (!location) return allSpots.map(spot => ({ spot, distance: 0 }));
    return allSpots
      .map(spot => ({
        spot,
        distance: calculateDistance(location.latitude, location.longitude, spot.lat, spot.lng),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [allSpots, location]);

  const results = useMemo(() => {
    if (!debouncedQuery) return [];
    const lower = debouncedQuery.toLowerCase();
    return spotsWithDistance
      .filter(s => s.spot.name.toLowerCase().includes(lower))
      .filter(s => filterType === 'all' || s.spot.type === filterType);
  }, [debouncedQuery, spotsWithDistance, filterType]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setFilterType('all');
  }, []);

  // permissionStatus が GRANTED でない場合、location は DEFAULT_LOCATION の
  // フォールバック値なので、実際の現在地として扱わない（popular モードに落とす）
  const suggestionMode: SuggestionMode =
    permissionStatus === PermissionStatus.GRANTED ? 'nearby' : 'popular';

  const suggestedSpots = useMemo(() => {
    if (suggestionMode === 'nearby') {
      return spotsWithDistance.slice(0, MAX_SUGGESTED_SPOTS);
    }
    return [...allSpots]
      .sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id))
      .slice(0, MAX_SUGGESTED_SPOTS)
      .map(spot => ({ spot, distance: 0 }));
  }, [suggestionMode, spotsWithDistance, allSpots]);

  return {
    query,
    setQuery,
    results,
    filterType,
    setFilterType,
    clearSearch,
    suggestedSpots,
    suggestionMode,
  };
}
