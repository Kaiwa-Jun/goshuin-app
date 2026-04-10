import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { configureGoogleSignIn, signInWithGoogle, signInWithApple, signOut } from '../auth';

const mockSignInWithIdToken = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: (...args: unknown[]) => mockSignInWithIdToken(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

describe('auth service (native google-signin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('configureGoogleSignIn', () => {
    it('calls GoogleSignin.configure with correct client IDs', () => {
      configureGoogleSignIn();

      expect(GoogleSignin.configure).toHaveBeenCalledWith({
        webClientId: process.env['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'],
        iosClientId: process.env['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'],
      });
    });
  });

  describe('signInWithGoogle', () => {
    it('returns success with user and session on successful sign-in', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token' };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        type: 'success',
        data: { idToken: 'mock-id-token', user: { id: '1' } },
      });
      mockSignInWithIdToken.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: true,
        user: mockUser,
        session: mockSession,
      });
      expect(GoogleSignin.signIn).toHaveBeenCalled();
      expect(mockSignInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'mock-id-token',
      });
    });

    it('returns CANCELLED error when user cancels sign-in', async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        type: 'cancelled',
        data: null,
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'CANCELLED', message: 'ログインがキャンセルされました' },
      });
    });

    it('returns NO_ID_TOKEN when idToken is null', async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        type: 'success',
        data: { idToken: null, user: { id: '1' } },
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'NO_ID_TOKEN', message: 'トークンの取得に失敗しました' },
      });
    });

    it('returns SUPABASE_ERROR when signInWithIdToken fails', async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        type: 'success',
        data: { idToken: 'mock-id-token', user: { id: '1' } },
      });
      mockSignInWithIdToken.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid token' },
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'SUPABASE_ERROR', message: 'Invalid token' },
      });
    });

    it('returns SUPABASE_ERROR when signInWithIdToken returns no user/session', async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        type: 'success',
        data: { idToken: 'mock-id-token', user: { id: '1' } },
      });
      mockSignInWithIdToken.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'SUPABASE_ERROR', message: 'セッション設定失敗' },
      });
    });

    it('returns UNKNOWN_ERROR on unexpected error', async () => {
      (GoogleSignin.signIn as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: 'Network error' },
      });
    });
  });

  describe('signOut', () => {
    it('returns success when sign-out succeeds', async () => {
      mockSignOut.mockResolvedValue({ error: null });
      (GoogleSignin.signOut as jest.Mock).mockResolvedValue(null);

      const result = await signOut();

      expect(result).toEqual({ success: true });
      expect(mockSignOut).toHaveBeenCalled();
      expect(GoogleSignin.signOut).toHaveBeenCalled();
    });

    it('returns error when Supabase sign-out fails', async () => {
      mockSignOut.mockResolvedValue({ error: { message: 'Sign out failed' } });

      const result = await signOut();

      expect(result).toEqual({
        success: false,
        error: { code: 'SIGN_OUT_ERROR', message: 'Sign out failed' },
      });
    });

    it('returns success even when GoogleSignin.signOut fails (silent)', async () => {
      mockSignOut.mockResolvedValue({ error: null });
      (GoogleSignin.signOut as jest.Mock).mockRejectedValue(new Error('Google sign out failed'));

      const result = await signOut();

      expect(result).toEqual({ success: true });
    });
  });

  describe('signInWithApple', () => {
    it('returns success with user and session on successful sign-in', async () => {
      const mockUser = { id: 'user-apple', email: 'apple@example.com' };
      const mockSession = { access_token: 'apple-token' };

      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
        identityToken: 'mock-apple-identity-token',
        fullName: { givenName: 'Test', familyName: 'User' },
        email: 'apple@example.com',
      });
      mockSignInWithIdToken.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await signInWithApple();

      expect(result).toEqual({ success: true, user: mockUser, session: mockSession });
      expect(AppleAuthentication.isAvailableAsync).toHaveBeenCalled();
      expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      expect(mockSignInWithIdToken).toHaveBeenCalledWith({
        provider: 'apple',
        token: 'mock-apple-identity-token',
      });
    });

    it('returns APPLE_NOT_AVAILABLE when Apple Sign In is not available', async () => {
      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      const result = await signInWithApple();

      expect(result).toEqual({
        success: false,
        error: { code: 'APPLE_NOT_AVAILABLE', message: 'Apple Sign In は利用できません' },
      });
    });

    it('returns CANCELLED when user cancels sign-in (ERR_REQUEST_CANCELED)', async () => {
      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      const cancelError = Object.assign(new Error('Cancelled'), { code: 'ERR_REQUEST_CANCELED' });
      (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(cancelError);

      const result = await signInWithApple();

      expect(result).toEqual({
        success: false,
        error: { code: 'CANCELLED', message: 'ログインがキャンセルされました' },
      });
    });

    it('returns NO_ID_TOKEN when identityToken is null', async () => {
      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
        identityToken: null,
        fullName: null,
        email: null,
      });

      const result = await signInWithApple();

      expect(result).toEqual({
        success: false,
        error: { code: 'NO_ID_TOKEN', message: 'トークンの取得に失敗しました' },
      });
    });

    it('returns SUPABASE_ERROR when signInWithIdToken returns an error', async () => {
      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
        identityToken: 'mock-apple-identity-token',
        fullName: null,
        email: null,
      });
      mockSignInWithIdToken.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid Apple token' },
      });

      const result = await signInWithApple();

      expect(result).toEqual({
        success: false,
        error: { code: 'SUPABASE_ERROR', message: 'Invalid Apple token' },
      });
    });

    it('returns SUPABASE_ERROR when signInWithIdToken returns no user/session', async () => {
      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
        identityToken: 'mock-apple-identity-token',
        fullName: null,
        email: null,
      });
      mockSignInWithIdToken.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const result = await signInWithApple();

      expect(result).toEqual({
        success: false,
        error: { code: 'SUPABASE_ERROR', message: 'セッション設定失敗' },
      });
    });

    it('returns UNKNOWN_ERROR on unexpected error', async () => {
      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(
        new Error('Unexpected network error')
      );

      const result = await signInWithApple();

      expect(result).toEqual({
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: 'Unexpected network error' },
      });
    });
  });
});
