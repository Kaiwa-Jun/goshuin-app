import { Animated, StyleSheet, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_NAMES,
  JAPAN_PREFECTURE_PATHS,
} from '@/constants/japanMap';
import { colors } from '@theme/colors';
import type { AnnualReport } from '@utils/annualReport';

import { fade, fadeUp, tween, type Clock } from '../motion';
import { ReportButton } from '../ReportButtons';
import { sceneStyles } from '../sceneStyles';

interface Props {
  report: AnnualReport;
  clock: Clock;
  onAgain: () => void;
  onClose: () => void;
}

/** シーン8 締め（自動で次へ行かない・時計は 1700ms まで） */
export function EndScene({ report, clock, onAgain, onClose }: Props) {
  const tiers = new Map(report.prefectures.map(p => [p.name, p.tier]));

  return (
    <View>
      <Animated.Text
        testID="annual-end-title"
        style={[sceneStyles.big, styles.title, fadeUp(clock, 0, 700, 14)]}
      >
        来年も、よい参拝を。
      </Animated.Text>

      <Animated.View
        testID="annual-end-card"
        style={[
          sceneStyles.card,
          styles.card,
          {
            opacity: tween(clock, 400, 800, 0, 1),
            transform: [
              { translateY: tween(clock, 400, 800, 40, 0) },
              { scale: tween(clock, 400, 800, 0.96, 1) },
            ],
          },
        ]}
      >
        <View style={styles.numbers}>
          <Text style={sceneStyles.cardTitle}>{String(report.year)}</Text>
          <Text style={styles.number}>{`${report.count.spots}社`}</Text>
          <Text style={styles.number}>{`${report.count.stamps}枚`}</Text>
          <Text style={styles.number}>{`${report.prefectures.length}県`}</Text>
        </View>
        {/* 動かない。まだの県は灰、行った県はその年の濃さ */}
        <Svg
          testID="annual-end-map"
          width={150}
          height={170}
          viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`}
        >
          {JAPAN_PREFECTURE_NAMES.map(name => {
            const tier = tiers.get(name);
            return (
              <Path
                key={name}
                testID={`annual-end-map-${name}`}
                d={JAPAN_PREFECTURE_PATHS[name]}
                fill={tier ? colors.prefectureFill[tier] : colors.prefectureFill.empty}
                stroke={colors.prefectureFill.border}
                strokeWidth={3}
              />
            );
          })}
        </Svg>
      </Animated.View>

      <Animated.View testID="annual-end-buttons" style={[styles.buttons, fade(clock, 1100, 600)]}>
        <ReportButton
          testID="annual-end-again"
          label="もう一度見る"
          variant="primary"
          onPress={onAgain}
        />
        <ReportButton
          testID="annual-end-close"
          label="閉じる"
          variant="secondary"
          onPress={onClose}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { textAlign: 'center', marginTop: 8 },
  card: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  numbers: { flex: 1 },
  number: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 32,
    color: colors.gray[900],
  },
  buttons: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 22,
  },
});
