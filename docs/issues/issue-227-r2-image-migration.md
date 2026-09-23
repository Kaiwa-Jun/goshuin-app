# Issue #227: 御朱印画像を R2 + Cloudflare Images に移す（Phase 1）

> **着手条件: #225（他人のフォルダに書けるポリシーの削除）と #226（退会ユーザーの縮小版の消し残り）が完了してから**。

## 概要

御朱印画像の保管と配信を、Supabase Storage + 自前の縮小（`make-stamp-thumbnail`）から、**R2（保管）+ Cloudflare Images（URL パラメータで変換）** に移す。
「焼く」工程をなくして、Edge Function の CPU 上限による焼き溜め運用（`MAX_BAKES = 1`、直後は 404 → 原本フォールバック）を終わらせる。

- **Supabase をやめる移行ではない**。Auth / Postgres / RLS / `delete-account` / `extract-spot-info` は Supabase に残す
- **DB スキーマは変えない**。`stamps.image_path` は「バケット内のパス」（`<user_id>/<timestamp>-<rand>.jpg`）のまま。R2 でも同じキーで置く
- **Supabase Storage バケットはこの Issue では消さない**。旧バージョンのアプリが `thumb-400` / `view-1200` / 原本の URL を叩き続けるため
- Phase 2（クローラの Workers 移行）と Phase 3（AI Gateway）は扱わない

この契約書は [`docs/technical/cloudflare-migration.md`](../technical/cloudflare-migration.md)（検討メモ）§2 を入力に、**2026-09-23 時点の develop（`1fb407b`）の実装を読んで**切り直したもの。メモとの差分は末尾「メモからの変更点」にまとめた。

## 関連ドキュメント

- 検討メモ: [`docs/technical/cloudflare-migration.md`](../technical/cloudflare-migration.md) §2 / §5
- 縮小版の導入: Issue #194（一覧のサムネイル）/ #196（HEIC・見る用 1200px）
- アカウント削除: [`docs/issues/issue-134-account-deletion.md`](./issue-134-account-deletion.md)
- バケットとポリシーの現状: `supabase/migrations/20260809000000_create_goshuin_images_bucket.sql`
- プライバシーポリシー: `docs/legal/privacy.html`（アプリ内は `src/screens/PrivacyPolicyScreen.tsx`）

## 前提（コードで確認済み・2026-09-23）

| 項目                     | 事実                                                                                                                                                                                                                                                                                                                    | 根拠                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| バケットの公開範囲       | **public**。読み取りは `TO public`。アプリは認証ヘッダ無しの `getPublicUrl` の URL を RN `Image` に渡しており、private なら全画像が出ない                                                                                                                                                                               | migration `:16` `public = true`、`:30-33`、`src/services/stamps.ts:160`                                  |
| アップロードの制限       | **`<user>/` 配下に制限されていない**。INSERT ポリシーが2本あり、`"Allow authenticated uploads"` はフォルダを見ない。ポリシーは OR なので、ログイン済みなら誰でも他人のフォルダに書ける                                                                                                                                  | migration `:36-40`                                                                                       |
| アカウント削除の消し残り | **消し残る経路になっている**（現に残っているかは照合クエリで未確認）。`list(id)` は `<id>/` 直下しか返さず、`thumb-400` / `view-1200` はフォルダ名として返る。`remove()` に渡るのは存在しない `<id>/thumb-400` で、中の JPEG は公開 URL のまま残るはず。2026-08-11 の実機検証で 0 件だったのは縮小版（#194/#196）導入前 | `supabase/functions/delete-account/index.ts:66`、`deleteAccount.ts:59-61`                                |
| 縮小版の規約             | `stampThumb.ts` と `make-stamp-thumbnail/thumbnail.ts` が同じディレクトリ規約を二重に持つ                                                                                                                                                                                                                               | `src/utils/stampThumb.ts:1-10`                                                                           |
| 既存の原本               | 古い記録は **HEIC の中身に `.jpg` の名前**で入っている（#196 以前）。`toUploadableJpeg` は変換失敗時に元の URI を返すので、今も HEIC が上がりうる                                                                                                                                                                       | `make-stamp-thumbnail/index.ts:8-10`、`src/utils/toUploadableJpeg.ts`                                    |
| 404 フォールバック       | 一覧（`GalleryScreen` / `PrefectureDetailScreen` の `thumbMissing`）と全画面（`ImageGalleryModal` の `fallbackUrl`）が、縮小版が無ければ `getStampImageUrl`（Supabase の原本）に落とす                                                                                                                                  | `GalleryScreen.tsx:82,199,321`、`PrefectureDetailScreen.tsx:52,124-131`、`ImageGalleryModal.tsx:120,151` |
| 強制アップデート         | 仕組みが無い。旧バージョンの端末はいつまでも Supabase Storage を読み書きし続けうる                                                                                                                                                                                                                                      | `minimumVersion` 等の実装無し                                                                            |
| 独自ドメイン             | 無い（ポリシー類は `kaiwa-jun.github.io`）                                                                                                                                                                                                                                                                              | `docs/project/store-metadata.md`                                                                         |

### 先行 Issue（別 Issue として切った。Phase 1 の前に片付ける）

Phase 1 のあいだも Supabase バケットは最低1リリース残るので、次の2つは**移行を待たずに Supabase 側で直す**。

1. **#226 退会ユーザーの縮小版が消えない**: `delete-account` の `listImages` で `<id>/thumb-400` と `<id>/view-1200` も列挙して消す。既に消し残っている分があるかは、`progress.md` 2026-08-11 の照合クエリ（`storage.objects` のうち `auth.users` に持ち主がいないもの）で洗い出し、あれば消す
2. **#225 他人のフォルダに書ける**: `"Allow authenticated uploads"` ポリシーを落とす（`make-stamp-thumbnail` は service role なので RLS を通らず、影響しない）

## 詳細設計

### 移行後の形

```
[アプリ] toUploadableJpeg（据え置き）
   ↓ アップロード（認可付きの経路。方式は「判断が要る点 D-1」）
[R2: goshuin-images]  <user_id>/<timestamp>-<rand>.jpg   ← 原本のみ。縮小版は置かない
   ↓
[Cloudflare Images の変換]  https://<独自ドメイン>/cdn-cgi/image/width=400,quality=70,format=webp/<user_id>/<name>.jpg
[アプリ] 表示
```

- 見る大きさは **2つだけ**（一覧 = 400 / 詳細・全画面 = 1200）。今の `thumb-400` / `view-1200` と同じ幅・品質
- **原本をそのまま表示に使うのをやめる**。書き込み切替（S4b）で、原本の URL を直接表示している4箇所（`RecordScreen:206` / `GoshuinchoFlipView:242` / `SpotDetailContent` / `SpotThumbnailStrip`）を `getStampViewUrl`（1200 の変換）に替える。原本は HEIC の可能性があり（Android・Web で出ない）、変換を通せば必ず表示できる形式になる。表示用の変換も2種類のままで済む（無料枠の計算が変わらない）
- **`getStampImageUrl` は S5 まで Supabase の原本を返し続ける**。これは一覧・全画面のフォールバック先で、旧アプリが Supabase にだけ上げた画像を新アプリで出すための唯一の経路になる

### スライス

**原則: Supabase Storage は S4 まで「完全な正」であり続ける**。読み取りを先に切り替え、書き込みは二重化してから切り替える。
**戻れなくなるのは S4 だけ**で、そこは明示的なゲートにする。

| #   | スライス                          | 変更                                                                                                                                                                                                                                                                                               | 戻し方                                                                                                                                       |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **土台**（アプリ無変更）          | R2 バケット（CORS 設定込み）、独自ドメイン（取得はユーザー）と変換の有効化、署名付き URL を出す Edge Function（D-1）。HEIC の原本1枚を手で変換 URL に通して確認                                                                                                                                    | アプリに影響なし                                                                                                                             |
| S2  | **プライバシーポリシー更新**      | `docs/legal/privacy.html` と `PrivacyPolicyScreen` の保存先・第三者に Cloudflare を追加。**ユーザーデータを Cloudflare に置く最初のスライス（S3）より前にリリース・公開する**                                                                                                                      | 文言を戻す                                                                                                                                   |
| S3  | **二重書き込み + 既存分のコピー** | `uploadStampImage`: Supabase に上げた後（**失敗したら今までどおりエラー**）、同じキーで R2 にも上げる（R2 の失敗は警告だけで記録は続行）。`deleteStampImage` / `delete-account`: **両方**から消す。既存の原本を Supabase → R2 にコピーするスクリプト（縮小版はコピーしない、何度流しても同じ結果） | `src/services/stamps.ts` と `delete-account` を戻す。Supabase は完全なまま                                                                   |
| S4a | **読み取り切替（縮小版だけ）**    | `getStampThumbUrl` / `getStampViewUrl` を変換 URL に。**`getStampImageUrl`（フォールバック先）は Supabase の原本のまま**。`ensureStampVariants` の呼び出しを削除（新しいアプリはもう縮小版を読まない）                                                                                             | **S4a のコミットを revert するだけ**。書き込みは二重なので失うものがない                                                                     |
| S4b | **書き込み切替** ⚠️ ゲート        | `uploadStampImage` を R2 のみに。原本を直接表示している4箇所を `getStampViewUrl` に。**`getStampImageUrl`（フォールバック先）は Supabase のまま**。削除は引き続き**両方**（旧アプリが Supabase に上げた分があるため）                                                                              | **ここから先は戻すと新しい画像が Supabase に無い**。戻すなら R2 → Supabase の逆コピーが要る。S4a を実機・本番で1リリース以上運用してから入る |
| S5  | **後片付け**（別 Issue でもよい） | `make-stamp-thumbnail/` 一式、`config.toml` の該当節、`scripts/bake-stamp-variants.sh` を削除。Supabase バケットを**読み取り専用にする（削除しない）**。`getStampImageUrl` と一覧・全画面のフォールバックは旧アプリ由来の画像のために**残す**                                                      | 読み取り専用を解けば戻る。バケット削除は 1GB を超えたときに再検討（D-4）                                                                     |
| S6  | **`format=auto` に切り替え**      | 変換 URL の `format=webp` を `format=auto` に                                                                                                                                                                                                                                                      | S4a が本番で安定してから（D-5）。`format=webp` に戻すだけ                                                                                    |

- **S3 → S4a の間**: コピー後に旧アプリが Supabase にだけ上げた画像は R2 に無い。新アプリは変換 URL が 404 → `thumbMissing` / `fallbackUrl` で Supabase の原本に落ちるので表示は続く。**フォールバックを S5 まで Supabase に向けておくのはこのため**（S4b 以降も、旧アプリは Supabase にだけ上げ続ける）。コピーのスクリプトは S4b の直前にもう一度流す
- **`delete-account` は S3 で両方対応にする**（メモでは書き込み切替の後だった）。R2 に上がった画像があるのに `delete-account` が Supabase しか見ていない期間を作らない

### 対象ファイル

| ファイル                                                                                                       | スライス       | 変更                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/stamps.ts`                                                                                       | S3 / S4a / S4b | `uploadStampImage` / `deleteStampImage` / `getStampThumbUrl` / `getStampViewUrl`。`ensureStampVariants` は S4a で削除（**呼び出しは2箇所**: `useRecordForm.ts:237` / `GalleryScreen.tsx:102`）。`getStampImageUrl` は変えない（S5 まで Supabase のフォールバック先）                    |
| `src/utils/stampThumb.ts`                                                                                      | S4a / S5       | 変換 URL を組む関数を追加（S4a）、ディレクトリ規約を削除（S5）                                                                                                                                                                                                                          |
| `src/hooks/useRecordForm.ts`                                                                                   | S4a            | `:237` の `ensureStampVariants` 呼び出しを削除（アップロードは `:198`、関数の差し替えだけで済む）                                                                                                                                                                                       |
| `src/hooks/useStampDetail.ts`                                                                                  | S3 / S4b       | **メモの一覧に無い**。写真の差し替えで `uploadStampImage`（`:74`）と `deleteStampImage`（`:85`, `:94`）を呼ぶ。関数の中身が変わるだけで呼び出しは据え置きだが、テストで経路を見る                                                                                                       |
| `src/screens/GalleryScreen.tsx`                                                                                | S4a / S5       | `:102` の `ensureStampVariants` を削除（S4a）、`thumbMissing` を削除（S5）                                                                                                                                                                                                              |
| `src/screens/PrefectureDetailScreen.tsx`                                                                       | S5             | `thumbMissing` を削除。**`ensureStampVariants` は呼んでいない**（メモの記述は誤り）                                                                                                                                                                                                     |
| `src/components/common/ImageGalleryModal.tsx`                                                                  | S5             | **メモの一覧に無い**。`fallbackUrl` の仕組みを持っている本体                                                                                                                                                                                                                            |
| `src/screens/RecordScreen.tsx` / `GoshuinchoFlipView.tsx` / `SpotDetailContent.tsx` / `SpotThumbnailStrip.tsx` | S4b            | `getStampImageUrl` → `getStampViewUrl` に差し替え（`RecordScreen:206`、`GoshuinchoFlipView:242`、`SpotDetailContent:97,103,144,155`、`SpotThumbnailStrip:66`）。`ensureStampVariants` はどれも呼んでいない                                                                              |
| `supabase/functions/delete-account/index.ts` / `deleteAccount.ts`                                              | S3             | R2 の `<user_id>/` 配下も消す。R2 には「プレフィックスごと消す」API は無いので、**区切り文字なしで列挙（配下すべて）→ 最大1000件ずつ削除**。R2 へは S3 互換 API で直接アクセスする（D-1）。順序は今と同じく「画像 → spots → auth ユーザー」（ユーザーのトークンが生きているうちに消す） |
| `supabase/functions/make-stamp-thumbnail/`（`index.ts` / `thumbnail.ts` / テスト）                             | S5             | 削除                                                                                                                                                                                                                                                                                    |
| `supabase/config.toml` `:14-19`                                                                                | S5             | **メモの一覧に無い**。`[functions.make-stamp-thumbnail]` の節を削除                                                                                                                                                                                                                     |
| `scripts/bake-stamp-variants.sh`                                                                               | S5             | **メモの一覧に無い**。Supabase の URL 直書きで縮小版を焼く運用スクリプト。削除                                                                                                                                                                                                          |
| `docs/legal/privacy.html` / `src/screens/PrivacyPolicyScreen.tsx`                                              | S2             | **メモに無い**。`:176-193` が「画像は Supabase Storage に保存」「第三者は Supabase のみ」と書いている                                                                                                                                                                                   |
| 新規: コピースクリプト（`scripts/` 配下）                                                                      | S3             | Supabase → R2。DB の `stamps.image_path` を正として、足りないキーだけコピー                                                                                                                                                                                                             |
| 新規: 署名付き URL を出す Edge Function                                                                        | S1             | `supabase/functions/` 配下（D-1）。アップロード用（キーは関数が `<user_id>/` で決める）と削除用（`<user_id>/` 配下のキーだけ受け付ける）。`config.toml` に節を足す（`verify_jwt = false` にするなら本人確認は関数内の `getUser()` が唯一の防衛線）                                      |

**テストの追従**（`thumb-400` / `view-1200` / 画像関数をモックしている箇所。メモの一覧は正しかったが2つ足りない）:
`src/services/__tests__/stamps.test.ts`, **`stamps-create.test.ts`**, **`stamps-upload-native.test.ts`**, `src/utils/__tests__/stampThumb.test.ts`,
`src/hooks/__tests__/useRecordForm.test.ts`, `useStampDetail.test.ts`,
`src/screens/__tests__/{GalleryScreen,PrefectureDetailScreen,RecordScreen,SpotDetailScreen,MapScreen}.test.tsx`,
`src/components/gallery/__tests__/GoshuinchoFlipView.test.tsx`,
`src/components/spot-detail/__tests__/{SpotBottomSheet,SpotDetailContent,SpotThumbnailStrip}.test.tsx`,
`src/navigation/__tests__/{RootNavigator,TabNavigator}.test.tsx`,
`supabase/functions/delete-account/deleteAccount_test.ts`

⚠️ `stamps-upload-native.test.ts` は「RN の fetch / FormData でアップロードが壊れる」回帰（Issue #118）を再現するためのテスト。**R2 への経路でも同じ種類の再現テストを作る**。消して置き換えない。

### 注意（実装者向け）

- 変換 URL は `/cdn-cgi/image/...` 形式で、**独自ドメイン（Cloudflare のゾーン）経由で使う**（D-2）。r2.dev は使わない
- 形式は `format=webp` 固定（D-5）。アプリは RN 標準の `Image`（`expo-image` は未導入）。`format=auto` にする S6 では、RN の `Accept` ヘッダと Android での AVIF 表示を実機で確認する
- 無料枠（月 5,000 ユニーク変換）は「**その月に表示された画像 × 2サイズ**」で数える（ユニーク変換は月ごとに数え直される。[Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) の unique transformation の定義で S1 のときに確認すること）。メモの「月 2,500 枚の**新規**画像まで」は誤りで、古い画像も月が変われば数え直される。つまり**月に表示される画像が 2,500 枚を超えると課金**が始まる（超過 1,000 変換あたり $0.50）

## テスト方針

- `src/services/stamps.ts` の各関数は、スライスごとに「どこへ書き・どこを読み・どこを消すか」をテストで固定する（S3: 両方に書く / R2 の失敗で記録が止まらない / Supabase の失敗は今までどおりエラー、など）
- 署名付き URL を出す Edge Function は、**他人の `<user_id>/` を指定したとき・トークン無し・期限切れトークンで拒否する**ことを単体テストで固定する（ここを省略すると誰でも任意パスに書ける）
- `deleteAccount_test.ts` に「R2 の列挙がページをまたぐ（1000件超）」「R2 の削除に失敗してもアカウント削除は続行し warnings に載る」を足す
- コピースクリプトは「2回流しても2回目は0件コピー」「縮小版のキーはコピーしない」を確認できる dry-run を持たせる
- 表示の確認（変換 URL・HEIC）は native-only。Expo Web の結果を実機の代わりにしない

## 受入基準（Acceptance Criteria）

各基準に対象スライスを付ける。**S4b の基準は S4a を本番で1リリース以上運用してから検証する**。

### 機能基準

**S1 土台**

- [x] AC-1（S1）: R2 に置いた HEIC の原本（`.jpg` の名前で中身が HEIC のもの）1枚を、**独自ドメイン経由**の `https://<独自ドメイン>/cdn-cgi/image/width=400,quality=70,format=webp/<キー>` に **`Accept: image/webp` を付けて**取得すると、HTTP 200・`Content-Type: image/webp`・画像の幅が 400px になる。`width=1200` でも同様に幅 1200px になる（2026-09-23 確認: 自作 HEIC 1600×2133 → 400×533 / 1200×1599。`Accept` 無しだと `format=webp` でも JPEG が返る。下の「S1 の記録」）
- [x] AC-2（S1）: 署名付き URL を出す Edge Function に、Supabase のアクセストークン無しでアップロードを要求すると 401 になり、R2 にオブジェクトが増えない（2026-09-23 本番確認: ヘッダ無し/でたらめ/anon キー/削除要求の4パターンすべて 401）
- [x] AC-3（S1）: ユーザー A のトークンで、キーの先頭をユーザー B の `<user_id>/` にしてアップロードまたは削除を要求すると 403 になり、署名付き URL が発行されない（R2 の B の配下が変わらない）（2026-09-23 本番確認: 他人のキー・`%2e%2e` を含むキーの削除は拒否され、対象は残った）
- [x] AC-3b（S1）: 発行された署名付き URL で、`Content-Type` を `image/jpeg` 以外にして PUT すると R2 に拒否される。有効期限を過ぎた URL での PUT も拒否される（2026-09-23 本番確認: Content-Type 違い 403 / サイズ違い 403 / 期限切れ 403 / 6MB の署名要求は拒否 / 正しい PUT は 200）
- [x] AC-3c（S1）: R2 バケットの CORS 設定で、許可オリジンが `*` になっていない（2026-09-23 本番確認: 署名付き URL への OPTIONS は localhost:8081 から 204、他オリジンは 403）

**S2 プライバシーポリシー**

- [ ] AC-4（S2）: `docs/legal/privacy.html` と `PrivacyPolicyScreen` の保存先・第三者提供の節に Cloudflare が載っており、公開 URL（`kaiwa-jun.github.io/goshuin-app/legal/privacy.html`）にも反映されている。**AC-6 のコピー実行より前の日付で公開されていること**

**S3 二重書き込み + コピー**

- [ ] AC-5（S3）: 新規に1枚記録すると、同じ `image_path` のオブジェクトが Supabase Storage と R2 の両方に存在する
- [ ] AC-6（S3）: コピー完了後、`stamps.image_path` の全件について R2 に同じキーのオブジェクトがある（**DB の行数と一致**。Storage の一覧とは比べない — 一覧は消し残りを含むため）
- [ ] AC-7（S3）: R2 に `thumb-400/` または `view-1200/` を含むキーが1件も無い
- [ ] AC-8（S3）: R2 へのアップロードが失敗する状態（テストで R2 側をエラーにする）でも記録の保存は成功し、完了画面に遷移する
- [ ] AC-9（S3）: 記録を削除すると、Supabase Storage（原本・`thumb-400`・`view-1200`）と R2 の原本のどちらにも、その `image_path` のオブジェクトが残っていない
- [ ] AC-10（S3）: 御朱印の写真を差し替える（御朱印詳細 → 編集 → 写真を変更 → 保存）と、古い `image_path` のオブジェクトが Supabase と R2 の両方から消え、新しいものが両方にある
- [ ] AC-11（S3・前提: #226 が入っていること）: 画像を3枚以上持つテスト用アカウントでアカウント削除を実行すると、そのユーザーの `<user_id>/` 配下のオブジェクトが **R2 に0件、Supabase の `storage.objects` にも0件**（`thumb-400/` `view-1200/` 配下を含む）になる

**S4a 読み取り切替**

- [ ] AC-12（S4a）: AC-6 でコピー済みの御朱印について、御朱印帳タブの一覧で表示されるタイルの画像 URL が独自ドメインの `width=400` 変換 URL（`format=webp`）であり、`thumbMissing` によるフォールバックが発生しない（native-only）
- [ ] AC-13（S4a）: 御朱印帳タブでタイルをタップして開く全画面表示の URL が `width=1200` の変換 URL である（native-only）
- [ ] AC-14（S4a）: R2 に無い画像（旧アプリから Supabase にだけ上がったもの）でも、一覧・全画面の両方で Supabase の原本にフォールバックして画像が表示される
- [ ] AC-15（S4a）: `src/` に `ensureStampVariants` の呼び出しが無い（`git grep ensureStampVariants -- src ':!**/__tests__/**'` が0件）
- [ ] AC-16（S4a）: S4a のコミットだけを revert した状態で `npm test` が通り、一覧の URL が Supabase の `thumb-400` に戻る（ロールバックが `src/services/stamps.ts` 周辺だけで完結することの確認）

**S4b 書き込み切替**

- [ ] AC-17（S4b）: 新規に1枚記録すると、R2 にだけオブジェクトができ、Supabase Storage には増えない
- [ ] AC-18（S4b）: 記録を保存して御朱印帳タブに戻ると、いま保存した御朱印のタイルが最初の表示で画像つきで出る（フォールバックも焼き待ちも発生しない）（native-only）
- [ ] AC-19（S4b）: 記録完了画面・蛇腹表示・スポット詳細の御朱印画像の URL が `width=1200` の変換 URL である（原本そのものの URL を表示に使っていない）
- [ ] AC-20（S4b）: HEIC の中身を持つ既存の原本が、iOS 実機・Android 実機の両方で御朱印帳の一覧と全画面に表示される（native-only）

**S5 後片付け**

- [ ] AC-21（S5）: `supabase/functions/make-stamp-thumbnail/`、`scripts/bake-stamp-variants.sh`、`supabase/config.toml` の `[functions.make-stamp-thumbnail]` が存在しない
- [ ] AC-22（S5）: `goshuin-images` バケットに対する INSERT / UPDATE / DELETE の Storage ポリシーが無く（`pg_policies` で確認）、SELECT（公開読み取り）は残っている。バケット自体は存在する
- [ ] AC-22b（S5）: 旧アプリ由来で R2 に無い画像が、御朱印帳タブの一覧と全画面で引き続き表示される

**S6 `format=auto`**

- [ ] AC-23（S6）: iOS 実機・Android 実機で、一覧と全画面の画像が表示され、変換 URL が `format=auto` になっている（native-only）

### UI基準

- [ ] UI-1: 御朱印帳タブの一覧・全画面・都道府県詳細・蛇腹表示の見た目（画像の大きさ・切り抜き・角丸）が移行前と変わらない（S4a / S4b それぞれの前後で同じ画面のスクリーンショットを並べて比較。native-only）

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: `supabase/functions/delete-account` の Deno テストが通る（`deno test supabase/functions/delete-account`）
- [ ] Q-5: 署名付き URL を出す Edge Function の Deno テストが通る

## S1 の記録（2026-09-23）

| 項目                          | 状態                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| ドメイン                      | `goshuinsanpo.com` を Cloudflare Registrar で取得（$10.46/年・自動更新）                                                 |
| R2 バケット                   | `goshuin-images`（APAC・Standard）                                                                                       |
| 配信                          | カスタムドメイン **`img.goshuinsanpo.com`** → `goshuin-images`（r2.dev の公開 URL は使わない）                           |
| 変換                          | Transformations を `goshuinsanpo.com` ゾーンで有効化（無料枠 5,000 ユニーク変換/月）                                     |
| CORS                          | `AllowedOrigins: http://localhost:8081` / `AllowedMethods: PUT` / `AllowedHeaders: Content-Type` / `MaxAgeSeconds: 3600` |
| 署名付き URL の Edge Function | `supabase/functions/sign-stamp-upload/`（Deno テストあり）。**未デプロイ・secrets 未登録**                               |
| R2 API トークン               | **未作成**。デプロイ直前に作る（下の手順）。鍵を会話に残さないため、オーナーが自分のターミナルで登録する                 |
| テスト用オブジェクト          | バケット直下に `heic-sample.jpg`（自作 HEIC・ユーザーデータではない）。S3 のコピー前に消す                               |

分かったこと:

- **`format=webp` も `Accept` ヘッダを見る**。`Accept` に `image/webp` が無いと JPEG で返る（`format=auto` は `image/avif` があれば AVIF）。
  表示できない形式が返ることはないので安全側だが、D-5 の「webp 固定なら `Accept` に左右されない」は成り立たない。S4a の実機確認では返った `Content-Type` を記録する
- ~~CORS の事前確認が 403~~ → 署名付き URL に対する OPTIONS では許可オリジンのみ 204 で解消（AC-3c）。設定は保存されている。S1 の残りで、実際の署名付き URL に Expo Web から PUT して確かめる（AC-3c）

S1 の残り（オーナーの作業が要る）:

1. R2 API トークンを作る: ダッシュボード → R2 → Manage API Tokens → Create Account API Token。名前 `goshuin-app-edge-function`、**Object Read & Write**、**Apply to specific buckets only → `goshuin-images`**、TTL Forever
2. **`!` を付けずに自分のターミナルで**登録する（鍵を会話に残さない）:
   `npx supabase@latest secrets set --project-ref tvnozkpxncmnehyomoff R2_ACCOUNT_ID=eec7d419fbfbc6a58e713d2b64797cae R2_ACCESS_KEY_ID=<Access Key ID> R2_SECRET_ACCESS_KEY=<Secret Access Key>`
3. デプロイ: `npx supabase@latest functions deploy sign-stamp-upload --project-ref tvnozkpxncmnehyomoff --use-api --no-verify-jwt`
4. AC-2 / AC-3 / AC-3b / AC-3c を本番で確認（Claude が実施）

## 決定事項（2026-09-23 確定）

**着手条件: #225 → #226 が完了してから**（「先行 Issue」の節）。

### D-1. アップロード・削除の認可 → **C: Supabase Edge Function が署名付き URL を出す**

R2 には RLS が無いので、「Supabase のトークンを検証して `<user_id>/` 配下にだけ書かせる・消させる」をどこかが担う。**削除も同じ経路が要る**（今の `deleteStampImage` は Storage の DELETE ポリシー頼みで、R2 に置き換えると素通しになる）。

|                                     | A. Worker が署名付き URL を出す（メモの案）                                             | B. Worker が中継する                                                  | **C. Supabase Edge Function が署名付き URL を出す（採用）**                              |
| ----------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 流れ                                | アプリ → Worker（トークン検証・キー発行・PUT 用の署名付き URL）→ アプリが R2 に直接 PUT | アプリ → Worker（トークン検証・キーを決めて R2 バインディングに書く） | アプリ → Edge Function（`getUser()` で検証・S3 互換 API で署名）→ アプリが R2 に直接 PUT |
| トークン検証                        | Worker で Supabase の JWT を検証                                                        | 同左                                                                  | **既存の `delete-account` / `make-stamp-thumbnail` と同じ `getUser(token)`**             |
| 置く秘密                            | R2 の S3 互換キー（Worker）                                                             | 無し（R2 バインディング）                                             | R2 の S3 互換キー（Supabase の secrets）                                                 |
| キーを決めるのは                    | Worker                                                                                  | Worker                                                                | Edge Function（アプリに決めさせない。決めさせると他人のパスを指定できる）                |
| 大きさ・形式の制限                  | 署名に Content-Length / Content-Type を含める。含めないと 5MB 上限が消える              | Worker で中身を見て弾ける                                             | A と同じ                                                                                 |
| **R2 の CORS 設定**                 | **要る**（アプリが R2 に直接 PUT する）                                                 | 不要（R2 に直接触らない。CORS は Worker 側）                          | **要る**（アプリが R2 に直接 PUT する）                                                  |
| `delete-account` から R2 を消す手段 | Worker に「自分の配下を全部消す」を作って呼ぶ                                           | 同左                                                                  | Edge Function から S3 互換 API で直接                                                    |
| 新しくできるもの                    | Worker + wrangler + デプロイ手順                                                        | 同左                                                                  | Edge Function を1つ足すだけ                                                              |

- CORS はブラウザが強制するもので、ネイティブアプリの PUT には効かない。それでも Expo Web からの PUT と、将来の Web 版のために**許可するオリジン・メソッド（PUT）・ヘッダ（`Content-Type`）を絞って設定する**。`AllowedOrigins: *` にはしない
- 署名付き URL には `Content-Type: image/jpeg`（と可能なら Content-Length）を署名に含め、有効期限は短くする（数分）
- RN からの PUT は #118 と同じ種類の罠がありうる。`stamps-upload-native.test.ts` の R2 版を作る

### D-2. 配信ドメイン → **独自ドメインを取る（取得はユーザー）**

r2.dev では変換が効かない見込みが高い（Cloudflare のリファレンスアーキテクチャは変換 URL の前半を「オンボード済みのゾーン」としている）。**ドメインが Cloudflare のゾーンとして使えるようになるまで S1 は完了しない**。S1 の受入基準は「独自ドメイン経由で変換が効くこと」（AC-1）。

### D-3. Worker を置く場所 → **Worker は作らない**（D-1 で C を選んだため）

### D-4. 旧バージョンの扱い → **S5 は Supabase Storage を読み取り専用にするところまで。削除しない**

- 旧アプリが Supabase に上げた画像を R2 にコピーし続ける仕組みは**作らない**。コピーは S3 と S4b 直前の2回だけ
- そのため S4b 以降に旧アプリから上がった画像は R2 に無い。一覧と全画面はフォールバック（Supabase の原本）で出る。**蛇腹・スポット詳細・サムネイル帯（S4b で `getStampViewUrl` に替える3箇所）にはフォールバックが無く、そういう画像は出ない**。これは受け入れる
- Supabase Storage の使用量が**無料枠（1GB）を超えたら再検討**する（バケット削除・旧アプリの切り捨て・最低バージョンの強制など）

### D-5. 配信形式 → **まず `format=webp` 固定**（⚠ `format=webp` も `Accept` を見る。「S1 の記録」参照）

- RN の `Accept` ヘッダの挙動が環境差で読みにくく、`format=auto` だと S4a の検証がブレるため
- `format=auto` への切り替えは、S4a が本番で安定してから**別スライス（S6）**でやる

### メモ §5 のうち、コードで決まったもの

- §5-2「バケットは本当に public か」→ **public で確定**（前提表の1行目）
- §5-1「Phase 2 まで行くか」→ この Issue の範囲外

## メモからの変更点

| メモ                                                                                                                                               | この契約書                                                                                                                                         | 理由                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| §2.7「今は RLS で `<user>/` 配下に制限」                                                                                                           | 制限されていない                                                                                                                                   | `"Allow authenticated uploads"` がフォルダを見ない。R2 の認可は「同等」ではなく「今より厳しくなる」      |
| §2.7「消し残りは要確認」                                                                                                                           | コード上は消し残る。先行 Issue に切る（実データは照合クエリで確認）                                                                                | `list(id)` がフォルダ名しか返さない                                                                      |
| §2.5 3「読み取り切替」で書き込みは Supabase のまま                                                                                                 | S3 で二重書き込みとコピーを先にやる                                                                                                                | コピー後に上がった画像が R2 に無くなる。読み取り切替を「`stamps.ts` を戻すだけ」で戻せる区切りにするため |
| §2.5 5 `delete-account` は書き込み切替の後                                                                                                         | S3（二重書き込みと同時）                                                                                                                           | R2 に画像があるのに `delete-account` が見ていない期間ができる                                            |
| §2.5 に無い                                                                                                                                        | S2 プライバシーポリシー更新（S3 より前）                                                                                                           | 保存先と第三者が変わる                                                                                   |
| §2.4 `PrefectureDetailScreen` / `RecordScreen` / `GoshuinchoFlipView` / `SpotDetailContent` / `SpotThumbnailStrip` で `ensureStampVariants` を削除 | 呼び出しは **2箇所**（`useRecordForm.ts:237` / `GalleryScreen.tsx:102`）だけ                                                                       | 実装を確認                                                                                               |
| §2.4 に無い                                                                                                                                        | `useStampDetail.ts` / `ImageGalleryModal.tsx` / `config.toml` / `bake-stamp-variants.sh` / `privacy.html` / テスト2本                              | 実装を確認                                                                                               |
| §2.4「R2 のプレフィックス削除」                                                                                                                    | 列挙して 1000 件ずつ削除                                                                                                                           | R2 にプレフィックス一括削除の API は無い                                                                 |
| §2.6 AC-1「初回表示で 404 フォールバックが発生しない」                                                                                             | コピー済みの画像に限定（AC-12）。旧アプリ由来はフォールバックで出ること（AC-14）                                                                   | 移行期間中は R2 に無い画像がありうる                                                                     |
| §2.8「月 2,500 枚の新規画像まで無料」                                                                                                              | 「月に表示される画像が 2,500 枚まで」                                                                                                              | ユニーク変換は月ごとに数え直される                                                                       |
| §2.3 原本はそのまま配信                                                                                                                            | 表示は必ず変換を通す（原本を直接出している4箇所を S4b で `getStampViewUrl` に）。`getStampImageUrl` は S5 までフォールバック専用で Supabase のまま | 原本に HEIC が混ざっている。フォールバックを R2 に向けると旧アプリ由来の画像が出なくなる                 |

## 注意事項

- **移行と改善を混ぜない**。縮小の幅・品質は今の値（400/q70、1200/q78）のまま。変えたくなったら別 Issue
- S4b はゲート。S4a を本番で1リリース以上運用し、フォールバックの発生が旧アプリ由来の画像だけであることを確認してから入る
- Supabase Storage バケットはこの Issue では削除しない（読み取り専用にするのも S5）
