import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MANGAN_MONTHS } from '@utils/tsukimairi';
import type { TsukimairiEntry } from '@utils/tsukimairiList';
import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';

const CARD_PADDING = 14;

interface Props {
  entries: TsukimairiEntry[];
  onPressSpot: (spotId: string) => void;
}

/**
 * いま続いている月参りの一覧。
 *
 * **ここに無いと、その寺社を自分から開いた人しか気づけない。** アプリの仕事は
 * 作り出すことではなく気づくことなので、気づく場所はあゆみ。
 *
 * 次の月の丸は**破線で開いたまま**置くだけで、「今月まだです」とは書かない。
 * それが煽らずに気づかせる形（docs/design/2026-09-tsukimairi-spec.md §4-2）。
 */
export function TsukimairiList({ entries, onPressSpot }: Props) {
  if (entries.length === 0) return null;

  return (
    <View style={styles.card} testID="tsukimairi-section">
      <View style={styles.header}>
        <Text style={styles.title}>月参り</Text>
        <Text style={styles.count}>{`${entries.length}社`}</Text>
      </View>

      {entries.map(entry => (
        <TouchableOpacity
          key={entry.spotId}
          style={styles.row}
          onPress={() => onPressSpot(entry.spotId)}
          testID={`tsukimairi-row-${entry.spotId}`}
          accessibilityRole="button"
          accessibilityLabel={
            entry.isMangan
              ? `${entry.spotName}、満願`
              : `${entry.spotName}、${MANGAN_MONTHS}ヶ月のうち${entry.current}ヶ月。満願まであと${entry.remaining}ヶ月`
          }
        >
          <Text style={styles.name} numberOfLines={1}>
            {entry.spotName}
          </Text>
          <View style={styles.dots}>
            {Array.from({ length: MANGAN_MONTHS }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < entry.monthsInLap && styles.dotOn,
                  i === entry.monthsInLap && styles.dotNext,
                ]}
              />
            ))}
          </View>
          <Text style={styles.remaining}>{entry.isMangan ? '満願' : `あと${entry.remaining}`}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: CARD_PADDING,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { ...typography.h3, fontSize: 16, color: colors.gray[900] },
  count: { ...typography.caption, color: colors.gray[400] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  name: { ...typography.bodySmall, fontWeight: '700', color: colors.gray[900], width: 104 },
  dots: { flexDirection: 'row', flex: 1, gap: 3 },
  dot: { flex: 1, aspectRatio: 1, borderRadius: borderRadius.full, backgroundColor: '#E3E4E8' },
  dotOn: { backgroundColor: colors.shrine[600] },
  // 次の月は破線で開けておく。煽らずに「まだ空いている」だけを伝える
  dotNext: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.gray[400] },
  remaining: { ...typography.caption, color: colors.gray[600], width: 52, textAlign: 'right' },
});
