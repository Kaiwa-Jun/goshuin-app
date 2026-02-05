---
name: project-context
description: 御朱印アプリのプロジェクト固有の知識とコンテキスト
---

# プロジェクトコンテキスト

## アプリ概要

- **コンセプト**: 「集めるたび、地図があなたの旅になる。」
- **対象**: 御朱印集めを趣味とするユーザー
- **コア体験**: 地図上に旅の足跡が残る達成感

## 技術スタック

- **モバイル**: Expo (React Native) + TypeScript
- **バックエンド**: Supabase (Auth, Database, Storage)
- **地図**: React Native Maps

## データベース構造

主要テーブル:

- `users` - ユーザー情報
- `spots` - 神社・寺院（type: shrine/temple）
- `stamps` - 御朱印記録
- `goshuincho` - 御朱印帳（将来実装）

## 重要な設計判断

1. **御朱印画像は必須** - 画像なしは単なるチェックインになるため
2. **検索半径はデフォルト2-3km** - 候補が少なければ自動拡大
3. **登録目標は10秒以内** - シンプルなUXを重視
4. **神社+寺院の両方を対象** - テーブル名は `spots`

## ドキュメント参照

詳細は以下を参照:

- 要件定義: @docs/product/requirements.md
- 技術設計: @docs/technical/tech-design.md
- UI設計: @docs/design/ui-design.md
