import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors } from '@theme/colors';
import { formatMonthDay, type AnnualReport } from '@utils/annualReport';

import { fadeUp, type Clock } from '../motion';
import { ReportPhoto } from '../ReportPhoto';
import { sceneStyles } from '../sceneStyles';

interface Props {
  report: AnnualReport;
  clock: Clock;
}

const CARD_MS = 700;
const FIRST_DELAY = 300;
const SECOND_DELAY = 1500;

/** シーン6 印象に残った寺社（5200ms・どちらかがある） */
export function MemoryScene({ report, clock }: Props) {
  const { top, newPrefecture } = report.memory;
  // カードが1枚だけのときは、それが出る順の1枚目
  const newDelay = top ? SECOND_DELAY : FIRST_DELAY;

  return (
    <View>
      <Text style={sceneStyles.kick}>印象に残った寺社</Text>

      {top && (
        <Animated.View
          testID="annual-memory-top"
          style={[sceneStyles.card, styles.first, fadeUp(clock, FIRST_DELAY, CARD_MS, 40)]}
        >
          <Text style={sceneStyles.cardTitle}>いちばん多く参った</Text>
          <Text style={styles.name}>{top.spotName}</Text>
          <Text style={styles.detail}>
            {top.prefecture ? `${top.prefecture} ・ ${top.days}回` : `${top.days}回`}
          </Text>
          <ReportPhoto imagePath={top.imagePath} variant="view" style={styles.photo} />
        </Animated.View>
      )}

      {newPrefecture && (
        <Animated.View
          testID="annual-memory-new"
          style={[
            sceneStyles.card,
            top ? styles.second : styles.first,
            fadeUp(clock, newDelay, CARD_MS, 40),
          ]}
        >
          <Text style={sceneStyles.cardTitle}>はじめて足を運んだ県</Text>
          <Text style={styles.name}>{newPrefecture.name}</Text>
          <Text style={styles.detail}>
            {`${formatMonthDay(newPrefecture.visitedAt)} ${newPrefecture.spotName} から`}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: 22 },
  second: { marginTop: 16 },
  name: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
    color: colors.gray[900],
  },
  detail: { fontSize: 14, color: colors.washiSub },
  photo: { height: 130, width: '100%', marginTop: 12 },
});
