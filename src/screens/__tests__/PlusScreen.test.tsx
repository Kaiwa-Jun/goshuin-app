import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';
import Purchases from 'react-native-purchases';

import { PlusScreen } from '@screens/PlusScreen';
import { PlusMiniCalendar } from '@components/plus/PlusMiniCalendar';
import { resetPurchasesForTests } from '@services/purchases';

/* 契約書: docs/issues/issue-270-plus-purchase.md（S5 / AC-41〜48）・
   docs/issues/issue-272-plus-restore-link.md（AC-6・7・11〜17・UI-2） */
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const RN = require('react-native');
  return { SafeAreaView: RN.View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
const mockAuth = { isAuthenticated: true, user: { id: 'me' } };
jest.mock('@hooks/useAuth', () => ({ useAuth: () => mockAuth }));
jest.mock('@/constants/plus', () => ({
  BILLING_ENABLED: true,
  FREE_PLAN_LIMIT: 1,
  PLUS_ENTITLEMENT: 'plus',
}));

const P = jest.mocked(Purchases);
const PLUS = { entitlements: { active: { plus: {} } } };
const NONE = { entitlements: { active: {} } };
const ORIGINAL_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), popTo: jest.fn() });

const renderScreen = async () => {
  const n = nav();
  const ui = render(
    <PlusScreen navigation={n as never} route={{ key: 'k', name: 'Plus' } as never} />
  );
  await waitFor(() => expect(ui.getByText('¥980でプラスにする')).toBeTruthy());
  return { ui, n };
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_x';
  resetPurchasesForTests();
  P.getCustomerInfo.mockResolvedValue(NONE as never);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterAll(() => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = ORIGINAL_KEY;
});

it('AC-41: 見出し・カード・購入・復元・規約。「あとで」は無い', async () => {
  const { ui } = await renderScreen();
  for (const t of [
    '予定を、先までいくつでも',
    '無料',
    '0円',
    '予定 1件',
    'おすすめ',
    'いくつでも',
    '1回だけの支払い',
    '購入を復元',
    '利用規約',
    'プライバシーポリシー',
  ])
    expect(ui.getByText(t)).toBeTruthy();
  expect(ui.getAllByText('御朱印さんぽ プラス').length).toBeGreaterThanOrEqual(1);
  expect(ui.queryByText('あとで')).toBeNull();
});

it('#272 AC-6: 無料のカードに「いまのプラン」、プラスのカードに「おすすめ」', async () => {
  const { ui } = await renderScreen();
  expect(within(ui.getByTestId('plus-card-free')).getByText('いまのプラン')).toBeTruthy();
  expect(within(ui.getByTestId('plus-card-plus')).getByText('おすすめ')).toBeTruthy();
});

it('AC-42: 将来の約束を書かない', async () => {
  const { ui } = await renderScreen();
  for (const t of [/今後/, /追加の支払いなし/, /将来/]) expect(ui.queryByText(t)).toBeNull();
});

it('AC-43: 買えたら設定へ戻ってお礼。キャンセルなら何もしない', async () => {
  const { ui, n } = await renderScreen();
  P.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
  await act(async () => {
    fireEvent.press(ui.getByTestId('plus-buy'));
  });
  expect(n.popTo).not.toHaveBeenCalled();
  P.purchasePackage.mockResolvedValueOnce({ customerInfo: PLUS } as never);
  await act(async () => {
    fireEvent.press(ui.getByTestId('plus-buy'));
  });
  expect(n.popTo).toHaveBeenCalledTimes(1);
  expect(n.popTo).toHaveBeenCalledWith('MainTabs', {
    screen: 'Settings',
    params: { purchased: true },
  });
});

it('AC-44: 復元できたらこの画面のまま「購入済み」', async () => {
  const { ui, n } = await renderScreen();
  P.restorePurchases.mockResolvedValueOnce(PLUS as never);
  await act(async () => {
    fireEvent.press(ui.getByTestId('plus-restore'));
  });
  expect(Alert.alert).toHaveBeenCalledWith('購入を復元しました');
  expect(n.popTo).not.toHaveBeenCalled();
  expect(within(ui.getByTestId('plus-buy')).getByText('購入済み')).toBeTruthy();
  expect(ui.getByTestId('plus-buy')).toBeDisabled();
  expect(ui.queryByText('購入を復元')).toBeNull();
  expect(ui.queryByText('1回だけの支払い')).toBeNull();
});

it('AC-45: プラスで開くとボタンは「購入済み」で押せない', async () => {
  P.getCustomerInfo.mockResolvedValue(PLUS as never);
  const n = nav();
  const ui = render(
    <PlusScreen navigation={n as never} route={{ key: 'k', name: 'Plus' } as never} />
  );
  await waitFor(() =>
    expect(within(ui.getByTestId('plus-buy')).getByText('購入済み')).toBeTruthy()
  );
  expect(ui.getByTestId('plus-buy')).toBeDisabled();
  fireEvent.press(ui.getByTestId('plus-buy'));
  expect(P.purchasePackage).not.toHaveBeenCalled();
  // #272 AC-7: 札はプラスのカードへ移り、「おすすめ」は無い
  expect(within(ui.getByTestId('plus-card-plus')).getByText('いまのプラン')).toBeTruthy();
  expect(within(ui.getByTestId('plus-card-free')).queryByText('いまのプラン')).toBeNull();
  expect(ui.queryByText('おすすめ')).toBeNull();
});

describe('PlusMiniCalendar', () => {
  it('AC-46: 来月の土曜すべてに印（4,3,5,2,3 の順）', () => {
    // 読み上げから外してあるので、隠れた要素も含めて探す
    const hidden = { includeHiddenElements: true };
    const r = render(<PlusMiniCalendar today={new Date(2026, 8, 26)} />);
    expect(r.getByText('2026年10月', hidden)).toBeTruthy();
    const marks = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31'].map(d =>
      r.getByTestId(`plus-mini-mark-${d}`, hidden)
    );
    expect(marks.map(m => m.props.children)).toEqual(['●4社', '●3社', '●5社', '●2社', '●3社']);
    expect(r.queryAllByTestId(/^plus-mini-mark-/, hidden)).toHaveLength(5);
    const dec = render(<PlusMiniCalendar today={new Date(2026, 11, 15)} />);
    expect(dec.getByText('2027年1月', hidden)).toBeTruthy();
  });

  it('AC-47: 押せず、読み上げない', () => {
    const r = render(<PlusMiniCalendar today={new Date(2026, 8, 26)} />);
    const box = r.getByTestId('plus-mini-calendar', { includeHiddenElements: true });
    expect(box.props.accessibilityElementsHidden).toBe(true);
    expect(box.props.importantForAccessibility).toBe('no-hide-descendants');
    const pressable = r.UNSAFE_root.findAll(
      (node: { props: { onPress?: unknown } }) => typeof node.props.onPress === 'function'
    );
    expect(pressable).toHaveLength(0);
  });
});

it('AC-48: ‹ で戻る', async () => {
  const { ui, n } = await renderScreen();
  fireEvent.press(ui.getByTestId('plus-back'));
  expect(n.goBack).toHaveBeenCalled();
});
