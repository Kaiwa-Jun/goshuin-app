import type { Spot } from '@/types/supabase';

/** 予定の寺社（Issue #258）。position は回る順（0 始まり） */
export interface VisitPlanStop {
  spotId: string;
  position: number;
  spot: Pick<Spot, 'id' | 'name' | 'type' | 'lat' | 'lng'>;
}

/** ある日の予定。stops は position 昇順で、見えなくなった寺社（merged など）は除いてある（D-4） */
export interface VisitPlan {
  id: string;
  /** YYYY-MM-DD */
  plannedOn: string;
  name: string;
  stops: VisitPlanStop[];
}
