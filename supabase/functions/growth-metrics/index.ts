// グロースの数字を、集計だけ返す（Issue #285 / S3）。GET だけ・合言葉が合ったときだけ。
// 判定の中身は metrics.ts / token.ts（Deno テストあり）。ここは Supabase・時計・ログをつなぐだけ。
//
// 呼び出し元はルーティン D（claude.ai のクラウドで毎週動く Claude）で、ユーザーではない。
// 呼び方と合言葉の置き場所: docs/project/growth-metrics-routine.md
//
// ⚠ config.toml で verify_jwt = false（他の関数と同じゲートウェイの都合）。
//   合言葉（GROWTH_METRICS_TOKEN）の定数時間の比べが唯一の防衛線。
//   service role の鍵はこの関数の中だけで使い、外に出すのは集計値だけ。
//   リクエスト・ヘッダー・合言葉・集計した数をログに出さないこと（D-14）
//
// 必要な secrets: GROWTH_METRICS_TOKEN（32 文字以上。未設定・短いときはどんなリクエストにも 401）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { handleGrowthMetrics } from './metrics.ts';

Deno.serve(async req => {
  const result = await handleGrowthMetrics(
    {
      expectedToken: Deno.env.get('GROWTH_METRICS_TOKEN'),
      fetchCounts: async params => {
        // 合言葉が合ったときだけここに来る（401・405 では DB に触らない）
        const admin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const { data, error } = await admin.rpc('growth_metrics_counts', params);
        // ログに出すのは code と message だけ（D-14）
        if (error) throw new Error([error.code, error.message].filter(Boolean).join(' '));
        return data;
      },
      now: () => Date.now(),
      log: (level, message) => console[level](message),
    },
    req.method,
    req.headers.get('Authorization')
  );
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: result.headers,
  });
});
