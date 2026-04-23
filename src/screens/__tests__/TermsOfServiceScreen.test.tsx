import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TermsOfServiceScreen } from '../TermsOfServiceScreen';
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
  TERMS_OF_SERVICE: {
    lastUpdated: '2026-04-04',
    sections: [
      { title: 'はじめに', body: 'テスト本文' },
      { title: '定義', body: 'テスト定義' },
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
  name: 'TermsOfService' as const,
  params: undefined,
};

describe('TermsOfServiceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the screen with testID', () => {
    const { getByTestId } = render(
      <TermsOfServiceScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'TermsOfService'>['route']}
      />
    );
    expect(getByTestId('terms-of-service-screen')).toBeTruthy();
  });

  it('displays "利用規約" in the header', () => {
    const { getByTestId } = render(
      <TermsOfServiceScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'TermsOfService'>['route']}
      />
    );
    expect(getByTestId('header-title')).toBeTruthy();
    expect(getByTestId('header-title').props.children).toBe('利用規約');
  });

  it('calls navigation.goBack when back button is pressed', () => {
    const { getByTestId } = render(
      <TermsOfServiceScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'TermsOfService'>['route']}
      />
    );
    fireEvent.press(getByTestId('header-back-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('displays lastUpdated date', () => {
    const { getByText } = render(
      <TermsOfServiceScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'TermsOfService'>['route']}
      />
    );
    expect(getByText(/2026-04-04/)).toBeTruthy();
  });

  it('displays section titles', () => {
    const { getByText } = render(
      <TermsOfServiceScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'TermsOfService'>['route']}
      />
    );
    expect(getByText('はじめに')).toBeTruthy();
    expect(getByText('定義')).toBeTruthy();
  });

  it('displays section bodies', () => {
    const { getByText } = render(
      <TermsOfServiceScreen
        navigation={mockNavigation as never}
        route={mockRoute as RootStackScreenProps<'TermsOfService'>['route']}
      />
    );
    expect(getByText('テスト本文')).toBeTruthy();
    expect(getByText('テスト定義')).toBeTruthy();
  });
});
