import type { Session, User } from '@supabase/supabase-js';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@services/supabase';

type AuthSuccess = {
  success: true;
  user: User;
  session: Session;
};

type AuthError = {
  success: false;
  error: {
    code:
      | 'CANCELLED'
      | 'NO_ID_TOKEN'
      | 'SUPABASE_ERROR'
      | 'UNKNOWN_ERROR'
      | 'SIGN_OUT_ERROR'
      | 'APPLE_NOT_AVAILABLE';
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
  } catch {
    // Apple ログイン等、Google未サインイン時は無視
  }

  return { success: true };
}

export async function signInWithApple(): Promise<AuthResult> {
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      return {
        success: false,
        error: { code: 'APPLE_NOT_AVAILABLE', message: 'Apple Sign In は利用できません' },
      };
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken } = credential;
    if (!identityToken) {
      return {
        success: false,
        error: { code: 'NO_ID_TOKEN', message: 'トークンの取得に失敗しました' },
      };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });

    if (error || !data.user || !data.session) {
      return {
        success: false,
        error: { code: 'SUPABASE_ERROR', message: error?.message ?? 'セッション設定失敗' },
      };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    if (
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'ERR_REQUEST_CANCELED'
    ) {
      return {
        success: false,
        error: { code: 'CANCELLED', message: 'ログインがキャンセルされました' },
      };
    }
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: err instanceof Error ? err.message : '不明なエラー',
      },
    };
  }
}
