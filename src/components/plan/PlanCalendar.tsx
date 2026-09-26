import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { VisitPlan } from '@/types/visitPlan';
import { buildMonthGrid } from '@utils/planDate';
import { countVisited, isPastPlan } from '@utils/visitPlan';
import { toLocalDateString } from '@utils/localDate';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  year: number;
  month: number;
  today: Date;
  plansByDate: Map<string, VisitPlan>;
  visitedByDate: Map<string, Set<string>>;
  onPressDay: (ymd: string) => void;
}

/** 42日を7日ずつに分ける */
function weeks(days: string[]): string[][] {
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
}

/** 月の格子（日曜始まり6週）。予定のある日に「●N社」、過ぎた日は「✓k/N」（Issue #258） */
export function PlanCalendar({
  year,
  month,
  today,
  plansByDate,
  visitedByDate,
  onPressDay,
}: Props) {
  const todayKey = toLocalDateString(today);
  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={w}
            style={[styles.weekday, i === 0 && styles.sunday, i === 6 && styles.saturday]}
          >
            {w}
          </Text>
        ))}
      </View>
      {/* 週ごとに1行。割合の幅（100/7%）で折り返すと、端数で1行に6日しか入らないことがある */}
      {weeks(buildMonthGrid(year, month)).map((week, w) => (
        <View key={week[0]} style={styles.week} testID={`plan-week-${w}`}>
          {week.map(ymd => {
            const plan = plansByDate.get(ymd);
            const past = isPastPlan(ymd, today);
            const outside = Number(ymd.slice(5, 7)) !== month;
            const n = plan?.stops.length ?? 0;
            const done = plan
              ? countVisited(
                  plan.stops.map(s => s.spotId),
                  visitedByDate.get(ymd) ?? new Set()
                ).count
              : 0;
            return (
              <TouchableOpacity
                key={ymd}
                style={[styles.day, plan && (past ? styles.pastPlanDay : styles.planDay)]}
                onPress={() => onPressDay(ymd)}
                disabled={past && !plan}
                testID={`plan-day-${ymd}`}
                accessibilityRole="button"
                accessibilityLabel={`${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8))}日${plan ? `、${plan.name}` : ''}`}
              >
                <View style={[styles.num, ymd === todayKey && styles.today]}>
                  <Text style={[styles.numText, outside && styles.outside]}>
                    {Number(ymd.slice(8))}
                  </Text>
                </View>
                {plan && (
                  <Text style={[styles.mark, past && styles.pastMark]}>
                    {past ? `✓${done}/${n}` : `●${n}社`}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', paddingHorizontal: spacing.md },
  weekday: { flex: 1, textAlign: 'center', ...typography.caption, color: colors.gray[400] },
  sunday: { color: colors.shrine[600] },
  saturday: { color: colors.info },
  week: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  day: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderRadius: borderRadius.lg,
  },
  planDay: { backgroundColor: colors.primary[50] },
  pastPlanDay: { backgroundColor: colors.gray[100] },
  num: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 2, borderColor: colors.primary[500] },
  numText: { ...typography.body, color: colors.gray[900] },
  outside: { color: colors.gray[400] },
  mark: { ...typography.caption, fontWeight: '800', color: colors.primary[500], marginTop: 2 },
  pastMark: { color: colors.gray[500] },
});
