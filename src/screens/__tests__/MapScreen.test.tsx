import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MapScreen } from '@screens/MapScreen';
import { StyleSheet } from 'react-native';

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
  useSpots: () => ({
    spots: mockSpotsOverride ?? mockSpots,
    allSpots: mockSpotsOverride ?? mockSpots,
    isLoading: false,
    error: null,
  }),
}));

const mockVisitedSpotIds = new Set(['spot-1']);

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
    it('キー不要のベクタータイルスタイルを読む', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByTestId('map-view').props.mapStyle).toMatch(/^https:\/\/.+/);
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

  describe('ラベルの間引き', () => {
    it('名前は重なったら描かない（衝突判定に載せる）', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      const layout = getByTestId('goshuin-spot-label').props.layout;

      expect(layout['text-allow-overlap']).toBe(false);
      expect(layout['text-ignore-placement']).toBe(false);
    });

    it('残す順は rank の高いものから', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      // 小さい sort key が先に置かれるので rank を反転させる
      expect(getByTestId('goshuin-spot-label').props.layout['symbol-sort-key']).toEqual([
        '-',
        10,
        ['get', 'rank'],
      ]);
    });

    it('点そのものは衝突判定の対象外なので常に全件描かれる', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      // CircleLayer には allow-overlap の概念がない = 間引かれない
      expect(getByTestId('goshuin-spot-dot').props.type).toBe('circle');
      expect(getByTestId('goshuin-pinned-dot').props.type).toBe('circle');
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

    it('hides FAB when a spot is selected', () => {
      const r = render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      fireEvent(r.getByTestId('goshuin-pinned'), 'onPress', {
        nativeEvent: {
          lngLat: [140.87, 38.27],
          features: [{ properties: { spotId: 'spot-1' } }],
        },
      });

      expect(r.queryByTestId('fab-button')).toBeNull();
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

    it('closes filter dropdown when overlay is pressed', () => {
      mockUseAuthReturn = { ...mockUseAuthReturn, isAuthenticated: true };
      const { getByTestId, queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
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
      expect(mockParentNavigate).toHaveBeenCalledWith('Record', undefined);
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
});

describe('MapScreen 行きたいリストへの導線（Issue #123）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchSpotsByPrefecture.mockResolvedValue([]);
    mockPermissionStatus = 'granted';
  });

  it('行きたいが0件でもエントリポイントが表示される', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('wishlist-entry')).toBeTruthy();
  });

  it('エントリポイントをタップすると行きたいリストへ遷移する', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByTestId('wishlist-entry'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Wishlist');
  });

  it('行きたいが1件以上のとき件数が出る', () => {
    mockWishlistSpotIds = new Set(['spot-2']);
    const { getByText } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('行きたい (1)')).toBeTruthy();
  });

  it('0件のときは件数を出さない', () => {
    const { getByText } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('行きたい')).toBeTruthy();
  });

  it('エントリポイントは検索行の直下に置かれ、位置情報バナーはその下にずれる', () => {
    mockPermissionStatus = 'denied';
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    const entryTop = StyleSheet.flatten(getByTestId('wishlist-entry').props.style).top;
    const bannerTop = StyleSheet.flatten(getByTestId('location-off-banner').props.style).top;

    expect(bannerTop).toBeGreaterThan(entryTop);
  });
});
