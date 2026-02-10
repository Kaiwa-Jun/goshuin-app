import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MapScreen } from '@screens/MapScreen';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
      React.createElement(View, props, children),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});

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

jest.mock('@hooks/useLocation', () => ({
  useLocation: () => ({
    location: mockLocation,
    isLoading: false,
    error: null,
    permissionStatus: 'granted',
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
    address: null,
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'spot-2',
    name: 'Test Temple',
    lat: 38.28,
    lng: 140.88,
    type: 'temple',
    status: 'active',
    address: null,
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
];

jest.mock('@hooks/useSpots', () => ({
  useSpots: () => ({
    spots: mockSpots,
    allSpots: mockSpots,
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

const mockSetQuery = jest.fn();
const mockSetShowSuggestions = jest.fn();
const mockClearSearch = jest.fn();

let mockUseMapSearchReturn = {
  query: '',
  setQuery: mockSetQuery,
  suggestions: [] as { spot: (typeof mockSpots)[0]; distance: number }[],
  showSuggestions: false,
  setShowSuggestions: mockSetShowSuggestions,
  nearbySpots: mockSpots.map(s => ({ spot: s, distance: 1.5 })),
  clearSearch: mockClearSearch,
};

jest.mock('@hooks/useMapSearch', () => ({
  useMapSearch: () => mockUseMapSearchReturn,
}));

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
    mockUseMapSearchReturn = {
      query: '',
      setQuery: mockSetQuery,
      suggestions: [],
      showSuggestions: false,
      setShowSuggestions: mockSetShowSuggestions,
      nearbySpots: mockSpots.map(s => ({ spot: s, distance: 1.5 })),
      clearSearch: mockClearSearch,
    };
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

  it('displays FAB button', () => {
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

    it('navigates to SpotDetail when marker is pressed', () => {
      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('spot-marker-spot-1'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('SpotDetail', { spotId: 'spot-1' });
    });
  });

  describe('Search suggestions', () => {
    it('shows suggestions list when showSuggestions is true and has nearby spots', () => {
      mockUseMapSearchReturn = {
        ...mockUseMapSearchReturn,
        showSuggestions: true,
      };

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByTestId('suggestions-list')).toBeTruthy();
    });

    it('does not show suggestions when showSuggestions is false', () => {
      mockUseMapSearchReturn = {
        ...mockUseMapSearchReturn,
        showSuggestions: false,
      };

      const { queryByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(queryByTestId('suggestions-list')).toBeNull();
    });

    it('navigates to SpotDetail when suggestion is pressed', () => {
      mockUseMapSearchReturn = {
        ...mockUseMapSearchReturn,
        showSuggestions: true,
      };

      const { getByTestId } = render(
        <MapScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('suggestion-spot-1'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('SpotDetail', { spotId: 'spot-1' });
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
      // Initial LATITUDE_DELTA is 0.02, which is <= 0.08, so labels should show
      expect(getAllByTestId('spot-marker-label')).toHaveLength(2);
    });

    it('hides labels when zoomed out (latitudeDelta > 0.08)', () => {
      const { getByTestId, queryAllByTestId } = render(
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

      expect(queryAllByTestId('spot-marker-label')).toHaveLength(0);
    });

    it('shows labels again when zoomed back in', () => {
      const { getByTestId, getAllByTestId, queryAllByTestId } = render(
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
      expect(queryAllByTestId('spot-marker-label')).toHaveLength(0);

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
      expect(mockParentNavigate).toHaveBeenCalledWith('Record');
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
        expect(mockParentNavigate).toHaveBeenCalledWith('Record');
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
});
