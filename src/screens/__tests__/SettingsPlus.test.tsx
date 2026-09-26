import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import Purchases from 'react-native-purchases';

import { SettingsScreen } from '@screens/SettingsScreen';
import { resetPurchasesForTests } from '@services/purchases';
import { colors } from '@theme/colors';

/* 契約書: docs/issues/issue-270-plus-purchase.md（S5 / AC-35〜40・UI-2） */
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '0.1.0' } },
}));
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const RN = require('react-native');
  return { SafeAreaView: RN.View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));
let mockAuth: Record<string, unknown> = {};
jest.mock('@hooks/useAuth', () => ({ useAuth: () => mockAuth }));
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
const ORIGINAL_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const loggedIn = { user: { id: 'me', email: 'a@b.c' }, isAuthenticated: true, signOut: jest.fn() };

const renderScreen = async (params?: { purchased?: boolean }) => {
  const parent = { navigate: jest.fn() };
  const n = { navigate: jest.fn(), setParams: jest.fn(), getParent: () => parent };
  const ui = render(
    <SettingsScreen
      navigation={n as never}
      route={{ key: 'k', name: 'Settings', params } as never}
    />
  );
  await act(async () => {});
  await act(async () => {});
  return { ui, n, parent };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBilling = true;
  mockAuth = loggedIn;
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_x';
  resetPurchasesForTests();
  P.getCustomerInfo.mockResolvedValue(NONE as never);
});
afterAll(() => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = ORIGINAL_KEY;
});

it('AC-35: スイッチが切れていれば出さない', async () => {
  mockBilling = false;
  const { ui } = await renderScreen();
  expect(ui.queryByTestId('settings-section-plus')).toBeNull();
  expect(ui.queryByText('御朱印さんぽ プラス')).toBeNull();
});

it('AC-36: アカウントのすぐ下にカード。押すとプラスの画面', async () => {
  const { ui, parent } = await renderScreen();
  await waitFor(() => expect(ui.getByText('¥980')).toBeTruthy());
  const sections = ui.getAllByTestId(/^settings-section-/).map(el => el.props.testID as string);
  expect(sections[sections.indexOf('settings-section-account') + 1]).toBe('settings-section-plus');
  const card = within(ui.getByTestId('plus-settings-card'));
  expect(card.getByText('御朱印さんぽ プラス')).toBeTruthy();
  expect(card.getByText('予定をいくつでも入れられます')).toBeTruthy();
  fireEvent.press(ui.getByTestId('plus-settings-card'));
  expect(parent.navigate).toHaveBeenCalledWith('Plus');
});

it('AC-37: 買っていれば「購入済み」', async () => {
  P.getCustomerInfo.mockResolvedValue(PLUS as never);
  const { ui, parent } = await renderScreen();
  await waitFor(() => expect(ui.getByText('購入済み')).toBeTruthy());
  expect(ui.queryByText('¥980')).toBeNull();
  fireEvent.press(ui.getByTestId('plus-settings-card'));
  expect(parent.navigate).toHaveBeenCalledWith('Plus');
});

it('AC-38: ゲストはログインへ', async () => {
  mockAuth = { user: null, isAuthenticated: false, signOut: jest.fn() };
  const { ui, parent } = await renderScreen();
  expect(ui.getByText('ログインすると購入できます')).toBeTruthy();
  expect(ui.queryByText('¥980')).toBeNull();
  fireEvent.press(ui.getByTestId('plus-settings-card'));
  expect(parent.navigate).toHaveBeenCalledWith('Login');
  expect(parent.navigate).not.toHaveBeenCalledWith('Plus');
});

it('AC-39: 値段が取れなければ値段を出さない', async () => {
  P.getOfferings.mockResolvedValueOnce({ current: null } as never);
  const { ui } = await renderScreen();
  expect(ui.getByTestId('plus-settings-card')).toBeTruthy();
  expect(ui.queryByText('¥980')).toBeNull();
});

it('AC-40: 買って戻ったら一言、3.2秒で消え、params から消す', async () => {
  jest.useFakeTimers();
  const { ui, n } = await renderScreen({ purchased: true });
  expect(ui.getByText('プラスになりました。ありがとうございます')).toBeTruthy();
  expect(n.setParams).toHaveBeenCalledWith({ purchased: undefined });
  act(() => {
    jest.advanceTimersByTime(3200);
  });
  expect(ui.queryByText('プラスになりました。ありがとうございます')).toBeNull();
  jest.useRealTimers();
});

it('UI-2: カードの色（まだ / 購入済み）', async () => {
  const { ui } = await renderScreen();
  await waitFor(() => expect(ui.getByText('¥980')).toBeTruthy());
  const style = StyleSheet.flatten(ui.getByTestId('plus-settings-card').props.style);
  expect(style).toMatchObject({
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[100],
  });

  P.getCustomerInfo.mockResolvedValue(PLUS as never);
  resetPurchasesForTests();
  const owned = await renderScreen();
  await waitFor(() => expect(owned.ui.getByText('購入済み')).toBeTruthy());
  expect(StyleSheet.flatten(owned.ui.getByTestId('plus-settings-card').props.style)).toMatchObject({
    backgroundColor: colors.white,
    borderColor: colors.gray[200],
  });
  expect(StyleSheet.flatten(owned.ui.getByText('購入済み').props.style).color).toBe(
    colors.pin.wishlisted
  );
});
