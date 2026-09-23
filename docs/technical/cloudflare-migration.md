# Cloudflare 移行検討メモ

**作成日**: 2026-09-23
**配置先（想定）**: `docs/technical/cloudflare-migration.md`
**ステータス**: 調査結果。**これは契約書ではない**。Phase 1 の契約書は [`docs/issues/issue-227-r2-image-migration.md`](../issues/issue-227-r2-image-migration.md)。

> **2026-09-23 に実装側の確認を受けて訂正**（訂正箇所に「訂正」と付けた）: §2.7 アップロード認可の現状 / §2.7 公開範囲の「後退は無い」/ §2.7 消し残し / §2.8 無料枠の数え方。
> §2.4 の変更対象ファイル・§2.5 のスライス・§5 の未決事項は、契約書（#227）の方が正。

---

## 0. このドキュメントの前提

### 移さないと決めたもの（議論済み・再検討不要）

| 対象                                                            | 理由                                                                                                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase Auth**（Google Sign-In / Apple 認証）                | Cloudflare にエンドユーザー向け認証サービスが無い。Cloudflare Access は社内ツール用で代替にならない。`@supabase/supabase-js` がセッション管理・トークンリフレッシュを担っている恩恵が大きい |
| **Postgres / RLS / `supabase/migrations/` / `supabase/seeds/`** | 全テーブル RLS 有効・全国マスタデータあり。D1（SQLite）に移す旨みが無く、失うものが大きい                                                                                                   |
| **`delete-account` Edge Function**                              | `service_role` で Auth ユーザーと DB を横断削除する。Supabase 側にあるのが自然（※ただし §1 の影響を受ける。後述）                                                                           |
| **`extract-spot-info` Edge Function**                           | `stamp_id` 起点の単発呼び出しで、実行時間・CPU の問題が出ていない。動かす動機が無い                                                                                                         |
| **地図タイル**（`tiles.openfreemap.org/styles/positron`）       | 無料ホスト。現状維持                                                                                                                                                                        |

### 移行の方針

- **Supabase をやめる移行ではない**。Supabase が苦手な部分（重い画像処理・長時間バッチ）だけを Cloudflare に逃がす。
- Phase 1 と Phase 2 は**独立している**。Phase 1 だけやって止めてよい。
- 各 Phase は既存の `/build-feature` フロー（契約書 → TDD → 機械検証 → goshuin-evaluator → 人間ゲート → PR）に乗せる。

---

## 1. 結論サマリ

| #   | 対象                          | 現状                                                    | 移行先                               | 判定 | 優先度            |
| --- | ----------------------------- | ------------------------------------------------------- | ------------------------------------ | ---- | ----------------- |
| 1   | 御朱印画像の保管と配信        | Supabase Storage + `make-stamp-thumbnail`（自前で焼く） | **R2 + Cloudflare Images（変換）**   | 移す | **高**            |
| 2   | 限定御朱印クローラの定期実行  | `crawl-spot-sources` + `pg_cron` / `pg_net` / Vault     | **Workers + Cron Triggers + Queues** | 移す | 中                |
| 3   | Claude API 呼び出しの可観測性 | 直接 `api.anthropic.com` を叩く                         | **AI Gateway を挟む**                | 任意 | 低（#2 のついで） |

---

## 2. Phase 1 — 画像を R2 + Cloudflare Images に寄せる

### 2.1 現状の整理

```
[アプリ] expo-image-manipulator で JPEG 化・長辺 2048 に縮小 (toUploadableJpeg)
   ↓ upload
[Supabase Storage: goshuin-images]  <user>/<timestamp>-<rand>.jpg   ← 原本
   ↓ ensureStampVariants() を投げっぱなしで呼ぶ
[Edge Function: make-stamp-thumbnail]
   libheif-js(wasm) で HEIC 復号 → imagescript で resize → JPEG を2枚書き戻す
   <user>/thumb-400/<name>.jpg  (400px / q70)
   <user>/view-1200/<name>.jpg  (1200px / q78)
   ↓ getPublicUrl
[アプリ] 無ければ 404 → 原本にフォールバックして表示を続ける
```

関連: Issue #194 / #196。

### 2.2 なぜ移すか（痛点は実測ベースで記録されている）

`supabase/functions/make-stamp-thumbnail/thumbnail.ts` のコメントに残っている事実：

- `MAX_BAKES = 1` — 「HEIC の復号は重く、Edge Function の CPU 上限に当たると途中で殺される」
- 「1200px の符号化は 400px の約9倍の画素を扱うため、2枚に分けると大きい写真で予算を分け合って共倒れになる（**実測で 1.4MB 超が全滅した**）」
- 結果として「何度か呼べば端から順に埋まっていく」という**焼き溜め運用**になっており、直後は 404 → 原本フォールバックで重い画像を表示している

つまり「サーバー側で画像を焼く」こと自体が Edge Function の CPU 予算と根本的に相性が悪い。**Cloudflare Images は変換を URL パラメータで行うので、焼くという工程そのものが消える。**

加えて：

- **HEIC**: Cloudflare Images は HEIC 入力を公式サポートし、AVIF / WebP / JPEG / PNG に変換できる。現在は `toUploadableJpeg` で入口に蓋をしているが、`expo-image-manipulator` はネイティブモジュールなので読み込み失敗時に**原本 URI をそのまま返す**（= HEIC が上がりうる）。その保険が不要になる
- **配信フォーマット**: `format=auto` で AVIF / WebP を自動選択。現行は JPEG 固定なので、体感速度が素直に上がる
- **転送量**: R2 は egress 無料。Supabase Storage の無料枠（1GB）に対し R2 は 10GB-month 無料なので、保存容量の天井も上がる

### 2.3 移行後の形

```
[アプリ] toUploadableJpeg（据え置き）
   ↓ PUT（Worker 経由、または R2 presigned URL）
[R2: goshuin-images]  <user>/<timestamp>-<rand>.jpg   ← 原本のみ。バリアントは焼かない
   ↓
[Cloudflare Images 変換] https://<配信ドメイン>/cdn-cgi/image/width=400,quality=70,format=auto/<原本URL>
[アプリ] 常に 200。フォールバック不要
```

**設計上のポイント**

- `thumb-400` / `view-1200` という**ディレクトリ規約を廃止**し、`width=` パラメータに置き換える。
  `src/utils/stampThumb.ts` と `supabase/functions/make-stamp-thumbnail/thumbnail.ts` が「同じ規約を二重に持つ」問題（`stampThumb.ts` の ⚠ コメント参照）ごと消える。
- DB スキーマは**変更不要**。`stamps.image_path` の意味は「バケット内のパス」のまま。
- 「無ければ原本に落とす」フォールバックは不要になるが、**移行直後は残しておく**（旧 URL を見ている端末があるため）。削除は別スライスで。

### 2.4 変更対象ファイル

**書き換える**

| ファイル                                                                            | 変更内容                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/services/stamps.ts`                                                            | `uploadStampImage` / `getStampImageUrl` / `getStampThumbUrl` / `getStampViewUrl` / `deleteStampImage` を R2 経由に差し替え。`ensureStampVariants` は**削除** |
| `src/utils/stampThumb.ts`                                                           | `THUMB_DIR` / `VIEW_DIR` / `stampVariantPath` を削除し、`width` を受けて変換 URL を組む関数に置き換え                                                        |
| `src/hooks/useRecordForm.ts`                                                        | `ensureStampVariants` の呼び出しを削除                                                                                                                       |
| `src/screens/GalleryScreen.tsx` / `PrefectureDetailScreen.tsx` / `RecordScreen.tsx` | `ensureStampVariants` 呼び出しがあれば削除。URL 取得は関数シグネチャ次第で据え置き可                                                                         |
| `src/components/gallery/GoshuinchoFlipView.tsx`                                     | 同上                                                                                                                                                         |
| `src/components/spot-detail/SpotDetailContent.tsx` / `SpotThumbnailStrip.tsx`       | 同上                                                                                                                                                         |
| `supabase/functions/delete-account/index.ts`                                        | **重要**。`listImages` / `removeImages` が Supabase Storage を見ている。R2 のプレフィックス削除に差し替える                                                  |

**削除する**

- `supabase/functions/make-stamp-thumbnail/` 一式（`index.ts` 257行 / `thumbnail.ts` / テスト）

**新規**

- `workers/images/`（仮）— R2 への署名付きアップロード発行と、必要なら配信の認可を担う Worker
- `wrangler.jsonc`

**テスト（既存モックの追従が必要）**

`src/services/__tests__/stamps.test.ts`, `src/utils/__tests__/stampThumb.test.ts`,
`src/hooks/__tests__/useRecordForm.test.ts`, `src/screens/__tests__/{GalleryScreen,PrefectureDetailScreen,RecordScreen,SpotDetailScreen,MapScreen}.test.tsx`,
`src/components/gallery/__tests__/GoshuinchoFlipView.test.tsx`,
`src/components/spot-detail/__tests__/{SpotBottomSheet,SpotDetailContent,SpotThumbnailStrip}.test.tsx`,
`src/navigation/__tests__/{RootNavigator,TabNavigator}.test.tsx`

※ `thumb-400` / `view-1200` を文字列でモックしている箇所が多数ある。**機械的な置換で済むが件数は多い**。

### 2.5 移行手順（スライス案）

1. **R2 バケットを作り、既存画像をコピーする**
   `rclone` で Supabase Storage → R2。**原本のみコピーし、`thumb-400/` と `view-1200/` は捨てる**（変換で作れるため）。コピー後に件数を突き合わせる
2. **Cloudflare Images の変換を有効化し、URL を1枚手で叩いて確認する**（`width=400` / `format=auto` / HEIC 1枚）
3. **読み取り経路だけ先に差し替える**（`getStampThumbUrl` / `getStampViewUrl`）。書き込みは Supabase のまま。ここで表示が壊れないことを実機で確認
4. **書き込み経路を差し替える**（`uploadStampImage` / `deleteStampImage`）
5. **`delete-account` を R2 対応にする**
6. **`make-stamp-thumbnail` と `ensureStampVariants` を削除する**
7. Supabase Storage バケットを読み取り専用にして一定期間放置 → 問題なければ削除

**3 と 4 の間で一度止められる**こと（＝ロールバック可能な区切りがあること）が重要。

### 2.6 受入基準の素案

- AC-1: ギャラリー画面で御朱印のサムネイルが表示される（初回表示でも 404 フォールバックが発生しない）
- AC-2: 御朱印詳細画面で 1200px 相当の画像が表示される
- AC-3: 新規記録を保存した直後、ギャラリーに戻るとサムネイルが**即座に**表示される（焼き待ちが無い）
- AC-4: 記録を削除すると、R2 上の原本が削除されている
- AC-5: アカウント削除を実行すると、そのユーザーの R2 上の画像が**残らず**削除されている
- AC-6: `supabase/functions/make-stamp-thumbnail/` が存在しない
- Q-1〜3: `npm test` / `npm run lint` / `npm run typecheck` が通る

### 2.7 リスクと決め事

| 論点                            | 現状                                                                                                                                                                                                                                                                                                           | 判断                                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **画像の公開範囲**              | `getPublicUrl` を使っている＝公開バケット（migration `20260809000000` で `public = true` を確認済み）。パスを知っていれば誰でも見られる                                                                                                                                                                        | 読み取りは R2 公開バケット + Images 変換で同等。**（訂正）書き込みは R2 の方が厳しくなる**: 今は下の行のとおり他人のフォルダに書けるが、R2 では署名付き URL を `<user_id>/` 配下にしか出さない |
| **アップロードの認可**          | **（訂正）`<user>/` 配下に制限されていない**。INSERT ポリシー `Allow authenticated uploads`（migration `20260809000000:36-40`）がフォルダを見ず、PERMISSIVE ポリシーは OR で結合されるため、自分のフォルダに限る方のポリシーが無効になっている。ログイン済みなら誰でも他人のフォルダに書ける → #225 で先に直す | R2 には RLS が無い。**Worker で Supabase の JWT を検証し、`<user_id>/` 配下にだけ署名付き URL を出す**。ここを省略すると誰でも任意パスに書ける                                                 |
| **`delete-account` の消し残し** | **（訂正）コード上、消え残る**。`list(id)` は `thumb-400` / `view-1200` をフォルダ名として返すだけで、中の JPEG は消えない → #226 で先に直す                                                                                                                                                                   | R2 ではプレフィックス一括削除になるので、この問題ごと解消する。移行前に現状の消し残しの有無を確認し、あれば別 Issue に切る                                                                     |
| **旧 URL を握っている端末**     | 更新していないアプリが `thumb-400` の URL を叩く                                                                                                                                                                                                                                                               | Supabase Storage バケットを即削除しない。最低1リリース分は残す                                                                                                                                 |

### 2.8 コスト

- **R2**: 10GB-month の保管、Class A 100万 / Class B 1000万オペレーションが無料枠。**egress は常に無料**
- **Cloudflare Images（変換）**: 月 5,000 ユニーク変換まで無料。ユニーク変換は「画像 × パラメータの組み合わせ」で、同月内の再リクエストは1回として数える
  - 本アプリは 1画像あたり 2サイズ（400 / 1200）なので、**（訂正）その月に表示される画像が 2,500枚まで**なら無料枠に収まる。ユニーク変換は月ごとに数え直されるため、古い画像も表示されればその月にまた数えられる（旧記述「月あたり 2,500枚の新規画像まで」は誤り）
  - 超過分は 1,000 ユニーク変換あたり $0.50
- **注意**: Images の「Stored / Delivered」課金（$5 / 10万枚・$1 / 10万配信）は **Cloudflare Images のバケットに置いた場合**の料金。**原本を R2 に置いて変換だけ使う構成なら発生しない**。この構成を選ぶこと

---

## 3. Phase 2 — クローラを Workers + Cron Triggers + Queues に移す

### 3.1 現状の整理

```
[pg_cron] 週2回（火・金 02:00 / 02:30 JST）
   ↓ pg_net で自分の Edge Function を HTTP で叩く
   ↓ 認可: service_role_key を Supabase Vault から decrypted_secrets で引く
[Edge Function: crawl-spot-sources]  743行
   mode=web       → 公式サイト / RSS を最大20件クロール → Claude Haiku で限定御朱印を抽出
   mode=instagram → Meta Graph API business_discovery を最大25件 → Claude Haiku
   RUN_BUDGET_MS = 100_000 のソフト締切で、全部を1回の実行に詰め込む
```

### 3.2 なぜ移すか

**運用の複雑さ**が理由であって、今すぐ壊れているわけではない。

- **1回の実行に時間予算がある**という設計が本質的な制約になっている。`RUN_BUDGET_MS = 100_000` / `MAX_SOURCES_PER_RUN = 20` / `MAX_INSTAGRAM_SOURCES_PER_RUN = 25` は全部この制約から来ている。**クロール対象の寺社が増えると必ず頭打ちになる**
- 1件が遅いと後続が予算を食われる。リトライも実質「次回の実行まで待つ」しかない
- `pg_cron` + `pg_net` + Vault で「DB から自分を HTTP で叩く」構成になっており、`supabase/cron/schedule_crawl_spot_sources.sql` のコメント量がそのまま運用の難しさを表している（legacy JWT と `sb_secret_` の取り違えで認可ガードに一致しない、など）

**Cloudflare に移すと**

- **Cron Triggers**: `wrangler.jsonc` に cron 式を書くだけ。`pg_cron` / `pg_net` / Vault / service_role_key の DB 保存が**すべて不要**になる
- **Queues**: 「1ソース = 1メッセージ」で流せば、_1回の実行に予算がある_ という概念自体が消える。1件の失敗が他に波及せず、リトライも個別。`RUN_BUDGET_MS` / `MAX_SOURCES_PER_RUN` を削除できる
- **Secrets**: `wrangler secret put` で Worker 側に置く。DB に鍵を置かなくてよくなる

### 3.3 移行後の形

```
[Cron Trigger] 火・金 02:00 JST  → producer Worker
   ↓ 対象 source を Supabase から SELECT（service key は Worker の Secret）
   ↓ 1ソース = 1メッセージで Queue に enqueue
[Queue: crawl-sources]
   ↓ consumer Worker（1メッセージ = 1ソース）
   ↓ fetch → htmlToText → Claude Haiku → normalize → Supabase に書き戻し
   ↓ 失敗したメッセージだけ自動リトライ（→ Dead Letter Queue）
```

### 3.4 変更対象ファイル

| ファイル                                                         | 行数 | 扱い                                                                               |
| ---------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `supabase/functions/crawl-spot-sources/index.ts`                 | 743  | producer / consumer に**分割**して Workers に移植                                  |
| `supabase/functions/_shared/crawl.ts`                            | 205  | 純粋関数が中心。**ほぼ無改修で移植可**                                             |
| `supabase/functions/_shared/instagram.ts`                        | 224  | 同上                                                                               |
| `supabase/functions/_shared/crawl_test.ts` / `instagram_test.ts` | —    | Deno test → Vitest（Workers 側）に移植                                             |
| `supabase/cron/schedule_crawl_spot_sources.sql`                  | —    | **削除**。ただし Meta トークン更新手順のドキュメントは移設先を確保すること（後述） |

### 3.5 書き換えのポイント

| Deno / Edge Function                                       | Workers                                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Deno.serve(async req => ...)`                             | `export default { async fetch(req, env, ctx) {...}, async scheduled(event, env, ctx) {...}, async queue(batch, env) {...} }` |
| `Deno.env.get('X')`                                        | `env.X`                                                                                                                      |
| `import ... from 'https://esm.sh/@supabase/supabase-js@2'` | `npm i @supabase/supabase-js` して通常 import                                                                                |
| SSRF ガード付き `fetchWithTimeout`                         | `fetch` + `AbortSignal.timeout()` でそのまま動く。**ガードのロジックは変えないこと**                                         |
| `RUN_BUDGET_MS` によるソフト締切                           | **削除**。1メッセージ1ソースなので不要                                                                                       |
| `MAX_SOURCES_PER_RUN`                                      | producer 側の SELECT 件数に移す（当面は同じ値で）                                                                            |

### 3.6 やらないこと・変わらないこと

- **Meta アクセストークンの 60日手動更新は解消しない**。これは Meta 側の制約（紐づく Facebook ページが無いためページトークンを発行できない、2026-09-21 調査済み）。`schedule_crawl_spot_sources.sql` を削除する際、**トークン更新手順のコメントは必ずどこかに移設すること**（`docs/technical/` 配下など）。ここが唯一の正のドキュメントになっている
- **Supabase への読み書きは残る**。Workers から Supabase REST を叩く形になり、DB 内から叩くより latency は増えるが、週2回のバッチなので実用上の影響は無い
- **抽出ロジック・プロンプトは一切変えない**。移行と改善を同じ PR に混ぜないこと

### 3.7 受入基準の素案

- AC-1: Cron Trigger が火・金 02:00 / 02:30 JST に発火する（`wrangler tail` で確認）
- AC-2: `mode=web` の実行で、対象ソース数ぶんの Queue メッセージが enqueue される
- AC-3: 1ソースの処理が失敗しても、同バッチの他ソースは完了する
- AC-4: `dry_run` 相当の経路で Claude API が呼ばれず、`last_crawled_at` だけが更新される
- AC-5: `pg_cron` の 2 ジョブが unschedule され、Vault の `service_role_key` が不要になっている
- AC-6: `_shared/crawl.ts` / `_shared/instagram.ts` の既存テストが移植先で全て通る

### 3.8 コスト

Workers 無料枠は 10万リクエスト/日。週2回のバッチなので**誤差**。Queues は Workers 有料プラン（$5/月）が必要な点だけ注意。Phase 2 に進む場合はここが実質の判断材料になる。

---

## 4. Phase 3（任意）— AI Gateway

`crawl-spot-sources` と `extract-spot-info` が `api.anthropic.com` を直接叩いている。Workers 移行のついでに AI Gateway を挟むと、追加コストなしで以下が付く。

- 全リクエスト / レスポンスのログ（現在は `console.log` の断片しか無い）
- 同一プロンプトのキャッシュ
- レート制限とリトライ

Phase 2 の中でやるなら、**エンドポイント URL を差し替えるだけ**なので数行。単独でやる価値は薄い。

---

## 5. 人間が決めること（実装前に確定させる）

1. **Phase 1 だけやるか、Phase 2 まで行くか**
   → Phase 2 は Workers 有料プラン（$5/月）が実質前提。Phase 1 は無料枠で収まる
2. **`goshuin-images` バケットは本当に public か**
   → `getPublicUrl` の使用からそう読めるが、Supabase ダッシュボードで確認すること。private だった場合、Phase 1 の設計（配信経路）が変わる
3. **Cloudflare の配信ドメインをどうするか**
   → 既存の独立ドメインを使うか、新規に取るか
4. **Workers のコードをこのリポジトリに同居させるか、別リポジトリにするか**
   → Expo アプリと Worker が同居するとビルド設定が複雑になる。`workers/` サブディレクトリに置いて `.easignore` で除外するのが無難だが、要判断

---

## 6. 参考

- [Choosing a data or storage product · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/storage-options/)
- [HEIC support · Cloudflare changelog](https://developers.cloudflare.com/changelog/heic-support/)
- [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/)
- [Transform images · Cloudflare Images docs](https://developers.cloudflare.com/images/image-resizing/format-limitations/)
