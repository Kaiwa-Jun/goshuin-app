# 開発ワークフロー

## 概要

このプロジェクトは、TDD（テスト駆動開発）と仕様駆動開発を組み合わせた開発フローを採用しています。
Claude Codeと協調して効率的に開発を進めるためのガイドラインです。

## 開発フロー全体像

```
┌─────────────────────────────────────────────────────────────────────┐
│                         開発フロー                                   │
└─────────────────────────────────────────────────────────────────────┘

【Phase 1: 探索・計画】(Plan Mode)
┌────────────────────────────────────────────────────────────────────┐
│ 1. GitHub Issueで機能要件を起票（または口頭で説明）                    │
│ 2. Claude が自動で Plan Mode に入り、コードベースを探索               │
│    └─ Subagent で関連ファイルを調査（main context を汚さない）        │
│ 3. 詳細設計を docs/issues/issue-XXX-*.md に保存                      │
│ 4. /clear でコンテキストクリア                                        │
└────────────────────────────────────────────────────────────────────┘

【Phase 2: TDD実装】(Normal Mode)
┌────────────────────────────────────────────────────────────────────┐
│ docs/issues/*.md を参照して実装開始                                  │
│                                                                     │
│ 1. [Red]    失敗するテストを書く                                     │
│ 2. [Green]  テストが通る最小限の実装                                  │
│ 3. [Refactor] テストを通したままリファクタ                             │
│ 4. 検証: npm test / npm run lint / npm run typecheck                │
└────────────────────────────────────────────────────────────────────┘

【Phase 3: CI/CD】
┌────────────────────────────────────────────────────────────────────┐
│ ローカル (Husky)                                                    │
│ ├─ git commit → [pre-commit] lint-staged (lint + format)           │
│ └─ git push   → [pre-push] typecheck + test                        │
│                                                                     │
│ GitHub Actions                                                      │
│ └─ PR作成     → Claude Code による PR Review + lint + test          │
└────────────────────────────────────────────────────────────────────┘
```

## Phase 1: 探索・計画

### 新機能を実装する前に

1. **要件を明確化**
   - GitHub Issue を作成するか、口頭で要件を説明
   - 不明点があれば Claude に質問させる

2. **Plan Mode で設計**
   - Claude が自動的に Plan Mode に入る（大きな変更の場合）
   - Subagent を使ってコードベースを探索
   - 既存パターンとの整合性を確認

3. **設計ドキュメントを保存**
   - `docs/issues/issue-XXX-feature-name.md` に詳細設計を保存
   - テンプレートは `docs/issues/README.md` を参照

4. **コンテキストをクリア**
   - `/clear` を実行してコンテキストをリセット
   - クリーンな状態で実装を開始

## Phase 2: TDD 実装

### Red → Green → Refactor サイクル

1. **Red: 失敗するテストを書く**

   ```typescript
   describe('validateEmail', () => {
     it('should return true for valid email', () => {
       expect(validateEmail('user@example.com')).toBe(true);
     });
   });
   ```

2. **Green: テストを通す最小限の実装**

   ```typescript
   export function validateEmail(email: string): boolean {
     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
   }
   ```

3. **Refactor: コードを改善**
   - テストが通ったままリファクタリング
   - 重複を除去、命名を改善

### 検証コマンド

```bash
# テスト実行
npm test

# 特定ファイルのみ
npm test -- --testPathPattern="filename"

# lint チェック
npm run lint

# 型チェック
npm run typecheck
```

## Phase 3: CI/CD

### ローカル (Husky)

| Hook       | 実行タイミング  | 内容                            |
| ---------- | --------------- | ------------------------------- |
| pre-commit | `git commit` 時 | lint-staged (ESLint + Prettier) |
| pre-push   | `git push` 時   | typecheck + test                |

### GitHub Actions

PR作成時に自動実行:

1. **Claude PR Review** - コードレビュー
2. **Lint & Type Check** - 静的解析
3. **Test** - テスト実行

## Claude Code の設定

### Skills（自動適用）

| Skill             | 説明                                |
| ----------------- | ----------------------------------- |
| `project-context` | プロジェクト固有の知識              |
| `tdd-workflow`    | TDD のガイドライン                  |
| `plan-to-docs`    | 設計→ドキュメント保存のワークフロー |

### Subagents（調査用）

| Agent               | 用途                                       |
| ------------------- | ------------------------------------------ |
| `codebase-explorer` | コードベース探索（main contextを汚さない） |
| `security-reviewer` | セキュリティレビュー                       |

### Hooks（自動実行）

- **PostToolUse (Edit|Write)**: 編集後に自動で ESLint --fix を実行

## セットアップ

### 初回セットアップ

```bash
# 依存関係インストール
npm install

# Husky の初期化
npm run prepare
```

### GitHub Actions の準備

1. リポジトリの Settings → Secrets and variables → Actions
2. `ANTHROPIC_API_KEY` を追加

## ベストプラクティス

### コンテキスト管理

- **タスク間で `/clear`** - 無関係なコンテキストを持ち越さない
- **Subagent で調査** - main context を汚さずに探索
- **2回以上の修正で `/clear`** - 失敗アプローチが溜まったらリセット

### 効果的なプロンプト

```
# Good: 検証手段を含む
「validateEmail関数を実装して。テストケース: user@example.comはtrue、invalidはfalse。
テストを書いてから実装して、テストが通ることを確認して」

# Bad: 検証なし
「メール検証関数を作って」
```

### PRの作成

```
# Good: 具体的な指示
「このブランチの変更をコミットして、PRを作成して。
変更内容をサマリにまとめて」

# Bad: 曖昧
「PRお願い」
```
