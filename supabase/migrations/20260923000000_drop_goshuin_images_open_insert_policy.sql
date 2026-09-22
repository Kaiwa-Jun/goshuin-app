-- goshuin-images: 他人のフォルダに書き込めるポリシーを落とす（Issue #225）
--
-- 20260809000000 で本番の状態を写経したとき、INSERT ポリシーが2本あった:
--   "Allow authenticated uploads"          … bucket_id だけを見る（フォルダを見ない）
--   "Users can upload own goshuin images"  … auth.uid() = 先頭フォルダ
-- PERMISSIVE ポリシーは OR で結合されるので、前者があると後者の制限が消え、
-- ログイン済みなら誰でも他人の <user_id>/ 配下に書けた。バケットは public なので、
-- 書かれた画像は誰でも読める。
--
-- 落としても困る呼び出し元は無い:
--   - アプリのアップロードは常に `${userId}/...`（src/services/stamps.ts uploadStampImage）
--   - make-stamp-thumbnail / delete-account は service role で RLS を通らない
--
-- 確認: supabase/validation/storage_upload_isolation.sql が
--   "RESULT own=allowed other=denied" を返すこと

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
