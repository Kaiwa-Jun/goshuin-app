import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PermissionStatus } from 'expo-location';
import { useSpots } from '@hooks/useSpots';
import { useLocation } from '@hooks/useLocation';
import { fetchGsiPlaces } from '@services/placeSearch';
import { calculateDistance } from '@utils/geo';
import {
  buildSearchRows,
  hasLocalHits,
  MIN_AREA_QUERY_LENGTH,
  normalizeQuery,
  type GsiFeature,
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
  /** 一覧の言葉で第2段の答えを待っている（「見つかりませんでした」の代わりに「探しています」） */
  isSearchingPlace: boolean;
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
  const [query, setQueryState] = useState('');
  // いま入っている言葉。エンターは state の反映を待たずにこれを読む（打った直後でも、打った言葉で動く）
  const queryRef = useRef('');
  const setQuery = useCallback((text: string) => {
    queryRef.current = text;
    setQueryState(text);
  }, []);
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

  // 読み込み中は allSpots が空なので、第1段が何にも当たらない。その間に外へ問い合わせると
  // 「横浜」まで国土地理院に出てしまうので、第2段もエンターも読み終わってから
  const spotsReady = !isLoading && allSpots.length > 0;

  // 第2段の答え。言葉（そろえた形）ごとに Promise でためる（同じ言葉で2回呼ばない・打っている間と
  // エンターも1本にまとめる）。ためるのは検索画面を開いている間だけ。失敗（null）はためない
  const gsiCacheRef = useRef(new Map<string, Promise<GsiFeature[] | null>>());
  const lookupGsi = useCallback((text: string) => {
    const key = normalizeQuery(text);
    const cached = gsiCacheRef.current.get(key);
    if (cached) return cached;
    const pending = fetchGsiPlaces(text).then(features => {
      if (features === null) gsiCacheRef.current.delete(key);
      return features;
    });
    gsiCacheRef.current.set(key, pending);
    return pending;
  }, []);

  /** 第2段を呼ぶ言葉か（D-8）。名前にも地名にも1件も当たらない（絞り込みの前で数える）2 文字以上 */
  const needsGsi = useCallback(
    (text: string) =>
      spotsReady &&
      normalizeQuery(text).length >= MIN_AREA_QUERY_LENGTH &&
      !hasLocalHits(text, spotsWithDistance),
    [spotsReady, spotsWithDistance]
  );

  // 一覧の言葉（300ms 待った言葉）の第2段の答え。失敗は features: null（答えは出たが何も無い扱い）
  const [gsiResult, setGsiResult] = useState<{
    key: string;
    features: GsiFeature[] | null;
  } | null>(null);
  useEffect(() => {
    if (!needsGsi(debouncedQuery)) return;
    const key = normalizeQuery(debouncedQuery);
    // 失敗のあとの問い合わせ直しの間は、また「探しています」にする
    setGsiResult(prev => (prev?.key === key && prev.features === null ? null : prev));
    // 答えが返った時に一覧の言葉が変わっていたら（このあと effect が片付けられていたら）使わない
    let stale = false;
    lookupGsi(debouncedQuery).then(features => {
      if (!stale) setGsiResult({ key, features });
    });
    return () => {
      stale = true;
    };
  }, [debouncedQuery, needsGsi, lookupGsi]);

  const debouncedKey = normalizeQuery(debouncedQuery);
  const gsiSettled = gsiResult?.key === debouncedKey;
  const gsiFeatures = gsiSettled ? gsiResult.features : null;
  // effect を待たずに決める（待つと、問い合わせの前の1回だけ「見つかりませんでした」が出る）
  const isSearchingPlace = !gsiSettled && needsGsi(debouncedQuery);

  const rows = useMemo(
    () =>
      buildSearchRows({
        query: debouncedQuery,
        spots: spotsWithDistance,
        filterType,
        order: suggestionMode,
        gsiFeatures,
      }),
    [debouncedQuery, spotsWithDistance, filterType, suggestionMode, gsiFeatures]
  );

  const showPlaceCredit = rows.some(r => r.kind === 'place' && r.external);

  // 第2段の答えを待っている間の2回目のエンターは何もしない（二度押しで2回移らない）
  const submittingRef = useRef(false);

  // エンターは 300ms 待つ前の言葉で一覧を作り直す（待ちの間に押しても、打った言葉で動く）
  const resolveSubmit = useCallback(async (): Promise<SearchRow | null> => {
    if (!spotsReady || submittingRef.current) return null;
    const text = queryRef.current;
    let features: GsiFeature[] | null = null;
    if (needsGsi(text)) {
      submittingRef.current = true;
      try {
        features = await lookupGsi(text);
      } finally {
        submittingRef.current = false;
      }
      // 待つ間に言葉が変わったら、何もしない
      if (normalizeQuery(queryRef.current) !== normalizeQuery(text)) return null;
    }
    const submitRows = buildSearchRows({
      query: text,
      spots: spotsWithDistance,
      filterType,
      order: suggestionMode,
      gsiFeatures: features,
    });
    return submitRows[0] ?? null;
  }, [spotsReady, needsGsi, lookupGsi, spotsWithDistance, filterType, suggestionMode]);

  const clearSearch = useCallback(() => {
    queryRef.current = '';
    setQueryState('');
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
    isSearchingPlace,
    resolveSubmit,
    filterType,
    setFilterType,
    clearSearch,
    suggestedSpots,
    suggestionMode,
  };
}
