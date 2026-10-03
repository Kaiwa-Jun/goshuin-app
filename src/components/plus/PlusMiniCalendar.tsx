import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { buildMonthGrid } from '@utils/planDate';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

/** 土曜日に並べる社数（試作 v3 の数を繰り返す） */
const COUNTS = [4, 3, 5, 2, 3, 4];

/**
 * プラスの画面の飾りのカレンダー（Issue #270 D-18）。来月の土曜日すべてに予定が入った絵で
 * 「予定をいくつでも」を見せる。押せない・読み上げない（本物の予定ではないため）
 */
export function PlusMiniCalendar({ today }: { today: Date }) {
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const year = next.getFullYear();
  const month = next.getMonth() + 1;
  const grid = buildMonthGrid(year, month);
  const inMonth = (ymd: string) => Number(ymd.slice(5, 7)) === month;
  const weeks = Array.from({ length: 6 }, (_, w) => grid.slice(w * 7, w * 7 + 7)).filter(week =>
    week.some(inMonth)
  );
  let saturday = 0;

  return (
    <View
      style={styles.box}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="plus-mini-calendar"
    >
      <View style={styles.head}>
        <Text style={styles.month}>{`${year}年${month}月`}</Text>
        <View style={styles.tag}>
          <Text style={styles.tagText}>プラス</Text>
        </View>
      </View>
      {weeks.map(week => (
        <View key={week[0]} style={styles.week}>
          {week.map((ymd, i) => {
            const mark = i === 6 && inMonth(ymd) ? COUNTS[saturday++ % COUNTS.length] : null;
            return (
              <View key={ymd} style={[styles.day, mark !== null && styles.has]}>
                <Text style={[styles.num, !inMonth(ymd) && styles.out]}>
                  {Number(ymd.slice(8))}
                </Text>
                {mark !== null && (
                  <Text style={styles.mark} testID={`plus-mini-mark-${ymd}`}>
                    {`●${mark}社`}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  month: { ...typography.caption, fontWeight: '800', color: colors.gray[700] },
  tag: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: { ...typography.caption, fontSize: 10, fontWeight: '700', color: colors.primary[700] },
  week: { flexDirection: 'row' },
  day: { flex: 1, height: 34, alignItems: 'center', borderRadius: borderRadius.md, paddingTop: 2 },
  has: { backgroundColor: colors.primary[50] },
  num: { ...typography.caption, color: colors.gray[900] },
  out: { color: colors.gray[400] },
  mark: { fontSize: 9, fontWeight: '800', color: colors.primary[500] },
});
