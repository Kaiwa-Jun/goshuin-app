# 御朱印コレクションアプリ - Claude Code 設定

## プロジェクト概要

御朱印集めを趣味とするユーザー向けのモバイルアプリ。
参拝記録と御朱印コレクションを地図上に可視化し、集める楽しさを増幅する。

- **技術スタック**: Expo (React Native) + TypeScript + Supabase
- **ドキュメント**: @docs/README.md

## 開発フロー

Issue の実装は以下のフローで進める。全フェーズをメインコンテキスト（リーダー）が統括し、
探索・計画・実装はすべてサブエージェントに委譲してメインコンテキストの汚染を防ぐ。

### Phase 1. 探索・計画（サブエージェント委譲）

新機能や大きな変更の場合、**サブエージェントで**探索・計画を行う:

1. Explore / Plan サブエージェントに関連コードの探索と設計を依頼
2. サブエージェントが `docs/issues/issue-XXX-*.md` に詳細設計を保存
3. メインコンテキストはサマリーのみ受け取る（コンテキスト汚染なし）
4. `/clear` 不要でそのまま次フェーズに移行

※ メインコンテキスト自身が Plan Mode で探索しない。必ずサブエージェントに委譲すること。

### Phase 1.5. デザイン取得（Stitch MCP）

UI変更を含む Issue では、Stitch MCP でデザインデータを取得する:

1. `mcp__stitch__list_screens` で対象画面のスクリーンショットURLを取得
2. 設計ドキュメント（`docs/issues/issue-XXX-*.md`）にスクリーンショットURLを記載
3. 細かいスタイル値（グラデーション、影、余白の数値）が必要な場合のみ `mcp__stitch__get_screen` でHTMLコードも取得

**Stitch プロジェクト情報:**

- プロジェクトID: `9044469756277541238`
- テーマ: カスタムカラー `#f27f0d`、フォント Plus Jakarta Sans、角丸フル

**デザイン参照の優先順位:**

1. **スクリーンショット画像**（メイン） — コンテキスト効率が良く、視覚的に忠実
2. **HTMLコード**（補助） — 微妙な色・余白・グラデーション値の確認用
3. **ui-design.md**（仕様） — 画面遷移・UX設計意図の参照用

※ UI変更を含まない Issue ではスキップ可

### Phase 2. チーム構成・TDD実装

Issue の規模に応じてエージェントチームを構成し、TDD で実装する。
チーム構成の判断基準と運用フローは `tdd-workflow` スキルを参照。

**利用可能なサブエージェント:**

- `ui-implementer` - 画面UI + テストを TDD で実装（Sonnet）【Generator】
- `service-implementer` - サービス層 + テストを TDD で実装（Sonnet）【Generator】
- `test-writer` - TDD で単独実装 or 既存コードへのテスト追加（Sonnet）【Generator】
- `qa-evaluator` - Sprint Contract の受入基準に基づく品質検証（Sonnet）【Evaluator】
- `codebase-explorer` - コードベース探索・調査（Haiku）
- `security-reviewer` - セキュリティレビュー（Sonnet）

**t-wada 流 TDD の原則:**

- テストを書く人と実装を書く人を分けない。各メンバーが自領域で Red→Green→Refactor を回す
- ファイル衝突を避けるため、各メンバーの担当ファイルを明確に分割する
- メンバー数は 2〜4人、タスクは 5〜6個/メンバーが目安

小規模な変更（1〜2ファイル）はチームを構成せず、単独のサブエージェントまたはメインコンテキストで TDD 実装する:

1. **Red**: 失敗するテストを書く
2. **Green**: テストが通る最小限の実装
3. **Refactor**: テストを通したままリファクタ

### Phase 2.5. QA評価（qa-evaluator による品質検証）

Phase 2 の実装完了後、**qa-evaluator エージェント**が Sprint Contract の受入基準に基づいて品質検証を行う。

1. リーダーが `qa-evaluator` サブエージェントを起動
2. qa-evaluator が以下を実行:
   - `npm test`, `npm run lint`, `npm run typecheck` の自動検証
   - Playwright MCP で Expo Web (`localhost:8081`) の UI 検証
   - Sprint Contract の受入基準（AC/UI/Q）を1つずつ判定
3. 評価結果を構造化レポートで返却

#### Generator-Evaluator ループ

- **PASS**: Phase 3（最終確認）に進む
- **FAIL**: qa-evaluator のフィードバックを元に Generator（ui-implementer等）が修正
  - 修正後、再度 qa-evaluator が評価
  - **最大5回のループ**。5回で収束しない場合はリーダーが介入して判断

#### 責任分離ルール

| 役割                                               | 責任範囲                             | やってはいけないこと |
| -------------------------------------------------- | ------------------------------------ | -------------------- |
| Generator（ui-implementer, service-implementer等） | TDD実装 + 自己チェック（テスト通過） | 受入基準の合否判定   |
| Evaluator（qa-evaluator）                          | 受入基準に基づく品質検証             | コードの修正         |
| リーダー                                           | 全体統括 + ループ管理                | 実装の直接実行       |

※ UI 変更を含まない Issue（サービス層のみ等）では Playwright による UI 検証をスキップ可

### Phase 3. 最終検証（リーダー確認）

qa-evaluator が PASS 判定を出した後、リーダーが最終確認を行う:

#### 3-1. qa-evaluator レポート確認

- 評価レポートの内容を確認
- 全受入基準が PASS であることを確認

#### 3-2. UI 目視チェック（必要な場合のみ）

qa-evaluator が取得したスクリーンショットで確認が十分な場合はスキップ。
追加で Chrome DevTools MCP による目視確認が必要な場合のみ実施:

1. Expo Web サーバーを起動: `npx expo start --web --port 8081`
2. Chrome DevTools MCP で `http://localhost:8081` にナビゲート
3. 変更した画面のスクリーンショットを取得して確認

**Expo Web の制約事項:**

- 地図背景は Web 非対応（`react-native-maps` はモック）。マーカー・ラベルは確認可能
- カメラ機能は Web 非対応
- スワイプ操作は非対応（ボタン・タブのクリックは OK）

## ユーザーへの次のアクション案内（必須ルール）

**各フェーズの処理が完了したとき、必ず「次にユーザーが何をすべきか」を案内すること。**
ユーザーは開発フローの全体像を覚えていない前提で、具体的なアクションを提示する。

### 案内テンプレート

**Phase 1（計画）完了時:**

```
---
Phase 1（計画）が完了しました。

設計ドキュメント: docs/issues/issue-XXX-yyyy.md

次のステップ:
- チーム構成して実装に進みます（このまま Phase 2 に移行します）
---
```

※ 探索・計画はサブエージェントで実行済みのため `/clear` は不要。

**Phase 2（チーム構成・実装）開始時:**

```
---
この Issue はエージェントチームで並行実装します。
チームを構成して作業を開始します。
（以降はチームが自動で進行します。完了までお待ちください）
---
```

**Phase 2（実装）完了時:**

```
---
Phase 2（実装）が完了しました。qa-evaluator による品質検証を開始します。
（評価結果が出るまでお待ちください）
---
```

**Phase 2.5（QA評価）完了時:**

```
---
Phase 2.5（QA評価）が完了しました。

変更ファイル: （変更したファイルの一覧）

評価結果: PASS / FAIL
- 受入基準: X/Y 合格
- 自動テスト: OK / NG
- Lint: OK / NG
- 型チェック: OK / NG
- UI検証: OK / NG / スキップ（UI変更なし）

{FAIL の場合}
不合格項目のフィードバックを元に修正を行います。
（修正 → 再評価ループに入ります。最大5回）

{PASS の場合}
次のステップ:
- 問題なければ「commit して push して」と指示してください
- 修正が必要な場合はその内容を伝えてください
---
```

**commit/push 完了時:**

commit/push 時に対象の GitHub Issue がある場合は、`gh issue close <番号>` で Issue をクローズすること。

```
---
commit & push が完了しました。
Issue #XX をクローズしました。

次のステップ:
- 次の Issue に取り掛かる場合は `/clear` してから Issue 番号を指示してください
- PR を作成する場合は「PR を作成して」と指示してください
---
```

**エージェントチーム完了時:**

チーム完了時もcommit/push完了時と同様に、対象 Issue をクローズすること。

```
---
チームによる実装が完了しました。

変更ファイル: （変更したファイルの一覧）

検証結果:
- テスト: OK / NG
- Lint: OK / NG
- 型チェック: OK / NG
- UIチェック: OK / スキップ（UI変更なし）

次のステップ:
- 問題なければ「commit して push して」と指示してください
- 修正が必要な場合はその内容を伝えてください
---
```

## コード規約

- ES Modules (import/export) を使用、CommonJS (require) は使わない
- TypeScript strict mode
- コンポーネントは関数コンポーネント + hooks
- スタイルは StyleSheet.create() を使用

## コミット規約

- Conventional Commits 形式: `type(scope): description`
- types: feat, fix, docs, style, refactor, test, chore

## ディレクトリ構造

```
src/
├── components/     # 再利用可能なUIコンポーネント
├── screens/        # 画面コンポーネント
├── hooks/          # カスタムhooks
├── services/       # API・外部サービス連携
├── stores/         # 状態管理
├── types/          # TypeScript型定義
└── utils/          # ユーティリティ関数
```

## EAS Development Build での動作確認

- ネイティブモジュール（Google Sign-In 等）を使用するため、EAS Development Build を使用
- Expo Go では動作しない（ネイティブモジュール非対応）
- ビルドコマンド: `eas build --profile development --platform ios`（クラウドビルド、ローカル Xcode 不要）
- 起動コマンド: `npx expo start --dev-client --tunnel`
- 実機への配布: EAS ビルド完了後、QR コードまたは URL でインストール

## Expo Web での UI チェック環境

Chrome DevTools MCP を使って Expo Web 版のスクリーンショット取得・操作を行う。

**前提条件:**

- Chrome がリモートデバッグモードで起動していること
- 起動方法: Chrome を閉じた後 `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="$TMPDIR/chrome-debug-profile" --no-first-run &`

**Expo Web 起動:**

- `npx expo start --web --port 8081`

**Web 用モック:**

- `metro.config.js` で `react-native-maps` を Web 用スタブ（`src/utils/react-native-maps.web.ts`）に解決
- 地図背景は Web では描画されないが、マーカーやラベル等の UI 要素は確認可能

## 重要な参照先

- 要件定義: @docs/product/requirements.md
- 技術設計: @docs/technical/tech-design.md
- UI設計: @docs/design/ui-design.md
- デザインデータ: @docs/design/stitch.md（Stitch MCP 取り込みガイド）
- Issue設計テンプレート: @docs/issues/README.md
