# Issue #123: 画面構成の入れ替え（案3: 地図 / 御朱印帳 / あつめる / 自分）

## 概要

タブ構成を **地図 / 御朱印帳 / あつめる / 自分** に変更する。行きたいリストを「コレクション」から地図タブへ移し、実績（過去）と計画（未来）を分ける。あわせて「自分」タブに位置情報の行を足す。

方針は `docs/design/mockups/ia-options.html` で3案を比較して **案3で決定済み**。前提だった P1-03（めくり UI）が 2026-08-09 に `passes: true` になったため着手する。

## 関連ドキュメント

- 監査: `docs/design/ux-audit-2026-08.md` — C 章（画面構成の再考）/ A-13 / A-14 / B-6
- モック: `docs/design/mockups/ia-options.html`（案3 が決定）
- 方針: `docs/product/direction.md`
- 前提: `docs/issues/issue-116-goshuincho-flip-ui.md`（御朱印帳タブの中身）
- 教訓: `docs/issues/issue-114-bottom-sheet-redesign.md`（W-3 のタブバー重なり）

## スコープ

### やること

1. **タブの表示名とアイコンを変更**（4タブすべて）
2. **行きたいリストを地図タブへ移す** — `MapStack` に一覧画面を新設し、地図画面のエントリポイントから push する
3. **行きたいリストのカードをタップ可能にする**（監査 A-13）— 地図の該当スポットへ戻る
4. **`CollectionScreen` から行きたいリストのセクションを削除**（監査 B-6）
5. **「自分」タブに位置情報の行を追加**（監査 A-14）— `Linking.openSettings()` で OS 設定へ
6. タブ表示名に依存している **E2E フローとテストを追随**させる

### スコープ外（実装しないこと）

- **帳面（`goshuincho`）の一覧・選択 UI** — 既存 stamps が全件 `goshuincho_id = null` で、記録フロー改修 + backfill migration が別途必要。P1-03 でも意図的に外している。**これが入ると規模が L から XL になる**
- **監査 A-10**（グリッド0件時の CTA ボタン）— IA とは独立。小さい改善の PR に回す
- **内部ルート名の改名** — `MapTab` / `GalleryTab` / `CollectionTab` / `Settings` は据え置く（理由は調査結果 2）
- 監査 A-9（ピンの色）、A-12 の再検討、D-3（記録の確認モーダル）
- FAB の位置（`766feb9` で右下に移動済み）

### 副次的に解決するもの

監査 **B-6**（コレクションタブの中身が混在）/ **A-13** / **A-14**

---

## 調査結果（実装方針の前提となる確定事実）

### 1. 現行のタブ定義は `TabNavigator.tsx` の1ファイルに閉じている

`src/navigation/TabNavigator.tsx:21-53` に4つの `Tab.Screen` があり、`title` と `tabBarIcon` を持つ。表示名の変更はこのファイルだけで完結する。

| ルート名        | 現行 title   | 現行 icon       | 変更後 title | 変更後 icon                |
| --------------- | ------------ | --------------- | ------------ | -------------------------- |
| `MapTab`        | 地図         | `explore`       | 地図         | `explore`（変更なし）      |
| `GalleryTab`    | 御朱印       | `photo-library` | **御朱印帳** | **`menu-book`**            |
| `CollectionTab` | コレクション | `emoji-events`  | **あつめる** | `emoji-events`（変更なし） |
| `Settings`      | 設定         | `settings`      | **自分**     | **`person`**               |

タブの並び順は変更しない（地図が先頭・初期タブのまま）。

### 2. 内部ルート名は改名しない

`MapTab` / `CollectionTab` は以下から名前で参照されている。改名すると全呼び出し箇所とテストに波及するが、**得られるものは可読性だけ**なので据え置く。

| 参照元                     | 行     | 内容                                                  |
| -------------------------- | ------ | ----------------------------------------------------- |
| `OnboardingScreen.tsx`     | 85, 95 | `navigate('MainTabs', { screen: 'MapTab', ... })`     |
| `CollectionScreen.tsx`     | 74     | `parent.navigate('MapTab', { ... })`（地域別 → 地図） |
| `RecordCompleteScreen.tsx` | 28     | `MapTab` へ                                           |
| `RecordCompleteScreen.tsx` | 33     | `CollectionTab` / `CollectionList` へ                 |
| 各 `__tests__`             | 多数   | 上記の呼び出しを assert している                      |

### 3. `RecordCompleteScreen` のボタン文言だけは追随が要る

`RecordCompleteScreen.tsx:101` が「**コレクションを確認**」というラベルで `CollectionTab` へ遷移する。タブ名が「あつめる」になるので文言を揃える。遷移先そのものは変えない。

### 4. E2E がタブの表示テキストでタップしている

`e2e/flows/smoke.yaml:12-21`:

```yaml
- assertVisible: '地図'
- assertVisible: '御朱印'
- assertVisible: 'コレクション'
- assertVisible: '設定'
- tapOn: '御朱印'
- tapOn: 'コレクション'
- tapOn: '地図'
```

**表示名を変えると3行が壊れる**。`smoke.yaml` の更新は必須。`store-screenshots.yaml` はタブ名でタップしていない（`grep` 済み）ので影響なし。

### 5. 行きたいリストは `CollectionScreen` の1セクションとして実装されている

- 描画: `CollectionScreen.tsx:317-352`（見出し「行きたいリスト」+ `wishlistSpots.map`）
- データ: `useWishlistSpots`（`src/hooks/useWishlistSpots.ts`）— `useFocusEffect` でフォーカス時に再取得する。**画面に依存しない実装**なので、そのまま新画面へ移せる
- 削除操作: `removeFromWishlist`（`src/services/wishlist.ts`）+ `WishlistButton`
- カードは `View` + `Card` で `onPress` を持たない（監査 A-13）。押せるのは削除ボタンだけ

`useWishlistSpots` の docstring に「CollectionScreen用」とあるので、移設にあわせて修正する。

### 6. 地図へスポットを指定して戻る仕組みは既にある

`MapScreen.tsx:160-177` が `route.params?.focusSpotId` を読み、`displaySpots` から探して `animateToRegion` + `setSelectedSpotId` する。型も `navigation/types.ts:45` にある。

```ts
Map: { focusSpotId?: string; focusPrefecture?: string } | undefined;
```

**A-13 は新規実装ではなく結線のみ**。

### 7. 地図画面の上部レイアウト

`MapScreen.tsx:105` で `searchRowTop = insets.top + spacing.xs`。検索行（`searchRow`）は `position: absolute` で `zIndex: 10`。フィルタのドロップダウンと位置情報バナーが `searchRowTop + 52` に出る（`345`, `428`）。

行きたいリストへのエントリポイントを検索行の下に置く場合、この 52 のオフセットと重ならないようにする。**FAB（`fabContainer`: `bottom: 20 / right: 20`）とは別の位置にする**。

### 8. ⚠️ シートやオーバーレイを画面下端に置かない

`docs/issues/issue-114-bottom-sheet-redesign.md` の W-3: **シートの親はタブバーを除いた領域**なので、`Dimensions.get('window').height` 基準で位置を計算すると差分だけ下にずれ、下端の操作要素がタブバーの裏に潜り込む。

本 issue は push 遷移の一覧画面なのでこの罠は原理的に踏まないが、**画面下端に固定の操作要素を置く場合は `BottomTabBarHeightContext` から実タブバー高さを取ること**。

### 9. `SettingsScreen` は3セクション構成

`src/screens/SettingsScreen.tsx` — アカウント（`51`）/ 公開設定（`78`）/ アプリ情報（`100`）。位置情報の行は無い。

利用規約・プライバシーポリシーの行（`106-127`）が「`TouchableOpacity` + ラベル + `chevron-right`」のパターンなので、**位置情報の行はこれを踏襲する**。

OS の権限はアプリから直接トグルできない（iOS/Android 共通）。`Linking.openSettings()` で OS 設定アプリへ飛ばす。この作法は `ErrorScreen.tsx:80`（位置情報エラー）に既存。

### 10. テーマトークン（直値禁止）

色・余白・文字は `src/theme/` を参照する。直値を書かない（`CLAUDE.md` コード規約）。

### 11. `toHaveStyle` は使えない

`@testing-library/jest-native` はこのプロジェクトに未導入。スタイル検証は `StyleSheet.flatten(node.props.style)` で行う（#114 / #116 と同じ）。

---

## 詳細設計

### 対象ファイル

#### 新規

| パス                                            | 役割                                                |
| ----------------------------------------------- | --------------------------------------------------- |
| `src/screens/WishlistScreen.tsx`                | 行きたいリストの一覧画面（MapStack に push される） |
| `src/screens/__tests__/WishlistScreen.test.tsx` | 上記のテスト                                        |

#### 変更

| パス                                   | 変更内容                                            |
| -------------------------------------- | --------------------------------------------------- |
| `src/navigation/TabNavigator.tsx`      | 4タブの `title` と `tabBarIcon`                     |
| `src/navigation/MapStack.tsx`          | `Wishlist` 画面を追加                               |
| `src/navigation/types.ts`              | `MapStackParamList` に `Wishlist: undefined` を追加 |
| `src/screens/MapScreen.tsx`            | 行きたいリストへのエントリポイントを追加            |
| `src/screens/CollectionScreen.tsx`     | 行きたいリストのセクションを削除                    |
| `src/screens/SettingsScreen.tsx`       | 位置情報の行を追加                                  |
| `src/screens/RecordCompleteScreen.tsx` | ボタン文言「コレクションを確認」→「あつめるを見る」 |
| `src/hooks/useWishlistSpots.ts`        | docstring の修正のみ                                |
| `e2e/flows/smoke.yaml`                 | タブ表示名の追随                                    |
| 各 `__tests__`                         | 上記に対応するテスト更新                            |

#### 変更しないファイル

- `src/navigation/RootNavigator.tsx` / `GalleryStack.tsx` / `CollectionStack.tsx`
- `src/screens/GalleryScreen.tsx` および `src/components/gallery/*`（御朱印帳タブは表示名のみの変更）
- `src/services/wishlist.ts` / `src/components/animated/WishlistButton.tsx`
- `src/screens/OnboardingScreen.tsx`（`MapTab` 参照のみで表示名に依存しない）
- `e2e/flows/store-screenshots.yaml`

### 行きたいリストへのエントリポイント

地図画面の**検索行の下**に、行きたい件数を出すボタンを置く。

- ラベル: `行きたい`、件数が1件以上なら `行きたい (12)` のように付ける
- アイコン: `bookmark`（#114 で「行きたい」の語彙を `flag` → `bookmark` に変更済み。それに揃える）
- 位置: `searchRowTop + 52` より下（フィルタのドロップダウン・位置情報バナーと重ならないこと）
- **0件でも表示する**（押すと空状態の一覧が出る）。未ログイン時も表示し、押した先で空状態を出す
- `testID="wishlist-entry"`

### `WishlistScreen`（新規）

`CollectionScreen.tsx:317-352` の描画をそのまま移し、カードを押せるようにする。

```
┌────────────────────┐
│ ‹  行きたいリスト      │  ← ヘッダー（MapStack の標準ヘッダー）
│ ┌────────────────┐ │
│ │ 浅草神社    [神社] │ │  ← カード全体がタップ可能
│ │ 📍 東京都台東区…  🔖│ │     🔖 は削除ボタン（従来どおり）
│ └────────────────┘ │
└────────────────────┘
```

- データ取得は `useWishlistSpots` をそのまま使う
- **カードタップ** → `navigation.navigate('Map', { focusSpotId: item.spot_id })`
- **削除ボタン**（`WishlistButton`）→ 従来どおり `removeFromWishlist` + `refetch`。カードタップとは独立して動くこと（削除を押してカードの遷移が誤爆しない）
- 空状態: 既存の文言「行きたいスポットをマップで保存しましょう」+ `bookmark-border` アイコンを踏襲
- `testID`: 画面 `wishlist-screen`、各カード `wishlist-item-<spot_id>`（`CollectionScreen` の既存 testID を引き継ぐ）

### `CollectionScreen` の変更

- 「行きたいリスト」の見出しとリスト（`317-352`）を削除
- `useWishlistSpots` / `removeFromWishlist` / `WishlistButton` の import と `handleRemoveFromWishlist` を削除
- 残るセクションは **獲得バッジ / 巡礼チャレンジ / 地域別** の3つ
- 地域別 → 地図（`focusPrefecture`）の遷移は**変更しない**
- 未ログイン時の空状態の文言に「行きたい」への言及があれば、地図タブを指すように直す

### 「自分」タブの位置情報の行

`SettingsScreen` のアプリ情報セクションの**前**に、新しいセクションとして置く。

```
アカウント
公開設定
位置情報        ← 新規
  現在地の利用      [許可済み / 未許可]  ›
アプリ情報
```

- 行をタップ → `Linking.openSettings()`
- 現在の許諾状態を右側に出す。`expo-location` の `getForegroundPermissionsAsync()` を使い、`granted` なら「許可済み」、それ以外は「未許可」
- 状態取得に失敗した場合は状態表示を出さない（行自体は出す。握り潰さず `console.warn`）
- `testID="location-settings-row"`

---

## テスト方針

- 新規: `WishlistScreen.test.tsx`
- 更新: `TabNavigator.test.tsx` / `CollectionScreen.test.tsx` / `SettingsScreen.test.tsx` / `RecordCompleteScreen.test.tsx` / `MapScreen.test.tsx`
- `expo-location` は `jest.setup.js` にモック済み（`getForegroundPermissionsAsync` が `granted` を返す）。未許可のケースはテスト内で上書きする
- `Linking.openSettings` は `jest.spyOn(Linking, 'openSettings')` でスパイする。**戻り値は `Promise` なので `mockImplementation(() => Promise.resolve())` にすること**（#121 で typecheck が落ちた）

---

## 受入基準（Acceptance Criteria）

### A. タブ構成（Jest）

- [ ] A-1 タブの表示名が `地図` / `御朱印帳` / `あつめる` / `自分` の4つである
- [ ] A-2 タブの並び順が 地図 → 御朱印帳 → あつめる → 自分 である
- [ ] A-3 初期表示のタブが `地図` である
- [ ] A-4 内部ルート名が `MapTab` / `GalleryTab` / `CollectionTab` / `Settings` のまま変わっていない
- [ ] A-5 `御朱印帳` のアイコンが `menu-book`、`自分` のアイコンが `person` である
- [ ] A-6 `地図` と `あつめる` のアイコンが従来どおり `explore` / `emoji-events` である

### B. 行きたいリストの移設（Jest）

- [ ] B-1 `MapStackParamList` に `Wishlist` が存在する
- [ ] B-2 地図画面に `testID="wishlist-entry"` の要素がある
- [ ] B-3 エントリポイントをタップすると `navigate('Wishlist')` が呼ばれる
- [ ] B-4 行きたいが0件でもエントリポイントが表示される
- [ ] B-5 行きたいが1件以上のとき、エントリポイントに件数が出る
- [ ] B-6 `WishlistScreen` が `useWishlistSpots` の結果をカードとして描画する
- [ ] B-7 カードをタップすると `navigate('Map', { focusSpotId: <spot_id> })` が呼ばれる
- [ ] B-8 削除ボタンをタップしても**カードの遷移が発火しない**
- [ ] B-9 削除ボタンをタップすると `removeFromWishlist` が呼ばれ、`refetch` される
- [ ] B-10 0件のとき空状態の文言が出る
- [ ] B-11 未ログインのとき空状態が出る（エラーにならない）

### C. あつめるタブ（Jest）

- [ ] C-1 `CollectionScreen` に「行きたいリスト」の見出しが**無い**
- [ ] C-2 `CollectionScreen` に `wishlist-item-*` の testID が**無い**
- [ ] C-3 獲得バッジ / 巡礼チャレンジ / 地域別 の3セクションが残っている
- [ ] C-4 地域別から都道府県をタップすると従来どおり `navigate('MapTab', { ... focusPrefecture })` が呼ばれる
- [ ] C-5 `CollectionScreen` が `useWishlistSpots` を import して**いない**

### D. 自分タブ（Jest）

- [ ] D-1 `SettingsScreen` に `testID="location-settings-row"` の行がある
- [ ] D-2 その行をタップすると `Linking.openSettings()` が呼ばれる
- [ ] D-3 権限が `granted` のとき「許可済み」と表示される
- [ ] D-4 権限が `denied` のとき「未許可」と表示される
- [ ] D-5 権限の取得に失敗しても画面が落ちず、行自体は表示される
- [ ] D-6 アカウント / 公開設定 / アプリ情報の3セクションが残っている

### E. 追随（Jest）

- [ ] E-1 `RecordCompleteScreen` のボタン文言が「あつめるを見る」である
- [ ] E-2 そのボタンの遷移先が従来どおり `CollectionTab` / `CollectionList` である
- [ ] E-3 `e2e/flows/smoke.yaml` のタブ名が新しい表示名に更新されている

### UI. 視覚仕様（`StyleSheet.flatten` で検証）

- [ ] UI-1 行きたいのエントリポイントが `searchRowTop + 52` より下にある（フィルタのドロップダウン・位置情報バナーと重ならない）
- [ ] UI-2 エントリポイントが FAB（`bottom: 20 / right: 20`）と重ならない
- [ ] UI-3 新規に追加した色・余白・文字がすべて `src/theme/` のトークン参照である（直値なし）
- [ ] UI-4 `WishlistScreen` のカードのタップ領域が 44×44pt 以上である

### W. Expo Web での目視・操作検証

- [ ] W-1 4つのタブの表示名とアイコンが意図どおりに出る
- [ ] W-2 地図タブから行きたい一覧へ push で入り、戻れる
- [ ] W-3 あつめるタブに行きたいリストが残っていない
- [ ] W-4 自分タブに位置情報の行が出る
- [ ] W-5 コンソールに**新規の**エラー・警告が出ていない（`spots?...id=eq.` / `stamps?...id=eq.` の 400 2件と `ImageGalleryModal` の setValue 警告は既存・対象外）

### N. native-only（実機）

- [ ] N-1 タブバーの表示崩れが無い（4文字の「御朱印帳」がはみ出さない）
- [ ] N-2 行きたい一覧のカードをタップすると地図が該当スポットへ動き、ボトムシートが開く
- [ ] N-3 行きたいから削除 → 一覧から消え、地図のピンの色も変わる
- [ ] N-4 自分タブの位置情報の行から OS の設定アプリへ遷移する
- [ ] N-5 位置情報を OS 設定で許可/拒否に変えてアプリに戻ると、行の表示が追随する
- [ ] N-6 小型端末でタブバーのラベルが省略されない

### Q. 品質基準

- [ ] Q-1 `npm run lint` が 0 error
- [ ] Q-2 `npm run typecheck` が clean
- [ ] Q-3 `npm test` が全パス（既存 1025 件を割らない）
- [ ] Q-4 「変更しないファイル」に挙げたファイルを変更していない
- [ ] Q-5 スコープ外に挙げた項目を実装していない
- [ ] Q-6 1スライス = 1コミット、Conventional Commits に従っている

---

## 注意事項

- ⚠️ **dev サーバーは作業ツリーを配信する。** この変更が working tree に入った時点で実機の Dev Client のタブ名が変わる。**審査中の v1.0.0（旧タブ）用のストアスクショを撮り終えてから着手すること**
- ⚠️ **`smoke.yaml` を直し忘れると E2E が黙って壊れる**（Maestro は表示テキストでタップしている）
- ⚠️ 画面下端に固定の操作要素を足す場合は `BottomTabBarHeightContext` を使う（#114 W-3）
- 📌 「行きたい」の語彙とアイコンは #114 で `flag` → `bookmark` に統一済み。新規実装もこれに揃える
- 📌 帳面（`goshuincho`）の UI に手を出したくなったら、実装せずに feature-list へ追記して次のループに回す
