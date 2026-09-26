import { readFileSync } from 'fs';
import { join } from 'path';
import { act, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';

import { RootNavigator } from '../RootNavigator';
import type { RootStackParamList } from '@/navigation/types';

// Mock supabase client to avoid env var requirement
jest.mock('@services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({ select: jest.fn() })),
  },
}));

// Mock auth service
jest.mock('@services/auth', () => ({
  configureGoogleSignIn: jest.fn(),
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
}));

// 自動再生の判定は useAnnualReportAutoPlay のテストで見る。12月に CI が走っても
// ナビゲーションのテストが Supabase へ出て揺れないように止めておく（Issue #274）
const mockAutoPlay = jest.fn();
jest.mock('@hooks/useAnnualReportAutoPlay', () => ({
  useAnnualReportAutoPlay: (...args: unknown[]) => mockAutoPlay(...args),
}));

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

jest.mock('@hooks/useWishlist', () => ({
  useWishlist: () => ({
    wishlistSpotIds: new Set(),
    toggleWishlist: jest.fn(),
    isLoading: false,
    isToggling: false,
  }),
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
  uploadStampImage: jest.fn(),
  createStamp: jest.fn(),
}));

jest.mock('@services/spots', () => ({
  fetchSpotsByBounds: jest.fn().mockResolvedValue([]),
  fetchSpotById: jest.fn().mockResolvedValue(null),
  searchSpotsByName: jest.fn().mockResolvedValue([]),
}));

jest.mock('@hooks/useNearbySpots', () => ({
  useNearbySpots: () => ({
    nearbySpots: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    setSearchQuery: jest.fn(),
    filteredSpots: [],
  }),
}));

jest.mock('@hooks/useRecordForm', () => ({
  useRecordForm: () => ({
    selectedSpot: null,
    imageUri: null,
    visitedAt: new Date(),
    memo: '',
    spotError: null,
    imageError: null,
    isSubmitting: false,
    submitError: null,
    selectSpot: jest.fn(),
    setImageUri: jest.fn(),
    setVisitedAt: jest.fn(),
    setMemo: jest.fn(),
    validate: jest.fn(),
    submit: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

const navigationRef = createNavigationContainerRef<RootStackParamList>();

function renderWithNavigation() {
  return render(
    <NavigationContainer ref={navigationRef}>
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

  /*
   * 一度終えた人にも Onboarding を**登録したまま**にしておく。
   * 以前は条件付きに登録していて、開発用の「もう一度見る」から navigate
   * すると「そんな画面は無い」で落ちた
   */
  it('終えたあとでも、Onboarding へ行ける', async () => {
    mockUseOnboarding.mockReturnValue({
      isCompleted: true,
      isLoading: false,
      completeOnboarding: jest.fn(),
      resetOnboarding: jest.fn(),
    });

    const { getByTestId } = renderWithNavigation();
    await waitFor(() => expect(getByTestId('map-screen')).toBeTruthy());

    act(() => {
      navigationRef.navigate('Onboarding');
    });

    await waitFor(() => expect(getByTestId('onboarding-screen')).toBeTruthy());
  });

  it('AC-49（#270）: プラスの画面が登録されている', async () => {
    mockUseOnboarding.mockReturnValue({
      isCompleted: true,
      isLoading: false,
      completeOnboarding: jest.fn(),
      resetOnboarding: jest.fn(),
    });

    const { getByTestId, getByText } = renderWithNavigation();
    await waitFor(() => expect(getByTestId('map-screen')).toBeTruthy());

    act(() => {
      navigationRef.navigate('Plus');
    });

    await waitFor(() => expect(getByText('予定を、先までいくつでも')).toBeTruthy());
  });

  it('AC-26（#274）: 年報の画面が登録されている', async () => {
    mockUseOnboarding.mockReturnValue({
      isCompleted: true,
      isLoading: false,
      completeOnboarding: jest.fn(),
      resetOnboarding: jest.fn(),
    });

    const { getByTestId, getByText } = renderWithNavigation();
    await waitFor(() => expect(getByTestId('map-screen')).toBeTruthy());

    act(() => {
      navigationRef.navigate('AnnualReport', { year: 2026, sample: 'full' });
    });

    await waitFor(() => expect(getByTestId('annual-report')).toBeTruthy());
    expect(getByText('2026年のふりかえり')).toBeTruthy();
  });

  it('AC-58（#274）: スプラッシュが消えるまでは自動再生の判定を止めておく', async () => {
    mockUseOnboarding.mockReturnValue({
      isCompleted: true,
      isLoading: false,
      completeOnboarding: jest.fn(),
      resetOnboarding: jest.fn(),
    });

    const ui = render(
      <NavigationContainer ref={navigationRef}>
        <RootNavigator splashDone={false} />
      </NavigationContainer>
    );
    await waitFor(() => expect(ui.getByTestId('map-screen')).toBeTruthy());
    expect(mockAutoPlay).toHaveBeenLastCalledWith({ ready: false });

    ui.rerender(
      <NavigationContainer ref={navigationRef}>
        <RootNavigator splashDone />
      </NavigationContainer>
    );
    await waitFor(() => expect(mockAutoPlay).toHaveBeenLastCalledWith({ ready: true }));
  });

  it('AC-58（#274）: splashDone を省略すると判定してよい（既存の呼び出しを変えない）', async () => {
    mockUseOnboarding.mockReturnValue({
      isCompleted: true,
      isLoading: false,
      completeOnboarding: jest.fn(),
      resetOnboarding: jest.fn(),
    });

    const { getByTestId } = renderWithNavigation();
    await waitFor(() => expect(getByTestId('map-screen')).toBeTruthy());
    expect(mockAutoPlay).toHaveBeenLastCalledWith({ ready: true });
  });

  it('AC-58（#274）: App はスプラッシュが消えたかを RootNavigator に渡す', () => {
    const app = readFileSync(join(__dirname, '../../../App.tsx'), 'utf8');
    expect(app).toContain('<RootNavigator splashDone={splashComplete} />');
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
