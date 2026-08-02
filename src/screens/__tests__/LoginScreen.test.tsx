import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
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

const mockSignInWithGoogle = jest.fn();
const mockSignInWithApple = jest.fn();

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
    isSigningIn: false,
    signInWithGoogle: mockSignInWithGoogle,
    signInWithApple: mockSignInWithApple,
    signOut: jest.fn(),
  }),
}));

jest.spyOn(Alert, 'alert');

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
    expect(getByText('御朱印マップ')).toBeTruthy();
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

  it('calls signInWithGoogle and navigates back on success', async () => {
    mockSignInWithGoogle.mockResolvedValue({ success: true });

    const { getByTestId } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );

    fireEvent.press(getByTestId('google-login-button'));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('shows Alert on non-CANCELLED error', async () => {
    mockSignInWithGoogle.mockResolvedValue({
      success: false,
      error: { code: 'SUPABASE_ERROR', message: 'auth failed' },
    });

    const { getByTestId } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );

    fireEvent.press(getByTestId('google-login-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('ログインエラー', 'auth failed');
    });
  });

  it('navigates to TermsOfService when terms link is pressed', () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByText(' 利用規約 '));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('TermsOfService');
  });

  it('navigates to PrivacyPolicy when privacy policy link is pressed', () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByText(' プライバシーポリシー '));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('PrivacyPolicy');
  });

  it('does not show Alert when user cancels', async () => {
    mockSignInWithGoogle.mockResolvedValue({
      success: false,
      error: { code: 'CANCELLED', message: 'cancelled' },
    });

    const { getByTestId } = render(
      <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
    );

    fireEvent.press(getByTestId('google-login-button'));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  describe('Apple ログインボタン', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { get: () => originalOS, configurable: true });
    });

    it('iOS では Apple ログインボタンが表示される', () => {
      Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      expect(getByTestId('apple-login-button')).toBeTruthy();
    });

    it('Android では Apple ログインボタンが表示されない', () => {
      Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });

      const { queryByTestId } = render(
        <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      expect(queryByTestId('apple-login-button')).toBeNull();
    });

    it('Apple ボタンタップで signInWithApple が呼ばれ、成功時に goBack する', async () => {
      Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });

      mockSignInWithApple.mockResolvedValue({
        success: true,
        user: { id: 'user-1', email: 'test@example.com' },
        session: {},
      });

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('apple-login-button'));

      await waitFor(() => {
        expect(mockSignInWithApple).toHaveBeenCalled();
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });

    it('Apple ボタンタップでエラー時（CANCELLED 以外）に Alert が表示される', async () => {
      Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });

      mockSignInWithApple.mockResolvedValue({
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: 'Apple ログインエラー' },
      });

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation as never} route={mockRoute} />
      );

      fireEvent.press(getByTestId('apple-login-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('ログインエラー', 'Apple ログインエラー');
      });
    });
  });
});
