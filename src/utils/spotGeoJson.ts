import type { Spot } from '@/types/supabase';

/**
 * ピンの状態。色分けとラベルの優先度に使う。
 * 地図側（MapLibre）はこの文字列を match 式で色に変換する
 */
export type SpotPinState = 'visited-shrine' | 'visited-temple' | 'wishlist' | 'unvisited';

/** GeoJSON Feature の properties。地図のスタイル式から参照される */
export interface SpotFeatureProperties {
  spotId: string;
  name: string;
  /** 0〜5。ラベルの表示優先度（symbol-sort-key）に使う */
  rank: number;
  state: SpotPinState;
}

export interface SpotFeature {
  type: 'Feature';
  properties: SpotFeatureProperties;
  geometry: { type: 'Point'; coordinates: [number, number] };
}

export interface SpotFeatureCollection {
  type: 'FeatureCollection';
  features: SpotFeature[];
}

export interface SpotSources {
  /** 団子化の対象。未訪問のみ */
  clustered: SpotFeatureCollection;
  /** 団子に吸収させない。訪問済み・行きたい（= 自分の記録） */
  pinned: SpotFeatureCollection;
}

const EMPTY: SpotFeatureCollection = { type: 'FeatureCollection', features: [] };

export function getSpotPinState(
  spot: Spot,
  visitedSpotIds: Set<string>,
  wishlistSpotIds: Set<string>
): SpotPinState {
  if (visitedSpotIds.has(spot.id)) {
    return spot.type === 'shrine' ? 'visited-shrine' : 'visited-temple';
  }
  if (wishlistSpotIds.has(spot.id)) return 'wishlist';
  return 'unvisited';
}

function toFeature(spot: Spot, state: SpotPinState): SpotFeature {
  return {
    type: 'Feature',
    properties: { spotId: spot.id, name: spot.name, rank: spot.rank, state },
    geometry: { type: 'Point', coordinates: [spot.lng, spot.lat] },
  };
}

/** スポットを1本の FeatureCollection にする（団子化しない地図向け） */
export function toSpotFeatureCollection({
  spots,
  visitedSpotIds,
  wishlistSpotIds,
}: {
  spots: Spot[];
  visitedSpotIds: Set<string>;
  wishlistSpotIds: Set<string>;
}): SpotFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: spots.map(spot =>
      toFeature(spot, getSpotPinState(spot, visitedSpotIds, wishlistSpotIds))
    ),
  };
}

/**
 * スポットを地図の2つのソースに振り分ける。
 *
 * 描画件数の上限もビューポートによる絞り込みも掛けない。GL は点をビューでは
 * なくレイヤとして描くので、全件渡して重なりの解決はネイティブに任せる
 * （react-native-maps 時代の MAX_TOTAL_MARKERS = 130 はこのために存在した）。
 *
 * 入力配列は破壊しない。同一入力に対する結果は決定的。
 */
export function buildSpotSources({
  spots,
  visitedSpotIds,
  wishlistSpotIds,
}: {
  spots: Spot[];
  visitedSpotIds: Set<string>;
  wishlistSpotIds: Set<string>;
}): SpotSources {
  if (spots.length === 0) return { clustered: EMPTY, pinned: EMPTY };

  const clustered: SpotFeature[] = [];
  const pinned: SpotFeature[] = [];

  for (const spot of spots) {
    const state = getSpotPinState(spot, visitedSpotIds, wishlistSpotIds);
    (state === 'unvisited' ? clustered : pinned).push(toFeature(spot, state));
  }

  return {
    clustered: { type: 'FeatureCollection', features: clustered },
    pinned: { type: 'FeatureCollection', features: pinned },
  };
}

/** 1点だけの FeatureCollection（現在地マーカー用） */
export function pointCollection(
  coords: { latitude: number; longitude: number } | null
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  if (!coords) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [coords.longitude, coords.latitude] },
      },
    ],
  };
}
