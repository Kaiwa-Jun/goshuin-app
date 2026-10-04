import React from 'react';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';
import { MapScreen } from '@screens/MapScreen';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';

const mockFetchSpotsByPrefecture = jest.fn();

jest.mock('@services/spots', () => ({
  fetchSpotsByPrefecture: (...args: unknown[]) => mockFetchSpotsByPrefecture(...args),
}));

jest.mock('@hooks/useSpotInfo', () => ({
  useSpotInfo: () => ({ spotInfo: null, isLoading: false, error: null }),
}));

jest.mock('@services/stamps', () => ({
  fetchStampsBySpotId: jest.fn(() => Promise.resolve([])),
  getStampImageUrl: jest.fn((path: string) => `https://example.com/${path}`),
}));

jest.mock('@hooks/useSpotDetail', () => ({
  useSpotDetail: (spotId: string) => {
    const spots: Record<string, unknown> = {
      'spot-1': {
        spot: {
          id: 'spot-1',
          name: 'Test Shrine',
          lat: 38.27,
          lng: 140.87,
          type: 'shrine',
          status: 'active',
          rank: 3,
          address: '宮城県仙台市',
          created_by_user_id: null,
          merged_into_spot_id: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        isLoading: false,
        error: null,
      },
      'spot-2': {
        spot: {
          id: 'spot-2',
          name: 'Test Temple',
          lat: 38.272,
          lng: 140.872,
          type: 'temple',
          status: 'active',
          rank: 3,
          address: null,
          created_by_user_id: null,
          merged_into_spot_id: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        isLoading: false,
        error: null,
      },
    };
    return spots[spotId] ?? { spot: null, isLoading: false, error: null };
  },
}));

jest.mock('@hooks/useSpotStamps', () => ({
  useSpotStamps: () => ({
    stamps: [],
    publicStamps: [],
    visitCount: 0,
    latestVisitDate: null,
    isLoading: false,
  }),
}));

let mockUseAuthReturn = {
  user: null,
  session: null,
  isLoading: false,
  isAuthenticated: false,
  isSigningIn: false,
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
};

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockUseAuthReturn,
}));

const mockLocation = { latitude: 38.2682, longitude: 140.8694 };

let mockPermissionStatus: string = 'granted';

jest.mock('@hooks/useLocation', () => ({
  useLocation: () => ({
    location: mockLocation,
    isLoading: false,
    error: null,
    permissionStatus: mockPermissionStatus,
    refreshLocation: jest.fn(),
  }),
}));

const mockSpots = [
  {
    id: 'spot-1',
    name: 'Test Shrine',
    lat: 38.27,
    lng: 140.87,
    type: 'shrine',
    status: 'active',
    rank: 3,
    address: '宮城県仙台市',
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'spot-2',
    // 初期ビューポート(中心 38.2682/140.8694、マージン込み half 0.009)内に収まる座標にする(#96)
    name: 'Test Temple',
    lat: 38.272,
    lng: 140.872,
    type: 'temple',
    status: 'active',
    rank: 3,
    address: null,
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
];

// テストごとに差し替え可能なオーバーライド(null なら mockSpots を使用)
let mockSpotsOverride: typeof mockSpots | null = null;

jest.mock('@hooks/useSpots', () => ({
  // 絞り込みは実装と同じ形で再現する。素通しにすると
  // MapScreen がフィルタを渡しているかをテストで見られない
  useSpots: (
    _location: unknown,
    filterMode: string = 'all',
    visitedSpotIds?: Set<string>,
    wishlistSpotIds?: Set<string>
  ) => {
    const allSpots = mockSpotsOverride ?? mockSpots;
    const ids =
      filterMode === 'visited'
        ? visitedSpotIds
        : filterMode === 'wishlist'
          ? wishlistSpotIds
          : undefined;
    return {
      spots: ids ? allSpots.filter(s => ids.has(s.id)) : allSpots,
      allSpots,
      isLoading: false,
      error: null,
    };
  },
}));

// 既定は spot-1 が訪問済み。地域の表示（#311）のテストだけ空にする
const DEFAULT_VISITED_SPOT_IDS = new Set(['spot-1']);
let mockVisitedSpotIds = DEFAULT_VISITED_SPOT_IDS;

jest.mock('@hooks/useUserStamps', () => ({
  useUserStamps: () => ({
    visitedSpotIds: mockVisitedSpotIds,
    isLoading: false,
  }),
}));

let mockWishlistSpotIds = new Set<string>();

jest.mock('@hooks/useWishlist', () => ({
  useWishlist: () => ({
    wishlistSpotIds: mockWishlistSpotIds,
    toggleWishlist: jest.fn(),
    isLoading: false,
    isToggling: false,
  }),
}));

afterEach(() => {
  mockSpotsOverride = null;
  mockWishlistSpotIds = new Set<string>();
  mockVisitedSpotIds = DEFAULT_VISITED_SPOT_IDS;
});

const mockParentNavigate = jest.fn();
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: mockParentNavigate })),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(),
  canGoBack: jest.fn(),
  getId: jest.fn(),
  getState: jest.fn(),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  pop: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  popTo: jest.fn(),
  popToTop: jest.fn(),
};

const mockRoute = { key: 'test', name: 'Map' as const, params: undefined };
const { __cameraMocks: cameraMocks, __sourceMocks: sourceMocks } = jest.requireMock(
  '@maplibre/maplibre-react-native'
) as {
  __cameraMocks: Record<string, jest.Mock>;
  __sourceMocks: Record<string, jest.Mock>;
};

type Rendered = ReturnType<typeof render>;
type Feature = { properties: { spotId: string; name: string; rank: number; state: string } };

/** スタイル上の id でソースを引き、渡っている GeoJSON を取り出す */
function features(r: Rendered, sourceId: string): Feature[] {
  return r.getByTestId(sourceId).props.data.features;
}
function spotIds(r: Rendered, sourceId: string): string[] {
  return features(r, sourceId)
    .map(f => f.properties.spotId)
    .sort();
}

describe('MapScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthReturn = {
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      isSigningIn: false,
      signInWithGoogle: jest.fn(),
      signOut: jest.fn(),
    };
    mockFetchSpotsByPrefecture.mockResolvedValue([]);
    mockPermissionStatus = 'granted';
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('map-screen')).toBeTruthy();
  });

  it('displays search bar', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('search-bar')).toBeTruthy();
  });

  it('navigates to Search screen when search bar is pressed', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByTestId('search-bar'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Search');
  });

  it('displays the map', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('map-view')).toBeTruthy();
  });

  it('displays FAB button when no spot is selected', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('fab-button')).toBeTruthy();
  });

  describe('地図の下地', () => {
    it('同梱したベクタータイルのスタイルを読む', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      const style = getByTestId('map-view').props.mapStyle;

      expect(style.sources).toBeDefined();
      expect(style.layers.length).toBeGreaterThan(0);
    });

    it('下地の地名は日本語だけにする（ローマ字を併記しない）', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      const style = getByTestId('map-view').props.mapStyle;
      const labels = style.layers
        .map((l: { layout?: Record<string, unknown> }) => l.layout?.['text-field'])
        .filter(Boolean)
        .map((f: unknown) => JSON.stringify(f));

      expect(labels.length).toBeGreaterThan(0);
      expect(labels.some((f: string) => f.includes('name:latin'))).toBe(false);
    });

    it('初期カメラは現在地に置かれる', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByTestId('map-camera').props.initialViewState.center).toEqual([
        mockLocation.longitude,
        mockLocation.latitude,
      ]);
    });

    it('現在地はネイティブビューではなくレイヤで描かれる', () => {
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      expect(r.getByTestId('goshuin-current-location').props.data.features).toHaveLength(1);
      expect(r.getByTestId('goshuin-current-location-dot')).toBeTruthy();
      expect(r.getByTestId('goshuin-current-location-halo')).toBeTruthy();
    });
  });

  describe('スポットの受け渡し', () => {
    it('未訪問は団子化するソース、訪問済み・行きたいは団子化しないソースへ分かれる', () => {
      mockWishlistSpotIds = new Set(['spot-2']);
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);

      // spot-1 は mockVisitedSpotIds に入っている
      expect(spotIds(r, 'goshuin-pinned')).toEqual(['spot-1', 'spot-2']);
      expect(spotIds(r, 'goshuin-spots')).toEqual([]);
    });

    it('描画件数の上限で間引かない（1,109 件を全部渡す）', () => {
      mockSpotsOverride = Array.from({ length: 1109 }, (_, i) => ({
        ...mockSpots[0],
        id: `bulk-${i}`,
        // 全国にばらけさせる。旧実装はビューポート外を落としていた
        lat: 30 + (i % 120) * 0.1,
        lng: 130 + Math.floor(i / 120) * 0.1,
        rank: (i % 5) + 1,
      }));
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);

      expect(features(r, 'goshuin-spots')).toHaveLength(1109);
    });

    it('ラベルの優先度に使う rank と、色分けに使う state を属性に持つ', () => {
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      const pinned = features(r, 'goshuin-pinned').find(f => f.properties.spotId === 'spot-1');

      expect(pinned?.properties).toMatchObject({
        name: 'Test Shrine',
        rank: 3,
        state: 'visited-shrine',
      });
    });

    it('座標は GeoJSON の [lng, lat] 順で渡る', () => {
      mockWishlistSpotIds = new Set(['spot-2']);
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      const geometry = r.getByTestId('goshuin-pinned').props.data.features[0].geometry;

      expect(geometry.coordinates).toEqual([140.87, 38.27]);
    });
  });

  describe('団子化の設定', () => {
    it('団子は広域だけ・5 件以上のときだけ作る', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      const source = getByTestId('goshuin-spots');

      expect(source.props.cluster).toBe(true);
      expect(source.props.clusterMaxZoom).toBe(11);
      expect(source.props.clusterMinPoints).toBe(5);
      expect(source.props.clusterRadius).toBe(50);
    });

    it('自分の記録のソースは団子化しない', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByTestId('goshuin-pinned').props.cluster).toBeUndefined();
    });
  });

  describe('ピンとラベル', () => {
    it('ピンは重なっても必ず描く（間引かれるのは名前だけ）', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      const layout = getByTestId('goshuin-spot-pin').props.layout;

      expect(layout['icon-allow-overlap']).toBe(true);
      expect(layout['text-optional']).toBe(true);
      expect(layout['text-allow-overlap']).toBe(false);
    });

    it('残す順は rank の高いものから', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      // 小さい sort key が先に置かれるので rank を反転させる
      expect(getByTestId('goshuin-spot-pin').props.layout['symbol-sort-key']).toEqual([
        '-',
        10,
        ['get', 'rank'],
      ]);
    });

    it('ピンの絵は state ごとに出し分ける', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      const iconImage = getByTestId('goshuin-pinned-pin').props.layout['icon-image'];

      expect(iconImage).toContain('spot-pin-visited-shrine');
      expect(iconImage).toContain('spot-pin-visited-temple');
      expect(iconImage).toContain('spot-pin-wishlist');
      expect(iconImage).toContain('spot-pin-unvisited');
    });

    it('ピンは足元が座標に来る', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByTestId('goshuin-spot-pin').props.layout['icon-anchor']).toBe('bottom');
    });
  });

  describe('Spot markers', () => {
    it('shows bottom sheet when a spot is pressed', () => {
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      fireEvent(r.getByTestId('goshuin-pinned'), 'onPress', {
        nativeEvent: {
          lngLat: [140.87, 38.27],
          features: [{ properties: { spotId: 'spot-1' } }],
        },
      });

      expect(r.getByTestId('bottom-sheet')).toBeTruthy();
    });

    // 引っ込むモーションを描き切ってから外す。タイマーを進めないと消えない
    it('hides FAB when a spot is selected', () => {
      jest.useFakeTimers();
      try {
        const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
        fireEvent(r.getByTestId('goshuin-pinned'), 'onPress', {
          nativeEvent: {
            lngLat: [140.87, 38.27],
            features: [{ properties: { spotId: 'spot-1' } }],
          },
        });

        expect(r.queryByTestId('fab-button')).toBeTruthy();

        act(() => {
          jest.advanceTimersByTime(500);
        });

        expect(r.queryByTestId('fab-button')).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('団子をタップすると、中身がばらけるズームまで寄せる', async () => {
      sourceMocks.getClusterExpansionZoom.mockResolvedValueOnce(13);
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);

      fireEvent(r.getByTestId('goshuin-spots'), 'onPress', {
        nativeEvent: {
          lngLat: [140.87, 38.27],
          features: [{ properties: { cluster_id: 7, point_count: 12 } }],
        },
      });

      await waitFor(() => {
        expect(cameraMocks.flyTo).toHaveBeenCalledWith(
          expect.objectContaining({ center: [140.87, 38.27], zoom: 13 })
        );
      });
    });
  });

  // 地図に重ねる白い要素は同じ強さで浮かせる。1つだけ強くすると不揃いに見える
  it.each(['search-bar', 'filter-button'])('%s は地図から浮いている', testID => {
    // フィルタボタンはログイン時のみ出る
    mockUseAuthReturn = { ...mockUseAuthReturn, isAuthenticated: true };
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    const style = StyleSheet.flatten(getByTestId(testID).props.style) as Record<string, unknown>;

    expect(style.backgroundColor).toBe(colors.white);
    expect(style.shadowOpacity).toBe(shadows.md.shadowOpacity);
  });

  describe('行きたいフィルタ', () => {
    const openFilter = (r: ReturnType<typeof render>) => {
      fireEvent.press(r.getByTestId('filter-button'));
      return r;
    };

    beforeEach(() => {
      mockUseAuthReturn = { ...mockUseAuthReturn, isAuthenticated: true };
    });

    it('フィルタに「行きたい」が件数付きで並ぶ', () => {
      mockWishlistSpotIds = new Set(['spot-2']);
      const r = openFilter(
        render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />)
      );

      expect(r.getByTestId('filter-option-wishlist')).toBeTruthy();
      expect(r.getByText('行きたい (1)')).toBeTruthy();
    });

    it('選ぶと地図のピンが行きたいだけになる', () => {
      mockWishlistSpotIds = new Set(['spot-2']);
      const r = openFilter(
        render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />)
      );

      fireEvent.press(r.getByTestId('filter-option-wishlist'));

      const pinned = r.getByTestId('goshuin-pinned').props.data;
      const clustered = r.getByTestId('goshuin-spots').props.data;
      expect(
        pinned.features.map((f: { properties: { spotId: string } }) => f.properties.spotId)
      ).toEqual(['spot-2']);
      expect(clustered.features).toHaveLength(0);
    });

    it('選ぶと残ったピンが見える位置までカメラが寄る', () => {
      // 寄せないと、保存したスポットが今いる場所から遠いとき
      // 「絞ったら何も出てこなくなった」ように見える
      mockWishlistSpotIds = new Set(['spot-1', 'spot-2']);
      const r = openFilter(
        render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />)
      );
      cameraMocks.fitBounds.mockClear();

      fireEvent.press(r.getByTestId('filter-option-wishlist'));

      expect(cameraMocks.fitBounds).toHaveBeenCalledWith(
        [140.87, 38.27, 140.872, 38.272],
        expect.objectContaining({ duration: expect.any(Number) })
      );
    });

    it('絞り込みで消えたスポットのシートは閉じる', () => {
      // 開いたままだと、地図に無いスポットの詳細が出続ける。
      // 空表示とも重なる（旧チップと同じ位置にあるため）
      mockWishlistSpotIds = new Set(['spot-2']);
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      fireEvent(r.getByTestId('goshuin-spots'), 'onPress', {
        nativeEvent: { lngLat: [140.87, 38.27], features: [{ properties: { spotId: 'spot-1' } }] },
      });
      expect(r.getByTestId('bottom-sheet')).toBeTruthy();

      fireEvent.press(r.getByTestId('filter-button'));
      fireEvent.press(r.getByTestId('filter-option-wishlist'));

      expect(r.queryByTestId('bottom-sheet')).toBeNull();
    });

    it('絞り込んでも残るスポットのシートは開いたまま', () => {
      mockWishlistSpotIds = new Set(['spot-1']);
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      fireEvent(r.getByTestId('goshuin-pinned'), 'onPress', {
        nativeEvent: { lngLat: [140.87, 38.27], features: [{ properties: { spotId: 'spot-1' } }] },
      });

      fireEvent.press(r.getByTestId('filter-button'));
      fireEvent.press(r.getByTestId('filter-option-wishlist'));

      expect(r.getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('地域別から飛んできた分もフィルタを通す', async () => {
      // prefectureSpots は useSpots を通らないので、素通しにすると
      // 絞っているのにフィルタ対象外のピンが混ざる（あゆみの地域別から遷移する経路）
      mockWishlistSpotIds = new Set(['spot-1']);
      mockFetchSpotsByPrefecture.mockResolvedValue([
        { ...mockSpots[1], id: 'pref-1', name: '県内スポット', lat: 35.0, lng: 135.0 },
      ]);
      const route = { ...mockRoute, params: { focusPrefecture: '京都府' } };
      const r = render(<MapScreen navigation={mockNavigation as never} route={route as never} />);
      await waitFor(() => expect(mockFetchSpotsByPrefecture).toHaveBeenCalled());

      fireEvent.press(r.getByTestId('filter-button'));
      fireEvent.press(r.getByTestId('filter-option-wishlist'));

      const ids = [
        ...r.getByTestId('goshuin-pinned').props.data.features,
        ...r.getByTestId('goshuin-spots').props.data.features,
      ].map((f: { properties: { spotId: string } }) => f.properties.spotId);
      expect(ids).toEqual(['spot-1']);
    });

    it('0件なら空表示を出す。真っ白な地図にしない', () => {
      mockWishlistSpotIds = new Set();
      const r = openFilter(
        render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />)
      );

      fireEvent.press(r.getByTestId('filter-option-wishlist'));

      expect(r.getByTestId('map-filter-empty')).toBeTruthy();
    });

    it('すべて表示に戻すと空表示は消える', () => {
      mockWishlistSpotIds = new Set();
      const r = openFilter(
        render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />)
      );
      fireEvent.press(r.getByTestId('filter-option-wishlist'));

      fireEvent.press(r.getByTestId('filter-button'));
      fireEvent.press(r.getByTestId('filter-option-all'));

      expect(r.queryByTestId('map-filter-empty')).toBeNull();
    });
  });

  it('行きたい一覧へのチップは無い。フィルタに統合した', () => {
    const { queryByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );

    expect(queryByTestId('wishlist-entry')).toBeNull();
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('Wishlist');
  });

  describe('検索バーに選んだスポット名を残す', () => {
    const selectSpotOnMap = (r: ReturnType<typeof render>, spotId: string) =>
      fireEvent(r.getByTestId('goshuin-pinned'), 'onPress', {
        nativeEvent: { lngLat: [140.87, 38.27], features: [{ properties: { spotId } }] },
      });

    it('検索から飛んできたら、選んだスポット名が検索欄に入る', () => {
      const route = { ...mockRoute, params: { focusSpotId: 'spot-1' } };
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={route as never} />
      );

      expect(getByTestId('search-input').props.value).toBe('Test Shrine');
    });

    it('何も選んでいなければ空のまま', () => {
      const { getByTestId, queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      expect(getByTestId('search-input').props.value).toBeUndefined();
      expect(queryByTestId('search-clear-button')).toBeNull();
    });

    it('地図のピンをタップしたときも名前が入る。前の検索名を残さない', () => {
      const route = { ...mockRoute, params: { focusSpotId: 'spot-1' } };
      const r = render(<MapScreen navigation={mockNavigation as never} route={route as never} />);
      expect(r.getByTestId('search-input').props.value).toBe('Test Shrine');

      selectSpotOnMap(r, 'spot-2');

      expect(r.getByTestId('search-input').props.value).toBe('Test Temple');
    });

    it('ボトムシートを閉じても名前は残る', () => {
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      selectSpotOnMap(r, 'spot-1');
      expect(r.getByTestId('search-input').props.value).toBe('Test Shrine');

      fireEvent(r.getByTestId('map-view'), 'onPress', { nativeEvent: { lngLat: [0, 0] } });

      expect(r.queryByTestId('bottom-sheet')).toBeNull();
      expect(r.getByTestId('search-input').props.value).toBe('Test Shrine');
    });

    it('× で消した後にスポット一覧が再取得されても、名前とシートは復活しない', () => {
      // displaySpots は再取得のたびに参照が変わる。focusSpotId の effect が
      // それに引きずられて再実行されると、消したはずの状態が戻ってしまう
      const route = { ...mockRoute, params: { focusSpotId: 'spot-1' } };
      const r = render(<MapScreen navigation={mockNavigation as never} route={route as never} />);
      expect(r.getByTestId('search-input').props.value).toBe('Test Shrine');

      fireEvent.press(r.getByTestId('search-clear-button'));
      expect(r.getByTestId('search-input').props.value).toBeUndefined();

      // スポットを取り直す（配列の参照が変わる）
      mockSpotsOverride = mockSpots.map(spot => ({ ...spot }));
      r.rerender(<MapScreen navigation={mockNavigation as never} route={route as never} />);

      expect(r.getByTestId('search-input').props.value).toBeUndefined();
      expect(r.queryByTestId('bottom-sheet')).toBeNull();
    });

    it('× で名前を消すと、選択も解除される', () => {
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      selectSpotOnMap(r, 'spot-1');

      fireEvent.press(r.getByTestId('search-clear-button'));

      expect(r.getByTestId('search-input').props.value).toBeUndefined();
      expect(r.queryByTestId('bottom-sheet')).toBeNull();
      // × は検索画面への遷移を兼ねない
      expect(mockNavigation.navigate).not.toHaveBeenCalledWith('Search');
    });
  });

  describe('Bottom sheet', () => {
    it('shows bottom sheet when focusSpotId is provided', () => {
      const route = {
        ...mockRoute,
        params: { focusSpotId: 'spot-1' },
      };
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={route as never} />
      );
      expect(getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('focusSpotId のスポットまでカメラが飛ぶ', () => {
      const route = { ...mockRoute, params: { focusSpotId: 'spot-1' } };
      render(<MapScreen navigation={mockNavigation as never} route={route as never} />);

      expect(cameraMocks.flyTo).toHaveBeenCalledWith(
        expect.objectContaining({ center: [140.87, 38.27] })
      );
    });

    it('hides bottom sheet when the map background is pressed', () => {
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      fireEvent(r.getByTestId('goshuin-pinned'), 'onPress', {
        nativeEvent: { lngLat: [140.87, 38.27], features: [{ properties: { spotId: 'spot-1' } }] },
      });
      expect(r.getByTestId('bottom-sheet')).toBeTruthy();

      fireEvent(r.getByTestId('map-view'), 'onPress', { nativeEvent: { lngLat: [0, 0] } });

      expect(r.queryByTestId('bottom-sheet')).toBeNull();
    });

    it('スポットのタップが地図まで伝播してもシートは閉じない', () => {
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      fireEvent(r.getByTestId('goshuin-pinned'), 'onPress', {
        nativeEvent: { lngLat: [140.87, 38.27], features: [{ properties: { spotId: 'spot-1' } }] },
      });

      fireEvent(r.getByTestId('map-view'), 'onPress', {
        nativeEvent: { lngLat: [140.87, 38.27], features: [{ properties: { spotId: 'spot-1' } }] },
      });

      expect(r.getByTestId('bottom-sheet')).toBeTruthy();
    });
  });

  describe('Filter button', () => {
    it('hides filter button when not authenticated', () => {
      const { queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(queryByTestId('filter-button')).toBeNull();
    });

    it('shows filter button when authenticated', () => {
      mockUseAuthReturn = { ...mockUseAuthReturn, isAuthenticated: true };
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByTestId('filter-button')).toBeTruthy();
    });

    it('shows filter dropdown when filter button is pressed', () => {
      mockUseAuthReturn = { ...mockUseAuthReturn, isAuthenticated: true };
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      fireEvent.press(getByTestId('filter-button'));
      expect(getByTestId('filter-dropdown')).toBeTruthy();
    });

    // 閉じるモーションを描き切ってから外す。タイマーを進めないと消えない
    it('閉じた直後はまだ出ていて、モーションが終わると消える', () => {
      mockUseAuthReturn = { ...mockUseAuthReturn, isAuthenticated: true };
      jest.useFakeTimers();
      try {
        const { getByTestId, queryByTestId } = render(
          <MapScreen navigation={mockNavigation as never} route={mockRoute} />
        );
        fireEvent.press(getByTestId('filter-button'));
        fireEvent.press(getByTestId('filter-overlay'));

        expect(queryByTestId('filter-dropdown')).toBeTruthy();

        act(() => {
          jest.advanceTimersByTime(500);
        });

        expect(queryByTestId('filter-dropdown')).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('「視差効果を減らす」がオンなら即座に消える', async () => {
      mockUseAuthReturn = { ...mockUseAuthReturn, isAuthenticated: true };
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const { getByTestId, queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      // isReduceMotionEnabled() の解決を待つ。ボタンの存在で待つと、
      // まだ false のまま press してしまって運で通ることがある
      await act(async () => {});
      fireEvent.press(getByTestId('filter-button'));

      fireEvent.press(getByTestId('filter-overlay'));

      expect(queryByTestId('filter-dropdown')).toBeNull();
    });
  });

  describe('FAB press with authentication', () => {
    it('navigates to Record when authenticated', () => {
      mockUseAuthReturn = { ...mockUseAuthReturn, isAuthenticated: true };
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      fireEvent.press(getByTestId('fab-button'));
      expect(mockParentNavigate).toHaveBeenCalledWith('Record', {
        spotId: undefined,
        origin: 'map',
      });
    });

    it('shows LoginPromptModal when not authenticated', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      fireEvent.press(getByTestId('fab-button'));
      expect(getByTestId('modal-later-button')).toBeTruthy();
    });
  });

  describe('focusPrefecture', () => {
    it('focusPrefecture が渡されると fetchSpotsByPrefecture が呼ばれる', async () => {
      mockFetchSpotsByPrefecture.mockResolvedValue([]);
      const route = { ...mockRoute, params: { focusPrefecture: '宮城県' } };
      render(<MapScreen navigation={mockNavigation as never} route={route as never} />);

      await waitFor(() => {
        expect(mockFetchSpotsByPrefecture).toHaveBeenCalledWith('宮城県');
      });
    });

    it('focusPrefecture がない場合は fetchSpotsByPrefecture が呼ばれない', () => {
      render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      expect(mockFetchSpotsByPrefecture).not.toHaveBeenCalled();
    });

    it('取得した県内スポットは既存 spots に足してソースへ渡る', async () => {
      mockFetchSpotsByPrefecture.mockResolvedValue([
        { ...mockSpots[0], id: 'pref-1', lat: 38.5, lng: 141.0 },
        { ...mockSpots[0], id: 'pref-2', lat: 38.6, lng: 141.1 },
      ]);
      const route = { ...mockRoute, params: { focusPrefecture: '宮城県' } };
      const r = render(<MapScreen navigation={mockNavigation as never} route={route as never} />);

      await waitFor(() => {
        expect(spotIds(r, 'goshuin-spots')).toEqual(['pref-1', 'pref-2', 'spot-2']);
      });
    });

    it('県内スポットの範囲にカメラを合わせる', async () => {
      mockFetchSpotsByPrefecture.mockResolvedValue([
        { ...mockSpots[0], id: 'pref-1', lat: 38.5, lng: 141.0 },
        { ...mockSpots[0], id: 'pref-2', lat: 38.6, lng: 141.2 },
      ]);
      const route = { ...mockRoute, params: { focusPrefecture: '宮城県' } };
      render(<MapScreen navigation={mockNavigation as never} route={route as never} />);

      await waitFor(() => {
        expect(cameraMocks.fitBounds).toHaveBeenCalledWith(
          [141.0, 38.5, 141.2, 38.6],
          expect.objectContaining({ padding: expect.any(Object) })
        );
      });
    });

    it('focusPrefecture が消えると県内スポットがクリアされる', async () => {
      mockFetchSpotsByPrefecture.mockResolvedValue([
        { ...mockSpots[0], id: 'pref-1', lat: 38.5, lng: 141.0 },
      ]);
      const route = { ...mockRoute, params: { focusPrefecture: '宮城県' } };
      const r = render(<MapScreen navigation={mockNavigation as never} route={route as never} />);
      await waitFor(() => {
        expect(spotIds(r, 'goshuin-spots')).toContain('pref-1');
      });

      r.rerender(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);

      await waitFor(() => {
        expect(spotIds(r, 'goshuin-spots')).not.toContain('pref-1');
      });
    });
  });
  describe('focusRegion（#311）: 渡された地域に寄せ、その地域の寺社を全部出す', () => {
    const region = {
      label: '横浜',
      bounds: [140.86, 38.26, 140.88, 38.28] as [number, number, number, number],
      spotIds: ['spot-1', 'spot-2'],
    };
    const PADDING = { top: 140, right: 60, bottom: 200, left: 60 };
    const routeWith = (params: object | undefined) => ({ ...mockRoute, params }) as never;
    const renderWith = (params: object | undefined) =>
      render(<MapScreen navigation={mockNavigation as never} route={routeWith(params)} />);
    const rerenderWith = (r: Rendered, params: object | undefined) =>
      r.rerender(<MapScreen navigation={mockNavigation as never} route={routeWith(params)} />);

    beforeEach(() => {
      // 契約書の AC-13: どちらも未訪問・行きたいでない
      mockVisitedSpotIds = new Set<string>();
    });

    it('AC-13: 範囲に寄せ、検索バーに label、地域の寺社を団子にしないソースへ。シートは出さない', () => {
      const r = renderWith({ focusRegion: region });

      expect(cameraMocks.fitBounds).toHaveBeenCalledTimes(1);
      expect(cameraMocks.fitBounds).toHaveBeenCalledWith([140.86, 38.26, 140.88, 38.28], {
        padding: PADDING,
        duration: 600,
      });
      expect(r.getByTestId('search-input').props.value).toBe('横浜');
      expect(spotIds(r, 'goshuin-pinned')).toEqual(['spot-1', 'spot-2']);
      expect(spotIds(r, 'goshuin-spots')).toEqual([]);
      expect(r.queryByTestId('bottom-sheet')).toBeNull();
    });

    it('地域の寺社のピンは、状態（色）を変えない', () => {
      const r = renderWith({ focusRegion: region });
      expect(features(r, 'goshuin-pinned').map(f => f.properties.state)).toEqual([
        'unvisited',
        'unvisited',
      ]);
    });

    it('開いていたシートは閉じる', () => {
      const r = renderWith(undefined);
      fireEvent(r.getByTestId('goshuin-pinned'), 'onPress', {
        nativeEvent: { lngLat: [140.87, 38.27], features: [{ properties: { spotId: 'spot-1' } }] },
      });
      expect(r.getByTestId('bottom-sheet')).toBeTruthy();

      rerenderWith(r, { focusRegion: region });

      expect(r.queryByTestId('bottom-sheet')).toBeNull();
      expect(r.getByTestId('search-input').props.value).toBe('横浜');
    });

    it('AC-14: 範囲が点なら fitBounds ではなく寄せる', () => {
      renderWith({ focusRegion: { ...region, bounds: [140.87, 38.27, 140.87, 38.27] } });

      expect(cameraMocks.flyTo).toHaveBeenCalledWith({
        center: [140.87, 38.27],
        zoom: 15.5,
        duration: 600,
      });
      expect(cameraMocks.fitBounds).not.toHaveBeenCalled();
    });

    it('AC-15: 寺社の読み込み直しでは寄せ直さない。新しい focusRegion なら寄せ直す', () => {
      const params = { focusRegion: region };
      const r = renderWith(params);

      mockSpotsOverride = mockSpots.map(spot => ({ ...spot }));
      rerenderWith(r, params);
      expect(cameraMocks.fitBounds).toHaveBeenCalledTimes(1);

      rerenderWith(r, { focusRegion: { ...region } });
      expect(cameraMocks.fitBounds).toHaveBeenCalledTimes(2);
    });

    it('AC-16: × で文字と地域の表示を消す。カメラは動かさない', () => {
      const r = renderWith({ focusRegion: region });
      const flyToCount = cameraMocks.flyTo.mock.calls.length;

      fireEvent.press(r.getByTestId('search-clear-button'));

      expect(r.getByTestId('search-input').props.value).toBeUndefined();
      expect(spotIds(r, 'goshuin-pinned')).toEqual([]);
      expect(spotIds(r, 'goshuin-spots')).toEqual(['spot-1', 'spot-2']);
      expect(cameraMocks.flyTo).toHaveBeenCalledTimes(flyToCount);
      expect(cameraMocks.fitBounds).toHaveBeenCalledTimes(1);
    });

    it('AC-17: 寺社の focusSpotId が来たら地域の表示を消し、文字は寺社の名前・シートを出す', () => {
      const r = renderWith({ focusRegion: region });
      expect(spotIds(r, 'goshuin-pinned')).toEqual(['spot-1', 'spot-2']);

      rerenderWith(r, { focusSpotId: 'spot-1' });

      expect(spotIds(r, 'goshuin-pinned')).not.toContain('spot-2');
      expect(r.getByTestId('search-input').props.value).toBe('Test Shrine');
      expect(r.getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('AC-18: focusRegion も focusSpotId も無くなったら、地域の表示と文字を消す', () => {
      const r = renderWith({ focusRegion: region });
      expect(r.getByTestId('search-input').props.value).toBe('横浜');
      expect(spotIds(r, 'goshuin-pinned')).toEqual(['spot-1', 'spot-2']);

      rerenderWith(r, undefined);

      expect(spotIds(r, 'goshuin-pinned')).toEqual([]);
      expect(r.getByTestId('search-input').props.value).toBeUndefined();
    });

    describe('寄せた地図の下の一覧（S0 の 3）', () => {
      const selectSpotOnMap = (r: Rendered, spotId: string) =>
        fireEvent(r.getByTestId('goshuin-pinned'), 'onPress', {
          nativeEvent: { lngLat: [140.87, 38.27], features: [{ properties: { spotId } }] },
        });
      const layoutSheet = (r: Rendered, height: number) =>
        fireEvent(r.getByTestId('region-sheet'), 'layout', {
          nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
        });

      it('AC-42: 一覧が出て、見出しに件数、行は rank の高い順', () => {
        mockSpotsOverride = [mockSpots[0], { ...mockSpots[1], rank: 5 }];
        const r = renderWith({ focusRegion: region });

        const sheet = r.getByTestId('region-sheet');
        expect(within(sheet).getByText('横浜のあたりの寺社（2）')).toBeTruthy();
        expect(within(r.getByTestId('region-spot-0')).getByText('Test Temple')).toBeTruthy();
        expect(within(r.getByTestId('region-spot-1')).getByText('Test Shrine')).toBeTruthy();
        expect(r.queryByTestId('region-spot-2')).toBeNull();
      });

      it('AC-43: 一覧の寺社を押すと、その寺社のシートが開き、一覧は閉じる。地域のピンは残る', () => {
        const r = renderWith({ focusRegion: region });

        fireEvent.press(r.getByTestId('region-spot-0'));

        expect(r.getByTestId('bottom-sheet')).toBeTruthy();
        expect(r.queryByTestId('region-sheet')).toBeNull();
        expect(r.getByTestId('search-input').props.value).toBe('Test Shrine');
        expect(spotIds(r, 'goshuin-pinned')).toEqual(['spot-1', 'spot-2']);
      });

      it('地図のピンを押したときも一覧と同じ（一覧は閉じ、地域のピンは残る）', () => {
        const r = renderWith({ focusRegion: region });
        expect(r.getByTestId('region-sheet')).toBeTruthy();

        selectSpotOnMap(r, 'spot-2');

        expect(r.getByTestId('bottom-sheet')).toBeTruthy();
        expect(r.queryByTestId('region-sheet')).toBeNull();
        expect(spotIds(r, 'goshuin-pinned')).toEqual(['spot-1', 'spot-2']);
      });

      it('AC-44: 検索バーの × で一覧も消える', () => {
        const r = renderWith({ focusRegion: region });
        expect(r.getByTestId('region-sheet')).toBeTruthy();

        fireEvent.press(r.getByTestId('search-clear-button'));

        expect(r.queryByTestId('region-sheet')).toBeNull();
      });

      it('寺社の focusSpotId が来たら一覧も消える', () => {
        const r = renderWith({ focusRegion: region });
        expect(r.getByTestId('region-sheet')).toBeTruthy();

        rerenderWith(r, { focusSpotId: 'spot-1' });

        expect(r.queryByTestId('region-sheet')).toBeNull();
      });

      it('一覧が出ている間は、記録の FAB を引っ込める（引っ込む動きのあとで消える）', async () => {
        const r = renderWith({ focusRegion: region });
        await waitFor(() => expect(r.queryByTestId('fab-button')).toBeNull());

        fireEvent.press(r.getByTestId('search-clear-button'));
        await waitFor(() => expect(r.getByTestId('fab-button')).toBeTruthy());
      });

      it('AC-45: 「視差効果を減らす」なら、一覧の出る動き（Animated.timing）を呼ばない', async () => {
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
        const r = renderWith(undefined);
        // isReduceMotionEnabled() の解決を待ってから、地域を渡す
        await act(async () => {});
        const timing = jest.spyOn(Animated, 'timing');
        try {
          rerenderWith(r, { focusRegion: region });

          expect(r.getByTestId('region-sheet')).toBeTruthy();
          expect(timing).not.toHaveBeenCalled();
        } finally {
          timing.mockRestore();
        }
      });

      it('一覧の高さが 200 を超えたら、その高さのぶん下を空けて1回だけ寄せ直す', () => {
        const r = renderWith({ focusRegion: region });

        layoutSheet(r, 300);
        layoutSheet(r, 320);

        expect(cameraMocks.fitBounds).toHaveBeenCalledTimes(2);
        expect(cameraMocks.fitBounds).toHaveBeenLastCalledWith([140.86, 38.26, 140.88, 38.28], {
          padding: { ...PADDING, bottom: 316 },
          duration: 600,
        });
      });

      it('一覧が低ければ寄せ直さない', () => {
        const r = renderWith({ focusRegion: region });

        layoutSheet(r, 150);

        expect(cameraMocks.fitBounds).toHaveBeenCalledTimes(1);
      });

      it('寺社を選んだあと focusRegion が無くなっても、寺社のシートと名前は残す（地域は消す）', () => {
        // 記録の完了画面の「地図に戻る」は params なしで地図に来る
        const r = renderWith({ focusRegion: region });
        fireEvent.press(r.getByTestId('region-spot-0'));

        rerenderWith(r, undefined);

        expect(r.getByTestId('bottom-sheet')).toBeTruthy();
        expect(r.getByTestId('search-input').props.value).toBe('Test Shrine');
        expect(spotIds(r, 'goshuin-pinned')).toEqual([]);
        expect(r.queryByTestId('region-sheet')).toBeNull();
      });
    });
  });
});
