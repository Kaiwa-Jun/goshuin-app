import { toLocalDateString } from '../localDate';

/**
 * 訪問日のずれは「端末のタイムゾーンが UTC より進んでいる」ときに出る（Issue #204）。
 * CI が UTC のままだと再現しないため、JST の固定は jest.config.js でしている。
 */
describe('toLocalDateString', () => {
  it('深夜に登録しても、端末に見えている日付をそのまま返す', () => {
    const date = new Date(2026, 8, 20, 0, 30);
    // toISOString() を通すと前日になる。ここがずれの原因だった
    expect(date.toISOString().slice(0, 10)).toBe('2026-09-19');
    expect(toLocalDateString(date)).toBe('2026-09-20');
  });

  it('UTC 側の日付が変わる直前（08:59）でも前日にならない', () => {
    expect(toLocalDateString(new Date(2026, 8, 20, 8, 59))).toBe('2026-09-20');
  });

  it('夜（UTC でも同じ日）はそのまま返す', () => {
    expect(toLocalDateString(new Date(2026, 8, 20, 23, 30))).toBe('2026-09-20');
  });

  it('元日の深夜でも年が前年に戻らない', () => {
    expect(toLocalDateString(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('1桁の月日を0で埋める', () => {
    expect(toLocalDateString(new Date(2026, 1, 3, 12, 0))).toBe('2026-02-03');
  });
});
