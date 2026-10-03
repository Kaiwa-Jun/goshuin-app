import * as plusConstants from '@/constants/plus';
import { BILLING_ENABLED, FREE_PLAN_LIMIT, PLUS_ENTITLEMENT } from '@/constants/plus';
import { canAddPlan, countUpcomingPlans, hasPlus, resolveRevenueCatKey } from '@utils/plus';

/* 契約書: docs/issues/issue-270-plus-purchase.md（S1 / AC-1〜5） */

it('AC-1: 定数（スイッチは切ったまま・購入状態の定数は hook に置き換えて消した）', () => {
  expect(BILLING_ENABLED).toBe(false);
  expect(FREE_PLAN_LIMIT).toBe(1);
  expect(PLUS_ENTITLEMENT).toBe('plus');
  // grep で名前が0件になることも見るので、ここでは文字をつなげて書く
  expect(['IS', 'PLUS'].join('_') in plusConstants).toBe(false);
});

it('AC-2: countUpcomingPlans は今日以降の予定だけ数える（過ぎた予定は数えない）', () => {
  expect(
    countUpcomingPlans(
      [{ plannedOn: '2026-09-20' }, { plannedOn: '2026-09-26' }, { plannedOn: '2026-10-03' }],
      '2026-09-26'
    )
  ).toBe(2);
  expect(countUpcomingPlans([{ plannedOn: '2026-09-20' }], '2026-09-26')).toBe(0);
  expect(countUpcomingPlans([], '2026-09-26')).toBe(0);
});

it('AC-3: canAddPlan（第1引数は、これからの予定の数）', () => {
  expect(canAddPlan(1, false, false)).toBe(true);
  expect(canAddPlan(0, false, true)).toBe(true);
  expect(canAddPlan(1, false, true)).toBe(false);
  expect(canAddPlan(1, true, true)).toBe(true);
  expect(canAddPlan(5, false, false)).toBe(true);
});

it('AC-4: resolveRevenueCatKey（本番ビルドに Test Store のキーを使わない・iOS だけ）', () => {
  expect(resolveRevenueCatKey('appl_x', false, 'ios')).toBe('appl_x');
  expect(resolveRevenueCatKey('test_x', true, 'ios')).toBe('test_x');
  expect(resolveRevenueCatKey('test_x', false, 'ios')).toBeNull();
  expect(resolveRevenueCatKey(undefined, true, 'ios')).toBeNull();
  expect(resolveRevenueCatKey('   ', true, 'ios')).toBeNull();
  expect(resolveRevenueCatKey('appl_x', true, 'android')).toBeNull();
  expect(resolveRevenueCatKey('appl_x', true, 'web')).toBeNull();
});

it('AC-5: hasPlus は entitlement plus が有効かだけを見る', () => {
  expect(hasPlus({ entitlements: { active: { plus: {} } } })).toBe(true);
  expect(hasPlus({ entitlements: { active: {} } })).toBe(false);
  expect(hasPlus({ entitlements: { active: { other: {} } } })).toBe(false);
});
