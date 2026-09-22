-- ============================================================
-- goshuin-images: ログイン中のユーザーが「自分のフォルダにだけ」書けるか（Issue #225）
--
-- 実行: npx supabase@latest db query --linked -f supabase/validation/storage_upload_isolation.sql
--
-- ⚠ 必ずエラーで終わる。それで正しい。
--   DO ブロックの最後で RAISE EXCEPTION して、試しに入れた行をすべて巻き戻している
--   （本番に流しても何も残らない）。結果はそのエラーメッセージに載る:
--
--     RESULT own=allowed other=denied   ← 期待値
--     RESULT own=allowed other=allowed  ← 他人のフォルダに書ける（#225 の穴）
--
-- Storage API のアップロードは、authenticated ロール + JWT の sub で
-- storage.objects に INSERT するのと同じ RLS 判定を通る。ここではそれを直接再現する
-- ============================================================

DO $$
DECLARE
  me    constant text := '00000000-0000-4000-8000-00000000a225';
  other constant text := '00000000-0000-4000-8000-00000000b225';
  own_result   text;
  other_result text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', me, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('goshuin-images', me || '/isolation-check.jpg');
    own_result := 'allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    own_result := 'denied';
  END;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('goshuin-images', other || '/isolation-check.jpg');
    other_result := 'allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    other_result := 'denied';
  END;

  RAISE EXCEPTION 'RESULT own=% other=%', own_result, other_result;
END $$;
