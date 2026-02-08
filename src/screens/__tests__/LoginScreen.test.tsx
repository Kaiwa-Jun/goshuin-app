import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LoginScreen } from '@screens/LoginScreen';

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

const mockRoute = { key: 'test', name: 'Login' as const, params: undefined };

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('login-screen')).toBeTruthy();
  });

  it('displays app name', () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('御朱印コレクション')).toBeTruthy();
  });

  it('displays tagline', () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('集めるたび、地図があなたの旅になる。')).toBeTruthy();
  });

  it('displays Google login button', () => {
    const { getByTestId, getByText } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('google-login-button')).toBeTruthy();
    expect(getByText('Google でログイン')).toBeTruthy();
  });

  it('displays later button', () => {
    const { getByTestId, getByText } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('later-button')).toBeTruthy();
    expect(getByText('あとにする')).toBeTruthy();
  });

  it('navigates back when later is pressed', () => {
    const { getByTestId } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByTestId('later-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('displays login prompt text', () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('旅の記録を保存しましょう')).toBeTruthy();
  });
});
