import {
  distanceOf,
  evaluateNewBadges,
  getAllBadges,
  isEarned,
  nearestUnearned,
} from '@services/badges';
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

  // 同じ印が2つあると、並べたときにどちらか分からない
  it('印はバッジごとに違う', () => {
    const marks = getAllBadges().map(b => b.mark);
    expect(new Set(marks).size).toBe(marks.length);
  });

  it('どのバッジも必要な項目を持つ', () => {
    for (const badge of getAllBadges()) {
      expect(badge.id).toBeTruthy();
      expect(badge.name).toBeTruthy();
      expect(badge.description).toBeTruthy();
      expect(badge.mark).toBeTruthy();
      expect(['practice', 'journey', 'count']).toContain(badge.axis);
    }
  });
});

describe('distanceOf', () => {
  it('4種類の条件ぜんぶから、current と target を読める', () => {
    const p = progress({
      visitCount: 7,
      longestTsukimairi: 5,
      seasonCount: 3,
      maxSameDayVisits: 2,
    });

    expect(distanceOf({ type: 'visit_count', threshold: 10 }, p)).toEqual({
      current: 7,
      target: 10,
      unit: '箇所',
    });
    expect(distanceOf({ type: 'tsukimairi', threshold: 12 }, p)).toEqual({
      current: 5,
      target: 12,
      unit: 'ヶ月',
    });
    expect(distanceOf({ type: 'four_seasons' }, p)).toEqual({
      current: 3,
      target: 4,
      unit: 'つ',
    });
    expect(distanceOf({ type: 'same_day_visits', threshold: 3 }, p)).toEqual({
      current: 2,
      target: 3,
      unit: 'つ',
    });
  });
});

describe('nearestUnearned', () => {
  /*
   * 残りの数ではなく割合で見る。34箇所の人にとって
   * 「50箇所まであと16」は「100箇所まであと66」より近い
   */
  it('残り数ではなく、進んだ割合がいちばん大きいものを返す', () => {
    const near = nearestUnearned(
      progress({ visitCount: 34, longestTsukimairi: 12, seasonCount: 4, maxSameDayVisits: 3 })
    );
    expect(near?.id).toBe('visit-50');
  });

  it('割合で見るので、残りが少なくても遠いほうは選ばない', () => {
    // 四季はあと1つ(3/4=0.75)、50箇所はあと2箇所(48/50=0.96)
    const near = nearestUnearned(
      progress({ visitCount: 48, longestTsukimairi: 12, seasonCount: 3, maxSameDayVisits: 3 })
    );
    expect(near?.id).toBe('visit-50');
  });

  it('ぜんぶ取っていたら null', () => {
    expect(
      nearestUnearned(
        progress({
          visitCount: 100,
          longestTsukimairi: 12,
          seasonCount: 4,
          maxSameDayVisits: 3,
        })
      )
    ).toBeNull();
  });

  it('何もしていなければ、いちばん手前の1つ', () => {
    expect(nearestUnearned(progress())?.id).toBe('first-stamp');
  });
});
