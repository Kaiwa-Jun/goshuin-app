import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@hooks/useAuth';
import { fetchWishlistSpots } from '@services/wishlist';
import type { WishlistWithSpot } from '@/types/supabase';

interface UseWishlistSpotsReturn {
  spots: WishlistWithSpot[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * CollectionScreen用。フォーカス時にwishlistスポット一覧をリフェッチする
 */
export function useWishlistSpots(): UseWishlistSpotsReturn {
  const { user } = useAuth();
  const [spots, setSpots] = useState<WishlistWithSpot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setSpots([]);
        setIsLoading(false);
        return;
      }

      let cancelled = false;

      (async () => {
        try {
          setIsLoading(true);
          const data = await fetchWishlistSpots(user.id);
          if (!cancelled) {
            setSpots(data);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) {
            setSpots([]);
            setError(e instanceof Error ? e.message : '取得に失敗しました');
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [user, refreshKey])
  );

  return { spots, isLoading, error, refetch };
}
