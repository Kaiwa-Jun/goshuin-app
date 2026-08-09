import React from 'react';
import { Alert, Linking, TouchableOpacity, Text, StyleSheet } from 'react-native';
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
  allowsEditing: false,
  quality: 0.8,
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function PhotoPickerModal({ visible, onClose, onImageSelected }: PhotoPickerModalProps) {
  const handleCamera = async () => {
    try {
      // iOS は一度拒否されると OS のダイアログが二度と出ない。
      // 説明なしに何も起きないと「壊れている」と読めるので、必ず設定への導線を出す
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'カメラを使えません',
          'カメラへのアクセスが許可されていません。設定から許可すると撮影できます。',
          [
            { text: '閉じる', style: 'cancel' },
            { text: '設定を開く', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync(pickerOptions);
      if (!result.canceled) {
        onImageSelected(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('カメラを起動できませんでした', describeError(error));
    }
  };

  const handleGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (!result.canceled) {
        onImageSelected(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('写真を選べませんでした', describeError(error));
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
