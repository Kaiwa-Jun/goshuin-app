import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConfirmModal } from '../ConfirmModal';

describe('ConfirmModal', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();
  const defaultProps = {
    visible: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    spotName: '仙台東照宮',
    spotType: 'shrine' as const,
    visitedAt: new Date(2024, 5, 15), // 2024年6月15日
    isSubmitting: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('スポット名、種別バッジ、訪問日が表示される', () => {
    const { getByText, getByTestId } = render(<ConfirmModal {...defaultProps} />);

    expect(getByText('仙台東照宮')).toBeTruthy();
    expect(getByTestId('badge-shrine')).toBeTruthy();
    expect(getByText('2024年06月15日')).toBeTruthy();
  });

  it('「戻る」タップで onClose 呼出', () => {
    const { getByText } = render(<ConfirmModal {...defaultProps} />);

    fireEvent.press(getByText('戻る'));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('「登録する」タップで onConfirm 呼出', () => {
    const { getByText } = render(<ConfirmModal {...defaultProps} />);

    fireEvent.press(getByText('登録する'));

    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it('isSubmitting=true で「登録中...」表示、ボタン無効', () => {
    const { getByText } = render(<ConfirmModal {...defaultProps} isSubmitting={true} />);

    expect(getByText('登録中...')).toBeTruthy();

    fireEvent.press(getByText('登録中...'));
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
