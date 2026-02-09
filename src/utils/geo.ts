export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Haversine 公式で2点間の距離(km)を計算
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * バウンディングボックス計算（中心座標 + 半径km → min/max 座標）
 */
export function getBoundingBox(lat: number, lng: number, radiusKm: number): BoundingBox {
  const latDelta = radiusKm / EARTH_RADIUS_KM;
  const lngDelta = radiusKm / (EARTH_RADIUS_KM * Math.cos((lat * Math.PI) / 180));

  const latDeltaDeg = (latDelta * 180) / Math.PI;
  const lngDeltaDeg = (lngDelta * 180) / Math.PI;

  return {
    minLat: lat - latDeltaDeg,
    maxLat: lat + latDeltaDeg,
    minLng: lng - lngDeltaDeg,
    maxLng: lng + lngDeltaDeg,
  };
}

export const DEFAULT_RADIUS_KM = 2;
export const RADIUS_STEPS = [2, 3, 5, 10];
export const MIN_SPOTS_THRESHOLD = 5;

/** デフォルト座標（仙台市中心部） */
export const DEFAULT_LOCATION = { latitude: 38.2682, longitude: 140.8694 };
