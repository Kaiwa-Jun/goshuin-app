import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@hooks/useAuth';
import { fetchVisitedSpotIds } from '@services/stamps';

interface UseUserStampsReturn {
  visitedSpotIds: Set<string>;
  /** 一度も取れていない間だけ true。画面に戻ったときの取り直しでは true に戻さない */
  isLoading: boolean;
}

export function useUserStamps(): UseUserStampsReturn {
  const { isAuthenticated } = useAuth();
  const [visitedSpotIds, setVisitedSpotIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  // ログインしてから一度でも取れたか。取れる前（起動直後・ログインした直後）の取得は
  // 「最初の取得」として isLoading を立てる。ログインで過去の訪問がまとめて
  // 行った に変わるのを、シートの「記録した瞬間」と取り違えないため（Issue #293 D-11）
  const loadedRef = useRef(false);

  // 記録して地図に戻ったとき、ピンの色と訪問済みの札を新しくする。地図の画面は
  // 記録の画面の下で外れずに残るので、マウント時だけ取るとアプリを起動し直すまで
  // 古いまま（Issue #293 D-11。useWishlist と同じ形）
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        loadedRef.current = false;
        setVisitedSpotIds(new Set());
        setIsLoading(false);
        return;
      }

      let cancelled = false;
      const isFirst = !loadedRef.current;
      if (isFirst) setIsLoading(true);

      (async () => {
        try {
          const ids = await fetchVisitedSpotIds();
          if (!cancelled) {
            loadedRef.current = true;
            setVisitedSpotIds(ids);
          }
        } catch (error) {
          // 地図の訪問済みピンは未訪問色に倒れるだけで誤情報にはならないため、
          // 最初の取得の失敗は空 Set へのフォールバックを維持する。ログだけは残す
          // （監査 B-3 / Issue #133 D-4）。
          // 取り直しの失敗では今の Set を残す。空にすると、次に戻ったとき
          // 行っていない → 行った に見えて「記録した瞬間」が勝手に出る（Issue #293 D-11）
          console.warn('[useUserStamps] fetchVisitedSpotIds failed:', error);
          if (!cancelled && isFirst) setVisitedSpotIds(new Set());
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [isAuthenticated])
  );

  return { visitedSpotIds, isLoading };
}
