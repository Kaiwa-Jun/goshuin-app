import { jstYearMonth, toJstDateString } from '@utils/jstDate';
import { toJstDateString as fromSection } from '@components/spot-detail/LimitedGoshuinSection';

/*
 * Issue #274 AC-1。入力は瞬間（…Z）で固定する。
 * Jest は TZ=Asia/Tokyo で走るので、端末の時刻の getter を使った誤りはここでは見つからない
 */
describe('toJstDateString', () => {
  it('UTC の 15:30 は、日本時間では翌日', () => {
    expect(toJstDateString(new Date('2026-09-26T15:30:00Z'))).toBe('2026-09-27');
  });

  it('限定御朱印の欄から import しても同じ関数', () => {
    expect(fromSection).toBe(toJstDateString);
  });
});

describe('jstYearMonth', () => {
  it.each([
    ['2026-11-30T14:59:59Z', { year: 2026, month: 11 }],
    ['2026-11-30T15:00:00Z', { year: 2026, month: 12 }],
    ['2026-12-31T14:59:59Z', { year: 2026, month: 12 }],
    ['2026-12-31T15:00:00Z', { year: 2027, month: 1 }],
  ])('%s は日本時間で %o', (iso, expected) => {
    expect(jstYearMonth(new Date(iso))).toEqual(expected);
  });
});
