import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import { AccountDeletionScreen } from '@screens/AccountDeletionScreen';

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

const mockDeleteAccount = jest.fn();
jest.mock('@services/account', () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

const mockSignOut = jest.fn();
jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    session: null,
    isLoading: false,
    isAuthenticated: true,
    isSigningIn: false,
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    signOut: mockSignOut,
  }),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(),
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

const mockRoute = { key: 'test', name: 'AccountDeletion' as const, params: undefined };

function renderScreen() {
  return render(<AccountDeletionScreen navigation={mockNavigation as never} route={mockRoute} />);
}

/** Alert.alert に渡された破壊的アクション（削除）を取り出して押す */
function pressDestructiveAlertButton(alertSpy: jest.SpyInstance) {
  const buttons = alertSpy.mock.calls[0][2] as {
    text: string;
    style?: string;
    onPress?: () => void;
  }[];
  const destructive = buttons.find(b => b.style === 'destructive');
  expect(destructive).toBeDefined();
  return act(async () => {
    destructive?.onPress?.();
  });
}

describe('AccountDeletionScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteAccount.mockResolvedValue({ success: true });
    mockSignOut.mockResolvedValue({ success: true });
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  // D-1
  it('消えるデータ4項目をすべて表示する', () => {
    const { getByText } = renderScreen();

    expect(getByText(/御朱印記録/)).toBeTruthy();
    expect(getByText(/御朱印帳/)).toBeTruthy();
    expect(getByText(/行きたいリスト/)).toBeTruthy();
    expect(getByText(/プロフィール/)).toBeTruthy();
  });

  // D-2
  it('元に戻せない旨の警告を表示する', () => {
    const { getByText } = renderScreen();

    expect(getByText(/元に戻せません/)).toBeTruthy();
  });

  // D-3
  it('実行ボタンを押すとアラートが出るだけで、まだ削除しない', () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('delete-account-button'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  // D-4
  it('アラートの削除を選んで初めて deleteAccount を呼ぶ', async () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('delete-account-button'));
    await pressDestructiveAlertButton(alertSpy);

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
  });

  // D-5
  it('アラートをキャンセルすると deleteAccount を呼ばない', () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('delete-account-button'));

    const buttons = alertSpy.mock.calls[0][2] as { text: string; style?: string }[];
    const cancel = buttons.find(b => b.style === 'cancel');
    expect(cancel).toBeDefined();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  // D-6
  it('削除中は二度押しても deleteAccount は1回しか呼ばれない', async () => {
    let resolveDelete: (v: { success: true }) => void = () => {};
    mockDeleteAccount.mockReturnValue(
      new Promise<{ success: true }>(resolve => {
        resolveDelete = resolve;
      })
    );

    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('delete-account-button'));
    await pressDestructiveAlertButton(alertSpy);

    // 実行中にもう一度押す
    fireEvent.press(getByTestId('delete-account-button'));

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDelete({ success: true });
    });
  });

  // D-7 / D-8
  it('失敗したらエラーを画面に出し、サインアウトしない', async () => {
    mockDeleteAccount.mockResolvedValue({
      success: false,
      error: { code: 'DELETE_ACCOUNT_FAILED', message: 'アカウントの削除に失敗しました: boom' },
    });

    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId('delete-account-button'));
    await pressDestructiveAlertButton(alertSpy);

    await waitFor(() => {
      expect(getByText(/アカウントの削除に失敗しました: boom/)).toBeTruthy();
    });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('失敗しても実行ボタンは押せる状態に戻る', async () => {
    mockDeleteAccount.mockResolvedValue({
      success: false,
      error: { code: 'DELETE_ACCOUNT_FAILED', message: 'boom' },
    });

    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('delete-account-button'));
    await pressDestructiveAlertButton(alertSpy);

    await waitFor(() => {
      expect(getByTestId('delete-account-button').props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  // D-9 / D-10
  it('成功したらサインアウトして地図へ戻る', async () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('delete-account-button'));
    await pressDestructiveAlertButton(alertSpy);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });
});
