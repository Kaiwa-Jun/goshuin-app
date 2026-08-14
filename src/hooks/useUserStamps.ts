import { useState, useEffect } from 'react';
import { useAuth } from '@hooks/useAuth';
import { fetchVisitedSpotIds } from '@services/stamps';

interface UseUserStampsReturn {
  visitedSpotIds: Set<string>;
  isLoading: boolean;
}

export function useUserStamps(): UseUserStampsReturn {
  const { isAuthenticated } = useAuth();
  const [visitedSpotIds, setVisitedSpotIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setVisitedSpotIds(new Set());
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const ids = await fetchVisitedSpotIds();
        if (!cancelled) setVisitedSpotIds(ids);
      } catch (error) {
        // 地図の訪問済みピンは未訪問色に倒れるだけで誤情報にはならないため、
        // 空 Set へのフォールバックは維持する。ログだけは残す（監査 B-3 / Issue #133 D-4）
        console.warn('[useUserStamps] fetchVisitedSpotIds failed:', error);
        if (!cancelled) setVisitedSpotIds(new Set());
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return { visitedSpotIds, isLoading };
}
