import { buildBadgeProgress, seasonOf } from '@utils/badgeProgress';

const v = (date: string, spotId: string) => ({ visited_at: date, spot_id: spotId });

describe('seasonOf', () => {
  // 月で切る。春3〜5 / 夏6〜8 / 秋9〜11 / 冬12〜2
  it.each([
    ['2026-03-01', 'spring'],
    ['2026-05-31', 'spring'],
    ['2026-06-01', 'summer'],
    ['2026-09-01', 'autumn'],
    ['2026-12-01', 'winter'],
    ['2026-01-15', 'winter'],
    ['2026-02-28', 'winter'],
  ])('%s は %s', (date, expected) => {
    expect(seasonOf(date)).toBe(expected);
  });
});

describe('buildBadgeProgress', () => {
  it('訪れた寺社の数は、重複を除いて数える', () => {
    const p = buildBadgeProgress(
      [v('2026-09-01', 'a'), v('2026-09-02', 'a'), v('2026-09-03', 'b')],
      '2026-09-20'
    );

    expect(p.visitCount).toBe(2);
  });

  it('月参りの最長は、寺社ごとに見ていちばん長いもの', () => {
    const p = buildBadgeProgress(
      [
        // a は3ヶ月連続
        v('2026-01-10', 'a'),
        v('2026-02-10', 'a'),
        v('2026-03-10', 'a'),
        // b は飛んでいる
        v('2026-01-10', 'b'),
        v('2026-03-10', 'b'),
      ],
      '2026-03-20'
    );

    expect(p.longestTsukimairi).toBe(3);
  });

  it('四季は、そろった数を返す', () => {
    const p = buildBadgeProgress(
      [v('2026-04-01', 'a'), v('2026-07-01', 'b'), v('2026-10-01', 'c')],
      '2026-10-20'
    );

    expect(p.seasonCount).toBe(3);
  });

  /*
   * 同じ日に「異なる寺社」を数える。同じ寺社で3枚もらっても1箇所
   */
  it('同じ日に回った寺社の数は、寺社で重複を除く', () => {
    const p = buildBadgeProgress(
      [
        v('2026-09-20', 'a'),
        v('2026-09-20', 'a'),
        v('2026-09-20', 'b'),
        v('2026-08-01', 'c'),
        v('2026-08-01', 'd'),
        v('2026-08-01', 'e'),
      ],
      '2026-09-25'
    );

    expect(p.maxSameDayVisits).toBe(3);
  });

  it('1枚も無ければ、すべて0', () => {
    expect(buildBadgeProgress([], '2026-09-20')).toEqual({
      visitCount: 0,
      longestTsukimairi: 0,
      seasonCount: 0,
      maxSameDayVisits: 0,
    });
  });
});
