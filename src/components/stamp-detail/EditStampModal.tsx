import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Modal } from '@components/common/Modal';
import { Button } from '@components/common/Button';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

const pickerOptions = {
  allowsEditing: false,
  quality: 0.8,
};

interface EditStampModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (params: { visited_at: string; memo: string | null; newImageUri?: string }) => void;
  isUpdating: boolean;
  initialVisitedAt: string;
  initialMemo: string | null;
  initialImageUrl: string;
}

export function EditStampModal({
  visible,
  onClose,
  onSave,
  isUpdating,
  initialVisitedAt,
  initialMemo,
  initialImageUrl,
}: EditStampModalProps) {
  const [visitedAt, setVisitedAt] = useState(initialVisitedAt);
  const [memo, setMemo] = useState(initialMemo ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  useEffect(() => {
    if (visible) {
      setVisitedAt(initialVisitedAt);
      setMemo(initialMemo ?? '');
      setShowDatePicker(false);
      setNewImageUri(null);
      setShowPhotoOptions(false);
    }
  }, [visible, initialVisitedAt, initialMemo]);

  const handleCamera = async () => {
    setShowPhotoOptions(false);
    const result = await ImagePicker.launchCameraAsync(pickerOptions);
    if (!result.canceled) {
      setNewImageUri(result.assets[0].uri);
    }
  };

  const handleGallery = async () => {
    setShowPhotoOptions(false);
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result.canceled) {
      setNewImageUri(result.assets[0].uri);
    }
  };

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
      ...(newImageUri ? { newImageUri } : {}),
    });
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom" title="御朱印を編集">
      <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>写真</Text>
          <TouchableOpacity
            style={styles.imageRow}
            onPress={() => setShowPhotoOptions(!showPhotoOptions)}
            activeOpacity={0.7}
            testID="image-change-trigger"
          >
            <Image
              source={{ uri: newImageUri ?? initialImageUrl }}
              style={styles.imageThumbnail}
              testID="edit-stamp-image"
            />
            <View style={styles.imageInfo}>
              <View style={styles.imageChangeLabel}>
                <MaterialIcons name="photo-camera" size={18} color={colors.primary[500]} />
                <Text style={styles.imageChangeText}>写真を変更</Text>
              </View>
              {newImageUri && <Text style={styles.imageChangedBadge}>変更済み</Text>}
            </View>
          </TouchableOpacity>
          {showPhotoOptions && (
            <View style={styles.photoOptions} testID="photo-options">
              <TouchableOpacity
                style={styles.photoOption}
                onPress={handleCamera}
                activeOpacity={0.7}
                testID="camera-option"
              >
                <MaterialIcons name="camera-alt" size={20} color={colors.gray[600]} />
                <Text style={styles.photoOptionText}>カメラで撮影</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoOption}
                onPress={handleGallery}
                activeOpacity={0.7}
                testID="gallery-option"
              >
                <MaterialIcons name="photo-library" size={20} color={colors.gray[600]} />
                <Text style={styles.photoOptionText}>ギャラリーから選択</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
    maxHeight: 500,
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
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  imageThumbnail: {
    width: 80,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[200],
  },
  imageInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  imageChangeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  imageChangeText: {
    ...typography.body,
    color: colors.primary[500],
    fontWeight: '600',
  },
  imageChangedBadge: {
    ...typography.caption,
    color: colors.primary[600],
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  photoOptions: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  photoOptionText: {
    ...typography.body,
    color: colors.gray[700],
  },
});
