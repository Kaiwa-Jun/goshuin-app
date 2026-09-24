// 寺社を追加する（Issue #248）。判定の中身は addSpot.ts（Deno テストあり）。ここは Supabase をつなぐだけ。
//
// ⚠ config.toml で verify_jwt = false（他の関数と同じゲートウェイの都合）。
//   本人確認は getUser() が唯一の防衛線。user_id をリクエストボディから読まないこと。
//   spots への INSERT はこの関数だけ（service role）。クライアントの INSERT ポリシーは落としてある
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { handleAddSpot } from './addSpot.ts';

const NEARBY_DEGREES = 0.005;

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
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    const result = await handleAddSpot(
      {
        getUserId: async token => {
          const { data, error } = await authClient.auth.getUser(token);
          return error || !data?.user ? null : data.user.id;
        },
        getResearch: async id => {
          const { data } = await admin
            .from('spot_research_requests')
            .select('user_id, candidates, created_at')
            .eq('id', id)
            .maybeSingle();
          return data;
        },
        nearbySpots: async (lat, lng) => {
          const { data, error } = await admin
            .from('spots')
            .select('*')
            .in('status', ['active', 'pending'])
            .gte('lat', lat - NEARBY_DEGREES)
            .lte('lat', lat + NEARBY_DEGREES)
            .gte('lng', lng - NEARBY_DEGREES)
            .lte('lng', lng + NEARBY_DEGREES);
          if (error) throw new Error(error.message);
          return data ?? [];
        },
        insertSpot: async row => {
          const { data, error } = await admin.from('spots').insert(row).select().single();
          if (error) throw new Error(error.message);
          return data;
        },
        insertOfficialSource: async (spotId, url) => {
          const { error } = await admin
            .from('spot_info_sources')
            .insert({ spot_id: spotId, url, source_type: 'official' });
          // unique の衝突などは寺社の追加そのものを失敗にしない
          if (error) console.warn('[add-spot] spot_info_sources:', error.message);
        },
        now: () => Date.now(),
        log: message => console.log(message),
      },
      extractBearerToken(req.headers.get('Authorization')),
      body && typeof body === 'object' ? body : {}
    );
    return json(result.body, result.status);
  } catch (error) {
    console.error('[add-spot] unexpected:', error);
    return json({ error: '寺社を追加できませんでした' }, 500);
  }
});
