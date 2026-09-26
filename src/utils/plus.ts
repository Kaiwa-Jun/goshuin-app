import { FREE_PLAN_LIMIT } from '@/constants/plus';

/** 予定をもう1つ入れられるか（課金オンまでは誰でも入れられる） */
export function canAddPlan(plansCount: number, isPlus: boolean, billingEnabled: boolean): boolean {
  return !billingEnabled || isPlus || plansCount < FREE_PLAN_LIMIT;
}
