---
name: plan-to-docs
description: Plan Modeで作成した設計をドキュメントに保存するワークフロー
---

# 設計ドキュメント保存ワークフロー

## 概要

新機能や大きな変更を実装する前に、Plan Modeで詳細設計を行い、
`docs/issues/` に保存してから実装を開始する。

## ワークフロー

### 1. 要件の確認

ユーザーから機能要件を受け取ったら:

- 不明点があれば質問して明確化
- 関連する既存ドキュメントを参照

### 2. Plan Modeで設計

Plan Modeに入り:

- Subagentを使って関連コードを調査（main contextを汚さない）
- 実装方針を検討
- 影響範囲を特定

### 3. ドキュメント作成

設計内容を `docs/issues/issue-XXX-*.md` に保存:

```markdown
# Issue #XXX: タイトル

## 概要

実装する内容の概要

## 関連ドキュメント

- [要件定義](../product/requirements.md)

## 詳細設計

### 対象ファイル

- src/components/XXX.tsx（新規）
- src/hooks/useXXX.ts（変更）

### 実装方針

1. まずXXXを作成
2. 次にYYYを変更
3. 最後にZZZをテスト

### データ構造

必要な型定義やスキーマ

## テスト方針

- ユニットテスト: XXX
- 統合テスト: YYY

## 注意事項

実装時の注意点
```

### 4. 実装開始

1. `/clear` でコンテキストをクリア
2. 作成したドキュメントを参照して実装開始
3. TDDサイクルで進める

## ファイル命名規則

`issue-{番号}-{概要}.md`

- 番号: GitHub Issue番号（3桁ゼロ埋め）
- 概要: ハイフン区切りの英語

例:

- `issue-001-project-setup.md`
- `issue-002-map-screen.md`
- `issue-003-stamp-registration.md`
