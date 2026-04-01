import { useState, useEffect } from 'react';
import { useAuth } from '@hooks/useAuth';
import { fetchStampsBySpotId, fetchPublicStampsBySpotId } from '@services/stamps';
import type { Stamp, PublicStampWithUser } from '@/types/supabase';

interface UseSpotStampsReturn {
  stamps: Stamp[];
  publicStamps: PublicStampWithUser[];
  visitCount: number;
  latestVisitDate: string | null;
  isLoading: boolean;
}

export function useSpotStamps(spotId: string): UseSpotStampsReturn {
  const { isAuthenticated } = useAuth();
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [publicStamps, setPublicStamps] = useState<PublicStampWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!spotId) {
      setStamps([]);
      setPublicStamps([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const promises: Promise<void>[] = [];

      // 自分のスタンプ取得（ログイン時のみ）
      if (isAuthenticated) {
        promises.push(
          fetchStampsBySpotId(spotId)
            .then(data => {
              if (!cancelled) setStamps(data);
            })
            .catch(() => {
              if (!cancelled) setStamps([]);
            })
        );
      } else {
        setStamps([]);
      }

      // 公開スタンプ取得（ログイン状態に関わらず）
      promises.push(
        fetchPublicStampsBySpotId(spotId)
          .then(data => {
            if (!cancelled) setPublicStamps(data);
          })
          .catch(() => {
            if (!cancelled) setPublicStamps([]);
          })
      );

      await Promise.all(promises);
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, spotId]);

  return {
    stamps,
    publicStamps,
    visitCount: stamps.length,
    latestVisitDate: stamps[0]?.visited_at ?? null,
    isLoading,
  };
}
