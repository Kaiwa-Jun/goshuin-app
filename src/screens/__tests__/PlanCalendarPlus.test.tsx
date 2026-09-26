import React from 'react';
import { AccessibilityInfo, Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';
import Purchases from 'react-native-purchases';

import { PlanCalendarScreen } from '@screens/PlanCalendarScreen';
import { resetPurchasesForTests } from '@services/purchases';
import type { VisitPlan } from '@/types/visitPlan';
import { colors } from '@theme/colors';

/* 契約書: docs/issues/issue-270-plus-purchase.md（S4 / AC-19〜33・UI-1〜3）・
   docs/issues/issue-272-plus-restore-link.md（AC-3・8〜10） */
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]) };
});
const mockAuth = { isAuthenticated: true, user: { id: 'me' } };
jest.mock('@hooks/useAuth', () => ({ useAuth: () => mockAuth }));
const mockFetchPlans = jest.fn();
jest.mock('@services/visitPlans', () => ({
  fetchVisitPlans: () => mockFetchPlans(),
  fetchVisitedSpotIdsByDate: async () => new Map(),
}));
let mockBilling = true;
jest.mock('@/constants/plus', () => ({
  get BILLING_ENABLED() {
    return mockBilling;
  },
  FREE_PLAN_LIMIT: 1,
  PLUS_ENTITLEMENT: 'plus',
}));

const P = jest.mocked(Purchases);
const PLUS = { entitlements: { active: { plus: {} } } };
const NONE = { entitlements: { active: {} } };
const stop = (id: string, i: number) => ({
  spotId: id,
  position: i,
  spot: { id, name: id, type: 'shrine' as const, lat: 35, lng: 135 },
});
const UPCOMING: VisitPlan = {
  id: 'p1003',
  plannedOn: '2026-10-03',
  name: '東山めぐり',
  stops: ['a', 'b'].map(stop),
};
const PAST: VisitPlan = {
  id: 'p0920',
  plannedOn: '2026-09-20',
  name: '東山の朝',
  stops: ['a'].map(stop),
};

const nav = () => ({ navigate: jest.fn(), setParams: jest.fn() });
const ORIGINAL_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
let reduceMotion = false;

const renderScreen = async (plans: VisitPlan[] = [UPCOMING]) => {
  mockFetchPlans.mockResolvedValue(plans);
  const n = nav();
  const ui = render(
    <PlanCalendarScreen
      navigation={n as never}
      route={{ key: 'k', name: 'PlanCalendar' } as never}
    />
  );
  await waitFor(() => expect(mockFetchPlans).toHaveBeenCalled());
  await act(async () => {});
  await act(async () => {});
  return { ui, n };
};
const sheet = (ui: ReturnType<typeof render>) => ui.queryByTestId('plus-sheet');
/** シートが閉じる動きのあとに次の画面へ進む（onDismiss が来ない Jest ではタイマーで） */
const finishClose = () =>
  act(() => {
    jest.advanceTimersByTime(400);
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 26, 10, 0));
  mockBilling = true;
  reduceMotion = false;
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => Promise.resolve(reduceMotion));
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_x';
  resetPurchasesForTests();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.useRealTimers());
afterAll(() => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = ORIGINAL_KEY;
});

it('AC-19: 「＋ 予定を組む」で、入っている予定と今日を並べたシート', async () => {
  const { ui, n } = await renderScreen();
  fireEvent.press(ui.getByTestId('plan-new'));
  expect(n.navigate).not.toHaveBeenCalled();
  const s = within(ui.getByTestId('plus-sheet'));
  expect(s.getByText('予定をいくつでも入れるならプラス')).toBeTruthy();
  expect(s.getByText('10月3日（土）')).toBeTruthy();
  expect(s.getByText('東山めぐり')).toBeTruthy();
  expect(s.getByText('9月26日（土）')).toBeTruthy();
  expect(s.getByText('ここにも入れる')).toBeTruthy();
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('AC-20: 空いた日を押すと、その日で出る', async () => {
  const { ui } = await renderScreen();
  fireEvent.press(ui.getByTestId('plan-day-2026-10-10'));
  expect(within(ui.getByTestId('plus-sheet-target')).getByText('10月10日（土）')).toBeTruthy();
});

it('AC-21: カード2枚・値段・支払いの一言・復元・あとで・規約', async () => {
  const { ui } = await renderScreen();
  fireEvent.press(ui.getByTestId('plan-new'));
  const s = within(ui.getByTestId('plus-sheet'));
  for (const t of [
    '無料',
    '0円',
    '予定 1件',
    'プラス',
    'おすすめ',
    'いくつでも',
    '¥980でプラスにする',
  ])
    expect(s.getByText(t)).toBeTruthy();
  // カードの値段とボタンの2か所
  expect(s.getAllByText(/¥980/).length).toBeGreaterThanOrEqual(2);
  expect(s.getByText(/1回だけ$/)).toBeTruthy();
  expect(s.getByText('1回だけの支払い')).toBeTruthy();
  expect(s.getByText(/毎月はかかりません/)).toBeTruthy();
  for (const t of ['購入を復元', 'あとで', '利用規約', 'プライバシーポリシー'])
    expect(s.getByText(t)).toBeTruthy();
});

describe('購入', () => {
  it('AC-22: 買えたらシートを閉じて、その日で予定を組む画面へ', async () => {
    const { ui, n } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-day-2026-10-10'));
    P.purchasePackage.mockResolvedValueOnce({ customerInfo: PLUS } as never);
    await act(async () => {
      fireEvent.press(ui.getByTestId('plus-buy'));
    });
    expect(sheet(ui)).toBeNull();
    expect(n.navigate).not.toHaveBeenCalled();
    finishClose();
    expect(n.navigate).toHaveBeenCalledTimes(1);
    expect(n.navigate).toHaveBeenCalledWith('PlanEditor', { date: '2026-10-10', purchased: true });
  });

  it('AC-23: キャンセルは何も出さず、シートは開いたまま', async () => {
    const { ui, n } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    P.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    await act(async () => {
      fireEvent.press(ui.getByTestId('plus-buy'));
    });
    finishClose();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(sheet(ui)).toBeTruthy();
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('AC-24: 失敗は「購入できませんでした」', async () => {
    const { ui, n } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    P.purchasePackage.mockRejectedValueOnce({ userCancelled: false });
    await act(async () => {
      fireEvent.press(ui.getByTestId('plus-buy'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('購入できませんでした');
    expect(sheet(ui)).toBeTruthy();
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('AC-33: 実行中は購入と復元を押せない', async () => {
    const { ui } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    P.purchasePackage.mockReturnValueOnce(new Promise(() => {}) as never);
    await act(async () => {
      fireEvent.press(ui.getByTestId('plus-buy'));
    });
    expect(ui.getByTestId('plus-buy')).toBeDisabled();
    expect(ui.getByTestId('plus-restore')).toBeDisabled();
    fireEvent.press(ui.getByTestId('plus-buy'));
    expect(P.purchasePackage).toHaveBeenCalledTimes(1);
  });
});

describe('AC-25: 購入を復元', () => {
  it('復元できたら Alert・閉じて予定を組む画面へ（purchased なし）', async () => {
    const { ui, n } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-day-2026-10-10'));
    P.restorePurchases.mockResolvedValueOnce(PLUS as never);
    await act(async () => {
      fireEvent.press(ui.getByTestId('plus-restore'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('購入を復元しました');
    finishClose();
    expect(n.navigate).toHaveBeenCalledWith('PlanEditor', { date: '2026-10-10' });
  });
  it('見つからない・失敗はシートのまま', async () => {
    const { ui, n } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    P.restorePurchases.mockResolvedValueOnce(NONE as never);
    await act(async () => {
      fireEvent.press(ui.getByTestId('plus-restore'));
    });
    expect(Alert.alert).toHaveBeenLastCalledWith('復元できる購入が見つかりませんでした');
    P.restorePurchases.mockRejectedValueOnce(new Error('x'));
    await act(async () => {
      fireEvent.press(ui.getByTestId('plus-restore'));
    });
    expect(Alert.alert).toHaveBeenLastCalledWith('購入を復元できませんでした');
    finishClose();
    expect(sheet(ui)).toBeTruthy();
    expect(n.navigate).not.toHaveBeenCalled();
  });
});

it('AC-26: 「あとで」と ✕ で閉じるだけ。もう一度押せばまた出る', async () => {
  const { ui, n } = await renderScreen();
  fireEvent.press(ui.getByTestId('plan-day-2026-10-10'));
  fireEvent.press(ui.getByTestId('plus-later'));
  finishClose();
  expect(sheet(ui)).toBeNull();
  expect(n.navigate).not.toHaveBeenCalled();
  fireEvent.press(ui.getByTestId('plan-day-2026-10-10'));
  expect(sheet(ui)).toBeTruthy();
  fireEvent.press(ui.getByLabelText('閉じる'));
  expect(sheet(ui)).toBeNull();
});

it('AC-27: 規約・ポリシーはシートを閉じてから開く', async () => {
  const { ui, n } = await renderScreen();
  fireEvent.press(ui.getByTestId('plan-new'));
  fireEvent.press(ui.getByTestId('plus-terms'));
  expect(sheet(ui)).toBeNull();
  finishClose();
  expect(n.navigate).toHaveBeenLastCalledWith('TermsOfService');
  fireEvent.press(ui.getByTestId('plan-new'));
  fireEvent.press(ui.getByTestId('plus-privacy'));
  finishClose();
  expect(n.navigate).toHaveBeenLastCalledWith('PrivacyPolicy');
});

it('AC-28: 過ぎた予定しか無ければ、シートを出さずに組める', async () => {
  const { ui, n } = await renderScreen([PAST]);
  fireEvent.press(ui.getByTestId('plan-new'));
  expect(sheet(ui)).toBeNull();
  expect(n.navigate).toHaveBeenCalledWith('PlanEditor', { date: '2026-09-26' });
});

it('AC-29: プラスなら、これからの予定があっても組める', async () => {
  P.getCustomerInfo.mockResolvedValue(PLUS as never);
  const { ui, n } = await renderScreen();
  fireEvent.press(ui.getByTestId('plan-day-2026-10-10'));
  expect(sheet(ui)).toBeNull();
  expect(n.navigate).toHaveBeenCalledWith('PlanEditor', { date: '2026-10-10' });
  P.getCustomerInfo.mockReset();
  P.getCustomerInfo.mockResolvedValue(NONE as never);
});

it('AC-30: スイッチが切れていれば、何件あっても組めて SDK も呼ばない', async () => {
  mockBilling = false;
  const plans = [0, 1, 2, 3, 4].map(i => ({
    ...UPCOMING,
    id: `p${i}`,
    plannedOn: `2026-10-0${i + 3}`,
  }));
  const { ui, n } = await renderScreen(plans);
  fireEvent.press(ui.getByTestId('plan-new'));
  expect(sheet(ui)).toBeNull();
  expect(n.navigate).toHaveBeenCalledWith('PlanEditor', { date: '2026-09-26' });
  for (const fn of Object.values(P)) expect(fn).not.toHaveBeenCalled();
});

it('AC-31: 入っている予定を開くのは無料', async () => {
  const { ui, n } = await renderScreen();
  fireEvent.press(ui.getByTestId('plan-day-2026-10-03'));
  expect(sheet(ui)).toBeNull();
  expect(n.navigate).toHaveBeenCalledWith('PlanEditor', { planId: 'p1003' });
});

describe('AC-32: 値段が取れないとき', () => {
  it('unavailable: 押せず「いまは購入できません」', async () => {
    P.getOfferings.mockResolvedValueOnce({ current: null } as never);
    const { ui } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    expect(ui.getByTestId('plus-buy')).toBeDisabled();
    expect(within(ui.getByTestId('plus-sheet')).getByText('プラスにする')).toBeTruthy();
    expect(ui.getByTestId('plus-unavailable')).toHaveTextContent('いまは購入できません');
  });
  it('loading: 「読み込み中…」で押せない', async () => {
    P.getOfferings.mockReturnValueOnce(new Promise(() => {}) as never);
    const { ui } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    expect(within(ui.getByTestId('plus-sheet')).getByText('読み込み中…')).toBeTruthy();
    expect(ui.getByTestId('plus-buy')).toBeDisabled();
  });
  it('復元できないときは「購入を復元」も押せない', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    const { ui } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    expect(ui.getByTestId('plus-restore')).toBeDisabled();
  });
});

it('#272 AC-3: シートの札は、無料のカードに「いまのプラン」、プラスのカードに「おすすめ」', async () => {
  const { ui } = await renderScreen();
  fireEvent.press(ui.getByTestId('plan-new'));
  expect(within(ui.getByTestId('plus-card-free')).getByText('いまのプラン')).toBeTruthy();
  expect(within(ui.getByTestId('plus-card-plus')).getByText('おすすめ')).toBeTruthy();
});

describe('見た目', () => {
  it('UI-1: プラスのカードは太枠・薄いオレンジ・札、無料は灰の枠', async () => {
    const { ui } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    const plus = StyleSheet.flatten(ui.getByTestId('plus-card-plus').props.style);
    expect(plus).toMatchObject({
      borderWidth: 2,
      borderColor: colors.primary[500],
      backgroundColor: colors.primary[50],
    });
    expect(StyleSheet.flatten(ui.getByTestId('plus-card-tag').props.style).backgroundColor).toBe(
      colors.primary[500]
    );
    expect(StyleSheet.flatten(ui.getByTestId('plus-card-free').props.style).borderColor).toBe(
      colors.gray[200]
    );
  });

  it('UI-2: 購入のボタンはオレンジの地に白い字', async () => {
    const { ui } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    expect(StyleSheet.flatten(ui.getByTestId('plus-buy').props.style).backgroundColor).toBe(
      colors.primary[500]
    );
    const label = within(ui.getByTestId('plus-buy')).getByText('¥980でプラスにする');
    expect(StyleSheet.flatten(label.props.style).color).toBe(colors.white);
  });

  it('UI-3: プラスのカードは 350ms 待ってから浮く。Reduce Motion なら最初から', async () => {
    const { ui } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    const style = () => StyleSheet.flatten(ui.getByTestId('plus-card-plus').props.style);
    const y = () => (style().transform as { translateY: number }[])[0].translateY;
    expect(style().opacity).toBeCloseTo(0.6);
    expect(y()).toBeCloseTo(6);
    act(() => {
      jest.advanceTimersByTime(349);
    });
    expect(style().opacity).toBeCloseTo(0.6);
    act(() => {
      jest.advanceTimersByTime(501);
    });
    expect(style().opacity).toBeCloseTo(1);
    expect(y()).toBeCloseTo(0);
  });

  it('UI-3: Reduce Motion オン', async () => {
    reduceMotion = true;
    const { ui } = await renderScreen();
    fireEvent.press(ui.getByTestId('plan-new'));
    await act(async () => {});
    const style = StyleSheet.flatten(ui.getByTestId('plus-card-plus').props.style);
    expect(style.opacity).toBeCloseTo(1);
  });
});
