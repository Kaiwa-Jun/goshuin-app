import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Spot } from '@/types/supabase';
import { calculateDistance } from '@utils/geo';

interface SpotWithDistance {
  spot: Spot;
  distance: number;
}

interface UseMapSearchReturn {
  query: string;
  setQuery: (text: string) => void;
  suggestions: SpotWithDistance[];
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  nearbySpots: SpotWithDistance[];
  clearSearch: () => void;
}

const DEBOUNCE_MS = 300;
const MAX_NEARBY = 3;

export function useMapSearch(
  allSpots: Spot[],
  userLocation: { latitude: number; longitude: number } | null
): UseMapSearchReturn {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
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
    if (!userLocation) return allSpots.map(spot => ({ spot, distance: 0 }));
    return allSpots
      .map(spot => ({
        spot,
        distance: calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          spot.lat,
          spot.lng
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [allSpots, userLocation]);

  const nearbySpots = useMemo(() => spotsWithDistance.slice(0, MAX_NEARBY), [spotsWithDistance]);

  const suggestions = useMemo(() => {
    if (!debouncedQuery) return [];
    const lower = debouncedQuery.toLowerCase();
    return spotsWithDistance.filter(s => s.spot.name.toLowerCase().includes(lower));
  }, [debouncedQuery, spotsWithDistance]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setShowSuggestions(false);
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    nearbySpots,
    clearSearch,
  };
}
