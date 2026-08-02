import Supercluster from 'supercluster';
import type { Spot } from '@/types/supabase';
import { calculateDistance } from '@utils/geo';
import { selectVisibleSpots, VIEWPORT_MARGIN, type MapRegion } from '@utils/spotSelection';

/** supercluster のクラスタ半径（px 相当。既定 40 より広げて団子化を強める） */
export const CLUSTER_RADIUS = 60;
/** supercluster のタイル extent（既定値） */
export const CLUSTER_EXTENT = 512;
/** クラスタを構成する最小点数（既定値。2 点でも団子化してネイティブビューを減らす） */
export const CLUSTER_MIN_POINTS = 2;
/** クラスタを生成する最小ズーム */
export const CLUSTER_MIN_ZOOM = 0;
/**
 * クラスタを生成する最大ズーム。これを超えるズームでは全点が個別描画される。
 * クラスタ化開始が longitudeDelta ≈ 0.031（初期 delta 0.015 の約2倍）になるよう選んだ値。
 * 初期ズームに閾値を近づけると #93 のチラつき問題が再発する
 */
export const CLUSTER_MAX_ZOOM = 13;

/** 同時に描画するクラスタバブルの上限 */
export const MAX_CLUSTER_BUBBLES = 40;
/** 同時に描画する個別スポットピンの上限（pinned を除く） */
export const MAX_INDIVIDUAL_SPOTS = 60;
/** 同時に描画する pinned（訪問済み・行きたい）ピンの上限 */
export const MAX_PINNED_SPOTS = 30;
/** 地図上のマーカー総数の上限 = 40 + 60 + 30 */
export const MAX_TOTAL_MARKERS = MAX_CLUSTER_BUBBLES + MAX_INDIVIDUAL_SPOTS + MAX_PINNED_SPOTS;

/** supercluster に載せる点のプロパティ */
export interface ClusterPointProps {
  spotId: string;
}

export interface SpotCluster {
  /**
   * Marker の testID / key に使う識別子（`cluster-<先頭 leaf の spotId>`）。
   * cluster_id はマージのたびに変わるが、先頭 leaf はマージ後も引き継がれる
   * ため、ズームをまたいでも生き残る系譜のバブルは remount されない
   */
  id: string;
  /** supercluster の cluster_id。展開ズームの取得に使う */
  clusterId: number;
  latitude: number;
  longitude: number;
  /** クラスタに含まれるスポット数（バブルに表示する数字） */
  count: number;
}

export interface ClusterView {
  clusters: SpotCluster[];
  individualSpots: Spot[];
}

export type SpotClusterIndex = Supercluster<ClusterPointProps>;

const EMPTY_IDS = new Set<string>();

/** ズームレベル換算。longitudeDelta が小さいほど zoom が大きい（0〜20 にクランプ） */
export function getZoomFromRegion(region: MapRegion): number {
  const delta = Math.max(region.longitudeDelta, 1e-6);
  const zoom = Math.round(Math.log2(360 / delta));
  return Math.min(20, Math.max(0, zoom));
}

/** getZoomFromRegion の逆変換。整数 zoom について往復整合する */
export function getDeltaFromZoom(zoom: number): number {
  return 360 / 2 ** zoom;
}

/**
 * region をマージン込みの [west, south, east, north] bbox に変換する。
 * selectVisibleSpots のビューポート判定と同じ矩形（VIEWPORT_MARGIN 適用）になる
 */
export function regionToBBox(region: MapRegion): [number, number, number, number] {
  const halfLat = (region.latitudeDelta / 2) * VIEWPORT_MARGIN;
  const halfLng = (region.longitudeDelta / 2) * VIEWPORT_MARGIN;
  return [
    Math.max(-180, region.longitude - halfLng),
    Math.max(-90, region.latitude - halfLat),
    Math.min(180, region.longitude + halfLng),
    Math.min(90, region.latitude + halfLat),
  ];
}

/** 中心距離昇順 → id 昇順で maxCount 件を返す。入力配列は破壊しない */
export function takeNearest(spots: Spot[], region: MapRegion, maxCount: number): Spot[] {
  const scored = spots.map(spot => ({
    spot,
    distance: calculateDistance(region.latitude, region.longitude, spot.lat, spot.lng),
  }));

  scored.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.spot.id < b.spot.id ? -1 : a.spot.id > b.spot.id ? 1 : 0;
  });

  return scored.slice(0, maxCount).map(s => s.spot);
}

/**
 * ビューポート内の pinned（訪問済み・行きたい）スポットを抽出する。
 * selectVisibleSpots の maxCount: 0 は「残り枠 0 = pinned のみを返す」に相当。
 * pinned は「自分の記録」なので rank ではなく近い順で maxCount 件に絞る
 */
export function selectPinnedSpots({
  spots,
  region,
  visitedSpotIds,
  wishlistSpotIds,
  maxCount = MAX_PINNED_SPOTS,
}: {
  spots: Spot[];
  region: MapRegion | null;
  visitedSpotIds: Set<string>;
  wishlistSpotIds: Set<string>;
  maxCount?: number;
}): Spot[] {
  const pinned = selectVisibleSpots({
    spots,
    region,
    visitedSpotIds,
    wishlistSpotIds,
    maxCount: 0,
  });

  if (!region) {
    return [...pinned].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, maxCount);
  }

  return takeNearest(pinned, region, maxCount);
}

/**
 * クラスタ index を構築する。渡すのはクラスタ対象のスポットのみ
 * （pinned は呼び出し側で除外済み。載せるとクラスタに吸収されてしまう）
 */
export function createClusterIndex(spots: Spot[]): SpotClusterIndex {
  const index = new Supercluster<ClusterPointProps>({
    radius: CLUSTER_RADIUS,
    extent: CLUSTER_EXTENT,
    minPoints: CLUSTER_MIN_POINTS,
    minZoom: CLUSTER_MIN_ZOOM,
    maxZoom: CLUSTER_MAX_ZOOM,
  });
  index.load(
    spots.map(spot => ({
      type: 'Feature' as const,
      properties: { spotId: spot.id },
      geometry: { type: 'Point' as const, coordinates: [spot.lng, spot.lat] },
    }))
  );
  return index;
}

type ClusterOrPointFeature = ReturnType<SpotClusterIndex['getClusters']>[number];

function isClusterFeature(
  feature: ClusterOrPointFeature
): feature is Supercluster.ClusterFeature<Supercluster.AnyProps> {
  return 'cluster' in feature.properties && feature.properties.cluster === true;
}

/**
 * region に対して描画すべきクラスタバブルと個別スポットを求める。
 * クラスタは count 降順 → clusterId 昇順で MAX_CLUSTER_BUBBLES 件、
 * クラスタに吸収されなかった単独点は selectVisibleSpots（#96 の rank 優先）で
 * MAX_INDIVIDUAL_SPOTS 件に絞る。マーカー総数は常に MAX_TOTAL_MARKERS 以下
 */
export function buildClusterView({
  index,
  spotById,
  region,
  pinnedSpots,
}: {
  index: SpotClusterIndex;
  spotById: Map<string, Spot>;
  region: MapRegion;
  pinnedSpots: Spot[];
}): ClusterView {
  const zoom = getZoomFromRegion(region);
  const bbox = regionToBBox(region);
  const features = index.getClusters(bbox, zoom);

  const rawClusters: Omit<SpotCluster, 'id'>[] = [];
  const singles: Spot[] = [];
  for (const feature of features) {
    if (isClusterFeature(feature)) {
      rawClusters.push({
        clusterId: feature.properties.cluster_id as number,
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
        count: feature.properties.point_count as number,
      });
    } else {
      const spot = spotById.get((feature.properties as ClusterPointProps).spotId);
      if (spot) singles.push(spot);
    }
  }

  rawClusters.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.clusterId - b.clusterId;
  });

  // 先頭 leaf 由来の安定 id は top-N 確定後の最大 MAX_CLUSTER_BUBBLES 件にだけ付ける
  const clusters: SpotCluster[] = rawClusters.slice(0, MAX_CLUSTER_BUBBLES).map(raw => {
    const leaf = index.getLeaves(raw.clusterId, 1)[0];
    const leafId = leaf ? (leaf.properties as ClusterPointProps).spotId : String(raw.clusterId);
    return { ...raw, id: `cluster-${leafId}` };
  });

  const individualSingles = selectVisibleSpots({
    spots: singles,
    region,
    visitedSpotIds: EMPTY_IDS,
    wishlistSpotIds: EMPTY_IDS,
    maxCount: MAX_INDIVIDUAL_SPOTS,
  });

  return {
    clusters,
    individualSpots: [...pinnedSpots, ...individualSingles],
  };
}
