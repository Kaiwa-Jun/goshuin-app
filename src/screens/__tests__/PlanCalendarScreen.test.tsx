import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';

import { PlanCalendarScreen } from '@screens/PlanCalendarScreen';
import type { VisitPlan } from '@/types/visitPlan';

/* 契約書: docs/issues/issue-258-visit-plan.md（S3 / AC-26〜30・47・48） */
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]) };
});
const mockAuth = { isAuthenticated: true, user: { id: 'me' } };
jest.mock('@hooks/useAuth', () => ({ useAuth: () => mockAuth }));
const mockFetchPlans = jest.fn();
const mockFetchVisited = jest.fn();
jest.mock('@services/visitPlans', () => ({
  fetchVisitPlans: () => mockFetchPlans(),
  fetchVisitedSpotIdsByDate: (...a: unknown[]) => mockFetchVisited(...a),
}));
let mockBilling = false;
jest.mock('@/constants/plus', () => ({
  get BILLING_ENABLED() {
    return mockBilling;
  },
  FREE_PLAN_LIMIT: 1,
  IS_PLUS: false,
}));

const stop = (id: string, i: number) => ({
  spotId: id,
  position: i,
  spot: { id, name: id, type: 'shrine' as const, lat: 35, lng: 135 },
});
const PLANS: VisitPlan[] = [
  { id: 'p0920', plannedOn: '2026-09-20', name: '東山の朝', stops: ['a', 'b', 'c', 'd'].map(stop) },
  {
    id: 'p1012',
    plannedOn: '2026-10-12',
    name: '東山めぐり',
    stops: ['八坂神社', '建仁寺', '清水寺', '三十三間堂', '伏見稲荷大社'].map(stop),
  },
];

const nav = () => ({ navigate: jest.fn(), setParams: jest.fn() });
const renderScreen = (n = nav(), params?: { savedOn?: string }) =>
  render(
    <PlanCalendarScreen
      navigation={n as never}
      route={{ key: 'k', name: 'PlanCalendar', params } as never}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 26, 10, 0));
  mockBilling = false;
  mockFetchPlans.mockResolvedValue(PLANS);
  mockFetchVisited.mockResolvedValue(new Map([['2026-09-20', new Set(['a', 'b', 'c'])]]));
});
afterEach(() => jest.useRealTimers());

it('AC-26: 過ぎた予定は ✓k/N、次の予定、› で10月・●N社', async () => {
  const ui = renderScreen();
  await waitFor(() => expect(ui.getByTestId('plan-day-2026-09-20')).toHaveTextContent(/✓3\/4/));
  expect(mockFetchVisited).toHaveBeenCalledWith('me', ['2026-09-20']);
  expect(ui.getByTestId('plan-next-card')).toHaveTextContent(/10月12日（月） 東山めぐり/);
  fireEvent.press(ui.getByTestId('plan-next-month'));
  expect(ui.getByText('2026年10月')).toBeTruthy();
  expect(ui.getByTestId('plan-day-2026-10-12')).toHaveTextContent(/●5社/);
});

it('AC-27: 予定が0件なら案内だけ', async () => {
  mockFetchPlans.mockResolvedValue([]);
  const ui = renderScreen();
  await waitFor(() =>
    expect(ui.getByText(/行きたい寺社を回る予定を組んでみましょう。/)).toBeTruthy()
  );
  expect(ui.queryByTestId('plan-next-card')).toBeNull();
});

it('AC-28: 「＋ 予定を組む」は次の土曜日、空いた日はその日付で組む', async () => {
  const n = nav();
  const ui = renderScreen(n);
  await waitFor(() => expect(mockFetchPlans).toHaveBeenCalled());
  fireEvent.press(ui.getByTestId('plan-new'));
  expect(n.navigate).toHaveBeenLastCalledWith('PlanEditor', { date: '2026-10-03' });
  fireEvent.press(ui.getByTestId('plan-day-2026-10-05'));
  expect(n.navigate).toHaveBeenLastCalledWith('PlanEditor', { date: '2026-10-05' });
  fireEvent.press(ui.getByTestId('plan-day-2026-09-20'));
  expect(n.navigate).toHaveBeenLastCalledWith('PlanEditor', { planId: 'p0920' });
});

it('AC-29: 予定の無い過ぎた日は押せない', async () => {
  const n = nav();
  const ui = renderScreen(n);
  await waitFor(() => expect(mockFetchPlans).toHaveBeenCalled());
  expect(ui.getByTestId('plan-day-2026-09-25')).toBeDisabled();
});

it('AC-30: 課金オンで無料の上限なら Alert、オフなら何件でも組める', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockBilling = true;
  const n = nav();
  const ui = renderScreen(n);
  await waitFor(() => expect(mockFetchPlans).toHaveBeenCalled());
  await act(async () => {});
  fireEvent.press(ui.getByTestId('plan-new'));
  expect(alert).toHaveBeenCalledWith(
    '予定をいくつでも入れるのはプラスです',
    expect.any(String),
    expect.any(Array)
  );
  expect(n.navigate).not.toHaveBeenCalled();

  mockBilling = false;
  const n2 = nav();
  const ui2 = renderScreen(n2);
  await waitFor(() => expect(mockFetchPlans).toHaveBeenCalled());
  fireEvent.press(ui2.getAllByTestId('plan-new')[0]);
  expect(n2.navigate).toHaveBeenCalledWith('PlanEditor', { date: '2026-10-03' });
  alert.mockRestore();
});

it('AC-47: 読み込めなかったら案内と「もう一度」', async () => {
  mockFetchPlans.mockRejectedValueOnce(new Error('x'));
  const ui = renderScreen();
  await waitFor(() => expect(ui.getByText('予定を読み込めませんでした')).toBeTruthy());
  fireEvent.press(ui.getByTestId('plan-retry'));
  await waitFor(() => expect(mockFetchPlans).toHaveBeenCalledTimes(2));
});

it('AC-48: 見えない寺社を除いた数で出す', async () => {
  // service が見えない寺社を落とした結果（4社中1社が見えない）
  mockFetchPlans.mockResolvedValue([
    { id: 'p', plannedOn: '2026-09-28', name: 'x', stops: ['a', 'b', 'c'].map(stop) },
  ]);
  const ui = renderScreen();
  await waitFor(() => expect(ui.getByTestId('plan-day-2026-09-28')).toHaveTextContent(/●3社/));
});

it('保存して戻ったら、その月を開いて「に保存しました」', async () => {
  const n = nav();
  const ui = renderScreen(n, { savedOn: '2026-10-03' });
  await waitFor(() => expect(ui.getByText('10月3日（土） に保存しました')).toBeTruthy());
  expect(ui.getByText('2026年10月')).toBeTruthy();
});
