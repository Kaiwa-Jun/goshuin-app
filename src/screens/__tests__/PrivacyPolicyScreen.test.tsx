import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PrivacyPolicyScreen } from '../PrivacyPolicyScreen';
import type { RootStackScreenProps } from '@/navigation/types';

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

jest.mock('@/constants/legal', () => ({
  PRIVACY_POLICY: {
    lastUpdated: '2026-04-04',
    sections: [
      { title: 'はじめに', body: 'プライバシーテスト本文' },
      { title: '収集する情報', body: 'テスト収集情報' },
    ],
  },
}));

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

const mockRoute = {
  key: 'test',
  name: 'PrivacyPolicy' as const,
  params: undefined,
};

describe('PrivacyPolicyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the screen with testID', () => {
    const { getByTestId } = render(
      <PrivacyPolicyScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'PrivacyPolicy'>['route']}
      />
    );
    expect(getByTestId('privacy-policy-screen')).toBeTruthy();
  });

  it('displays "プライバシーポリシー" in the header', () => {
    const { getByTestId } = render(
      <PrivacyPolicyScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'PrivacyPolicy'>['route']}
      />
    );
    expect(getByTestId('header-title')).toBeTruthy();
    expect(getByTestId('header-title').props.children).toBe('プライバシーポリシー');
  });

  it('calls navigation.goBack when back button is pressed', () => {
    const { getByTestId } = render(
      <PrivacyPolicyScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'PrivacyPolicy'>['route']}
      />
    );
    fireEvent.press(getByTestId('header-back-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('displays lastUpdated date', () => {
    const { getByText } = render(
      <PrivacyPolicyScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'PrivacyPolicy'>['route']}
      />
    );
    expect(getByText(/2026-04-04/)).toBeTruthy();
  });

  it('displays section titles', () => {
    const { getByText } = render(
      <PrivacyPolicyScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'PrivacyPolicy'>['route']}
      />
    );
    expect(getByText('はじめに')).toBeTruthy();
    expect(getByText('収集する情報')).toBeTruthy();
  });

  it('displays section bodies', () => {
    const { getByText } = render(
      <PrivacyPolicyScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'PrivacyPolicy'>['route']}
      />
    );
    expect(getByText('プライバシーテスト本文')).toBeTruthy();
    expect(getByText('テスト収集情報')).toBeTruthy();
  });
});
