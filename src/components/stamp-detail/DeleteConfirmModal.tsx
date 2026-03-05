import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Modal } from '@components/common/Modal';
import { Button } from '@components/common/Button';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface DeleteConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  spotName: string;
}

export function DeleteConfirmModal({
  visible,
  onClose,
  onConfirm,
  isDeleting,
  spotName,
}: DeleteConfirmModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} variant="center" title="御朱印を削除">
      <Text style={styles.spotName}>{spotName}</Text>
      <Text style={styles.message}>この御朱印を削除しますか？この操作は元に戻せません。</Text>
      <View style={styles.buttons}>
        <Button title="キャンセル" onPress={onClose} variant="outline" style={styles.button} />
        <Button
          title={isDeleting ? '削除中...' : '削除する'}
          onPress={onConfirm}
          variant="primary"
          disabled={isDeleting}
          style={{ flex: 1, backgroundColor: colors.error }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  spotName: {
    ...typography.body,
    color: colors.gray[800],
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.gray[600],
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
  },
});
