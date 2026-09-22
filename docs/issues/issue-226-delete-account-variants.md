# Issue #226: アカウント削除で御朱印の縮小版（thumb-400 / view-1200）が消え残る

## 概要

`delete-account` の `listImages` は `storage.list(userId)` で `<user_id>/` の**直下しか見ていない**。
縮小版（#194 / #196）は `<user_id>/thumb-400/` と `<user_id>/view-1200/` にあり、`list()` はこれらを**フォルダ名として1件ずつ返すだけ**なので、`remove()` に渡るのは存在しない `<user_id>/thumb-400` になり、中の JPEG は公開 URL のまま残る。

サブフォルダの中まで降りて列挙するように直す。あわせて、縮小版を含めると削除対象が御朱印1枚あたり3ファイルになり `remove()` の1回あたりの上限（1000件）を超えうるので、1000件ずつに分けて消す。

前提: #225（他人のフォルダに書けるポリシーの削除）。フォルダ名で持ち主を判定する照合は、他人のフォルダに書けない状態でないと信用できない。
Cloudflare 移行（#227）とは混ぜない。

## 関連ドキュメント

- アカウント削除の元契約書: [`docs/issues/issue-134-account-deletion.md`](./issue-134-account-deletion.md)
- 経緯: [`docs/issues/issue-227-r2-image-migration.md`](./issue-227-r2-image-migration.md)「前提」「先行 Issue」
- Edge Function の本番デプロイと 401 確認の手順: `.claude/harness/progress.md` 2026-08-11

## 本番の現状（2026-09-23 確認）

| 確認                                                                             | 結果                             |
| -------------------------------------------------------------------------------- | -------------------------------- |
| `goshuin-images` のオブジェクト                                                  | 186件。うち縮小版 124件          |
| 先頭フォルダが `auth.users` に存在しないオブジェクト（＝退会ユーザーの消し残し） | **0件**（縮小版の消し残しも0件） |

→ 縮小版の導入後に退会したユーザーがまだいないため、**実害はまだ出ていない**。次の退会から消え残る状態だった。既存データの掃除は不要。

照合クエリ（#225 の契約書と同じもの）:

```sql
select count(*) from storage.objects o
where o.bucket_id = 'goshuin-images'
  and not exists (select 1 from auth.users u where u.id::text = (storage.foldername(o.name))[1]);
```

## 詳細設計

### 対象ファイル

| ファイル                                                  | 変更                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/delete-account/deleteAccount.ts`      | `collectImageNames(listPage, userId, pageSize)` を追加。`id: null`（フォルダ）の中へ降り、userId からの相対パス（`thumb-400/a.jpg`）で返す。ページ送り・途中失敗時の「集めた分 + error」は従来どおり。`deleteAccountForUser` の削除を1000件ずつに分割 |
| `supabase/functions/delete-account/index.ts`              | `listImages` を `collectImageNames` + `admin.storage.list(prefix, { limit, offset })` に差し替え                                                                                                                                                      |
| `supabase/functions/delete-account/deleteAccount_test.ts` | 下記テストを追加                                                                                                                                                                                                                                      |

アプリのコード・DB は変えない。削除の順序（画像 → spots → auth ユーザー）も変えない。

### 実装方針

- ディレクトリ名（`thumb-400` / `view-1200`）を delete-account に持たせない。**フォルダなら降りる**だけにしておけば、置き場所の規約が変わっても（#227 で R2 に移る等）消し残らない
- 列挙の再帰とページ送りは純関数 `collectImageNames` に寄せ、Deno テストで固定する（`index.ts` は Storage の呼び出しを渡すだけ）

## テスト方針

`deleteAccount_test.ts`（Deno）に追加:

- サブフォルダの中まで降りて、`a.jpg` / `thumb-400/a.jpg` / `view-1200/a.jpg` を返す
- フォルダ名そのもの（`thumb-400`）は削除対象に入れない
- ページサイズに達している間は、ルートでもサブフォルダでも offset を進めて読み切る
- サブフォルダの一覧に失敗しても、集めた分と error を返す（→ 取れた分は消し、warnings に載る）
- 1000件を超える削除対象は 1000 / 1000 / 1 に分けて `removeImages` を呼ぶ

## 受入基準（Acceptance Criteria）

### 機能基準

- [ ] AC-1: `collectImageNames` が、ルート直下のファイルとサブフォルダ内のファイルを `a.jpg` / `thumb-400/a.jpg` / `view-1200/a.jpg` の形ですべて返し、フォルダ名そのものは返さない（Deno テスト）
- [ ] AC-2: `collectImageNames` が、ルートとサブフォルダの両方でページサイズを超える件数を読み切る（Deno テスト）
- [ ] AC-3: サブフォルダの一覧に失敗したとき、`collectImageNames` はそれまでに集めた names と error を返し、`deleteAccountForUser` は集めた分を消したうえで warnings に `画像の一覧取得に失敗: …` を載せ、アカウント削除は続行する（Deno テスト）
- [ ] AC-4: 削除対象が 2001 件のとき、`removeImages` が 1000 / 1000 / 1 件の3回に分けて呼ばれる（Deno テスト）
- [ ] AC-5: `index.ts` の `listImages` が `collectImageNames` を使っている（`list(id, …)` の直下だけを読む実装が残っていない）
- [ ] AC-6: 本番に `delete-account` を再デプロイしたあと、progress.md 2026-08-11 の4パターン（ヘッダ無し / でたらめな Bearer / ボディに他人の user_id でヘッダ無し / anon キーを Bearer）がすべて `HTTP 401` `{"success":false,"error":"ログインが必要です"}` を返す
- [ ] AC-7: 本番で、縮小版まで焼かれた御朱印を1枚以上持つテスト用アカウントを削除すると、そのユーザーの `<user_id>/` 配下（`thumb-400/` `view-1200/` を含む）の `storage.objects` が 0 件になる（native-only・要テスト用アカウント）

### 品質基準

- [ ] Q-1: 全テストが通る（npm test）
- [ ] Q-2: Lint エラーがない（npm run lint）
- [ ] Q-3: 型エラーがない（npm run typecheck）
- [ ] Q-4: `deno test supabase/functions/delete-account/` が通り、`deno check supabase/functions/delete-account/index.ts` がエラー無し

## 注意事項

- Edge Function のデプロイはアプリのビルドと無関係（アプリ側の変更なし）。`npx supabase@latest functions deploy delete-account --project-ref tvnozkpxncmnehyomoff --use-api --no-verify-jwt`
- **再デプロイしたら毎回 AC-6 の 401 確認をやる**（`verify_jwt = false` のため、関数内の `getUser()` が唯一の防衛線）
