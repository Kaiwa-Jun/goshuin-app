import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@hooks/useAuth';
import { fetchWishlistSpotIds, addToWishlist, removeFromWishlist } from '@services/wishlist';

interface UseWishlistReturn {
  wishlistSpotIds: Set<string>;
  toggleWishlist: (spotId: string) => Promise<void>;
  isLoading: boolean;
  isToggling: boolean;
}

export function useWishlist(): UseWishlistReturn {
  const { user, isAuthenticated } = useAuth();
  const [wishlistSpotIds, setWishlistSpotIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setWishlistSpotIds(new Set());
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const ids = await fetchWishlistSpotIds(user.id);
        if (!cancelled) setWishlistSpotIds(ids);
      } catch {
        if (!cancelled) setWishlistSpotIds(new Set());
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  const toggleWishlist = useCallback(
    async (spotId: string) => {
      // 未ログイン時は何もしない（UI側でログインモーダルを制御）
      if (!user) return;

      const isWishlisted = wishlistSpotIds.has(spotId);

      // 楽観的更新：UIを即座に反映
      const updatedIds = new Set(wishlistSpotIds);
      if (isWishlisted) {
        updatedIds.delete(spotId);
      } else {
        updatedIds.add(spotId);
      }
      setWishlistSpotIds(updatedIds);
      setIsToggling(true);

      try {
        if (isWishlisted) {
          await removeFromWishlist(user.id, spotId);
        } else {
          await addToWishlist(user.id, spotId);
        }
      } catch {
        // API失敗時はロールバック
        setWishlistSpotIds(wishlistSpotIds);
      } finally {
        setIsToggling(false);
      }
    },
    [user, wishlistSpotIds]
  );

  return { wishlistSpotIds, toggleWishlist, isLoading, isToggling };
}
