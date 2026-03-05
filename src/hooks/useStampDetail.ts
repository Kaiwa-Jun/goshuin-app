import { useState, useEffect, useCallback } from 'react';
import { fetchStampById, updateStamp, deleteStamp } from '@services/stamps';
import type { StampWithSpot } from '@/types/supabase';

interface UseStampDetailReturn {
  stamp: StampWithSpot | null;
  isLoading: boolean;
  error: string | null;
  isUpdating: boolean;
  isDeleting: boolean;
  handleUpdate: (params: { visited_at?: string; memo?: string | null }) => Promise<boolean>;
  handleDelete: () => Promise<boolean>;
  refresh: () => void;
}

export function useStampDetail(stampId: string): UseStampDetailReturn {
  const [stamp, setStamp] = useState<StampWithSpot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchStampById(stampId);
        if (!cancelled) {
          setStamp(data);
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
  }, [stampId, refreshTrigger]);

  const handleUpdate = useCallback(
    async (params: { visited_at?: string; memo?: string | null }): Promise<boolean> => {
      setIsUpdating(true);
      setError(null);
      try {
        const updated = await updateStamp(stampId, params);
        setStamp(updated);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [stampId]
  );

  const handleDelete = useCallback(async (): Promise<boolean> => {
    if (!stamp) return false;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteStamp(stampId, stamp.image_path);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [stampId, stamp]);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return { stamp, isLoading, error, isUpdating, isDeleting, handleUpdate, handleDelete, refresh };
}
