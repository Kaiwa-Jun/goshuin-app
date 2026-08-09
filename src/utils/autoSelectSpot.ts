import * as Location from 'expo-location';
import { AUTO_SELECT_SPOT_RADIUS_KM } from '@/constants/record';
import type { SpotWithDistance } from '@hooks/useNearbySpots';
import type { Spot } from '@/types/supabase';

/**
 * 記録画面で既定選択してよいスポットを選ぶ。
 *
 * ⚠️ `useLocation` は位置情報が未許可でもエラーでも `DEFAULT_LOCATION`（仙台）を
 * 返すため、距離だけで判断すると東京にいるユーザーに仙台のスポットを
 * 既定選択してしまう。必ず許可状態も見ること（Issue #130 / D-3）
 */
export function pickAutoSelectableSpot(
  nearbySpots: SpotWithDistance[],
  permissionStatus: Location.PermissionStatus | null
): Spot | null {
  if (permissionStatus !== Location.PermissionStatus.GRANTED) return null;

  const nearest = nearbySpots.reduce<SpotWithDistance | null>(
    (best, item) => (best === null || item.distanceKm < best.distanceKm ? item : best),
    null
  );

  if (!nearest) return null;
  if (nearest.distanceKm > AUTO_SELECT_SPOT_RADIUS_KM) return null;

  return nearest.spot;
}
