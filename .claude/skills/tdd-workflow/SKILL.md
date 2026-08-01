---
name: tdd-workflow
description: t-wada流TDD（テスト駆動開発）のワークフローとこのリポジトリでのテスト規約
---

# TDDワークフロー（t-wada流）

## 核心原則

- **テストを書く人と実装を書く人を分けない**。同じ作業者が Red → Green → Refactor を回す
- サイクルは小さく。大きくなってきたらスライスを分割する（1スライス = 1コミット）
- 受入基準の合否判定は自分でやらない（それは goshuin-evaluator の仕事）。自分の責任は「テストが通ること」まで

## 基本サイクル

### 0. TODOリストを作る

実装対象の契約書から、テストケースの TODO リストを作成。**簡単なケースから始めて、徐々に複雑なケースへ。**

```
TODO:
- [ ] 訪問数が0の場合は「1箇所目！」と表示する
- [ ] 訪問数が10の場合は「11箇所目！」と表示する
- [ ] バッジ獲得条件を満たす場合はバッジを表示する
```

### 1. Red — 失敗するテストを1つだけ書く

```typescript
describe('getVisitCountText', () => {
  it('訪問数0の場合、「1箇所目！」を返す', () => {
    expect(getVisitCountText(0)).toBe('1箇所目！');
  });
});
```

`npm test -- --testPathPattern="getVisitCountText"` で**失敗を確認**する。

### 2. Green — テストを通す最小限の実装

```typescript
export function getVisitCountText(visitCount: number): string {
  return '1箇所目！'; // 仮実装（Fake It）でOK
}
```

### 3. Refactor — テストを通したまま整理

### 4. 三角測量 — 次のテストで一般化に追い込む

```typescript
it('訪問数10の場合、「11箇所目！」を返す', () => {
  expect(getVisitCountText(10)).toBe('11箇所目！');
});
```

## t-wada流の重要テクニック

- **仮実装（Fake It）**: まずハードコードで Green にし、次のテストで一般化に追い込む
- **三角測量（Triangulation）**: 2つ以上のテストで実装を正しい方向に導く
- **明白な実装（Obvious Implementation）**: 実装が明白なら直接書いてよいが、テストが失敗したら仮実装に戻る

## このリポジトリのテスト規約

- テストは対象と同階層の `__tests__/` に置く: `src/screens/__tests__/MapScreen.test.tsx`
- Jest + `jest-expo` preset + `@testing-library/react-native`
- expo モジュール（camera / location / image-picker 等）と Supabase のモックは `jest.setup.js` に集約済み。**個別テストで場当たり的に再モックしない**。不足があれば jest.setup.js に追加する
- 新しい画面・hook・サービスには必ず対応するテストを作る（既存はテスト:実装 ≈ 1.1:1）
- TDD 中は `npm test -- --testPathPattern="..."` で対象のみ、最終確認で `npm test` 全件
- **1テスト1アサーション**を心がけ、**Arrange-Act-Assert** で構造化。エッジケース（ネットワークエラー / 位置情報拒否 / 未ログイン）を必ず含める。モックは最小限に
- ネイティブ動線（カメラ・地図操作・サインイン）は Jest では検証しきれない。契約書で native-only と明示し、Maestro フロー（`e2e/flows/`）か実機確認に割り当てる
