import { useState, useMemo } from 'react';
import { useLocation } from '@hooks/useLocation';
import { useSpots } from '@hooks/useSpots';
import { calculateDistance } from '@utils/geo';
import type { Spot } from '@/types/supabase';

export interface SpotWithDistance {
  spot: Spot;
  distanceKm: number;
}

export interface UseNearbySpotsReturn {
  nearbySpots: SpotWithDistance[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredSpots: SpotWithDistance[];
}

export function useNearbySpots(): UseNearbySpotsReturn {
  const { location, isLoading: locationLoading, error: locationError } = useLocation();
  const { spots, isLoading: spotsLoading, error: spotsError } = useSpots(location, 'all');
  const [searchQuery, setSearchQuery] = useState('');

  const isLoading = locationLoading || spotsLoading;
  const error = locationError || spotsError;

  const nearbySpots = useMemo(() => {
    if (!location || spots.length === 0) return [];

    return spots
      .map(spot => ({
        spot,
        distanceKm: calculateDistance(location.latitude, location.longitude, spot.lat, spot.lng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [location, spots]);

  const filteredSpots = useMemo(() => {
    if (!searchQuery) return nearbySpots;
    return nearbySpots.filter(item => item.spot.name.includes(searchQuery));
  }, [nearbySpots, searchQuery]);

  return {
    nearbySpots,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    filteredSpots,
  };
}
