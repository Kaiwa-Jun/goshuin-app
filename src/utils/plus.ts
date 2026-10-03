import { FREE_PLAN_LIMIT, PLUS_ENTITLEMENT } from '@/constants/plus';

/** 予定をもう1つ入れられるか（課金オンまでは誰でも入れられる）。upcomingCount は、これからの予定の数 */
export function canAddPlan(
  upcomingCount: number,
  isPlus: boolean,
  billingEnabled: boolean
): boolean {
  return !billingEnabled || isPlus || upcomingCount < FREE_PLAN_LIMIT;
}

/** これからの予定（今日を含む）の数。過ぎた予定はお参りの記録として残すので、無料の枠に数えない */
export function countUpcomingPlans(plans: { plannedOn: string }[], todayKey: string): number {
  return plans.filter(p => p.plannedOn >= todayKey).length;
}

/**
 * RevenueCat の公開 SDK キーを使ってよいか（Issue #270 D-2）。使わないなら null。
 * iOS だけ。Test Store のキー（test_）は開発用のビルドでだけ使う（本番に紛れても SDK を動かさない）
 */
export function resolveRevenueCatKey(
  key: string | undefined,
  isDev: boolean,
  platform: string
): string | null {
  const k = key?.trim();
  if (!k || platform !== 'ios') return null;
  if (!isDev && k.startsWith('test_')) return null;
  return k;
}

/** プラスの entitlement が有効か */
export function hasPlus(customerInfo: {
  entitlements: { active: Record<string, unknown> };
}): boolean {
  return customerInfo.entitlements.active[PLUS_ENTITLEMENT] !== undefined;
}
