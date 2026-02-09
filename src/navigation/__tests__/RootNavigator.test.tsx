import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

import { RootNavigator } from '../RootNavigator';

// Mock auth service before importing RootNavigator (it calls configureGoogleSignIn at module scope)
jest.mock('@services/auth', () => ({
  configureGoogleSignIn: jest.fn(),
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
