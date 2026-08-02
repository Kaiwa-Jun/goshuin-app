-- crawl-spot-sources の定期実行スケジュール登録
--
-- ⚠️ このファイルは migration ではなく、ユーザーが Supabase SQL Editor で手動実行する運用ファイル。
-- ⚠️ 実キーをこのファイルに書かないこと。キーは Vault に保存し、下の SQL は Vault 参照で動く。

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

-- 週2回（火・金 02:00 JST = 月・木 17:00 UTC。cron 式は UTC で解釈される）
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
    body := jsonb_build_object('limit', 20),
    timeout_milliseconds := 120000
  );
  $$
);

-- 解除: select cron.unschedule('crawl-spot-sources-biweekly');
-- 登録確認: select jobname, schedule from cron.job;
-- 実行履歴: select * from cron.job_run_details order by start_time desc limit 20;
