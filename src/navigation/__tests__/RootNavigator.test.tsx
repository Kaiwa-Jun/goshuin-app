import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

import { RootNavigator } from '../RootNavigator';

// Mock auth service
jest.mock('@services/auth', () => ({
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
}));

// Mock environment variables for supabase
const env = process.env;
env['EXPO_PUBLIC_SUPABASE_URL'] = 'https://test.supabase.co';
env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] = 'test-anon-key';

// Mock useOnboarding
const mockUseOnboarding = jest.fn();
jest.mock('@hooks/useOnboarding', () => ({
  useOnboarding: () => mockUseOnboarding(),
}));

// Mock useAuth
jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
    isSigningIn: false,
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
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
    visitCount: 0,
    latestVisitDate: null,
    isLoading: false,
  }),
}));

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://example.com/stamps/${path}`,
}));

function renderWithNavigation() {
  return render(
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

describe('RootNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading indicator while onboarding state is loading', () => {
    mockUseOnboarding.mockReturnValue({
      isCompleted: false,
      isLoading: true,
      completeOnboarding: jest.fn(),
    });

    const { queryByTestId } = renderWithNavigation();

    expect(queryByTestId('onboarding-screen')).toBeNull();
    expect(queryByTestId('map-screen')).toBeNull();
  });

  it('shows Onboarding screen when onboarding is not completed', async () => {
    mockUseOnboarding.mockReturnValue({
      isCompleted: false,
      isLoading: false,
      completeOnboarding: jest.fn(),
    });

    const { getByTestId } = renderWithNavigation();

    await waitFor(() => {
      expect(getByTestId('onboarding-screen')).toBeTruthy();
    });
  });

  it('shows Map screen (MainTabs) when onboarding is completed', async () => {
    mockUseOnboarding.mockReturnValue({
      isCompleted: true,
      isLoading: false,
      completeOnboarding: jest.fn(),
    });

    const { getByTestId } = renderWithNavigation();

    await waitFor(() => {
      expect(getByTestId('map-screen')).toBeTruthy();
    });
  });
});
