import React from 'react';
import { Alert, Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { LoginPromptModal } from '../common/LoginPromptModal';

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

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('LoginPromptModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onLoginSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with login prompt text', () => {
    const { getByText } = render(<LoginPromptModal {...defaultProps} />);
    expect(getByText('ログインが必要です')).toBeTruthy();
    expect(getByText('御朱印を記録するにはログインしてください')).toBeTruthy();
  });

  it('renders Google login button', () => {
    const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
    expect(getByTestId('modal-google-login-button')).toBeTruthy();
  });

  it('renders later button', () => {
    const { getByText } = render(<LoginPromptModal {...defaultProps} />);
    expect(getByText('あとにする')).toBeTruthy();
  });

  it('calls onClose when later button is pressed', () => {
    const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
    fireEvent.press(getByTestId('modal-later-button'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls signInWithGoogle on Google button press and onLoginSuccess on success', async () => {
    mockSignInWithGoogle.mockResolvedValue({ success: true });

    const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
    fireEvent.press(getByTestId('modal-google-login-button'));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
      expect(defaultProps.onLoginSuccess).toHaveBeenCalled();
    });
  });

  it('does not call onLoginSuccess on cancelled sign-in', async () => {
    mockSignInWithGoogle.mockResolvedValue({
      success: false,
      error: { code: 'CANCELLED', message: 'cancelled' },
    });

    const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
    fireEvent.press(getByTestId('modal-google-login-button'));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
    expect(defaultProps.onLoginSuccess).not.toHaveBeenCalled();
  });

  it('does not render when visible is false', () => {
    const { queryByText } = render(<LoginPromptModal {...defaultProps} visible={false} />);
    expect(queryByText('ログインが必要です')).toBeNull();
  });

  // Guideline 4.8: 第三者ログインを出す導線には、同等の選択肢（Sign in with Apple）を
  // 必ず併置する。build 13 はこのモーダルが Google のみだったため却下された。
  // 審査員の経路は「オンボーディング → 地図（未ログイン） → FAB → このモーダル」で、
  // LoginScreen に到達しないまま判定される
  describe('Apple ログインボタン（Guideline 4.8）', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    });

    const setOS = (os: string) => {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    };

    it('iOS では Apple ログインボタンが表示される', () => {
      setOS('ios');
      const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
      expect(getByTestId('modal-apple-login-button')).toBeTruthy();
    });

    it('Android では Apple ログインボタンが表示されない', () => {
      setOS('android');
      const { queryByTestId } = render(<LoginPromptModal {...defaultProps} />);
      expect(queryByTestId('modal-apple-login-button')).toBeNull();
    });

    it('Apple ボタンタップで signInWithApple が呼ばれ、成功時に onLoginSuccess が呼ばれる', async () => {
      setOS('ios');
      mockSignInWithApple.mockResolvedValue({ success: true });

      const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
      fireEvent.press(getByTestId('modal-apple-login-button'));

      await waitFor(() => {
        expect(mockSignInWithApple).toHaveBeenCalled();
        expect(defaultProps.onLoginSuccess).toHaveBeenCalled();
      });
    });

    it('キャンセル時は Alert を出さず onLoginSuccess も呼ばない', async () => {
      setOS('ios');
      mockSignInWithApple.mockResolvedValue({
        success: false,
        error: { code: 'CANCELLED', message: 'cancelled' },
      });

      const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
      fireEvent.press(getByTestId('modal-apple-login-button'));

      await waitFor(() => {
        expect(mockSignInWithApple).toHaveBeenCalled();
      });
      expect(defaultProps.onLoginSuccess).not.toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('キャンセル以外のエラーでは Alert を出す', async () => {
      setOS('ios');
      mockSignInWithApple.mockResolvedValue({
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: 'Apple ログインエラー' },
      });

      const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
      fireEvent.press(getByTestId('modal-apple-login-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('ログインエラー', 'Apple ログインエラー');
      });
    });

    // 4.8 は「同等の選択肢」を求めている。Apple を Google より下や折りたたみに
    // 置くと同等に見えないため、並び順もテストで固定する
    it('Apple ボタンが Google ボタンより上にある', () => {
      setOS('ios');
      const { toJSON } = render(<LoginPromptModal {...defaultProps} />);

      // レンダリング結果の JSON は描画順を保つので、出現位置で上下を判定する
      const tree = JSON.stringify(toJSON());
      const appleAt = tree.indexOf('modal-apple-login-button');
      const googleAt = tree.indexOf('modal-google-login-button');

      expect(appleAt).toBeGreaterThan(-1);
      expect(googleAt).toBeGreaterThan(-1);
      expect(appleAt).toBeLessThan(googleAt);
    });
  });
});
