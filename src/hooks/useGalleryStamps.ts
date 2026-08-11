import { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@hooks/useAuth';
import { fetchAllStamps } from '@services/stamps';
import type { StampWithSpot } from '@/types/supabase';

export type SortOrder = 'date' | 'spot';

interface UseGalleryStampsReturn {
  stamps: StampWithSpot[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  removeStamp: (stampId: string) => void;
  updateStamp: (updated: StampWithSpot) => void;
}

export function useGalleryStamps(sortOrder: SortOrder): UseGalleryStampsReturn {
  const { user } = useAuth();
  const [allStamps, setAllStamps] = useState<StampWithSpot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setAllStamps([]);
        setIsLoading(false);
        return;
      }

      let cancelled = false;

      (async () => {
        try {
          setIsLoading(true);
          const data = await fetchAllStamps(user.id);
          if (!cancelled) {
            setAllStamps(data);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) {
            setAllStamps([]);
            setError(e instanceof Error ? e.message : '取得に失敗しました');
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [user])
  );

  const removeStamp = useCallback((stampId: string) => {
    setAllStamps(prev => prev.filter(s => s.id !== stampId));
  }, []);

  const updateStamp = useCallback((updated: StampWithSpot) => {
    setAllStamps(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  }, []);

  const stamps = useMemo(() => {
    const sorted = [...allStamps];
    if (sortOrder === 'spot') {
      sorted.sort((a, b) => a.spots.name.localeCompare(b.spots.name, 'ja'));
      return sorted;
    }
    // 御朱印帳は古い順に綴じていくもの。グリッドも左上が最も古く、右へ・下へ
    // 進むほど新しくなるようにする（めくり表示の 1ページ目 = 最も古い と揃う）。
    // API は visited_at DESC で返すので反転する
    return sorted.reverse();
  }, [allStamps, sortOrder]);

  return {
    stamps,
    totalCount: allStamps.length,
    isLoading,
    error,
    removeStamp,
    updateStamp,
  };
}
