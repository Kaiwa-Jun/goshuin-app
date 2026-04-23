---
name: merge-to-develop
description: 実装確認後に PR 作成 → develop へマージ → develop で git pull までを一括実行する。実装完了後のワークフローに使用する。
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(gh *)
---

# PR 作成 → develop マージ → pull ワークフロー

現在のブランチから develop ブランチへの PR 作成・マージ・pull を一括で実行してください。

## 手順

1. **現状確認**: `git status` で未コミットの変更がないことを確認。あればコミットを促す。
2. **PR 作成**: `gh pr create --base develop` で PR を作成。タイトルと本文は変更内容から自動生成。
3. **PR マージ**: `gh pr merge --merge` でマージ。
4. **develop に切り替え**: `git checkout develop`
5. **pull**: `git pull origin develop`
6. **対象 Issue のクローズ**: 対応する GitHub Issue がある場合は `gh issue close <番号>` でクローズ。

## 注意

- 未コミットの変更がある場合は先にコミットするよう案内すること
- マージ後、作業ブランチの削除は行わない（GitHub 側で自動削除される設定に依存）
- Issue 番号はブランチ名やコミットメッセージから推測する。不明な場合はユーザーに確認する。
