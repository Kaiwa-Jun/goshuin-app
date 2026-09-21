import type { Badge, BadgeCondition, BadgeDistance, BadgeProgress } from '@/types/badge';

export const BADGE_DEFINITIONS: Badge[] = [
  {
    id: 'first-stamp',
    name: '初めての御朱印',
    description: '初めての御朱印を記録しました',
    mark: 'ichi',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 1 },
  },
  {
    id: 'visit-5',
    name: '5箇所達成',
    description: '5箇所の神社仏閣を訪れました',
    mark: 'go',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 5 },
  },
  {
    id: 'visit-10',
    name: '10箇所達成',
    description: '10箇所の神社仏閣を訪れました',
    mark: 'juu',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 10 },
  },
  {
    id: 'visit-30',
    name: '30箇所達成',
    description: '30箇所の神社仏閣を訪れました',
    mark: 'sanjuu',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 30 },
  },
  {
    id: 'visit-50',
    name: '50箇所達成',
    description: '50箇所の神社仏閣を訪れました',
    mark: 'gojuu',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 50 },
  },
  {
    id: 'visit-100',
    name: '100箇所達成',
    description: '100箇所の神社仏閣を訪れました',
    mark: 'hyaku',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 100 },
  },
  {
    id: 'mangan',
    name: '満願',
    description: 'ひとつの寺社に12ヶ月、毎月おまいりしました',
    mark: 'mangan',
    axis: 'practice',
    condition: { type: 'tsukimairi', threshold: 12 },
  },
  {
    id: 'four-seasons',
    name: '四季を巡る',
    description: '春・夏・秋・冬、それぞれの季節に参拝しました',
    mark: 'shiki',
    axis: 'journey',
    condition: { type: 'four_seasons' },
  },
  {
    id: 'same-day-3',
    name: '1日に3箇所',
    description: '同じ日に3つの寺社を回りました',
    mark: 'mitsu',
    axis: 'journey',
    condition: { type: 'same_day_visits', threshold: 3 },
  },
];

/**
 * その条件を満たしているか。
 *
 * もとは `visit_count` のしきい値しか見ていなかった。満願と旅のしかたを
 * 入れるにあたって、条件の種類ごとに見るようにした。
 */
export function isEarned(condition: BadgeCondition, progress: BadgeProgress): boolean {
  switch (condition.type) {
    case 'visit_count':
      return progress.visitCount >= condition.threshold;
    case 'tsukimairi':
      return progress.longestTsukimairi >= condition.threshold;
    case 'four_seasons':
      return progress.seasonCount >= 4;
    case 'same_day_visits':
      return progress.maxSameDayVisits >= condition.threshold;
  }
}

/**
 * 今回の記録で新しく取れたバッジ。**複数返す**。
 *
 * 同じ日に「満願」「四季を巡る」「1日に3箇所」が一度に揃うことがある。
 * 以前は1つしか返していなかったので、取ったのに祝われないバッジが出ていた。
 */
export function evaluateNewBadges(before: BadgeProgress, after: BadgeProgress): Badge[] {
  return BADGE_DEFINITIONS.filter(
    badge => !isEarned(badge.condition, before) && isEarned(badge.condition, after)
  );
}

export function getAllBadges(): Badge[] {
  return BADGE_DEFINITIONS;
}

/**
 * その条件までの道のり。
 *
 * `isEarned` は取れたかどうかしか返さない。あゆみで「あと16箇所」を出すのに、
 * 同じ条件から current と target を読めるようにする
 */
export function distanceOf(condition: BadgeCondition, progress: BadgeProgress): BadgeDistance {
  switch (condition.type) {
    case 'visit_count':
      return { current: progress.visitCount, target: condition.threshold, unit: '箇所' };
    case 'tsukimairi':
      return { current: progress.longestTsukimairi, target: condition.threshold, unit: 'ヶ月' };
    case 'four_seasons':
      return { current: progress.seasonCount, target: 4, unit: 'つ' };
    case 'same_day_visits':
      return { current: progress.maxSameDayVisits, target: condition.threshold, unit: 'つ' };
  }
}

/**
 * 未獲得のうち、いちばん近い1つ。無ければ null。
 *
 * **進捗は1つにだけ出す。** 未獲得すべてに「あと98箇所」と並べると、
 * 集めた記録を見に来た画面が、やっていないことの催促になる。
 * 近さは「どれだけ進んだか」の割合で見る（100箇所の残り70と
 * 5箇所の残り3を、そのままの数では比べられない）
 */
export function nearestUnearned(progress: BadgeProgress): Badge | null {
  const yet = BADGE_DEFINITIONS.filter(badge => !isEarned(badge.condition, progress));
  if (yet.length === 0) return null;

  const ratio = (badge: Badge) => {
    const { current, target } = distanceOf(badge.condition, progress);
    return current / target;
  };
  // 同率なら定義順が先のものを残す（毎回おなじものが出るように）
  return yet.reduce((a, b) => (ratio(a) >= ratio(b) ? a : b));
}
