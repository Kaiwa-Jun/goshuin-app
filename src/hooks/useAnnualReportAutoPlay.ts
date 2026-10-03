import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import { useAuth } from '@hooks/useAuth';
import { countStampsInYear, markAutoPlayShown, readAutoPlayShown } from '@services/annualReport';
import { DEV_AS_DECEMBER_KEY, decideAutoPlay } from '@utils/annualReport';
import { annualReportNow, setDevAsDecember } from '@utils/annualReportNow';
import { jstYearMonth } from '@utils/jstDate';

/**
 * 12月（日本時間）にメインのタブが出たとき、1回だけ年報を自動で再生する（Issue #274 D-17）。
 *
 * `TabNavigator`（RootStack の MainTabs の画面そのもの）で呼ぶ。`useIsFocused` は
 * MainTabs が一番上にあるか（記録・ログイン・年報などが上にあれば false）。
 *
 * - スプラッシュが消えるまで（ready）・ログインの確認が終わるまでは判定しない
 * - 判定の順は decideAutoPlay と同じ。前で決まれば後ろの I/O をしない
 * - 出すときは、印を書いてから開く（✕ で途中で閉じても出したことになる）
 * - 判定の途中でフォーカスを失ったら、次にフォーカスが戻ったときに問い合わせ直さずに出す
 * - 出さないと決まっても、次にフォーカスを得たとき（ログインして戻った・記録を終えて戻った）に
 *   もう一度判定する。この起動の中で一度出したら、それ以降は判定しない
 * - バックグラウンドからの復帰（AppState）は見ない
 */
export function useAnnualReportAutoPlay({ ready }: { ready: boolean }): void {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const { user, isLoading } = useAuth();
  const userId = user?.id ?? null;

  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  /** この起動の中で出した */
  const playedRef = useRef(false);
  /** 判定の途中 */
  const decidingRef = useRef(false);
  /** 出すと決まったが、その時点でフォーカスが無かった */
  const pendingRef = useRef<{ year: number; userId: string } | null>(null);
  /** 開発用のキーは、この起動の最初の判定のときだけ読む */
  const devCheckedRef = useRef(false);

  useEffect(() => {
    if (!ready || !isFocused || isLoading) return;
    if (playedRef.current || decidingRef.current) return;

    const play = async (year: number, uid: string) => {
      await markAutoPlayShown(year, uid);
      playedRef.current = true;
      navigationRef.current.navigate('AnnualReport', { year });
    };

    const pending = pendingRef.current;
    pendingRef.current = null;

    decidingRef.current = true;
    (async () => {
      // 前の判定で出すと決まっていれば、問い合わせ直さずに出す（同じ人のときだけ）
      if (pending && pending.userId === userId) {
        await play(pending.year, pending.userId);
        return;
      }

      if (__DEV__ && !devCheckedRef.current) {
        devCheckedRef.current = true;
        if ((await AsyncStorage.getItem(DEV_AS_DECEMBER_KEY)) === '1') {
          await AsyncStorage.removeItem(DEV_AS_DECEMBER_KEY);
          setDevAsDecember(true);
        }
      }

      const now = jstYearMonth(annualReportNow());
      // まだ読んでいない値は「出す」側に置いて、前の条件だけで決まるかを見る
      const guessed = { now, userId, shown: false, stampsInYear: 1 };
      if (!decideAutoPlay(guessed).play || userId === null) return;

      const shown = await readAutoPlayShown(now.year, userId);
      if (!decideAutoPlay({ ...guessed, shown }).play) return;

      const stampsInYear = await countStampsInYear(userId, now.year).catch(() => null);
      const decision = decideAutoPlay({ ...guessed, shown, stampsInYear });
      if (!decision.play) return;

      if (focusedRef.current) await play(decision.year, userId);
      else pendingRef.current = { year: decision.year, userId };
    })()
      // 読めなかったときは出さない。次にフォーカスを得たときにもう一度判定する
      .catch(() => {})
      .finally(() => {
        decidingRef.current = false;
      });
  }, [ready, isFocused, isLoading, userId]);
}
