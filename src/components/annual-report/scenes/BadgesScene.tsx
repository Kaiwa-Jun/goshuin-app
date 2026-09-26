import { Animated, StyleSheet, Text, View } from 'react-native';

import { Seal } from '@components/common/Seal';
import { colors } from '@theme/colors';
import { formatMonthDay, sceneCopy, sealStepMs, type AnnualReport } from '@utils/annualReport';

import { fadeUp, linear, type Clock } from '../motion';
import { sceneStyles } from '../sceneStyles';

interface Props {
  report: AnnualReport;
  clock: Clock;
}

const SEAL_START = 500;
/** 印が押される動き（試作）: 262.5ms で見え切り、294ms で 0.92 まで沈み、420ms で 1 に戻る */
const SEAL_OPAQUE_MS = 262.5;
const SEAL_SINK_MS = 294;
const SEAL_MS = 420;
const PER_ROW = 3;
const CARD_MS = 700;

/** シーン7 達成（5600ms・その年に取った印が1つ以上 か 満願が1つ以上） */
export function BadgesScene({ report, clock }: Props) {
  const { badges, pilgrimages } = report;
  const copy = sceneCopy(report.year, report.isCurrentYear);
  const m = badges.length;
  const step = sealStepMs(m);
  const size = m >= 4 ? 64 : 88;
  const rows = Array.from({ length: Math.ceil(m / PER_ROW) }, (_, r) =>
    badges.slice(r * PER_ROW, r * PER_ROW + PER_ROW)
  );

  const cardDelay = m > 0 ? SEAL_START + m * step + 300 : SEAL_START;
  const cardMotion = fadeUp(clock, cardDelay, CARD_MS, 30);
  const [latest, ...others] = pilgrimages;

  return (
    <View>
      <Text style={sceneStyles.kick}>{m > 0 ? copy.badgesKick : copy.manganKick}</Text>

      {m > 0 && (
        <>
          <Text testID="annual-badges-title" style={[sceneStyles.big, styles.title]}>
            {`${m} つの印`}
          </Text>
          <View style={styles.seals}>
            {rows.map((row, r) => (
              <View key={r} style={styles.row}>
                {row.map((badge, k) => {
                  const start = SEAL_START + (r * PER_ROW + k) * step;
                  return (
                    <Animated.View
                      key={badge.id}
                      testID={`annual-seal-${badge.id}`}
                      style={[
                        styles.seal,
                        {
                          opacity: clock.interpolate({
                            inputRange: [start, start + SEAL_OPAQUE_MS],
                            outputRange: [0, 1],
                            easing: linear,
                            extrapolate: 'clamp',
                          }),
                          transform: [
                            {
                              scale: clock.interpolate({
                                inputRange: [start, start + SEAL_SINK_MS, start + SEAL_MS],
                                outputRange: [1.6, 0.92, 1],
                                easing: linear,
                                extrapolate: 'clamp',
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Seal mark={badge.mark} earned size={size} />
                      <Text style={styles.sealName}>{badge.name}</Text>
                    </Animated.View>
                  );
                })}
              </View>
            ))}
          </View>
        </>
      )}

      {latest && (
        <>
          <Animated.View
            testID="annual-pilgrimage-card"
            style={[sceneStyles.card, m > 0 ? styles.cardAfterSeals : styles.cardAlone, cardMotion]}
          >
            <Text style={sceneStyles.cardTitle}>満願</Text>
            <Text style={styles.pilgrimageName}>{latest.name}</Text>
            <Text style={styles.pilgrimageDetail}>
              {`${latest.spots}社 ・ ${formatMonthDay(latest.completedAt)}`}
            </Text>
          </Animated.View>
          {others.length > 0 && (
            <Animated.Text testID="annual-pilgrimage-more" style={[styles.more, cardMotion]}>
              {`ほかに ${others.length}つの巡礼も満願`}
            </Animated.Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 6 },
  seals: { marginTop: 40, rowGap: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  seal: { alignItems: 'center' },
  sealName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    color: colors.gray[900],
  },
  cardAfterSeals: { marginTop: 40, alignItems: 'center' },
  cardAlone: { marginTop: 22, alignItems: 'center' },
  pilgrimageName: { fontSize: 21, fontWeight: '800', color: colors.gray[900] },
  pilgrimageDetail: { fontSize: 13, color: colors.washiSub },
  more: {
    fontSize: 13,
    color: colors.washiSub,
    textAlign: 'center',
    marginTop: 8,
  },
});
