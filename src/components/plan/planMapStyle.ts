// 予定を組む地図の見た目（Issue #258 D-13・D-22）
import type {
  CircleLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-react-native';

import { PIN_IMAGE_BY_STATE, pinIconSize } from '@components/map/spotPins';
import { colors } from '@theme/colors';

/**
 * 選んだピンの見せ方。'big-check' = 1.45倍＋右上に ✓ / 'ring' = 通常の大きさ＋朱の輪。
 * 実機で比べて決める（試作 v3 の推しは big-check。朱の輪は地図のフォーカスの印と紛れうる）
 */
export const CHOSEN_PIN_STYLE: 'big-check' | 'ring' = 'big-check';
export const CHOSEN_PIN_SCALE = 1.45;

export function chosenPinLayouts(style: 'big-check' | 'ring' = CHOSEN_PIN_STYLE): {
  pin: SymbolLayerSpecification['layout'];
  mark: SymbolLayerSpecification['layout'];
} {
  const size = pinIconSize(style === 'big-check' ? CHOSEN_PIN_SCALE : 1);
  // ignore-placement: 重ね絵が衝突の枠を取ると、下のピンの名前が間引かれて消える
  const base = {
    'icon-anchor': 'bottom',
    'icon-size': size,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  } as const;
  return {
    pin: { ...base, 'icon-image': PIN_IMAGE_BY_STATE },
    mark: {
      ...base,
      'icon-image': style === 'big-check' ? 'spot-pin-chosen-check' : 'spot-pin-chosen-ring',
    },
  };
}

export const ROUTE_LINE_PAINT: LineLayerSpecification['paint'] = {
  'line-color': colors.seal,
  'line-width': 3,
  'line-dasharray': [2, 2],
};

export const STOP_CIRCLE_PAINT: CircleLayerSpecification['paint'] = {
  'circle-radius': 13,
  'circle-color': colors.seal,
  'circle-stroke-width': 2.5,
  'circle-stroke-color': colors.white,
};

export const STOP_NUMBER_LAYOUT: SymbolLayerSpecification['layout'] = {
  'text-field': ['to-string', ['get', 'number']],
  'text-font': ['Noto Sans Bold'],
  'text-size': 12,
  'text-allow-overlap': true,
  'text-ignore-placement': true,
};

export const STOP_NUMBER_PAINT: SymbolLayerSpecification['paint'] = { 'text-color': colors.white };
