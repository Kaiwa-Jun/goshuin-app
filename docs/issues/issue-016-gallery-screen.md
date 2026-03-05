# Issue #16: ギャラリー画面の実装

## 概要

記録した御朱印を3列グリッド表示するギャラリー画面を実装する。
現在の `GalleryScreen` はMOCKデータのスケルトン実装のみで、以下の機能が不足:

1. Supabaseからの実データ取得（スポット名JOIN含む）
2. 実際のソートロジック（日付順/スポット名あいうえお順）
3. 実画像表示（Image コンポーネント）
4. ローディング状態の表示
5. 空の状態表示
6. 無料版制限（直近20件）とプレミアム誘導バナー
7. StampDetailScreen のスタンプ詳細の実データ表示

## 関連ドキュメント

- [要件定義](../product/requirements.md)
- [技術設計](../technical/tech-design.md)
- [UI設計 v6](../design/ui-design.md) - セクション 4.7 ギャラリー画面

## 詳細設計

### 対象ファイル

#### 新規作成

| ファイル                                       | 説明                             |
| ---------------------------------------------- | -------------------------------- |
| `src/hooks/useGalleryStamps.ts`                | ギャラリー用スタンプ一覧取得Hook |
| `src/hooks/__tests__/useGalleryStamps.test.ts` | useGalleryStamps のテスト        |

#### 変更

| ファイル                                           | 変更内容                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/services/stamps.ts`                           | `fetchAllStamps` / `fetchStampById` 関数追加                              |
| `src/services/__tests__/stamps.test.ts`            | 新規関数のテスト追加                                                      |
| `src/screens/GalleryScreen.tsx`                    | MOCK撤廃・実データ接続・Image表示・ローディング・空表示・プレミアムバナー |
| `src/screens/__tests__/GalleryScreen.test.tsx`     | 実データ対応テスト追加                                                    |
| `src/screens/StampDetailScreen.tsx`                | stampId から実データ取得・Image表示                                       |
| `src/screens/__tests__/StampDetailScreen.test.tsx` | 実データ対応テスト追加                                                    |
| `src/types/supabase.ts`                            | `StampWithSpot` 型定義追加                                                |

### サービス層設計

#### fetchAllStamps

```typescript
export interface StampWithSpot extends Stamp {
  spots: { name: string; type: SpotType };
}

export async function fetchAllStamps(userId: string): Promise<StampWithSpot[]> {
  const { data, error } = await supabase
    .from('stamps')
    .select('*, spots!inner(name, type)')
    .eq('user_id', userId)
    .order('visited_at', { ascending: false });
}
```

#### fetchStampById

```typescript
export async function fetchStampById(stampId: string): Promise<StampWithSpot | null> {
  const { data, error } = await supabase
    .from('stamps')
    .select('*, spots!inner(name, type)')
    .eq('id', stampId)
    .single();
}
```

### useGalleryStamps Hook

```typescript
type SortOrder = 'date' | 'spot';

interface UseGalleryStampsReturn {
  stamps: StampWithSpot[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
}

export function useGalleryStamps(sortOrder: SortOrder): UseGalleryStampsReturn;
```

ロジック:

- `useAuth` で userId 取得
- `fetchAllStamps(userId)` 呼び出し
- `sortOrder === 'spot'` → `localeCompare('ja')` でソート
- `totalCount = allStamps.length`
- `stamps = sorted.slice(0, 20)` で無料版制限

### チーム構成

2名構成:

#### service-implementer

- `src/services/stamps.ts` (fetchAllStamps / fetchStampById 追加)
- `src/services/__tests__/stamps.test.ts`
- `src/hooks/useGalleryStamps.ts` (新規)
- `src/hooks/__tests__/useGalleryStamps.test.ts` (新規)
- `src/types/supabase.ts` (StampWithSpot 型追加)

#### ui-implementer

- `src/screens/GalleryScreen.tsx`
- `src/screens/__tests__/GalleryScreen.test.tsx`
- `src/screens/StampDetailScreen.tsx`
- `src/screens/__tests__/StampDetailScreen.test.tsx`

### 注意事項

1. StampWithSpot 型は `src/types/supabase.ts` に追加
2. Image の uri: `getStampImageUrl(stamp.image_path)` で Supabase Storage URL生成
3. 日付フォーマット: `visited_at` → `YYYY/MM/DD` 形式
4. プレミアムバナーのアップグレードボタン: MVP では Alert.alert で代替
5. FlatList `numColumns=3` + `key={sortOrder}` でソート切替時のクラッシュ防止
