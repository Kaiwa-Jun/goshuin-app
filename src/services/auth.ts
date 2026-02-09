import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@services/supabase';

const env = process.env;

// Lazy-load Google Sign-In to avoid crash on Expo Go
// (native module not available without development build)
function getGoogleSignIn() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin');
}

type AuthSuccess = {
  success: true;
  user: User;
  session: Session;
};

type AuthError = {
  success: false;
  error: {
    code: 'CANCELLED' | 'NO_ID_TOKEN' | 'SUPABASE_ERROR' | 'UNKNOWN_ERROR' | 'SIGN_OUT_ERROR';
    message: string;
  };
};

export type AuthResult = AuthSuccess | AuthError;

export type SignOutResult =
  | { success: true }
  | { success: false; error: { code: 'SIGN_OUT_ERROR'; message: string } };

export function configureGoogleSignIn(): void {
  try {
    const { GoogleSignin } = getGoogleSignIn();
    GoogleSignin.configure({
      webClientId: env['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'],
      iosClientId: env['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'],
    });
  } catch {
    // Native module not available (e.g. Expo Go) — skip configuration
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const { GoogleSignin } = getGoogleSignIn();

    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;

    if (!idToken) {
      return {
        success: false,
        error: { code: 'NO_ID_TOKEN', message: 'Google認証トークンの取得に失敗しました' },
      };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      return {
        success: false,
        error: { code: 'SUPABASE_ERROR', message: error.message },
      };
    }

    return {
      success: true,
      user: data.user!,
      session: data.session!,
    };
  } catch (error: unknown) {
    try {
      const { statusCodes, isErrorWithCode } = getGoogleSignIn();
      if (
        isErrorWithCode(error) &&
        (error as { code: string }).code === statusCodes.SIGN_IN_CANCELLED
      ) {
        return {
          success: false,
          error: { code: 'CANCELLED', message: 'ログインがキャンセルされました' },
        };
      }
    } catch {
      // Native module not available
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : '予期しないエラーが発生しました',
      },
    };
  }
}

export async function signOut(): Promise<SignOutResult> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      success: false,
      error: { code: 'SIGN_OUT_ERROR', message: error.message },
    };
  }

  try {
    const { GoogleSignin } = getGoogleSignIn();
    await GoogleSignin.signOut();
  } catch {
    // Google signOut failure is non-critical
  }

  return { success: true };
}
