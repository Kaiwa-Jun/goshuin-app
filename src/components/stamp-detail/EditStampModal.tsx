import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { Modal } from '@components/common/Modal';
import { Button } from '@components/common/Button';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

interface EditStampModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (params: { visited_at: string; memo: string | null }) => void;
  isUpdating: boolean;
  initialVisitedAt: string;
  initialMemo: string | null;
}

export function EditStampModal({
  visible,
  onClose,
  onSave,
  isUpdating,
  initialVisitedAt,
  initialMemo,
}: EditStampModalProps) {
  const [visitedAt, setVisitedAt] = useState(initialVisitedAt);
  const [memo, setMemo] = useState(initialMemo ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setVisitedAt(initialVisitedAt);
      setMemo(initialMemo ?? '');
      setShowDatePicker(false);
    }
  }, [visible, initialVisitedAt, initialMemo]);

  const visitedAtDate = (() => {
    const [y, m, d] = visitedAt.split('-').map(Number);
    return new Date(y, m - 1, d);
  })();

  const formattedDate = visitedAt.replace(/-/g, '/');

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      setVisitedAt(`${y}-${m}-${d}`);
    }
  };

  const handleSave = () => {
    onSave({
      visited_at: visitedAt,
      memo: memo.trim() === '' ? null : memo,
    });
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom" title="御朱印を編集">
      <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>訪問日</Text>
          <TouchableOpacity
            style={styles.dateRow}
            onPress={() => setShowDatePicker(!showDatePicker)}
            testID="date-picker-trigger"
          >
            <MaterialIcons name="calendar-today" size={20} color={colors.gray[500]} />
            <Text style={styles.dateText}>{formattedDate}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <View>
              <DateTimePicker
                value={visitedAtDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                themeVariant="light"
                testID="date-picker"
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.dateConfirmButton}
                  onPress={() => setShowDatePicker(false)}
                  testID="date-confirm-button"
                >
                  <Text style={styles.dateConfirmText}>完了</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>メモ</Text>
          <TextInput
            style={[styles.input, styles.memoInput]}
            value={memo}
            onChangeText={setMemo}
            placeholder="メモを入力"
            multiline
          />
        </View>
      </ScrollView>
      <View style={styles.buttons}>
        <Button title="キャンセル" onPress={onClose} variant="outline" style={styles.button} />
        <Button
          title={isUpdating ? '保存中...' : '保存'}
          onPress={handleSave}
          variant="primary"
          disabled={isUpdating}
          style={styles.button}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    maxHeight: 420,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.gray[500],
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.gray[800],
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  memoInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  dateText: {
    ...typography.body,
    color: colors.gray[800],
  },
  dateConfirmButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  dateConfirmText: {
    ...typography.body,
    color: colors.primary[500],
    fontWeight: '600',
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
