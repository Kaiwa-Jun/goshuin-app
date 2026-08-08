# Issue #116: P1-03 御朱印帳らしいめくり UI

## 概要

御朱印タブ（`GalleryScreen`）に「めくり表示」を追加し、既存の3列グリッド表示と切り替えられるようにする。めくり表示は **1枚を大きく表示し、左右に隣のページが覗く**形で、覗いている両端が蛇腹の折り目にあたる。最後の御朱印の次に**白紙ページ**を1枚置き、これが記録画面への入口になる。

タブ構成の案3「御朱印帳を主役に」はこのめくり UI が存在することを前提にしているため、**先に本 issue を仕上げ、その完成をもってタブを入れ替える**という段取りをユーザーと合意済み。

## 関連ドキュメント

- モック: `docs/design/mockups/ia-options.html`（画面②めくり / ③白紙 / ④グリッド）
- 監査: `docs/design/ux-audit-2026-08.md`（A-2 和暦 / B-2 記録の入口が地図のみ）
- 方針: `docs/product/direction.md`
- 直前の契約書: `docs/issues/issue-114-bottom-sheet-redesign.md`（`StyleSheet.flatten` による視覚検証の作法をここから引き継ぐ）

---

## スコープ

### やること

- **S-1**: めくり表示（横スワイプ・1枚大きく・左右が覗く）を追加する
- **S-2**: 最後の御朱印の次に白紙ページを1枚置き、タップで記録画面へ遷移させる
- **S-3**: めくり / グリッドの表示切り替えトグルをヘッダー右上に置く
- **S-4**: 選んだ表示を `AsyncStorage` に永続化する（保存ボタンは出さない）
- **S-5**: めくりページのフッターにスポット名と**和暦**の訪問日を出す（監査 A-2 の部分対応）
- **S-6**: 覗いている隣のページをタップするとそのページへ送る（アクセシビリティ + Expo Web での検証イネーブラ）

### スコープ外（実装しないこと）

- **帳面（`goshuincho`）の概念を UI に出すこと**（モック画面①「帳面が並ぶ」）。理由は後述の調査結果 1。本 issue では**全 stamps を1冊とみなす**
- `createStamp` への `goshuincho_id` 付与、既存 stamps の migration、記録フローでの帳面選択
- タブ構成の入れ替え（案3 の適用）。本 issue の完成後に別途行う
- 和暦表示の他画面への展開（記録画面 `RecordScreen:52` 等）。本 issue は**めくりページのフッターのみ**
- 最後に読んだページの記憶。めくり表示は常に1ページ目から始める
- グリッド表示自体の変更（列数・ソート・タップ時の挙動）
- ページめくりの3D アニメーション（紙がめくれる表現）。横スナップのみ

---

## 調査結果（実装方針の前提となる確定事実）

### 1. 既存の御朱印はすべて帳面に紐づいていない

`src/services/stamps.ts:53-79` の `createStamp` は `goshuincho_id` を insert 対象に含めていない。`goshuincho` テーブル自体は存在し（`supabase/migrations/20260208102601_create_goshuincho.sql`）、サインアップ時にデフォルト1冊が作られる（`20260208105312_add_default_goshuincho_on_signup.sql`）が、**stamps 側は全件 `goshuincho_id = null`**。

- → 帳面ごとの表示を作るには「記録フローの改修 + 既存データの backfill migration」がセットで必要。本 issue のスコープ外とし、**全 stamps を1冊として**扱う
- → `src/services/stamps.ts` は 1 行も変更しない

### 2. スワイプ・ページング用のライブラリは未導入

`package.json` に `react-native-reanimated` / `react-native-gesture-handler` / `react-native-pager-view` / carousel 系はいずれも無い。

- → **横 `FlatList` + `snapToInterval`** で組む。ページ幅を画面幅より狭くし `contentContainerStyle` に左右パディングを入れれば「中央1枚 + 両端が覗く」がそのまま作れる
- → 新規ライブラリは追加しない（`package.json` は変更しない）

### 3. 現在ページの追跡は `onMomentumScrollEnd` で行う

`onViewableItemsChanged` は Jest（jest-expo）でイベントを発火させる手段が無い。`onMomentumScrollEnd` なら `fireEvent.scroll` で `nativeEvent.contentOffset.x` を渡して検証できる。

- → インデックスは `Math.round(contentOffset.x / SNAP_INTERVAL)` で求める

### 4. `PageIndicator` は本用途に再利用しない

`src/components/common/PageIndicator.tsx` は `total` の数だけドットを描画する。御朱印が34枚あればドットが34個並ぶ。

- → 進捗表示は**テキスト**（`12 ／ 22`）を正とする。ドット列は使わない。`PageIndicator.tsx` は 1 行も変更しない

### 5. 和暦は `Intl` に頼らず純関数で実装する

Hermes の `Intl` は和暦カレンダー（`ja-JP-u-ca-japanese`）のサポートが環境依存で、実機とテストで結果が食い違うおそれがある。

- → `src/utils/japaneseEra.ts` に純関数を置く。`Date` を経由せず **`YYYY-MM-DD` の文字列を正規表現で分解する**（`new Date(iso).getFullYear()` はタイムゾーンで前日にずれる）

### 6. `AsyncStorage` のテストモックは常に `null` を返す

`jest.setup.js:14-23` の `getItem` は `jest.fn(() => Promise.resolve(null))` で固定。

- → 永続化の受入基準は「`setItem` が期待の引数で呼ばれたこと」と「テスト内で `getItem` をケースごとに上書きしたときの復元挙動」の2方向で書く

### 7. 既存の `GalleryScreen` テストはグリッド前提で書かれている

`src/screens/__tests__/GalleryScreen.test.tsx` は `gallery-list` / `gallery-item-*` / `sort-button` / `empty-state` を直接 assert している。**既定の表示モードをめくりにする**ため、これらのケースは「グリッドに切り替えてから assert する」形に更新が必要。

- → 既存アサーションの**内容は変えない**。モード切り替えの1行を前置きするだけにとどめる

### 8. 既存 testID の互換制約

| testID                                            | 参照元                              | 制約                                         |
| ------------------------------------------------- | ----------------------------------- | -------------------------------------------- |
| `gallery-list`                                    | `GalleryScreen.test.tsx:299`        | グリッドモードで維持する                     |
| `gallery-item-<id>` / `stamp-image-<id>`          | 同 `:139,212`                       | グリッドモードで維持する                     |
| `sort-button`                                     | 同 `:168,197`                       | **グリッドモードでのみ**描画する（後述 A-9） |
| `empty-state`                                     | 同 `:153,283`                       | **グリッドモードでのみ**描画する（後述 A-8） |
| `gallery-guest-empty-state` / `gallery-login-cta` | 同 `:231,257`                       | モードに関係なく維持する                     |
| `gallery-image`                                   | `ImageGalleryModal` 由来・同 `:213` | 維持する                                     |
| `loading-indicator`                               | 同 `:111`                           | 維持する                                     |

### 9. テーマトークン（直値禁止）

| 用途                         | トークン                                                  | 実値      |
| ---------------------------- | --------------------------------------------------------- | --------- |
| ページの紙面                 | `colors.background`                                       | `#FFFFFF` |
| 画面の地色（帳面の外）       | `colors.surface`                                          | `#F9FAFB` |
| 折り目・枠線                 | `colors.gray[200]`                                        | `#E5E7EB` |
| 白紙ページの案内文・アイコン | `colors.gray[400]`                                        | `#9CA3AF` |
| フッターのスポット名         | `colors.gray[800]`                                        | `#1F2937` |
| フッターの日付・ページ番号   | `colors.gray[500]`                                        | `#6B7280` |
| トグルの選択中               | `colors.primary[500]`                                     | `#f27f0d` |
| トグルの未選択               | `colors.gray[400]`                                        | `#9CA3AF` |
| 余白                         | `spacing.xs/sm/md/lg/xl` = 4/8/12/16/20                   |           |
| 角丸                         | `borderRadius.md/lg` = 8/12                               |           |
| 文字                         | `typography.h3`(18/600) / `bodySmall`(14) / `caption`(12) |           |

### 10. `toHaveStyle` は使えない

`@testing-library/jest-native` は未導入。Issue #114 と同じく `StyleSheet.flatten(node.props.style)` で検証する。

---

## 詳細設計

### 対象ファイル

#### 新規

| ファイル                                                       | 内容                                             |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `src/utils/japaneseEra.ts`                                     | `formatJapaneseEraDate(dateStr: string): string` |
| `src/utils/__tests__/japaneseEra.test.ts`                      | 上記のテスト（元号境界を含む）                   |
| `src/hooks/useGalleryViewMode.ts`                              | 表示モードの読み書きと永続化                     |
| `src/hooks/__tests__/useGalleryViewMode.test.ts`               | 上記のテスト                                     |
| `src/components/gallery/GoshuinchoFlipView.tsx`                | めくり表示本体（横 FlatList + スナップ）         |
| `src/components/gallery/GoshuinchoPage.tsx`                    | 1ページ分（御朱印ページ / 白紙ページ）           |
| `src/components/gallery/ViewModeToggle.tsx`                    | めくり / グリッドの切り替えトグル                |
| `src/components/gallery/__tests__/GoshuinchoFlipView.test.tsx` | 上記のテスト                                     |
| `src/components/gallery/__tests__/GoshuinchoPage.test.tsx`     | 上記のテスト                                     |
| `src/components/gallery/__tests__/ViewModeToggle.test.tsx`     | 上記のテスト                                     |

#### 変更

| ファイル                                       | 変更内容                                                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/screens/GalleryScreen.tsx`                | ヘッダーに `ViewModeToggle` を追加。`useGalleryViewMode` でモード分岐。めくりモードでは `GoshuinchoFlipView`、グリッドモードでは既存の `FlatList`。`sort-button` と `empty-state` はグリッドモードのみ |
| `src/screens/__tests__/GalleryScreen.test.tsx` | 既存のグリッド系ケースに「グリッドへ切り替える」1行を前置き。めくりモードのケースを追加。**既存アサーションの内容は変更しない**                                                                        |

#### 変更しないファイル

以下は **1 行も変更しない**。ただし本契約書の「新規」表に挙げたファイルの追加は許可する（`src/hooks/` / `src/utils/` / `src/components/gallery/` への**新規ファイル追加は可**）。

`src/services/` 配下の既存ファイルすべて（特に `stamps.ts`）、`src/hooks/` 配下の既存ファイルすべて（特に `useGalleryStamps.ts` / `useStampDetail.ts`）、`src/components/common/PageIndicator.tsx`、`src/components/common/ImageGalleryModal.tsx`、`src/components/stamp-detail/` 配下すべて、`src/components/spot-detail/` 配下すべて、`src/screens/MapScreen.tsx`、`src/screens/RecordScreen.tsx`、`src/screens/CollectionScreen.tsx`、`src/navigation/` 配下すべて、`src/theme/` 配下すべて、`src/types/` 配下すべて、`supabase/` 配下すべて、`metro.config.js`、`jest.setup.js`、`jest.config.js`、`.eslintrc.js`、`tsconfig.json`、`package.json`。

---

### ページの並びと番号

`useGalleryStamps` は `visited_at` の **降順**（新しい順）で返す。御朱印帳は古い順に綴じていくものなので、**めくり表示では昇順に反転する**。

- ページ 1 = 最も古い御朱印
- ページ N = 最も新しい御朱印
- ページ N+1 = **白紙ページ**（常に末尾に1枚だけ）
- 反転は `GoshuinchoFlipView` 内の `useMemo` で行う。`useGalleryStamps` と `fetchAllStamps` は変更しない
- グリッド表示の並びは**現状のまま**（`sortOrder` に従う）

進捗表示（`flip-page-counter`）:

| ページ                           | 表示                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| 御朱印ページ（i 枚目 / 全 N 枚） | `i ／ N`（全角スラッシュの前後に半角スペース。例 `12 ／ 22`） |
| 白紙ページ                       | `N+1枚目`（例 `23枚目`）                                      |

---

### レイアウト（1枚大きく + 左右が覗く）

```
|<--- SIDE_PADDING --->|<--- PAGE_WIDTH --->|<--- SIDE_PADDING --->|
|   前ページが覗く      |    現在のページ     |   次ページが覗く      |
```

`GoshuinchoFlipView.tsx` で以下を **export** する（テストから参照するため）:

```ts
export const PAGE_WIDTH_RATIO = 0.68; // 画面幅に対するページ幅
export const PAGE_ASPECT_RATIO = 1.5; // 高さ / 幅（縦長の帳面）
export const PAGE_GAP = spacing.md; // 12
export const PEEK_OPACITY = 0.45; // 覗いているページの不透明度
export function computePageLayout(screenWidth: number): {
  pageWidth: number;
  sidePadding: number;
  snapInterval: number;
};
```

- `pageWidth = Math.round(screenWidth * PAGE_WIDTH_RATIO)`
- `snapInterval = pageWidth + PAGE_GAP`
- `sidePadding = Math.round((screenWidth - pageWidth) / 2)`

`FlatList` の設定:

```tsx
<FlatList
  testID="flip-list"
  horizontal
  data={pages}
  keyExtractor={p => p.key}
  snapToInterval={snapInterval}
  snapToAlignment="start"
  decelerationRate="fast"
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{ paddingHorizontal: sidePadding }}
  ItemSeparatorComponent={() => <View style={{ width: PAGE_GAP }} />}
  onMomentumScrollEnd={handleMomentumScrollEnd}
  getItemLayout={(_, index) => ({ length: snapInterval, offset: snapInterval * index, index })}
/>
```

`getItemLayout` は `scrollToIndex`（S-6 の隣ページタップ）を確実に効かせるために必須。

---

### タップの振る舞い（S-6）

| タップ対象                                       | 振る舞い                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| 覗いている隣のページ（`index !== currentIndex`） | `scrollToIndex({ index, animated: true })` でそのページへ送る              |
| 中央の御朱印ページ（`index === currentIndex`）   | `ImageGalleryModal` をそのインデックスで開く（グリッドのタップと同じ挙動） |
| 中央の白紙ページ                                 | `navigation.navigate('Record')`（スポット未選択の記録画面）                |
| 覗いている白紙ページ                             | 記録画面へは行かず、**送るだけ**（誤爆防止）                               |

スワイプは Expo Web で検証できないため、**W 群の受入基準はすべてタップで通せる**ように設計する。スワイプとスナップ物理の検証は N 群（native-only）に置く。

---

### `GoshuinchoPage`（新規）

```tsx
interface GoshuinchoPageProps {
  variant: 'stamp' | 'blank';
  width: number;
  isCurrent: boolean;
  onPress: () => void;
  // variant === 'stamp' のとき必須
  imageUrl?: string;
  spotName?: string;
  visitedAt?: string; // 'YYYY-MM-DD'
  testID?: string;
}
```

- 御朱印ページ: 紙面（`colors.background`・`borderRadius.lg`・`borderWidth: 1` / `colors.gray[200]`）の中に御朱印画像を `resizeMode="contain"` で置き、下に**フッター1行**（スポット名 + 和暦日付）
- 白紙ページ: 同じ紙面に `MaterialIcons` の `photo-camera`（size 32・`colors.gray[400]`）と `ここに御朱印を追加する`（`typography.bodySmall`・`colors.gray[400]`）を中央寄せ
- `isCurrent === false` のとき `opacity: PEEK_OPACITY`
- タップ領域はページ全体（`TouchableOpacity`）

testID:

| 要素                 | testID                          |
| -------------------- | ------------------------------- |
| 御朱印ページ         | `flip-page-<stampId>`           |
| 白紙ページ           | `flip-blank-page`               |
| ページ画像           | `flip-page-image-<stampId>`     |
| フッターのスポット名 | `flip-page-spot-name-<stampId>` |
| フッターの日付       | `flip-page-date-<stampId>`      |

---

### `ViewModeToggle`（新規）

```tsx
interface ViewModeToggleProps {
  mode: GalleryViewMode; // 'flip' | 'grid'
  onChange: (mode: GalleryViewMode) => void;
}
```

- 2つの `TouchableOpacity` を横並び。それぞれ `minHeight: 44` / `minWidth: 44`（タップ領域の下限）
- めくり: `MaterialIcons` の `auto-stories` / testID `view-mode-flip`
- グリッド: `MaterialIcons` の `grid-view` / testID `view-mode-grid`
- 選択中は `colors.primary[500]`、未選択は `colors.gray[400]`
- コンテナの testID は `view-mode-toggle`
- **未ログイン時は描画しない**（ゲスト空状態のみを見せる）

---

### `useGalleryViewMode`（新規）

```ts
export type GalleryViewMode = 'flip' | 'grid';
export const GALLERY_VIEW_MODE_KEY = 'gallery_view_mode';
export const DEFAULT_GALLERY_VIEW_MODE: GalleryViewMode = 'flip';

export function useGalleryViewMode(): {
  viewMode: GalleryViewMode;
  isHydrated: boolean;
  setViewMode: (mode: GalleryViewMode) => void;
};
```

- 初期値は同期的に `DEFAULT_GALLERY_VIEW_MODE`（`'flip'`）。マウント後に `AsyncStorage.getItem` で上書きする
- 保存値が `'flip'` / `'grid'` のいずれでもない場合は既定値のままにする（不正値を握り潰す）
- `setViewMode` は state を即時更新し、`AsyncStorage.setItem` は待たない（`useSearchHistory.addHistory` と同じ作法）
- `isHydrated` は「AsyncStorage の読み出しが完了したか」。**画面の描画をブロックする用途では使わない**（既存テストが同期描画を前提にしているため）。将来の判断材料として返すだけ

---

### `GalleryScreen` の構造

```tsx
<View style={styles.rootContainer}>
  <SafeAreaView edges={['top']}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>御朱印</Text>
      {isAuthenticated && <ViewModeToggle mode={viewMode} onChange={setViewMode} />}
    </View>

    {isAuthenticated && viewMode === 'grid' && (
      <View style={styles.sortRow}>{/* 既存の sort-button */}</View>
    )}

    {!isAuthenticated ? (
      /* 既存のゲスト空状態（無変更） */
    ) : isLoading ? (
      /* 既存の loading-indicator（無変更） */
    ) : viewMode === 'flip' ? (
      <GoshuinchoFlipView
        stamps={stamps}
        onPressStamp={index => setSelectedImageIndex(index)}
        onPressBlank={() => navigation.navigate('Record')}
      />
    ) : stamps.length === 0 ? (
      /* 既存の empty-state（無変更） */
    ) : (
      /* 既存の FlatList（無変更） */
    )}
    {/* EditStampModal / DeleteConfirmModal は無変更 */}
  </SafeAreaView>
  <ImageGalleryModal ... />   {/* 無変更 */}
</View>
```

**`onPressStamp` に渡すインデックスの注意**: `ImageGalleryModal` と `EditStampModal` / `DeleteConfirmModal` は `stamps`（**降順**）のインデックスで動く。めくり表示は昇順に反転しているので、`GoshuinchoFlipView` は**元の `stamps` 配列でのインデックス**を親に渡すこと。反転はあくまで表示順の話で、外に漏らさない。

---

### 和暦（`src/utils/japaneseEra.ts`）

```ts
export function formatJapaneseEraDate(dateStr: string): string;
```

| 期間                     | 元号         | 年の算出                            |
| ------------------------ | ------------ | ----------------------------------- |
| 2019-05-01 以降          | 令和         | `year - 2018`                       |
| 1989-01-08 〜 2019-04-30 | 平成         | `year - 1988`                       |
| 1926-12-25 〜 1989-01-07 | 昭和         | `year - 1925`                       |
| 1926-12-24 以前          | （元号なし） | `YYYY年M月D日` の西暦フォールバック |

- 出力形式: `令和8年5月3日`。**月日はゼロ埋めしない**
- 元号年が 1 のときは `令和元年5月1日` のように **`元年`** と出す
- 入力は `/^(\d{4})-(\d{2})-(\d{2})/` でマッチさせる。マッチしない場合は**空文字を返す**（呼び出し側は日付行を描画しない）
- `new Date()` を経由しない（タイムゾーンで前日にずれるため）

---

## テスト方針

- 新規3コンポーネント + 2 hooks/utils すべてに `__tests__/` の対応ファイルを置く
- `computePageLayout` と `formatJapaneseEraDate` は**純関数として単体テスト**する（レンダリングを介さない）
- スクロール位置の追跡は `fireEvent.scroll(getByTestId('flip-list'), { nativeEvent: { contentOffset: { x: … } } })` で検証する
- `scrollToIndex` の呼び出しは `FlatList` の ref をスパイせず、**「隣ページをタップしたとき `onPress` ハンドラが対象インデックスで呼ばれること」**を境界として検証する（ref のモックは壊れやすい）
- `AsyncStorage` の永続化は `setItem` の呼び出し引数で検証する。復元は `getItem` をケース単位で `mockResolvedValueOnce` して `waitFor` する
- 視覚仕様は `StyleSheet.flatten(node.props.style)` で検証する（`toHaveStyle` は未導入）
- 既存 `GalleryScreen.test.tsx` のグリッド系ケースは `fireEvent.press(getByTestId('view-mode-grid'))` を前置きするだけにとどめ、**アサーション本体は変更しない**

---

## 受入基準（Acceptance Criteria）

### A. 機能（Jest）

**A-1**: `GalleryScreen` をログイン済み・スタンプ3件で描画すると、既定で `flip-list` が存在し `gallery-list` は存在しない
**A-2**: `view-mode-grid` を押すと `gallery-list` が現れ `flip-list` が消える
**A-3**: `view-mode-flip` を押すと `flip-list` が現れ `gallery-list` が消える
**A-4**: 未ログイン時は `view-mode-toggle` を描画しない
**A-5**: 未ログイン時は `gallery-guest-empty-state` と `gallery-login-cta` を描画し、`flip-list` も `gallery-list` も描画しない
**A-6**: `useGalleryStamps` の `isLoading` が `true` のとき `loading-indicator` を描画し、`flip-list` を描画しない
**A-7**: めくりモード・スタンプ0件（ログイン済み）のとき `flip-blank-page` を描画し、`empty-state` は描画しない
**A-8**: グリッドモード・スタンプ0件（ログイン済み）のとき `empty-state` を描画する（既存挙動の維持）
**A-9**: `sort-button` はグリッドモードでのみ描画される（めくりモードでは `queryByTestId('sort-button')` が `null`）
**A-10**: めくり表示のページ順は `visited_at` の昇順（1ページ目が最も古い御朱印）である
**A-11**: めくり表示の末尾に `flip-blank-page` がちょうど1つ存在する
**A-12**: スタンプ N 件のとき `flip-list` の `data` 長は `N + 1` である
**A-13**: 1ページ目を表示している状態で `flip-page-counter` が `1 ／ N` を表示する
**A-14**: `flip-list` に `contentOffset.x = snapInterval * 2` の scroll イベントを送ると `flip-page-counter` が `3 ／ N` になる
**A-15**: 白紙ページまでスクロールすると `flip-page-counter` が `N+1枚目` を表示する（例: 3件なら `4枚目`）
**A-16**: 中央の御朱印ページをタップすると `ImageGalleryModal`（`gallery-image`）が開く
**A-17**: A-16 で渡されるインデックスは**元の `stamps`（降順）でのインデックス**である（昇順の表示位置ではない）
**A-18**: 中央の `flip-blank-page` をタップすると `navigation.navigate` が `'Record'` で呼ばれる
**A-19**: 覗いている隣のページ（`index !== currentIndex`）をタップしても `ImageGalleryModal` は開かず、`navigation.navigate` も呼ばれない
**A-20**: 覗いている `flip-blank-page` をタップしても `navigation.navigate` は呼ばれない
**A-21**: `computePageLayout(390)` が `{ pageWidth: 265, sidePadding: 63, snapInterval: 277 }` を返す
**A-22**: `computePageLayout` の `snapInterval` は常に `pageWidth + PAGE_GAP` に一致する
**A-23**: `useGalleryViewMode` の初期値は同期的に `'flip'` である
**A-24**: `AsyncStorage.getItem` が `'grid'` を返すとき、`useGalleryViewMode` の `viewMode` は `'grid'` になる
**A-25**: `AsyncStorage.getItem` が `'banana'`（不正値）を返すとき、`viewMode` は `'flip'` のままである
**A-26**: `setViewMode('grid')` を呼ぶと `AsyncStorage.setItem` が `('gallery_view_mode', 'grid')` で呼ばれる
**A-27**: `setViewMode('grid')` の直後、`AsyncStorage.setItem` の resolve を待たずに `viewMode` が `'grid'` になっている
**A-28**: `formatJapaneseEraDate('2026-05-03')` が `'令和8年5月3日'` を返す
**A-29**: `formatJapaneseEraDate('2019-05-01')` が `'令和元年5月1日'` を返す
**A-30**: `formatJapaneseEraDate('2019-04-30')` が `'平成31年4月30日'` を返す
**A-31**: `formatJapaneseEraDate('1989-01-08')` が `'平成元年1月8日'` を返す
**A-32**: `formatJapaneseEraDate('1989-01-07')` が `'昭和64年1月7日'` を返す
**A-33**: `formatJapaneseEraDate('1926-12-25')` が `'昭和元年12月25日'` を返す
**A-34**: `formatJapaneseEraDate('1926-12-24')` が `'1926年12月24日'` を返す（西暦フォールバック）
**A-35**: `formatJapaneseEraDate('2026-05-03T00:00:00.000Z')` が `'令和8年5月3日'` を返す（ISO 全長の入力を受け付ける）
**A-36**: `formatJapaneseEraDate('')` と `formatJapaneseEraDate('not-a-date')` が空文字を返す
**A-37**: 御朱印ページのフッターに `flip-page-spot-name-<id>` としてスポット名が、`flip-page-date-<id>` として和暦日付が描画される
**A-38**: `visited_at` が解析不能なスタンプでは `flip-page-date-<id>` を描画しない（スポット名は描画する）
**A-39**: グリッドモードの既存挙動（ソート切替・アイテムタップでモーダル・日付表示の有無）が既存テストのアサーションのまま通る
**A-40**: 新規3コンポーネント・2 hooks/utils すべてに対応するテストファイルが存在する

### UI. 視覚仕様（`StyleSheet.flatten` で検証）

**UI-1**: `GoshuinchoPage` の紙面の `backgroundColor` が `colors.background`
**UI-2**: `GoshuinchoPage` の紙面の `borderColor` が `colors.gray[200]`、`borderWidth` が `1`
**UI-3**: `GoshuinchoPage` の紙面の `borderRadius` が `borderRadius.lg`（12）
**UI-4**: `isCurrent === false` のページの `opacity` が `PEEK_OPACITY`（0.45）
**UI-5**: `isCurrent === true` のページに `opacity` の指定が無い（または 1）
**UI-6**: 白紙ページの案内文の色が `colors.gray[400]`、`typography.bodySmall` 準拠
**UI-7**: フッターのスポット名の色が `colors.gray[800]`、`typography.bodySmall` 準拠
**UI-8**: フッターの日付の色が `colors.gray[500]`、`typography.caption` 準拠
**UI-9**: `flip-page-counter` の色が `colors.gray[500]`、`typography.caption` 準拠
**UI-10**: `ViewModeToggle` の選択中アイコンの `color` が `colors.primary[500]`、未選択が `colors.gray[400]`
**UI-11**: `ViewModeToggle` の各ボタンの `minHeight` と `minWidth` が 44 以上
**UI-12**: `GoshuinchoFlipView` の背景が `colors.surface`（帳面の外の地色）
**UI-13**: 御朱印画像の `resizeMode` が `'contain'`（御朱印の縦横比を潰さない）
**UI-14**: `src/components/gallery/` 配下と `src/hooks/useGalleryViewMode.ts` の `StyleSheet.create` 内に、色の直値（`#` で始まる文字列リテラル）と、`spacing` / `borderRadius` / `typography` を経由しないサイズ数値リテラルが無い（`borderWidth: 1`、`flex: 1`、`opacity`、`minHeight: 44`、`minWidth: 44`、`aspectRatio`、`numberOfLines`、`computePageLayout` の算出値は除く）

### W. Expo Web での目視・操作検証

（`npx expo start --web --port 8081` → 御朱印タブ。**ログインは Google ネイティブサインインのため Web では到達不能** → 未ログイン状態で検証できるものと、テストデータを差し込んで検証するものを分ける）

**W-1**: 未ログインで御朱印タブを開くと、ゲスト空状態が表示され、表示切り替えトグルが**出ていない**
**W-2**: ログイン済み状態でめくり表示になっており、中央に1枚、左右に隣のページが覗いている
**W-3**: 覗いている**右**のページをタップすると、そのページが中央に来る
**W-4**: 覗いている**左**のページをタップすると、そのページが中央に来る
**W-5**: ページを送るとフッターのスポット名・和暦日付・ページ番号がそのページのものに入れ替わる
**W-6**: 最後まで送ると白紙ページが現れ、カメラアイコンと「ここに御朱印を追加する」が中央に出る
**W-7**: 中央の白紙ページをタップすると記録画面に遷移する
**W-8**: グリッドアイコンを押すと3列グリッドに切り替わり、ソートボタンが現れる
**W-9**: めくりアイコンに戻すとソートボタンが消える
**W-10**: グリッドに切り替えてページをリロードしてもグリッドのままである（永続化の目視確認）
**W-11**: めくり表示で中央のページをタップすると御朱印が全画面で開く
**W-12**: コンソールに新規のエラー・警告が出ていない（`VirtualizedList` の警告を含む）

### N. native-only（実機 / Maestro）

**N-1**: **native-only（実機）** 横スワイプでページが1枚ずつ送られ、途中で止めても中央にスナップする
**N-2**: **native-only（実機）** 勢いよくスワイプしても2枚以上飛ばない（`snapToInterval` + `decelerationRate="fast"` が効いている）
**N-3**: **native-only（実機）** 御朱印が0件のアカウントで、めくり表示に白紙ページだけが出る
**N-4**: **native-only（実機）** 白紙ページから記録画面に入り、保存後に御朱印タブへ戻ると、その御朱印が末尾（白紙の1つ手前）に増えている
**N-5**: **native-only（実機・iPhone SE 相当の小型端末）** ページ全体が縦に収まり、フッターとページ番号がタブバーに隠れない（**Issue #114 の W-3 と同じ罠。シートではないが下端に要素がある**）
**N-6**: **native-only（実機）** グリッドに切り替えてアプリを完全終了 → 再起動しても、御朱印タブがグリッドで開く
**N-7**: **native-only（実機）** 御朱印が30枚以上あるアカウントでめくり表示をスクロールしても、体感の引っかかりが無い

### Q. 品質基準

**Q-1**: `npm test` が全件パスする
**Q-2**: `npm run lint` がエラー 0 件
**Q-3**: `npm run typecheck` がエラー 0 件
**Q-4**: UI-14 のトークン直値チェックを満たす
**Q-5**: `git diff --stat` に「変更しないファイル」節に挙げたファイルの変更が含まれない（新規ファイルの追加は逸脱ではない）
**Q-6**: `package.json` / `package-lock.json` に差分が無い（新規ライブラリを入れていない）

**受入基準の合計: 79 項目**

| 群                         | 件数 | 検証手段                            |
| -------------------------- | ---- | ----------------------------------- |
| A-1〜A-40（機能）          | 40   | Jest                                |
| UI-1〜UI-14（視覚仕様）    | 14   | Jest（`StyleSheet.flatten` / grep） |
| W-1〜W-12（Expo Web）      | 12   | Expo Web 目視・Playwright           |
| N-1〜N-7（ネイティブ動線） | 7    | native-only（実機 / Maestro）       |
| Q-1〜Q-6（品質）           | 6    | コマンド実行                        |

---

## 注意事項

### 実装時に気をつけること

1. **`numColumns` を持つ `FlatList` を morph させない**: RN は稼働中の `FlatList` の `numColumns` 変更で例外を投げる。めくりとグリッドは**別コンポーネント／別要素**として条件分岐で描き分ける（同じ `FlatList` に `horizontal` と `numColumns` を出し入れしない）
2. **インデックスの取り違え**: 表示順（昇順）と `stamps` 配列（降順）は逆。`ImageGalleryModal` / `EditStampModal` / `DeleteConfirmModal` に渡すのは**常に `stamps` 側のインデックス**。A-17 はこれを検出するための基準
3. **`getItemLayout` を省略しない**: 無いと `scrollToIndex` が未計測のページへ飛べず、隣ページタップ（S-6）が不安定になる
4. **`new Date()` を和暦に使わない**: `visited_at` は日付のみの文字列。`Date` を経由するとタイムゾーンで前日にずれ、元号の境界日（A-29〜A-33）が落ちる
5. **`AsyncStorage.setItem` を await しない**: `useSearchHistory.addHistory` と同じく即時に state を更新する。await すると A-27 が落ちる
6. **既存テストのアサーションを書き換えない**: グリッド系のケースには `fireEvent.press(getByTestId('view-mode-grid'))` を足すだけ。期待値を緩めたら A-39 は不合格
7. **`PageIndicator` を使わない**: ドットが枚数分並ぶ。進捗は `flip-page-counter` のテキストのみ
8. **`onViewableItemsChanged` を使わない**: Jest から発火できない。`onMomentumScrollEnd` を使う（A-14 の検証手段）
9. **`stamps.ts` / `useGalleryStamps.ts` を触らない**: 並び順の反転は表示側の責務。サービス層に昇順オプションを足したくなっても我慢する
10. **白紙ページは常に1枚**: 「白紙が2枚以上」「白紙が先頭にもある」は仕様ではない（A-11）

### 監査項目との対応

| 監査項目                    | 本 issue での扱い                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| A-2（和暦）                 | **部分的に解決**。めくりページのフッターのみ。記録画面・グリッド・スポット詳細は西暦のまま |
| B-2（記録の入口が地図のみ） | **解決**。白紙ページが御朱印タブからの記録入口になる                                       |
| B-4（表示の一覧性）         | めくりとグリッドの併存で対処。既定はめくり                                                 |

### 人間ゲート前に確認すること

Issue #116 の本文に明記が無く、契約書側で決めた判断。push / PR 作成の直前に**2段に分けて**提示する（Issue #114 のゲートで、「Issue 本文に無い」ものと「契約書と食い違う」ものを混ぜたせいで本当の逸脱が埋もれかけた反省）。

**Tier A — 契約書で宣言済み（Issue 本文には無い）**

1. **覗いている隣ページのタップで送る（S-6）** — アクセシビリティ改善であると同時に、Expo Web でめくりを検証する唯一の手段（スワイプは Web 非対応）
2. **既定の表示モードをめくりにする** — 案3 の主役だから。ただし**既存ユーザーが次にアプリを開いたとき、見え方が変わる**
3. **スタンプ0件でもめくりモードでは白紙ページを出す（`empty-state` を出さない）** — 初日から御朱印タブが記録の入口になる。既存の空状態メッセージはグリッドモードにのみ残る
4. **ソートボタンをグリッドモード限定にする** — 帳面の並びは1つ（古い順）という前提
5. **既存 `GalleryScreen.test.tsx` のグリッド系ケースに1行足す** — 既定モードが変わるため。アサーション本体は無変更

**Tier B — 契約書の記述と食い違うもの**

（実装中に生じたらここに追記する。無ければ「無し」と明示する）
