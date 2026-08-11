# Issue #134: アカウント削除機能（App Store Guideline 5.1.1(v) 対応）

## 概要

2026-08-10 の App Store 審査（Submission ID `761a38c9-2eb8-4341-8603-252b161be183` / v1.0 (12)）で **Guideline 5.1.1(v)** により却下された。

> The app supports account creation but does not include an option to initiate account deletion. Apps that support account creation must also offer account deletion to give users more control of the data they've shared while using an app.
>
> - Only offering to temporarily deactivate or disable an account is insufficient.
> - Apps may include confirmation steps to prevent users from accidentally deleting their account.

現状 `SettingsScreen` の「アカウント」セクションは**ログアウトのみ**。一方 `src/constants/legal.ts` の利用規約 3 条・プライバシーポリシーには「ユーザーはいつでもアカウントを削除できる」「削除すると御朱印記録・画像・御朱印帳・ウィッシュリスト・プロフィールが消える」と**すでに書いてある**。実装が約束に追いついていない。

**この契約書の削除対象リストは `src/constants/legal.ts:90` の記述を正とする**（すでに公開済みの約束であり、実装がこれを下回ってはいけない）。

## 決定事項

| ID  | 論点                         | 決定                                           | 理由                                                                                                                                                                                 |
| --- | ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-1 | Sign in with Apple の revoke | **やらない**                                   | Apple の FAQ は "should"。今回の却下理由でもない。`signInWithApple` は `identityToken` のみを渡し `authorizationCode` を捨てているため、実装しても**既存ユーザーには遡って効かない** |
| D-2 | 確認ステップ                 | **2段階**（専用画面 → OS アラート）            | Apple が明示的に許可している。文字入力は求めない（審査担当の画面収録の手間になる）                                                                                                   |
| D-3 | 削除の実行主体               | **Edge Function**（service role）              | `auth.users` の行はクライアントからは消せない。supabase-js の `auth.admin.*` は service role 専用                                                                                    |
| D-4 | 失敗したときの扱い           | **セッションは維持**したままエラーを画面に出す | 中途半端に成功した状態でサインアウトすると、ユーザーが自分のデータの状態を確認できなくなる                                                                                           |

## 関連ドキュメント

- Apple: [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- 既存の約束: `src/constants/legal.ts`（利用規約 3 条 / プライバシーポリシー「アカウント削除時のデータの取り扱い」）
- Edge Function の運用作法: `.claude/harness/handoff.md`「限定御朱印ウォッチャーの運用メモ」

### ⚠️ 着手前に把握しておく落とし穴

1. **`spots.created_by_user_id` に `ON DELETE` 句が無い**（`supabase/migrations/20260208102535_create_spots.sql:17`）。既定の `NO ACTION` なので、**その user が作ったスポットが1件でもあると `auth.users` の行削除が FK 違反で失敗する**。削除の前に `NULL` に落とす必要がある。他の4テーブル（`profiles` / `stamps` / `goshuincho` / `wishlists`）は `ON DELETE CASCADE` 済みなので明示削除は不要
2. **Storage のオブジェクトは cascade しない**。`storage.objects.owner` は `auth.users` を参照するが行は消えない。`goshuin-images/<user_id>/` 配下を明示的に列挙して削除する
3. **`verify_jwt` は false にする**。このプロジェクトは新 API キー体系（`sb_secret_...`）で、`verify_jwt = true` だとゲートウェイが sb_secret を弾く（`supabase/config.toml` のコメント参照）。**そのぶん、呼び出し元が本人であることは関数内で必ず検証する**
4. **`supabase.functions.invoke` は `Authorization` にログイン中のユーザー JWT を自動で載せる**。関数側はこれを `getUser()` に通して user_id を得る。**リクエストボディで user_id を受け取ってはいけない**（他人のアカウントを消せる穴になる）

## スコープ

### やること

| ID  | 内容                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------- |
| S-1 | Edge Function `delete-account`（呼び出し元の JWT 検証 → Storage 画像削除 → spots の作成者を NULL → `auth.admin.deleteUser`） |
| S-2 | `src/services/account.ts` の `deleteAccount()`（関数の呼び出しと結果の型付け）                                               |
| S-3 | `AccountDeletionScreen`（消えるデータの一覧 + 赤い実行ボタン + OS アラート + 失敗時のエラー表示）                            |
| S-4 | `SettingsScreen` の「アカウント」に削除の行を追加（**ログイン中のみ**表示）                                                  |
| S-5 | 削除成功後のサインアウトと地図（ゲスト）への遷移                                                                             |
| S-6 | `spots.created_by_user_id` を `ON DELETE SET NULL` にする migration（落とし穴 1 の恒久対策）                                 |

### やらないこと（スコープ外）

- **Sign in with Apple のトークン revoke**（D-1）
- アカウントの一時停止・無効化（Apple が「不十分」と明記している）
- データのエクスポート・ダウンロード
- 削除の取り消し猶予期間（「元に戻せない」と明示して即時削除する）
- 削除理由のアンケート

## 詳細設計

### S-1: Edge Function `delete-account`

`supabase/functions/delete-account/index.ts`。`supabase/config.toml` に `[functions.delete-account] verify_jwt = false` を追加する。

処理順（**この順序に意味がある**）:

1. `Authorization: Bearer <jwt>` ヘッダを読む。無ければ **401**
2. anon キーのクライアントで `auth.getUser(jwt)` → 失敗 or user なしなら **401**。ここで得た `user.id` **だけ**を以降で使う
3. service role クライアントで `storage.from('goshuin-images').list(userId)` → 得られたファイル名を `<userId>/<name>` に組み立てて `remove()`。**0 件なら呼ばない**（空配列を渡すと API がエラーを返す）
4. `spots` の `created_by_user_id = userId` を `NULL` に更新（落とし穴 1）
5. `auth.admin.deleteUser(userId)` → ここで `profiles` / `stamps` / `goshuincho` / `wishlists` が cascade で消える
6. 200 `{ success: true }`

**3 が 5 より前なのは、auth ユーザーを先に消すと「どのユーザーの画像だったか」を引く手がかりが消えるため**（`storage.objects.owner` は `ON DELETE SET NULL`）。逆順にすると画像だけが残って誰も消せなくなる。`stamps` の削除順を DB 行 → 画像に変えた Issue #130 の S-6 とは**判断が逆になる**点に注意: あちらは「行が残って画像だけ消える」を避ける話で、こちらは「画像だけ残って行が消える」を避ける話。共通するのは**参照を持っている側を最後に消す**こと。

3 が失敗しても 4-5 は続行する（**画像の消し残しよりアカウントが消えないことのほうが Guideline 違反として重い**）。失敗はレスポンスの `warnings` に載せてログに残す。4 または 5 が失敗したら **500** を返し、クライアントは D-4 に従いセッションを維持する。

### S-2: `deleteAccount()`

`src/services/account.ts`。既存の `auth.ts` の `AuthResult` に倣った判別可能ユニオンを返す。

```ts
export type DeleteAccountResult =
  | { success: true }
  | { success: false; error: { code: string; message: string } };
```

`supabase.functions.invoke('delete-account')` を呼ぶ。**ボディは渡さない**（落とし穴 4）。ネットワーク例外も catch して `success: false` に畳む（画面に原文を出す。Issue #118 / #121 と同じ方針）。

### S-3: `AccountDeletionScreen`

`RootStackParamList` に `AccountDeletion: undefined` を追加し、`RootNavigator` に登録する（`TermsOfService` / `PrivacyPolicy` と同じ扱い。`Settings` はスタックを持たないタブ画面なので RootStack に置くのが既存パターン）。

画面の中身:

- 見出し「アカウントを削除」
- 「以下がすべて削除されます」＋箇条書き（`legal.ts:90` の4項目: 御朱印記録（画像・メモ・訪問日・スポット情報）/ 御朱印帳 / 行きたいリスト / プロフィール）
- 「一度削除すると元に戻せません。」の警告
- 赤い「アカウントを削除する」ボタン → `Alert.alert` で最終確認（`style: 'destructive'` / キャンセルが既定）
- 実行中はボタンを無効化しインジケータを出す（**二度押しで2回叩かせない**。Issue #130 で同じ穴を塞いだ）
- 失敗したらエラー原文を画面に表示（サインアウトはしない）

### S-4: 設定画面の導線

「アカウント」カードの区切り線の下、ログアウトの**次**の行に置く。`isAuthenticated` が false のときは出さない（ゲストには削除するアカウントが無い）。

### S-5: 成功後の遷移

`signOut()` → `MainTabs > MapTab > Map` へ `navigate`。`useAuth` がセッション消失を拾って各画面がゲスト表示に戻る。

### S-6: migration

`ALTER TABLE spots DROP CONSTRAINT ... ; ALTER TABLE spots ADD CONSTRAINT ... ON DELETE SET NULL;`

**S-1 の 4 は migration 適用後も残す**。migration の本番適用はユーザーの SQL Editor 作業であり、関数側が先に本番へ出る可能性があるため（関数だけが正しく動けば削除は成立する）。

## 受入基準

### A 群: Edge Function の認可（S-1）

- A-1: `Authorization` ヘッダが無いとき 401 を返す
- A-2: JWT が不正・期限切れで `getUser` が失敗するとき 401 を返す
- A-3: `getUser` が user を返さないとき 401 を返す
- A-4: 削除対象の user_id は **`getUser` の結果からのみ**取得している（リクエストボディを読んでいない）
- A-5: 認可に失敗したケースでは `deleteUser` も `storage.remove` も呼ばれない

### B 群: 削除の順序と網羅（S-1）

- B-1: Storage の削除が `deleteUser` より**前**に呼ばれる
- B-2: `list(userId)` の結果が 0 件のとき `remove()` を呼ばない
- B-3: `remove()` に渡すパスが `<userId>/<name>` の形になっている
- B-4: `spots.created_by_user_id` の NULL 更新が `deleteUser` より前に呼ばれる
- B-5: `deleteUser` に渡す ID が `getUser` で得た ID と一致する
- B-6: Storage の削除が失敗しても `deleteUser` は実行され、200 と `warnings` が返る
- B-7: `spots` の更新が失敗したら 500 を返し `deleteUser` を呼ばない
- B-8: `deleteUser` が失敗したら 500 を返す
- B-9: 成功時のレスポンスが `{ success: true }` である

### C 群: `deleteAccount()`（S-2）

- C-1: `functions.invoke('delete-account')` を呼ぶ
- C-2: 呼び出しにボディを渡していない
- C-3: 関数がエラーを返したとき `success: false` とエラーメッセージを返す
- C-4: 例外が投げられても throw せず `success: false` に畳む
- C-5: 成功時に `{ success: true }` を返す

### D 群: 削除画面（S-3）

- D-1: 消えるデータ4項目（御朱印記録 / 御朱印帳 / 行きたいリスト / プロフィール）がすべて表示される
- D-2: 「元に戻せません」の警告が表示される
- D-3: 実行ボタンを押すと `Alert.alert` が出る（**この時点では `deleteAccount` を呼ばない**）
- D-4: アラートの破壊的アクションを選んで初めて `deleteAccount` が呼ばれる
- D-5: アラートでキャンセルすると `deleteAccount` は呼ばれない
- D-6: 実行中はボタンが無効化される（二度押しで2回呼ばれない）
- D-7: 失敗するとエラーメッセージが画面に表示される
- D-8: 失敗したとき `signOut` は呼ばれない（D-4 の決定）
- D-9: 成功すると `signOut` が呼ばれる
- D-10: 成功すると地図（`MainTabs > MapTab > Map`）へ遷移する

### E 群: 設定画面の導線（S-4）

- E-1: ログイン中は「アカウントを削除」の行が表示される
- E-2: ゲストのときは表示されない
- E-3: 行をタップすると `AccountDeletion` へ遷移する
- E-4: 文字色が `colors.error`（テーマトークン。直値を書かない）

### F 群: 回帰

- F-1: 既存のログアウトの行が従来どおり動く
- F-2: 既存テストがすべて通る
- F-3: `npm run lint` 0 errors / `npm run typecheck` clean

### G 群: 実機（人間ゲート後・**Apple への提出物**）

- G-1: 実機でログイン → 自分タブ → アカウントを削除 → 確認画面 → アラート → 削除完了までが通る
- G-2: 削除後にゲスト状態の地図に戻っている
- G-3: 同じ Apple / Google アカウントで再ログインすると、御朱印 0 件・行きたい 0 件のまっさらな状態から始まる
- G-4: Supabase 側で `auth.users` / `stamps` / `goshuincho` / `wishlists` / `profiles` の行と `goshuin-images/<user_id>/` が消えていることを確認する
- G-5: **G-1 の一連を実機で画面収録し、App Review Information の Notes に添付する**（Apple が明示的に要求）

## 実装スライス（1スライス = 1コミット）

1. **S-6**: `spots.created_by_user_id` を `ON DELETE SET NULL` にする migration
2. **S-1**: Edge Function `delete-account` + `config.toml`（A 群 / B 群）
3. **S-2**: `deleteAccount()`（C 群）
4. **S-3**: `AccountDeletionScreen` + ナビゲーション登録（D 群）
5. **S-4 / S-5**: 設定画面の導線（E 群）

## リスク

| リスク                                               | 対応                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 関数が本番にデプロイされていない状態でアプリだけ出る | **ビルド前にデプロイする**。`npx supabase@latest functions deploy delete-account --use-api`        |
| 削除の途中で失敗して中途半端な状態になる             | 順序を「参照を持つ側を最後」にし、失敗時はセッションを維持してユーザーが状態を確認できるようにする |
| 誤操作でユーザーがデータを失う                       | 2段階確認（D-2）。ただし Apple は「削除を難しくしすぎるな」とも言っているため文字入力は求めない    |
| 審査担当が削除フローに辿り着けない                   | G-5 の画面収録を Notes に添付する（Apple の要求そのもの）                                          |
