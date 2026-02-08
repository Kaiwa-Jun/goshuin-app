---
name: tdd-workflow
description: TDD（テスト駆動開発）のワークフローとガイドライン
---

# TDDワークフロー

## 実装開始前: ブランチ作成（必須）

実装を開始する前に、**必ず develop ブランチから feature ブランチを切る**。

```bash
git checkout develop
git pull origin develop
git checkout -b feature/issue-{番号}-{概要}
```

**ブランチ命名規則**: `feature/issue-{番号}-{概要}`

- 例: `feature/issue-004-project-setup`
- 例: `feature/issue-012-map-screen`

**注意**: main ブランチには直接コミットしない。develop へ PR を出してマージする。

## 実装開始前: チーム構成の判断

Issue の実装に着手する前に、**エージェントチームを構成すべきかどうかを判断する**。

### チームを構成すべき条件（いずれかに該当する場合）

1. **3つ以上の独立したファイル群を並行で作成・変更する**
   - 例: フロントエンド（画面UI）+ バックエンド（サービス層）+ テスト を同時に作る
2. **複数の専門領域にまたがる調査・レビューが必要**
   - 例: セキュリティ + パフォーマンス + テストカバレッジの並行レビュー
3. **複数の仮説を並行で検証するデバッグ**
   - 例: 原因不明のバグで複数の可能性を同時に調査

### チームを構成すべきでない条件

- 1〜2ファイルの単純な変更
- 順序依存のタスク（前の結果が次に必要）
- 同じファイルを複数人で編集する必要がある場合

### チーム構成ルール

チームを構成する場合は、以下のルールに従う。

#### メンバー構成

| ロール           | モデル | 説明                                                     |
| ---------------- | ------ | -------------------------------------------------------- |
| リーダー（自分） | Opus   | タスク分割・割り当て・統合。デリゲートモードで調整に専念 |
| 実装メンバー     | Sonnet | 各担当領域のコード実装。1メンバー1領域                   |
| テストメンバー   | Sonnet | テストコードの作成（必要な場合のみ別メンバーにする）     |
| レビューメンバー | Sonnet | コードレビュー・セキュリティチェック（必要な場合のみ）   |

#### 基本方針

- **メンバーは全員 Sonnet を使用する**（リーダーのみ Opus）
- **1メンバーにつき1つの明確な担当領域**を割り当てる
- **ファイルの衝突を避ける**: 各メンバーが編集するファイルが重複しないよう分割
- **メンバー数は最小限に**: 2〜4人程度。多すぎると調整コストが利益を上回る
- **タスクは5〜6個/メンバー**: 各メンバーが効率的に作業を進められるサイズ
- **プラン承認を要求**: 複雑なタスクではメンバーにプラン承認モードを設定

#### チーム構成例

**画面実装の場合（例: 地図画面 #12）:**

```
チームを作成して地図画面を実装してください。
- メンバー1（ui）: 地図コンポーネントとUI実装（src/screens/, src/components/map/）
- メンバー2（service）: Supabaseデータ取得サービス（src/services/, src/hooks/）
- メンバー3（test）: テストコード作成（src/**/__tests__/）
各メンバーにはSonnetを使ってください。
メンバーが実装を始める前にプラン承認を要求してください。
```

**調査・レビューの場合:**

```
チームを作成してPR #XXX をレビューしてください。
- メンバー1: セキュリティの観点でレビュー
- メンバー2: パフォーマンスの観点でレビュー
- メンバー3: テストカバレッジの確認
各メンバーにはSonnetを使ってください。
互いの発見を共有して議論してください。
```

#### チーム運用の流れ

1. リーダーがタスクリストを作成し、メンバーに割り当てる
2. リーダーはデリゲートモード（Shift+Tab）で調整に専念
3. メンバーが作業を完了したら、リーダーが結果を統合
4. 全タスク完了後、チームをシャットダウン＆クリーンアップ

## 基本サイクル: Red → Green → Refactor

チームを構成しない場合（または各メンバーの作業単位で）、以下のTDDサイクルで実装する。

### 1. Red（失敗するテストを書く）

```typescript
// まず失敗するテストを書く
describe('validateEmail', () => {
  it('should return true for valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('should return false for invalid email', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

テストを実行して**失敗することを確認**:

```bash
npm test -- --testPathPattern="validateEmail"
```

### 2. Green（テストを通す最小限の実装）

```typescript
// テストを通す最小限のコード
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

テストが**通ることを確認**:

```bash
npm test -- --testPathPattern="validateEmail"
```

### 3. Refactor（リファクタリング）

- テストが通ったままコードを改善
- 重複を除去、命名を改善、構造を整理
- リファクタ後も必ずテストを実行

## テスト実行コマンド

```bash
# 全テスト実行
npm test

# 特定のファイルのみ
npm test -- --testPathPattern="filename"

# watch モード
npm test -- --watch
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

## テスト作成のポイント

1. **1テスト1アサーション** を心がける
2. **エッジケース**を必ずテスト
3. **Given-When-Then** パターンで読みやすく
4. **モックは最小限**に（実装の詳細に依存しない）

## 実装完了後: commit → push → PR（一連で実行）

ユーザーから「commit して push して」と指示されたら、以下を一連で実行する。

### 1. commit & push

```bash
git add <変更ファイル>
git commit -m "feat(scope): 説明 (#Issue番号)"
git push -u origin feature/issue-{番号}-{概要}
```

### 2. PR 作成（develop へマージ）

push と同時に、develop ブランチへの PR を作成する。

```bash
gh pr create --base develop --title "タイトル" --body "..."
```

**PR のベースブランチは必ず `develop`** にする（main ではない）。

### 3. ユーザーへの案内

PR の URL を含めて案内する（案内テンプレートは CLAUDE.md を参照）。

## PR マージ後: Issue クローズ

ユーザーから「マージして」と指示されたら、以下を一連で実行する。

### 1. PR をマージ

```bash
gh pr merge {PR番号} --merge
```

### 2. 対象 Issue をクローズ

マージ完了後、今回の実装対象となっている GitHub Issue を確認し、クローズする。

```bash
gh issue close {Issue番号} --comment "Closed via PR #{PR番号}"
```

**Issue 番号の特定方法**:

- ブランチ名 `feature/issue-{番号}-{概要}` から番号を取得
- または PR タイトル・コミットメッセージ内の `#Issue番号` から取得

### 3. ユーザーへの案内

```
---
マージ & Issue クローズが完了しました。

PR: {PR の URL}（マージ済み）
Issue: #{Issue番号}（クローズ済み）

次のステップ:
- 次の Issue に取り掛かる場合は `/clear` してから Issue 番号を指示してください
---
```
