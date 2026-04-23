import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

describe('DeleteConfirmModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    isDeleting: false,
    spotName: '伊勢神宮',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('visible=true で表示される', () => {
    const { getByTestId } = render(<DeleteConfirmModal {...defaultProps} />);
    expect(getByTestId('modal-content')).toBeTruthy();
  });

  it('スポット名が表示される', () => {
    const { getByText } = render(<DeleteConfirmModal {...defaultProps} />);
    expect(getByText('伊勢神宮')).toBeTruthy();
  });

  it('キャンセルボタンで onClose が呼ばれる', () => {
    const onClose = jest.fn();
    const { getByText } = render(<DeleteConfirmModal {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByText('キャンセル'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('削除ボタンで onConfirm が呼ばれる', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(<DeleteConfirmModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.press(getByText('削除する'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('isDeleting=true で「削除中...」表示 + ボタン disabled', () => {
    const { getByText, getByTestId } = render(
      <DeleteConfirmModal {...defaultProps} isDeleting={true} />
    );
    expect(getByText('削除中...')).toBeTruthy();
    const deleteButton = getByTestId('button-primary');
    expect(deleteButton.props.accessibilityState?.disabled).toBe(true);
  });
});
