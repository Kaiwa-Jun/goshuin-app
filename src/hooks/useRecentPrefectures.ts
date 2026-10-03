import { useEffect, useState } from 'react';

import { fetchRecentPrefectures } from '@services/collection';

/**
 * 寺社を調べる前に聞く地域の選択肢（Issue #277）。記録画面を開いたときに1回だけ取り、
 * 画面を閉じるまで持つ（「変える」のときも取り直さない）。
 * 未ログイン・取得中・取れなかったときは []（例外は外に出さない）
 */
export function useRecentPrefectures(userId: string | null): string[] {
  const [prefectures, setPrefectures] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchRecentPrefectures(userId)
      .then(found => {
        // 空なら描き直さない（記録画面のテストに act の警告を増やさない）
        if (!cancelled && found.length > 0) setPrefectures(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return prefectures;
}
