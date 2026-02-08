import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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
});
