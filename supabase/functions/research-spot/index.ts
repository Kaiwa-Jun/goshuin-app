// 見つからない寺社をウェブ検索で調べ、候補を返す（Issue #248 / S3）
// 判定と解析の中身は research.ts（Deno テストあり）。ここは Supabase・fetch・時計をつなぐだけ。
//
// ⚠ config.toml で verify_jwt = false（他の関数と同じゲートウェイの都合）。
//   本人確認は getUser() が唯一の防衛線。user_id をリクエストボディから読まないこと。
//
// 必要な secrets: ANTHROPIC_API_KEY（extract-spot-info / crawl-spot-sources と共用）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { handleResearchRequest } from './research.ts';

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
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    // spot_research_requests はポリシーを持たない（service role だけが読み書きする）
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    const result = await handleResearchRequest(
      {
        getUserId: async token => {
          const { data, error } = await authClient.auth.getUser(token);
          return error || !data?.user ? null : data.user.id;
        },
        claimRequest: async (userId, sinceIso, limit) => {
          const { data, error } = await admin.rpc('claim_spot_research', {
            p_user: userId,
            p_since: sinceIso,
            p_limit: limit,
          });
          if (error) throw new Error(error.message);
          return (data as string | null) ?? null;
        },
        updateCandidates: async (id, candidates, diagnostics) => {
          const { error } = await admin
            .from('spot_research_requests')
            .update({ candidates, diagnostics })
            .eq('id', id);
          if (error) throw new Error(error.message);
        },
        fetch: (input, init) => fetch(input, init),
        anthropicApiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
        setTimer: (ms, fn) => {
          const id = setTimeout(fn, ms);
          return () => clearTimeout(id);
        },
        now: () => Date.now(),
      },
      extractBearerToken(req.headers.get('Authorization')),
      body && typeof body === 'object' && !Array.isArray(body) ? body : {}
    );
    return json(result.body, result.status);
  } catch (error) {
    console.error('[research-spot] unexpected:', error);
    return json({ error: 'internal error' }, 500);
  }
});
