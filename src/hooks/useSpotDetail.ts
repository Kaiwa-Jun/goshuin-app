import { useState, useEffect } from 'react';
import { fetchSpotById } from '@services/spots';
import type { Spot } from '@/types/supabase';

interface UseSpotDetailReturn {
  spot: Spot | null;
  isLoading: boolean;
  error: string | null;
}

export function useSpotDetail(spotId: string): UseSpotDetailReturn {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchSpotById(spotId);
        if (!cancelled) {
          if (data) {
            setSpot(data);
          } else {
            setError('スポットが見つかりません');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spotId]);

  return { spot, isLoading, error };
}
