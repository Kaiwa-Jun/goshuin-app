import { configureGoogleSignIn, signInWithGoogle, signOut } from '../auth';

// Get references to the mocked module (set up in jest.setup.js)
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} = require('@react-native-google-signin/google-signin');
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

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

describe('auth service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('configureGoogleSignIn', () => {
    it('calls GoogleSignin.configure with webClientId', () => {
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'test-web-client-id';
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'test-ios-client-id';

      configureGoogleSignIn();

      expect(GoogleSignin.configure).toHaveBeenCalledWith({
        webClientId: 'test-web-client-id',
        iosClientId: 'test-ios-client-id',
      });
    });
  });

  describe('signInWithGoogle', () => {
    it('returns success with user and session on successful sign-in', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token' };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        data: { idToken: 'google-id-token', user: { email: 'test@example.com' } },
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
      expect(mockSignInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'google-id-token',
      });
    });

    it('returns CANCELLED error when user cancels sign-in', async () => {
      const cancelError = { code: statusCodes.SIGN_IN_CANCELLED };
      (GoogleSignin.signIn as jest.Mock).mockRejectedValue(cancelError);
      (isErrorWithCode as jest.Mock).mockReturnValue(true);

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'CANCELLED', message: 'ログインがキャンセルされました' },
      });
    });

    it('returns NO_ID_TOKEN error when idToken is missing', async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        data: { idToken: null, user: { email: 'test@example.com' } },
      });

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'NO_ID_TOKEN', message: 'Google認証トークンの取得に失敗しました' },
      });
    });

    it('returns SUPABASE_ERROR when Supabase auth fails', async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        data: { idToken: 'google-id-token', user: { email: 'test@example.com' } },
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

    it('returns UNKNOWN_ERROR for unexpected errors', async () => {
      const unknownError = new Error('Something went wrong');
      (GoogleSignin.signIn as jest.Mock).mockRejectedValue(unknownError);
      (isErrorWithCode as jest.Mock).mockReturnValue(false);

      const result = await signInWithGoogle();

      expect(result).toEqual({
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: 'Something went wrong' },
      });
    });
  });

  describe('signOut', () => {
    it('returns success when sign-out succeeds', async () => {
      mockSignOut.mockResolvedValue({ error: null });
      (GoogleSignin.signOut as jest.Mock).mockResolvedValue(undefined);

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
  });
});
