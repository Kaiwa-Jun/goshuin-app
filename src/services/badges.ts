import type { Badge, BadgeCondition, BadgeProgress } from '@/types/badge';

export const BADGE_DEFINITIONS: Badge[] = [
  {
    id: 'first-stamp',
    name: '初めての御朱印',
    description: '初めての御朱印を記録しました',
    icon: '🎊',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 1 },
  },
  {
    id: 'visit-5',
    name: '5箇所達成',
    description: '5箇所の神社仏閣を訪れました',
    icon: '⛩️',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 5 },
  },
  {
    id: 'visit-10',
    name: '10箇所達成',
    description: '10箇所の神社仏閣を訪れました',
    icon: '🏆',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 10 },
  },
  {
    id: 'visit-30',
    name: '30箇所達成',
    description: '30箇所の神社仏閣を訪れました',
    icon: '🌟',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 30 },
  },
  {
    id: 'visit-50',
    name: '50箇所達成',
    description: '50箇所の神社仏閣を訪れました',
    icon: '🗾',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 50 },
  },
  {
    id: 'visit-100',
    name: '100箇所達成',
    description: '100箇所の神社仏閣を訪れました',
    icon: '👑',
    axis: 'count',
    condition: { type: 'visit_count', threshold: 100 },
  },
  {
    id: 'mangan',
    name: '満願',
    description: 'ひとつの寺社に12ヶ月、毎月おまいりしました',
    icon: '⛩',
    axis: 'practice',
    condition: { type: 'tsukimairi', threshold: 12 },
  },
  {
    id: 'four-seasons',
    name: '四季を巡る',
    description: '春・夏・秋・冬、それぞれの季節に参拝しました',
    icon: '🌸',
    axis: 'journey',
    condition: { type: 'four_seasons' },
  },
  {
    id: 'same-day-3',
    name: '1日に3箇所',
    description: '同じ日に3つの寺社を回りました',
    icon: '👣',
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
