---
name: build-feature
description: 機能要望から契約書作成→TDD実装→機械検証→Evaluator検証→人間ゲート→PRまでを一気通貫で進める自律開発ループ。「〜を実装して」「この機能を作って」「/build-feature <機能>」で発動。1回の実行 = 1機能。
---

# /build-feature — 自律開発ループ

入力: 機能要望（短文）、または `.claude/harness/feature-list.json` のエントリ ID。
**1回の実行で扱うのは1機能だけ**。複数機能をまとめて進めない（自律開発の典型的な失敗モード）。

## フロー

### 1. 契約書（Sprint Contract）— goshuin-planner

1. GitHub Issue が無ければ `gh issue create` で作成（タイトル・背景・スコープ）
2. **goshuin-planner** サブエージェントを起動し、`docs/issues/issue-XXX-<slug>.md` を生成させる
3. 契約書を読み、受入基準が機械チェック可能かをリーダー視点で確認。曖昧な基準はこの時点で planner に修正させる

### 2. 実装 — メインループ（TDD）

1. `feature/issue-XXX-<slug>` ブランチを作成
2. t-wada 流 TDD で実装（`tdd-workflow` スキル参照）。1スライス = 1コミット
3. サブエージェントへの委譲は「大きな独立したトラック」が複数ある場合のみ（同時最大2）。それ以外はメインループで実装する

### 3. 機械検証

`npm run lint` / `npm run typecheck` / `npm test` がすべて通ること（husky pre-push でも強制される）。

### 4. Evaluator 検証 — goshuin-evaluator

1. UI 変更を含む場合は Expo Web を起動（`npx expo start --web --port 8081`）してから **goshuin-evaluator** に契約書パスを渡して起動
2. FAIL → punch list に基づいて修正し再評価。**3回で収束しなければ停止してユーザーに状況を報告**（無限ループしない）
3. native-only 項目のスキップ報告は人間ゲートでそのまま提示する

### 5. E2E スモーク（Maestro 環境がある場合）

`npm run e2e` が通ること。native 動線に触れる変更では `e2e/flows/` の対象フローを追加・更新する。実行環境が無い場合はスキップし、その旨をゲートで報告する。

### 6. 人間ゲート（フロー全体で唯一の確認ポイント）

ここまで**すべて自動で進める**。push・PR 作成の直前で一度だけ停止し、以下を提示して承認を待つ:

- 変更ファイル一覧とコミットログ
- 契約書の合否サマリー（Evaluator の最終レポート）
- スクリーンショット証跡（UI 変更時）
- スキップした検証と、その理由（native-only / E2E 環境なし等）

**承認後**: `merge-to-develop` スキルで PR 作成 → マージ → pull → Issue クローズ。

### 7. 記録

- `.claude/harness/feature-list.json` の該当エントリを更新。**`passes: true` にできるのは Evaluator PASS + 全テスト通過の場合のみ**
- `.claude/harness/progress.md` に完了記録を1〜3行で追記（何を作ったか / 契約書パス / PR 番号）

## 原則

- 途中の確認・承認をユーザーに求めない（ゲートは Step 6 の1箇所のみ）
- 未検証のまま「完了」と報告しない。検証できなかったものは「未検証」と明示する
- 契約書に無いスコープを実装しない。やりたくなったら feature-list に追記して次のループに回す
