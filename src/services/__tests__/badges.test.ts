import { evaluateNewBadges, getAllBadges, isEarned } from '@services/badges';
import type { BadgeProgress } from '@/types/badge';

const progress = (p: Partial<BadgeProgress> = {}): BadgeProgress => ({
  visitCount: 0,
  longestTsukimairi: 0,
  seasonCount: 0,
  maxSameDayVisits: 0,
  ...p,
});

describe('isEarned', () => {
  it('訪問数はしきい値以上で取れる', () => {
    expect(isEarned({ type: 'visit_count', threshold: 5 }, progress({ visitCount: 4 }))).toBe(
      false
    );
    expect(isEarned({ type: 'visit_count', threshold: 5 }, progress({ visitCount: 5 }))).toBe(true);
  });

  it('満願は、どれか1つの寺社で12ヶ月', () => {
    const condition = { type: 'tsukimairi', threshold: 12 } as const;

    expect(isEarned(condition, progress({ longestTsukimairi: 11 }))).toBe(false);
    expect(isEarned(condition, progress({ longestTsukimairi: 12 }))).toBe(true);
  });

  it('四季は4つそろって取れる', () => {
    expect(isEarned({ type: 'four_seasons' }, progress({ seasonCount: 3 }))).toBe(false);
    expect(isEarned({ type: 'four_seasons' }, progress({ seasonCount: 4 }))).toBe(true);
  });

  it('1日に3箇所は、同じ日に回った寺社の最大数で見る', () => {
    const condition = { type: 'same_day_visits', threshold: 3 } as const;

    expect(isEarned(condition, progress({ maxSameDayVisits: 2 }))).toBe(false);
    expect(isEarned(condition, progress({ maxSameDayVisits: 3 }))).toBe(true);
  });
});

describe('evaluateNewBadges', () => {
  /*
   * 以前は1つしか返していなかったので、同じ日に複数そろうと
   * 取ったのに祝われないバッジが出ていた
   */
  it('同じ記録で複数そろったら、全部返す', () => {
    const before = progress({ visitCount: 4, seasonCount: 3, maxSameDayVisits: 2 });
    const after = progress({ visitCount: 5, seasonCount: 4, maxSameDayVisits: 3 });

    expect(
      evaluateNewBadges(before, after)
        .map(b => b.id)
        .sort()
    ).toEqual(['four-seasons', 'same-day-3', 'visit-5'].sort());
  });

  it('しきい値を飛び越えたら、間のバッジも全部返す', () => {
    expect(evaluateNewBadges(progress(), progress({ visitCount: 10 })).map(b => b.id)).toEqual([
      'first-stamp',
      'visit-5',
      'visit-10',
    ]);
  });

  // 再訪では何も増えない
  it('すでに取っているバッジは返さない', () => {
    expect(evaluateNewBadges(progress({ visitCount: 5 }), progress({ visitCount: 5 }))).toEqual([]);
    expect(evaluateNewBadges(progress({ visitCount: 10 }), progress({ visitCount: 11 }))).toEqual(
      []
    );
  });
});

describe('getAllBadges', () => {
  it('訪問数6個に、作法1個と旅のしかた2個が加わっている', () => {
    const badges = getAllBadges();

    expect(badges).toHaveLength(9);
    expect(badges.filter(b => b.axis === 'count')).toHaveLength(6);
    expect(badges.filter(b => b.axis === 'practice').map(b => b.id)).toEqual(['mangan']);
    expect(badges.filter(b => b.axis === 'journey').map(b => b.id)).toEqual([
      'four-seasons',
      'same-day-3',
    ]);
  });

  it('どのバッジも必要な項目を持つ', () => {
    for (const badge of getAllBadges()) {
      expect(badge.id).toBeTruthy();
      expect(badge.name).toBeTruthy();
      expect(badge.description).toBeTruthy();
      expect(badge.icon).toBeTruthy();
      expect(['practice', 'journey', 'count']).toContain(badge.axis);
    }
  });
});
