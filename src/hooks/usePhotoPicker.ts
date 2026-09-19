import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const pickerOptions = {
  allowsEditing: false,
  quality: 0.8,
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface UsePhotoPickerReturn {
  /** カメラを起動する。権限が無い / キャンセル / 失敗のときは null */
  takePhoto: () => Promise<string | null>;
  /**
   * ギャラリーを開く。複数選べる。キャンセル / 失敗のときは空配列。
   * `limit` にはあと何枚入るかを渡す
   */
  pickFromLibrary: (limit: number) => Promise<string[]>;
}

/**
 * 御朱印の写真を取る導線。
 *
 * 記録フローの最短化（Issue #130）で選択モーダルを廃したため、
 * 画面側は写真枠のタップで takePhoto、リンクで pickFromLibrary を直接呼ぶ。
 * 権限とエラーの扱いはここに集約する
 */
export function usePhotoPicker(): UsePhotoPickerReturn {
  const takePhoto = useCallback(async (): Promise<string | null> => {
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
        return null;
      }

      const result = await ImagePicker.launchCameraAsync(pickerOptions);
      if (result.canceled) return null;
      return result.assets[0].uri;
    } catch (error) {
      Alert.alert('カメラを起動できませんでした', describeError(error));
      return null;
    }
  }, []);

  const pickFromLibrary = useCallback(async (limit: number): Promise<string[]> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        ...pickerOptions,
        allowsMultipleSelection: true,
        selectionLimit: limit,
      });
      if (result.canceled) return [];
      return result.assets.map(asset => asset.uri);
    } catch (error) {
      Alert.alert('写真を選べませんでした', describeError(error));
      return [];
    }
  }, []);

  return { takePhoto, pickFromLibrary };
}
