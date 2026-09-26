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

import {
  LABEL_PAINT,
  PIN_LAYOUT,
  RANKED_PIN_LAYOUT,
  VISIBLE_SPOT_FILTER,
  SpotPinImages,
} from '@components/map/spotPins';
import { colors } from '@theme/colors';
import type { SpotFeatureCollection } from '@utils/spotGeoJson';

/**
 * 団子化を打ち切るズーム。これより寄ると必ず1件1ピンで出る。
 * spotPins の VISIBLE_SPOT_FILTER の下限と揃えてある（片方を動かすときは両方見る）
 */
export const CLUSTER_MAX_ZOOM = 11;
/** 団子を作る最小件数。4件以下はまとめず、その場にピンで出す */
export const CLUSTER_MIN_POINTS = 5;
/** 団子半径(px)。MapLibre のクラスタリング既定値。「実際に重なる距離」とほぼ一致する */
export const CLUSTER_RADIUS = 50;

const IS_CLUSTER: FilterSpecification = ['has', 'point_count'];

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
  /** 薄く出す（予定の順番を見ているとき、選んでいない寺社。Issue #258 D-21） */
  dimmed?: boolean;
}

/** 予定の順番を見ているときの、選んでいない寺社の濃さ */
export const DIMMED_OPACITY = 0.45;

type SourcePress = NativeSyntheticEvent<PressEventWithFeatures>;

/**
 * スポットを地図に描く。ピン1件 = ネイティブビュー1枚ではなく、
 * GeoJSON ソース2本 + スタイルレイヤで GPU に描かせる。
 *
 * - ピンは衝突しても必ず描く = **常に全件見える**
 * - 名前は重なったら間引かれる。残す順は rank 降順
 * - 団子はズーム CLUSTER_MAX_ZOOM 以下かつ CLUSTER_MIN_POINTS 件以上のときだけ
 * - 訪問済み・行きたいは団子に入れない（ソースを分ける）。
 *   先に宣言してあるのはラベルの配置優先度を取るため
 */
export function SpotMapLayers({
  clustered,
  pinned,
  onPressSpot,
  onPressCluster,
  dimmed = false,
}: Props) {
  const pinPaint = dimmed
    ? { ...LABEL_PAINT, 'icon-opacity': DIMMED_OPACITY, 'text-opacity': DIMMED_OPACITY }
    : LABEL_PAINT;
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
      <SpotPinImages />

      {/* 自分の記録。団子に吸収させない。ラベルの配置もこちらが先に取る */}
      <GeoJSONSource id="goshuin-pinned" data={pinned} onPress={handlePinnedPress}>
        <Layer id="goshuin-pinned-pin" type="symbol" layout={PIN_LAYOUT} paint={pinPaint} />
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
        <Layer
          id="goshuin-spot-pin"
          type="symbol"
          filter={VISIBLE_SPOT_FILTER}
          layout={RANKED_PIN_LAYOUT}
          paint={pinPaint}
        />
      </GeoJSONSource>
    </>
  );
}
