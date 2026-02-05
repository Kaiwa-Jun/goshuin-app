---
name: tdd-workflow
description: TDD（テスト駆動開発）のワークフローとガイドライン
---

# TDDワークフロー

## 基本サイクル: Red → Green → Refactor

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
