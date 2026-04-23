# Issue #20: エラー画面の実装 -- 残作業

## 概要

エラー画面の基本コンポーネント (`ErrorScreen.tsx`) は実装済み。以下3点の残作業を実装する:

1. **位置情報エラーの「設定を開く」** -- `Linking.openSettings()` で端末設定を開く
2. **ネットワークエラーの「再試行」** -- `goBack()` + `useFocusEffect` パターン
3. **エラー検知と遷移ロジック** -- RecordScreen でのネットワークエラー分類、MapScreen での位置情報オフバナー

## 関連ドキュメント

- [UI設計 セクション4.10](../design/ui-design.md)
- [ナビゲーション型定義](../../src/navigation/types.ts)

## 詳細設計

### 対象ファイル

| ファイル                                      | 変更種別 | 概要                                            |
| --------------------------------------------- | -------- | ----------------------------------------------- |
| `src/screens/ErrorScreen.tsx`                 | 変更     | `handlePrimaryPress` にエラー種別ごとの分岐追加 |
| `src/screens/RecordScreen.tsx`                | 変更     | ネットワークエラー判定を追加                    |
| `src/screens/MapScreen.tsx`                   | 変更     | 位置情報オフバナー追加                          |
| `src/utils/errorClassifier.ts`                | 新規     | ネットワークエラー判定ユーティリティ            |
| `src/screens/__tests__/ErrorScreen.test.tsx`  | 変更     | テストケース追加                                |
| `src/utils/__tests__/errorClassifier.test.ts` | 新規     | ユーティリティのテスト                          |

### 実装方針

#### 1. 位置情報エラーの「設定を開く」ボタン

`ErrorScreen.handlePrimaryPress` 内でエラー種別を分岐し、`location` の場合は `Linking.openSettings()` を呼ぶ:

```typescript
const handlePrimaryPress = () => {
  if (errorType === 'location') {
    Linking.openSettings();
  } else {
    navigation.goBack();
  }
};
```

#### 2. ネットワークエラーの「再試行」メカニズム

**採用: goBack() + useFocusEffect パターン**

- 既存フック (`useCollectionStats`, `useGalleryStamps`) が既に `useFocusEffect` で画面フォーカス時にリフェッチしている
- `navigation.goBack()` で元画面に戻るだけで、フォーカスイベントでリフェッチが走る
- `route.params` にコールバックを渡すのは React Navigation 非推奨（シリアライズ不可）

#### 3. ネットワークエラーの検知

エラーメッセージベースの判定ユーティリティを作成:

```typescript
// src/utils/errorClassifier.ts
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('network error') ||
      msg.includes('timeout')
    );
  }
  return false;
}
```

RecordScreen の `handleConfirm` で利用:

- ネットワーク起因 → `type: 'network'` で遷移
- それ以外 → 従来通り `type: 'upload'` で遷移

#### 4. 位置情報エラーの検知と遷移

MapScreen に位置情報オフのバナーを表示し、タップで `Error` 画面に遷移。
フルスクリーンブロッキングではなく、ソフトな誘導。

`useLocation` の `permissionStatus` は既に公開されているため、追加変更なし。

### ボタン動作まとめ

| エラー種別 | プライマリボタン | 動作                     | セカンダリボタン | 動作                        |
| ---------- | ---------------- | ------------------------ | ---------------- | --------------------------- |
| network    | 再試行           | `goBack()`               | (なし)           | -                           |
| location   | 設定を開く       | `Linking.openSettings()` | あとで設定する   | `goBack()` or `pop(2)`      |
| upload     | 再試行           | `goBack()`               | キャンセル       | `pop(2)` → MapScreen に戻る |

## テスト方針

### 追加テストケース

1. **ErrorScreen**: `type: 'location'` でプライマリボタン押下時に `Linking.openSettings()` が呼ばれること
2. **ErrorScreen**: `type: 'network'` / `type: 'upload'` でプライマリボタン押下時に `goBack()` が呼ばれること
3. **`isNetworkError`**: 各種エラーメッセージの分類テスト
4. **RecordScreen**: ネットワークエラー時に `type: 'network'` で遷移すること

### 既存テスト

- ErrorScreen の6テストケースはすべて維持

## 受入基準（Acceptance Criteria）

### 機能基準

- [ ] AC-1: ErrorScreen で `type: 'location'` のときプライマリボタン「設定を開く」タップで `Linking.openSettings()` が呼ばれる（native-only）
- [ ] AC-2: ErrorScreen で `type: 'network'` のときプライマリボタン「再試行」タップで `navigation.goBack()` が呼ばれる
- [ ] AC-3: RecordScreen でネットワーク起因のエラー発生時、`Error` 画面に `type: 'network'` で遷移する
- [ ] AC-4: RecordScreen でネットワーク起因でないアップロードエラー時、従来通り `type: 'upload'` で遷移する
- [ ] AC-5: MapScreen で位置情報パーミッションが DENIED のとき、位置情報オフバナーが表示される
- [ ] AC-6: MapScreen の位置情報オフバナータップで `Error` 画面に `type: 'location'` で遷移する
- [ ] AC-7: `isNetworkError` が `Network request failed`、`Failed to fetch`、`network error`、`timeout` を正しく判定する

### UI基準

- [ ] UI-1: ErrorScreen の外観は既存実装から変更なし
- [ ] UI-2: MapScreen の位置情報オフバナーは地図上に重畳表示され、タップ可能

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: 既存の ErrorScreen テスト6ケースがすべてパスする

## 注意事項

1. `Linking` は `react-native` から import（追加パッケージ不要）
2. `@react-native-community/netinfo` は導入しない（エラーメッセージベースで対応）
3. MapScreen はメイン画面なのでフルスクリーンエラーに強制遷移しない（バナーでソフトに誘導）
4. `navigation.params` にコールバック関数を渡さない（React Navigation 推奨に従う）
5. テストでの `Linking.openSettings` モックは `jest.spyOn(Linking, 'openSettings')` を使う
