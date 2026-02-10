import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Modal } from '@components/common/Modal';
import { Button } from '@components/common/Button';
import { Badge } from '@components/common/Badge';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  spotName: string;
  spotType: 'shrine' | 'temple';
  visitedAt: Date;
  isSubmitting: boolean;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}年${m}月${d}日`;
}

export function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  spotName,
  spotType,
  visitedAt,
  isSubmitting,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} variant="center" title="登録内容の確認">
      <View style={styles.row}>
        <Text style={styles.label}>スポット</Text>
        <View style={styles.spotRow}>
          <Text style={styles.value}>{spotName}</Text>
          <Badge type={spotType} />
        </View>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>訪問日</Text>
        <Text style={styles.value}>{formatDate(visitedAt)}</Text>
      </View>
      <View style={styles.buttons}>
        <Button title="戻る" onPress={onClose} variant="outline" style={styles.button} />
        <Button
          title={isSubmitting ? '登録中...' : '登録する'}
          onPress={onConfirm}
          variant="primary"
          disabled={isSubmitting}
          style={styles.button}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: spacing.lg,
  },
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.gray[500],
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.body,
    color: colors.gray[800],
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
  },
});
