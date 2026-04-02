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

let mockCollectionStats = {
  spotCount: 10,
  stampCount: 25,
  regionStats: [
    { prefecture: '宮城県', visitedCount: 5 },
    { prefecture: '東京都', visitedCount: 3 },
  ],
  isLoading: false,
  error: null,
  refetch: jest.fn(),
};

jest.mock('@hooks/useCollectionStats', () => ({
  useCollectionStats: () => mockCollectionStats,
}));

const mockRemoveFromWishlist = jest.fn().mockResolvedValue(undefined);

jest.mock('@services/wishlist', () => ({
  removeFromWishlist: (...args: unknown[]) => mockRemoveFromWishlist(...args),
}));

jest.mock('@services/badges', () => ({
  getAllBadges: () => [
    {
      id: 'first-stamp',
      name: '初めての御朱印',
      description: '初めての御朱印を記録しました',
      icon: '🎊',
      condition: { type: 'visit_count', threshold: 1 },
    },
    {
      id: 'visit-5',
      name: '5箇所達成',
      description: '5箇所の神社仏閣を訪れました',
      icon: '⛩️',
      condition: { type: 'visit_count', threshold: 5 },
    },
    {
      id: 'visit-10',
      name: '10箇所達成',
      description: '10箇所の神社仏閣を訪れました',
      icon: '🏆',
      condition: { type: 'visit_count', threshold: 10 },
    },
    {
      id: 'visit-100',
      name: '全国制覇',
      description: '100箇所の神社仏閣を訪れました',
      icon: '👑',
      condition: { type: 'visit_count', threshold: 100 },
    },
  ],
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
    mockCollectionStats = {
      spotCount: 10,
      stampCount: 25,
      regionStats: [
        { prefecture: '宮城県', visitedCount: 5 },
        { prefecture: '東京都', visitedCount: 3 },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    };
  });

  it('renders the header', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('コレクション')).toBeTruthy();
  });

  it('統計サマリーに spotCount/stampCount が表示される', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('10')).toBeTruthy();
    expect(getByText('箇所')).toBeTruthy();
    expect(getByText('25')).toBeTruthy();
    expect(getByText('枚')).toBeTruthy();
  });

  it('地域別データが表示される', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('地域別')).toBeTruthy();
    expect(getByText('宮城県')).toBeTruthy();
    expect(getByText('5箇所')).toBeTruthy();
    expect(getByText('東京都')).toBeTruthy();
    expect(getByText('3箇所')).toBeTruthy();
  });

  it('地域データが空の場合は空状態を表示する', () => {
    mockCollectionStats = { ...mockCollectionStats, regionStats: [] };
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('御朱印を記録すると地域別の統計が表示されます')).toBeTruthy();
  });

  it('バッジが BADGE_DEFINITIONS に基づいて表示される', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('バッジ')).toBeTruthy();
    expect(getByText('初めての御朱印')).toBeTruthy();
    expect(getByText('5箇所達成')).toBeTruthy();
    expect(getByText('10箇所達成')).toBeTruthy();
    expect(getByText('全国制覇')).toBeTruthy();
  });

  it('巡礼チャレンジセクションが表示されない', () => {
    const { queryByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(queryByText('巡礼チャレンジ')).toBeNull();
    expect(queryByText('四国八十八ヶ所')).toBeNull();
    expect(queryByText('西国三十三所')).toBeNull();
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
