# セッション引き継ぎ（最終更新: 2026-08-08）

## P2-02 Instagram Business Discovery — 完了（2026-08-08 運用投入）

Issue #111 / PR #112 マージ済み・本番投入完了（passes: true）。Meta セットアップ〜実装〜検証〜運用投入までの全経緯。

- ✅ Meta セットアップ完了: FB ページ「御朱印さんぽ」（Page ID `1301682473018397`）、Instagram `goshuinsampo`（ビジネスアカウント化済み）、FB⇔IG 連携、Meta developer アプリ `goshuin-sampo-watcher`（App ID `1559445438958824`）。IG User ID = `17841439672371375`
- ✅ 長期アクセストークン発行済み（**期限: 2026-10-02**）。Supabase secrets に `META_ACCESS_TOKEN` / `META_IG_USER_ID` 登録済み。**10月初旬に更新要**: [アクセストークンデバッガー](https://developers.facebook.com/tools/debug/accesstoken/)にトークンを貼って「デバッグ」→「アクセストークンを延長」→ `npx supabase@latest secrets set META_ACCESS_TOKEN=<延長後トークン> --project-ref tvnozkpxncmnehyomoff`
- ✅ 実装完了・Evaluator PASS 75/75。PR #112 マージ済み（`crawl-spot-sources` に Instagram パス追加、`mode` パラメータで web/instagram を制御）
- ✅ **本番デプロイ済み**。実クロール検証で23アカウント中19件で Claude 抽出成功、2件は個人アカウント判定でスキップ、failed 0件
- ⚠️ **重要な落とし穴（本番投入時に発見・解決済み）**: Meta developer アプリが **Business Portfolio にリンクされていない**と、`business_discovery` が `OAuthException code 200 "API access blocked"` で全滅する。8/3 のセットアップ時点では未リンクでも一時的に動いていたが、8/8 の本番検証時には完全にブロックされていた（Standard Access アプリの猶予期間切れとみられる）。**対処**: Meta for Developers → アプリ設定 → ベーシック → 「ビジネスポートフォリオ」を「御朱印さんぽ」にリンク（Unverified 状態のままで解消する）。今後同様のエラーが出たらまずこれを疑う
- ✅ **実機・DB 両方で確認済み**: 榴岡天満宮（公式サイト更新停止スポット）に Instagram 由来アイテムが表示され、リンクから実際の投稿に遷移できることを確認。浅草神社で web/Instagram 混在表示（文言の個別切り替え）も確認
- ✅ **cron 再登録完了（2026-08-08）**: `crawl-spot-sources-biweekly`（`0 17 * * 1,4` = 火金02:00 JST・web）/ `crawl-spot-sources-instagram`（`30 17 * * 1,4` = 火金02:30 JST・instagram）の2ジョブ体制で稼働中。**次回火曜(8/11)朝に両方 succeeded か確認**: `select jobname, status, start_time, end_time from cron.job_run_details order by start_time desc limit 10;`
- 📌 **カバレッジの現状**: 全1,109スポット中、巡回対象は**29スポット・79ソース**（sns_link 39 / official 40）のみ。金蛇水神社など Instagram 運用中でも未登録のスポットは今回スコープ外（契約書で「seed への新規アカウント追加はしない」と明記）。**次にやるなら「対象スポットの棚卸し・追加」が候補**
- メモ: deno を `~/.deno/bin/deno` にインストール済み（H 群テストの自動検証用）。Evaluator/Planner の goshuin-\_ エージェント型はセッションに未登録のことがある → general-purpose に `.claude/agents/*.md` を読ませて代行させる
- メモ: Claude in Chrome は facebook.com / instagram.com / accountscenter.instagram.com / developers.facebook.com / appstoreconnect.apple.com を許可済み。クロスドメインに遷移するポップアップは拡張の追跡が切れるので、ポップアップ内は素早く1操作ずつ・親タブは触らず待つ。Apple/Meta のログインセッションは時々切れるので、切れたらユーザーに再ログインを頼む

## App Store 審査対応（2026-08-08）

- ✅ **v1.0.0 buildNumber 11 が Guideline 5.1.1（プライバシー）で却下**（2026-08-06）。原因: `expo-camera` / `expo-image-picker` の config plugin がデフォルトでマイク権限のプレースホルダー文言 `NSMicrophoneUsageDescription` を自動追加していた（コード上はマイクを一切使っていない。写真撮影は `expo-image-picker` の `launchCameraAsync` のみ）
- ✅ **修正済み・PR #113 マージ済み**: `app.json` の両プラグインに `microphonePermission: false` を指定してマイク権限自体を削除（iOS: `NSMicrophoneUsageDescription` 削除 / Android: `RECORD_AUDIO` 削除）。カメラ・フォトライブラリの権限文言は元々具体的な日本語だったため無変更
- ✅ **buildNumber 12 をビルド・submit・審査へ再提出済み（2026-08-08）**。最大48時間で結果通知
- **submit の手順メモ**: `eas submit --non-interactive` は ASC API Key の初回設定ができないため、`eas.json` の `submit.production.ios` に一時的に `ascApiKeyPath`（`~/Downloads/AuthKey_D9CP6Y4YA3.p8`）/ `ascApiKeyId`（`D9CP6Y4YA3`）/ `ascApiKeyIssuerId` を追記して実行し、**完了後に必ず削除する**（コミットしない）。Issuer ID は App Store Connect の「ユーザーとアクセス → 統合 → App Store Connect API」で確認できる
- **却下後の再提出フロー**: 配信タブ → 却下された提出物ページ → 右上「審査内容を更新」→ ダイアログで「提出」→ 提出物詳細ページでビルド行にホバーすると出る削除アイコンで**古いビルドを外す** → 「ビルドを追加」で新ビルドを選択 → 「保存」→「審査用に追加」→ 右パネル「審査へ提出」

`/clear` 後の文脈復元用。読み終えたら「次のアクション」から再開する。方針の唯一のソースは `docs/product/direction.md`。

## いま何をしているか（全体像）

御朱印アプリ（Expo + Supabase）の **Phase 0（iOS 先行リリース）が完了間近**。**v1.0.0 は App Store に提出済みで審査待ち**。ここからは Phase 1（記録体験の磨き込み）と、差別化の本丸である限定御朱印情報の機能に着手するフェーズ。開発は `/build-feature` の自律ループ（契約書 → TDD → 機械検証 → goshuin-evaluator → 人間ゲート → PR）で回す。**人間ゲートは push/PR 直前の1箇所のみ**。

## リリース状況（2026-08-08 時点）

- **アプリ名: 御朱印さんぽ**（「御朱印コレクション」→「御朱印マップ」と変遷。マップは App Store で登録済みだったため。45競合を調査して決定）
- **iOS: 審査中（2回目）**。v1.0.0 / **buildNumber 12** / ascAppId `6797201465` / Apple Team `292ZWTG3UD`。1回目（buildNumber 11）は Guideline 5.1.1 で却下 → マイク権限修正（PR #113）→ 再提出済み。結果は最大48時間後
  - 掲載情報・スクショ6枚・プライバシー申告まで入力完了
  - ASC API Key は `~/Downloads/AuthKey_D9CP6Y4YA3.p8`（**再ダウンロード不可。安全な場所へのバックアップ推奨**）
  - `eas.json` の submit プロファイルに ascAppId / appleTeamId 設定済み。`ascApiKeyPath` 等は個人パスのためコミットしていない（submit 時に一時的に足す。手順は上記「App Store 審査対応」参照）
- **Android: 未着手**。Google Play の本人確認が審査中 + Android 実機での Play Console ログインが未完了
- **main ブランチ**: develop をマージ済み（PR #101）。GitHub Pages の法務ページも「御朱印さんぽ」に更新済み

## これまでの経緯（2026-08-02、時系列）

1. プロダクト方針 v2 決定: リリース先行 / 差別化4軸の段階導入 / ハイブリッド収益化（direction.md）
2. **PR #91**: 開発ハーネス刷新（/build-feature、planner/evaluator 2体制、Maestro スキャフォールド）
3. **PR #92**: マスタデータ（宮城 DB 同期 + 東京増強99件）→ **DB 適用済み。全1,109件・東京119件**
4. **PR #94**（Issue #93）: 地図即修正（1,000行フェッチ上限 / visited・wishlist ピン消失 / ズーム境界チラつき）
5. **PR #95**: iOS ビルドの AppCheckCore エラー修正（expo-build-properties, useFrameworks: static）。**これが無いと iOS production ビルドは失敗する**
6. **PR #97**（Issue #96 / P1-05）: 地図をビューポート×rank優先 top-N 方式に再設計
7. **PR #98**: 巡礼データ（6コース+札所75件）の DB エクスポート
8. **PR #100**（Issue #99 / P1-06）: クラスタリング導入。実機クラッシュを4イテレーションで追い込み、最終的に `minZoomLevel=8` で封じ込め（全経緯は契約書 `docs/issues/issue-099-map-clustering.md` 追補1〜4）
9. **PR #101**: develop → main のリリースマージ。v1.0.0 を App Store Connect へ提出
10. **PR #103**（Issue #102 / P1-08）: 初回体験の改善。タブ遷移ブロック撤廃 + 御朱印/コレクションのゲスト空状態 + 検索の未入力時提案（近隣/人気）。Evaluator PASS 47/47・実機確認済み
11. **PR #105〜#110**（Issue #104 / P2-01）: 限定御朱印ウォッチャー MVP を**運用投入まで完了**（passes: true・実機確認済み）。spot_info_sources + crawl-spot-sources Edge Function（hash 差分検知 → Haiku 4.5 構造化）+ LimitedGoshuinSection。seed 29スポット79ソース（#106）、授与品混入→isLikelyGoshuin ガード（#108）、過去告知混入→日付注入プロンプト（#109）+ 頒布中(開始のみ記載)の誤除外対策（#110）。cron 週2回（火金02:00 JST）稼働中

## このセッションでの重要な発見

1. **本番ビルドが起動時クラッシュしていた**（出荷寸前で発見）。`EXPO_PUBLIC_*` をブラケット記法・変数経由で読んでおり、babel-preset-expo のインライン化が効かず本番で undefined になっていた。Metro 経由の開発では動くため気づきにくい。`src/services/__tests__/envAccess.test.ts` で再発防止済み
2. **EAS に環境変数が未登録だった**。`eas env:create` で production/preview に8件登録済み
3. **地図の全国スケールクラッシュは Apple Maps のタイルメモリ起因**とみられ、アプリコード側（マーカー churn・スナップショット機構・無限アニメリーク）は追補1〜3で潰し切った。解禁は P1-07

## 次のアクション（2026-08-08 時点）

1. ~~P1-08 初回体験の改善~~ — **完了**（Issue #102 / PR #103）
2. ~~P2-02 限定御朱印ウォッチャー v2（Instagram 第1柱）~~ — **完了・運用投入済み**（Issue #111 / PR #112、2026-08-08）
3. **cron 再登録**（ユーザー作業・未実施）: `supabase/cron/schedule_crawl_spot_sources.sql` を SQL Editor で実行
4. **審査結果待ち**（buildNumber 12、最大48時間）。通過 → 手動リリース / リジェクト → 内容確認して対応
5. 次にやること候補（優先順は未合意・要相談）:
   - **P2-02 第2柱**: 公式サイトの記事単位クロール
   - **対象スポットの棚卸し**: 現在29スポットのみ巡回対象。有名どころで未登録のものを洗い出して追加（例: 金蛇水神社が Instagram 運用中なのに未登録と判明）
   - **P1-03 御朱印帳らしい閲覧UI** — 情緒的な差別化。記録が溜まってから価値が出るため急がなくてよい
6. Google Play（本人確認の承認後）

## ユーザー待ちの項目

- **実機でのスクショ3枚**（コレクション / 御朱印ギャラリー / 記録画面）— ログイン済み実データが必要。撮影 → AirDrop → こちらで 1284×2778 に変換して差し替え
- **Google Play**: 本人確認（審査中）/ Android 実機での Play Console ログイン
- **App Store Connect の操作代行**: Claude in Chrome 拡張は接続できるが、拡張が入っている Chrome プロファイルが Apple 未ログイン。一度ログインしてもらえれば以降の操作を代行可能（パスワード・2FA 入力は必ずユーザー本人が行う）

## 環境・成果物の場所

- **スクショ**: `goshuin-app-artifacts/screenshots-ios-6.7/`（1290×2796）と `screenshots-ios-6.5/`（1284×2778、アップロード済み）
- **ビルド成果物**: `goshuin-app-artifacts/`（Android .aab v1.0.0/vc2 / iOS シミュレータ用 tar.gz）
- **開発環境**: Xcode 26.6 / iOS 26.5 シミュレータ（`goshuin-shot` = iPhone 16 Plus, UDID `325F0C9C-7C83-4B66-8BF9-33C2BE7053BD`）/ Maestro 2.8.0（`~/.maestro/bin/maestro`）
- **スクショ撮影**: `xcrun simctl location <udid> set 35.7148,139.7967`（浅草）→ `maestro test e2e/flows/store-screenshots.yaml`。**位置設定を忘れると緯度経度0の海になる**
- **dev サーバー**: tmux セッション `goshuin-dev`（`/dev` で再起動）
- **Supabase**: 読み取りは `.env` の anon キーで REST 直叩き（1リクエスト最大1,000行）。**書き込みはユーザーがプライベート Chrome の SQL Editor で実行する運用**
- **EAS**: ログイン済み。`--non-interactive --no-wait` で投げて `build:list --json` で状態確認（`build:view` は JSON が壊れることがある）

## 限定御朱印ウォッチャーの運用メモ（P2-01 で確立、2026-08-02）

- **Supabase CLI は必ず `npx supabase@latest`**（素の `npx supabase` は古い v2.20 を解決して config.toml の `[project]` を読めない）。デプロイは Docker レート制限を避けて `--use-api` を付ける: `npx supabase@latest functions deploy crawl-spot-sources --project-ref tvnozkpxncmnehyomoff --use-api --no-verify-jwt`
- **verify_jwt は必ず false**（config.toml に明記済み）。このプロジェクトは新 API キー体系で、関数環境の `SUPABASE_SERVICE_ROLE_KEY` は `sb_secret_...`。JWT 検証が有効だと sb_secret はゲートウェイで弾かれ、legacy JWT は関数内ガードで弾かれる詰みになる
- **関数の認可**: `Authorization: Bearer <sb_secret キー>`。キーは `npx supabase@latest projects api-keys --project-ref tvnozkpxncmnehyomoff --reveal` で取得（**--reveal 必須**。無いと伏せ字が返り Invalid API key になる）。Vault には `service_role_key` の名前で sb_secret を保存済み（cron が参照）
- **強制再抽出**: `spot_info_sources.content_hash` を null に PATCH → 関数を `{"spot_id": "..."}` 付きで叩く（hash 一致だと Claude を呼ばずスキップされるため）
- **既知の問題**: 平安神宮は先方の SSL 中間証明書チェーン不備で fetch が常に失敗（毎回 failed 1 は正常）。榴岡天満宮は公式サイトの御朱印告知が2022年で停止しており Instagram のみ（P2-02 の動機）
- **抽出品質の防衛線**: ①isLikelyGoshuin ガード（name+description に朱印/集印必須、朱印帳/挟み紙除外）②プロンプトに今日の日付を注入して過去告知を除外、頒布中(開始のみ記載・通年)は含める。プロンプト変更時は必ず「八坂神社(授与品一覧)」「榴岡(古い告知)」「護國神社(通年切り絵)」で回帰確認する
- **cron 実行履歴**: `select * from cron.job_run_details order by start_time desc limit 5;`（SQL Editor）

## 参照ファイル

- 方針・Phase 0 チェックリスト: `docs/product/direction.md`
- 契約書: `docs/issues/issue-099-map-clustering.md`（追補1〜4 が最も学びが多い）/ `issue-096-map-viewport-topn.md` / `issue-093-map-spot-display-fixes.md`
- ストア関連: `docs/project/store-metadata.md`（掲載情報の確定値）/ `store-account-setup.md` / `release-guide.md`
- ハーネス状態: `.claude/harness/feature-list.json` / `progress.md`
