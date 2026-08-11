-- goshuin-images バケットと Storage の RLS ポリシー
--
-- このバケットは 2026-03 に Supabase ダッシュボードで手作業作成されており、
-- migrations に存在しなかった（環境を作り直すと記録機能が動かない状態）。
-- 本番の現状（2026-08-09 時点で pg_policies / storage.buckets を確認した内容）を
-- そのまま写経したもので、何度流しても同じ状態になるように書いている。
--
-- ⚠ allowed_mime_types が設定されているため、アップロード時に
--   contentType を渡さないと supabase-js の既定値（text/plain）で弾かれる。
--   src/services/stamps.ts の STAMP_IMAGE_CONTENT_TYPE がこれに対応している。

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'goshuin-images',
  'goshuin-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Postgres に CREATE POLICY IF NOT EXISTS は無いため DROP → CREATE で冪等にする

-- 公開読み取り（バケットが public なので誰でも参照できる）
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
CREATE POLICY "Allow public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'goshuin-images');

-- ログイン済みユーザーのアップロード
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'goshuin-images');

-- 自分のフォルダ（<user_id>/...）配下だけを操作できる
DROP POLICY IF EXISTS "Users can upload own goshuin images" ON storage.objects;
CREATE POLICY "Users can upload own goshuin images"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'goshuin-images'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view own goshuin images" ON storage.objects;
CREATE POLICY "Users can view own goshuin images"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'goshuin-images'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own goshuin images" ON storage.objects;
CREATE POLICY "Users can update own goshuin images"
  ON storage.objects FOR UPDATE
  TO public
  USING (
    bucket_id = 'goshuin-images'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own goshuin images" ON storage.objects;
CREATE POLICY "Users can delete own goshuin images"
  ON storage.objects FOR DELETE
  TO public
  USING (
    bucket_id = 'goshuin-images'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
