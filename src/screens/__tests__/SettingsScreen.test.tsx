import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { SettingsScreen } from '../SettingsScreen';
import type { MainTabScreenProps } from '@/navigation/types';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const RN = require('react-native');
  return {
    SafeAreaView: RN.View,
    SafeAreaProvider: RN.View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockSignOut = jest.fn();
const mockSignInWithGoogle = jest.fn();

let mockUseAuthReturn: Record<string, unknown> = {
  user: null,
  session: null,
  isLoading: false,
  isAuthenticated: false,
  isSigningIn: false,
  signInWithGoogle: mockSignInWithGoogle,
  signOut: mockSignOut,
};

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockUseAuthReturn,
}));

jest.spyOn(Alert, 'alert');

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
} as unknown as MainTabScreenProps<'Settings'>['navigation'];

const mockRoute = {
  key: 'test',
  name: 'Settings' as const,
  params: undefined,
} as unknown as MainTabScreenProps<'Settings'>['route'];

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthReturn = {
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      isSigningIn: false,
      signInWithGoogle: mockSignInWithGoogle,
      signOut: mockSignOut,
    };
  });

  it('renders the header', () => {
    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('設定')).toBeTruthy();
  });

  it('renders account section', () => {
    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('アカウント')).toBeTruthy();
  });

  describe('when not authenticated', () => {
    it('shows guest name and email', () => {
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByText('ゲスト')).toBeTruthy();
      expect(getByText('未設定')).toBeTruthy();
    });

    it('shows login button instead of logout', () => {
      const { getByText, queryByText } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByText('ログイン')).toBeTruthy();
      expect(queryByText('ログアウト')).toBeNull();
    });

    it('navigates to Login screen when login button is pressed', () => {
      const parentNavigate = jest.fn();
      const nav = {
        ...mockNavigation,
        getParent: jest.fn(() => ({ navigate: parentNavigate })),
      } as unknown as MainTabScreenProps<'Settings'>['navigation'];

      const { getByText } = render(<SettingsScreen navigation={nav} route={mockRoute} />);
      fireEvent.press(getByText('ログイン'));
      expect(parentNavigate).toHaveBeenCalledWith('Login');
    });
  });

  describe('when authenticated', () => {
    beforeEach(() => {
      mockUseAuthReturn = {
        ...mockUseAuthReturn,
        isAuthenticated: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { full_name: 'テストユーザー' },
        },
      };
    });

    it('shows user name and email', () => {
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByText('テストユーザー')).toBeTruthy();
      expect(getByText('test@example.com')).toBeTruthy();
    });

    it('shows logout button', () => {
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByText('ログアウト')).toBeTruthy();
    });

    it('calls signOut when logout button is pressed', async () => {
      mockSignOut.mockResolvedValue({ success: true });

      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      fireEvent.press(getByText('ログアウト'));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });

    it('shows Alert when signOut fails', async () => {
      mockSignOut.mockResolvedValue({
        success: false,
        error: { code: 'SIGN_OUT_ERROR', message: 'Failed' },
      });

      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      fireEvent.press(getByText('ログアウト'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('エラー', 'Failed');
      });
    });
  });

  it('renders plan section', () => {
    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('プラン')).toBeTruthy();
    expect(getByText('無料プラン')).toBeTruthy();
    expect(getByText('プレミアムプランにアップグレード')).toBeTruthy();
    expect(getByText('詳しく見る')).toBeTruthy();
  });

  it('renders app info section', () => {
    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('アプリ情報')).toBeTruthy();
    expect(getByText('バージョン')).toBeTruthy();
    expect(getByText('1.0.0')).toBeTruthy();
    expect(getByText('利用規約')).toBeTruthy();
    expect(getByText('プライバシーポリシー')).toBeTruthy();
  });
});
