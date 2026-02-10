import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PhotoPickerModal } from '../PhotoPickerModal';
import * as ImagePicker from 'expo-image-picker';

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

describe('PhotoPickerModal', () => {
  const mockOnClose = jest.fn();
  const mockOnImageSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('表示時に3つの選択肢が見える', () => {
    const { getByText } = render(
      <PhotoPickerModal
        visible={true}
        onClose={mockOnClose}
        onImageSelected={mockOnImageSelected}
      />
    );

    expect(getByText('カメラで撮影')).toBeTruthy();
    expect(getByText('ギャラリーから選択')).toBeTruthy();
    expect(getByText('キャンセル')).toBeTruthy();
  });

  it('カメラ撮影タップで launchCameraAsync が呼ばれる', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://camera-photo.jpg' }],
    });

    const { getByText } = render(
      <PhotoPickerModal
        visible={true}
        onClose={mockOnClose}
        onImageSelected={mockOnImageSelected}
      />
    );

    fireEvent.press(getByText('カメラで撮影'));

    await waitFor(() => {
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      expect(mockOnImageSelected).toHaveBeenCalledWith('file://camera-photo.jpg');
    });
  });

  it('ギャラリー選択タップで launchImageLibraryAsync が呼ばれる', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://gallery-photo.jpg' }],
    });

    const { getByText } = render(
      <PhotoPickerModal
        visible={true}
        onClose={mockOnClose}
        onImageSelected={mockOnImageSelected}
      />
    );

    fireEvent.press(getByText('ギャラリーから選択'));

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      expect(mockOnImageSelected).toHaveBeenCalledWith('file://gallery-photo.jpg');
    });
  });

  it('キャンセルタップで onClose が呼ばれる', () => {
    const { getByText } = render(
      <PhotoPickerModal
        visible={true}
        onClose={mockOnClose}
        onImageSelected={mockOnImageSelected}
      />
    );

    fireEvent.press(getByText('キャンセル'));

    expect(mockOnClose).toHaveBeenCalled();
  });
});
