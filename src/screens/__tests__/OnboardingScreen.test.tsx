import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { OnboardingScreen } from '@screens/OnboardingScreen';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
      React.createElement(View, props, children),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

const mockCompleteOnboarding = jest.fn();
jest.mock('@hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    isCompleted: false,
    isLoading: false,
    completeOnboarding: mockCompleteOnboarding,
  }),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', granted: true, canAskAgain: true, expires: 'never' })
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const Location = require('expo-location') as {
  requestForegroundPermissionsAsync: jest.Mock;
};

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
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

const mockRoute = { key: 'test', name: 'Onboarding' as const, params: undefined };

/** FlatList の onViewableItemsChanged を手動発火して最終スライドに移動 */
function goToLastSlide(getByTestId: ReturnType<typeof render>['getByTestId']) {
  const flatList = getByTestId('onboarding-flatlist');
  act(() => {
    flatList.props.onViewableItemsChanged({
      viewableItems: [{ index: 3, isViewable: true, item: {}, key: '3' }],
      changed: [],
    });
  });
}

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('onboarding-screen')).toBeTruthy();
  });

  it('displays skip button', () => {
    const { getByTestId, getByText } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('skip-button')).toBeTruthy();
    expect(getByText('スキップ')).toBeTruthy();
  });

  it('displays page indicator', () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('page-indicator')).toBeTruthy();
  });

  it('displays "次へ" button on first slide', () => {
    const { getByText } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('次へ')).toBeTruthy();
  });

  it('navigates to MainTabs when skip is pressed', () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByTestId('skip-button'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });

  it('renders onboarding slides', () => {
    const { getAllByTestId } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    const slides = getAllByTestId('onboarding-slide');
    expect(slides.length).toBeGreaterThanOrEqual(1);
  });

  it('renders onboarding icons', () => {
    const { getAllByTestId } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    const icons = getAllByTestId('onboarding-icon');
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls completeOnboarding when skip is pressed', () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByTestId('skip-button'));
    expect(mockCompleteOnboarding).toHaveBeenCalled();
  });

  it('requests location permission when "位置情報を許可して始める" is pressed on last slide', async () => {
    const { getByTestId, getByText } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    goToLastSlide(getByTestId);

    await act(async () => {
      fireEvent.press(getByText('位置情報を許可して始める'));
    });

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  it('calls completeOnboarding and navigates when "位置情報を許可して始める" is pressed', async () => {
    const { getByTestId, getByText } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    goToLastSlide(getByTestId);

    await act(async () => {
      fireEvent.press(getByText('位置情報を許可して始める'));
    });

    expect(mockCompleteOnboarding).toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });

  it('calls completeOnboarding even when location permission is denied', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
      granted: false,
      canAskAgain: true,
      expires: 'never',
    });

    const { getByTestId, getByText } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    goToLastSlide(getByTestId);

    await act(async () => {
      fireEvent.press(getByText('位置情報を許可して始める'));
    });

    expect(mockCompleteOnboarding).toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });

  it('calls completeOnboarding even when requestForegroundPermissionsAsync throws', async () => {
    Location.requestForegroundPermissionsAsync.mockRejectedValueOnce(new Error('Permission error'));

    const { getByTestId, getByText } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    goToLastSlide(getByTestId);

    await act(async () => {
      fireEvent.press(getByText('位置情報を許可して始める'));
    });

    expect(mockCompleteOnboarding).toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });

  it('calls completeOnboarding without location request when "あとで設定する" is pressed', async () => {
    const { getByTestId, getByText } = render(
      <OnboardingScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    goToLastSlide(getByTestId);

    fireEvent.press(getByText('あとで設定する'));

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockCompleteOnboarding).toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });
});
