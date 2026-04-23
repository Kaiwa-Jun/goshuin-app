import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Image } from 'react-native';
import { ImageGalleryModal, GalleryImage } from '../ImageGalleryModal';

jest
  .spyOn(Image, 'getSize')
  .mockImplementation((_uri: string, success: (width: number, height: number) => void) => {
    success(800, 1200);
  });

const mockImages: GalleryImage[] = [
  {
    id: '1',
    imageUrl: 'https://example.com/stamp1.jpg',
    userName: 'ユーザーA',
    memo: '良い天気でした',
    visitedAt: '2024-06-15',
  },
  {
    id: '2',
    imageUrl: 'https://example.com/stamp2.jpg',
    userName: null,
    memo: null,
    visitedAt: '2024-07-20',
  },
  {
    id: '3',
    imageUrl: 'https://example.com/stamp3.jpg',
    userName: 'ユーザーB',
    memo: '限定御朱印',
    visitedAt: null,
  },
];

describe('ImageGalleryModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    images: mockImages,
    initialIndex: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('visible=true で画像が表示されること', () => {
    const { getByTestId } = render(<ImageGalleryModal {...defaultProps} />);
    expect(getByTestId('gallery-image')).toBeTruthy();
  });

  it('visible=false で何も表示されないこと', () => {
    const { queryByTestId } = render(<ImageGalleryModal {...defaultProps} visible={false} />);
    expect(queryByTestId('gallery-image')).toBeNull();
  });

  it('ユーザー名が表示されること', () => {
    const { getByText } = render(<ImageGalleryModal {...defaultProps} />);
    expect(getByText('ユーザーA')).toBeTruthy();
  });

  it('メモが表示されること', () => {
    const { getByText } = render(<ImageGalleryModal {...defaultProps} />);
    expect(getByText('良い天気でした')).toBeTruthy();
  });

  it('訪問日がフォーマットされて表示されること', () => {
    const { getByText } = render(<ImageGalleryModal {...defaultProps} />);
    expect(getByText('2024/06/15')).toBeTruthy();
  });

  it('カウンターが表示されること', () => {
    const { getByText } = render(<ImageGalleryModal {...defaultProps} />);
    expect(getByText('1 / 3')).toBeTruthy();
  });

  it('ユーザー名が null の場合は表示されないこと', () => {
    const { queryByTestId } = render(<ImageGalleryModal {...defaultProps} initialIndex={1} />);
    expect(queryByTestId('gallery-username')).toBeNull();
  });

  it('メモが null の場合は表示されないこと', () => {
    const { queryByTestId } = render(<ImageGalleryModal {...defaultProps} initialIndex={1} />);
    expect(queryByTestId('gallery-memo')).toBeNull();
  });

  it('閉じるボタンで onClose が呼ばれること', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<ImageGalleryModal {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByTestId('gallery-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('画像が空の場合は何も表示されないこと', () => {
    const { queryByTestId } = render(<ImageGalleryModal {...defaultProps} images={[]} />);
    expect(queryByTestId('gallery-image')).toBeNull();
  });

  it('initialIndex=1 で2枚目から表示されること', () => {
    const { getByText } = render(<ImageGalleryModal {...defaultProps} initialIndex={1} />);
    expect(getByText('2 / 3')).toBeTruthy();
    expect(getByText('2024/07/20')).toBeTruthy();
  });
});
