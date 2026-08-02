# セッション引き継ぎ（最終更新: 2026-08-02）

/clear 後の文脈復元用。読み終えたら「次のアクション」から再開する。方針の唯一のソースは `docs/product/direction.md`。

## いま何をしているか（全体像）

御朱印アプリ（Expo + Supabase、v1.0.0）を **iOS 先行でストアリリースする Phase 0** を進めつつ、Phase 1 の地図改善を並行している。開発は `/build-feature` の自律ループ（契約書 → TDD → 機械検証 → goshuin-evaluator → 人間ゲート → PR）で回す。**人間ゲートは push/PR 直前の1箇所のみ**。

## これまでの経緯（2026-08-02、時系列）

1. プロダクト方針 v2 決定: リリース先行 / 差別化4軸の段階導入 / ハイブリッド収益化（direction.md）
2. **PR #91**: 開発ハーネス刷新（/build-feature、planner/evaluator 2体制、Maestro スキャフォールド）
3. **PR #92**: マスタデータ（宮城 DB 同期 + 東京増強99件）→ **DB 適用済み。全1,109件・東京119件（rank5×10/4×23/3×86）検証済み**
4. **PR #94**（Issue #93）: 地図即修正（1,000行フェッチ上限 / visited・wishlist ピン消失 / ズーム境界チラつき）
5. **PR #95**: iOS ビルドの AppCheckCore エラー修正（expo-build-properties, useFrameworks: static）。**これが無いと iOS production ビルドは失敗する**
6. **PR #97**（Issue #96 / P1-05）: 地図をビューポート×rank優先 top-N 方式に再設計（Evaluator 27/27 PASS）→ マージ済み
7. **PR #98**: 巡礼データ（6コース+札所75件）の DB エクスポート + direction.md 追従
8. 実機確認で「概ね良好だが**ズームアウト連続操作でクラッシュ**」が発覚 → **Issue #99（P1-06 クラスタリング恒久対応）起票済み**。原因の見立て・設計方針・ライブラリ選定メモは Issue 本文に記載

## 次のアクション（優先順）

1. **Issue #99（P1-06）を /build-feature で実行** — クラスタリング導入（supercluster 系）+ visited/wishlist のクラスタ除外 + 再選択ヒステリシス。native-only の最重要基準は「実機のズームアウト連続操作でクラッシュしない」
2. Phase 0 残り: App Store スクリーンショット（Xcode 待ち → シミュレータ + Maestro で自動撮影。素材とキャプションは `docs/project/store-metadata.md` の5枚構成）/ iOS production ビルド + EAS Submit クレデンシャル / ストア申請
3. Google Play（本人確認の審査承認メール後）: 電話番号確認 → Playwright ブラウザでアプリ作成 → 掲載情報（store-metadata.md を流し込み）→ 内部テストへ .aab アップロード → クローズドテスト（12人×14日）開始

## ユーザー待ちの項目

- **Xcode インストール**（Mac App Store）→ 完了したらスクショ自動撮影 + P1-01（Maestro 実戦検証）へ
- **Google Play**: 本人確認は審査中（数日・メール通知）。**Android 実機での Play Console アプリログインが未完了**（端末の有無も未確認）
- **App Store Connect API Key** の発行（`docs/project/store-account-setup.md` Step 2）
- iOS 実機クラッシュログの確認（設定 > プライバシーとセキュリティ > 解析と改善 > 解析データ の goshuin 項目）は #99 の裏取りに有用

## 環境・成果物の場所

- **ビルド成果物**: `/Users/kaiwajun/workspace/goshuin-app-artifacts/`（Android .aab v1.0.0/versionCode2 = Play 内部テスト用 / iOS シミュレータ用 tar.gz = スクショ用）
- **dev サーバー**: tmux セッション `goshuin-dev` で起動中（`./scripts/dev.sh stop` で停止、`/dev` で再起動）
- **Playwright ブラウザ**: Play Console ログイン済みセッションが永続プロファイルに残存
- **Supabase**: 読み取りは `.env` の anon キーで REST 直叩き（1リクエスト最大1,000行、Range ヘッダでページング）。**書き込みはユーザーがプライベート Chrome（kj...@gmail.com）の SQL Editor で実行する運用**（Supabase MCP/CLI なし）
- **EAS**: ログイン済み。ビルドは `--non-interactive --no-wait` で投げて `eas build:view <id> --json` をポーリング
- Claude 拡張はプライベート Chrome に未接続（サインインアカウント要確認）。Play Console 操作は Playwright で代替中

## 参照ファイル

- 方針・Phase 0 チェックリスト: `docs/product/direction.md`
- 契約書: `docs/issues/issue-093-map-spot-display-fixes.md` / `issue-096-map-viewport-topn.md`
- ストア関連: `docs/project/store-account-setup.md` / `store-metadata.md` / `release-guide.md`
- ハーネス状態: `.claude/harness/feature-list.json` / `progress.md`
