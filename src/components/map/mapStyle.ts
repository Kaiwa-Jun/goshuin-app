import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import styleJson from '../../../assets/map-style.json';

/**
 * 地図の下地。OpenStreetMap 由来のベクタータイル（キー不要）。
 * 配布元のスタイルは地名を「Kyoto 京都市」と二重に出すため、
 * 日本語だけに差し替えたものを同梱している。
 * 焼き直し・英語併記へ戻す手順は scripts/generate-map-style.mjs を見ること
 */
export const MAP_STYLE = styleJson as unknown as StyleSpecification;
