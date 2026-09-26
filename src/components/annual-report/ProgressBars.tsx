import { Animated, StyleSheet, View } from 'react-native';

import { colors } from '@theme/colors';

import type { Clock } from './motion';

interface Props {
  count: number;
  index: number;
  clock: Clock;
  /** 今のシーンの長さ。0（締め）なら今のバーは 100% */
  sceneMs: number;
  /** 視差効果を減らす。今のバーは 100% */
  full: boolean;
}

/**
 * 上のバー（ストーリーと同じ）。前のシーン 100%・今のシーンは時計 / 長さ・後のシーン 0%。
 * 地は墨色の面に 0.22 の透明度（D-21。色の直値の半透明は使わない）
 */
export function ProgressBars({ count, index, clock, sceneMs, full }: Props) {
  return (
    <View style={styles.bars} testID="annual-report-bars" pointerEvents="none">
      {Array.from({ length: count }, (_, i) => {
        let width: Animated.AnimatedInterpolation<string> | `${number}%` = '0%';
        if (i < index) width = '100%';
        else if (i === index) {
          // 締め（長さ 0）は interpolate を作らない。[0, 0] は 0 で割って NaN になる
          width =
            full || sceneMs <= 0
              ? '100%'
              : clock.interpolate({
                  inputRange: [0, sceneMs],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                });
        }
        return (
          <View key={i} style={styles.bar} testID={`annual-report-bar-${i}`}>
            <View style={styles.track} testID={`annual-report-bar-track-${i}`} />
            <Animated.View
              style={[styles.fill, { width }]}
              testID={`annual-report-bar-fill-${i}`}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  track: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.gray[900],
    opacity: 0.22,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.gray[900],
    borderRadius: 2,
  },
});
