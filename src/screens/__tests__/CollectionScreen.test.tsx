import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { CollectionScreen } from '../CollectionScreen';
import type { MainTabScreenProps } from '@/navigation/types';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const RN = require('react-native');
  return {
    SafeAreaView: RN.View,
    SafeAreaProvider: RN.View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    isAuthenticated: true,
  }),
}));

const mockRefetch = jest.fn();
let mockWishlistSpots: unknown[] = [];

jest.mock('@hooks/useWishlistSpots', () => ({
  useWishlistSpots: () => ({
    spots: mockWishlistSpots,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

const mockRemoveFromWishlist = jest.fn().mockResolvedValue(undefined);

jest.mock('@services/wishlist', () => ({
  removeFromWishlist: (...args: unknown[]) => mockRemoveFromWishlist(...args),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
} as unknown as MainTabScreenProps<'Collection'>['navigation'];

const mockRoute = {
  key: 'test',
  name: 'Collection' as const,
  params: undefined,
} as unknown as MainTabScreenProps<'Collection'>['route'];

describe('CollectionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWishlistSpots = [];
  });

  it('renders the header', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('コレクション')).toBeTruthy();
  });

  it('renders achievement summary cards', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('33')).toBeTruthy();
    expect(getByText('箇所')).toBeTruthy();
    expect(getByText('45')).toBeTruthy();
    expect(getByText('枚')).toBeTruthy();
  });

  it('renders region section', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('地域別')).toBeTruthy();
    expect(getByText('東京都')).toBeTruthy();
    expect(getByText('京都府')).toBeTruthy();
    expect(getByText('宮城県')).toBeTruthy();
  });

  it('renders challenge section', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('巡礼チャレンジ')).toBeTruthy();
    expect(getByText('四国八十八ヶ所')).toBeTruthy();
    expect(getByText('12/88')).toBeTruthy();
    expect(getByText('西国三十三所')).toBeTruthy();
    expect(getByText('5/33')).toBeTruthy();
  });

  it('renders badge section with earned and unearned badges', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('バッジ')).toBeTruthy();
    expect(getByText('初参拝')).toBeTruthy();
    expect(getByText('10箇所達成')).toBeTruthy();
    expect(getByText('巡礼者')).toBeTruthy();
    expect(getByText('全国制覇')).toBeTruthy();
  });

  describe('Wishlist section', () => {
    it('renders wishlist section title', () => {
      const { getByText } = render(
        <CollectionScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByText('行きたいリスト')).toBeTruthy();
    });

    it('renders empty state when no wishlist spots', () => {
      mockWishlistSpots = [];
      const { getByText } = render(
        <CollectionScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByText('行きたいスポットをマップで保存しましょう')).toBeTruthy();
    });

    it('renders wishlist items', () => {
      mockWishlistSpots = [
        {
          id: 'wl-1',
          user_id: 'user-1',
          spot_id: 'spot-1',
          created_at: '2026-01-01T00:00:00Z',
          spots: { name: '伊勢神宮', type: 'shrine', address: '三重県伊勢市宇治館町1' },
        },
      ];
      const { getByText, getByTestId } = render(
        <CollectionScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByText('伊勢神宮')).toBeTruthy();
      expect(getByTestId('wishlist-item-spot-1')).toBeTruthy();
    });

    it('calls removeFromWishlist and refetch when wishlist button is pressed', async () => {
      mockWishlistSpots = [
        {
          id: 'wl-1',
          user_id: 'user-1',
          spot_id: 'spot-1',
          created_at: '2026-01-01T00:00:00Z',
          spots: { name: '伊勢神宮', type: 'shrine', address: '三重県伊勢市宇治館町1' },
        },
      ];
      const { getByTestId } = render(
        <CollectionScreen navigation={mockNavigation} route={mockRoute} />
      );

      fireEvent.press(getByTestId('wishlist-button'));

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockRemoveFromWishlist).toHaveBeenCalledWith('user-1', 'spot-1');
      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
