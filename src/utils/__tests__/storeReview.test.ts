import {
  APP_STORE_WRITE_REVIEW_URL,
  STORE_REVIEW_DELAY_MS,
  STORE_REVIEW_HISTORY_KEY,
  STORE_REVIEW_MIN_INTERVAL_DAYS,
  STORE_REVIEW_THRESHOLDS,
} from '@/constants/storeReview';
import {
  decideStoreReview,
  parseStoreReviewHistory,
  type StoreReviewHistory,
} from '@utils/storeReview';

/*
 * Issue #288 AC-1〜6。レビュー依頼を出すかの判定（純粋な関数）。
 * 仕様: docs/issues/issue-288-review-request.md（D-3・D-4・D-11）
 */

const DAY_MS = 86400000;
const now = new Date('2026-10-05T12:00:00+09:00');
const before = (ms: number) => new Date(now.getTime() - ms).toISOString();
const EMPTY: StoreReviewHistory = { count: 0, lastRequestedAt: null };

describe('AC-1: 定数', () => {
  it('節目は 3・10・30 枚', () => {
    expect(STORE_REVIEW_THRESHOLDS).toEqual([3, 10, 30]);
  });

  it('前回から 90 日あける', () => {
    expect(STORE_REVIEW_MIN_INTERVAL_DAYS).toBe(90);
  });

  it('戻ってから 1500ms 待つ', () => {
    expect(STORE_REVIEW_DELAY_MS).toBe(1500);
  });

  it('履歴のキーは store_review_history', () => {
    expect(STORE_REVIEW_HISTORY_KEY).toBe('store_review_history');
  });

  it('レビューを書く URL', () => {
    expect(APP_STORE_WRITE_REVIEW_URL).toBe(
      'https://apps.apple.com/app/id6797201465?action=write-review'
    );
  });
});

describe('decideStoreReview', () => {
  describe('AC-2: 1回目（履歴なし）', () => {
    it.each([0, 1, 2])('%i 枚では出さない', total => {
      expect(decideStoreReview({ totalStampCount: total, history: EMPTY, now })).toBe(false);
    });

    it.each([3, 4, 50])('%i 枚で出す', total => {
      expect(decideStoreReview({ totalStampCount: total, history: EMPTY, now })).toBe(true);
    });
  });

  describe('AC-3: 2回目（count 1）', () => {
    const history = { count: 1, lastRequestedAt: before(90 * DAY_MS) };

    it('ちょうど90日前・9枚では出さない', () => {
      expect(decideStoreReview({ totalStampCount: 9, history, now })).toBe(false);
    });

    it('ちょうど90日前・10枚で出す（90日ちょうどは「たった」に含める）', () => {
      expect(decideStoreReview({ totalStampCount: 10, history, now })).toBe(true);
    });

    it('90日に1分足りなければ、100枚でも出さない', () => {
      const early = { count: 1, lastRequestedAt: before(90 * DAY_MS - 60000) };
      expect(decideStoreReview({ totalStampCount: 100, history: early, now })).toBe(false);
    });
  });

  describe('AC-4: 3回目（count 2）', () => {
    const history = { count: 2, lastRequestedAt: before(90 * DAY_MS) };

    it('ちょうど90日前・29枚では出さない', () => {
      expect(decideStoreReview({ totalStampCount: 29, history, now })).toBe(false);
    });

    it('ちょうど90日前・30枚で出す', () => {
      expect(decideStoreReview({ totalStampCount: 30, history, now })).toBe(true);
    });

    it('89日前なら、100枚でも出さない', () => {
      const early = { count: 2, lastRequestedAt: before(89 * DAY_MS) };
      expect(decideStoreReview({ totalStampCount: 100, history: early, now })).toBe(false);
    });
  });

  it('AC-5: count 3 なら、1000枚・400日前でも出さない', () => {
    const history = { count: 3, lastRequestedAt: before(400 * DAY_MS) };
    expect(decideStoreReview({ totalStampCount: 1000, history, now })).toBe(false);
  });
});

describe('AC-6: parseStoreReviewHistory', () => {
  it('null は履歴なし', () => {
    expect(parseStoreReviewHistory(null)).toEqual(EMPTY);
  });

  it('正しい値はそのまま読む', () => {
    expect(
      parseStoreReviewHistory('{"count":1,"lastRequestedAt":"2026-10-01T00:00:00.000Z"}')
    ).toEqual({ count: 1, lastRequestedAt: '2026-10-01T00:00:00.000Z' });
  });

  it.each([
    'abc',
    '{"count":"1","lastRequestedAt":"2026-10-01T00:00:00.000Z"}',
    '{"count":4,"lastRequestedAt":"2026-10-01T00:00:00.000Z"}',
    '{"count":-1,"lastRequestedAt":null}',
    '{"count":1.5,"lastRequestedAt":"2026-10-01T00:00:00.000Z"}',
    '{"count":1}',
    '{"count":1,"lastRequestedAt":"x"}',
  ])('壊れた値 %s は履歴なしとして扱う', raw => {
    expect(parseStoreReviewHistory(raw)).toEqual(EMPTY);
  });
});
