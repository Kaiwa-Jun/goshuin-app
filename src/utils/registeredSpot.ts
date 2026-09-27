import { calculateDistance } from '@utils/geo';
import { normalizeSpotName } from '@utils/spotName';

/**
 * 同じ寺社とみなす距離。add-spot の重複の判定（Issue #248 の D-7。addSpot.ts）と同じ
 * （supabase/functions/_shared/spotRules.ts の NEARBY_METERS。Deno 形式の import があるので読み込まない）
 */
export const REGISTERED_SPOT_METERS = 300;

/**
 * 調べた候補と同じ寺社（Issue #278）。正規化した名前が一致し、300m 以内のもの。複数なら近いほう。無ければ null。
 * add-spot の重複の判定と同じ規則にしているので、ここで当たった候補は add-spot に送っても既存が返る。
 * 似た名前（isSimilarName）では比べない。浅草神社と浅草寺のように別の寺社に当たる
 */
export function findRegisteredSpot<T extends { name: string; lat: number; lng: number }>(
  candidate: { name: string; lat: number; lng: number },
  spots: readonly T[]
): T | null {
  const name = normalizeSpotName(candidate.name);
  let found: T | null = null;
  let foundMeters = Infinity;
  for (const spot of spots) {
    if (normalizeSpotName(spot.name) !== name) continue;
    const meters = calculateDistance(candidate.lat, candidate.lng, spot.lat, spot.lng) * 1000;
    if (meters <= REGISTERED_SPOT_METERS && meters < foundMeters) {
      found = spot;
      foundMeters = meters;
    }
  }
  return found;
}
