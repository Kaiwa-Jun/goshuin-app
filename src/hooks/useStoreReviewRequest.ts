import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { STORE_REVIEW_DELAY_MS } from '@/constants/storeReview';
import {
  readStoreReviewHistory,
  requestStoreReview,
  takeRecordCompleted,
  writeStoreReviewHistory,
} from '@services/storeReview';
import { decideStoreReview } from '@utils/storeReview';

/**
 * 記録を終えてメインのタブに戻った少し後に、App Store のレビュー依頼を出す（Issue #288 D-6）。
 *
 * `TabNavigator`（RootStack の MainTabs の画面そのもの）で呼ぶ。`useIsFocused` は MainTabs が
 * 一番上にあるか（完了画面・記録・年報・ログインなどが上にあれば false）。
 *
 * - フォーカスがあるときに、完了画面が置いた印を取り出す。印が無ければ何もしない（履歴も読まない）
 * - 印があれば STORE_REVIEW_DELAY_MS 待ち、履歴を読む → 判定 → 出すなら依頼 → 呼べたら履歴を書く
 * - 待っている間・読んでいる間に、フォーカスを失う・アプリが裏へ回る・フックが外れる、のどれかが
 *   起きたら取りやめる。印は戻さない（次の保存で判定し直す）
 * - 依頼を呼ぶのはこのタイマーの中だけ（ボタンを押した結果として呼ばない。D-8）
 */
export function useStoreReviewRequest(): void {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;
    const totalStampCount = takeRecordCompleted();
    if (totalStampCount === null) return;

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      clearTimeout(timer);
    };
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') cancel();
    });

    const timer = setTimeout(() => {
      (async () => {
        const history = await readStoreReviewHistory();
        if (cancelled) return;
        if (!decideStoreReview({ totalStampCount, history, now: new Date() })) return;
        if (!(await requestStoreReview())) return;
        // 呼べたら1回と数える（実際に表示したかはシステムが決めるので分からない）
        await writeStoreReviewHistory({
          count: history.count + 1,
          lastRequestedAt: new Date().toISOString(),
        });
      })()
        // 読めない・書けないときは出したことにしない。次の保存で判定し直す
        .catch(() => {});
    }, STORE_REVIEW_DELAY_MS);

    return () => {
      cancel();
      subscription.remove();
    };
  }, [isFocused]);
}
