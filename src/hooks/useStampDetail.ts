import { useState, useEffect, useCallback } from 'react';
import {
  fetchStampById,
  updateStamp,
  deleteStamp,
  uploadStampImage,
  deleteStampImage,
} from '@services/stamps';
import type { StampWithSpot } from '@/types/supabase';

interface UseStampDetailReturn {
  stamp: StampWithSpot | null;
  isLoading: boolean;
  error: string | null;
  isUpdating: boolean;
  isDeleting: boolean;
  handleUpdate: (params: {
    visited_at?: string;
    memo?: string | null;
    newImageUri?: string;
  }) => Promise<StampWithSpot | null>;
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
    async (params: {
      visited_at?: string;
      memo?: string | null;
      newImageUri?: string;
    }): Promise<StampWithSpot | null> => {
      setIsUpdating(true);
      setError(null);
      try {
        const { newImageUri, ...updateParams } = params;
        let updated: StampWithSpot;

        if (newImageUri && stamp) {
          const oldImagePath = stamp.image_path;
          const newImagePath = await uploadStampImage(stamp.user_id, newImageUri);

          try {
            updated = await updateStamp(stampId, {
              ...updateParams,
              image_path: newImagePath,
            });
            setStamp(updated);
          } catch (dbError) {
            // DB更新失敗時は新画像を削除してクリーンアップ
            try {
              await deleteStampImage(newImagePath);
            } catch {
              // クリーンアップ失敗は無視
            }
            throw dbError;
          }

          // 旧画像の削除（失敗してもデータ整合性は保たれている）
          try {
            await deleteStampImage(oldImagePath);
          } catch {
            console.warn('Failed to delete old image:', oldImagePath);
          }
        } else {
          updated = await updateStamp(stampId, updateParams);
          setStamp(updated);
        }

        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [stampId, stamp]
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
