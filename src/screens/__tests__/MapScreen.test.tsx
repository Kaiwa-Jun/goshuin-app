import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MapScreen } from '@screens/MapScreen';

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

  it('displays MapView', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('map-view')).toBeTruthy();
  });

  it('displays current location marker', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('current-location-marker')).toBeTruthy();
    expect(getByTestId('map-pin-current-location')).toBeTruthy();
  });

  it('displays FAB button when no spot is selected', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('fab-button')).toBeTruthy();
  });

  describe('Spot markers', () => {
    it('renders spot markers', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByTestId('spot-marker-spot-1')).toBeTruthy();
      expect(getByTestId('spot-marker-spot-2')).toBeTruthy();
    });

    it('renders spot markers with SpotMarker children', () => {
      const { getByTestId, getAllByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByTestId('spot-marker-spot-1')).toBeTruthy();
      expect(getByTestId('spot-marker-spot-2')).toBeTruthy();
      expect(getAllByTestId('spot-marker-pin-head')).toHaveLength(2);
      expect(getAllByTestId('spot-marker-pin-tail')).toHaveLength(2);
    });

    it('shows bottom sheet when marker is pressed', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('spot-marker-spot-1'));
      expect(getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('hides FAB when marker is pressed and spot is selected', () => {
      const { getByTestId, queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('spot-marker-spot-1'));
      expect(queryByTestId('fab-button')).toBeNull();
    });
  });

  describe('Bottom sheet', () => {
    it('shows bottom sheet when focusSpotId is provided', () => {
      const routeWithFocus = {
        key: 'test',
        name: 'Map' as const,
        params: { focusSpotId: 'spot-1' },
      };

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={routeWithFocus} />
      );

      expect(getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('hides bottom sheet when map is pressed', () => {
      const { getByTestId, queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      // First show the sheet
      fireEvent.press(getByTestId('spot-marker-spot-1'));
      expect(getByTestId('bottom-sheet')).toBeTruthy();

      // Then press the map to dismiss
      fireEvent.press(getByTestId('map-view'));
      expect(queryByTestId('bottom-sheet')).toBeNull();
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
      mockUseAuthReturn = {
        ...mockUseAuthReturn,
        isAuthenticated: true,
        user: { id: 'user-123' } as never,
      };

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByTestId('filter-button')).toBeTruthy();
    });

    it('shows filter dropdown when filter button is pressed', () => {
      mockUseAuthReturn = {
        ...mockUseAuthReturn,
        isAuthenticated: true,
        user: { id: 'user-123' } as never,
      };

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('filter-button'));
      expect(getByTestId('filter-dropdown')).toBeTruthy();
      expect(getByTestId('filter-option-all')).toBeTruthy();
      expect(getByTestId('filter-option-visited')).toBeTruthy();
    });

    it('closes filter dropdown when overlay is pressed', () => {
      mockUseAuthReturn = {
        ...mockUseAuthReturn,
        isAuthenticated: true,
        user: { id: 'user-123' } as never,
      };

      const { getByTestId, queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('filter-button'));
      expect(getByTestId('filter-dropdown')).toBeTruthy();

      fireEvent.press(getByTestId('filter-overlay'));
      expect(queryByTestId('filter-dropdown')).toBeNull();
    });
  });

  describe('Zoom-based label visibility', () => {
    it('shows labels at initial zoom level (latitudeDelta <= 0.08)', () => {
      const { getAllByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      // Initial LATITUDE_DELTA is 0.015, which is <= LABEL_VISIBLE_DELTA (0.2), so labels should show
      expect(getAllByTestId('spot-marker-label')).toHaveLength(2);
    });

    it('labels are present but hidden when zoomed out (latitudeDelta > 0.08)', () => {
      const { getByTestId, getAllByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      const mapView = getByTestId('map-view');
      // Simulate zooming out beyond ~8km range
      fireEvent(mapView, 'onRegionChangeComplete', {
        latitude: 38.2682,
        longitude: 140.8694,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });

      // ラベルは常にレンダリングされるが、opacity で非表示
      expect(getAllByTestId('spot-marker-label')).toHaveLength(2);
    });

    it('shows labels again when zoomed back in', () => {
      const { getByTestId, getAllByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      const mapView = getByTestId('map-view');

      // Zoom out
      fireEvent(mapView, 'onRegionChangeComplete', {
        latitude: 38.2682,
        longitude: 140.8694,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
      // ラベルは常にレンダリングされる（opacity で制御）
      expect(getAllByTestId('spot-marker-label')).toHaveLength(2);

      // Zoom back in
      fireEvent(mapView, 'onRegionChangeComplete', {
        latitude: 38.2682,
        longitude: 140.8694,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      expect(getAllByTestId('spot-marker-label')).toHaveLength(2);
    });
  });

  describe('FAB press with authentication', () => {
    it('navigates to Record when authenticated', () => {
      mockUseAuthReturn = {
        ...mockUseAuthReturn,
        isAuthenticated: true,
        user: { id: 'user-123' } as never,
      };

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('fab-button'));
      expect(mockParentNavigate).toHaveBeenCalledWith('Record', undefined);
    });

    it('shows LoginPromptModal when not authenticated', () => {
      const { getByTestId, getByText } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('fab-button'));
      expect(getByText('ログインが必要です')).toBeTruthy();
    });

    it('navigates to Record after successful login from modal', async () => {
      mockUseAuthReturn.signInWithGoogle.mockResolvedValue({ success: true });

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('fab-button'));
      fireEvent.press(getByTestId('modal-google-login-button'));

      await waitFor(() => {
        expect(mockParentNavigate).toHaveBeenCalledWith('Record', undefined);
      });
    });

    it('closes modal when later button is pressed', () => {
      const { getByTestId, queryByText } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('fab-button'));
      expect(queryByText('ログインが必要です')).toBeTruthy();

      fireEvent.press(getByTestId('modal-later-button'));
      expect(queryByText('ログインが必要です')).toBeNull();
    });
  });

  describe('focusPrefecture', () => {
    const prefectureSpots = [
      {
        id: 'pref-spot-1',
        name: '宮城県神社A',
        lat: 38.3,
        lng: 140.9,
        type: 'shrine',
        status: 'active',
        rank: 3,
        address: '宮城県X市',
        created_by_user_id: null,
        merged_into_spot_id: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        id: 'pref-spot-2',
        name: '宮城県寺院B',
        lat: 38.35,
        lng: 140.95,
        type: 'temple',
        status: 'active',
        rank: 3,
        address: '宮城県Y市',
        created_by_user_id: null,
        merged_into_spot_id: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ];

    it('focusPrefecture が渡されると fetchSpotsByPrefecture が呼ばれる', async () => {
      mockFetchSpotsByPrefecture.mockResolvedValue(prefectureSpots);

      const routeWithPrefecture = {
        key: 'test',
        name: 'Map' as const,
        params: { focusPrefecture: '宮城県' },
      };

      render(<MapScreen navigation={mockNavigation as never} route={routeWithPrefecture} />);

      await waitFor(() => {
        expect(mockFetchSpotsByPrefecture).toHaveBeenCalledWith('宮城県');
      });
    });

    it('focusPrefecture がない場合は fetchSpotsByPrefecture が呼ばれない', () => {
      render(<MapScreen navigation={mockNavigation as never} route={mockRoute} />);
      expect(mockFetchSpotsByPrefecture).not.toHaveBeenCalled();
    });

    it('prefectureSpots は既存 spots に追加してマーカー表示される', async () => {
      mockFetchSpotsByPrefecture.mockResolvedValue(prefectureSpots);

      const routeWithPrefecture = {
        key: 'test',
        name: 'Map' as const,
        params: { focusPrefecture: '宮城県' },
      };

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={routeWithPrefecture} />
      );

      await waitFor(() => {
        expect(mockFetchSpotsByPrefecture).toHaveBeenCalled();
      });

      // fitToCoordinates のアニメーション完了を模して県域を覆う region を発火する(#96)
      fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', {
        latitude: 38.31,
        longitude: 140.91,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      });

      // 既存の spots のマーカーも表示される
      expect(getByTestId('spot-marker-spot-1')).toBeTruthy();
      expect(getByTestId('spot-marker-spot-2')).toBeTruthy();
      // 県内 spots のマーカーも表示される
      expect(getByTestId('spot-marker-pref-spot-1')).toBeTruthy();
      expect(getByTestId('spot-marker-pref-spot-2')).toBeTruthy();
    });

    describe('位置情報オフバナー', () => {
      it('permissionStatus が granted のときはバナーを表示しない', () => {
        mockPermissionStatus = 'granted';
        const { queryByTestId } = render(
          <MapScreen navigation={mockNavigation as never} route={mockRoute} />
        );
        expect(queryByTestId('location-off-banner')).toBeNull();
      });

      it('permissionStatus が denied のときはバナーを表示する', () => {
        mockPermissionStatus = 'denied';
        const { getByTestId } = render(
          <MapScreen navigation={mockNavigation as never} route={mockRoute} />
        );
        expect(getByTestId('location-off-banner')).toBeTruthy();
      });

      it('バナーに「位置情報がオフです。タップして設定」テキストが表示される', () => {
        mockPermissionStatus = 'denied';
        const { getByText } = render(
          <MapScreen navigation={mockNavigation as never} route={mockRoute} />
        );
        expect(getByText('位置情報がオフです。タップして設定')).toBeTruthy();
      });

      it('バナーをタップすると Error 画面（type: location）に遷移する', () => {
        mockPermissionStatus = 'denied';
        const { getByTestId } = render(
          <MapScreen navigation={mockNavigation as never} route={mockRoute} />
        );
        fireEvent.press(getByTestId('location-off-banner'));
        expect(mockNavigation.navigate).toHaveBeenCalledWith('Error', { type: 'location' });
      });
    });

    it('focusPrefecture が消えると prefectureSpots がクリアされる', async () => {
      mockFetchSpotsByPrefecture.mockResolvedValue(prefectureSpots);

      const routeWithPrefecture = {
        key: 'test',
        name: 'Map' as const,
        params: { focusPrefecture: '宮城県' },
      };

      const { rerender, queryByTestId, getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={routeWithPrefecture} />
      );

      await waitFor(() => {
        expect(mockFetchSpotsByPrefecture).toHaveBeenCalled();
      });

      // fitToCoordinates 完了を模した県域 region で県内 spots の表示をまず確認する(#96)
      fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', {
        latitude: 38.31,
        longitude: 140.91,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      });
      expect(getByTestId('spot-marker-pref-spot-1')).toBeTruthy();
      expect(getByTestId('spot-marker-pref-spot-2')).toBeTruthy();

      // focusPrefecture なしに変更
      const routeWithoutPrefecture = {
        key: 'test',
        name: 'Map' as const,
        params: undefined,
      };

      rerender(<MapScreen navigation={mockNavigation as never} route={routeWithoutPrefecture} />);

      // 県内 spots のマーカーは消える
      await waitFor(() => {
        expect(queryByTestId('spot-marker-pref-spot-1')).toBeNull();
        expect(queryByTestId('spot-marker-pref-spot-2')).toBeNull();
      });
    });
  });

  describe('Rank filter exemption for visited/wishlist spots (#93)', () => {
    const zoomedOutRegion = {
      latitude: 38.2682,
      longitude: 140.8694,
      latitudeDelta: 0.6, // minRank 5 相当
      longitudeDelta: 0.6,
    };

    it('ズームアウト(minRank 5 相当)でも訪問済みスポットのマーカーは表示され続ける', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', zoomedOutRegion);

      expect(getByTestId('spot-marker-spot-1')).toBeTruthy();
    });

    it('ズームアウトでも行きたいリストのスポットのマーカーは表示され続ける', () => {
      mockWishlistSpotIds = new Set(['spot-2']);

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', zoomedOutRegion);

      expect(getByTestId('spot-marker-spot-2')).toBeTruthy();
    });
  });

  describe('Default zoom level (#93)', () => {
    it('initialRegion のデフォルト delta は 0.015 である', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      expect(getByTestId('map-view').props.initialRegion).toEqual(
        expect.objectContaining({ latitudeDelta: 0.015, longitudeDelta: 0.015 })
      );
    });
  });

  describe('Viewport top-N selection (#96)', () => {
    const CENTER_LAT = 38.2682;
    const CENTER_LNG = 140.8694;

    const regionAt = (latitudeDelta: number) => ({
      latitude: CENTER_LAT,
      longitude: CENTER_LNG,
      latitudeDelta,
      longitudeDelta: latitudeDelta,
    });

    const genSpot = (i: number, overrides: Record<string, unknown> = {}) => ({
      id: `gen-${String(i).padStart(4, '0')}`,
      name: `Gen Spot ${i}`,
      lat: CENTER_LAT + (i % 34) * 0.0002,
      lng: CENTER_LNG + Math.floor(i / 34) * 0.0002,
      type: 'shrine',
      status: 'active',
      rank: (i % 5) + 1,
      address: null,
      created_by_user_id: null,
      merged_into_spot_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      ...overrides,
    });

    it('初期ビューポート内の rank 2 スポットは delta 0.019 / 0.021 / 0.025 のいずれでも表示され続ける(ポッピング解消)', () => {
      // delta 0.1 はクラスタ化帯(zoom 12)に入るため非クラスタ帯(zoom 14)の値に変更(#99)
      mockSpotsOverride = [
        ...mockSpots,
        genSpot(0, { id: 'spot-rank2', lat: 38.269, lng: 140.87, rank: 2 }),
      ] as typeof mockSpots;

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      expect(getByTestId('spot-marker-spot-rank2')).toBeTruthy();

      for (const delta of [0.019, 0.021, 0.025]) {
        fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', regionAt(delta));
        expect(getByTestId('spot-marker-spot-rank2')).toBeTruthy();
      }
    });

    it('ビューポート外(東京座標)のスポットは rank 5 でも初期表示でレンダリングされない', () => {
      mockSpotsOverride = [
        ...mockSpots,
        genSpot(0, { id: 'spot-tokyo', lat: 35.6812, lng: 139.7671, rank: 5 }),
      ] as typeof mockSpots;

      const { queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      expect(queryByTestId('spot-marker-spot-tokyo')).toBeNull();
    });

    it('同 rank 81 件では個別描画上限 60 件(MAX_INDIVIDUAL_SPOTS)を超える中心から遠い分がレンダリングされない', () => {
      mockSpotsOverride = Array.from({ length: 81 }, (_, i) =>
        genSpot(i, { lat: CENTER_LAT + i * 0.00005, lng: CENTER_LNG, rank: 3 })
      ) as typeof mockSpots;

      const { queryAllByTestId, getByTestId, queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      expect(queryAllByTestId(/^spot-marker-gen-/)).toHaveLength(60);
      expect(getByTestId('spot-marker-gen-0059')).toBeTruthy();
      expect(queryByTestId('spot-marker-gen-0060')).toBeNull();
    });

    it('rank 1 のスポットしかないエリアでも delta 0.6 にズームアウトして地図が空にならない', () => {
      mockSpotsOverride = [genSpot(0, { id: 'spot-low', rank: 1 })] as typeof mockSpots;

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', regionAt(0.6));
      expect(getByTestId('spot-marker-spot-low')).toBeTruthy();
    });

    it('初期ビューポート内 1,109 件でもレンダリングされる個別マーカーは 60 件・クラスタ 0 件(#99 P-3)', () => {
      mockSpotsOverride = Array.from({ length: 1109 }, (_, i) => genSpot(i)) as typeof mockSpots;

      const { queryAllByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      expect(queryAllByTestId(/^spot-marker-gen-/)).toHaveLength(60);
      expect(queryAllByTestId(/^cluster-marker-/)).toHaveLength(0);
    });

    it('個別 60 件選外の wishlist スポットは pinned 枠で表示され、総数は 61 件(#99)', () => {
      mockSpotsOverride = Array.from({ length: 1109 }, (_, i) => genSpot(i)) as typeof mockSpots;
      // rank 1 のスポット(個別 60 件は rank 5 で埋まるため確実に選外)を wishlist に入れる
      mockWishlistSpotIds = new Set(['gen-0000']);

      const { queryAllByTestId, getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      expect(queryAllByTestId(/^spot-marker-gen-/)).toHaveLength(61);
      expect(getByTestId('spot-marker-gen-0000')).toBeTruthy();
    });

    it('focusPrefecture で県 spots が 100 件でも県域 region 発火後はクラスタ化されマーカー総数 130 以下(#99 AC-36)', async () => {
      mockSpotsOverride = [] as unknown as typeof mockSpots;
      const prefGen = Array.from({ length: 100 }, (_, i) =>
        genSpot(i, {
          id: `pref-gen-${String(i).padStart(4, '0')}`,
          lat: 38.31 + (i % 10) * 0.001,
          lng: 140.91 + Math.floor(i / 10) * 0.001,
        })
      );
      mockFetchSpotsByPrefecture.mockResolvedValue(prefGen);

      const routeWithPrefecture = {
        key: 'test',
        name: 'Map' as const,
        params: { focusPrefecture: '宮城県' },
      };

      const { getByTestId, queryAllByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={routeWithPrefecture} />
      );

      await waitFor(() => {
        expect(mockFetchSpotsByPrefecture).toHaveBeenCalled();
      });

      fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', {
        latitude: 38.315,
        longitude: 140.915,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      });

      const clusterMarkers = queryAllByTestId(/^cluster-marker-/);
      const spotMarkers = queryAllByTestId(/^spot-marker-/);
      expect(clusterMarkers.length).toBeGreaterThanOrEqual(1);
      expect(clusterMarkers.length + spotMarkers.length).toBeLessThanOrEqual(130);
    });
  });

  describe('Clustering (#99)', () => {
    const CENTER_LAT = 38.2682;
    const CENTER_LNG = 140.8694;

    const regionAt = (latitudeDelta: number, latitude = CENTER_LAT) => ({
      latitude,
      longitude: CENTER_LNG,
      latitudeDelta,
      longitudeDelta: latitudeDelta,
    });

    // 中心付近の 0.0005° グリッドに count 件を決定的に配置する
    const gridSpots = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `gen-${String(i).padStart(4, '0')}`,
        name: `Gen Spot ${i}`,
        lat: CENTER_LAT + (Math.floor(i / 20) - 4.5) * 0.0005,
        lng: CENTER_LNG + ((i % 20) - 9.5) * 0.0005,
        type: 'shrine',
        status: 'active',
        rank: (i % 5) + 1,
        address: null,
        created_by_user_id: null,
        merged_into_spot_id: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      })) as typeof mockSpots;

    it('AC-29: 初期表示(delta 0.015)ではクラスタバブルが 0 件で個別ピンのみ', () => {
      const { queryAllByTestId, getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      expect(queryAllByTestId(/^cluster-marker-/)).toHaveLength(0);
      expect(getByTestId('spot-marker-spot-1')).toBeTruthy();
      expect(getByTestId('spot-marker-spot-2')).toBeTruthy();
    });

    it('AC-30: 近接 200 件が delta 0.6 で 1 個のバブル(count 200)に畳まれる', () => {
      mockSpotsOverride = gridSpots(200);

      const { getByTestId, queryAllByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', regionAt(0.6));

      expect(queryAllByTestId(/^cluster-marker-/)).toHaveLength(1);
      expect(getByTestId('cluster-bubble-count').props.children).toBe('200');
    });

    it('AC-31: 0.11° 間隔 7×7 グリッド×2 件は delta 0.6 でバブル 40 件・個別 0 件', () => {
      const spots: typeof mockSpots = [] as unknown as typeof mockSpots;
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 7; col++) {
          const lat = CENTER_LAT + (row - 3) * 0.11;
          const lng = CENTER_LNG + (col - 3) * 0.11;
          const base = (row * 7 + col) * 2;
          for (const [j, latOffset] of [0, 0.0001].entries()) {
            spots.push({
              id: `gen-${String(base + j).padStart(4, '0')}`,
              name: `Gen Spot ${base + j}`,
              lat: lat + latOffset,
              lng,
              type: 'shrine',
              status: 'active',
              rank: 3,
              address: null,
              created_by_user_id: null,
              merged_into_spot_id: null,
              created_at: '2024-01-01',
              updated_at: '2024-01-01',
            } as (typeof mockSpots)[number]);
          }
        }
      }
      mockSpotsOverride = spots;

      const { getByTestId, queryAllByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', regionAt(0.6));

      expect(queryAllByTestId(/^cluster-marker-/)).toHaveLength(40);
      expect(queryAllByTestId(/^spot-marker-/)).toHaveLength(0);
    });

    it('AC-33: 中心移動が delta の 9% ではクラスタ region が再計算されない(ヒステリシス)', () => {
      mockSpotsOverride = [
        ...mockSpots,
        {
          ...mockSpots[0],
          id: 'spot-hyst',
          name: 'Hysteresis Spot',
          lat: 38.335,
          lng: 140.8694,
          rank: 5,
        },
      ] as typeof mockSpots;

      const { getByTestId, queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      const mapView = getByTestId('map-view');
      fireEvent(mapView, 'onRegionChangeComplete', regionAt(0.1));
      expect(queryByTestId('spot-marker-spot-hyst')).toBeNull();

      // 中心移動 0.009 = delta の 9% < 10% → 採用されず旧ビューポートのまま
      fireEvent(mapView, 'onRegionChangeComplete', regionAt(0.1, 38.2772));
      expect(queryByTestId('spot-marker-spot-hyst')).toBeNull();
    });

    it('AC-34: 中心移動が delta の 11% ならクラスタ region が再計算される', () => {
      mockSpotsOverride = [
        ...mockSpots,
        {
          ...mockSpots[0],
          id: 'spot-hyst',
          name: 'Hysteresis Spot',
          lat: 38.335,
          lng: 140.8694,
          rank: 5,
        },
      ] as typeof mockSpots;

      const { getByTestId, queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      const mapView = getByTestId('map-view');
      fireEvent(mapView, 'onRegionChangeComplete', regionAt(0.1));
      expect(queryByTestId('spot-marker-spot-hyst')).toBeNull();

      // 中心移動 0.011 = delta の 11% >= 10% → 採用され新ビューポートに入る
      fireEvent(mapView, 'onRegionChangeComplete', regionAt(0.1, 38.2792));
      expect(getByTestId('spot-marker-spot-hyst')).toBeTruthy();
    });

    it('AC-35: クラスタバブルのタップで animateToRegion がズームイン region で呼ばれる', () => {
      mockSpotsOverride = gridSpots(200);

      const { getByTestId, queryAllByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', regionAt(0.6));

      const clusterMarker = queryAllByTestId(/^cluster-marker-/)[0];
      fireEvent.press(clusterMarker);

      const { __mapViewMocks } = jest.requireMock('react-native-maps');
      expect(__mapViewMocks.animateToRegion).toHaveBeenCalled();
      const [firstArg] = __mapViewMocks.animateToRegion.mock.calls[0];
      expect(firstArg.latitudeDelta).toBeLessThan(0.6);
    });

    it('P-4: 1,109 件が delta 0.6 で 1 個のバブル(count 1109)に畳まれ個別 0 件', () => {
      mockSpotsOverride = Array.from({ length: 1109 }, (_, i) => ({
        id: `gen-${String(i).padStart(4, '0')}`,
        name: `Gen Spot ${i}`,
        lat: CENTER_LAT + (i % 34) * 0.0002,
        lng: CENTER_LNG + Math.floor(i / 34) * 0.0002,
        type: 'shrine',
        status: 'active',
        rank: (i % 5) + 1,
        address: null,
        created_by_user_id: null,
        merged_into_spot_id: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      })) as typeof mockSpots;

      const { getByTestId, queryAllByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', regionAt(0.6));

      expect(queryAllByTestId(/^cluster-marker-/)).toHaveLength(1);
      expect(queryAllByTestId(/^spot-marker-/)).toHaveLength(0);
      expect(getByTestId('cluster-bubble-count').props.children).toBe('1109');
    });
  });
});
