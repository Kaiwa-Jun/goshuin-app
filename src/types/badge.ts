export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: BadgeCondition;
}

export interface BadgeCondition {
  type: 'visit_count';
  threshold: number;
}

export interface EarnedBadge {
  badge: Badge;
  earnedAt: string;
}
