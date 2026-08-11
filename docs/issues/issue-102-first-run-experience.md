# Issue #102: 初回体験の改善（未ログイン時の空状態とログイン導線）

## 概要

未ログインユーザーの初回体験を「登録を迫る」から「価値を見せてから促す」に変える。

現状の問題（2026-08-02 のストアスクショ撮影で確認・`.claude/harness/feature-list.json` P1-08）:

1. **タブ遷移そのものがブロックされる**: `src/navigation/TabNavigator.tsx` の `tabPress` リスナーが未ログイン時に `e.preventDefault()` + `rootNavigation.navigate('Login')` を実行するため、「御朱印」「コレクション」タブは**中身を一度も見られない**まま全画面ログインモーダルが出る。ユーザーは何が得られるか分からないまま登録を迫られる
2. **検索画面が空**: `src/screens/SearchScreen.tsx` は未入力かつ検索履歴ゼロだと「検索履歴はありません」だけの完全な空画面になる

本 Issue では (a) タブ遷移ブロックを撤廃し、(b) 御朱印/コレクション画面に「何ができるか」を示す空状態 + ログイン CTA を置き、(c) 検索画面の未入力時に近隣または人気スポットを出す。ログインは**実際にログインが必要な操作の時点**（記録 FAB・行きたい追加 = MapScreen の既存 `LoginPromptModal`）でのみ要求する形を維持する。

- GitHub Issue: #102（feature-list P1-08）
- ブランチ: `feature/issue-102-first-run-experience` → develop
- 前提: 遅延ログイン方式（`docs/design/ui-design.md` 5章「1. 遅延ログイン方式」）の徹底。地図画面は既にこの方式で、御朱印/コレクションだけが例外になっていた

## 関連ドキュメント

- [プロダクト方針 v2](../product/direction.md) — Phase 1「記録体験の磨き込み」。「コア体験（記録・地図・ギャラリー・コレクション）は永久無料」の原則に対し、閲覧すら不可な現状は方針と乖離している
- [UI設計 v6](../design/ui-design.md) — 4.2 ログイン画面（遅延ログイン方式）／5章 デザイン原則。**画面一覧の #8 ギャラリー・#10 コレクションの「ログイン: 必須」表記は本 Issue で「任意」に更新する**（下記 UI-6）
- [要件定義](../product/requirements.md) / [技術設計](../technical/tech-design.md)
- [Issue #96 契約書](./issue-096-map-viewport-topn.md) — 契約書の書式・既存テスト削除変更宣言の前例
- `.claude/skills/tdd-workflow/SKILL.md` — テスト規約

## 調査結果（実装方針の前提となる確定事実）

コードから確認済み。実装時にこの前提が崩れていたら契約書を先に更新する。

### 未ログイン時のデータ取得は「クエリ自体を skip」する（エラーにならない）

| hook                            | 未ログイン時の挙動                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `useGalleryStamps`              | `if (!user) { setAllStamps([]); setIsLoading(false); return; }` — `fetchAllStamps` を呼ばない    |
| `useCollectionStats`            | 同様のガードで 4 つの fetch すべて skip、`spotCount`/`stampCount` は 0、配列は空                 |
| `useWishlistSpots`              | 同様のガードで skip、`spots: []`                                                                 |
| `getAllBadges()`                | `src/services/badges.ts` の静的定義を返すだけ（DB アクセスなし）                                 |
| `useSpots` / `useSpotsByBounds` | 認証に依存しない（`spots` テーブルは公開読み取り）。検索の提案スポットは未ログインでも取得できる |

→ **タブに入れるようにするだけでエラーは出ない**。RLS 由来の失敗も、session null でのクエリ発行も発生しない。認証分岐は純粋に UI 側の表示分岐で足りる。

### 位置情報のフォールバックが「見せかけの近さ」を生む

`useLocation` は権限が `GRANTED` でない場合 `setLocation(DEFAULT_LOCATION)`（仙台市中心 38.2682/140.8694）を入れて `permissionStatus` に `denied`/`undetermined` を残す。つまり **`location` が非 null でも実際の現在地とは限らない**。よって検索画面の未入力時コンテンツは `location` の有無ではなく `permissionStatus === PermissionStatus.GRANTED` で分岐し、権限が無い場合は距離を表示しない「人気スポット（rank 降順）」を出す。

### 既存の空状態パターンとテーマトークン

- `GalleryScreen`: `testID="empty-state"` + `MaterialIcons name="photo-library" size={48} color={colors.gray[400]}` + `styles.emptyText`（`typography.h3` / `colors.gray[600]`）+ `styles.emptySubText`（`typography.bodySmall` / `colors.gray[400]`）
- `CollectionScreen`: セクションごとに `Card` + `MaterialIcons size={40} color={colors.gray[300]}` + `typography.bodySmall` / `colors.gray[400]`（`pilgrimageEmptyCard` / `regionEmptyCard` / `wishlistEmptyCard`）
- CTA は `@components/common/Button`（`variant="primary"` = `colors.primary[500]` 背景 / `colors.white` 文字）を使う。**新規に色・余白の直値を書かない**

## 詳細設計

### 対象ファイル

| ファイル                                                    | 変更内容                                                                                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/navigation/TabNavigator.tsx`                           | `GalleryTab` / `CollectionTab` の `listeners` を**削除**。不要になる `useAuth` / `useNavigation` / `RootNavigation` 型 / `RootStackParamList` import も削除 |
| `src/screens/GalleryScreen.tsx`                             | Props（`GalleryStackScreenProps<'Gallery'>`）を受け取る。`useAuth` を追加し、未ログイン時はゲスト空状態を表示（ソート行と一覧を出さない）                   |
| `src/screens/CollectionScreen.tsx`                          | `useAuth` から `isAuthenticated` を追加取得。未ログイン時にヘッダー直下へゲストカードを挿入（既存セクションはプレビューとして残す）                         |
| `src/screens/SearchScreen.tsx`                              | 未入力時を「検索履歴 + 提案スポット一覧」の単一 FlatList に置き換え                                                                                         |
| `src/hooks/useSearchScreen.ts`                              | `suggestedSpots` / `suggestionMode` と定数 `MAX_SUGGESTED_SPOTS` を追加 export                                                                              |
| `src/components/search/SearchHistoryList.tsx`               | `FlatList` → `View` + `map` にリファクタ（親 FlatList の header に置くため）。テキスト・testID は不変                                                       |
| `src/components/search/SearchResultCard.tsx`                | `showDistance?: boolean`（既定 `true`）を追加                                                                                                               |
| `src/components/common/Button.tsx`                          | `testID?: string`（既定 `button-${variant}`）を追加                                                                                                         |
| `src/navigation/__tests__/TabNavigator.test.tsx`            | 既存2テストの置き換え（下記「既存テストの削除・変更一覧」）                                                                                                 |
| `src/screens/__tests__/GalleryScreen.test.tsx`              | `@hooks/useAuth` モック追加 + render に props 追加 + ゲスト空状態テスト追加                                                                                 |
| `src/screens/__tests__/CollectionScreen.test.tsx`           | `@hooks/useAuth` モックを差し替え可能な形に変更 + ゲストカードテスト追加                                                                                    |
| `src/screens/__tests__/SearchScreen.test.tsx`               | `useSearchScreen` モックに新フィールド追加 + 提案スポットテスト追加                                                                                         |
| `src/hooks/__tests__/useSearchScreen.test.ts`               | `useLocation` モックに `permissionStatus` を明示 + 提案スポットのユニットテスト追加                                                                         |
| `src/components/search/__tests__/SearchResultCard.test.tsx` | `showDistance={false}` のテスト追加（既存は無変更で通ること）                                                                                               |
| `docs/design/ui-design.md`                                  | 画面一覧 #8 / #10 の「ログイン」列を `必須` → `任意（記録は必須）` に修正                                                                                   |
| `e2e/flows/smoke.yaml`                                      | 誤ったセレクタ `ギャラリー` → `御朱印` に修正し、未ログインで両タブに入れることを assert。陳腐化コメントを削除                                              |

**変更しないファイル**: `src/screens/MapScreen.tsx`、`src/components/common/LoginPromptModal.tsx`、`src/components/common/Card.tsx`、`src/screens/LoginScreen.tsx`、`src/screens/SettingsScreen.tsx`、`src/hooks/useAuth.ts`、`src/hooks/useGalleryStamps.ts`、`src/hooks/useCollectionStats.ts`、`src/hooks/useWishlistSpots.ts`、`src/hooks/useLocation.ts`、`src/hooks/useSpots.ts`、`src/hooks/useSearchHistory.ts`、`src/services/*`、`src/navigation/RootNavigator.tsx`、`src/navigation/GalleryStack.tsx`、`src/navigation/CollectionStack.tsx`、`src/navigation/MapStack.tsx`、`src/navigation/types.ts`、`jest.setup.js`、`supabase/` 配下すべて。

### 実装方針

#### 1. TabNavigator: タブ遷移ブロックの撤廃

`GalleryTab` / `CollectionTab` の `listeners={() => ({ tabPress: ... })}` を丸ごと削除する。結果として `useAuth()`・`useNavigation<RootNavigation>()`・`type RootNavigation`・`RootStackParamList` の import が未使用になるため**すべて削除**する（残すと lint の `no-unused-vars` で落ちる）。`Tab.Screen` の他の options（title / tabBarIcon / headerShown）は無変更。

#### 2. ログイン導線の方式: `Login` ルートへの遷移（`LoginPromptModal` は使わない）

CTA は `navigation.navigate('Login')` で RootStack の `Login`（`presentation: 'modal'`）を開く。理由:

- `LoginScreen` は Apple サインイン + Google の両方を持つ（`LoginPromptModal` は Google のみ）。ログイン入口を増やすなら Apple 併記側に寄せる
- `SettingsScreen` の「ログイン」行と同じ導線で一貫する
- 追加の modal state を screen に持たせない

ネストされた navigator（GalleryStack / CollectionStack）からの `navigate('Login')` は React Navigation v7 が親（Tab → RootStack）へバブルさせる。型は `CompositeScreenProps` 経由で `GalleryStackScreenProps` / `CollectionStackScreenProps` に `RootStackParamList` が合成済みのため通る。**`getParent()` チェーンは使わない**（テストの assert を `navigate('Login')` 1本に固定するため）。

#### 3. GalleryScreen: ゲスト空状態

```tsx
type Props = GalleryStackScreenProps<'Gallery'>;

export function GalleryScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  // ...既存 state/hooks はそのまま
```

分岐の**順序を固定する**（ゲスト判定が最優先。`isLoading` / `stamps.length` より前）:

1. `!isAuthenticated` → ゲスト空状態のみ（ソート行 `sort-button` も描画しない）
2. `isLoading` → 既存 `loading-indicator`
3. `stamps.length === 0` → 既存 `empty-state`（ログイン済みで0件）
4. それ以外 → 既存 `gallery-list`

ゲスト空状態（`testID="gallery-guest-empty-state"`）の構成:

| 要素          | 内容                                                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| アイコン      | `MaterialIcons name="photo-library" size={48} color={colors.gray[400]}`（既存 empty-state と同一）                                                                                                                               |
| タイトル      | `あなたの御朱印帳`（`typography.h3` / `colors.gray[600]`）                                                                                                                                                                       |
| 説明          | `記録した御朱印がここに一覧で並びます`（`typography.bodySmall` / `colors.gray[400]`）                                                                                                                                            |
| プレビュー3行 | 各行 `MaterialIcons size={20} color={colors.gray[400]}` + `typography.bodySmall` / `colors.gray[500]`<br>① `photo-camera` `写真で御朱印を残す`<br>② `sort` `日付順・スポット順で並べ替え`<br>③ `fullscreen` `タップで大きく表示` |
| CTA           | `<Button title="ログインして始める" variant="primary" testID="gallery-login-cta" onPress={() => navigation.navigate('Login')} />`                                                                                                |

`EditStampModal` / `DeleteConfirmModal` / `ImageGalleryModal` の描画条件（`currentStamp` 依存）は無変更。ゲスト時は `stamps` が空なので `currentStamp` は常に null。

#### 4. CollectionScreen: ゲストカード

`const { user, isAuthenticated } = useAuth();` に変更し、`ScrollView` の先頭（達成サマリーカードの**直前**）に挿入する:

```tsx
{
  !isAuthenticated && (
    <Card style={styles.guestCard} /* testID は View ラッパーに付ける */>...</Card>
  );
}
```

`Card` は内部で `testID="card"` を固定しているため、`testID="collection-guest-empty-state"` は `Card` を包む `View` に付ける。

| 要素     | 内容                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| アイコン | `MaterialIcons name="emoji-events" size={40} color={colors.primary[500]}`                                                            |
| タイトル | `記録するとここに集計されます`（`typography.h3` / `colors.gray[800]`）                                                               |
| 説明     | `訪れた寺社の数・都道府県の埋まり方・巡礼の進捗・獲得バッジが自動でたまります`（`typography.bodySmall` / `colors.gray[500]`）        |
| CTA      | `<Button title="ログインして始める" variant="primary" testID="collection-login-cta" onPress={() => navigation.navigate('Login')} />` |

**既存セクションはゲストでもそのまま残す**（これ自体が機能プレビューとして機能する）: 達成サマリー（0箇所 / 0御朱印）・獲得バッジ（全ロック）・「巡礼チャレンジに挑戦してみましょう」・「御朱印を記録すると地域別の統計が表示されます」・「行きたいスポットをマップで保存しましょう」。セクションの出し入れはしない。

#### 5. useSearchScreen: 未入力時の提案スポット

```ts
export type SuggestionMode = 'nearby' | 'popular';

/** 未入力時に提案するスポットの最大件数 */
export const MAX_SUGGESTED_SPOTS = 10;

export interface UseSearchScreenReturn {
  // 既存
  query: string;
  setQuery: (text: string) => void;
  results: SpotWithDistance[];
  filterType: 'all' | 'shrine' | 'temple';
  setFilterType: (type: 'all' | 'shrine' | 'temple') => void;
  clearSearch: () => void;
  // 追加
  suggestedSpots: SpotWithDistance[];
  suggestionMode: SuggestionMode;
}
```

- `const { location, permissionStatus } = useLocation();`
- `suggestionMode = permissionStatus === PermissionStatus.GRANTED ? 'nearby' : 'popular'`（`PermissionStatus` は `expo-location` から import。MapScreen の既存パターンと同じ）
- `nearby`: 既存の `spotsWithDistance`（距離昇順ソート済み）の先頭 `MAX_SUGGESTED_SPOTS` 件
- `popular`: `[...allSpots].sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id))` の先頭 `MAX_SUGGESTED_SPOTS` 件を `{ spot, distance: 0 }` にマップする。**距離は常に 0**（`DEFAULT_LOCATION` からの見せかけの距離を出さないため。表示側で非表示にする）
- 入力配列 `allSpots` は破壊しない（sort 前にコピー）
- `results` / `filterType` / `clearSearch` / デバウンス（300ms）のロジックは**一切変更しない**。`suggestedSpots` は `query` に依存しない（入力中も同じ値を返す）

#### 6. SearchScreen: 未入力時のレイアウト

`hasQuery === false` のブランチを、`SearchHistoryList` 単独から**単一の FlatList** に置き換える:

```tsx
const suggestionTitle = suggestionMode === 'nearby' ? '近くのスポット' : '人気のスポット';

<FlatList
  data={suggestedSpots}
  keyExtractor={item => item.spot.id}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
  ListHeaderComponent={
    <>
      <SearchHistoryList history={history} onSelect={handleHistorySelect} onClear={clearHistory} />
      {suggestedSpots.length > 0 && <Text style={styles.sectionTitle}>{suggestionTitle}</Text>}
    </>
  }
  renderItem={({ item }) => (
    <SearchResultCard
      spot={item.spot}
      distance={item.distance}
      query=""
      showDistance={suggestionMode === 'nearby'}
      onPress={() => navigation.navigate('Map', { focusSpotId: item.spot.id })}
    />
  )}
/>;
```

- **提案スポットのタップは検索履歴に追加しない**（ユーザーが検索した語ではないため）。`addHistory` は検索結果カード（`handleResultPress`）のみが呼ぶ
- `hasQuery === true` のブランチ（`FilterChips` / 「検索結果」/「見つかりませんでした」）は**一切変更しない**
- `styles.sectionTitle` は既存定義をそのまま再利用する（`typography.bodySmall` / `colors.gray[500]` / uppercase / letterSpacing 1）
- 提案スポットの取得中（`useSpots` のロード中）は `suggestedSpots` が空で、セクションタイトルも出ない。スピナーは出さない（スコープ外）

#### 7. SearchHistoryList: FlatList → View への平坦化

親 FlatList の `ListHeaderComponent` 内に置くため、ネストした VirtualizedList を作らないよう `FlatList` を `View` + `history.map()` に置き換える（履歴は `MAX_HISTORY = 10` 固定なので仮想化不要）。

- **不変**: `testID="history-item"` / `testID="clear-history-button"` / テキスト `最近の検索` `クリア` `検索履歴はありません` / props シグネチャ（`history` / `onSelect` / `onClear`）
- **変更**: `keyboardShouldPersistTaps` / `keyboardDismissMode` は親 FlatList 側に移るため削除。空メッセージのコンテナは `paddingTop: 100` → `paddingHorizontal: spacing.lg` + `paddingVertical: spacing.md`（提案スポットを画面下に押し出さないため）

#### 8. SearchResultCard / Button の後方互換な拡張

```tsx
// SearchResultCard
interface SearchResultCardProps {
  spot: Spot;
  distance: number;
  query: string;
  onPress: () => void;
  showDistance?: boolean; // 既定 true
}
// → {showDistance && <Text style={styles.distance}>{formatDistance(distance)}</Text>}

// Button
interface ButtonProps {
  /* ...既存... */ testID?: string;
}
// → testID={testID ?? `button-${variant}`}
```

いずれも既定値が現行挙動なので既存の呼び出し元・既存テストは無変更で通る。

### データ構造

DB スキーマ・`src/types/supabase.ts` の変更なし。新規型は `SuggestionMode`（`'nearby' | 'popular'`）のみ。

### API / エンドポイント

新規のサービス関数は**作らない**。提案スポットは既存の `useSpots` → `fetchAllActiveSpots`（`src/services/spots.ts`、無変更）が返す `allSpots` から純粋なクライアント側の並べ替えで作る。

## 既存テストの削除・変更一覧（明示的宣言）

契約として宣言した上で変更する（勝手に消さない）。

### `src/navigation/__tests__/TabNavigator.test.tsx`

| #   | 対象テスト                                                         | 処置     | 理由・置き換え先                                                                                                                    |
| --- | ------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `navigates to Login when unauthenticated user taps Gallery tab`    | **変更** | 「未ログインで御朱印タブを押すと GalleryTab に入り `gallery-guest-empty-state` が出る / `Login Screen` は出ない」に置き換え（AC-2） |
| 2   | `navigates to Login when unauthenticated user taps Collection tab` | **変更** | 「未ログインでコレクションタブを押すと `collection-guest-empty-state` が出る / `Login Screen` は出ない」に置き換え（AC-3）          |
| 3   | `renders all 4 tabs`                                               | **維持** | 無変更で通る                                                                                                                        |
| 4   | `allows authenticated user to access Gallery tab normally`         | **維持** | `mockUseAuth` が `isAuthenticated: true` を返し `useGalleryStamps` モックが1件返すため `gallery-list` が出る（AC-4）                |

`LoginPlaceholder` / `Stack.Screen name="Login"` のテスト足場は**残す**（「出ないこと」を assert するために必要）。

### `src/screens/__tests__/GalleryScreen.test.tsx`

- **追加**: `@hooks/useAuth` のモック。差し替え可能にする（`let mockAuth = { user: { id: 'user-1' }, isAuthenticated: true }` を `beforeEach` でリセット）。**未モックだと実 `useAuth` 経由で `@services/supabase` が読み込まれるため必須**（他画面テストと同じ規約）
- **変更**: 既存 8 テストの `render(<GalleryScreen />)` を `render(<GalleryScreen navigation={mockNavigation as never} route={mockRoute} />)` に変更（`mockNavigation` / `mockRoute` は `SearchScreen.test.tsx` と同じ形で定義）。**アサーションは無変更**
- **追加**: ゲスト空状態のテスト（AC-6〜AC-11）

### `src/screens/__tests__/CollectionScreen.test.tsx`

- **変更**: `jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: {id:'user-1'}, isAuthenticated: true }) }))` を `let mockAuth` 参照型に変更（既定はログイン済み、`beforeEach` でリセット）。**既存アサーションは無変更**
- **追加**: ゲストカードのテスト（AC-13〜AC-16）

### `src/hooks/__tests__/useSearchScreen.test.ts`

- **変更**: `beforeEach` の `mockUseLocation.mockReturnValue` の `permissionStatus: null` → `'granted'`（既定を nearby モードにする）。**既存 6 テストのアサーションは無変更**
- **追加**: 提案スポットのユニットテスト（AC-17〜AC-24）

### `src/screens/__tests__/SearchScreen.test.tsx`

- **変更**: `mockUseSearchScreenReturn`（宣言と `beforeEach` のリセット両方）に `suggestedSpots: []` と `suggestionMode: 'nearby' as const` を追加。**既存 15 テストのアサーションは無変更**
- **追加**: 提案スポット表示のテスト（AC-25〜AC-32）

### 変更しないテストファイル

`src/components/search/__tests__/SearchHistoryList.test.tsx`（6テスト）・`src/components/__tests__/common.test.tsx` の Button 5テスト・`src/screens/__tests__/MapScreen.test.tsx`・`src/components/__tests__/LoginPromptModal.test.tsx`・`src/screens/__tests__/SettingsScreen.test.tsx`・`src/navigation/__tests__/RootNavigator.test.tsx` は**一切変更しない**（無変更で通ることが AC-32）。`src/components/search/__tests__/SearchResultCard.test.tsx` は既存8テスト無変更 + `showDistance` のテストを**追加**のみ。

## テスト方針

TDD（t-wada 流）で Red → Green → Refactor。1スライス = 1コミット。推奨分割:

1. `refactor: allow guest access to gallery and collection tabs` — TabNavigator のリスナー削除 + TabNavigator.test の置き換え（この時点では素の空状態が出る = Red を先に踏む）
2. `feat: add guest empty state to gallery screen` — GalleryScreen + Button の testID 拡張 + テスト
3. `feat: add guest prompt card to collection screen` — CollectionScreen + テスト
4. `feat: suggest nearby or popular spots on empty search` — useSearchScreen + SearchHistoryList 平坦化 + SearchResultCard の showDistance + SearchScreen + テスト
5. `docs: mark gallery and collection as login-optional` — ui-design.md + smoke.yaml

規約:

- テストは対象と同階層の `__tests__/`。expo / Supabase のモックは `jest.setup.js` の既存分に依存し、個別に再モックしない（`@hooks/useAuth` のような hook モックは画面テストごとに置くのが既存規約）
- 認証分岐は `let mockAuth` の差し替えで検証する（`mockUseAuth = jest.fn()` 形でも可。`TabNavigator.test.tsx` の既存パターンに合わせる）
- `useSearchScreen` の提案ロジックは hook のユニットテストで厚くカバーする（`renderHook` + `useSpots` / `useLocation` モック）。画面テストは hook をモックして表示のみ検証する
- 1テスト1アサーション / Arrange-Act-Assert。エッジケース（未ログイン / 位置情報拒否 / スポット0件）を必ず含める
- TDD 中は `npm test -- --testPathPattern="GalleryScreen|CollectionScreen|SearchScreen|useSearchScreen|TabNavigator"`、最終確認で `npm test` 全件
- **ネイティブサインイン後に空状態が実データへ切り替わる動線と、位置情報許可済みの nearby モードは Jest / Expo Web で検証不能** → native-only として実機確認に割り当てる（下記 N-1〜N-4）

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準に基づいて合否判定を行う。各基準は独立して検証可能。

### 機能基準 A: TabNavigator（`src/navigation/__tests__/TabNavigator.test.tsx`）

- [ ] AC-1: `grep -nE "listeners|preventDefault|useAuth|useNavigation" src/navigation/TabNavigator.tsx` が 0 件である
- [ ] AC-2: `isAuthenticated: false` で `御朱印` タブを押すと `gallery-guest-empty-state` が表示され、かつ `Login Screen`（`LoginPlaceholder` のテキスト）が表示されない
- [ ] AC-3: `isAuthenticated: false` で `コレクション` タブを押すと `collection-guest-empty-state` が表示され、かつ `Login Screen` が表示されない
- [ ] AC-4: `isAuthenticated: true` で `御朱印` タブを押すと `gallery-list` が表示される（既存テストが無変更で通る）
- [ ] AC-5: `地図` `御朱印` `コレクション` `設定` の4タブが表示される（既存テストが無変更で通る）

### 機能基準 B: GalleryScreen（`src/screens/__tests__/GalleryScreen.test.tsx`）

到達手順: MainTabs → 下部タブ `御朱印`（GalleryTab → GalleryStack → Gallery）

- [ ] AC-6: `isAuthenticated: false` のとき `gallery-guest-empty-state` が表示され、`gallery-list` と `empty-state` はいずれも表示されない
- [ ] AC-7: `isAuthenticated: false` かつ `useGalleryStamps` が stamps 1件を返すモックでも `gallery-list` は表示されない（認証で分岐しており件数で分岐していない）
- [ ] AC-8: `isAuthenticated: false` のとき `sort-button` が表示されない
- [ ] AC-9: `isAuthenticated: false` で `gallery-login-cta` を押すと `navigation.navigate` が `'Login'` のみを引数に1回呼ばれる
- [ ] AC-10: `isAuthenticated: false` のとき `あなたの御朱印帳` `記録した御朱印がここに一覧で並びます` `写真で御朱印を残す` `日付順・スポット順で並べ替え` `タップで大きく表示` の5つのテキストがすべて表示される
- [ ] AC-11: `isAuthenticated: true` かつ stamps 0件のとき `empty-state` が表示され、`gallery-guest-empty-state` は表示されない（`御朱印がまだありません` の既存文言も表示される）
- [ ] AC-12: `isAuthenticated: true` かつ stamps ありのとき `gallery-list` が表示され `gallery-guest-empty-state` は表示されない

### 機能基準 C: CollectionScreen（`src/screens/__tests__/CollectionScreen.test.tsx`）

到達手順: MainTabs → 下部タブ `コレクション`（CollectionTab → CollectionStack → CollectionList）

- [ ] AC-13: `isAuthenticated: false` のとき `collection-guest-empty-state` が表示され、`記録するとここに集計されます` と `訪れた寺社の数・都道府県の埋まり方・巡礼の進捗・獲得バッジが自動でたまります` が表示される
- [ ] AC-14: `isAuthenticated: false` で `collection-login-cta` を押すと `navigation.navigate` が `'Login'` のみを引数に1回呼ばれる
- [ ] AC-15: `isAuthenticated: true` のとき `collection-guest-empty-state` が表示されない（既存テストのアサーションが無変更で通る）
- [ ] AC-16: `isAuthenticated: false`・`spotCount: 0`・`stampCount: 0`・`regionStats: []`・`pilgrimageProgress: []`・`wishlistSpots: []` のとき、`これまでの達成` `獲得バッジ` `巡礼チャレンジに挑戦してみましょう` `御朱印を記録すると地域別の統計が表示されます` `行きたいスポットをマップで保存しましょう` の5テキストがすべて表示される（プレビューとして残っている）

### 機能基準 D: useSearchScreen（`src/hooks/__tests__/useSearchScreen.test.ts`）

- [ ] AC-17: `permissionStatus: 'granted'` のとき `suggestionMode === 'nearby'` で、`suggestedSpots` の `distance` が昇順に並ぶ
- [ ] AC-18: `permissionStatus: 'denied'` のとき `suggestionMode === 'popular'` で、`suggestedSpots` の `spot.rank` が降順に並ぶ（rank 5/3/1 の3件を与えて `[5,3,1]` を確認）
- [ ] AC-19: `permissionStatus: 'denied'` かつ同 rank の2件（`id: 'b'` / `id: 'a'` の順で入力）のとき、`suggestedSpots` の id は `['a','b']` の順である（id 昇順の決定的タイブレーク）
- [ ] AC-20: `MAX_SUGGESTED_SPOTS === 10` であり、`allSpots` に11件を与えると `suggestedSpots.length === 10` である（nearby / popular 両モードで）
- [ ] AC-21: `allSpots: []` のとき `suggestedSpots` は `[]` である（クラッシュしない）
- [ ] AC-22: `permissionStatus: 'denied'` のとき `suggestedSpots.every(s => s.distance === 0)` が true である（`DEFAULT_LOCATION` 由来の見せかけの距離を返さない）
- [ ] AC-23: `setQuery('Temple')` + 350ms 経過後も `suggestedSpots` の id 配列は query 入力前と同一である（提案は query に依存しない）。かつ既存6テスト（results / filterType / clearSearch / デバウンス）がアサーション無変更で通る
- [ ] AC-24: `useSearchScreen` 呼び出し後も `useSpots` モックが返した `allSpots` 配列の順序が元のまま（非破壊。`toEqual` で検証）

### 機能基準 E: SearchScreen（`src/screens/__tests__/SearchScreen.test.tsx`）

到達手順: MainTabs → `地図` タブ → 検索バータップ（MapStack → Search）

- [ ] AC-25: `query: ''`・`suggestedSpots` 3件・`suggestionMode: 'nearby'` のとき `search-result-card` が3件表示され、`近くのスポット` が表示される
- [ ] AC-26: `query: ''`・`suggestedSpots` 3件・`suggestionMode: 'popular'` のとき `人気のスポット` が表示され、`近くのスポット` は表示されない
- [ ] AC-27: `query: ''`・`suggestedSpots: []` のとき `近くのスポット` も `人気のスポット` も表示されない
- [ ] AC-28: `query: ''`・履歴2件のとき `最近の検索` と履歴のスポット名が表示される（既存テストがアサーション無変更で通る）
- [ ] AC-29: `query: ''`・履歴0件のとき `検索履歴はありません` が表示される（既存テストがアサーション無変更で通る）
- [ ] AC-30: `query: ''`・`suggestedSpots` 1件のとき `search-result-card` を押すと `navigation.navigate` が `('Map', { focusSpotId: <そのスポットの id> })` で呼ばれ、かつ `addHistory` が呼ばれない
- [ ] AC-31: `query: ''`・`suggestionMode: 'nearby'`・`distance: 0.5` のとき `500m` が表示され、`suggestionMode: 'popular'`・`distance: 0` のとき `0m` が表示されない（`showDistance` の切り替え）
- [ ] AC-32: `query: '仙台'` のとき `近くのスポット` も `人気のスポット` も表示されない（検索結果 UI のみ）。かつ既存の検索結果系テスト（`検索結果` / `見つかりませんでした` / FilterChips / `addHistory` + navigate）がアサーション無変更で通る

### 機能基準 F: 共通コンポーネントの後方互換

- [ ] AC-33: `src/components/search/__tests__/SearchHistoryList.test.tsx` の6テストが**ファイル無変更で**通る
- [ ] AC-34: `src/components/__tests__/common.test.tsx` の Button 5テストが**ファイル無変更で**通る（`testID` 省略時は `button-${variant}` のまま）
- [ ] AC-35: `SearchResultCard` に `showDistance={false}` を渡すと `500m`（`distance={0.5}`）が表示されず、`showDistance` 省略時は表示される
- [ ] AC-36: `grep -n "FlatList" src/components/search/SearchHistoryList.tsx` が 0 件である（親 FlatList 内のネスト仮想化リストを作らない）

### UI基準（Expo Web で検証可能）

検証手順: `npx expo start --web --port 8081` → 初回は `スキップ` でオンボーディングを通過 → 未ログイン状態のまま操作する。

- [ ] UI-1: 下部タブ `御朱印` をタップして GalleryTab に**遷移でき**、全画面ログインモーダルが出ない（タブバーは表示されたまま）
- [ ] UI-2: 御朱印タブのゲスト空状態が、`photo-library` アイコン（48px / `colors.gray[400]` = `#9CA3AF`）→ タイトル（`typography.h3` 18px / `colors.gray[600]` = `#4B5563`）→ 説明 → プレビュー3行 → CTA の順で縦に並ぶ
- [ ] UI-3: 御朱印タブ・コレクションタブの CTA ボタンが背景 `colors.primary[500]`（`#f27f0d`）・文字色 `colors.white`・`borderRadius.lg`（12）である
- [ ] UI-4: 下部タブ `コレクション` をタップして CollectionTab に遷移でき、ヘッダー `コレクション` の直下にゲストカード（白背景 / `borderRadius.lg` / `shadows.md`）が表示され、その下に既存の達成サマリー（0箇所 / 0御朱印）とロック済みバッジ列が続く
- [ ] UI-5: 地図タブの検索バーをタップして Search 画面に入り、未入力の状態で `人気のスポット`（Web は位置情報未許可のため popular モード）とスポットカードが表示され、カードに距離が表示されない
- [ ] UI-6: `docs/design/ui-design.md` の画面一覧で `8 | ギャラリー` と `10 | コレクション` の「ログイン」列が `必須` ではなく `任意（記録は必須）` である

### native-only 基準

Expo Web ではネイティブサインイン（Google Sign-In / Apple 認証）を実行できないため、以下は **実機 iPhone + EAS Development Build（`/dev`）での目視確認**に割り当てる。Maestro フローは追加しない（サインインは Google/Apple のシステム UI を跨ぐため自動化が不安定）。

- [ ] N-1 (native-only): 御朱印タブのゲスト空状態から `ログインして始める` をタップするとログイン画面がモーダルで開き、Apple / Google の両ボタンが表示される。`あとにする` で戻ると御朱印タブ（ゲスト空状態）に戻る
- [ ] N-2 (native-only): 御朱印タブから Google サインインを完了すると、モーダルが閉じた後に御朱印タブが実データ（または `御朱印がまだありません` の通常空状態）に切り替わる
- [ ] N-3 (native-only): コレクションタブからサインインを完了すると、ゲストカードが消え達成サマリーが実データに切り替わる
- [ ] N-4 (native-only): 位置情報を許可した実機の検索画面で、未入力時に `近くのスポット` と距離付きカードが表示される（Web では popular モードしか確認できないため）
- [ ] N-5: `e2e/flows/smoke.yaml` が `assertVisible: "ギャラリー"` ではなく `御朱印` を assert し、未ログインで `御朱印` / `コレクション` タブに入れることを検証する内容になっている（**ファイル内容のみを本 Issue の合否対象とする**。Maestro の実走は feature-list P1-01 の責務であり本 Issue のゲートにしない）

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: 本 Issue で追加・変更した `StyleSheet.create()` のスタイル値に 16進カラーの直値がない（色は `@theme/colors`、余白は `@theme/spacing`、文字は `@theme/typography` のトークン参照）

## スコープ外（やらないこと）

契約書に無いことは実装しない。

- **ログイン方式の変更**: Google / Apple サインインの実装、`LoginScreen` / `src/services/auth.ts` / `useAuth` の変更、匿名ログイン・メールログインの追加
- **`LoginPromptModal` の変更**: MapScreen の記録 FAB / 行きたい追加のログイン促し（`showLoginModal`）は現状維持。文言・アイコンの引数化もしない
- **記録フロー自体の変更**（P1-02 のスコープ）: RecordScreen / RecordCompleteScreen / 記録動線のタップ数削減
- **オンボーディング画面の変更**: `OnboardingScreen` / `useOnboarding` / スライド内容
- **MapScreen の変更**: 地図・ピン・クラスタリング・検索バー・FAB・フィルタ・ボトムシートは無変更
- 未ログインでの**閲覧以外**の機能解放: 未ログインでの御朱印記録、行きたいリスト保存、ローカル保存 → 後からアカウントへ移行するような仕組み
- ゲスト空状態でのサンプル御朱印画像・ダミーデータのプレビュー表示（テキストとアイコンのみで価値を伝える）
- コレクション画面のセクション出し入れ・並び替え・ゲスト専用レイアウト（ゲストカードの挿入のみ）
- 検索画面の**提案スポットのローディング表示**（スピナー / スケルトン）、件数の動的調整、フィルタチップの未入力時適用、提案の並び順のユーザー設定
- 新規サービス関数の追加（`src/services/spots.ts` は無変更。`fetchSpotsByBounds` / `searchSpotsByName` の利用開始もしない）
- 「人気」の定義変更（`rank` 以外の指標 — 記録数・行きたい数などの集計）。`docs/technical/spot-ranking.md` の rank をそのまま人気度として使う
- `MAX_SUGGESTED_SPOTS`（10）の動的調整・設定化
- Maestro スモークフローの実走と CI 組み込み（P1-01 のスコープ。本 Issue はファイル内容の修正のみ）
- `docs/design/ui-design.md` の画面一覧「ログイン」列以外の記述更新（4.3 の未ログイン仕様など）

## 注意事項

- **分岐順序**: GalleryScreen は `!isAuthenticated` を `isLoading` より**先**に判定する。逆順だと `useGalleryStamps` の初期 `isLoading: true`（未ログイン時は即 false になるが1フレーム分ある）でゲスト空状態が一瞬出ないことがあり、テストが不安定になる
- **`@hooks/useAuth` のモック漏れ**: `src/services/supabase.ts` は `EXPO_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` が無いと import 時に throw する。画面テストで実 `useAuth` を読み込むと環境によって落ちるため、`useAuth` を使う画面のテストは必ず `jest.mock('@hooks/useAuth', ...)` を置く（既存7テストファイルと同じ規約）
- **`Card` の固定 testID**: `src/components/common/Card.tsx` は `testID="card"` を固定しており上書きできない。`collection-guest-empty-state` は `Card` を包む `View` に付ける。`Card` 自体は変更しない
- **`navigate('Login')` のバブリング**: ネストされた navigator から呼ぶため、`GalleryStack` / `CollectionStack` 内に `Login` ルートを追加してはいけない（追加すると RootStack までバブルせずスタック内遷移になり modal presentation が失われる）
- **`popular` モードの距離 0**: `distance: 0` を渡した上で `showDistance={false}` にする。`showDistance` を付け忘れると全カードに `0m` と表示されて明らかなバグになる（AC-31 で検出する）
- **`SearchHistoryList` の平坦化漏れ**: `FlatList` のまま親 FlatList の `ListHeaderComponent` に置くと React Native が「VirtualizedLists should never be nested」の警告を出し、スクロールも二重になる。必ず `View` + `map` にする（AC-36 で検出する）
- **`suggestedSpots` の `useMemo` 依存**: `spotsWithDistance` / `allSpots` / `suggestionMode` を依存配列に含める。漏れると位置情報の許可直後に提案が切り替わらない
- **`allSpots` の非破壊**: `popular` の並べ替えは `[...allSpots].sort(...)` とする。`allSpots.sort()` は `useSpots` の state 配列を直接破壊し、地図側の表示順にも影響する（AC-24 で検出する）
- **TabNavigator の未使用 import**: リスナー削除後に `useAuth` / `useNavigation` / `NativeStackNavigationProp` / `RootStackParamList` / `type RootNavigation` が未使用になる。すべて削除する（Q-2 で検出する）
- **文言は AC と一字一句合わせる**: AC-10 / AC-13 / AC-25 / AC-26 はテキスト一致で判定する。実装で言い回しを変えたい場合は本ファイルを先に更新する
- 実装が契約と食い違う事実を発見した場合は、契約書を黙って逸脱せず本ファイルを更新してから実装する
