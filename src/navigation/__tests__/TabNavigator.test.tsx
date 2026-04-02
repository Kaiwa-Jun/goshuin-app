import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabNavigator } from '../TabNavigator';
import type { RootStackParamList } from '@/navigation/types';
import { Text, Image } from 'react-native';

jest
  .spyOn(Image, 'getSize')
  .mockImplementation((_uri: string, success: (width: number, height: number) => void) => {
    success(800, 1200);
  });

// Mock environment variables for supabase
const env = process.env;
env['EXPO_PUBLIC_SUPABASE_URL'] = 'https://test.supabase.co';
env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] = 'test-anon-key';

// Mock useAuth - controlled per test
const mockUseAuth = jest.fn();
jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useOnboarding
jest.mock('@hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    isCompleted: true,
    isLoading: false,
    completeOnboarding: jest.fn(),
  }),
}));

// Mock hooks used by MapScreen
jest.mock('@hooks/useLocation', () => ({
  useLocation: () => ({
    location: { latitude: 38.2682, longitude: 140.8694 },
    isLoading: false,
    error: null,
    permissionStatus: 'granted',
    refreshLocation: jest.fn(),
  }),
}));

jest.mock('@hooks/useSpots', () => ({
  useSpots: () => ({
    spots: [],
    allSpots: [],
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@hooks/useUserStamps', () => ({
  useUserStamps: () => ({
    visitedSpotIds: new Set(),
    isLoading: false,
  }),
}));

jest.mock('@hooks/useWishlist', () => ({
  useWishlist: () => ({
    wishlistSpotIds: new Set(),
    toggleWishlist: jest.fn(),
    isLoading: false,
    isToggling: false,
  }),
}));

jest.mock('@hooks/useWishlistSpots', () => ({
  useWishlistSpots: () => ({
    spots: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@hooks/useCollectionStats', () => ({
  useCollectionStats: () => ({
    spotCount: 0,
    stampCount: 0,
    regionStats: [],
    pilgrimageProgress: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@services/badges', () => ({
  getAllBadges: () => [],
}));

jest.mock('@services/pilgrimages', () => ({
  fetchPilgrimageSpots: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then: jest.fn(),
    })),
  },
}));

jest.mock('@services/wishlist', () => ({
  removeFromWishlist: jest.fn(),
}));

jest.mock('@hooks/useMapSearch', () => ({
  useMapSearch: () => ({
    query: '',
    setQuery: jest.fn(),
    suggestions: [],
    showSuggestions: false,
    setShowSuggestions: jest.fn(),
    nearbySpots: [],
    clearSearch: jest.fn(),
  }),
}));

jest.mock('@hooks/useSpotDetail', () => ({
  useSpotDetail: () => ({
    spot: null,
    isLoading: false,
    error: null,
  }),
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

jest.mock('@hooks/useDefaultPublicSetting', () => ({
  useDefaultPublicSetting: () => ({
    defaultPublic: false,
    isLoading: false,
    updateDefaultPublic: jest.fn(),
  }),
}));

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://example.com/stamps/${path}`,
}));

jest.mock('@hooks/useGalleryStamps', () => ({
  useGalleryStamps: () => ({
    stamps: [
      {
        id: 'stamp-1',
        user_id: 'user-1',
        spot_id: 'spot-1',
        goshuincho_id: null,
        visited_at: '2024-06-01',
        image_path: 'img/1.jpg',
        memo: null,
        created_at: '2024-06-01',
        updated_at: '2024-06-01',
        spots: { name: '明治神宮', type: 'shrine' },
      },
    ],
    totalCount: 1,
    isLoading: false,
    error: null,
  }),
}));

// Wrap TabNavigator in a RootStack to support Login navigation
const Stack = createNativeStackNavigator<RootStackParamList>();

function LoginPlaceholder() {
  return <Text>Login Screen</Text>;
}

function renderTabNavigator() {
  return render(
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen
          name="Login"
          component={LoginPlaceholder}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

describe('TabNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 4 tabs', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: true,
    });

    const { getByText } = renderTabNavigator();

    await waitFor(() => {
      expect(getByText('地図')).toBeTruthy();
      expect(getByText('御朱印')).toBeTruthy();
      expect(getByText('コレクション')).toBeTruthy();
      expect(getByText('設定')).toBeTruthy();
    });
  });

  it('navigates to Login when unauthenticated user taps Gallery tab', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    const { getByText } = renderTabNavigator();

    await waitFor(() => {
      expect(getByText('御朱印')).toBeTruthy();
    });

    fireEvent.press(getByText('御朱印'));

    await waitFor(() => {
      expect(getByText('Login Screen')).toBeTruthy();
    });
  });

  it('navigates to Login when unauthenticated user taps Collection tab', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    const { getByText } = renderTabNavigator();

    await waitFor(() => {
      expect(getByText('コレクション')).toBeTruthy();
    });

    fireEvent.press(getByText('コレクション'));

    await waitFor(() => {
      expect(getByText('Login Screen')).toBeTruthy();
    });
  });

  it('allows authenticated user to access Gallery tab normally', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: {},
      isLoading: false,
      isAuthenticated: true,
    });

    const { getByText, queryByText, getByTestId } = renderTabNavigator();

    await waitFor(() => {
      expect(getByText('御朱印')).toBeTruthy();
    });

    fireEvent.press(getByText('御朱印'));

    await waitFor(() => {
      expect(getByTestId('gallery-list')).toBeTruthy();
    });

    expect(queryByText('Login Screen')).toBeNull();
  });
});
