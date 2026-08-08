# セッション引き継ぎ（最終更新: 2026-08-03 夜）

## P2-02 Meta セットアップ進捗（2026-08-03、Claude in Chrome で代行。次セッションはここから再開）

- ✅ FB 個人アカウント（ユーザーが電話番号で作成。メール kj.11235813213455@gmail.com は Meta 全体でブロック状態 → FB登録・IG登録・developer 連絡先すべてで使用不可だった）
- ✅ FB ページ「御朱印さんぽ」: **Page ID `1301682473018397`**（プロフィール URL は profile.php?id=61592782890283）。website に GitHub Pages 設定済み
- ✅ Instagram **`goshuinsampo`**（表示名: 御朱印さんぽ）作成 → ビジネスアカウント化済み（goshuin.sampo / goshuin_sampo は取得不可だった）
- ✅ アカウントセンター統合（FB 鹿岩潤 + IG goshuinsampo）
- ✅ FB ページ ⇔ IG 連携完了。**ハマりポイント: OIDC ポップアップ承認後、親タブに「ビジネスポートフォリオに追加」の最終確認が出る。これを押すまで連携されない**（親タブをリロードするとやり直し）。ビジネスポートフォリオ「御朱印さんぽ」が自動作成された
- ✅ Meta developer 登録（連絡先: jun.kaiwa@taian-inc.com）
- ✅ アプリ作成: **goshuin-sampo-watcher / App ID `1559445438958824`** / タイプ: ビジネス / 開発モード
- ✅ Graph API Explorer（現行 **v26.0**）で権限4つ（instagram_basic / instagram_manage_insights / pages_read_engagement / pages_show_list）のユーザートークン生成済み。アセットは最小スコープ（ページ「御朱印さんぽ」1件 + IG goshuinsampo 1件のみオプトイン）
- ✅ **IG User ID = `17841439672371375`**（goshuinsampo。OAuth のアセット選択画面と business_discovery 成功で二重確認済み）
- ✅ **business_discovery 動作確認成功（2026-08-03）**: `17841439672371375?fields=business_discovery.username(kandamyoujin){username,media_count,media.limit(3){caption,permalink,timestamp}}` で神田明神の実投稿3件（caption/permalink/timestamp）取得。7/7 投稿に「七夕守は8月7日まで授与」という期限付き授与品告知あり → 鮮度判定・isLikelyGoshuin ガードの回帰テストケースに使える
- ⚠️ `me/accounts` は空を返す（原因不明だが **business_discovery は IG User ID 直指定で動くため実害なし**。Edge Function は IG User ID を secrets から直接使う設計にする）
- ✅ 長期トークン発行済み（**期限: 2026-10-02**）。手順は全 GUI で確立: Graph API Explorer でトークン生成 → [アクセストークンデバッガー](https://developers.facebook.com/tools/debug/accesstoken/)に貼って「デバッグ」→「アクセストークンを延長」（FB パスワード再入力あり）→ 延長トークン表示。**更新もこの GUI 手順で可**（トークンの貼り付け/コピーはユーザー、ボタン操作は Claude の分担）
- ✅ **Meta セットアップ完了（2026-08-03 深夜）**: Supabase secrets に `META_ACCESS_TOKEN`（長期・期限 2026-10-02）と `META_IG_USER_ID`（17841439672371375）登録済み（`secrets list` で確認済み）。**10月初旬にトークン更新が必要 → アクセストークンデバッガーの GUI 手順で延長 → secrets 更新**
- ✅ **Issue #111 実装完了・Evaluator PASS 75/75（2026-08-03 深夜、ユーザー就寝中に自律進行）**。ブランチ `feature/issue-111-instagram-business-discovery` に 6 コミット（契約書 / crawl.ts リファクタ / instagram.ts 9関数 / index.ts Instagram パス / cron 2 job 化 / UI 文言切替）。**push/PR 未実施・人間ゲートで停止中**
- 🔜 朝のゲートで承認後: ① push + PR 作成 ② デプロイ（`npx supabase@latest functions deploy crawl-spot-sources --project-ref tvnozkpxncmnehyomoff --use-api --no-verify-jwt`）③ I 群検証 24 件（大半は Claude が curl で代行可。**I-2/I-3 は生トークンが必要でユーザー実行、I-18 はトークン復元が必要なため要ユーザー**）④ cron 再登録 SQL（ユーザーが SQL Editor で実行。unschedule → 2 job 登録）⑤ N 群実機確認 6 件
- ⚠️ 注意: 現在デプロイ済みの本番関数は旧版。**火曜 02:00 JST の cron は旧版で走る**（無害）。新版デプロイ + cron 再登録が済むと金曜から 2 job 体制（web 02:00 / instagram 02:30）
- メモ: deno を `~/.deno/bin/deno` にインストール済み（H 群 92 テストの自動検証用）。Evaluator/Planner の goshuin-_ エージェント型はセッションに未登録のことがある → general-purpose に .claude/agents/_.md を読ませて代行させる
- メモ: Claude in Chrome は facebook.com / instagram.com / accountscenter.instagram.com / developers.facebook.com を許可済み。クロスドメインに遷移するポップアップは拡張の追跡が切れるので、ポップアップ内は素早く1操作ずつ・親タブは触らず待つ

`/clear` 後の文脈復元用。読み終えたら「次のアクション」から再開する。方針の唯一のソースは `docs/product/direction.md`。

## いま何をしているか（全体像）

御朱印アプリ（Expo + Supabase）の **Phase 0（iOS 先行リリース）が完了間近**。**v1.0.0 は App Store に提出済みで審査待ち**。ここからは Phase 1（記録体験の磨き込み）と、差別化の本丸である限定御朱印情報の機能に着手するフェーズ。開発は `/build-feature` の自律ループ（契約書 → TDD → 機械検証 → goshuin-evaluator → 人間ゲート → PR）で回す。**人間ゲートは push/PR 直前の1箇所のみ**。

## リリース状況（2026-08-02 時点）

- **アプリ名: 御朱印さんぽ**（「御朱印コレクション」→「御朱印マップ」と変遷。マップは App Store で登録済みだったため。45競合を調査して決定）
- **iOS: 審査待ち**。v1.0.0 / buildNumber 11 / ascAppId `6797201465` / Apple Team `292ZWTG3UD`
  - 掲載情報・スクショ6枚・プライバシー申告まで入力完了
  - ASC API Key は `~/Downloads/AuthKey_D9CP6Y4YA3.p8`（**再ダウンロード不可。安全な場所へのバックアップ推奨**）
  - `eas.json` の submit プロファイルに ascAppId / appleTeamId 設定済み。`ascApiKeyPath` 等は個人パスのためコミットしていない（submit 時に一時的に足す）
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

## 次のアクション（優先順・2026-08-02 にユーザーと合意）

1. ~~P1-08 初回体験の改善~~ — **完了**（Issue #102 / PR #103、2026-08-02）
2. **P2-02 限定御朱印ウォッチャー v2** — 次の最優先。**Instagram Business Discovery API 対応から着手する**（2026-08-02 ユーザー合意、詳細は feature-list P2-02 の note）。狙い: アイテム単位の出典 URL（投稿 permalink）+ timestamp による機械的な鮮度判定。着手手順: (1) ユーザー側の Meta セットアップをガイド（IG ビジネスアカウント作成→プロアカウント切替→FB ページ連携→Meta developer アプリ→トークン。全部無料、30分〜1時間）(2) 契約書作成（トークンは Supabase secrets に保管、username は既存 sns_link の URL から導出、Business/Creator でないアカウントは取得不可→リンク表示のまま等を仕様化）(3) 実装は crawl-spot-sources への source 種別追加として既存パイプラインに乗せる。第2柱の記事単位クロール（公式サイト）は Instagram の後
3. **P1-03 御朱印帳らしい閲覧UI** — 情緒的な差別化。ただし記録が溜まってから価値が出るため 2 の後で良い
4. 審査結果が出たら対応（通過 → 手動リリース / リジェクト → 修正・再提出）
5. Google Play（本人確認の承認後）

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
