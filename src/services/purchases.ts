import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  type PurchasesPackage,
} from 'react-native-purchases';

import { resolveRevenueCatKey } from '@utils/plus';

// RevenueCat の初期化と利用者の切り替え（Issue #270 D-4）。supabase のクライアントと同じく
// モジュールの中に1つだけ持つ。usePlus は複数の画面で同時にマウントされるので、ここで1回にまとめる

let configured = false;
let currentUserId: string | null = null;
let pending: Promise<boolean> = Promise.resolve(false);

async function sync(userId: string | null): Promise<boolean> {
  const apiKey = resolveRevenueCatKey(
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    __DEV__,
    Platform.OS
  );
  if (!apiKey) return false;
  if (!configured) {
    // ゲストは SDK を使わない（一度も初期化しない）
    if (!userId) return false;
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
    currentUserId = userId;
    return true;
  }
  if (userId === currentUserId) return true;
  if (userId) {
    await Purchases.logIn(userId);
  } else if (currentUserId) {
    // 匿名の利用者で logOut すると reject するので、前回がログイン中だったときだけ
    await Purchases.logOut().catch((e: unknown) => console.warn('[purchases] logOut', e));
  }
  currentUserId = userId;
  return true;
}

/** 購入の利用者を Supabase の user.id にそろえる。初期化できていれば true */
export function syncPurchasesUser(userId: string | null): Promise<boolean> {
  // 同時に来た呼び出しは、前の呼び出しが終わってから判断する（configure を1回にする）
  pending = pending.catch(() => false).then(() => sync(userId));
  return pending;
}

/** 売る package（offering current の最初の1つ）。無ければ null */
export async function fetchPlusPackage(): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages[0] ?? null;
}

export function fetchCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

/** 購入する。キャンセルは reject（userCancelled）のまま返すので、呼び出し側で判定する */
export async function purchasePlus(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export function restorePlus(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/** CustomerInfo の更新を受け取る。返した関数で外す */
export function subscribeCustomerInfo(listener: CustomerInfoUpdateListener): () => void {
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/** テスト用: モジュールの中の「初期化済み」を忘れる（アプリからは呼ばない） */
export function resetPurchasesForTests(): void {
  configured = false;
  currentUserId = null;
  pending = Promise.resolve(false);
}
