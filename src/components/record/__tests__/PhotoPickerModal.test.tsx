import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PhotoPickerModal } from '../PhotoPickerModal';
import * as ImagePicker from 'expo-image-picker';

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

const mockRequestCameraPermissions = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockLaunchCamera = ImagePicker.launchCameraAsync as jest.Mock;
const mockLaunchImageLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

describe('PhotoPickerModal', () => {
  const mockOnClose = jest.fn();
  const mockOnImageSelected = jest.fn();

  const renderModal = () =>
    render(
      <PhotoPickerModal
        visible={true}
        onClose={mockOnClose}
        onImageSelected={mockOnImageSelected}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    // 既定は許可済み。拒否・失敗はテストごとに上書きする
    mockRequestCameraPermissions.mockResolvedValue({ status: 'granted', granted: true });
  });

  it('表示時に3つの選択肢が見える', () => {
    const { getByText } = renderModal();

    expect(getByText('カメラで撮影')).toBeTruthy();
    expect(getByText('ギャラリーから選択')).toBeTruthy();
    expect(getByText('キャンセル')).toBeTruthy();
  });

  it('カメラ撮影タップで launchCameraAsync が呼ばれる', async () => {
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://camera-photo.jpg' }],
    });

    const { getByText } = renderModal();

    fireEvent.press(getByText('カメラで撮影'));

    await waitFor(() => {
      expect(mockLaunchCamera).toHaveBeenCalledWith({
        allowsEditing: false,
        quality: 0.8,
      });
      expect(mockOnImageSelected).toHaveBeenCalledWith('file://camera-photo.jpg');
    });
  });

  it('ギャラリー選択タップで launchImageLibraryAsync が呼ばれる', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://gallery-photo.jpg' }],
    });

    const { getByText } = renderModal();

    fireEvent.press(getByText('ギャラリーから選択'));

    await waitFor(() => {
      expect(mockLaunchImageLibrary).toHaveBeenCalledWith({
        allowsEditing: false,
        quality: 0.8,
      });
      expect(mockOnImageSelected).toHaveBeenCalledWith('file://gallery-photo.jpg');
    });
  });

  it('キャンセルタップで onClose が呼ばれる', () => {
    const { getByText } = renderModal();

    fireEvent.press(getByText('キャンセル'));

    expect(mockOnClose).toHaveBeenCalled();
  });

  describe('カメラの権限', () => {
    it('カメラを開く前に権限をリクエストする', async () => {
      mockLaunchCamera.mockResolvedValue({ canceled: true });

      const { getByText } = renderModal();

      fireEvent.press(getByText('カメラで撮影'));

      await waitFor(() => {
        expect(mockRequestCameraPermissions).toHaveBeenCalled();
      });
    });

    it('権限が拒否されたらカメラを起動しない', async () => {
      mockRequestCameraPermissions.mockResolvedValue({ status: 'denied', granted: false });

      const { getByText } = renderModal();

      fireEvent.press(getByText('カメラで撮影'));

      await waitFor(() => {
        expect(mockRequestCameraPermissions).toHaveBeenCalled();
      });
      expect(mockLaunchCamera).not.toHaveBeenCalled();
      expect(mockOnImageSelected).not.toHaveBeenCalled();
    });

    it('権限が拒否されたら設定アプリへの導線を出す', async () => {
      mockRequestCameraPermissions.mockResolvedValue({ status: 'denied', granted: false });
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      const { getByText } = renderModal();

      fireEvent.press(getByText('カメラで撮影'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      const [title, message, buttons] = alertSpy.mock.calls[0];
      expect(title).toBe('カメラを使えません');
      expect(message).toContain('設定');
      const settingsButton = (buttons as { text: string; onPress?: () => void }[]).find(
        b => b.text === '設定を開く'
      );
      expect(settingsButton).toBeDefined();

      const openSettingsSpy = jest
        .spyOn(Linking, 'openSettings')
        .mockImplementation(() => Promise.resolve());
      settingsButton?.onPress?.();
      expect(openSettingsSpy).toHaveBeenCalled();

      alertSpy.mockRestore();
      openSettingsSpy.mockRestore();
    });
  });

  describe('起動に失敗したとき', () => {
    it('カメラが例外を投げても落ちず、原因を伝える', async () => {
      mockLaunchCamera.mockRejectedValue(new Error('Camera not available on this device'));
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      const { getByText } = renderModal();

      fireEvent.press(getByText('カメラで撮影'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      const [title, message] = alertSpy.mock.calls[0];
      expect(title).toBe('カメラを起動できませんでした');
      expect(message).toContain('Camera not available on this device');
      expect(mockOnImageSelected).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });

    it('ギャラリーが例外を投げても落ちず、原因を伝える', async () => {
      mockLaunchImageLibrary.mockRejectedValue(new Error('Photo library unavailable'));
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      const { getByText } = renderModal();

      fireEvent.press(getByText('ギャラリーから選択'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      const [title, message] = alertSpy.mock.calls[0];
      expect(title).toBe('写真を選べませんでした');
      expect(message).toContain('Photo library unavailable');
      expect(mockOnImageSelected).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });
  });
});
