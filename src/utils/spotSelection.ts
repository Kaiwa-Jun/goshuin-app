import type { Spot } from '@/types/supabase';
import { calculateDistance } from '@utils/geo';

/** react-native-maps の Region と構造互換（RN 非依存を保つため自前定義） */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** 描画マーカー数の上限（visited/wishlist の pinned 分を除く） */
export const MAX_VISIBLE_SPOTS = 80;

/** ビューポート判定のマージン係数。パン時の端のピン出没を減らす */
export const VIEWPORT_MARGIN = 1.2;

interface SelectVisibleSpotsParams {
  spots: Spot[];
  region: MapRegion | null;
  visitedSpotIds: Set<string>;
  wishlistSpotIds: Set<string>;
  /** デフォルト MAX_VISIBLE_SPOTS。テスト用に上書き可能 */
  maxCount?: number;
}

/**
 * 地図に描画するスポットを「ビューポート内 × rank 優先 top-N」で選択する。
 *
 * - ビューポート（region ± delta/2 × マージン、境界 inclusive）内だけを対象にする
 * - 訪問済み・行きたいリスト（pinned）はビューポート内なら maxCount を超えても全件含める
 * - 残り枠は rank 降順 → 中心距離昇順 → id 昇順の決定的な順で埋める
 * - region が null の場合はビューポート判定を行わず、全件を対象に
 *   rank 降順 → id 昇順で選択する（距離キーなし）
 *
 * 入力配列は破壊しない。同一入力に対する結果は決定的。
 */
export function selectVisibleSpots({
  spots,
  region,
  visitedSpotIds,
  wishlistSpotIds,
  maxCount = MAX_VISIBLE_SPOTS,
}: SelectVisibleSpotsParams): Spot[] {
  // 境界は inclusive。浮動小数点の丸め誤差で境界ちょうどが弾かれないよう
  // 微小な許容量を加える（1e-9 度 ≈ 0.1mm で地理的には無視できる）
  const EPS = 1e-9;
  const inViewport = region
    ? (() => {
        const halfLat = (region.latitudeDelta / 2) * VIEWPORT_MARGIN + EPS;
        const halfLng = (region.longitudeDelta / 2) * VIEWPORT_MARGIN + EPS;
        return (spot: Spot) =>
          Math.abs(spot.lat - region.latitude) <= halfLat &&
          Math.abs(spot.lng - region.longitude) <= halfLng;
      })()
    : () => true;

  const isPinned = (spot: Spot) => visitedSpotIds.has(spot.id) || wishlistSpotIds.has(spot.id);

  const pinned: Spot[] = [];
  const candidates: Spot[] = [];
  for (const spot of spots) {
    if (!inViewport(spot)) continue;
    if (isPinned(spot)) {
      pinned.push(spot);
    } else {
      candidates.push(spot);
    }
  }

  const remaining = Math.max(0, maxCount - pinned.length);
  if (remaining === 0) return pinned;

  // 距離はソート前に1回だけ計算する（comparator 内で毎回計算しない）
  const scored = candidates.map(spot => ({
    spot,
    distance: region ? calculateDistance(region.latitude, region.longitude, spot.lat, spot.lng) : 0,
  }));

  scored.sort((a, b) => {
    if (a.spot.rank !== b.spot.rank) return b.spot.rank - a.spot.rank;
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.spot.id < b.spot.id ? -1 : a.spot.id > b.spot.id ? 1 : 0;
  });

  return [...pinned, ...scored.slice(0, remaining).map(s => s.spot)];
}
