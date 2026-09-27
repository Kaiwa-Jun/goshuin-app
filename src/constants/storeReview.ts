// App Store のレビュー（Issue #288 D-11）。アプリ ID を書くのはこのファイルだけ

/** 設定の「App Store でレビューを書く」で開く URL（D-9） */
export const APP_STORE_WRITE_REVIEW_URL =
  'https://apps.apple.com/app/id6797201465?action=write-review';

/** 依頼の履歴を端末に置くキー（D-4）。アカウントではなく端末のものなのでユーザー ID を含めない（D-5） */
export const STORE_REVIEW_HISTORY_KEY = 'store_review_history';

/** (count+1) 回目の依頼を出す通算の枚数。count が 3 になったら出さない（D-4） */
export const STORE_REVIEW_THRESHOLDS = [3, 10, 30] as const;

/** 2回目からは、前回からこの日数以上あける（D-4） */
export const STORE_REVIEW_MIN_INTERVAL_DAYS = 90;

/** メインのタブに戻ってから依頼を出すまで。完了画面が閉じる動きが終わって地図が見えてから（D-6） */
export const STORE_REVIEW_DELAY_MS = 1500;
