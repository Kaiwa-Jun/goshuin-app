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
      } catch {
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
