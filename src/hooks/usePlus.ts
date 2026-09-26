import { useCallback, useEffect, useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';

import { BILLING_ENABLED } from '@/constants/plus';
import { useAuth } from '@hooks/useAuth';
import {
  fetchCustomerInfo,
  fetchPlusPackage,
  purchasePlus,
  restorePlus,
  subscribeCustomerInfo,
  syncPurchasesUser,
} from '@services/purchases';
import { hasPlus } from '@utils/plus';

export type PlusStatus = 'loading' | 'ready' | 'unavailable';
export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';
export type RestoreResult = 'restored' | 'none' | 'failed';

/**
 * 「御朱印さんぽ プラス」の購入の状態（Issue #270 D-5）。画面ごとにローカルの state で持つ
 * （グローバル状態は入れない）。スイッチ（BILLING_ENABLED）が切れている間は SDK を呼ばない
 */
export function usePlus() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [isPlus, setIsPlus] = useState(false);
  const [status, setStatus] = useState<PlusStatus>(BILLING_ENABLED ? 'loading' : 'unavailable');
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [canRestore, setCanRestore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!BILLING_ENABLED) return;
    let cancelled = false;
    let unsubscribe = () => {};
    setStatus('loading');
    (async () => {
      const ready = await syncPurchasesUser(userId).catch(() => false);
      if (cancelled) return;
      if (!ready) {
        setIsPlus(false);
        setPkg(null);
        setCanRestore(false);
        setStatus('unavailable');
        return;
      }
      setCanRestore(true);
      unsubscribe = subscribeCustomerInfo(info => setIsPlus(hasPlus(info)));
      fetchCustomerInfo()
        .then(info => {
          if (!cancelled) setIsPlus(hasPlus(info));
        })
        .catch(() => {});
      try {
        const found = await fetchPlusPackage();
        if (cancelled) return;
        setPkg(found);
        setStatus(found?.product.priceString ? 'ready' : 'unavailable');
      } catch {
        // 値段が取れなくても、復元はできる（canRestore は true のまま）
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);

  const purchase = useCallback(async (): Promise<PurchaseResult> => {
    if (!pkg) return 'failed';
    setBusy(true);
    try {
      const plus = hasPlus(await purchasePlus(pkg));
      setIsPlus(plus);
      return plus ? 'purchased' : 'failed';
    } catch (e) {
      return (e as { userCancelled?: boolean } | null)?.userCancelled ? 'cancelled' : 'failed';
    } finally {
      setBusy(false);
    }
  }, [pkg]);

  const restore = useCallback(async (): Promise<RestoreResult> => {
    setBusy(true);
    try {
      const plus = hasPlus(await restorePlus());
      setIsPlus(plus);
      return plus ? 'restored' : 'none';
    } catch {
      return 'failed';
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    isPlus,
    status,
    priceString: pkg?.product.priceString ?? null,
    canRestore,
    busy,
    purchase,
    restore,
  };
}
