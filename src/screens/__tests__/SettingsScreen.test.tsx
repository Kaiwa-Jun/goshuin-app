import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, DevSettings, Linking, Platform, StyleSheet } from 'react-native';

import { SettingsScreen } from '../SettingsScreen';
import type { MainTabScreenProps } from '@/navigation/types';

// 年報の開発用の行（Issue #274）が @services/annualReport を読む。Supabase には出ない
jest.mock('@services/supabase', () => ({
  supabase: { from: jest.fn() },
}));

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

let mockLocationStatus: string | Error = 'granted';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => {
    if (mockLocationStatus instanceof Error) throw mockLocationStatus;
    return { status: mockLocationStatus };
  }),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

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

    // Issue #134 / E 群: アカウント削除の導線（App Store Guideline 5.1.1(v)）
    it('アカウント削除の行が表示される', () => {
      const { getByTestId, getByText } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(getByTestId('delete-account-row')).toBeTruthy();
      expect(getByText('アカウントを削除')).toBeTruthy();
    });

    it('アカウント削除の行をタップすると AccountDeletion へ遷移する', () => {
      const parentNavigate = jest.fn();
      const nav = {
        ...mockNavigation,
        getParent: jest.fn(() => ({ navigate: parentNavigate })),
      } as unknown as MainTabScreenProps<'Settings'>['navigation'];

      const { getByTestId } = render(<SettingsScreen navigation={nav} route={mockRoute} />);
      fireEvent.press(getByTestId('delete-account-row'));

      expect(parentNavigate).toHaveBeenCalledWith('AccountDeletion');
    });
  });

  describe('アカウント削除の導線（Issue #134）', () => {
    it('未ログイン時は表示されない', () => {
      mockUseAuthReturn = { ...mockUseAuthReturn, isAuthenticated: false, user: null };

      const { queryByTestId, queryByText } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );

      expect(queryByTestId('delete-account-row')).toBeNull();
      expect(queryByText('アカウントを削除')).toBeNull();
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

describe('SettingsScreen 位置情報の行（Issue #123 / 監査 A-14）', () => {
  beforeEach(() => {
    mockLocationStatus = 'granted';
  });

  it('位置情報の行が表示される', async () => {
    const { getByTestId } = render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByTestId('location-settings-row')).toBeTruthy();
    });
  });

  it('タップすると OS の設定アプリを開く', async () => {
    const openSettingsSpy = jest
      .spyOn(Linking, 'openSettings')
      .mockImplementation(() => Promise.resolve());

    const { getByTestId } = render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByTestId('location-settings-row')).toBeTruthy();
    });

    fireEvent.press(getByTestId('location-settings-row'));

    expect(openSettingsSpy).toHaveBeenCalled();
    openSettingsSpy.mockRestore();
  });

  it('許可されているとき「許可済み」と出る', async () => {
    mockLocationStatus = 'granted';

    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(getByText('許可済み')).toBeTruthy();
    });
  });

  it('拒否されているとき「未許可」と出る', async () => {
    mockLocationStatus = 'denied';

    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(getByText('未許可')).toBeTruthy();
    });
  });

  it('権限の取得に失敗しても落ちず、行自体は出る', async () => {
    mockLocationStatus = new Error('boom');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { getByTestId, queryByText } = render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByTestId('location-settings-row')).toBeTruthy();
    });
    expect(queryByText('許可済み')).toBeNull();
    expect(queryByText('未許可')).toBeNull();

    warnSpy.mockRestore();
  });

  // Guideline 1.2: 公開機能そのものを v1.0 から外す（Issue #147）
  describe('公開設定セクションの削除（Guideline 1.2）', () => {
    it('公開設定セクションが表示されないこと', () => {
      const { queryByText, queryByTestId } = render(
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      );
      expect(queryByText('公開設定')).toBeNull();
      expect(queryByText(/御朱印のデフォルト公開設定/)).toBeNull();
      expect(queryByTestId('default-public-toggle')).toBeNull();
    });
  });
});

describe('セクションの余白', () => {
  const setup = () => render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
  const SECTIONS = [
    'settings-section-account',
    'settings-section-location',
    'settings-section-app-info',
  ];

  it('見出しは、前のセクションよりも自分の中身に近い', () => {
    // 逆だと、見出しがどちらの塊のものか読み取れない
    const r = setup();
    const withinSection = StyleSheet.flatten(r.getByTestId(SECTIONS[0]).props.style) as {
      gap?: number;
    };
    const betweenSections = StyleSheet.flatten(
      r.getByTestId('settings-scroll').props.contentContainerStyle
    ) as { gap?: number };

    expect(withinSection.gap).toBeDefined();
    expect(betweenSections.gap).toBeDefined();
    expect(withinSection.gap!).toBeLessThan(betweenSections.gap!);
  });

  it('見出しと中身がすべて同じ入れ物に入っている', () => {
    // 個別の margin で組むと、今回のように1箇所だけ付け忘れる
    const r = setup();

    for (const id of SECTIONS) expect(r.getByTestId(id)).toBeTruthy();
  });

  it('セクションの余白を個別の margin で持たない', () => {
    const r = setup();

    for (const id of SECTIONS) {
      const style = StyleSheet.flatten(r.getByTestId(id).props.style) as Record<string, unknown>;
      expect(style.marginBottom).toBeUndefined();
    }
  });
});

/* Issue #274 AC-60〜63: 開発用の年報の3行（Web は2行）。Jest の __DEV__ は true */
describe('開発用 — 年報', () => {
  const originalOS = Platform.OS;
  const parentNavigate = jest.fn();
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setParams: jest.fn(),
    getParent: jest.fn(() => ({ navigate: parentNavigate })),
  } as unknown as MainTabScreenProps<'Settings'>['navigation'];

  const login = () => {
    mockUseAuthReturn = {
      ...mockUseAuthReturn,
      user: { id: 'u1', email: 'a@example.com', user_metadata: {} },
      isAuthenticated: true,
    };
  };
  const guest = () => {
    mockUseAuthReturn = { ...mockUseAuthReturn, user: null, isAuthenticated: false };
  };
  const renderScreen = () => render(<SettingsScreen navigation={navigation} route={mockRoute} />);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-09-27T10:00:00+09:00') });
    jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});
    guest();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(Platform, 'OS', { get: () => originalOS, configurable: true });
  });

  it('AC-60: 「オンボーディングをもう一度見る」の後に、3行がこの順で', () => {
    const ui = renderScreen();
    const ids = ui
      .getAllByTestId(/^(replay-onboarding-row|dev-annual-.*-row)$/)
      .map(el => el.props.testID);
    expect(ids).toEqual([
      'replay-onboarding-row',
      'dev-annual-report-row',
      'dev-annual-report-few-row',
      'dev-annual-autoplay-row',
    ]);
    expect(ui.getByText('年報を見る')).toBeTruthy();
    expect(ui.getByText('年報の見本を見る（記録が2枚）')).toBeTruthy();
    expect(ui.getByText('12月として自動再生を試す')).toBeTruthy();
  });

  it('AC-60: Web では「12月として自動再生を試す」を出さない', () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'web', configurable: true });
    const ui = renderScreen();
    expect(ui.getByTestId('dev-annual-report-row')).toBeTruthy();
    expect(ui.getByTestId('dev-annual-report-few-row')).toBeTruthy();
    expect(ui.queryByTestId('dev-annual-autoplay-row')).toBeNull();
  });

  it('AC-61: ゲストで「年報を見る」は見本 full', () => {
    const ui = renderScreen();
    fireEvent.press(ui.getByTestId('dev-annual-report-row'));
    expect(parentNavigate).toHaveBeenCalledWith('AnnualReport', { year: 2026, sample: 'full' });
  });

  it('AC-61: ログイン済みで「年報を見る」は自分の記録（今の年）', () => {
    login();
    const ui = renderScreen();
    fireEvent.press(ui.getByTestId('dev-annual-report-row'));
    expect(parentNavigate).toHaveBeenCalledWith('AnnualReport', { year: 2026 });
  });

  it('AC-61: 「年報の見本を見る（記録が2枚）」は見本 few', () => {
    login();
    const ui = renderScreen();
    fireEvent.press(ui.getByTestId('dev-annual-report-few-row'));
    expect(parentNavigate).toHaveBeenCalledWith('AnnualReport', { year: 2026, sample: 'few' });
  });

  it('AC-62: ログイン済みで「12月として自動再生を試す」は、印を消し・キーを書き・読み込み直す', async () => {
    login();
    const ui = renderScreen();
    fireEvent.press(ui.getByTestId('dev-annual-autoplay-row'));

    await waitFor(() => expect(DevSettings.reload).toHaveBeenCalledTimes(1));
    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('annual_report_autoplayed:2026:u1');
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('annual_report_dev_as_december', '1');
    const removed = jest.mocked(AsyncStorage.removeItem).mock.invocationCallOrder[0];
    const written = jest.mocked(AsyncStorage.setItem).mock.invocationCallOrder[0];
    const reloaded = jest.mocked(DevSettings.reload).mock.invocationCallOrder[0];
    expect(removed).toBeLessThan(written);
    expect(written).toBeLessThan(reloaded);
  });

  it('AC-63: ゲストで「12月として自動再生を試す」は案内だけ', async () => {
    const ui = renderScreen();
    fireEvent.press(ui.getByTestId('dev-annual-autoplay-row'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('ログインしてから試してください'));
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(DevSettings.reload).not.toHaveBeenCalled();
  });

  it('行の見た目は「オンボーディングをもう一度見る」と同じ', () => {
    const ui = renderScreen();
    const base = StyleSheet.flatten(ui.getByTestId('replay-onboarding-row').props.style);
    for (const id of [
      'dev-annual-report-row',
      'dev-annual-report-few-row',
      'dev-annual-autoplay-row',
    ]) {
      expect(StyleSheet.flatten(ui.getByTestId(id).props.style)).toEqual(base);
    }
  });
});
