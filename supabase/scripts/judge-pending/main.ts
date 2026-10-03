// 既存の pending の寺社に公開の基準を当てる（Issue #248 S6 / 手順 H-5）。
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… ANTHROPIC_API_KEY=… \
//     deno run -A supabase/scripts/judge-pending/main.ts <id> [<id> …]          # dry-run（既定）
//     deno run -A supabase/scripts/judge-pending/main.ts --apply <id> [<id> …]  # active と判定した行を更新
//
// ⚠ 鍵は自分のターミナルで環境変数に入れる（会話や履歴に残さない）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { researchCandidates } from '../../functions/research-spot/research.ts';
import { judgePending } from './judgePending.ts';

const NEARBY_DEGREES = 0.005;

const apply = Deno.args.includes('--apply');
const ids = Deno.args.filter(a => a !== '--apply');
if (ids.length === 0) {
  console.error('寺社の id を1つ以上渡してください');
  Deno.exit(1);
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const io = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  anthropicApiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
  setTimer: (ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

await judgePending(
  {
    listPending: async list => {
      const { data, error } = await admin
        .from('spots')
        .select('id, name, type, address, prefecture, lat, lng')
        .eq('status', 'pending')
        .in('id', list);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    nearbyActives: async (lat, lng) => {
      const { data, error } = await admin
        .from('spots')
        .select('name, lat, lng')
        .eq('status', 'active')
        .gte('lat', lat - NEARBY_DEGREES)
        .lte('lat', lat + NEARBY_DEGREES)
        .gte('lng', lng - NEARBY_DEGREES)
        .lte('lng', lng + NEARBY_DEGREES);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    research: async (name, hint) => {
      const found = await researchCandidates(io, name, hint);
      return found.ok ? found.candidates : null;
    },
    activate: async id => {
      const { error } = await admin
        .from('spots')
        .update({ status: 'active', rank: 1 })
        .eq('id', id)
        .eq('status', 'pending');
      if (error) throw new Error(error.message);
    },
    log: line => console.log(line),
  },
  ids,
  apply
);
console.log(
  apply ? '（--apply: active の行を更新しました）' : '（dry-run: 何も書き換えていません）'
);
