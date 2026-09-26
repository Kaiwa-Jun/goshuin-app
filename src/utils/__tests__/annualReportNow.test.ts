import { annualReportNow, resolveReportNow, setDevAsDecember } from '@utils/annualReportNow';
import { jstYearMonth } from '@utils/jstDate';

/*
 * Issue #274 AC-19。setDevAsDecember はモジュールの中の値なので、
 * 触ったら必ず戻す（戻さないと後のテストが12月のまま走る）
 */
afterEach(() => {
  setDevAsDecember(false);
  jest.useRealTimers();
});

describe('resolveReportNow', () => {
  const real = new Date('2026-09-27T03:00:00Z');

  it('開発用で12月にしているなら、その年の12月1日 12:00（日本時間）', () => {
    expect(resolveReportNow(real, true, true).getTime()).toBe(
      new Date('2026-12-01T03:00:00Z').getTime()
    );
  });

  it('本番の束（__DEV__ が false）や、12月にしていないなら渡した瞬間のまま', () => {
    expect(resolveReportNow(real, false, true)).toBe(real);
    expect(resolveReportNow(real, true, false)).toBe(real);
  });

  it('日本時間で年が明けていれば、その年の12月', () => {
    expect(resolveReportNow(new Date('2026-12-31T16:00:00Z'), true, true).getTime()).toBe(
      new Date('2027-12-01T03:00:00Z').getTime()
    );
  });
});

describe('annualReportNow', () => {
  it('setDevAsDecember(true) のあとは12月、false で元に戻る', () => {
    jest.useFakeTimers({ now: new Date('2026-09-27T10:00:00+09:00') });

    setDevAsDecember(true);
    expect(jstYearMonth(annualReportNow()).month).toBe(12);

    setDevAsDecember(false);
    expect(jstYearMonth(annualReportNow()).month).toBe(9);
  });
});
