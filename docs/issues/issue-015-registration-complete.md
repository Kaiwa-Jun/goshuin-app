# Issue #15: 登録完了画面の実装（バッジあり/なし）

## 概要

御朱印登録完了後に表示される達成感演出画面を実装する。現在の `RecordCompleteScreen` は骨格（スケルトン）のみ実装されており、以下の機能が不足している:

1. **visitCount が RecordScreen から渡されていない** -- RecordScreen の `handleConfirm` で `visitCount` パラメータが未設定
2. **バッジ獲得判定ロジックが存在しない** -- 現在はハードコードで「初めての御朱印」バッジを常時表示
3. **バッジ表示/非表示の条件分岐がない** -- バッジなしパターンの画面が実装されていない
4. **背景グラデーションが未実装** -- 仕様では orange-400 から orange-500 のグラデーションだが、現在は単色
5. **紙吹雪演出がない** -- Rive 差し替え前の簡易アニメーション
6. **地図画面に戻った際のピン出現アニメーションがない**

## 関連ドキュメント

- [要件定義](../product/requirements.md) -- 登録完了演出の仕様
- [技術設計](../technical/tech-design.md) -- stamps テーブル構造
- [UI設計 v6](../design/ui-design.md) -- セクション 4.6 登録完了画面

## 詳細設計

### 対象ファイル

#### 新規作成

| ファイル                                     | 説明                               |
| -------------------------------------------- | ---------------------------------- |
| `src/services/badges.ts`                     | バッジ定義とバッジ獲得判定ロジック |
| `src/services/__tests__/badges.test.ts`      | badges サービスのテスト            |
| `src/types/badge.ts`                         | バッジ関連の型定義                 |
| `src/components/animated/ConfettiEffect.tsx` | 紙吹雪演出コンポーネント           |

#### 変更

| ファイル                                              | 変更内容                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/screens/RecordCompleteScreen.tsx`                | バッジ条件分岐、グラデーション背景、visitCount 表示改善、紙吹雪演出統合 |
| `src/screens/__tests__/RecordCompleteScreen.test.tsx` | バッジあり/なしパターンのテスト拡充                                     |
| `src/screens/RecordScreen.tsx`                        | handleConfirm で visitCount を取得して RecordComplete に渡す            |
| `src/screens/__tests__/RecordScreen.test.tsx`         | visitCount パラメータ渡しのテスト追加                                   |
| `src/components/animated/BadgeAnimation.tsx`          | アニメーション追加、表示/非表示の制御                                   |
| `src/components/animated/CheckmarkAnimation.tsx`      | アニメーション追加（フェードイン + スケール）                           |
| `src/components/__tests__/animated.test.tsx`          | ConfettiEffect テスト追加                                               |
| `src/navigation/types.ts`                             | RecordComplete のパラメータに badge 情報を追加                          |

### 実装方針

#### コンポーネント構成

```
RecordCompleteScreen
  +-- CheckmarkAnimation (フェードイン + スケールアニメーション)
  +-- ConfettiEffect (紙吹雪演出、将来Rive差し替え)
  +-- Image (御朱印画像)
  +-- Text (スポット名)
  +-- Text (訪問箇所数)
  +-- BadgeAnimation (条件付き表示 + スケールインアニメーション)
  +-- ActionButtons (もう1枚記録 / 地図を見る / コレクションを確認)
```

#### 状態管理・データフロー

```
RecordScreen
  |-- submit() で stamp 作成
  |-- fetchVisitedSpotIds() で記録前の訪問済みスポットID一覧を取得
  |-- previousCount = visitedSpotIds.size
  |-- stamp を作成
  |-- isNewSpot = !visitedSpotIds.has(selectedSpot.id)
  |-- currentCount = isNewSpot ? previousCount + 1 : previousCount
  |-- evaluateNewBadge(previousCount, currentCount) でバッジ判定
  |-- navigation.navigate('RecordComplete', {
        stampImageUrl, spotName, visitCount: currentCount, badge
      })

RecordCompleteScreen
  |-- route.params から受け取る
  |-- badge が存在すれば BadgeAnimation を表示（バッジありパターン）
  |-- badge が存在しなければ非表示（バッジなしパターン）
```

#### 背景グラデーション

`expo-linear-gradient` を使用:

```tsx
<LinearGradient
  colors={[colors.primary[400], colors.primary[500]]}
  style={styles.container}
>
```

### 型定義

#### `src/types/badge.ts`

```typescript
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: BadgeCondition;
}

export interface BadgeCondition {
  type: 'visit_count';
  threshold: number;
}

export interface EarnedBadge {
  badge: Badge;
  earnedAt: string;
}
```

#### navigation/types.ts の変更

```typescript
RecordComplete: {
  stampImageUrl?: string;
  spotName?: string;
  visitCount?: number;
  badge?: { name: string; description: string } | null;
} | undefined;
```

### バッジ獲得判定ロジック

MVP では訪問箇所数ベースの単純なバッジのみ:

| バッジID    | 名前           | 閾値 |
| ----------- | -------------- | ---- |
| first-stamp | 初めての御朱印 | 1    |
| visit-5     | 5箇所達成      | 5    |
| visit-10    | 10箇所達成     | 10   |
| visit-30    | 御朱印マスター | 30   |
| visit-50    | 巡礼者         | 50   |
| visit-100   | 全国制覇       | 100  |

判定: `previousCount < threshold <= currentCount` のバッジのうち、最も高い閾値のものを1つ返す。

### アニメーション設計

- **CheckmarkAnimation**: フェードイン + スケール (0.3→1.0, 600ms)
- **ConfettiEffect**: 10-15個の色付き矩形を上から降らせる (2000ms, 一回再生)
- **BadgeAnimation**: 1000ms遅延後にスケールイン (0→1.1→1.0) + フェードイン

## テスト方針

### badges.ts

- `evaluateNewBadge(0, 1)` -> 「初めての御朱印」
- `evaluateNewBadge(4, 5)` -> 「5箇所達成」
- `evaluateNewBadge(0, 10)` -> 「10箇所達成」（最も高い閾値のみ）
- `evaluateNewBadge(5, 5)` -> null（再訪問）
- `evaluateNewBadge(10, 11)` -> null（閾値を跨がない）

### RecordCompleteScreen

- バッジなし: BadgeAnimation が表示されない
- バッジあり: バッジ名と説明が表示される
- visitCount の正しい表示
- グラデーション背景の存在確認
- 3つのボタンの遷移先

### RecordScreen

- submit 成功後に visitCount と badge を含めて RecordComplete に遷移

## チーム構成（3名）

| メンバー    | サブエージェント      | 担当領域                                                            |
| ----------- | --------------------- | ------------------------------------------------------------------- |
| service-dev | `service-implementer` | バッジ判定サービス + 型定義 + RecordScreen の visitCount/badge 連携 |
| ui-dev      | `ui-implementer`      | RecordCompleteScreen の UI 改修 + アニメーションコンポーネント      |
| test-dev    | `test-writer`         | RecordCompleteScreen のテスト拡充                                   |

### タスク分割

#### service-dev: バッジ判定サービス + RecordScreen 連携

担当ファイル:

- `src/types/badge.ts` (新規)
- `src/services/badges.ts` (新規)
- `src/services/__tests__/badges.test.ts` (新規)
- `src/navigation/types.ts` (変更)
- `src/screens/RecordScreen.tsx` (変更)
- `src/screens/__tests__/RecordScreen.test.tsx` (変更)

タスク:

1. Badge 型定義の作成
2. バッジ定義と evaluateNewBadge ロジックの TDD 実装
3. navigation/types.ts の RecordComplete パラメータ拡張
4. RecordScreen の handleConfirm に visitCount 計算 + バッジ判定追加 + テスト更新
5. getAllBadges 関数の実装

#### ui-dev: 画面 UI + アニメーション

担当ファイル:

- `src/screens/RecordCompleteScreen.tsx` (変更)
- `src/components/animated/CheckmarkAnimation.tsx` (変更)
- `src/components/animated/BadgeAnimation.tsx` (変更)
- `src/components/animated/ConfettiEffect.tsx` (新規)
- `src/components/__tests__/animated.test.tsx` (変更)

タスク:

1. ConfettiEffect コンポーネントの TDD 実装
2. CheckmarkAnimation のアニメーション拡張 + テスト
3. BadgeAnimation の条件付き表示 + アニメーション拡張 + テスト
4. RecordCompleteScreen にグラデーション背景を適用
5. RecordCompleteScreen にバッジあり/なし条件分岐 + ConfettiEffect 統合
6. RecordCompleteScreen のテスト更新

#### test-dev: テスト拡充

担当ファイル:

- `src/screens/__tests__/RecordCompleteScreen.test.tsx` (変更)

タスク:

1. バッジなしパターンのテスト
2. バッジありパターンのテスト
3. visitCount の各パターンテスト
4. グラデーション背景の存在確認テスト
5. 全ボタンの遷移テスト

### 依存関係

```
service-dev (型定義 + navigation/types.ts)
    --> ui-dev (RecordCompleteScreen が badge params を参照)
    --> test-dev (テストで badge params を使用)
```

service-dev のタスク 1-3 を最優先で完了させる。
ui-dev はアニメーションコンポーネントの実装を先行開始可能。
test-dev は既存テストの見直しを先行可能。

## 注意事項

1. `expo-linear-gradient` のインストール確認が必要
2. Animated API で `useNativeDriver: true` を使用（ただし背景色等は false が必要）
3. MVP ではバッジの獲得履歴をDBに保存しない（リアルタイム判定のみ）
4. ピン出現アニメーションは MapScreen 改修を伴うため本 Issue スコープ外
5. テスト内で `expo-linear-gradient` のモックが必要
