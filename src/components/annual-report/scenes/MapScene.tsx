import { useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_NAMES,
  JAPAN_PREFECTURE_PATHS,
} from '@/constants/japanMap';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import {
  fitPrefectures,
  mapStepMs,
  prefectureNamesLine,
  toViewTransform,
  type AnnualReport,
} from '@utils/annualReport';

import { easeInOut, fade, fadeUp, tween, type Clock } from '../motion';
import { sceneStyles } from '../sceneStyles';

/**
 * 県の塗りは色の補間ではなく、白い県の上に色の県を重ねて opacity を上げる
 * （PrefectureMap と同じ作り。見た目は色の補間と同じ。D-10）
 */
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  report: AnnualReport;
  clock: Clock;
}

/** シーンの左右の内側（stage の paddingHorizontal） */
const STAGE_PADDING_X = 26;
const FILL_MS = 420;
const ZOOM_MS = 1100;

/** シーン4 地図（6400ms・県が1つ以上） */
export function MapScene({ report, clock }: Props) {
  const { prefectures } = report;
  const window = useWindowDimensions();
  // 寄りの計算に実寸が要る。測れるまでは画面の幅から引いた見込みで描く
  const [width, setWidth] = useState(window.width - STAGE_PADDING_X * 2);
  const height = (width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;

  const n = prefectures.length;
  const step = mapStepMs(n);
  const zoomStart = 500 + n * step + 300;
  const names = useMemo(() => prefectures.map(p => p.name), [prefectures]);
  const view = useMemo(() => toViewTransform(fitPrefectures(names), width), [names, width]);

  return (
    <View style={styles.root}>
      <Text style={sceneStyles.kick}>足を運んだ県</Text>
      <Animated.Text
        testID="annual-map-title"
        style={[sceneStyles.big, styles.title, fadeUp(clock, zoomStart + 700, 600, 12)]}
      >
        {`${n} つの県へ`}
      </Animated.Text>

      <View style={styles.frame} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        <Animated.View
          testID="annual-map-zoom"
          style={{
            width,
            height,
            transform: [
              { translateX: tween(clock, zoomStart, ZOOM_MS, 0, view.translateX, easeInOut) },
              { translateY: tween(clock, zoomStart, ZOOM_MS, 0, view.translateY, easeInOut) },
              { scale: tween(clock, zoomStart, ZOOM_MS, 1, view.scale, easeInOut) },
            ],
          }}
        >
          <Svg
            testID="annual-map-svg"
            width={width}
            height={height}
            viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`}
          >
            {JAPAN_PREFECTURE_NAMES.map(name => (
              <Path
                key={name}
                testID={`annual-map-base-${name}`}
                d={JAPAN_PREFECTURE_PATHS[name]}
                fill={colors.white}
                stroke={colors.washi}
                strokeWidth={3}
              />
            ))}
            {/* 足を運んだ県だけ重ねる（47県すべてに置かない） */}
            {prefectures.map((p, i) =>
              JAPAN_PREFECTURE_PATHS[p.name] ? (
                <AnimatedPath
                  key={p.name}
                  testID={`annual-map-fill-${p.name}`}
                  d={JAPAN_PREFECTURE_PATHS[p.name]}
                  fill={colors.prefectureFill[p.tier]}
                  stroke={colors.washi}
                  strokeWidth={3}
                  opacity={tween(clock, 500 + i * step, FILL_MS, 0, 1)}
                />
              ) : null
            )}
          </Svg>
        </Animated.View>
      </View>

      <Animated.Text
        testID="annual-map-names"
        style={[styles.names, fade(clock, zoomStart + 1100, 500)]}
      >
        {prefectureNamesLine(names)}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { marginTop: 6 },
  frame: {
    marginTop: 14,
    flex: 1,
    maxHeight: 430,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  names: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.washiSub,
    lineHeight: 22,
    marginTop: 10,
  },
});
