import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { SettingsScreen } from '../SettingsScreen';
import type { MainTabScreenProps } from '@/navigation/types';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '0.1.0' },
  },
}));

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
const mockSignInWithApple = jest.fn();
const mockUpdateDefaultPublic = jest.fn();

jest.mock('@hooks/useDefaultPublicSetting', () => ({
  useDefaultPublicSetting: () => ({
    defaultPublic: false,
    isLoading: false,
    updateDefaultPublic: mockUpdateDefaultPublic,
  }),
}));

let mockUseAuthReturn: Record<string, unknown> = {
  user: null,
  session: null,
  isLoading: false,
  isAuthenticated: false,
  isSigningIn: false,
  signInWithGoogle: mockSignInWithGoogle,
  signInWithApple: mockSignInWithApple,
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
      signInWithApple: mockSignInWithApple,
      signOut: mockSignOut,
    };
  });

  it('renders the header', () => {
    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('自分')).toBeTruthy();
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

  describe('公開設定セクション', () => {
    it('ログイン時に公開設定セクションが表示されること', () => {
      mockUseAuthReturn = {
        ...mockUseAuthReturn,
        isAuthenticated: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { full_name: 'テストユーザー' },
        },
      };

      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByText('公開設定')).toBeTruthy();
      expect(getByText('御朱印のデフォルト公開設定')).toBeTruthy();
      expect(getByText('新しく記録する御朱印を自動的に公開します')).toBeTruthy();
    });

    it('未ログイン時は公開設定セクションが非表示であること', () => {
      const { queryByText } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(queryByText('公開設定')).toBeNull();
    });

    it('トグル操作で updateDefaultPublic が呼ばれること', () => {
      mockUseAuthReturn = {
        ...mockUseAuthReturn,
        isAuthenticated: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { full_name: 'テストユーザー' },
        },
      };

      const { getByTestId } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      fireEvent(getByTestId('default-public-toggle'), 'valueChange', true);
      expect(mockUpdateDefaultPublic).toHaveBeenCalledWith(true);
    });
  });

  it('renders app info section', () => {
    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('アプリ情報')).toBeTruthy();
    expect(getByText('バージョン')).toBeTruthy();
    expect(getByText('0.1.0')).toBeTruthy();
    expect(getByText('利用規約')).toBeTruthy();
    expect(getByText('プライバシーポリシー')).toBeTruthy();
  });

  it('バージョンが不明な場合に "不明" を表示する', () => {
    const Constants = jest.requireMock('expo-constants').default;
    const original = Constants.expoConfig;
    Constants.expoConfig = null;

    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('不明')).toBeTruthy();

    Constants.expoConfig = original;
  });

  it('navigates to TermsOfService when 利用規約 is pressed', () => {
    const parentNavigate = jest.fn();
    const nav = {
      ...mockNavigation,
      getParent: jest.fn(() => ({ navigate: parentNavigate })),
    } as unknown as MainTabScreenProps<'Settings'>['navigation'];

    const { getByText } = render(<SettingsScreen navigation={nav} route={mockRoute} />);
    fireEvent.press(getByText('利用規約'));
    expect(parentNavigate).toHaveBeenCalledWith('TermsOfService');
  });

  it('navigates to PrivacyPolicy when プライバシーポリシー is pressed', () => {
    const parentNavigate = jest.fn();
    const nav = {
      ...mockNavigation,
      getParent: jest.fn(() => ({ navigate: parentNavigate })),
    } as unknown as MainTabScreenProps<'Settings'>['navigation'];

    const { getByText } = render(<SettingsScreen navigation={nav} route={mockRoute} />);
    fireEvent.press(getByText('プライバシーポリシー'));
    expect(parentNavigate).toHaveBeenCalledWith('PrivacyPolicy');
  });
});
