import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabNavigator } from '../TabNavigator';
import type { RootStackParamList } from '@/navigation/types';
import { Text } from 'react-native';

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
      expect(getByText('ギャラリー')).toBeTruthy();
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
      expect(getByText('ギャラリー')).toBeTruthy();
    });

    fireEvent.press(getByText('ギャラリー'));

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
      expect(getByText('ギャラリー')).toBeTruthy();
    });

    fireEvent.press(getByText('ギャラリー'));

    await waitFor(() => {
      expect(getByTestId('gallery-list')).toBeTruthy();
    });

    expect(queryByText('Login Screen')).toBeNull();
  });
});
