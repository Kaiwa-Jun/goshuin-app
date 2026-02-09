// [REVERT-TO-NATIVE] このファイル全体を元のネイティブ Google Sign-In に戻す必要あり
// 詳細: docs/issues/issue-013-revert-to-native-google-signin.md

import type { Session, User } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@services/supabase';

// Expo Go でブラウザセッションを正常に閉じるために必要
WebBrowser.maybeCompleteAuthSession();

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

export async function signInWithGoogle(): Promise<AuthResult> {
  // 1. Supabase から OAuth URL を取得
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'com.goshuin.app',
    path: 'auth/callback',
  });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUri, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return {
      success: false,
      error: { code: 'SUPABASE_ERROR', message: error?.message ?? 'OAuth URL取得失敗' },
    };
  }

  // 2. ブラウザで Google 認証
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type !== 'success') {
    return {
      success: false,
      error: { code: 'CANCELLED', message: 'ログインがキャンセルされました' },
    };
  }

  // 3. リダイレクト URL からトークンを抽出
  // Supabase はフラグメント (#) にトークンを返す
  const url = new URL(result.url);
  const params = new URLSearchParams(url.hash.substring(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return {
      success: false,
      error: { code: 'NO_ID_TOKEN', message: 'トークンの取得に失敗しました' },
    };
  }

  // 4. Supabase セッション設定
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !sessionData.user || !sessionData.session) {
    return {
      success: false,
      error: { code: 'SUPABASE_ERROR', message: sessionError?.message ?? 'セッション設定失敗' },
    };
  }

  return { success: true, user: sessionData.user, session: sessionData.session };
}

export async function signOut(): Promise<SignOutResult> {
  // [REVERT-TO-NATIVE] ネイティブ版では GoogleSignin.signOut() も呼ぶ
  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      success: false,
      error: { code: 'SIGN_OUT_ERROR', message: error.message },
    };
  }

  return { success: true };
}
