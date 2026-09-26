import { act, renderHook, waitFor } from '@testing-library/react-native';
import Purchases from 'react-native-purchases';

import { usePlus } from '@hooks/usePlus';
import { resetPurchasesForTests } from '@services/purchases';

/* 契約書: docs/issues/issue-270-plus-purchase.md（S3 / AC-13〜18） */

let mockBilling = true;
jest.mock('@/constants/plus', () => ({
  get BILLING_ENABLED() {
    return mockBilling;
  },
  FREE_PLAN_LIMIT: 1,
  PLUS_ENTITLEMENT: 'plus',
}));
let mockAuth: { user: { id: string } | null; isLoading?: boolean } = { user: { id: 'me' } };
jest.mock('@hooks/useAuth', () => ({ useAuth: () => mockAuth }));

const P = jest.mocked(Purchases);
const PLUS = { entitlements: { active: { plus: {} } } };
const NONE = { entitlements: { active: {} } };
const ORIGINAL_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

// service の「初期化済み」はモジュールの中にあるので、テストごとに忘れさせる
const load = () => {
  resetPurchasesForTests();
  return usePlus;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBilling = true;
  mockAuth = { user: { id: 'me' } };
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_x';
});
afterAll(() => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = ORIGINAL_KEY;
});

const ready = async () => {
  load();
  const r = renderHook(() => usePlus());
  await waitFor(() => expect(r.result.current.status).toBe('ready'));
  return r;
};

it('AC-13: スイッチが切れている間は SDK を呼ばない', async () => {
  mockBilling = false;
  load();
  const { result } = renderHook(() => usePlus());
  await act(async () => {});
  expect(result.current).toMatchObject({ isPlus: false, status: 'unavailable', priceString: null });
  for (const fn of Object.values(P)) expect(fn).not.toHaveBeenCalled();
});

it('AC-14: 読み込み中 → 値段が取れたら ready', async () => {
  load();
  const { result } = renderHook(() => usePlus());
  expect(result.current.status).toBe('loading');
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current).toMatchObject({
    isPlus: false,
    priceString: '¥980',
    canRestore: true,
  });
  expect(P.configure).toHaveBeenCalledWith({ apiKey: 'appl_x', appUserID: 'me' });
});

// S6 のシミュレータで見つけた: useAuth は画面ごとに user=null（読み込み中）から始まるので、
// 待たずに同期すると画面を開くたびに logOut → logIn になり、RevenueCat に匿名の利用者ができていた
it('S6: ログインの読み込み中に開いた画面は、ログアウトしない', async () => {
  await ready();
  mockAuth = { user: null, isLoading: true };
  const second = renderHook(() => usePlus());
  await act(async () => {});
  expect(second.result.current.status).toBe('loading');
  expect(P.logOut).not.toHaveBeenCalled();
  mockAuth = { user: { id: 'me' }, isLoading: false };
  second.rerender({});
  await waitFor(() => expect(second.result.current.status).toBe('ready'));
  expect(P.logOut).not.toHaveBeenCalled();
  expect(P.logIn).not.toHaveBeenCalled();
});

it('AC-15: CustomerInfo の更新で isPlus が変わり、アンマウントで外す', async () => {
  const r = await ready();
  const listener = P.addCustomerInfoUpdateListener.mock.calls[0][0];
  act(() => listener(PLUS as never));
  expect(r.result.current.isPlus).toBe(true);
  r.unmount();
  expect(P.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
});

describe('AC-16: 買えないとき', () => {
  const statusOf = async () => {
    load();
    const { result } = renderHook(() => usePlus());
    await act(async () => {});
    await act(async () => {});
    return result.current;
  };
  it('ゲスト', async () => {
    mockAuth = { user: null };
    expect(await statusOf()).toMatchObject({ status: 'unavailable', canRestore: false });
  });
  it('キーが無い', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    expect(await statusOf()).toMatchObject({ status: 'unavailable', canRestore: false });
  });
  it('offerings が取れない（復元はできる）', async () => {
    P.getOfferings.mockRejectedValueOnce(new Error('x'));
    expect(await statusOf()).toMatchObject({ status: 'unavailable', canRestore: true });
  });
  it('current が無い', async () => {
    P.getOfferings.mockResolvedValueOnce({ current: null } as never);
    expect(await statusOf()).toMatchObject({ status: 'unavailable', canRestore: true });
  });
});

describe('AC-17: purchase', () => {
  it('買えたら purchased・実行中は busy', async () => {
    const r = await ready();
    let resolve!: (v: unknown) => void;
    P.purchasePackage.mockReturnValueOnce(new Promise(res => (resolve = res)) as never);
    let result!: Promise<string>;
    act(() => {
      result = r.result.current.purchase();
    });
    expect(r.result.current.busy).toBe(true);
    await act(async () => resolve({ customerInfo: PLUS }));
    await expect(result).resolves.toBe('purchased');
    expect(r.result.current).toMatchObject({ isPlus: true, busy: false });
  });
  it('キャンセルは cancelled、それ以外の失敗と plus なしは failed', async () => {
    const r = await ready();
    P.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    await act(async () => expect(await r.result.current.purchase()).toBe('cancelled'));
    P.purchasePackage.mockRejectedValueOnce({ userCancelled: false });
    await act(async () => expect(await r.result.current.purchase()).toBe('failed'));
    P.purchasePackage.mockResolvedValueOnce({ customerInfo: NONE } as never);
    await act(async () => expect(await r.result.current.purchase()).toBe('failed'));
  });
});

it('AC-18: restore', async () => {
  const r = await ready();
  P.restorePurchases.mockResolvedValueOnce(PLUS as never);
  await act(async () => expect(await r.result.current.restore()).toBe('restored'));
  P.restorePurchases.mockResolvedValueOnce(NONE as never);
  await act(async () => expect(await r.result.current.restore()).toBe('none'));
  P.restorePurchases.mockRejectedValueOnce(new Error('x'));
  await act(async () => expect(await r.result.current.restore()).toBe('failed'));
});
