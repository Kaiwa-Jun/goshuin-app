import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import type { VisitPlan } from '@/types/visitPlan';
import { buildMonthGrid } from '@utils/planDate';
import { countVisited, isPastPlan } from '@utils/visitPlan';
import { toLocalDateString } from '@utils/localDate';
import { useReduceMotion } from '@hooks/useReduceMotion';
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
  /** 横スワイプで月を送る。1 = 次の月 / -1 = 前の月 */
  onSwipeMonth?: (delta: 1 | -1) => void;
}

/** 送るのに要る横の移動（px）と、短くても送る払いの速さ */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 0.5;
const SLIDE_MS = 160;

/** 指を離したときに月を送るか。左へ払う = 次の月 */
export function swipeMonthDelta(dx: number, vx: number): 1 | -1 | 0 {
  if (dx <= -SWIPE_DISTANCE || vx <= -SWIPE_VELOCITY) return 1;
  if (dx >= SWIPE_DISTANCE || vx >= SWIPE_VELOCITY) return -1;
  return 0;
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
  onSwipeMonth,
}: Props) {
  const todayKey = toLocalDateString(today);
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const slide = useRef(new Animated.Value(0)).current;
  const latest = useRef({ onSwipeMonth, width, reduceMotion });
  latest.current = { onSwipeMonth, width, reduceMotion };

  // 横に動いたときだけ指を取る（日のタップと縦のスクロールは邪魔しない）
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => slide.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        const { onSwipeMonth: go, width: w, reduceMotion: still } = latest.current;
        const delta = swipeMonthDelta(g.dx, g.vx);
        if (delta === 0 || !go) {
          Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
          return;
        }
        if (still) {
          slide.setValue(0);
          go(delta);
          return;
        }
        // 今の月を払った向きへ送り出し、次の月を反対側から入れる
        Animated.timing(slide, {
          toValue: -delta * w,
          duration: SLIDE_MS,
          useNativeDriver: true,
        }).start(() => {
          go(delta);
          slide.setValue(delta * w);
          Animated.timing(slide, { toValue: 0, duration: SLIDE_MS, useNativeDriver: true }).start();
        });
      },
      onPanResponderTerminate: () => {
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={{ transform: [{ translateX: slide }] }}
      testID="plan-calendar"
    >
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
                  <Text
                    style={[
                      styles.numText,
                      outside && styles.outside,
                      past && !plan && styles.pastNum,
                      ymd === todayKey && styles.todayText,
                    ]}
                  >
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
    </Animated.View>
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
  // 今日は塗りつぶしの丸（枠の丸より「選ばれている日」に見える）
  today: { backgroundColor: colors.primary[500] },
  todayText: { color: colors.white, fontWeight: '700' },
  numText: { ...typography.body, color: colors.gray[900] },
  outside: { color: colors.gray[400] },
  // 押せない過去の日（予定の無い日）。今日以降と見分けがつくように
  pastNum: { color: colors.gray[300] },
  mark: { ...typography.caption, fontWeight: '800', color: colors.primary[500], marginTop: 2 },
  pastMark: { color: colors.gray[500] },
});
