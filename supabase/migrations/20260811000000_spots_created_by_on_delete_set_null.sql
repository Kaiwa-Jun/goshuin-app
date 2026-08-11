-- spots.created_by_user_id を ON DELETE SET NULL にする
--
-- 元の定義（20260208102535_create_spots.sql）は ON DELETE 句が無く、既定の
-- NO ACTION になっていた。この状態だと「自分でスポットを追加したことのある
-- ユーザー」の auth.users 行を削除しようとした瞬間に FK 違反で失敗し、
-- アカウント削除（Issue #134 / App Store Guideline 5.1.1(v)）が成立しない。
--
-- スポットは全ユーザーの共有マスタなので、作成者が退会してもスポット自体は
-- 残す。作成者の紐付けだけを外す SET NULL が正しい挙動になる。
-- （列は NOT NULL ではないので SET NULL できる）
--
-- 制約名は Postgres の既定命名（<table>_<column>_fkey）。念のため
-- information_schema から実際の名前を引いて落とす形にしてある。

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'spots'
    AND con.contype = 'f'
    AND con.conkey = ARRAY[
      (SELECT attnum FROM pg_attribute
        WHERE attrelid = 'public.spots'::regclass AND attname = 'created_by_user_id')
    ]::smallint[];

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.spots DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.spots
  ADD CONSTRAINT spots_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
