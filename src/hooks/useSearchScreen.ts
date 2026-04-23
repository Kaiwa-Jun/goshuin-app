import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSpots } from '@hooks/useSpots';
import { useLocation } from '@hooks/useLocation';
import { calculateDistance } from '@utils/geo';
import type { Spot } from '@/types/supabase';

interface SpotWithDistance {
  spot: Spot;
  distance: number;
}

export interface UseSearchScreenReturn {
  query: string;
  setQuery: (text: string) => void;
  results: SpotWithDistance[];
  filterType: 'all' | 'shrine' | 'temple';
  setFilterType: (type: 'all' | 'shrine' | 'temple') => void;
  clearSearch: () => void;
}

const DEBOUNCE_MS = 300;

export function useSearchScreen(): UseSearchScreenReturn {
  const { location } = useLocation();
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

  return {
    query,
    setQuery,
    results,
    filterType,
    setFilterType,
    clearSearch,
  };
}
