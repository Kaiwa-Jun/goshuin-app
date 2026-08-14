import { useState, useEffect } from 'react';
import { useAuth } from '@hooks/useAuth';
import { fetchStampsBySpotId } from '@services/stamps';
import type { Stamp, PublicStampWithUser } from '@/types/supabase';

interface UseSpotStampsReturn {
  stamps: Stamp[];
  publicStamps: PublicStampWithUser[];
  visitCount: number;
  latestVisitDate: string | null;
  isLoading: boolean;
}

/**
 * ⚠️ Guideline 1.2（UGC）対応で、他ユーザーの公開御朱印の取得をやめている（Issue #147）。
 *
 * ここが表示側の唯一の絞り口。`publicStamps` は常に空配列を返すため、
 * `SpotDetailContent` / `SpotThumbnailStrip` / `SpotBottomSheet` は無変更のまま
 * 何も描画しなくなる。
 *
 * v1.1 で通報・ブロック・EULA を実装したら、下の PUBLIC_STAMPS を
 * fetchPublicStampsBySpotId の呼び出しに戻すだけで復帰できる。
 * services 側の関数とそのテストは残してある。
 */
const PUBLIC_STAMPS: PublicStampWithUser[] = [];

export function useSpotStamps(spotId: string): UseSpotStampsReturn {
  const { isAuthenticated } = useAuth();
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!spotId) {
      setStamps([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      // 自分のスタンプ取得（ログイン時のみ）
      if (isAuthenticated) {
        await fetchStampsBySpotId(spotId)
          .then(data => {
            if (!cancelled) setStamps(data);
          })
          .catch(() => {
            if (!cancelled) setStamps([]);
          });
      } else {
        setStamps([]);
      }

      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, spotId]);

  return {
    stamps,
    publicStamps: PUBLIC_STAMPS,
    visitCount: stamps.length,
    latestVisitDate: stamps[0]?.visited_at ?? null,
    isLoading,
  };
}
