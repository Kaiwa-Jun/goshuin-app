import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';

import { CollectionScreen } from '../CollectionScreen';
import { JapanMap } from '@components/collection/JapanMap';
import { colors } from '@theme/colors';
import type { CollectionStackScreenProps } from '@/navigation/types';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const RN = require('react-native');
  return {
    SafeAreaView: RN.View,
    SafeAreaProvider: RN.View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

let mockAuth: { user: { id: string } | null; isAuthenticated: boolean } = {
  user: { id: 'user-1' },
  isAuthenticated: true,
};

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}));

let mockCollectionStats = {
  spotCount: 10,
  stampCount: 25,
  regionStats: [
    { prefecture: '宮城県', visitedCount: 5, stampCount: 9, totalCount: 10 },
    { prefecture: '東京都', visitedCount: 3, stampCount: 16, totalCount: 20 },
  ],
  recentStamps: [
    {
      id: 'stamp-1',
      image_path: 'a.jpg',
      visited_at: '2026-09-20',
      memo: null,
      spots: { name: '湯島天満宮', type: 'shrine' },
    },
  ],
  pilgrimageProgress: [
    {
      id: 'pilgrimage-1',
      name: '四国八十八ヶ所',
      description: null,
      category: null,
      totalSpots: 88,
      visitedCount: 12,
    },
    {
      id: 'pilgrimage-2',
      name: '西国三十三所',
      description: null,
      category: null,
      totalSpots: 33,
      visitedCount: 5,
    },
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

const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: mockParentNavigate })),
} as unknown as CollectionStackScreenProps<'CollectionList'>['navigation'];

const mockRoute = {
  key: 'test',
  name: 'CollectionList' as const,
  params: undefined,
} as unknown as CollectionStackScreenProps<'CollectionList'>['route'];

describe('CollectionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 塗り広がりは JapanMap のテストで見る。ここでは最後の状態を見たい
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true as never);
    mockAuth = { user: { id: 'user-1' }, isAuthenticated: true };
    mockCollectionStats = {
      spotCount: 10,
      stampCount: 25,
      regionStats: [
        { prefecture: '宮城県', visitedCount: 5, stampCount: 9, totalCount: 10 },
        { prefecture: '東京都', visitedCount: 3, stampCount: 16, totalCount: 20 },
      ],
      recentStamps: [
        {
          id: 'stamp-1',
          image_path: 'a.jpg',
          visited_at: '2026-09-20',
          memo: null,
          spots: { name: '湯島天満宮', type: 'shrine' },
        },
      ],
      pilgrimageProgress: [
        {
          id: 'pilgrimage-1',
          name: '四国八十八ヶ所',
          description: null,
          category: null,
          totalSpots: 88,
          visitedCount: 12,
        },
        {
          id: 'pilgrimage-2',
          name: '西国三十三所',
          description: null,
          category: null,
          totalSpots: 33,
          visitedCount: 5,
        },
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
    expect(getByText('あゆみ')).toBeTruthy();
  });

  it('地図が出て、塗られた県の数と通算の枚数が並ぶ', async () => {
    const { getByTestId, getAllByTestId, getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    await act(async () => {});

    expect(getByTestId('ayumi-map-card')).toBeTruthy();
    expect(getAllByTestId(/^prefecture-/)).toHaveLength(47);
    expect(getByText('2')).toBeTruthy();
    expect(getByText('/ 47 都道府県')).toBeTruthy();
    expect(getByText('25')).toBeTruthy();
  });

  // 色に載せる意味は枚数ひとつだけ。凡例も枚数の段にする
  it('凡例が枚数の段になっている', async () => {
    const { getByText, getAllByTestId } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    await act(async () => {});

    expect(getByText('まだ 45')).toBeTruthy();
    expect(getByText('1〜2枚')).toBeTruthy();
    expect(getByText('3〜5枚')).toBeTruthy();
    expect(getByText('6枚〜')).toBeTruthy();
    expect(
      getAllByTestId('ayumi-legend-swatch').map(
        el => StyleSheet.flatten(el.props.style).backgroundColor
      )
    ).toEqual([
      colors.prefectureFill.empty,
      colors.prefectureFill.tier1,
      colors.prefectureFill.tier2,
      colors.prefectureFill.tier3,
    ]);
  });

  it('「いちばん新しい」を地図に出さない', () => {
    const { queryByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(queryByText('いちばん新しい')).toBeNull();
  });

  // シートではなく画面。行き止まりにしない
  it('県をタップすると県別の画面へ進む', () => {
    const { getByTestId } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );

    fireEvent.press(getByTestId('prefecture-東京都'));

    expect(mockNavigate).toHaveBeenCalledWith('PrefectureDetail', { prefecture: '東京都' });
  });

  it('最近の参拝が出て、「すべて見る」で御朱印帳へ渡す', () => {
    const { getByTestId, getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(getByTestId('recent-visits-section')).toBeTruthy();
    expect(getByText('湯島天満宮')).toBeTruthy();

    fireEvent.press(getByTestId('recent-visits-see-all'));

    expect(mockParentNavigate).toHaveBeenCalledWith('GalleryTab', { screen: 'Gallery' });
  });

  it('最近の参拝が0件なら、そのセクションごと出さない', () => {
    mockCollectionStats = { ...mockCollectionStats, recentStamps: [] };
    const { queryByTestId } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(queryByTestId('recent-visits-section')).toBeNull();
  });

  /*
   * 地図が地域別と同じことを県単位で見せるので、集計カードと地域別は消した。
   * 文言が残っていると同じ数字が2箇所に出る
   */
  it('集計カードと地域別セクションが無い', () => {
    const { queryByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(queryByText('これまでの達成')).toBeNull();
    expect(queryByText('御朱印（枚）')).toBeNull();
    expect(queryByText('地域別')).toBeNull();
    expect(queryByText('北海道・東北')).toBeNull();
  });

  // 空の地図そのものが「これから塗る」の予告になる。説明文で埋めない
  it('0件でも47県の地図を出し、説明文で埋めない', async () => {
    mockCollectionStats = { ...mockCollectionStats, regionStats: [] };
    const { getAllByTestId, getByText, queryByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    await act(async () => {});
    expect(getAllByTestId(/^prefecture-/)).toHaveLength(47);
    expect(getByText('まだ 47')).toBeTruthy();
    expect(queryByText('御朱印を記録すると地域別の統計が表示されます')).toBeNull();
  });

  it('バッジが BADGE_DEFINITIONS に基づいて表示される', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('獲得バッジ')).toBeTruthy();
    expect(getByText('初めての御朱印')).toBeTruthy();
    expect(getByText('5箇所達成')).toBeTruthy();
    expect(getByText('10箇所達成')).toBeTruthy();
    expect(getByText('全国制覇')).toBeTruthy();
  });

  it('巡礼チャレンジセクションが表示される', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('巡礼チャレンジ')).toBeTruthy();
    expect(getByText('四国八十八ヶ所')).toBeTruthy();
    expect(getByText('12/88')).toBeTruthy();
  });

  it('巡礼チャレンジが空の場合は空状態を表示する', () => {
    mockCollectionStats = { ...mockCollectionStats, pilgrimageProgress: [] };
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('巡礼チャレンジに挑戦してみましょう')).toBeTruthy();
  });

  it('巡礼カードをタップすると PilgrimageDetail に遷移する', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    fireEvent.press(getByText('四国八十八ヶ所'));
    expect(mockNavigate).toHaveBeenCalledWith('PilgrimageDetail', {
      pilgrimageId: 'pilgrimage-1',
      pilgrimageName: '四国八十八ヶ所',
    });
  });

  it('他の巡礼トグルを押すと追加の巡礼が表示される', () => {
    const { getByText, queryByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    // 最初は西国三十三所は非表示
    expect(queryByText('西国三十三所')).toBeNull();
    // トグルを押す
    fireEvent.press(getByText('他の巡礼を見る (1)'));
    // 西国三十三所が表示される
    expect(getByText('西国三十三所')).toBeTruthy();
  });

  describe('行きたいリストの移設（Issue #123）', () => {
    it('行きたいリストの見出しが無い', () => {
      const { queryByText } = render(
        <CollectionScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(queryByText('行きたいリスト')).toBeNull();
    });

    it('行きたいのカードが描画されない', () => {
      const { queryByText, queryByTestId } = render(
        <CollectionScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(queryByTestId('wishlist-item-spot-1')).toBeNull();
      expect(queryByText('伊勢神宮')).toBeNull();
    });

    it('獲得バッジと巡礼チャレンジは残る', () => {
      const { getByText } = render(
        <CollectionScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByText('獲得バッジ')).toBeTruthy();
      expect(getByText('巡礼チャレンジ')).toBeTruthy();
    });
  });

  describe('未ログイン時のゲストカード', () => {
    beforeEach(() => {
      mockAuth = { user: null, isAuthenticated: false };
    });

    it('ゲストカードとタイトル・説明を表示する', () => {
      const { getByTestId, getByText } = render(
        <CollectionScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByTestId('collection-guest-empty-state')).toBeTruthy();
      expect(getByText('記録するとここに集計されます')).toBeTruthy();
      expect(
        getByText('訪れた寺社の数・都道府県の埋まり方・巡礼の進捗・獲得バッジが自動でたまります')
      ).toBeTruthy();
    });

    it('CTA を押すと Login へ navigate する', () => {
      const { getByTestId } = render(
        <CollectionScreen navigation={mockNavigation} route={mockRoute} />
      );
      fireEvent.press(getByTestId('collection-login-cta'));
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });

    it('データ0件でも既存セクションがプレビューとして残る', () => {
      mockCollectionStats = {
        spotCount: 0,
        stampCount: 0,
        regionStats: [],
        recentStamps: [],
        pilgrimageProgress: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      };
      const { getByText, queryByTestId } = render(
        <CollectionScreen navigation={mockNavigation} route={mockRoute} />
      );
      // 未ログインでは地図を出さない（ゲストカードが受ける）
      expect(queryByTestId('ayumi-map-card')).toBeNull();
      expect(getByText('獲得バッジ')).toBeTruthy();
      expect(getByText('巡礼チャレンジに挑戦してみましょう')).toBeTruthy();
    });
  });

  it('ログイン済みのときゲストカードを表示しない', () => {
    const { queryByTestId } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(queryByTestId('collection-guest-empty-state')).toBeNull();
  });
});

describe('地図を触っている間は画面が動かない', () => {
  /*
   * iOS の ScrollView はネイティブのジェスチャなので、JS 側で指を引き取っても
   * 一緒に動く。地図から合図をもらって縦スクロールを止める。
   * 「指が触れたら合図を出す」側は JapanMap のテストで見ている
   */
  it('地図からの合図で縦スクロールを止め、戻す', () => {
    const tree = render(<CollectionScreen navigation={mockNavigation} route={mockRoute} />);
    const map = tree.UNSAFE_getByType(JapanMap);

    expect(tree.getByTestId('ayumi-scroll').props.scrollEnabled).toBe(true);

    act(() => map.props.onInteraction(true));
    expect(tree.getByTestId('ayumi-scroll').props.scrollEnabled).toBe(false);

    act(() => map.props.onInteraction(false));
    expect(tree.getByTestId('ayumi-scroll').props.scrollEnabled).toBe(true);
  });
});
