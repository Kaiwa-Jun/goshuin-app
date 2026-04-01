import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ImagePreviewModal } from '../ImagePreviewModal';

describe('ImagePreviewModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    imageUrl: 'https://example.com/stamp.jpg',
    userName: 'テストユーザー',
    memo: '素敵な御朱印でした',
    visitedAt: '2024-06-15',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('visible=true で画像が表示されること', () => {
    const { getByTestId } = render(<ImagePreviewModal {...defaultProps} />);
    expect(getByTestId('preview-image')).toBeTruthy();
  });

  it('visible=false で何も表示されないこと', () => {
    const { queryByTestId } = render(<ImagePreviewModal {...defaultProps} visible={false} />);
    expect(queryByTestId('preview-image')).toBeNull();
  });

  it('ユーザー名が表示されること', () => {
    const { getByText } = render(<ImagePreviewModal {...defaultProps} />);
    expect(getByText('テストユーザー')).toBeTruthy();
  });

  it('メモが表示されること', () => {
    const { getByText } = render(<ImagePreviewModal {...defaultProps} />);
    expect(getByText('素敵な御朱印でした')).toBeTruthy();
  });

  it('訪問日が表示されること', () => {
    const { getByText } = render(<ImagePreviewModal {...defaultProps} />);
    expect(getByText('2024/06/15')).toBeTruthy();
  });

  it('閉じるボタンのタップで onClose が呼ばれること', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<ImagePreviewModal {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByTestId('close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ユーザー名が null の場合は表示されないこと', () => {
    const { queryByTestId } = render(<ImagePreviewModal {...defaultProps} userName={null} />);
    expect(queryByTestId('preview-username')).toBeNull();
  });

  it('メモが null の場合は表示されないこと', () => {
    const { queryByTestId } = render(<ImagePreviewModal {...defaultProps} memo={null} />);
    expect(queryByTestId('preview-memo')).toBeNull();
  });
});
