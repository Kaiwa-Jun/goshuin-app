// アカウント削除（App Store Guideline 5.1.1(v)）
// 契約書: docs/issues/issue-134-account-deletion.md
//
// ⚠ config.toml で verify_jwt = false にしている（このプロジェクトは新 API キー
//   体系で、ゲートウェイの JWT 検証は sb_secret を弾いてしまうため）。そのぶん
//   「呼び出し元が本人であること」の検証はこの関数の責務になる。
//   削除対象の user_id は getUser() の結果からのみ取り、リクエストボディからは
//   絶対に読まない（読むと他人のアカウントを消せる穴になる）。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  deleteAccountForUser,
  extractBearerToken,
  type DeleteAccountDeps,
} from './deleteAccount.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'goshuin-images';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const token = extractBearerToken(req.headers.get('Authorization'));
    if (!token) {
      return json({ success: false, error: 'ログインが必要です' }, 401);
    }

    // 呼び出し元の本人確認。ここで得た id だけを削除に使う
    const authClient = createClient(supabaseUrl, anonKey);
    const { data, error: userError } = await authClient.auth.getUser(token);
    if (userError || !data?.user) {
      console.warn('[delete-account] getUser failed:', userError?.message);
      return json({ success: false, error: 'ログインが必要です' }, 401);
    }

    const userId = data.user.id;
    console.log('[delete-account] start:', userId);

    const admin = createClient(supabaseUrl, serviceKey);

    const deps: DeleteAccountDeps = {
      listImages: async id => {
        const { data: files, error } = await admin.storage.from(BUCKET).list(id, { limit: 1000 });
        if (error) return { names: [], error: error.message };
        return { names: (files ?? []).map(f => f.name), error: null };
      },
      removeImages: async paths => {
        const { error } = await admin.storage.from(BUCKET).remove(paths);
        return { error: error ? error.message : null };
      },
      detachCreatedSpots: async id => {
        const { error } = await admin
          .from('spots')
          .update({ created_by_user_id: null })
          .eq('created_by_user_id', id);
        return { error: error ? error.message : null };
      },
      deleteAuthUser: async id => {
        const { error } = await admin.auth.admin.deleteUser(id);
        return { error: error ? error.message : null };
      },
    };

    const result = await deleteAccountForUser(deps, userId);
    console.log('[delete-account] done:', userId, JSON.stringify(result));

    return json(result.body, result.status);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[delete-account] unexpected:', message);
    return json({ success: false, error: message }, 500);
  }
});
