import { StyleSheet, Text, View } from 'react-native';

import { MANGAN_MONTHS, type Tsukimairi } from '@utils/tsukimairi';
import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';

const MONTH_LABELS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

interface Props {
  tsukimairi: Tsukimairi;
}

/**
 * 月参りカード。**続いているときだけ出す**（連続2ヶ月以上）。
 *
 * カードの仕事は「満願まであと◯ヶ月」を見失わせないこと。途切れたら役目が無いので
 * 消える。「最長N ヶ月」は御朱印一覧の1行として残る（TsukimairiPast）。
 * 責める文言はどこにも出さない（docs/design/2026-09-tsukimairi-spec.md §3）。
 */
export function TsukimairiCard({ tsukimairi }: Props) {
  if (!tsukimairi.shouldShowCard) return null;

  const { monthsInLap, remaining, isMangan, lapCount, startMonth } = tsukimairi;
  const startLabel = startMonth ? MONTH_LABELS[Number(startMonth.slice(5, 7)) - 1] : '';

  return (
    <View style={styles.card} testID="tsukimairi-card">
      <View style={styles.header}>
        <Text style={styles.title}>月参り</Text>
        <View style={styles.chip}>
          <Text style={styles.chipText} testID="tsukimairi-chip">
            {isMangan && lapCount > 1
              ? `${lapCount}周目 ${monthsInLap}ヶ月`
              : `${monthsInLap}ヶ月目`}
          </Text>
        </View>
      </View>
      <Text style={styles.lead}>毎月この神社へ。12ヶ月で満願です</Text>

      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`12ヶ月のうち${monthsInLap}ヶ月、おまいりしました`}
      >
        {Array.from({ length: MANGAN_MONTHS }, (_, i) => (
          <View
            key={i}
            testID={`tsukimairi-dot-${i}`}
            style={[
              styles.dot,
              i < monthsInLap && styles.dotOn,
              i === monthsInLap && styles.dotNext,
            ]}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>{startLabel}</Text>
        <Text style={styles.legendText}>満願</Text>
      </View>

      <View style={styles.goal}>
        {isMangan ? (
          <Text style={styles.goalText} testID="tsukimairi-goal">
            <Text style={styles.goalStrong}>満願</Text>。12ヶ月、毎月おまいりしました
          </Text>
        ) : (
          <Text style={styles.goalText} testID="tsukimairi-goal">
            満願まで、<Text style={styles.goalStrong}>あと{remaining}ヶ月</Text>。
          </Text>
        )}
      </View>
    </View>
  );
}

/** 途切れた寺社に残す1行。カードは出さない */
export function TsukimairiPast({ longest }: { longest: number }) {
  if (longest < 2) return null;

  return (
    <Text style={styles.past} testID="tsukimairi-past">
      月参り ・ 最長 <Text style={styles.pastStrong}>{longest}ヶ月</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    borderTopWidth: 3,
    borderTopColor: colors.shrine[600],
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h3, fontSize: 16, color: colors.gray[900] },
  chip: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: borderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: spacing.md,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.shrine[600] },
  lead: { ...typography.caption, color: colors.gray[600], marginTop: 2, marginBottom: spacing.md },
  dots: { flexDirection: 'row', gap: 5, marginBottom: 7 },
  dot: { flex: 1, aspectRatio: 1, borderRadius: borderRadius.full, backgroundColor: '#E3E4E8' },
  dotOn: { backgroundColor: colors.shrine[600] },
  // 次の月は破線で開けておく。「今月まだです」とは書かない
  dotNext: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.gray[400] },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { fontSize: 10, color: colors.gray[400] },
  goal: {
    marginTop: 13,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  goalText: { ...typography.bodySmall, color: colors.gray[900] },
  goalStrong: { fontWeight: '700', color: colors.shrine[600] },
  past: { ...typography.caption, color: colors.gray[600], marginBottom: spacing.md },
  pastStrong: { fontWeight: '700', color: colors.shrine[600] },
});
