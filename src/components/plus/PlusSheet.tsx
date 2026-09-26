import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Modal } from '@components/common/Modal';
import { PlusPlanCards } from '@components/plus/PlusPlanCards';
import { PlusPurchasePanel } from '@components/plus/PlusPurchasePanel';
import type { usePlus } from '@hooks/usePlus';
import type { VisitPlan } from '@/types/visitPlan';
import { formatPlanDate } from '@utils/planDate';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

interface Props {
  /** 押そうとした日（YYYY-MM-DD）。null なら閉じている */
  targetDate: string | null;
  nextPlan: VisitPlan | undefined;
  plus: ReturnType<typeof usePlus>;
  onClose: () => void;
  onDismiss?: () => void;
  onPurchased: () => void;
  onRestored: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
}

/**
 * 予定の2件目を組もうとしたときのプラスの案内（Issue #270 の B / D-16）。
 * 入っている予定と押そうとした日を並べ、何が増えるかをその人の予定で見せる
 */
export function PlusSheet({
  targetDate,
  nextPlan,
  plus,
  onClose,
  onDismiss,
  onPurchased,
  onRestored,
  onTerms,
  onPrivacy,
}: Props) {
  // 開いていて、買う・復元するの最中でないときだけ中身を変える（S6 のシミュレータで見つけた）。
  // 買えた直後は CustomerInfo の更新が先に来て「購入済み」に変わり、閉じると日付が null になって
  // 「ここにも入れる」の枠が消えるので、閉じていくシートが縮んでいた
  const [shown, setShown] = useState({ date: targetDate, isPlus: plus.isPlus });
  if (
    targetDate !== null &&
    !plus.busy &&
    (shown.date !== targetDate || shown.isPlus !== plus.isPlus)
  ) {
    setShown({ date: targetDate, isPlus: plus.isPlus });
  }

  return (
    <Modal visible={targetDate !== null} onClose={onClose} onDismiss={onDismiss} variant="bottom">
      <View testID="plus-sheet">
        <TouchableOpacity
          style={styles.close}
          onPress={onClose}
          accessibilityLabel="閉じる"
          hitSlop={8}
        >
          <MaterialIcons name="close" size={24} color={colors.gray[400]} />
        </TouchableOpacity>
        <Text style={styles.title}>予定をいくつでも入れるならプラス</Text>
        <View style={styles.slots}>
          {nextPlan && (
            <View style={styles.slot}>
              <Text style={styles.slotDate}>{formatPlanDate(nextPlan.plannedOn)}</Text>
              <Text style={styles.slotName} numberOfLines={1}>
                {nextPlan.name}
              </Text>
            </View>
          )}
          {shown.date && (
            <View style={[styles.slot, styles.want]} testID="plus-sheet-target">
              <Text style={styles.slotDate}>{formatPlanDate(shown.date)}</Text>
              <View style={styles.wantRow}>
                <MaterialIcons name="add" size={16} color={colors.primary[700]} />
                <Text style={styles.wantText}>ここにも入れる</Text>
              </View>
            </View>
          )}
        </View>
        <PlusPlanCards priceString={plus.priceString} />
        <PlusPurchasePanel
          plus={{ ...plus, isPlus: shown.isPlus }}
          onLater={onClose}
          onPurchased={onPurchased}
          onRestored={onRestored}
          onTerms={onTerms}
          onPrivacy={onPrivacy}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  close: { position: 'absolute', right: 0, top: 0, zIndex: 1 },
  title: {
    ...typography.h3,
    fontWeight: '800',
    color: colors.gray[900],
    paddingRight: spacing['2xl'],
  },
  slots: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  slot: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  want: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  slotDate: { ...typography.caption, fontWeight: '800', color: colors.gray[500] },
  slotName: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.primary[700],
    marginTop: 2,
  },
  wantRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  wantText: { ...typography.bodySmall, fontWeight: '700', color: colors.primary[700] },
});
