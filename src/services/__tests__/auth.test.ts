// [REVERT-TO-NATIVE] テスト全体をネイティブ Google Sign-In に戻す必要あり
// 詳細: docs/issues/issue-013-revert-to-native-google-signin.md

import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { signInWithGoogle, signOut } from '../auth';

const mockSignInWithOAuth = jest.fn();
const mockSetSession = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

describe('auth service (expo-auth-session)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signInWithGoogle', () => {
    it('returns success with user and session on successful sign-in', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token' };

      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?...' },
        error: null,
      });
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: 'com.goshuin.app://auth/callback#access_token=mock-access&refresh_token=mock-refresh',
      });
      mockSetSession.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: true,
        user: mockUser,
        session: mockSession,
      });
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: AuthSession.makeRedirectUri(),
          skipBrowserRedirect: true,
        },
      });
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/auth?...',
        AuthSession.makeRedirectUri()
      );
      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: 'mock-access',
        refresh_token: 'mock-refresh',
      });
    });

    it('returns CANCELLED error when user cancels browser', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?...' },
        error: null,
      });
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'CANCELLED', message: 'ログインがキャンセルされました' },
      });
    });

    it('returns SUPABASE_ERROR when OAuth URL retrieval fails', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: { message: 'OAuth config error' },
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'SUPABASE_ERROR', message: 'OAuth config error' },
      });
    });

    it('returns SUPABASE_ERROR when OAuth URL is missing without error', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: null,
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'SUPABASE_ERROR', message: 'OAuth URL取得失敗' },
      });
    });

    it('returns NO_ID_TOKEN when tokens are missing from redirect URL', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?...' },
        error: null,
      });
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: 'com.goshuin.app://auth/callback#no_tokens_here=true',
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'NO_ID_TOKEN', message: 'トークンの取得に失敗しました' },
      });
    });

    it('returns SUPABASE_ERROR when setSession fails', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?...' },
        error: null,
      });
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: 'com.goshuin.app://auth/callback#access_token=mock-access&refresh_token=mock-refresh',
      });
      mockSetSession.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Session error' },
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'SUPABASE_ERROR', message: 'Session error' },
      });
    });

    it('returns SUPABASE_ERROR when setSession returns no user/session', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?...' },
        error: null,
      });
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: 'com.goshuin.app://auth/callback#access_token=mock-access&refresh_token=mock-refresh',
      });
      mockSetSession.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'SUPABASE_ERROR', message: 'セッション設定失敗' },
      });
    });
  });

  describe('signOut', () => {
    it('returns success when sign-out succeeds', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const result = await signOut();

      expect(result).toEqual({ success: true });
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('returns error when Supabase sign-out fails', async () => {
      mockSignOut.mockResolvedValue({ error: { message: 'Sign out failed' } });

      const result = await signOut();

      expect(result).toEqual({
        success: false,
        error: { code: 'SIGN_OUT_ERROR', message: 'Sign out failed' },
      });
    });
  });
});
