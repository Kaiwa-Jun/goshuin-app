import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Image } from 'react-native';
import { GalleryScreen } from '@screens/GalleryScreen';
import { useGalleryStamps } from '@hooks/useGalleryStamps';
import type { StampWithSpot } from '@/types/supabase';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@hooks/useGalleryStamps', () => ({
  useGalleryStamps: jest.fn(),
}));

jest.mock('@hooks/useStampDetail', () => ({
  useStampDetail: () => ({
    stamp: null,
    isLoading: false,
    error: null,
    isUpdating: false,
    isDeleting: false,
    handleUpdate: jest.fn(),
    handleDelete: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('@services/stamps', () => ({
  getStampImageUrl: jest.fn((path: string) => `https://example.com/${path}`),
}));

jest
  .spyOn(Image, 'getSize')
  .mockImplementation((_uri: string, success: (width: number, height: number) => void) => {
    success(800, 1200);
  });

const mockUseGalleryStamps = useGalleryStamps as jest.MockedFunction<typeof useGalleryStamps>;

const makeStamp = (overrides: Partial<StampWithSpot> = {}): StampWithSpot => ({
  id: '1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-01-15',
  image_path: 'user-1/stamp-1.jpg',
  memo: null,
  is_public: false,
  extracted_info: null,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  spots: { name: '明治神宮', type: 'shrine' },
  ...overrides,
});

describe('GalleryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ローディング中に ActivityIndicator を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: true,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = render(<GalleryScreen />);
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('スタンプデータがある場合にスポット名を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', spots: { name: '明治神宮', type: 'shrine' } })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByText } = render(<GalleryScreen />);
    expect(getByText('明治神宮')).toBeTruthy();
  });

  it('スタンプデータがある場合に画像を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', image_path: 'user-1/stamp-1.jpg' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = render(<GalleryScreen />);
    expect(getByTestId('stamp-image-1')).toBeTruthy();
  });

  it('スタンプがない場合に空状態メッセージを表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = render(<GalleryScreen />);
    expect(getByTestId('empty-state')).toBeTruthy();
  });

  it('ソートボタンを押すと sortOrder が切り替わる', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId, getByText } = render(<GalleryScreen />);
    expect(getByText('日付順 ▼')).toBeTruthy();
    fireEvent.press(getByTestId('sort-button'));
    expect(getByText('スポット順 ▼')).toBeTruthy();
  });

  it('date ソート時に訪問日を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', visited_at: '2024-01-15' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByText } = render(<GalleryScreen />);
    expect(getByText('2024/01/15')).toBeTruthy();
  });

  it('spot ソート時に訪問日を表示しない', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', visited_at: '2024-01-15' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId, queryByText } = render(<GalleryScreen />);
    fireEvent.press(getByTestId('sort-button'));
    expect(queryByText('2024/01/15')).toBeNull();
  });

  it('アイテムタップでギャラリーモーダルが開く', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: 'stamp-abc' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = render(<GalleryScreen />);
    fireEvent.press(getByTestId('gallery-item-stamp-abc'));
    expect(getByTestId('gallery-image')).toBeTruthy();
  });
});
