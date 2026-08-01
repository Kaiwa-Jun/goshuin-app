# Maestro E2E テスト

ネイティブ動線（地図・カメラ・位置情報・サインイン・スワイプ）は Jest / Expo Web では検証できない。この領域を [Maestro](https://maestro.dev/) のモバイル E2E で担う。

> **ステータス: ドラフト（未実戦検証）** — `flows/smoke.yaml` は 2026-08 のハーネス刷新で追加したドラフト。feature-list の P1-01 で実機検証・拡充する。セレクタ（タブ名・ボタン文言）は実アプリと突き合わせて修正すること。

## セットアップ

1. **Maestro CLI のインストール**（初回のみ）

   ```bash
   curl -fsSL "https://get.maestro.mobile.dev" | bash
   ```

2. **シミュレータ用 dev ビルドの用意**（初回、またはネイティブ依存変更時）

   ```bash
   eas build --profile development-simulator --platform ios
   ```

   完了後、ビルド成果物（.app）をダウンロードして iOS シミュレータにインストールする（`xcrun simctl install booted <path>.app`）。

3. **Metro を起動**（dev client がバンドルを取得できるように）

   ```bash
   npx expo start --dev-client
   ```

4. **実行**

   ```bash
   npm run e2e            # e2e/flows/ 配下を全実行
   maestro test e2e/flows/smoke.yaml   # 単体実行
   ```

## フローの書き方

- 1フロー = 1動線（スモーク / 記録フロー / ログイン等）。ファイル名は動線名
- `appId: com.goshuin.app` 固定
- オンボーディング等の初回のみ出る画面は `runFlow` + `when: visible` で条件付きスキップする
- 契約書で **native-only** とされた受入基準は、対応するフローをここに追加して検証する
