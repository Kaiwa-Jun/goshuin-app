import React from 'react';
import { Marker } from 'react-native-maps';

import { getClusterBucket, type SpotCluster } from '@utils/spotClustering';

/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * バケットキー → 事前レンダリング済みバブル画像。
 * UIView 子ビューのスナップショット機構（mount/redraw のたびにネイティブ
 * メモリを消費し、実機の Jetsam クラッシュの原因になった）を避けるため、
 * バブルは Marker の image prop で描画する（#99 追補2）
 */
export const CLUSTER_BUBBLE_IMAGES: Record<string, number> = {
  '2': require('../../../assets/cluster-bubbles/bubble_2.png'),
  '3': require('../../../assets/cluster-bubbles/bubble_3.png'),
  '4': require('../../../assets/cluster-bubbles/bubble_4.png'),
  '5': require('../../../assets/cluster-bubbles/bubble_5.png'),
  '6': require('../../../assets/cluster-bubbles/bubble_6.png'),
  '7': require('../../../assets/cluster-bubbles/bubble_7.png'),
  '8': require('../../../assets/cluster-bubbles/bubble_8.png'),
  '9': require('../../../assets/cluster-bubbles/bubble_9.png'),
  '10p': require('../../../assets/cluster-bubbles/bubble_10p.png'),
  '50p': require('../../../assets/cluster-bubbles/bubble_50p.png'),
  '100p': require('../../../assets/cluster-bubbles/bubble_100p.png'),
  '500p': require('../../../assets/cluster-bubbles/bubble_500p.png'),
  '1000p': require('../../../assets/cluster-bubbles/bubble_1000p.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

interface ClusterMarkerProps {
  cluster: SpotCluster;
  onPress: (cluster: SpotCluster) => void;
}

/**
 * クラスタバブルの Marker。key（cluster.id）は leaf 由来で安定、描画は
 * 事前レンダリング画像なので、バケットが変わらない限りネイティブ更新ゼロ。
 * バケット遷移も setImage のみで UIView の再スナップショットは発生しない
 */
export const ClusterMarker = React.memo(function ClusterMarker({
  cluster,
  onPress,
}: ClusterMarkerProps) {
  const bucket = getClusterBucket(cluster.count);
  return (
    <Marker
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      testID={`cluster-marker-${cluster.id}`}
      onPress={() => onPress(cluster)}
      anchor={{ x: 0.5, y: 0.5 }}
      image={CLUSTER_BUBBLE_IMAGES[bucket.key]}
    />
  );
});
