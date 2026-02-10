import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Modal } from '@components/common/Modal';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface PhotoPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (uri: string) => void;
}

const pickerOptions = {
  allowsEditing: true,
  aspect: [3, 4] as [number, number],
  quality: 0.8,
};

export function PhotoPickerModal({ visible, onClose, onImageSelected }: PhotoPickerModalProps) {
  const handleCamera = async () => {
    const result = await ImagePicker.launchCameraAsync(pickerOptions);
    if (!result.canceled) {
      onImageSelected(result.assets[0].uri);
    }
  };

  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result.canceled) {
      onImageSelected(result.assets[0].uri);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom" title="写真を追加">
      <TouchableOpacity style={styles.option} onPress={handleCamera} activeOpacity={0.7}>
        <Text style={styles.optionText}>カメラで撮影</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={handleGallery} activeOpacity={0.7}>
        <Text style={styles.optionText}>ギャラリーから選択</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelOption} onPress={onClose} activeOpacity={0.7}>
        <Text style={styles.cancelText}>キャンセル</Text>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  option: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  optionText: {
    ...typography.body,
    color: colors.gray[800],
    textAlign: 'center',
  },
  cancelOption: {
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  cancelText: {
    ...typography.body,
    color: colors.gray[400],
    textAlign: 'center',
  },
});
