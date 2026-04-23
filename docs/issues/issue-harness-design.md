# ハーネス設計パターンの導入

## 概要

Anthropic の記事「Harness Design for Long-Running Application Development」に基づき、
Generator-Evaluator 分離パターンを本プロジェクトの開発フローに導入する。

## 背景

従来の開発フローでは、各 Generator エージェント（ui-implementer, service-implementer）が
自分で TDD サイクルを回して自己完結していた。これには以下の問題がある:

1. **自己評価バイアス**: 自分が作ったものを自分で評価すると甘くなる
2. **受入基準の曖昧さ**: 設計ドキュメントに「何ができたら成功か」の具体的基準がない
3. **UI 検証の手動実行**: リーダーが Chrome DevTools MCP で手動確認しており、自律的でない

## 変更内容

### 1. qa-evaluator エージェントの新設

- **ファイル**: `.claude/agents/qa-evaluator.md`
- **役割**: Sprint Contract の受入基準に基づく品質検証
- **ツール**: Read, Bash, Grep, Glob（Edit/Write なし = コード修正不可）
- **メインツール**: Playwright MCP（Expo Web の自動テスト）
- **補助ツール**: Chrome DevTools MCP（スクリーンショット取得）

### 2. Sprint Contract テンプレートに受入基準セクション追加

- **ファイル**: `docs/issues/README.md`
- **追加セクション**: 受入基準（Acceptance Criteria）
  - 機能基準（AC-1, AC-2, ...）
  - UI基準（UI-1, UI-2, ...）
  - 品質基準（Q-1, Q-2, Q-3）
- **記載ルール**: 検証可能な具体的条件、主観的表現の排除

### 3. CLAUDE.md の開発フロー改修

- **Phase 2.5** を新設: qa-evaluator による品質検証フェーズ
- **Generator-Evaluator ループ**: FAIL→修正→再評価（最大5回）
- **責任分離ルール**: Generator=実装+自己チェック、Evaluator=受入基準判定
- **Phase 3** を軽量化: リーダーの最終確認のみ
- 案内テンプレートに Phase 2.5 完了時を追加

### 4. tdd-workflow スキルの改修

- チーム構成テーブルに qa-evaluator（Evaluator）を追加
- Generator-Evaluator 責任分離セクションを追加
- チーム運用フローのステップ 7-10 を更新

### 5. Playwright MCP の導入

- settings.json に Playwright MCP のパーミッション追加
- MCP サーバー設定は `~/.claude.json` に追加（ユーザー手動）

## Playwright MCP セットアップ手順

ユーザーが手動で実行する必要がある:

```bash
# ~/.claude.json の mcpServers セクションに追加
{
  "playwright": {
    "type": "stdio",
    "command": "npx",
    "args": ["@anthropic/mcp-server-playwright"]
  }
}
```

※ パッケージ名は実際の npm レジストリで確認の上、調整が必要な場合がある。

## 開発フロー（変更後）

```
Phase 1.   探索・計画（サブエージェント委譲）
Phase 1.5. デザイン取得（Stitch MCP）
Phase 2.   チーム構成・TDD実装【Generator】
Phase 2.5. QA評価【Evaluator】← 新設
  └─ FAIL → Generator 修正 → 再評価（最大5回ループ）
Phase 3.   最終検証（リーダー確認）← 軽量化
```
