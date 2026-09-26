import { Animated, StyleSheet, View } from 'react-native';

import { colors } from '@theme/colors';
import { formatMonthDay, type AnnualReport } from '@utils/annualReport';

import { fade, fadeUp, tween, tweenText, type Clock } from '../motion';
import { ReportPhoto } from '../ReportPhoto';
import { sceneStyles } from '../sceneStyles';

interface Props {
  report: AnnualReport;
  clock: Clock;
}

/** シーン1 表紙（4800ms・必ず） */
export function CoverScene({ report, clock }: Props) {
  const { year, cover } = report;

  return (
    <View>
      <Animated.Text testID="annual-cover-kick" style={[sceneStyles.kick, fade(clock, 0, 500)]}>
        {`${year}年のふりかえり`}
      </Animated.Text>
      <Animated.Text
        testID="annual-cover-year"
        style={[sceneStyles.huge, styles.year, fadeUp(clock, 100, 700, 40)]}
      >
        {String(year)}
      </Animated.Text>
      <Animated.Text
        testID="annual-cover-lead"
        style={[sceneStyles.big, fadeUp(clock, 500, 600, 14)]}
      >
        あなたの参拝
      </Animated.Text>

      <View style={styles.frame}>
        <Animated.View
          testID="annual-cover-photo"
          style={[
            styles.photo,
            {
              opacity: tween(clock, 1100, 900, 0, 1),
              transform: [
                { scale: tween(clock, 1100, 900, 0.86, 1) },
                { rotate: tweenText(clock, 1100, 900, '-10deg', '-4deg') },
                { translateY: tween(clock, 1100, 900, 30, 0) },
              ],
            },
          ]}
        >
          <ReportPhoto imagePath={cover.imagePath} variant="view" style={styles.fill} />
        </Animated.View>
        <Animated.Text
          testID="annual-cover-caption"
          style={[styles.caption, fade(clock, 1900, 500)]}
          numberOfLines={1}
        >
          {`${formatMonthDay(cover.visitedAt)} ${cover.spotName} ─ 最初の一枚`}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  year: { marginTop: 14 },
  frame: {
    height: 330,
    marginTop: 26,
    alignItems: 'center',
  },
  photo: {
    marginTop: 6,
    width: 190,
    height: 260,
  },
  fill: { width: '100%', height: '100%' },
  caption: {
    position: 'absolute',
    top: 282,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: colors.washiSub,
  },
});
