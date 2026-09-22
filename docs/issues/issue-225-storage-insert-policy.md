# Issue #225: 他人のフォルダに画像を書き込めるポリシーを削除する

## 概要

`goshuin-images` バケットの INSERT ポリシーのうち、フォルダを見ない `"Allow authenticated uploads"` を削除する。

PERMISSIVE ポリシーは OR で結合されるため、このポリシーがあると `"Users can upload own goshuin images"`（`auth.uid()` = 先頭フォルダ）の制限が効かず、**ログイン済みなら誰でも他人の `<user_id>/` 配下に書き込める**。バケットは public なので、書き込まれた画像は誰でも読める。

Cloudflare 移行（#227）とは混ぜない。#226（退会ユーザーの縮小版の消し残り）はこの Issue の後。

## 関連ドキュメント

- 経緯: [`docs/issues/issue-227-r2-image-migration.md`](./issue-227-r2-image-migration.md)「前提」「先行 Issue」
- ポリシーの写経元: `supabase/migrations/20260809000000_create_goshuin_images_bucket.sql:36-40`
- migration の本番適用手順: `.claude/harness/progress.md` 2026-08-11（`db push` は使えない。`db query --linked -f` → `migration repair --status applied`）

## 本番の現状（2026-09-23 確認）

| 確認                                                                                    | 結果                                                                                                                                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pg_policies`（storage.objects）                                                        | 契約時点の migration と一致。INSERT は `"Allow authenticated uploads"`（`{authenticated}`・`bucket_id` のみ）と `"Users can upload own goshuin images"` の2本 |
| `supabase/validation/storage_upload_isolation.sql`（修正前）                            | `RESULT own=allowed other=allowed` — **他人のフォルダに書ける**                                                                                               |
| 同スクリプトを、先頭で `DROP POLICY` してから実行（ブロックごとロールバック）           | `RESULT own=allowed other=denied`                                                                                                                             |
| 他人のフォルダ配下に置かれたオブジェクト（`owner` / `owner_id` が先頭フォルダと不一致） | **0件**（186件中。持ち主の無い124件は service role が焼いた縮小版）                                                                                           |
| 先頭フォルダが `auth.users` に存在しないオブジェクト                                    | 0件                                                                                                                                                           |

→ 穴は開いていたが、**悪用された痕跡は無い**。既存オブジェクトの掃除は不要。

照合に使ったクエリ:

```sql
select
  count(*) as total,
  count(*) filter (where coalesce(owner_id, owner::text) is null) as no_owner,
  count(*) filter (where coalesce(owner_id, owner::text) is not null
                     and coalesce(owner_id, owner::text) <> (storage.foldername(name))[1]) as owner_folder_mismatch,
  count(*) filter (where not exists (select 1 from auth.users u
                     where u.id::text = (storage.foldername(name))[1])) as folder_without_user
from storage.objects where bucket_id = 'goshuin-images';
```

⚠ `owner` が NULL の行（service role の書き込み）は、この照合では持ち主を判定できない。service role を持つのは Edge Function だけで、どちらも `getUser()` で得た id のフォルダにしか書かない。

## 詳細設計

### 対象ファイル

| ファイル                                                                        | 変更                                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/20260923000000_drop_goshuin_images_open_insert_policy.sql` | 新規。`DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;`                                                                                                      |
| `supabase/validation/storage_upload_isolation.sql`                              | 新規。authenticated ロール + JWT の sub で自分/他人のフォルダへ INSERT を試し、結果を `RAISE EXCEPTION` のメッセージで返す（**必ずロールバックする**ので本番に流しても何も残らない） |

アプリのコード・Edge Function は変えない。

### 実装方針

- 落としても困る呼び出し元は無い: アプリのアップロードは常に `${userId}/...`（`src/services/stamps.ts` `uploadStampImage`）、`make-stamp-thumbnail` / `delete-account` は service role で RLS を通らない
- 20260809000000 は書き換えない（適用済みの migration は触らない）。後ろの migration で落とす
- 本番適用は `db query --linked -f <migration>` → `migration repair --status applied 20260923000000`

## テスト方針

アプリのユニットテストでは RLS を検証できない（Jest は Supabase をモックしている）。代わりに **本番に対して、巻き戻す前提の検証 SQL を流す**。

- Red: 修正前の本番で `other=allowed` になることを確認（済み）
- Green: migration 適用後に `own=allowed other=denied` になること

## 受入基準（Acceptance Criteria）

### 機能基準

- [ ] AC-1: 本番で `supabase/validation/storage_upload_isolation.sql` を実行すると、エラーメッセージが `RESULT own=allowed other=denied` になる
- [ ] AC-2: 本番の `pg_policies` に `"Allow authenticated uploads"` が無い（`select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname='Allow authenticated uploads'` が 0）
- [ ] AC-3: 本番の `pg_policies` に `"Users can upload own goshuin images"`（INSERT）・`"Allow public read"`（SELECT）・`"Users can update own goshuin images"`・`"Users can delete own goshuin images"` が残っている
- [ ] AC-4: AC-1 の実行後、本番の `storage.objects` に `name like '%/isolation-check.jpg'` の行が 0 件（検証 SQL が何も残さない）
- [ ] AC-5: 本番の migration 履歴（`supabase_migrations.schema_migrations`）に `20260923000000` が記録されている
- [ ] AC-6: 実機（v1.1.0 以降のビルド）で御朱印を1枚記録でき、御朱印帳タブに画像つきで表示される（自分のフォルダへのアップロードが引き続き通る）（native-only）

### 品質基準

- [ ] Q-1: 全テストが通る（npm test）
- [ ] Q-2: Lint エラーがない（npm run lint）
- [ ] Q-3: 型エラーがない（npm run typecheck）

## 注意事項

- ロールバックが必要なら、20260809000000 の該当 `CREATE POLICY` を流せば戻る（ただし穴も戻る）
- 検証 SQL は `SET LOCAL ROLE authenticated` を使うので、`db query --linked` のログインロールが authenticated のメンバーである必要がある（2026-09-23 時点で実行できることを確認済み）
