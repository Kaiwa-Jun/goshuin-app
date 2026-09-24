// 規則の実装は Edge Function と共用（supabase/functions/_shared/spotName.ts）。Issue #248
import { isSimilarName, normalizeSpotName } from '../../supabase/functions/_shared/spotName';

export {
  coreSpotName,
  guessTypeFromName,
  isSimilarName,
  normalizeSpotName,
  typeConflicts,
} from '../../supabase/functions/_shared/spotName';

const DID_YOU_MEAN_MAX = 3;

/**
 * 「もしかして」。並び順（近い順）のまま、似た名前を最大3件。
 * 距離では絞らない（承認デザインが 228km 先の鹿島神宮を出している / D-5）
 */
export function didYouMean<T extends { spot: { id: string; name: string } }>(
  query: string,
  items: T[],
  excludeIds: Set<string>
): T[] {
  const q = normalizeSpotName(query);
  return items
    .filter(
      i =>
        !excludeIds.has(i.spot.id) &&
        normalizeSpotName(i.spot.name) !== q &&
        isSimilarName(query, i.spot.name)
    )
    .slice(0, DID_YOU_MEAN_MAX);
}
