import { useState, useEffect } from 'react';
import { useAuth } from '@hooks/useAuth';
import { fetchStampsBySpotId } from '@services/stamps';
import type { Stamp } from '@/types/supabase';

interface UseSpotStampsReturn {
  stamps: Stamp[];
  visitCount: number;
  latestVisitDate: string | null;
  isLoading: boolean;
}

export function useSpotStamps(spotId: string): UseSpotStampsReturn {
  const { isAuthenticated } = useAuth();
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setStamps([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await fetchStampsBySpotId(spotId);
        if (!cancelled) setStamps(data);
      } catch {
        if (!cancelled) setStamps([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, spotId]);

  return {
    stamps,
    visitCount: stamps.length,
    latestVisitDate: stamps[0]?.visited_at ?? null,
    isLoading,
  };
}
