import type { Badge } from '@/types/badge';

export const BADGE_DEFINITIONS: Badge[] = [
  {
    id: 'first-stamp',
    name: '初めての御朱印',
    description: '初めての御朱印を記録しました',
    icon: '🎊',
    condition: { type: 'visit_count', threshold: 1 },
  },
  {
    id: 'visit-5',
    name: '5箇所達成',
    description: '5箇所の神社仏閣を訪れました',
    icon: '⛩️',
    condition: { type: 'visit_count', threshold: 5 },
  },
  {
    id: 'visit-10',
    name: '10箇所達成',
    description: '10箇所の神社仏閣を訪れました',
    icon: '🏆',
    condition: { type: 'visit_count', threshold: 10 },
  },
  {
    id: 'visit-30',
    name: '御朱印マスター',
    description: '30箇所の神社仏閣を訪れました',
    icon: '🌟',
    condition: { type: 'visit_count', threshold: 30 },
  },
  {
    id: 'visit-50',
    name: '巡礼者',
    description: '50箇所の神社仏閣を訪れました',
    icon: '🗾',
    condition: { type: 'visit_count', threshold: 50 },
  },
  {
    id: 'visit-100',
    name: '全国制覇',
    description: '100箇所の神社仏閣を訪れました',
    icon: '👑',
    condition: { type: 'visit_count', threshold: 100 },
  },
];

export function evaluateNewBadge(
  previousCount: number,
  currentCount: number
): { name: string; description: string } | null {
  const earned = BADGE_DEFINITIONS.filter(
    badge => previousCount < badge.condition.threshold && badge.condition.threshold <= currentCount
  );

  if (earned.length === 0) return null;

  // Return the highest threshold badge
  const highest = earned.reduce((a, b) => (a.condition.threshold > b.condition.threshold ? a : b));

  return { name: highest.name, description: highest.description };
}

export function getAllBadges(): Badge[] {
  return BADGE_DEFINITIONS;
}
