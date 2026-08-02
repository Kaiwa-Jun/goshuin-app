import { useCallback, useMemo } from 'react';

import type { Spot } from '@/types/supabase';
import type { MapRegion } from '@utils/spotSelection';
import {
  CLUSTER_MAX_ZOOM,
  buildClusterView,
  createClusterIndex,
  getDeltaFromZoom,
  selectPinnedSpots,
  type ClusterView,
  type SpotCluster,
} from '@utils/spotClustering';

interface UseSpotClustersParams {
  spots: Spot[];
  region: MapRegion | null;
  visitedSpotIds: Set<string>;
  wishlistSpotIds: Set<string>;
}

interface UseSpotClustersResult {
  clusters: SpotCluster[];
  individualSpots: Spot[];
  /** クラスタタップ時のズームイン先 region を返す */
  getClusterExpansionRegion: (cluster: SpotCluster) => MapRegion;
}

/**
 * 地図に描画するクラスタバブルと個別スポットを算出する。
 * index の構築（supercluster の load）は spots / visited / wishlist が
 * 変わったときだけ行い、region 変化では再構築しない（負荷削減の核心）。
 * pinned（訪問済み・行きたい）は index に載せず常に個別表示する
 */
export function useSpotClusters({
  spots,
  region,
  visitedSpotIds,
  wishlistSpotIds,
}: UseSpotClustersParams): UseSpotClustersResult {
  const clusterableSpots = useMemo(
    () => spots.filter(s => !visitedSpotIds.has(s.id) && !wishlistSpotIds.has(s.id)),
    [spots, visitedSpotIds, wishlistSpotIds]
  );

  const index = useMemo(() => createClusterIndex(clusterableSpots), [clusterableSpots]);

  const spotById = useMemo(() => new Map(clusterableSpots.map(s => [s.id, s])), [clusterableSpots]);

  const pinnedSpots = useMemo(
    () => selectPinnedSpots({ spots, region, visitedSpotIds, wishlistSpotIds }),
    [spots, region, visitedSpotIds, wishlistSpotIds]
  );

  const view = useMemo<ClusterView>(
    () =>
      region
        ? buildClusterView({ index, spotById, region, pinnedSpots })
        : { clusters: [], individualSpots: pinnedSpots },
    [index, spotById, region, pinnedSpots]
  );

  const getClusterExpansionRegion = useCallback(
    (cluster: SpotCluster): MapRegion => {
      const zoom = Math.min(index.getClusterExpansionZoom(cluster.clusterId), CLUSTER_MAX_ZOOM + 1);
      const delta = getDeltaFromZoom(zoom);
      return {
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      };
    },
    [index]
  );

  return {
    clusters: view.clusters,
    individualSpots: view.individualSpots,
    getClusterExpansionRegion,
  };
}
