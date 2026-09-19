import React, { useCallback, useRef } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type {
  CircleLayerSpecification,
  FilterSpecification,
  GeoJSONSourceRef,
  PressEventWithFeatures,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-react-native';

import { colors } from '@theme/colors';
import type { SpotFeatureCollection } from '@utils/spotGeoJson';

/** 団子化を打ち切るズーム。これより寄ると必ず1件1点で出る */
export const CLUSTER_MAX_ZOOM = 11;
/** 団子を作る最小件数。4件以下はまとめず、その場にピンで出す */
export const CLUSTER_MIN_POINTS = 5;
/** 団子半径(px)。supercluster の既定値。「実際に重なる距離」とほぼ一致する */
export const CLUSTER_RADIUS = 50;

const IS_CLUSTER: FilterSpecification = ['has', 'point_count'];
const IS_SPOT: FilterSpecification = ['!', ['has', 'point_count']];

/** state → ピンの色。値は src/theme/colors.ts の pin トークン */
function dotPaint(strokeWidth: number): CircleLayerSpecification['paint'] {
  return {
    // ズームに応じた点の大きさ。寄るほど大きく
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3.5, 12, 5, 16, 7.5],
    'circle-color': [
      'match',
      ['get', 'state'],
      'visited-shrine',
      colors.pin.shrineVisited,
      'visited-temple',
      colors.pin.templeVisited,
      'wishlist',
      colors.pin.wishlisted,
      colors.pin.unvisited,
    ],
    'circle-stroke-width': strokeWidth,
    'circle-stroke-color': colors.white,
  };
}

const LABEL_LAYOUT: SymbolLayerSpecification['layout'] = {
  'text-field': ['get', 'name'],
  'text-font': ['Noto Sans Bold'],
  'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 13],
  // 点の周りの空いている側に寄せる。4方向とも塞がっていれば諦める
  'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
  'text-radial-offset': 0.9,
  'text-justify': 'auto',
  // 重なったら描かない = これが「団子にしなくても潰れない」理由
  'text-allow-overlap': false,
  'text-ignore-placement': false,
  'text-padding': 3,
  'text-max-width': 8,
};

/** rank が高いものほど先に置かれる（小さい sort key が優先） */
const SPOT_LABEL_LAYOUT: SymbolLayerSpecification['layout'] = {
  ...LABEL_LAYOUT,
  'symbol-sort-key': ['-', 10, ['get', 'rank']],
};

const LABEL_PAINT: SymbolLayerSpecification['paint'] = {
  'text-color': colors.gray[800],
  'text-halo-color': colors.white,
  'text-halo-width': 1.5,
};

const CLUSTER_PAINT: CircleLayerSpecification['paint'] = {
  'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 24, 100, 28],
  'circle-color': colors.primary[500],
  'circle-stroke-width': 2.5,
  'circle-stroke-color': colors.white,
};

const CLUSTER_COUNT_LAYOUT: SymbolLayerSpecification['layout'] = {
  'text-field': ['get', 'point_count_abbreviated'],
  'text-font': ['Noto Sans Bold'],
  'text-size': 13,
  'text-allow-overlap': true,
};

interface Props {
  clustered: SpotFeatureCollection;
  pinned: SpotFeatureCollection;
  onPressSpot: (spotId: string) => void;
  onPressCluster: (center: [number, number], expansionZoom: number) => void;
}

type SourcePress = NativeSyntheticEvent<PressEventWithFeatures>;

/**
 * スポットを地図に描く。ピン1件 = ネイティブビュー1枚ではなく、
 * GeoJSON ソース2本 + スタイルレイヤで GPU に描かせる。
 *
 * - 点（CircleLayer）は衝突判定の対象外なので **常に全件見える**
 * - 名前（SymbolLayer）は重なったら間引かれる。残す順は rank 降順
 * - 団子はズーム CLUSTER_MAX_ZOOM 以下かつ CLUSTER_MIN_POINTS 件以上のときだけ
 * - 訪問済み・行きたいは団子に入れない（ソースを分ける）。
 *   先に宣言してあるのはラベルの配置優先度を取るため
 */
export function SpotMapLayers({ clustered, pinned, onPressSpot, onPressCluster }: Props) {
  const spotsSourceRef = useRef<GeoJSONSourceRef>(null);

  const handlePinnedPress = useCallback(
    (event: SourcePress) => {
      const spotId = event.nativeEvent.features[0]?.properties?.spotId;
      if (typeof spotId === 'string') onPressSpot(spotId);
    },
    [onPressSpot]
  );

  const handleClusteredPress = useCallback(
    (event: SourcePress) => {
      const feature = event.nativeEvent.features[0];
      const props = feature?.properties;
      if (!props) return;
      if (typeof props.spotId === 'string') {
        onPressSpot(props.spotId);
        return;
      }
      // 団子タップ: 中身がばらけるズームを supercluster に聞いてから寄せる
      const clusterId = props.cluster_id;
      if (typeof clusterId !== 'number') return;
      const center = event.nativeEvent.lngLat;
      void spotsSourceRef.current
        ?.getClusterExpansionZoom(clusterId)
        .then(zoom => onPressCluster(center, zoom))
        .catch(() => onPressCluster(center, CLUSTER_MAX_ZOOM + 1));
    },
    [onPressCluster, onPressSpot]
  );

  return (
    <>
      {/* 自分の記録。団子に吸収させない。ラベルの配置もこちらが先に取る */}
      <GeoJSONSource id="goshuin-pinned" data={pinned} onPress={handlePinnedPress}>
        <Layer id="goshuin-pinned-dot" type="circle" paint={dotPaint(2)} />
        <Layer id="goshuin-pinned-label" type="symbol" layout={LABEL_LAYOUT} paint={LABEL_PAINT} />
      </GeoJSONSource>

      {/* 未訪問。広域だけ団子にする */}
      <GeoJSONSource
        ref={spotsSourceRef}
        id="goshuin-spots"
        data={clustered}
        cluster
        clusterRadius={CLUSTER_RADIUS}
        clusterMaxZoom={CLUSTER_MAX_ZOOM}
        clusterMinPoints={CLUSTER_MIN_POINTS}
        onPress={handleClusteredPress}
      >
        <Layer
          id="goshuin-cluster-bubble"
          type="circle"
          filter={IS_CLUSTER}
          paint={CLUSTER_PAINT}
        />
        <Layer
          id="goshuin-cluster-count"
          type="symbol"
          filter={IS_CLUSTER}
          layout={CLUSTER_COUNT_LAYOUT}
          paint={{ 'text-color': colors.white }}
        />
        <Layer id="goshuin-spot-dot" type="circle" filter={IS_SPOT} paint={dotPaint(1.5)} />
        <Layer
          id="goshuin-spot-label"
          type="symbol"
          filter={IS_SPOT}
          layout={SPOT_LABEL_LAYOUT}
          paint={LABEL_PAINT}
        />
      </GeoJSONSource>
    </>
  );
}
