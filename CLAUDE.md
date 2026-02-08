# 御朱印コレクションアプリ - Claude Code 設定

## プロジェクト概要

御朱印集めを趣味とするユーザー向けのモバイルアプリ。
参拝記録と御朱印コレクションを地図上に可視化し、集める楽しさを増幅する。

- **技術スタック**: Expo (React Native) + TypeScript + Supabase
- **ドキュメント**: @docs/README.md

## 開発フロー

### Phase 1. 探索・計画 (Plan Mode)

新機能や大きな変更の場合:

1. Plan Mode で関連コードを探索（Subagentを使用してmain contextを汚さない）
2. 詳細設計を `docs/issues/issue-XXX-*.md` に保存
3. `/clear` でコンテキストをクリア

### Phase 1.5. チーム構成の判断

Issue の規模に応じてエージェントチームを構成するか判断する。
詳細は `tdd-workflow` スキルを参照。

### Phase 2. TDD実装 (Normal Mode)

1. **Red**: 失敗するテストを書く
2. **Green**: テストが通る最小限の実装
3. **Refactor**: テストを通したままリファクタ

### Phase 3. 検証

実装後は必ず以下を実行して検証:

- `npm test` - テスト実行
- `npm run lint` - lint チェック
- `npm run typecheck` - 型チェック

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
1. `/clear` でコンテキストをクリアしてください
2. その後「docs/issues/issue-XXX-yyyy.md を参照して #XX を実装して」と指示してください
---
```

**Phase 1.5（チーム判断）→ チーム構成する場合:**
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
Phase 2（実装）が完了しました。

変更ファイル: （変更したファイルの一覧）

検証結果:
- テスト: OK / NG
- Lint: OK / NG
- 型チェック: OK / NG

次のステップ:
- 問題なければ「commit して push して」と指示してください
- 修正が必要な場合はその内容を伝えてください
---
```

**commit/push 完了時:**
```
---
commit & push が完了しました。

次のステップ:
- 次の Issue に取り掛かる場合は `/clear` してから Issue 番号を指示してください
- PR を作成する場合は「PR を作成して」と指示してください
---
```

**エージェントチーム完了時:**
```
---
チームによる実装が完了しました。

変更ファイル: （変更したファイルの一覧）

検証結果:
- テスト: OK / NG
- Lint: OK / NG
- 型チェック: OK / NG

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

## 重要な参照先

- 要件定義: @docs/product/requirements.md
- 技術設計: @docs/technical/tech-design.md
- UI設計: @docs/design/ui-design.md
- Issue設計テンプレート: @docs/issues/README.md
