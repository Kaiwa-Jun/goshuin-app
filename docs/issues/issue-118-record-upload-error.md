# Issue #118: 記録の「アップロードエラー」を直す（UI/UX 監査 A-4）

- ブランチ: `fix/issue-118-record-upload-error`
- 起票: 2026-08-09
- 監査: `docs/design/ux-audit-2026-08.md` A-4

原因が特定できてから書いた記録。`/build-feature` の Step 1（契約書）は原因特定の後、という方針どおり。

---

## 1. 症状

実機で記録フローを進め、写真の選択・表示まではできる。そこから「記録する」で保存しようとすると ErrorScreen の「アップロードエラー」に飛ぶ。**実機で御朱印を1件も記録できない**ため、Issue #116（めくり UI）の実機確認 N 群8項目も止まっていた。

## 2. 原因

`@supabase/storage-js` の `uploadOrUpdate` は、渡された body が `FormData` の場合に内部でこうしている:

```js
} else if (typeof FormData !== "undefined" && fileBody instanceof FormData) {
  body = fileBody;
  if (!body.has("cacheControl")) body.append("cacheControl", options.cacheControl);
```

React Native の FormData ポリフィル（`react-native/Libraries/Network/FormData`）は `append` / `getAll` / `getParts` しか持たず、**`has()` が無い**。よって実機では

```
TypeError: body.has is not a function
```

が、**通信が1バイトも出る前に**投げられる。`handleOperation` は StorageError 以外を再 throw するので `{ data, error }` 形式ですらなく、そのまま `useRecordForm` の catch に落ちる。

`RecordScreen` は `isNetworkError()` の真偽だけで `'network'` / `'upload'` を出し分けていたため、この TypeError は `'upload'` に倒れ、画面には「アップロードエラー」としか出なかった。

### なぜテストで気づけなかったか

jest の実行環境（`preset: jest-expo` + `testEnvironment: node`）の `FormData` は **Node 側の実装で `has()` を持つ**。既存の `stamps-create.test.ts` は `@services/supabase` をモックしているので supabase-js の該当コードにそもそも入らない。二重に見えなかった。

### いつ壊れたか

`has()` のガードは新しめの storage-js で入ったもの。**2026-03-04 にアプリ経由のアップロード成功実績が1件残っている**ため、当時は FormData 経路で通っていた。依存を上げたときの回帰。

## 3. 切り分け（Storage 側は無罪だった）

監査時点の候補は「バケット / RLS ポリシー」「認証セッション」「FormData 方式」の3つ。Supabase の実態を確認して前2つを落とした。

| 確認項目                     | 実態                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| バケット `goshuin-images`    | 存在する / `public=true` / `file_size_limit=5242880`(5MB) / `allowed_mime_types={image/jpeg, image/png, image/webp}`                                       |
| `storage.objects` のポリシー | 6本（INSERT 2 / SELECT 2 / UPDATE / DELETE）。INSERT は `TO authenticated WITH CHECK (bucket_id = 'goshuin-images')` と、自分のフォルダ配下限定のものの2本 |
| 既存オブジェクト             | 1件。`<user_id>/<timestamp>-<rand>.jpg`・owner あり・image/jpeg・90,584 bytes・2026-03-04                                                                  |

既存オブジェクトの命名は `uploadStampImage` の `${userId}/${Date.now()}-${Math.random()...}.jpg` そのもの。**アプリが一度は成功している**＝バケットもポリシーも認証も通る、という決定的な証拠になった。

## 4. 対応

### ① エラー原文を出す

`error.message` は捨てられていただけで、`useRecordForm` の `submitError` には生きていた。

- `submit()` の返り値に `stage`（`'upload' | 'create'`）と `message` を足した。Storage の失敗と stamps への insert の失敗が同じ catch に落ちてくるため、これが無いと画面にもログにも区別が残らない
- ErrorScreen に「詳細」ブロックを追加。`selectable` にして実機からコピーできるようにした
- `stage === 'create'` のときは見出しを「保存エラー / 記録の保存に失敗しました」に変える。**「アップロードエラー」という表示は当てにならない**という問題そのものへの対応
- `console.error('[record] submit failed at <stage>: <message>')` も残す（画面を見られない場面用）
- `describeSupabaseError()` を追加し、Storage の `statusCode` / PostgREST の `code` `details` `hint` をメッセージに併記する

### ③ 修正

`FormData` をやめてバイト列を渡す。

```ts
const bytes = await new File(imageUri).bytes();
const { data, error } = await supabase.storage
  .from('goshuin-images')
  .upload(filePath, bytes, { contentType: STAMP_IMAGE_CONTENT_TYPE });
```

- **`contentType` の明示は必須**。バケットに `allowed_mime_types` が設定されているため、supabase-js の既定値（`text/plain;charset=UTF-8`）のままだとサーバに弾かれる
- `expo-file-system` は `expo@54` の推移的依存として**既にネイティブ側に入っている**（`expo-module.config.json` あり・`expo-asset` が実行時に使っている）。`package.json` に明示しただけでバージョンは 19.0.21 のまま＝**dev build を作り直す必要はない**
- FormData 方式は「ネイティブがファイルをストリームするので base64 を経由しない」利点があったが、supabase-js の内部実装に依存する形になっていた。バイト列経路は Supabase の React Native 向けドキュメントが案内している方法でもある

#### 検討して採らなかった案

`FormData` を継承して `has()` を生やすパッチ。3行で済むが、supabase-js が将来 `get()` や `entries()` を呼ぶようになれば同じ壊れ方をする。ライブラリの内部実装への依存を残したくないので却下した。

### 回帰テスト

`src/services/__tests__/stamps-upload-native.test.ts` で、

1. `global.FormData` を RN のポリフィルに差し替え
2. `@services/supabase` を **supabase-js の実物**（fetch だけモック）に差し替え

して、実機と同じコードパスを踏ませている。修正前はこのテストが `TypeError: body.has is not a function` で落ちる。

### バケットとポリシーの migration 化

`supabase/migrations/20260809000000_create_goshuin_images_bucket.sql`。ダッシュボードで手作業作成されており migrations に存在しなかった（監査が「環境再現性の穴」として指摘していた分）。2026-08-09 時点の本番の実態を写経し、`ON CONFLICT DO UPDATE` と `DROP POLICY IF EXISTS` + `CREATE` で冪等にしてある。**本番は既にこの状態なので適用は不要**。

## 5. 検証

| 種別                | 結果                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `npm test`          | 89 suite / 1020 tests 全パス                                                                 |
| `npm run lint`      | 0 errors（警告15件は develop と同数の既存分）                                                |
| `npm run typecheck` | clean                                                                                        |
| iOS バンドル        | Metro でビルド成功（7.8MB）。`expo-file-system` の解決・新コードの混入をバンドル内で確認済み |
| web バンドル        | Metro でビルド成功（`?preview=goshuincho` の検証経路を壊していない）                         |
| **実機**            | **確認済み（2026-08-09）。記録が投稿できることをユーザーが確認**                             |

`expo-file-system` のネイティブモジュールが既存ビルドに入っていることは、シミュレータにインストール済みの .app のバイナリに `ExpoFileSystem` / `FileSystemModule` / `FileSystemLegacyModule` のシンボルが含まれることで事前に確認した（= dev build の作り直しが不要である根拠）。実機で通ったことでこれも裏付けられた。

## 6. 実機確認の結果

- [x] 記録フローを最後まで通して御朱印が保存できる（**2026-08-09 ユーザー確認**）

## 7. 学び

- **RN の FormData は web の FormData ではない**。`append` / `getAll` / `getParts` しか無い。ライブラリに FormData を渡すときは、そのライブラリが web の API を前提にしていないか確認する
- **jest（node 環境）と実機で global の実装が違うものは、テストが通っても実機で落ちる**。`FormData` / `Blob` / `atob` あたりが該当する。実機依存の経路は、global を差し替えて実物のライブラリを通す形の特性テストで守る
- **「表示されているエラー名」を信じない**。分岐が雑だと無関係な失敗が同じ画面に集まる。原因の切り分けより先に、原文が残る導線を作るほうが速い
