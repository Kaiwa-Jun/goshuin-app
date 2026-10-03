import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PermissionStatus } from 'expo-location';
import { useSpots } from '@hooks/useSpots';
import { useLocation } from '@hooks/useLocation';
import { calculateDistance } from '@utils/geo';
import {
  buildSearchRows,
  type SearchOrder,
  type SearchRow,
  type SpotTypeFilter,
  type SpotWithDistance,
} from '@utils/placeSearch';

export type SuggestionMode = SearchOrder;

/** 未入力時に提案するスポットの最大件数 */
export const MAX_SUGGESTED_SPOTS = 10;

export interface UseSearchScreenReturn {
  query: string;
  setQuery: (text: string) => void;
  /** 一覧の行（Issue #311）。並びは buildSearchRows の決まり（いちばん上がエンターの行き先） */
  rows: SearchRow[];
  /** 一覧に第2段（外の地名検索）の場所の行があるか。出典を出す */
  showPlaceCredit: boolean;
  /** いま入っている言葉で、一覧のいちばん上の行。何もしないなら null */
  resolveSubmit: () => Promise<SearchRow | null>;
  filterType: SpotTypeFilter;
  setFilterType: (type: SpotTypeFilter) => void;
  clearSearch: () => void;
  suggestedSpots: SpotWithDistance[];
  suggestionMode: SuggestionMode;
}

const DEBOUNCE_MS = 300;

export function useSearchScreen(): UseSearchScreenReturn {
  const { location, permissionStatus } = useLocation();
  const { allSpots, isLoading } = useSpots(location, 'all', new Set());
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterType, setFilterType] = useState<SpotTypeFilter>('all');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  // permissionStatus が GRANTED でない場合、location は DEFAULT_LOCATION の
  // フォールバック値なので、実際の現在地として扱わない（popular モードに落とす）
  const suggestionMode: SuggestionMode =
    permissionStatus === PermissionStatus.GRANTED ? 'nearby' : 'popular';

  const spotsWithDistance = useMemo(() => {
    if (!location) return allSpots.map(spot => ({ spot, distance: 0 }));
    return allSpots
      .map(spot => ({
        spot,
        distance: calculateDistance(location.latitude, location.longitude, spot.lat, spot.lng),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [allSpots, location]);

  const rows = useMemo(
    () =>
      buildSearchRows({
        query: debouncedQuery,
        spots: spotsWithDistance,
        filterType,
        order: suggestionMode,
      }),
    [debouncedQuery, spotsWithDistance, filterType, suggestionMode]
  );

  const showPlaceCredit = rows.some(r => r.kind === 'place' && r.external);

  // エンターは 300ms 待つ前の言葉で一覧を作り直す（待ちの間に押しても、打った言葉で動く）
  const resolveSubmit = useCallback(async (): Promise<SearchRow | null> => {
    if (isLoading || allSpots.length === 0) return null;
    const submitRows = buildSearchRows({
      query,
      spots: spotsWithDistance,
      filterType,
      order: suggestionMode,
    });
    return submitRows[0] ?? null;
  }, [isLoading, allSpots, query, spotsWithDistance, filterType, suggestionMode]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setFilterType('all');
  }, []);

  const suggestedSpots = useMemo(() => {
    if (suggestionMode === 'nearby') {
      return spotsWithDistance.slice(0, MAX_SUGGESTED_SPOTS);
    }
    return [...allSpots]
      .sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id))
      .slice(0, MAX_SUGGESTED_SPOTS)
      .map(spot => ({ spot, distance: 0 }));
  }, [suggestionMode, spotsWithDistance, allSpots]);

  return {
    query,
    setQuery,
    rows,
    showPlaceCredit,
    resolveSubmit,
    filterType,
    setFilterType,
    clearSearch,
    suggestedSpots,
    suggestionMode,
  };
}
