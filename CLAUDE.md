# 御朱印コレクションアプリ - Claude Code 設定

## プロジェクト概要

御朱印集めを趣味とするユーザー向けのモバイルアプリ。
参拝記録と御朱印コレクションを地図上に可視化し、集める楽しさを増幅する。

- **技術スタック**: Expo (React Native) + TypeScript + Supabase
- **ドキュメント**: @docs/README.md

## 開発フロー

### 1. 探索・計画 (Plan Mode)

新機能や大きな変更の場合:

1. Plan Mode で関連コードを探索（Subagentを使用してmain contextを汚さない）
2. 詳細設計を `docs/issues/issue-XXX-*.md` に保存
3. `/clear` でコンテキストをクリア

### 2. TDD実装 (Normal Mode)

1. **Red**: 失敗するテストを書く
2. **Green**: テストが通る最小限の実装
3. **Refactor**: テストを通したままリファクタ

### 3. 検証

実装後は必ず以下を実行して検証:

- `npm test` - テスト実行
- `npm run lint` - lint チェック
- `npm run typecheck` - 型チェック

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

## 重要な参照先

- 要件定義: @docs/product/requirements.md
- 技術設計: @docs/technical/tech-design.md
- UI設計: @docs/design/ui-design.md
- Issue設計テンプレート: @docs/issues/README.md
