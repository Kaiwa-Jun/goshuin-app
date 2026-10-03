import fs from 'fs';
import path from 'path';
import Purchases from 'react-native-purchases';

import PurchasesWebStub from '@utils/purchases.web';

/* 契約書: docs/issues/issue-270-plus-purchase.md（S2 / AC-6〜11） */

type Service = typeof import('@services/purchases');
const load = (): Service => {
  let mod!: Service;
  jest.isolateModules(() => {
    mod = require('@services/purchases');
  });
  return mod;
};
const P = jest.mocked(Purchases);
const ORIGINAL_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_x';
});
afterAll(() => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = ORIGINAL_KEY;
});

const noCalls = () => {
  for (const fn of Object.values(P)) expect(fn).not.toHaveBeenCalled();
};

describe('syncPurchasesUser', () => {
  it('AC-6: 1回だけ初期化し、利用者が変わったら logIn / logOut する', async () => {
    const s = load();
    await expect(s.syncPurchasesUser('u1')).resolves.toBe(true);
    expect(P.configure).toHaveBeenCalledTimes(1);
    expect(P.configure).toHaveBeenCalledWith({ apiKey: 'appl_x', appUserID: 'u1' });
    await s.syncPurchasesUser('u1');
    expect(P.configure).toHaveBeenCalledTimes(1);
    expect(P.logIn).not.toHaveBeenCalled();
    await s.syncPurchasesUser('u2');
    expect(P.logIn).toHaveBeenCalledTimes(1);
    expect(P.logIn).toHaveBeenCalledWith('u2');
    await s.syncPurchasesUser(null);
    expect(P.logOut).toHaveBeenCalledTimes(1);
  });

  it('AC-6: 初期化前に同時に呼んでも configure は1回', async () => {
    const s = load();
    await Promise.all([s.syncPurchasesUser('u1'), s.syncPurchasesUser('u1')]);
    expect(P.configure).toHaveBeenCalledTimes(1);
  });

  it('AC-7: キーが無ければ初期化せず、どの関数も呼ばない', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    const s = load();
    await expect(s.syncPurchasesUser('u1')).resolves.toBe(false);
    noCalls();
  });

  it('AC-7: キーは resolveRevenueCatKey（__DEV__・Platform.OS）で決める', () => {
    const src = fs.readFileSync(path.join(__dirname, '../purchases.ts'), 'utf8');
    expect(src.replace(/\s+/g, ' ')).toContain(
      'resolveRevenueCatKey( process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, __DEV__, Platform.OS )'
    );
  });

  it('AC-8: ゲストのままなら初期化しない', async () => {
    const s = load();
    await expect(s.syncPurchasesUser(null)).resolves.toBe(false);
    noCalls();
  });
});

describe('fetchPlusPackage', () => {
  it('AC-9: current の最初の package。無ければ null', async () => {
    const s = load();
    const pkg = { identifier: '$rc_lifetime' };
    P.getOfferings.mockResolvedValueOnce({ current: { availablePackages: [pkg] } } as never);
    await expect(s.fetchPlusPackage()).resolves.toBe(pkg);
    P.getOfferings.mockResolvedValueOnce({ current: null } as never);
    await expect(s.fetchPlusPackage()).resolves.toBeNull();
    P.getOfferings.mockResolvedValueOnce({ current: { availablePackages: [] } } as never);
    await expect(s.fetchPlusPackage()).resolves.toBeNull();
  });
});

it('AC-10: subscribeCustomerInfo は外す関数を返す', () => {
  const s = load();
  const fn = jest.fn();
  const off = s.subscribeCustomerInfo(fn);
  expect(P.addCustomerInfoUpdateListener).toHaveBeenCalledWith(fn);
  off();
  expect(P.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(fn);
});

describe('Web', () => {
  it('AC-11: Web では react-native-purchases をスタブに差し替える', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const config = require('../../../metro.config.js');
    const context = { resolveRequest: jest.fn(() => ({ type: 'sourceFile', filePath: 'native' })) };
    const web = config.resolver.resolveRequest(context, 'react-native-purchases', 'web');
    expect(web.filePath.endsWith('src/utils/purchases.web.ts')).toBe(true);
    config.resolver.resolveRequest(context, 'react-native-purchases', 'ios');
    expect(context.resolveRequest).toHaveBeenCalledWith(context, 'react-native-purchases', 'ios');
  });

  it('AC-11: スタブは購入の関数を reject する', async () => {
    await expect(PurchasesWebStub.getOfferings()).rejects.toThrow('not available on web');
  });
});
