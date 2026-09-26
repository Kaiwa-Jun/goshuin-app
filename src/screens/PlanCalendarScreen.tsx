import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { PlanCalendar } from '@components/plan/PlanCalendar';
import { PlusSheet } from '@components/plus/PlusSheet';
import { useAuth } from '@hooks/useAuth';
import { usePlus } from '@hooks/usePlus';
import { useVisitPlans } from '@hooks/useVisitPlans';
import type { PlanStackScreenProps } from '@/navigation/types';
import type { VisitPlan } from '@/types/visitPlan';
import { BILLING_ENABLED } from '@/constants/plus';
import { canAddPlan, countUpcomingPlans } from '@utils/plus';
import { formatPlanDate } from '@utils/planDate';
import { toLocalDateString } from '@utils/localDate';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

type Props = PlanStackScreenProps<'PlanCalendar'>;

/** 「に保存しました」を出しておく長さ */
const SAVED_TOAST_MS = 3200;
/** プラスの案内のシートが閉じる動きの長さ。onDismiss が来ないときはこのあとに次の画面へ */
const SHEET_DISMISS_MS = 350;

/**
 * 予定タブ（Issue #258）。開くとカレンダー。空いた日を押すとその日付で予定を組む。
 * 予定は1社への操作ではなくアプリ全体の機能なので、入口はこのタブだけ
 */
export function PlanCalendarScreen({ navigation, route }: Props) {
  const { isAuthenticated } = useAuth();
  const today = useMemo(() => new Date(), []);
  const { plans, visitedByDate, error, reload } = useVisitPlans(today);
  const savedOn = route.params?.savedOn;
  const [month, setMonth] = useState(() => {
    const base = savedOn
      ? savedOn.split('-').map(Number)
      : [today.getFullYear(), today.getMonth() + 1];
    return { year: base[0], month: base[1] };
  });
  const [toast, setToast] = useState<string | null>(null);

  // 保存して戻ったら、その月を開いて一言出す
  useEffect(() => {
    if (!savedOn) return;
    const [y, m] = savedOn.split('-').map(Number);
    setMonth({ year: y, month: m });
    setToast(`${formatPlanDate(savedOn)} に保存しました`);
    navigation.setParams({ savedOn: undefined });
  }, [navigation, savedOn]);

  // 消すタイマーは params と切り離す（setParams で上の effect が走り直しても消える）
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), SAVED_TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const plansByDate = useMemo(() => new Map(plans.map(p => [p.plannedOn, p])), [plans]);
  const todayKey = toLocalDateString(today);
  const nextPlan: VisitPlan | undefined = plans.find(p => p.plannedOn >= todayKey);

  // ── プラスの案内（Issue #270 の ①）。これからの予定が無料の枠を使い切っているときだけ ──
  const plus = usePlus();
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  // シートが閉じきってから次の画面へ進む（開いたまま push すると画面がシートの裏に出る / D-9）
  const afterClose = useRef<(() => void) | null>(null);
  const [closing, setClosing] = useState(false);
  const runAfterClose = useCallback(() => {
    const next = afterClose.current;
    afterClose.current = null;
    setClosing(false);
    next?.();
  }, []);
  useEffect(() => {
    if (!closing || sheetDate !== null) return;
    // onDismiss は iOS だけ。来なくても閉じる動きの長さのあとに進む
    const t = setTimeout(runAfterClose, SHEET_DISMISS_MS);
    return () => clearTimeout(t);
  }, [closing, sheetDate, runAfterClose]);
  const closeSheetThen = (next: () => void) => {
    afterClose.current = next;
    setClosing(true);
    setSheetDate(null);
  };

  /** 予定を足せるか。足せなければプラスの案内を出す（課金をオンにするまでは誰でも足せる） */
  const guardAdd = (ymd: string): boolean => {
    if (canAddPlan(countUpcomingPlans(plans, todayKey), plus.isPlus, BILLING_ENABLED)) return true;
    setSheetDate(ymd);
    return false;
  };

  const handleNew = () => {
    if (guardAdd(todayKey)) navigation.navigate('PlanEditor', { date: todayKey });
  };

  const handlePressDay = (ymd: string) => {
    const plan = plansByDate.get(ymd);
    if (plan) {
      navigation.navigate('PlanEditor', { planId: plan.id });
      return;
    }
    if (guardAdd(ymd)) navigation.navigate('PlanEditor', { date: ymd });
  };

  const shiftMonth = (delta: number) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>予定</Text>
        <View testID="plan-guest-empty-state" style={styles.guestWrap}>
          <Card style={styles.guestCard}>
            <MaterialIcons name="event" size={40} color={colors.primary[500]} />
            <Text style={styles.guestText}>ログインすると、行きたい寺社を回る予定を組めます</Text>
            <Button
              title="ログインして始める"
              variant="primary"
              testID="plan-login-cta"
              onPress={() => navigation.navigate('Login')}
              style={styles.guestCta}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 上下には動かさない（横スワイプの月送りのときに縦に揺れるため）。6週と次の予定は画面に収まる */}
      <View style={styles.scroll}>
        <View style={styles.monthRow}>
          <Text style={styles.monthTitle}>{`${month.year}年${month.month}月`}</Text>
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => shiftMonth(-1)}
              testID="plan-prev-month"
              accessibilityLabel="前の月"
              hitSlop={12}
            >
              <MaterialIcons name="chevron-left" size={28} color={colors.gray[500]} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => shiftMonth(1)}
              testID="plan-next-month"
              accessibilityLabel="次の月"
              hitSlop={12}
            >
              <MaterialIcons name="chevron-right" size={28} color={colors.gray[500]} />
            </TouchableOpacity>
          </View>
        </View>

        <PlanCalendar
          year={month.year}
          month={month.month}
          today={today}
          plansByDate={plansByDate}
          visitedByDate={visitedByDate}
          onPressDay={handlePressDay}
          onSwipeMonth={shiftMonth}
        />

        {error ? (
          <View style={styles.error} testID="plan-load-error">
            <Text style={styles.errorText}>予定を読み込めませんでした</Text>
            <Button title="もう一度" variant="outline" onPress={reload} testID="plan-retry" />
          </View>
        ) : nextPlan ? (
          <TouchableOpacity
            style={styles.next}
            onPress={() => navigation.navigate('PlanEditor', { planId: nextPlan.id })}
            testID="plan-next-card"
          >
            <Text style={styles.nextLabel}>次の予定</Text>
            <Text style={styles.nextTitle}>
              {`${formatPlanDate(nextPlan.plannedOn)} ${nextPlan.name}`}
            </Text>
            <Text style={styles.nextSpots} numberOfLines={2}>
              {nextPlan.stops.map(s => s.spot.name).join(' → ')}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hint}>
            {
              '行きたい寺社を回る予定を組んでみましょう。\n空いている日を押すと、その日の予定を組めます。'
            }
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={handleNew} testID="plan-new">
        <Text style={styles.fabText}>＋ 予定を組む</Text>
      </TouchableOpacity>

      <PlusSheet
        targetDate={sheetDate}
        nextPlan={nextPlan}
        plus={plus}
        onClose={() => setSheetDate(null)}
        onDismiss={runAfterClose}
        onPurchased={() => {
          const date = sheetDate ?? todayKey;
          closeSheetThen(() => navigation.navigate('PlanEditor', { date, purchased: true }));
        }}
        onTerms={() => closeSheetThen(() => navigation.navigate('TermsOfService'))}
        onPrivacy={() => closeSheetThen(() => navigation.navigate('PrivacyPolicy'))}
      />

      {toast && (
        <View style={styles.toast} testID="plan-saved-toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { paddingBottom: 120 },
  title: { ...typography.h2, color: colors.gray[900], padding: spacing.lg },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  monthTitle: { ...typography.h2, color: colors.gray[900] },
  monthNav: { flexDirection: 'row', gap: spacing.lg },
  next: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  nextLabel: { ...typography.caption, fontWeight: '700', color: colors.gray[400] },
  nextTitle: { ...typography.body, fontWeight: '700', color: colors.gray[900], marginTop: 2 },
  nextSpots: { ...typography.caption, color: colors.gray[500], marginTop: 2 },
  hint: {
    ...typography.caption,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
    lineHeight: 20,
  },
  error: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  errorText: { ...typography.bodySmall, color: colors.gray[600] },
  fab: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.md,
    height: 50,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  fabText: { ...typography.body, fontWeight: '700', color: colors.white },
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 80,
    backgroundColor: colors.gray[900],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  toastText: { ...typography.bodySmall, color: colors.white, textAlign: 'center' },
  guestWrap: { padding: spacing.lg },
  guestCard: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  guestText: { ...typography.body, color: colors.gray[700], textAlign: 'center' },
  guestCta: { alignSelf: 'stretch' },
});
