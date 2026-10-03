import React, { useCallback } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';
import type {
  FilterSpecification,
  PressEventWithFeatures,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-react-native';

import { colors } from '@theme/colors';
import type { SpotFeatureCollection } from '@utils/spotGeoJson';

/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * ピン画像。旧 SpotMarker と同じ形（丸頭 + 白フチ + 尾 + 影）。
 * 色を変えたら `npm run gen:map-pins` で焼き直す（src/theme/colors.ts が元）。
 * UIView ではなくスタイルのアイコンなので、何枚出しても描画コストは変わらない
 */
const PIN_IMAGES = {
  'spot-pin-unvisited': require('../../../assets/map-pins/pin-unvisited.png'),
  'spot-pin-wishlist': require('../../../assets/map-pins/pin-wishlist.png'),
  'spot-pin-visited-shrine': require('../../../assets/map-pins/pin-visited-shrine.png'),
  'spot-pin-visited-temple': require('../../../assets/map-pins/pin-visited-temple.png'),
  // 予定を組む画面で選んだピンに重ねる印（Issue #258 D-13）。ピンと同じ大きさの画像
  'spot-pin-chosen-check': require('../../../assets/map-pins/pin-chosen-check.png'),
  'spot-pin-chosen-ring': require('../../../assets/map-pins/pin-chosen-ring.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** ピン画像を地図に登録する。ピンを描く地図には必ず1つ置く */
export function SpotPinImages() {
  return <Images images={PIN_IMAGES} />;
}

/** ピンの大きさ（ズームで変える）。予定で選んだピンはこれに倍率を掛ける */
type SymbolLayout = NonNullable<SymbolLayerSpecification['layout']>;

export function pinIconSize(scale = 1): SymbolLayout['icon-size'] {
  return ['interpolate', ['linear'], ['zoom'], 8, 0.2 * scale, 12, 0.26 * scale, 16, 0.32 * scale];
}

/** ピンの色（状態ごとの画像） */
export const PIN_IMAGE_BY_STATE: SymbolLayout['icon-image'] = [
  'match',
  ['get', 'state'],
  'visited-shrine',
  'spot-pin-visited-shrine',
  'visited-temple',
  'spot-pin-visited-temple',
  'wishlist',
  'spot-pin-wishlist',
  'spot-pin-unvisited',
];

const ICON_LAYOUT: SymbolLayerSpecification['layout'] = {
  'icon-image': [
    'match',
    ['get', 'state'],
    'visited-shrine',
    'spot-pin-visited-shrine',
    'visited-temple',
    'spot-pin-visited-temple',
    'wishlist',
    'spot-pin-wishlist',
    'spot-pin-unvisited',
  ],
  'icon-anchor': 'bottom',
  'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.2, 12, 0.26, 16, 0.32],
  // ピンは重なっても必ず描く = 全件見える
  'icon-allow-overlap': true,
  // 名前はピンを避けて置かれる
  'icon-ignore-placement': false,
};

/**
 * ピン + 名前を1枚のレイヤで出す。
 * `text-optional: true` で「名前が置けなければ名前だけ諦めてピンは残す」になる
 */
export const PIN_LAYOUT: SymbolLayerSpecification['layout'] = {
  ...ICON_LAYOUT,
  'text-field': ['get', 'name'],
  'text-font': ['Noto Sans Bold'],
  'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 13],
  'text-anchor': 'top',
  'text-offset': [0, 0.25],
  'text-allow-overlap': false,
  'text-optional': true,
  'text-padding': 3,
  'text-max-width': 8,
};

/**
 * ズームに応じて出すランクを絞る。寄るほど下のランクまで出す。
 *
 * 全件を常に出すと、団子化しない帯（z12〜13）で画面が埋まる。実機で仙台の
 * z12.5 を測ると 24 件が同時に乗っていた（このしきい値で 5 件になる）。
 *
 * 段階は実機で測って決めた。1段きつくすると同じ条件で 2 件まで落ち、
 * 市街地からピンがほぼ消えて「壊れている」ように見える。
 *
 * これは #93 にあった「ズームアウト = rank カット」を戻したもの。#96 で
 * ビューポート top-N（react-native-maps のクラッシュ回避）に置き換えられて
 * 消えたが、top-N 自体が MapLibre 移行で不要になったため、意図的な間引きだけ
 * を改めて入れ直している。
 *
 * 下限の 11 は SpotMapLayers の CLUSTER_MAX_ZOOM と揃えてある。そこより引くと
 * 団子になるので、素のピンが出るのはこの段階より寄ったときだけ。片方を動かす
 * ときはもう片方も見ること。
 *
 * 自分の記録（訪問済み・行きたい）には掛けない。#93 の除外規定を引き継ぐ。
 *
 * 変数を合成せず1つのリテラルで書いているのは、FilterSpecification が旧形式の
 * 配列を含む union で、部品に分けると ['all', ...] に入れ子にできなくなるため
 */
export const VISIBLE_SPOT_FILTER: FilterSpecification = [
  'all',
  // 団子にまとまっていない1件だけ
  ['!', ['has', 'point_count']],
  // 今のズームで出すランクに達しているもの
  ['>=', ['get', 'rank'], ['step', ['zoom'], 5, 11, 4, 12.5, 3, 14, 1]],
];

/** rank が高いものほど先に置かれる（小さい sort key が優先） */
export const RANKED_PIN_LAYOUT: SymbolLayerSpecification['layout'] = {
  ...PIN_LAYOUT,
  'symbol-sort-key': ['-', 10, ['get', 'rank']],
};

export const LABEL_PAINT: SymbolLayerSpecification['paint'] = {
  'text-color': colors.gray[800],
  'text-halo-color': colors.white,
  'text-halo-width': 1.5,
};

interface SpotPinLayerProps {
  /** スタイル上のソース id。1つの地図の中で重複させない */
  id: string;
  data: SpotFeatureCollection;
  onPressSpot?: (spotId: string) => void;
  /** 名前を出さない（詳細画面のミニマップなど） */
  hideLabels?: boolean;
}

/**
 * 団子化しない地図にスポットのピンを出す。
 *
 * ピンは GL のレイヤなのでネイティブビューが存在せず、VoiceOver から個々の
 * ピンにフォーカスできない（旧 SpotMarker は View だったので拾えていた）。
 * 地図以外の導線（検索・御朱印帳・行きたいリスト）からスポット詳細へ到達
 * できるため許容しているが、地図だけで完結させる機能を足すときは要検討
 */
export function SpotPinLayer({ id, data, onPressSpot, hideLabels }: SpotPinLayerProps) {
  const handlePress = useCallback(
    (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      const spotId = event.nativeEvent.features[0]?.properties?.spotId;
      if (typeof spotId === 'string') onPressSpot?.(spotId);
    },
    [onPressSpot]
  );

  return (
    <GeoJSONSource id={id} data={data} onPress={onPressSpot ? handlePress : undefined}>
      <Layer
        id={`${id}-pin`}
        type="symbol"
        layout={hideLabels ? ICON_LAYOUT : PIN_LAYOUT}
        paint={LABEL_PAINT}
      />
    </GeoJSONSource>
  );
}
