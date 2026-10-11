import React from 'react';
import { G, Path } from 'react-native-svg';

import { JAPAN_PREFECTURE_PATHS } from '@/constants/japanMap';
import { colors } from '@theme/colors';

interface PrefectureEmbossProps {
  prefecture: string;
  /** viewBox（幅 1000）の単位。影は (-offset, -offset)、光は (offset, offset) */
  offset: number;
  /** 影の不透明度 */
  shadeOpacity: number;
}

/**
 * 県の「空押し」。紙に色を付けずに型だけ押した姿で、まだ色の差していない県を
 * うっすら浮かせる（Issue #327。印の空押し SealGlyph と同じ重ね方: 左上に影・
 * 右下に光・上に「まだ」の色）。
 *
 * 日本地図の Svg（viewBox 0 0 1000 1132）の中に置く。動かすときは、これを入れた
 * View の opacity を動かす（SVG の fill は動かさない）
 */
export function PrefectureEmboss({ prefecture, offset, shadeOpacity }: PrefectureEmbossProps) {
  const d = JAPAN_PREFECTURE_PATHS[prefecture];
  return (
    <>
      <G fill={colors.gray[600]} opacity={shadeOpacity} x={-offset} y={-offset}>
        <Path d={d} />
      </G>
      <G fill={colors.white} opacity={0.9} x={offset} y={offset}>
        <Path d={d} />
      </G>
      <G fill={colors.sealEmpty}>
        <Path d={d} />
      </G>
    </>
  );
}
