import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
  // いまの Set が誰の行きたいか（ゲストは null）。ゲスト → ログインに切り替わった描画から、
  // そのユーザーの最初の取得が終わるまで isLoading を立てる。地図で「行きたい」から
  // ログインした寺社を足すのは、これが下りてから（早く足すと、あとから届いた取得の
  // 結果で足した印が消える。Issue #327 D-7・D-9）
  const [settledUserId, setSettledUserId] = useState<string | null | undefined>(undefined);
  const currentUserId = isAuthenticated && user ? user.id : null;

  // 他の画面（行きたい一覧など）で増減しうるので、フォーカスのたびに取り直す。
  // マウント時の useEffect だけだと、削除して地図に戻ったときにピンの色と
  // 件数が古いまま残る
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated || !user) {
        setWishlistSpotIds(new Set());
        setIsLoading(false);
        setSettledUserId(null);
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
          if (!cancelled) {
            setIsLoading(false);
            setSettledUserId(user.id);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [isAuthenticated, user])
  );

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

  return {
    wishlistSpotIds,
    toggleWishlist,
    isLoading: isLoading || settledUserId !== currentUserId,
    isToggling,
  };
}
