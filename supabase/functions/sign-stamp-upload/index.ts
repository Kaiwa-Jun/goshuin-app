// 御朱印の写真を R2 に置くための署名付き URL と削除（Issue #227 / D-1）
// 判定の中身は signUpload.ts（Deno テストあり）。ここは Supabase と R2 をつなぐだけ。
//
// ⚠ config.toml で verify_jwt = false（他の関数と同じゲートウェイの都合）。
//   本人確認は getUser() が唯一の防衛線。user_id をリクエストボディから読まないこと。
//
// 必要な secrets（supabase secrets set）:
//   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
//   R2 のトークンは goshuin-images バケット限定の Object Read & Write で作る
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

import { presignPutUrl } from './presign.ts';
import { handleSignRequest } from './signUpload.ts';

const BUCKET = 'goshuin-images';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractBearerToken(header: string | null): string | null {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return token ? token : null;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const endpoint = `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${BUCKET}`;
    const r2 = new AwsClient({
      accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
      service: 's3',
      region: 'auto',
    });
    const authClient = createClient(supabaseUrl, anonKey);

    const body = await req.json().catch(() => ({}));
    const result = await handleSignRequest(
      {
        getUserId: async token => {
          const { data, error } = await authClient.auth.getUser(token);
          return error || !data?.user ? null : data.user.id;
        },
        presignPut: (key, size) => presignPutUrl(r2, endpoint, key, size),
        deleteObjects: async keys => {
          // 1回で消すのは1〜2件。DeleteObjects の XML より1件ずつの方が単純
          const results = await Promise.all(
            keys.map(key =>
              // isOwnKey で形は絞ってあるが、URL に埋め込む前にもエンコードする（二重の守り）
              r2.fetch(`${endpoint}/${key.split('/').map(encodeURIComponent).join('/')}`, {
                method: 'DELETE',
              })
            )
          );
          // R2 は存在しないキーの DELETE も 204 を返す
          const failed = results.find(r => !r.ok);
          return { error: failed ? `HTTP ${failed.status}` : null };
        },
        now: () => Date.now(),
        randomSuffix: () => Math.random().toString(36).slice(2, 8),
      },
      extractBearerToken(req.headers.get('Authorization')),
      body && typeof body === 'object' ? body : {}
    );
    return json(result.body, result.status);
  } catch (error) {
    console.error('[sign-stamp-upload] unexpected:', error);
    return json({ success: false, error: '署名に失敗しました' }, 500);
  }
});
