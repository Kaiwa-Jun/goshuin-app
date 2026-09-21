import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { StampWithSpot } from '@/types/supabase';

interface Props {
  stamps: StampWithSpot[];
  onSeeAll: () => void;
}

/** 地図カードと同じ内側の余白（docs/design/2026-09-ayumi-map-spec.md §4-2） */
const CARD_PADDING = 14;

/** visited_at は DATE。文字列のまま切る（new Date() を挟むと Issue #204 の1日ずれを踏む） */
function toMonthDay(visitedAt: string): string {
  const [, month, day] = visitedAt.split('-');
  return `${month}/${day}`;
}

/**
 * 最近の参拝（直近3件）。
 *
 * 地図が「どこ」を見せるので、こちらは「いつ・どの寺社か」を受ける。
 * 数字ではなく、その人が実際に行った場所と日付を主役にするための並び。
 */
export function RecentVisits({ stamps, onSeeAll }: Props) {
  // 0件のときは見出しごと出さない。空の枠は「壊れている」に見える
  if (stamps.length === 0) return null;

  return (
    <View style={styles.card} testID="recent-visits-section">
      <View style={styles.header}>
        <Text style={styles.title}>最近の参拝</Text>
        <TouchableOpacity
          onPress={onSeeAll}
          testID="recent-visits-see-all"
          accessibilityRole="button"
        >
          <Text style={styles.seeAll}>すべて見る ›</Text>
        </TouchableOpacity>
      </View>

      {stamps.map((stamp, index) => {
        const isTemple = stamp.spots.type === 'temple';
        return (
          <View style={styles.row} key={stamp.id}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: isTemple ? colors.temple[600] : colors.shrine[600] },
                ]}
              />
              {index < stamps.length - 1 && <View style={styles.line} />}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {stamp.spots.name}
            </Text>
            <View
              style={[
                styles.typeChip,
                { backgroundColor: isTemple ? colors.temple[50] : colors.shrine[50] },
              ]}
            >
              <Text
                style={[
                  styles.typeChipText,
                  { color: isTemple ? colors.temple[600] : colors.shrine[600] },
                ]}
              >
                {isTemple ? '寺院' : '神社'}
              </Text>
            </View>
            <Text style={styles.date}>{toMonthDay(stamp.visited_at)}</Text>
          </View>
        );
      })}
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
  seeAll: { ...typography.caption, color: colors.gray[400] },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  line: {
    position: 'absolute',
    top: 13,
    width: 1,
    height: 22,
    backgroundColor: colors.gray[200],
  },
  name: { ...typography.bodySmall, fontWeight: '700', color: colors.gray[900], marginLeft: 10 },
  typeChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  typeChipText: { fontSize: 10, fontWeight: '700' },
  date: { ...typography.caption, color: colors.gray[400], marginLeft: 'auto' },
});
