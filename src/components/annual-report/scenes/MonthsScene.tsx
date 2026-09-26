import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors } from '@theme/colors';
import type { AnnualReport } from '@utils/annualReport';

import { fade, fadeUp, tween, type Clock } from '../motion';
import { sceneStyles } from '../sceneStyles';

interface Props {
  report: AnnualReport;
  clock: Clock;
}

const CHART_HEIGHT = 230;
const BAR_DELAY = 200;
const BAR_STEP = 110;
const BAR_MS = 380;
/** いちばん多い月の重ね: 12本が伸びきってから（200 + 12 × 110 + 350） */
const TOP_DELAY = 1870;
const TOP_MS = 700;

/** 棒の高さ。最大の月が 230、少ない月も 8% は残す。0枚の月は 3% */
function barHeight(stamps: number, max: number): number {
  const percent = stamps > 0 ? Math.max(8, (stamps / max) * 100) : 3;
  return (CHART_HEIGHT * percent) / 100;
}

/** シーン3 月ごと（5200ms・記録のある月が2つ以上） */
export function MonthsScene({ report, clock }: Props) {
  const { months, topMonth } = report;
  const max = Math.max(...months);

  // 重ねの進み（easeOut 後の p）。棒の横の膨らみは 1 + .18·sin(pπ)（試作）
  const topProgress = tween(clock, TOP_DELAY, TOP_MS, 0, 1);
  const swell = topProgress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [1, 1.127, 1.18, 1.127, 1],
  });

  return (
    <View>
      <Text style={sceneStyles.kick}>月ごとの参拝</Text>
      <Animated.View
        testID="annual-months-title"
        style={[styles.title, fadeUp(clock, 1900, 600, 14)]}
      >
        <Text style={sceneStyles.big}>{`${topMonth.month}月が、いちばん`}</Text>
        <Text style={sceneStyles.big}>よく参った月</Text>
      </Animated.View>
      <Animated.Text testID="annual-months-sub" style={[sceneStyles.sub, fade(clock, 2300, 500)]}>
        {`${topMonth.stamps}枚の御朱印`}
      </Animated.Text>

      <View style={styles.chart}>
        {months.map((stamps, i) => {
          const isTop = i + 1 === topMonth.month;
          return (
            <Animated.View
              key={i}
              testID={`annual-month-bar-${i + 1}`}
              style={[
                styles.bar,
                stamps > 0 ? styles.barOn : styles.barZero,
                {
                  height: tween(clock, BAR_DELAY + i * BAR_STEP, BAR_MS, 0, barHeight(stamps, max)),
                },
                isTop && { transform: [{ scaleX: swell }] },
              ]}
            >
              {isTop && (
                <Animated.View
                  testID="annual-month-top"
                  style={[styles.top, { opacity: topProgress }]}
                />
              )}
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.labels}>
        {months.map((_, i) => (
          <Text key={i} style={styles.label}>
            {i + 1}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 6 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: CHART_HEIGHT,
    marginTop: 28,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    overflow: 'hidden',
  },
  barOn: { backgroundColor: colors.primary[300] },
  barZero: { backgroundColor: colors.washiShade },
  top: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.seal,
  },
  labels: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
  },
  label: {
    flex: 1,
    fontSize: 11,
    color: colors.washiSub,
    textAlign: 'center',
  },
});
