import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Button } from '@components/common/Button';
import { Modal } from '@components/common/Modal';
import { addDays, formatPlanDate } from '@utils/planDate';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

/** 保存（名前だけ。日付はドロワーの見出しで決めてある / §0-10・D-18） */
export function PlanSaveSheet({
  visible,
  plannedOn,
  initialName,
  canDelete,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  plannedOn: string;
  initialName: string;
  canDelete: boolean;
  saving: boolean;
  onSave: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom" title="この予定を保存">
      <View testID="plan-save-sheet">
        <Text style={styles.label}>{`${formatPlanDate(plannedOn)}の予定の名前`}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={30}
          placeholder="例: 東山めぐり"
          placeholderTextColor={colors.gray[400]}
          style={styles.input}
          testID="plan-name-input"
        />
        <Button
          title="保存してカレンダーに入れる"
          onPress={() => onSave(name)}
          disabled={saving}
          testID="plan-save-submit"
          style={styles.submit}
        />
        {canDelete && (
          <TouchableOpacity onPress={onDelete} testID="plan-delete" style={styles.deleteRow}>
            <Text style={styles.deleteText}>この予定を消す</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

/** 日付を変える（1日ずつ。今日より前には戻れない / D-17） */
export function PlanDateSheet({
  visible,
  plannedOn,
  today,
  onDone,
  onClose,
}: {
  visible: boolean;
  plannedOn: string;
  today: string;
  onDone: (ymd: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(plannedOn);
  useEffect(() => {
    if (visible) setValue(plannedOn);
  }, [visible, plannedOn]);
  const canBack = value > today;

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom" title="いつの予定？">
      <View testID="plan-date-sheet">
        <View style={styles.stepper}>
          <TouchableOpacity
            style={[styles.step, !canBack && styles.stepDisabled]}
            onPress={() => setValue(v => addDays(v, -1))}
            disabled={!canBack}
            testID="plan-date-prev"
            accessibilityLabel="前の日"
          >
            <MaterialIcons name="chevron-left" size={24} color={colors.gray[600]} />
          </TouchableOpacity>
          <Text style={styles.dateValue} testID="plan-date-value">
            {formatPlanDate(value)}
          </Text>
          <TouchableOpacity
            style={styles.step}
            onPress={() => setValue(v => addDays(v, 1))}
            testID="plan-date-next"
            accessibilityLabel="次の日"
          >
            <MaterialIcons name="chevron-right" size={24} color={colors.gray[600]} />
          </TouchableOpacity>
        </View>
        <Button
          title="この日にする"
          onPress={() => onDone(value)}
          testID="plan-date-done"
          style={styles.submit}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.gray[500],
    marginBottom: spacing.sm,
  },
  // iOS の TextInput は lineHeight があると文字と placeholder が下にずれる。
  // 文字の大きさだけ使い、高さを決めて中央に置く
  input: {
    fontSize: typography.body.fontSize,
    color: colors.gray[900],
    height: 52,
    paddingVertical: 0,
    paddingHorizontal: spacing.md,
    textAlignVertical: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
  },
  submit: { marginTop: spacing.lg },
  deleteRow: { alignItems: 'center', marginTop: spacing.lg },
  deleteText: { ...typography.bodySmall, fontWeight: '700', color: colors.error },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  step: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.4 },
  dateValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.gray[900],
    flex: 1,
    textAlign: 'center',
  },
});
