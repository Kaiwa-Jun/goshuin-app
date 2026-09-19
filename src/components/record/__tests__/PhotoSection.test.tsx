import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Image } from 'react-native';
import { PhotoSection } from '../PhotoSection';
import { MAX_PHOTOS_PER_RECORD } from '@/constants/record';

jest
  .spyOn(Image, 'getSize')
  .mockImplementation((_uri: string, success: (width: number, height: number) => void) => {
    success(300, 400);
  });

describe('PhotoSection', () => {
  const mockOnAddPress = jest.fn();
  const mockOnRemove = jest.fn();

  const defaultProps = {
    imageUris: [],
    onAddPress: mockOnAddPress,
    onRemove: mockOnRemove,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('未選択時に「タップして撮影」テキスト表示', () => {
    const { getByText } = render(<PhotoSection {...defaultProps} />);

    expect(getByText('タップして撮影')).toBeTruthy();
  });

  it('選択済み時に Image コンポーネント表示', () => {
    const { getByTestId } = render(
      <PhotoSection {...defaultProps} imageUris={['file://photo.jpg']} />
    );

    expect(getByTestId('photo-preview-0')).toBeTruthy();
  });

  it('タップで onAddPress 呼出', () => {
    const { getByTestId } = render(<PhotoSection {...defaultProps} />);

    fireEvent.press(getByTestId('photo-section'));

    expect(mockOnAddPress).toHaveBeenCalled();
  });

  it('error 表示', () => {
    const { getByText } = render(<PhotoSection {...defaultProps} error="写真を選択してください" />);

    expect(getByText('写真を選択してください')).toBeTruthy();
  });

  // Issue #180: 1箇所で複数枚いただける寺社がある
  describe('複数枚', () => {
    it('選んだ枚数だけ並ぶ', () => {
      const { getByTestId, queryByTestId } = render(
        <PhotoSection {...defaultProps} imageUris={['file://a.jpg', 'file://b.jpg']} />
      );

      expect(getByTestId('photo-preview-0')).toBeTruthy();
      expect(getByTestId('photo-preview-1')).toBeTruthy();
      expect(queryByTestId('photo-preview-2')).toBeNull();
    });

    it('1枚ずつ外せる', () => {
      const { getByTestId } = render(
        <PhotoSection {...defaultProps} imageUris={['file://a.jpg', 'file://b.jpg']} />
      );

      fireEvent.press(getByTestId('photo-remove-1'));

      expect(mockOnRemove).toHaveBeenCalledWith('file://b.jpg');
    });

    // 撮影の導線は写真が入ったあとも残す。2枚目に気づいたとき詰まないように
    it('写真があっても追加ボタンから撮影できる', () => {
      const { getByTestId } = render(
        <PhotoSection {...defaultProps} imageUris={['file://a.jpg']} />
      );

      fireEvent.press(getByTestId('photo-add'));

      expect(mockOnAddPress).toHaveBeenCalled();
    });

    it('上限まで入っていたら追加ボタンを出さない', () => {
      const uris = Array.from({ length: MAX_PHOTOS_PER_RECORD }, (_, i) => `file://${i}.jpg`);
      const { queryByTestId } = render(<PhotoSection {...defaultProps} imageUris={uris} />);

      expect(queryByTestId('photo-add')).toBeNull();
    });

    // 訪問日を決めるとき、写真に書かれた日付が読める大きさである必要がある（#178）
    it('1枚のときは全幅で、2枚以上のときはタイルになる', () => {
      const single = render(<PhotoSection {...defaultProps} imageUris={['file://a.jpg']} />);
      const singleWidth = single.getByTestId('photo-tile-0').props.style.width;

      const many = render(
        <PhotoSection {...defaultProps} imageUris={['file://a.jpg', 'file://b.jpg']} />
      );
      const tileWidth = many.getByTestId('photo-tile-0').props.style.width;

      expect(singleWidth).toBe('100%');
      expect(tileWidth).not.toBe('100%');
    });
  });
});
