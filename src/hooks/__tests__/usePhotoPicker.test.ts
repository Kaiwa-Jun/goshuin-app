import { renderHook } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { usePhotoPicker } from '@hooks/usePhotoPicker';

const mockRequestCameraPermissionsAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...args: unknown[]) => mockRequestCameraPermissionsAsync(...args),
  launchCameraAsync: (...args: unknown[]) => mockLaunchCameraAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

describe('usePhotoPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  describe('takePhoto', () => {
    it('権限があればカメラを起動し、撮影した URI を返す', async () => {
      mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockLaunchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///photo.jpg' }],
      });

      const { result } = renderHook(() => usePhotoPicker());
      const uri = await result.current.takePhoto();

      expect(mockLaunchCameraAsync).toHaveBeenCalled();
      expect(uri).toBe('file:///photo.jpg');
    });

    // C-4: 権限が無いのに起動しようとしない
    it('権限が無ければカメラを起動せず Alert を出す', async () => {
      mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const { result } = renderHook(() => usePhotoPicker());
      const uri = await result.current.takePhoto();

      expect(mockLaunchCameraAsync).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalled();
      expect(uri).toBeNull();
    });

    // C-5: iOS は一度拒否されると OS ダイアログが二度と出ないため、設定への導線が必須
    it('権限拒否の Alert から設定を開ける', async () => {
      mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' });
      const openSettings = jest
        .spyOn(Linking, 'openSettings')
        .mockImplementation(() => Promise.resolve());

      const { result } = renderHook(() => usePhotoPicker());
      await result.current.takePhoto();

      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const settingsButton = buttons.find((b: { text: string }) => b.text === '設定を開く');
      expect(settingsButton).toBeDefined();

      settingsButton.onPress();
      expect(openSettings).toHaveBeenCalled();
    });

    // C-7: キャンセルを「選択なし」として扱う
    it('撮影をキャンセルしたら null を返す', async () => {
      mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockLaunchCameraAsync.mockResolvedValue({ canceled: true });

      const { result } = renderHook(() => usePhotoPicker());
      const uri = await result.current.takePhoto();

      expect(uri).toBeNull();
    });

    // C-8: 起動に失敗したら原文を出す（A-1 で「何も起きない」に見えた反省）
    it('カメラ起動が失敗したらエラー原文を Alert に出す', async () => {
      mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockLaunchCameraAsync.mockRejectedValue(new Error('camera unavailable'));

      const { result } = renderHook(() => usePhotoPicker());
      const uri = await result.current.takePhoto();

      const messages = (Alert.alert as jest.Mock).mock.calls.map(c => `${c[0]} ${c[1]}`).join('\n');
      expect(messages).toContain('camera unavailable');
      expect(uri).toBeNull();
    });
  });

  describe('pickFromLibrary', () => {
    it('ギャラリーを開き、選んだ URI を返す', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///library.jpg' }],
      });

      const { result } = renderHook(() => usePhotoPicker());
      const uri = await result.current.pickFromLibrary();

      expect(mockLaunchImageLibraryAsync).toHaveBeenCalled();
      expect(uri).toBe('file:///library.jpg');
    });

    it('選択をキャンセルしたら null を返す', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true });

      const { result } = renderHook(() => usePhotoPicker());
      const uri = await result.current.pickFromLibrary();

      expect(uri).toBeNull();
    });

    it('ギャラリーが失敗したらエラー原文を Alert に出す', async () => {
      mockLaunchImageLibraryAsync.mockRejectedValue(new Error('library unavailable'));

      const { result } = renderHook(() => usePhotoPicker());
      const uri = await result.current.pickFromLibrary();

      const messages = (Alert.alert as jest.Mock).mock.calls.map(c => `${c[0]} ${c[1]}`).join('\n');
      expect(messages).toContain('library unavailable');
      expect(uri).toBeNull();
    });
  });
});
