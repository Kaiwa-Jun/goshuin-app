# セッション引き継ぎ（最終更新: 2026-08-02 夜）

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

## このセッションでの重要な発見

1. **本番ビルドが起動時クラッシュしていた**（出荷寸前で発見）。`EXPO_PUBLIC_*` をブラケット記法・変数経由で読んでおり、babel-preset-expo のインライン化が効かず本番で undefined になっていた。Metro 経由の開発では動くため気づきにくい。`src/services/__tests__/envAccess.test.ts` で再発防止済み
2. **EAS に環境変数が未登録だった**。`eas env:create` で production/preview に8件登録済み
3. **地図の全国スケールクラッシュは Apple Maps のタイルメモリ起因**とみられ、アプリコード側（マーカー churn・スナップショット機構・無限アニメリーク）は追補1〜3で潰し切った。解禁は P1-07

## 次のアクション（優先順・2026-08-02 にユーザーと合意）

1. ~~P1-08 初回体験の改善~~ — **完了**（Issue #102 / PR #103、2026-08-02）
2. **P2-01 限定御朱印ウォッチャー MVP** — direction.md では Phase 2 だが**差別化の本丸のため繰り上げ**。App Store の「御朱印」45アプリは全て記録アプリで、限定御朱印情報を自動収集するものは存在しない。土台は既存（`extract-spot-info` Edge Function が Claude Haiku 4.5 で構造化 + `spot_aggregated_info` テーブル）。MVP は rank5 の数十件に情報ソース URL を人手登録 → 巡回 → アプリ内表示まで。通知・課金は次段階。SNS スクレイピングは規約に注意し公式サイト/RSS 中心で。**契約書の段階でデータ整備の運用（誰がどう URL を登録するか）も決める**
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

## 参照ファイル

- 方針・Phase 0 チェックリスト: `docs/product/direction.md`
- 契約書: `docs/issues/issue-099-map-clustering.md`（追補1〜4 が最も学びが多い）/ `issue-096-map-viewport-topn.md` / `issue-093-map-spot-display-fixes.md`
- ストア関連: `docs/project/store-metadata.md`（掲載情報の確定値）/ `store-account-setup.md` / `release-guide.md`
- ハーネス状態: `.claude/harness/feature-list.json` / `progress.md`
