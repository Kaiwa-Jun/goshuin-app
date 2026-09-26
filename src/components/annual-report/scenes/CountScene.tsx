import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { sceneCopy, type AnnualReport } from '@utils/annualReport';

import { easeInOut, easeOut, fade, fadeUp, readClock, tweenText, type Clock } from '../motion';
import { sceneStyles } from '../sceneStyles';

interface Props {
  report: AnnualReport;
  clock: Clock;
}

const COUNT_DELAY = 200;
const COUNT_MS = 1300;

/** 数え上げの表示。時計の t での数（試作の Math.round(easeOut(p) × 社数)） */
function countAt(t: number, total: number): number {
  const p = Math.min(1, Math.max(0, (t - COUNT_DELAY) / COUNT_MS));
  return Math.round(easeOut(p) * total);
}

/** シーン2 数字（5200ms・必ず） */
export function CountScene({ report, clock }: Props) {
  const { spots, stamps, shrines, temples } = report.count;
  const copy = sceneCopy(report.year, report.isCurrentYear);

  // 最初の表示は時計の今の値から（視差効果を減らす では最初から最後の値に置かれている）
  const [shown, setShown] = useState(() => countAt(readClock(clock), spots));
  const shownRef = useRef(shown);

  useEffect(() => {
    const id = clock.addListener(({ value }) => {
      const next = countAt(value, spots);
      // 変わったときだけ描き直す（毎フレームは描かない）
      if (next === shownRef.current) return;
      shownRef.current = next;
      setShown(next);
    });
    return () => clock.removeListener(id);
  }, [clock, spots]);

  const ratio = (n: number) => `${spots > 0 ? (n / spots) * 100 : 0}%`;

  return (
    <View>
      <Text style={sceneStyles.kick}>{copy.countKick}</Text>
      <View style={styles.spotsRow}>
        <Text testID="annual-count-spots" style={[sceneStyles.huge, styles.spots]}>
          {shown}
        </Text>
        <Text style={[sceneStyles.big, sceneStyles.big26]}> 社</Text>
      </View>

      <Animated.View
        testID="annual-count-stamps"
        style={[styles.stamps, fadeUp(clock, 1400, 600, 16)]}
      >
        <Text style={[sceneStyles.big, sceneStyles.big26]}>{`${stamps} 枚の御朱印を`}</Text>
        <Text style={[sceneStyles.big, sceneStyles.big26]}>いただきました</Text>
      </Animated.View>

      <View testID="annual-count-split" style={styles.split}>
        <Animated.View
          testID="annual-count-split-shrine"
          style={[
            styles.shrine,
            { width: tweenText(clock, 2100, 900, '0%', ratio(shrines), easeInOut) },
          ]}
        />
        <Animated.View
          testID="annual-count-split-temple"
          style={[
            styles.temple,
            { width: tweenText(clock, 2100, 900, '0%', ratio(temples), easeInOut) },
          ]}
        />
      </View>

      <Animated.View testID="annual-count-legend" style={[styles.legend, fade(clock, 2800, 500)]}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.shrine]} />
          <Text style={styles.legendText}>{`神社 ${shrines}`}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.temple]} />
          <Text style={styles.legendText}>{`お寺 ${temples}`}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  spotsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 34,
  },
  spots: { color: colors.seal },
  stamps: { marginTop: 18 },
  split: {
    flexDirection: 'row',
    height: 14,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: 30,
    backgroundColor: colors.washiShade,
  },
  shrine: { backgroundColor: colors.shrine[600] },
  temple: { backgroundColor: colors.temple[600] },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    marginRight: 6,
  },
  legendText: { fontSize: 14, color: colors.gray[900] },
});
