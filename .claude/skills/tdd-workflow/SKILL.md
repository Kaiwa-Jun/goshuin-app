---
name: tdd-workflow
description: t-wada流TDD（テスト駆動開発）のワークフローとガイドライン
---

# TDDワークフロー（t-wada流）

## 核心: テストと実装は分離しない

t-wada 流 TDD の最重要原則: **テストを書く人と実装を書く人を分けない。**
各メンバーが自分の担当領域で Red→Green→Refactor サイクルを自律的に回す。

## 実装開始前: チーム構成の判断

Issue の実装に着手する前に、**エージェントチームを構成すべきかどうかを判断する**。

### チームを構成すべき条件（いずれかに該当する場合）

1. **3つ以上の独立したファイル群を並行で作成・変更する**
   - 例: 画面UI + サービス層 を同時に作る
2. **複数の専門領域にまたがる調査・レビューが必要**
   - 例: セキュリティ + パフォーマンス + テストカバレッジの並行レビュー
3. **複数の仮説を並行で検証するデバッグ**
   - 例: 原因不明のバグで複数の可能性を同時に調査

### チームを構成すべきでない条件

- 1〜2ファイルの単純な変更
- 順序依存のタスク（前の結果が次に必要）
- 同じファイルを複数人で編集する必要がある場合

### チーム構成ルール

#### メンバー構成（TDDベース）

各メンバーが**自分の担当領域でテストも実装も書く**。テスト専任メンバーは作らない。

| ロール           | モデル | サブエージェント      | 説明                               |
| ---------------- | ------ | --------------------- | ---------------------------------- |
| リーダー（自分） | Opus   | -                     | タスク分割・割り当て・統合・検証   |
| UI担当           | Sonnet | `ui-implementer`      | 画面UI + そのテストをTDDで実装     |
| サービス担当     | Sonnet | `service-implementer` | サービス層 + そのテストをTDDで実装 |

`test-writer` はTDD全体を1人で進める場合や、既存コードへのテスト追加に使用する。

#### 基本方針

- **各メンバーが自分の領域でTDDサイクルを回す**（テストと実装を分離しない）
- **メンバーは全員 Sonnet を使用する**（リーダーのみ Opus）
- **1メンバーにつき1つの明確な担当領域**を割り当てる
- **ファイルの衝突を避ける**: 各メンバーが編集するファイルが重複しないよう分割
- **メンバー数は 2〜4人**: 多すぎると調整コストが利益を上回る
- **タスクは 5〜6個/メンバー**: 効率的に作業を進められるサイズ

#### チーム運用の流れ

1. リーダーが TeamCreate でチームを作成
2. TaskCreate でタスクリストを作成し、依存関係を設定
3. Task ツールでメンバーを spawn し、team_name を指定
4. メンバーにタスクを割り当て（TaskUpdate で owner 設定）
5. **各メンバーが自分の担当領域で TDD サイクルを回す**
6. メンバーは完了後に TaskUpdate で completed に更新
7. リーダーは結果を統合し、検証コマンドを実行
8. 全タスク完了後、SendMessage で shutdown_request を送信
9. TeamDelete でクリーンアップ

#### チーム構成例（画面実装）

```
Issue #15 の登録完了画面を実装するため、エージェントチームを構成します。

チーム構成:
- ui-worker（ui-implementer）: 画面UI + UIテストをTDDで実装
- service-worker（service-implementer）: バッジ判定ロジック + サービステストをTDDで実装

ファイル分担:
- ui-worker: src/screens/RecordCompleteScreen.tsx, src/components/animated/, + 各__tests__/
- service-worker: src/services/, src/hooks/, + 各__tests__/

各メンバーは Red→Green→Refactor サイクルを厳密に守ること。
```

## 基本サイクル: Red → Green → Refactor

### 0. TODOリストを作る

実装対象の仕様から、テストケースの TODO リストを作成。
**簡単なケースから始めて、徐々に複雑なケースへ進む。**

```
TODO:
- [ ] 訪問数が0の場合は「1箇所目！」と表示する
- [ ] 訪問数が10の場合は「11箇所目！」と表示する
- [ ] バッジ獲得条件を満たす場合はバッジを表示する
- [ ] バッジ獲得条件を満たさない場合はバッジを非表示にする
```

### 1. Red（失敗するテストを1つだけ書く）

```typescript
describe('getVisitCountText', () => {
  it('訪問数0の場合、「1箇所目！」を返す', () => {
    expect(getVisitCountText(0)).toBe('1箇所目！');
  });
});
```

テストを実行して**失敗することを確認**:

```bash
npm test -- --testPathPattern="getVisitCountText"
```

### 2. Green（テストを通す最小限の実装）

```typescript
export function getVisitCountText(visitCount: number): string {
  return '1箇所目！'; // 仮実装（Fake It）でOK
}
```

テストが**通ることを確認**:

```bash
npm test -- --testPathPattern="getVisitCountText"
```

### 3. Refactor

テストが通ったままコードを改善。この段階ではまだ改善不要かもしれない。

### 4. 次のテストで三角測量

```typescript
it('訪問数10の場合、「11箇所目！」を返す', () => {
  expect(getVisitCountText(10)).toBe('11箇所目！');
});
```

このテストが失敗するので、仮実装を一般化に追い込む:

```typescript
export function getVisitCountText(visitCount: number): string {
  return `${visitCount + 1}箇所目！`;
}
```

**このサイクルを小さく繰り返す。**

## テスト実行コマンド

```bash
# 特定のファイルのみ（TDD中はこちらを使う）
npm test -- --testPathPattern="filename"

# 全テスト実行（最終確認時）
npm test
```

## テストファイル配置

```
src/
├── utils/
│   ├── validation.ts
│   └── __tests__/
│       └── validation.test.ts
├── hooks/
│   ├── useAuth.ts
│   └── __tests__/
│       └── useAuth.test.ts
```

## t-wada流の重要テクニック

### 仮実装（Fake It）

まずハードコードで Green にし、次のテストで一般化に追い込む。

### 三角測量（Triangulation）

2つ以上のテストで実装を正しい方向に導く。

### 明白な実装（Obvious Implementation）

実装が明白なら直接書いてよいが、テストが失敗したら仮実装に戻る。

### テスト作成のポイント

1. **1テスト1アサーション** を心がける
2. **エッジケース**を必ずテスト
3. **Arrange-Act-Assert** パターンで構造化
4. **モックは最小限**に（実装の詳細に依存しない）
