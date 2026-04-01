import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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

jest.mock('@services/stamps', () => ({
  getStampImageUrl: jest.fn((path: string) => `https://example.com/${path}`),
}));

const mockUseGalleryStamps = useGalleryStamps as jest.MockedFunction<typeof useGalleryStamps>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
} as any;

const mockRoute = {
  key: 'test',
  name: 'Gallery' as const,
  params: undefined,
};

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
    });

    const { getByTestId } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('スタンプデータがある場合にスポット名を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', spots: { name: '明治神宮', type: 'shrine' } })],
      totalCount: 1,
      isLoading: false,
      error: null,
    });

    const { getByText } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('明治神宮')).toBeTruthy();
  });

  it('スタンプデータがある場合に画像を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', image_path: 'user-1/stamp-1.jpg' })],
      totalCount: 1,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByTestId('stamp-image-1')).toBeTruthy();
  });

  it('スタンプがない場合に空状態メッセージを表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByTestId('empty-state')).toBeTruthy();
  });

  it('totalCount が 20 を超える場合にプレミアムバナーを表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp()],
      totalCount: 21,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByTestId('premium-banner')).toBeTruthy();
  });

  it('totalCount が 20 以下の場合にプレミアムバナーを表示しない', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp()],
      totalCount: 20,
      isLoading: false,
      error: null,
    });

    const { queryByTestId } = render(
      <GalleryScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(queryByTestId('premium-banner')).toBeNull();
  });

  it('ソートボタンを押すと sortOrder が切り替わる', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
    });

    const { getByTestId, getByText } = render(
      <GalleryScreen navigation={mockNavigation} route={mockRoute} />
    );
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
    });

    const { getByText } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    // デフォルトは date 順
    expect(getByText('2024/01/15')).toBeTruthy();
  });

  it('spot ソート時に訪問日を表示しない', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', visited_at: '2024-01-15' })],
      totalCount: 1,
      isLoading: false,
      error: null,
    });

    const { getByTestId, queryByText } = render(
      <GalleryScreen navigation={mockNavigation} route={mockRoute} />
    );
    fireEvent.press(getByTestId('sort-button'));
    expect(queryByText('2024/01/15')).toBeNull();
  });

  it('アイテムタップで StampDetail に遷移する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: 'stamp-abc' })],
      totalCount: 1,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('gallery-item-stamp-abc'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('StampDetail', { stampId: 'stamp-abc' });
  });
});
