# Issue #17: 御朱印詳細画面の機能拡充（編集・削除・ピンチズーム）

## 概要

既存の `StampDetailScreen` は読み取り専用の基本表示のみ実装済み。本 Issue では以下の機能を追加する:

1. **ピンチズーム対応**のフルサイズ画像表示
2. **編集機能**: 訪問日・メモの更新
3. **削除機能**: 確認ダイアログ付き、Supabase からデータ・画像の完全削除

## 関連ドキュメント

- [要件定義](../product/requirements.md)
- [技術設計](../technical/tech-design.md)
- [UI設計 v6](../design/ui-design.md) - セクション 4.8 御朱印詳細

## 現状の実装状況

`StampDetailScreen` は Issue #16 で以下が実装済み:

- `fetchStampById` でデータ取得
- 画像表示（`Image` コンポーネント、固定高さ 300px）
- スポット名、種別バッジ（`Badge` コンポーネント）、訪問日、メモ表示
- ローディング・エラー状態
- ナビゲーション（`GalleryStack` の `StampDetail` ルート、`stampId` パラメータ）

## 詳細設計

### 対象ファイル

#### 新規作成

| ファイル                                                            | 説明                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/components/stamp-detail/DeleteConfirmModal.tsx`                | 削除確認モーダル                                           |
| `src/components/stamp-detail/EditStampModal.tsx`                    | 編集モーダル（訪問日・メモ）                               |
| `src/components/stamp-detail/__tests__/DeleteConfirmModal.test.tsx` | 削除確認モーダルのテスト                                   |
| `src/components/stamp-detail/__tests__/EditStampModal.test.tsx`     | 編集モーダルのテスト                                       |
| `src/hooks/useStampDetail.ts`                                       | スタンプ詳細のデータ取得・更新・削除を管理するカスタムhook |
| `src/hooks/__tests__/useStampDetail.test.ts`                        | useStampDetail のテスト                                    |

#### 変更

| ファイル                                           | 変更内容                                                   |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `src/services/stamps.ts`                           | `updateStamp`, `deleteStamp`, `deleteStampImage` 関数追加  |
| `src/services/__tests__/stamps.test.ts`            | 新規関数のテスト追加                                       |
| `src/screens/StampDetailScreen.tsx`                | ピンチズーム画像、ヘッダーに編集・削除ボタン追加、Hook移行 |
| `src/screens/__tests__/StampDetailScreen.test.tsx` | 編集・削除の操作テスト追加                                 |

### サービス層設計

#### updateStamp

```typescript
export async function updateStamp(
  stampId: string,
  params: { visited_at?: string; memo?: string | null }
): Promise<StampWithSpot> {
  const { data, error } = await supabase
    .from('stamps')
    .update(params)
    .eq('id', stampId)
    .select('*, spots!inner(name, type)')
    .single();

  if (error) throw new Error(error.message);
  return data as StampWithSpot;
}
```

#### deleteStampImage

```typescript
export async function deleteStampImage(imagePath: string): Promise<void> {
  const { error } = await supabase.storage.from('goshuin-images').remove([imagePath]);

  if (error) throw new Error(error.message);
}
```

#### deleteStamp

```typescript
export async function deleteStamp(stampId: string, imagePath: string): Promise<void> {
  // 1. Storage から画像を削除
  await deleteStampImage(imagePath);
  // 2. DB からレコードを削除
  const { error } = await supabase.from('stamps').delete().eq('id', stampId);

  if (error) throw new Error(error.message);
}
```

### useStampDetail Hook

```typescript
interface UseStampDetailReturn {
  stamp: StampWithSpot | null;
  isLoading: boolean;
  error: string | null;
  isUpdating: boolean;
  isDeleting: boolean;
  handleUpdate: (params: { visited_at?: string; memo?: string | null }) => Promise<boolean>;
  handleDelete: () => Promise<boolean>;
  refresh: () => void;
}

export function useStampDetail(stampId: string): UseStampDetailReturn;
```

### コンポーネント設計

#### StampDetailScreen の改修

**ヘッダー**: 既存の Header コンポーネントを使用し、`rightElement` に編集・削除アイコンを配置

```
[←] [御朱印詳細] [pencil trash]
```

**画像エリア**: `ScrollView` の `maximumZoomScale`/`minimumZoomScale` でピンチズーム対応

```tsx
<ScrollView
  maximumZoomScale={3}
  minimumZoomScale={1}
  centerContent
  contentContainerStyle={styles.zoomContainer}
>
  <Image source={{ uri }} style={styles.stampImage} resizeMode="contain" />
</ScrollView>
```

#### DeleteConfirmModal

Props:

```typescript
interface DeleteConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  spotName: string;
}
```

#### EditStampModal

Props:

```typescript
interface EditStampModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (params: { visited_at: string; memo: string | null }) => void;
  isUpdating: boolean;
  initialVisitedAt: string;
  initialMemo: string | null;
}
```

## テスト方針

### サービス層テスト

- `updateStamp`: 正常更新、エラー時の throw
- `deleteStampImage`: 正常削除、エラー時の throw
- `deleteStamp`: 画像削除 + DB 削除の順序確認

### Hook テスト

- 初期ロード → データ取得完了
- `handleUpdate` 成功/失敗
- `handleDelete` 成功/失敗

### コンポーネントテスト

- `DeleteConfirmModal`: 表示/非表示、onConfirm 呼び出し、isDeleting 中の disabled
- `EditStampModal`: 表示/非表示、初期値反映、onSave 呼び出し
- `StampDetailScreen`: 編集・削除アイコンタップでモーダル表示

## チーム構成（2名）

### service-implementer

1. `src/services/stamps.ts` — updateStamp, deleteStamp, deleteStampImage 追加
2. `src/services/__tests__/stamps.test.ts` — テスト追加
3. `src/hooks/useStampDetail.ts` — 新規作成
4. `src/hooks/__tests__/useStampDetail.test.ts` — テスト

### ui-implementer

1. `src/components/stamp-detail/DeleteConfirmModal.tsx` + テスト
2. `src/components/stamp-detail/EditStampModal.tsx` + テスト
3. `src/screens/StampDetailScreen.tsx` — 改修（ピンチズーム、編集・削除ボタン、useStampDetail hook 移行）
4. `src/screens/__tests__/StampDetailScreen.test.tsx` — テスト追加

## 注意事項

1. ピンチズームは `ScrollView` の `maximumZoomScale` を使う簡易方式（Expo Go 互換）
2. 削除は Storage → DB の順序で実行（画像孤立防止）
3. RLS は Supabase Auth が自動適用
4. 日付入力は MVP では TextInput で YYYY-MM-DD 形式
5. 削除ボタンは `colors.error`（赤）で破壊的操作を視覚的に示す
