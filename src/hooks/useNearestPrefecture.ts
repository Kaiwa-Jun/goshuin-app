import { useEffect, useState } from 'react';
import { PermissionStatus } from 'expo-location';

import { useLocation } from '@hooks/useLocation';
import { fetchSpotsByBounds } from '@services/spots';
import { NEARBY_MAX_KM, nearestPrefecture } from '@utils/firstStamp';
import { getBoundingBox } from '@utils/geo';

interface NearestPrefecture {
  /** 今いる県。決まらない（位置が取れない・近くに寺社が無い）ときは null */
  prefecture: string | null;
  /** 位置と寺社を読み終えたか。終わるまでは言葉を出さない */
  isResolved: boolean;
}

/**
 * あゆみの一言の県（Issue #327 D-13）。地図のカードと同じ規則で、位置情報が許可されて
 * 取れたときだけ、50km 以内でいちばん近い寺社の県。
 *
 * 記録 0 枚の人の一言の中だけで呼ぶ（記録のある人には位置も寺社も取りにいかない）。
 * 許可がない・取れないときの location は仙台の既定値なので使わない
 */
export function useNearestPrefecture(): NearestPrefecture {
  const { location, isLoading, error, permissionStatus } = useLocation();
  const origin = permissionStatus === PermissionStatus.GRANTED && error === null ? location : null;
  const originKey = origin ? `${origin.latitude},${origin.longitude}` : null;
  // どの位置で決めた県か。位置が変わった描画では、前の位置の県を「決まった」と見せない
  const [resolved, setResolved] = useState<{
    key: string | null;
    prefecture: string | null;
  } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!origin) {
      setResolved({ key: null, prefecture: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const spots = await fetchSpotsByBounds(
          getBoundingBox(origin.latitude, origin.longitude, NEARBY_MAX_KM)
        );
        if (!cancelled)
          setResolved({ key: originKey, prefecture: nearestPrefecture(spots, origin) });
      } catch {
        if (!cancelled) setResolved({ key: originKey, prefecture: null });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, originKey]);

  const isResolved = !isLoading && resolved !== null && resolved.key === originKey;
  return { prefecture: isResolved ? resolved.prefecture : null, isResolved };
}
