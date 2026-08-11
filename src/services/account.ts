import { supabase } from '@services/supabase';
import { describeSupabaseError } from '@/utils/supabaseError';

export type DeleteAccountResult =
  | { success: true }
  | { success: false; error: { code: 'DELETE_ACCOUNT_FAILED'; message: string } };

/** Edge Function のレスポンス。関数側は 200 でも success: false を返しうる */
interface DeleteAccountResponse {
  success?: boolean;
  error?: string;
  warnings?: string[];
}

function failure(message: string): DeleteAccountResult {
  return { success: false, error: { code: 'DELETE_ACCOUNT_FAILED', message } };
}

/**
 * アカウントを削除する（App Store Guideline 5.1.1(v)）。
 *
 * 削除対象は Edge Function 側がログイン中の JWT から決める。**ここでボディに
 * user_id を載せてはいけない**（他人のアカウントを消せる穴になる）。
 *
 * 失敗しても throw せず判別可能ユニオンに畳む。呼び出し側は失敗時に
 * サインアウトせずエラー原文を画面に出す（契約書 D-4。Issue #118 / #121 と同じ方針）。
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  try {
    const { data, error } =
      await supabase.functions.invoke<DeleteAccountResponse>('delete-account');

    if (error) {
      return failure(describeSupabaseError(error, 'アカウントの削除に失敗しました'));
    }

    if (!data?.success) {
      return failure(data?.error ?? 'アカウントの削除に失敗しました');
    }

    if (data.warnings?.length) {
      // 画像の消し残し等。削除自体は成立しているのでユーザーには出さずログに残す
      console.warn('[account] delete-account warnings:', data.warnings);
    }

    return { success: true };
  } catch (e) {
    return failure(describeSupabaseError(e, 'アカウントの削除に失敗しました'));
  }
}
