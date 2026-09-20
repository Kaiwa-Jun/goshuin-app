-- crawl-spot-sources の定期実行スケジュール登録
--
-- ⚠️ このファイルは migration ではなく、ユーザーが Supabase SQL Editor で手動実行する運用ファイル。
-- ⚠️ 実キーをこのファイルに書かないこと。キーは Vault に保存し、下の SQL は Vault 参照で動く。
--
-- 【Instagram パスのトークン運用（Issue #111）】
-- Edge Function の secrets に META_ACCESS_TOKEN（Meta 長期ユーザートークン）と
-- META_IG_USER_ID を登録済み。**トークンの期限はここが唯一の正**（60日ごとに手動更新）。
--
--   現在の期限: 2026-11-20 ごろ（2026-09-21 に更新。本番で疎通確認済み）
--
-- 更新したらこの行の日付を直すこと。他のドキュメントは日付を持たずここを指している。
-- 【更新手順】古いトークンは要らない。新しく作る方が早い（2026-09-21 に実際にこれでやった）:
--   1. https://developers.facebook.com/tools/explorer/ で goshuin-sampo-watcher を選び、
--      権限4つ（pages_show_list / instagram_basic / instagram_manage_insights /
--      pages_read_engagement）が入った状態で Generate Access Token
--      → ⚠ ここで出るのは**1〜2時間で切れる短命トークン**。これをそのまま入れないこと
--   2. https://developers.facebook.com/tools/debug/accesstoken/ に貼って
--      「デバッグ」→「アクセストークンを延長」→ **ここで出た方**が60日トークン
--      有効期限が「約2か月後」になっていることを必ず目で確認する
--   3. Supabase Dashboard → Edge Functions → Secrets の META_ACCESS_TOKEN を差し替え
--      （`npx supabase@latest secrets set META_ACCESS_TOKEN=<値> --project-ref tvnozkpxncmnehyomoff` でも可）
--
-- 【更新後の確認】秘密情報に触れずに本番で確かめられる。下を SQL Editor で実行し、
-- token_invalid = false / processed >= 1 を見る（dry_run なので Claude は呼ばれず、
-- 書き込みは対象1件の last_crawled_at だけ）:
--
--   select net.http_post(
--     url := 'https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/crawl-spot-sources',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
--     body := jsonb_build_object('mode','instagram','limit',1,'dry_run',true),
--     timeout_milliseconds := 120000) as request_id;
--   -- 数秒待ってから（上で出た id を使う）
--   select (content::jsonb->'instagram'->>'token_invalid') as token_invalid,
--          (content::jsonb->'instagram'->>'processed')     as processed
--   from net._http_response where id = <request_id>;
--
-- 失効すると Instagram パスのレスポンスに instagram.token_invalid = true が出る
-- （web パスは影響を受けない）。
--
-- 【無期限にはできない（2026-09-21 調査済み・再調査不要）】
-- 「長期ページアクセストークンは無期限」という逃げ道があるが、**この構成では使えない**。
-- グラフAPIエクスプローラで確認した結果:
--   ・pages_show_list は granted（me/permissions で確認）
--   ・にもかかわらず me/accounts は {"data": []} ＝ 紐づく Facebook ページが無い
-- ページが無い以上ページトークンは発行できないため、60日ごとの手動更新は避けられない。
-- business_discovery 自体は現トークンで正常動作することも同日に確認済み。
--
-- 自動更新（fb_exchange_token で延ばし続ける）は見送った。Edge Function は自分の
-- secrets を書き換えられないため、トークンを DB か Vault に移して更新ジョブを持つ必要があり、
-- 年6回・2分の作業のために新しい壊れどころを作ることになる。

-- 事前準備（初回のみ）
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- サービスロールキーを Vault に保存する（<SERVICE_ROLE_KEY> を実際の値に置き換えて SQL Editor で実行。
-- 実行後はエディタの履歴からクエリを削除しておく）
-- ⚠️ 使うキーは Dashboard → Project Settings → API Keys の「secret」キー（sb_secret_... で始まる41文字）。
--    legacy の service_role JWT（eyJ...）では関数内の認可ガードに一致しない（関数環境の
--    SUPABASE_SERVICE_ROLE_KEY には sb_secret が入っているため。2026-08-02 確認）
-- select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--
-- 既に legacy JWT を保存してしまった場合の差し替え:
-- select vault.update_secret((select id from vault.secrets where name = 'service_role_key'), '<sb_secret_のキー>');

-- ⚠️ 再登録の手順（Issue #111 で job が 2 本構成になった）:
--    既存 job は body に mode を持たない状態で登録済みのため、以下を先に実行してから
--    このファイルの 2 つの cron.schedule を実行し直すこと。
--    select cron.unschedule('crawl-spot-sources-biweekly');

-- 週2回（火・金 02:00 JST = 月・木 17:00 UTC。cron 式は UTC で解釈される）: 公式サイト / RSS
select cron.schedule(
  'crawl-spot-sources-biweekly',
  '0 17 * * 1,4',
  $$
  select net.http_post(
    url := 'https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/crawl-spot-sources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('mode', 'web', 'limit', 20),
    timeout_milliseconds := 120000
  );
  $$
);

-- 週2回（火・金 02:30 JST = 月・木 17:30 UTC）: Instagram Business Discovery
-- web パスと 30 分ずらし、それぞれが独立した実行時間予算（RUN_BUDGET_MS）を持てるようにする
select cron.schedule(
  'crawl-spot-sources-instagram',
  '30 17 * * 1,4',
  $$
  select net.http_post(
    url := 'https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/crawl-spot-sources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('mode', 'instagram', 'limit', 25),
    timeout_milliseconds := 120000
  );
  $$
);

-- 解除: select cron.unschedule('crawl-spot-sources-biweekly');
--       select cron.unschedule('crawl-spot-sources-instagram');
-- 登録確認: select jobname, schedule from cron.job;
-- 実行履歴: select * from cron.job_run_details order by start_time desc limit 20;
-- レスポンス本文の後追い（instagram.token_invalid 等）: select * from net._http_response order by id desc limit 20;
