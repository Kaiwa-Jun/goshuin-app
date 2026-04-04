import type { Session, User } from '@supabase/supabase-js';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@services/supabase';

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
  GoogleSignin.configure({
    webClientId: process.env['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'],
    iosClientId: process.env['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'],
  });
}

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const response = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      return {
        success: false,
        error: { code: 'CANCELLED', message: 'ログインがキャンセルされました' },
      };
    }

    const idToken = response.data?.idToken;
    if (!idToken) {
      return {
        success: false,
        error: { code: 'NO_ID_TOKEN', message: 'トークンの取得に失敗しました' },
      };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error || !data.user || !data.session) {
      return {
        success: false,
        error: { code: 'SUPABASE_ERROR', message: error?.message ?? 'セッション設定失敗' },
      };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: err instanceof Error ? err.message : '不明なエラー',
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
    await GoogleSignin.signOut();
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'SIGN_OUT_ERROR',
        message: err instanceof Error ? err.message : 'Google sign out failed',
      },
    };
  }

  return { success: true };
}
