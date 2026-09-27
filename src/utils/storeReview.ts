import { STORE_REVIEW_MIN_INTERVAL_DAYS, STORE_REVIEW_THRESHOLDS } from '@/constants/storeReview';

/**
 * App Store のレビュー依頼を出すかの判定（Issue #288 D-4）。
 *
 * 仕様: docs/issues/issue-288-review-request.md。ネイティブ・端末の読み書きは
 * `src/services/storeReview.ts`、画面との橋渡しは `src/hooks/useStoreReviewRequest.ts`
 */

export interface StoreReviewHistory {
  /** これまでにシステムのレビュー依頼を呼べた回数（0〜3） */
  count: number;
  /** 最後に呼べた時刻（ISO 8601）。count が 0 なら null */
  lastRequestedAt: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const empty = (): StoreReviewHistory => ({ count: 0, lastRequestedAt: null });

/**
 * 端末に置いた履歴を読む。無い・壊れている（JSON でない・count が 0〜3 の整数でない・
 * count が1以上で lastRequestedAt が日時として読めない）ときは履歴なしとして扱う
 */
export function parseStoreReviewHistory(raw: string | null): StoreReviewHistory {
  if (raw === null) return empty();

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return empty();
  }
  if (typeof value !== 'object' || value === null) return empty();

  const { count, lastRequestedAt } = value as Record<string, unknown>;
  if (typeof count !== 'number' || !Number.isInteger(count)) return empty();
  if (count <= 0 || count > STORE_REVIEW_THRESHOLDS.length) return empty();
  if (typeof lastRequestedAt !== 'string' || Number.isNaN(Date.parse(lastRequestedAt))) {
    return empty();
  }
  return { count, lastRequestedAt };
}

/**
 * (count+1) 回目の依頼を出すか。通算の枚数が節目以上で、2回目からは前回から
 * 90日以上たっていれば出す（90日ちょうどは「たった」に含める）。count が 3 なら出さない
 */
export function decideStoreReview({
  totalStampCount,
  history,
  now,
}: {
  totalStampCount: number;
  history: StoreReviewHistory;
  now: Date;
}): boolean {
  const threshold: number | undefined = STORE_REVIEW_THRESHOLDS[history.count];
  if (threshold === undefined || totalStampCount < threshold) return false;
  if (history.count === 0) return true;

  if (history.lastRequestedAt === null) return false;
  const elapsed = now.getTime() - Date.parse(history.lastRequestedAt);
  return elapsed >= STORE_REVIEW_MIN_INTERVAL_DAYS * DAY_MS;
}
