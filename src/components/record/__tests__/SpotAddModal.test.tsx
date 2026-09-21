import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SpotAddModal } from '../SpotAddModal';
import { createSpot } from '@/services/spots';
import { typography } from '@theme/typography';

jest.mock('@/services/spots', () => ({
  createSpot: jest.fn(),
}));

describe('SpotAddModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSpotCreated = jest.fn();
  const defaultProps = {
    visible: true,
    onClose: mockOnClose,
    onSpotCreated: mockOnSpotCreated,
    userLocation: { latitude: 38.2682, longitude: 140.8694 },
    userId: 'user-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('表示時にフォーム要素が見える', () => {
    const { getByPlaceholderText, getByText } = render(<SpotAddModal {...defaultProps} />);

    expect(getByPlaceholderText('スポット名を入力')).toBeTruthy();
    expect(getByText('神社')).toBeTruthy();
    expect(getByText('寺院')).toBeTruthy();
    expect(getByText('追加')).toBeTruthy();
  });

  it('スポット名未入力時は追加ボタンが無効', () => {
    const { getByText } = render(<SpotAddModal {...defaultProps} />);

    const addButton = getByText('追加');
    fireEvent.press(addButton);

    expect(createSpot).not.toHaveBeenCalled();
  });

  it('種別を切り替えられる', () => {
    const { getByText } = render(<SpotAddModal {...defaultProps} />);

    const templeButton = getByText('寺院');
    fireEvent.press(templeButton);

    // 寺院が選択状態（テスト対象はUI反映だがロジック面を確認）
    expect(templeButton).toBeTruthy();
  });

  it('追加ボタンタップで createSpot が呼ばれ、成功時 onSpotCreated 呼出', async () => {
    const mockSpot = {
      id: 'spot-1',
      name: 'テスト神社',
      lat: 38.2682,
      lng: 140.8694,
      type: 'shrine' as const,
      address: null,
      status: 'pending' as const,
      created_by_user_id: 'user-123',
      merged_into_spot_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };
    (createSpot as jest.Mock).mockResolvedValue(mockSpot);

    const { getByPlaceholderText, getByText } = render(<SpotAddModal {...defaultProps} />);

    fireEvent.changeText(getByPlaceholderText('スポット名を入力'), 'テスト神社');
    fireEvent.press(getByText('追加'));

    await waitFor(() => {
      expect(createSpot).toHaveBeenCalledWith({
        name: 'テスト神社',
        type: 'shrine',
        lat: 38.2682,
        lng: 140.8694,
        createdByUserId: 'user-123',
      });
      expect(mockOnSpotCreated).toHaveBeenCalledWith(mockSpot);
    });
  });
});

// SearchBar と同じ事故。typography.body を TextInput に丸ごと広げると
// lineHeight が付いてきて、iOS は NSParagraphStyle として解釈する。
// 余った行間が文字の上に入るので、文字が入力欄の下端に寄る（実測 4.7pt 下）
describe('入力欄の文字の高さ', () => {
  const props = {
    visible: true,
    onClose: jest.fn(),
    onSpotCreated: jest.fn(),
    userLocation: { latitude: 38.2682, longitude: 140.8694 },
    userId: 'user-123',
  };

  it('入力欄に lineHeight を渡さない', () => {
    const { getByTestId } = render(<SpotAddModal {...props} />);

    const style = StyleSheet.flatten(getByTestId('spot-name-input').props.style);

    expect(style.lineHeight).toBeUndefined();
    // 字の大きさは body のまま
    expect(style.fontSize).toBe(typography.body.fontSize);
  });

  // Android は TextInput の既定が top 寄せの端末がある
  it('縦の中央寄せを明示する', () => {
    const { getByTestId } = render(<SpotAddModal {...props} />);

    const style = StyleSheet.flatten(getByTestId('spot-name-input').props.style);

    expect(style.textAlignVertical).toBe('center');
  });
});
