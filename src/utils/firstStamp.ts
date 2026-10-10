import type { Spot } from '@/types/supabase';
import { calculateDistance } from '@utils/geo';

/**
 * 記録 0 枚の人を最初の 1 枚へ連れていくための、近くの寺社と今いる県（#327）。
 *
 * 「近く」は 50km まで。それより遠い寺社しか無い所（日本の外・寺社の少ない所）では、
 * 県を名指さず、近くの寺社も出さない。
 */
export const NEARBY_MAX_KM = 50;
export const NEARBY_LIMIT = 5;

type Origin = { latitude: number; longitude: number };

/** origin から maxKm 以内（以下を含む）を近い順に limit 件。同じ距離なら名前の順。入力は並べ替えない */
export function nearbySpots(
  spots: Spot[],
  origin: Origin | null,
  opts: { maxKm?: number; limit?: number } = {}
): { spot: Spot; distanceKm: number }[] {
  if (!origin) return [];
  const { maxKm = NEARBY_MAX_KM, limit = NEARBY_LIMIT } = opts;

  return spots
    .map(spot => ({
      spot,
      distanceKm: calculateDistance(origin.latitude, origin.longitude, spot.lat, spot.lng),
    }))
    .filter(r => r.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.spot.name.localeCompare(b.spot.name, 'ja'))
    .slice(0, limit);
}

/** maxKm 以内で prefecture が null でない、いちばん近い寺社の県。無ければ null */
export function nearestPrefecture(spots: Spot[], origin: Origin | null): string | null {
  const known = spots.filter(s => s.prefecture !== null);
  const [nearest] = nearbySpots(known, origin, { limit: 1 });
  return nearest?.spot.prefecture ?? null;
}

export const FIRST_STAMP_CARD_TITLE = '参拝したら、写真1枚で\n日本地図に。';

/** 県が分からないとき（位置が取れない・近くに寺社が無い）は、どこかを名指さない */
export function firstStampCardSubtitle(prefecture: string | null): string {
  return `撮ると、${prefecture ?? 'その県'}に色が差します`;
}

export function ayumiFirstStampLine(prefecture: string | null): string {
  return `最初の1枚で、${prefecture ?? '日本地図'}に色が差します。`;
}

export function nearbySheetTitle(count: number): string {
  return `近くの寺社（${count}）`;
}
