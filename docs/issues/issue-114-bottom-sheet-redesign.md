# Issue #114: P1-09 スポット詳細ボトムシートの情報設計の改善

## 概要

マップのスポット詳細ボトムシート（`SpotBottomSheet`）を、**「共通ヘッダー + 段階的な情報追加」**の構造に作り替える。

現状は compact（`SpotCompactCard`）と expanded（`SpotDetailContent`）が**丸ごと差し替わる**ため、展開時に内容が飛び、バッジと名前の並び順も両者で逆になっている。加えて記録 CTA が expanded 内のテキストリンクにしか無く、アプリのコア動作（御朱印を記録する）の入口が深い。

目標形は `docs/design/mockups/ia-options.html` の**画面⑥「ボトムシート（案1〜3で共通）」**。

```
現状                                   本 Issue 後
─────────────────────────           ─────────────────────────
[handle]                              [handle]（タップで展開/収納）
compact: SpotCompactCard              ── 常時レンダリング ──
  名前                                 SpotSheetHeader
  [神社][訪問済み]        🚩            名前 [神社][訪問済み]  🔖
  📍 住所                              📍 住所
  🅿駐車場 🕐受付                      🅿駐車場 🕐受付（0件なら非表示・位置は不変）
  （限定御朱印チップ）                 ── compact のみ ──
                                      限定御朱印 3件（0件なら非表示）
  ↕ 丸ごと差し替え                     [サムネ][サムネ][サムネ]（0件なら非表示）
                                      ── 常時レンダリング ──
expanded: SpotDetailContent           [🔖 行きたい][📷 記録する]
  [神社][訪問済み]  ← 順序が逆         ── expanded で下に追加 ──
  名前              🚩                 ScrollView
  📍 住所                                SpotDetailContent variant="sheet"
  🅿駐車場 🕐受付                          （限定御朱印 full / 御朱印グリッド）
  （限定御朱印）
  📷 御朱印を記録   ← テキストリンク
  （御朱印グリッド）
```

受付時間・駐車場（`SpotInfoSection`）は**両モードで画面上の同じ位置に留まり続ける**。compact から消さない（後述「compact のレイアウト順」）。

- GitHub Issue: #114（P1-09）
- ブランチ: `feature/issue-114-bottom-sheet-redesign` → develop
- 監査根拠: `docs/design/ux-audit-2026-08.md` の A-5 / A-6 / A-7 / A-8 / A-12

## 関連ドキュメント

- [UX 監査 2026-08](../design/ux-audit-2026-08.md) — A-5（シート構造）/ A-6（バッジ1行）/ A-7（記録 CTA）/ A-8（画像）/ A-12（行きたいの語彙）/ B-7（受付時間。**監査側で訂正済み** — 後述）
- [IA モック](../design/mockups/ia-options.html) — 画面⑥（`ia-options.html:1280-1310`、CSS は `:715-778`）
- [プロダクト方針 v2](../product/direction.md)
- [Issue #104 契約書](./issue-104-limited-goshuin-watcher.md) — `LimitedGoshuinSection` / `useSpotInfo` の前提、契約書の書式
- [Issue #099 契約書](./issue-099-map-clustering.md) — マーカー描画コストの制約（本 Issue はピンに触れない根拠）
- `.claude/skills/tdd-workflow/SKILL.md` — テスト規約
- `CLAUDE.md` — コード規約（テーマトークン必須・直値禁止 / 状態管理はカスタム hooks + ローカル state のみ）

## スコープ

### やること

| #   | 内容                                                                                                                                                                                   | 監査対応        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| S-1 | compact を「名前＋種別バッジ＋行きたいアイコンを1行」「住所」「受付時間・駐車場（既存 `SpotInfoSection` を**維持**）」「限定御朱印の件数」「御朱印サムネイル」「アクション行」に再構成 | A-6 / A-8 / B-7 |
| S-2 | 記録 CTA を compact から到達可能にする（`Button` ベースのボタン化）                                                                                                                    | A-7             |
| S-3 | compact/expanded を「共通ヘッダー + 段階的な情報追加」の構造に改める（コンポーネント丸ごと差し替えをやめる）                                                                           | A-5             |
| S-4 | compact と expanded でバッジと名前の並び順が逆になっている不整合を解消する                                                                                                             | A-6（副次発見） |
| S-5 | 「行きたい」と「記録する」を視覚的に対比させ、未来/過去の区別を付ける（アイコン語彙を `bookmark` 系に変更）                                                                            | A-12            |
| S-6 | `COMPACT_HEIGHT = 240` 固定をやめ、内容に応じた可変高さにする                                                                                                                          | A-5             |
| S-7 | 【検証イネーブラ】Expo Web でボトムシートに到達できるよう `react-native-maps` の web スタブを補強する                                                                                  | 検証手段の確保  |

### スコープ外（実装しないこと）

契約書に無いことは実装しない。以下は**明示的にやらない**。

- **タブ構成の変更**（`ia-options.html` の案3）。本 Issue は案1〜3のいずれでも共通する部分のみを対象とする
- **地図ピンの色・形状の変更**（監査 A-9）。Issue #99 のマーカー描画コスト（マーカー churn / `minZoomLevel=8` での封じ込め）の制約があるため別途
- **営業時間・受付時間の「新しい」取得と表示の仕組み**。`spots` テーブルには該当カラムが無い。ただし **`spot_aggregated_info.info_type='reception_hours'` 経由で既存の `SpotInfoSection` が受付時間を表示できる仕組みは既に通っている**（本番実測: `reception_hours` 2件 / `parking` 3件と極めて疎）。本 Issue ではこの既存表示を**compact / expanded 双方で維持する**（下記「compact のレイアウト順」参照）。新たなデータ取得経路の追加・カバレッジ拡大は別途<br>※ 監査 `ux-audit-2026-08.md` B-7 の「受付時間のカラムが無い＝データ取得の課題」という記述は誤り（`spots` のみを見て `spot_aggregated_info` を見落としていた）。監査側で訂正済み
- **中間スナップ（3段階スナップ）の追加**。compact/expanded の2段階を維持する
- サムネイルの新しい供給源の開拓（外観写真の外部データ取り込み等）。既存の `useSpotStamps` が返す画像のみを使う
- `MapScreen` のロジック変更（未ログイン時の `LoginPromptModal` 結線は**既存のまま流用する**）
- `SpotDetailScreen` への新規結線・ルート追加（現状リポジトリ内に `navigate('SpotDetail')` の呼び出しは無く到達不能。ただし**コンパイルと既存テストは通し続ける**）
- 限定御朱印セクション（`LimitedGoshuinSection`）の内部仕様変更
- `ImageGalleryModal` の仕様変更
- `SpotInfoSection` の内部仕様変更（表示項目の追加・文言変更・スタイル変更）。**配置場所のみ本 Issue で扱い、コンポーネント自体は無変更**

---

## 調査結果（実装方針の前提となる確定事実）

コードから確認済み（2026-08-09）。実装時にこの前提が崩れていたら、実装より先に契約書を更新する。

### 1. 未ログイン時の「記録する」は既存結線で成立している

`src/screens/MapScreen.tsx:276-285`

```ts
const handleBottomSheetRecord = useCallback(
  (spotId: string) => {
    if (isAuthenticated) {
      navigateToRecord(spotId);
    } else {
      setShowLoginModal(true); // ← LoginPromptModal
    }
  },
  [isAuthenticated]
);
```

→ **「記録する」ボタンは未ログインでも常に活性**にし、`onRecord` をそのまま呼ぶ。disabled にしたり、シート側で分岐したりしない。`isAuthenticated` を新たに props で受け渡す必要も無い（`SpotBottomSheet` は既に `useAuth()` を呼んでいるが、それは `SpotDetailContent` の `showVisited` 用）。

「行きたい」も同じ（`MapScreen.tsx:287-296` で未ログインなら `LoginPromptModal`）。

### 2. Expo Web では現状ボトムシートに到達できない（S-7 の根拠）

| 経路                                      | 現状の web での挙動                                                                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ピンをタップ                              | `metro.config.js` が web で `react-native-maps` を `src/utils/react-native-maps.web.ts` に解決する。スタブの `Marker` は素の `View` で `onPress` を持たない → 押せない |
| 検索 → `navigate('Map', { focusSpotId })` | `MapScreen.tsx:166` の `mapRef.current.animateToRegion(...)` がスタブ（`View`）に存在せず TypeError → `setSelectedSpotId`（`:176`）に到達しない                        |

一方で以下は web でも成立する:

- `useLocation`（`src/hooks/useLocation.ts:28-32, 44-50`）は権限が無い / 失敗したときも `DEFAULT_LOCATION` を入れるため `location` は必ず非 null になる
- → `useSpots`（`src/hooks/useSpots.ts:24-27`）が `fetchAllActiveSpots()` を実行し `displaySpots` が埋まる
- → `MapScreen.tsx:163` の `displaySpots.find(...)` は成功する

→ **web スタブの `MapView` に no-op の `animateToRegion` / `animateCamera` / `fitToCoordinates` を生やすだけで、検索 → 結果タップ → ボトムシート表示の経路が web で通る**。これが S-7。ピンのタップ可能化は行わない（スタブの `Marker` には地図投影が無く全ピンが原点に重なるため、特定ピンの指定タップは不安定）。

このファイルは `platform === 'web'` のときにのみ解決される web 専用スタブであり、ネイティブの挙動には一切影響しない。

### 3. ドラッグ操作とボタンタップの競合は「現状の設定のままで正しい」

`SpotBottomSheet.tsx:90-97`

```ts
onStartShouldSetPanResponder: () => false,          // ← タップは常に子に届く
onMoveShouldSetPanResponder: (_, gestureState) =>
  Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
```

- `onStartShouldSetPanResponder: false` なので、**指を置いた瞬間に親がレスポンダを奪うことはない**。compact にボタンを置いてもタップは成立する
- 8px 以上の縦移動が発生した時点で親がレスポンダを奪い、React Native のレスポンダ交渉により子の `TouchableOpacity` の press はキャンセルされる（＝ボタンの上から始めたドラッグでもシートが動き、指を離しても `onPress` は発火しない）。これは意図した挙動
- → **`dy > 8` の閾値は変更しない**。閾値を上げるとドラッグの追従が鈍り、下げると誤キャンセルが増える

`galleryOpenRef`（`:92`）でギャラリーモーダル表示中はドラッグを無効化する既存の仕組みも維持する。

### 4. 既存 testID の互換制約

| testID            | 参照元                                                          | 制約                                                                                |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `spot-name`       | `src/screens/__tests__/SpotDetailScreen.test.tsx:160,177`       | `props.children` が**スポット名の文字列そのもの**であること（配列にしてはいけない） |
| `wishlist-button` | `src/screens/__tests__/CollectionScreen.test.tsx:340`           | `WishlistButton` の testID は維持する                                               |
| `bottom-sheet`    | `src/components/spot-detail/__tests__/SpotBottomSheet.test.tsx` | 維持する                                                                            |
| `badge-shrine` 他 | `Badge` コンポーネント由来。複数箇所                            | `Badge` 自体は変更しない                                                            |

### 5. テーマトークン（直値禁止）

| 用途               | トークン                                                               | 実値                        |
| ------------------ | ---------------------------------------------------------------------- | --------------------------- |
| primary CTA 背景   | `colors.primary[500]`                                                  | `#f27f0d`                   |
| 行きたい（有効）色 | `colors.pin.wishlisted`                                                | `#F59E0B`（地図ピンと同一） |
| 行きたい（無効）色 | `colors.gray[400]`                                                     | `#9CA3AF`                   |
| 余白               | `spacing.xs/sm/md/lg` = 4/8/12/16                                      |                             |
| 角丸               | `borderRadius.sm/md/lg` = 4/8/12                                       |                             |
| 文字               | `typography.h3`(18/600) / `body`(16) / `bodySmall`(14) / `caption`(12) |                             |

`colors.pin.wishlisted` と `colors.warning` は同値（`#F59E0B`）だが、**意味的に地図ピンと揃える意図なので `colors.pin.wishlisted` を使う**。

### 6. `Button` の現状タップ領域は 48pt（44pt 基準を満たす）

`src/components/common/Button.tsx` の `styles.base`: `paddingVertical: spacing.md`(12) × 2 + `typography.button.lineHeight`(24) = **48pt**。ただし `paddingHorizontal: spacing['2xl']`(24) は 2 ボタン横並びだと文言が窮屈になるため、アクション行では `style` で上書きする。

`WishlistButton` の現状の実効タップ領域は 24（アイコン）+ hitSlop 8×2 = **40pt** で 44pt を下回る。

### 7. サムネイルの供給源は既存フックで足りる

`SpotBottomSheet.tsx:40` が既に `useSpotStamps` から `stamps`（自分の記録）と `publicStamps`（他ユーザーの公開御朱印）を取得している。**新規のデータ取得は不要**。ただし監査 A-8 の懸念どおり、リリース直後は両方 0 件のスポットが大半になる。

---

## 詳細設計

### 対象ファイル

#### 新規

| ファイル                                                           | 内容                                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/components/spot-detail/SpotSheetHeader.tsx`                   | compact / expanded 共通ヘッダー（名前・種別バッジ・訪問済みバッジ・行きたい標示・住所） |
| `src/components/spot-detail/SpotThumbnailStrip.tsx`                | 御朱印サムネイル（最大3枚）+ 純関数 `selectSheetThumbnails` を export                   |
| `src/components/spot-detail/SpotSheetActions.tsx`                  | 「行きたい」「記録する」の2ボタン行                                                     |
| `src/components/spot-detail/__tests__/SpotSheetHeader.test.tsx`    | 上記のテスト                                                                            |
| `src/components/spot-detail/__tests__/SpotThumbnailStrip.test.tsx` | 上記のテスト（純関数のユニットテストを含む）                                            |
| `src/components/spot-detail/__tests__/SpotSheetActions.test.tsx`   | 上記のテスト                                                                            |

#### 変更

| ファイル                                                          | 変更内容                                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/spot-detail/SpotBottomSheet.tsx`                  | 構造を「共通ヘッダー + 段階的追加」に再構成。`resolveCompactHeight` を export。高さの可変化。ハンドルのタップ切替                  |
| `src/components/spot-detail/SpotDetailContent.tsx`                | `variant?: 'standalone' \| 'sheet'` を追加。ヘッダーを `SpotSheetHeader` に置換、`recordLink` を `SpotSheetActions` に置換         |
| `src/components/common/Button.tsx`                                | 任意の `icon?: keyof typeof MaterialIcons.glyphMap` を追加（後方互換・既存呼び出しは無変更）                                       |
| `src/components/animated/WishlistButton.tsx`                      | アイコンを `flag`/`outlined-flag` → `bookmark`/`bookmark-border` に変更。有効色を `colors.pin.wishlisted` に。タップ領域 44pt 確保 |
| `src/screens/CollectionScreen.tsx`                                | 行きたいリストの空状態アイコン（`:320`）を `outlined-flag` → `bookmark-border`（語彙の一貫性のみ。他は無変更）                     |
| `src/utils/react-native-maps.web.ts`                              | MapView スタブに no-op の `animateToRegion` / `animateCamera` / `fitToCoordinates` を生やす（web 専用・S-7）                       |
| `src/components/spot-detail/__tests__/SpotBottomSheet.test.tsx`   | 新構造のテストを追加。既存5ケースはそのまま通す                                                                                    |
| `src/components/spot-detail/__tests__/SpotDetailContent.test.tsx` | `variant` のテストを追加。既存アサーションは無変更                                                                                 |
| `src/components/__tests__/Button.test.tsx`（無ければ新規）        | `icon` プロップのテストを追加                                                                                                      |

#### 削除

| ファイル                                                        | 理由                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/components/spot-detail/SpotCompactCard.tsx`                | 役割を `SpotSheetHeader` + `SpotBottomSheet` に吸収（S-3） |
| `src/components/spot-detail/__tests__/SpotCompactCard.test.tsx` | 上記に伴い削除。カバーしていた内容は新テストへ移す         |

**移設先の対応表**（削除で検証が消えないことの担保）:

| 旧テスト（SpotCompactCard.test.tsx）                            | 移設先                      |
| --------------------------------------------------------------- | --------------------------- |
| スポット名 / 神社・寺バッジ / 訪問済みバッジ / 住所 / 住所 null | `SpotSheetHeader.test.tsx`  |
| 行きたいボタンの表示・非表示・押下                              | `SpotSheetActions.test.tsx` |
| 限定御朱印チップ（2件 / spotInfo なし）                         | `SpotBottomSheet.test.tsx`  |

#### 変更しないファイル

`src/components/spot-detail/SpotInfoSection.tsx` とそのテスト、`src/components/spot-detail/LimitedGoshuinSection.tsx` とそのテスト、`src/components/common/Badge.tsx`、`src/components/common/ImageGalleryModal.tsx`、`src/components/common/LoginPromptModal.tsx`、`src/screens/MapScreen.tsx`、`src/screens/SpotDetailScreen.tsx`、`src/hooks/` 配下すべて、`src/services/` 配下すべて、`src/theme/` 配下すべて、`src/navigation/` 配下すべて、`supabase/` 配下すべて、`metro.config.js`、`jest.setup.js`、`jest.config.js`、`.eslintrc.js`、`tsconfig.json`、`package.json`。

---

### コンポーネント構成（S-3 の中核）

```tsx
// SpotBottomSheet.tsx
<Animated.View testID="bottom-sheet" {...panResponder.panHandlers}>

  <View testID="spot-sheet-primary" onLayout={handlePrimaryLayout}>   {/* ← 高さ計測対象 */}

    <TouchableOpacity testID="sheet-handle" onPress={toggleMode}>
      <View style={styles.handle} />
    </TouchableOpacity>

    {/* 共通ヘッダー：両モードで同一・同順序 */}
    <SpotSheetHeader
      spot={spot}
      isVisited={isAuthenticated && visitedSpotIds.has(spotId)}
      isWishlisted={isWishlisted}
    />

    {/* 常時：受付時間・駐車場・兼務社。表示項目0件なら自身で null を返す */}
    {spotInfo && <SpotInfoSection spotInfo={spotInfo} />}

    {/* compact のみの段階的情報（expanded では下の ScrollView が同等以上を出す） */}
    {mode !== 'expanded' && (
      <>
        <LimitedGoshuinSection info={spotInfo?.limitedGoshuin} variant="compact" />
        <SpotThumbnailStrip stamps={stamps} publicStamps={publicStamps} onPress={expand} />
      </>
    )}

    {/* 常時：シート内で最も強い CTA */}
    <SpotSheetActions
      isWishlisted={isWishlisted}
      onWishlistPress={onWishlistToggle ? handleWishlistPress : undefined}
      onRecordPress={handleRecord}
    />
  </View>

  {/* expanded で「下に足される」情報。ヘッダーもアクションも差し替わらない */}
  {mode === 'expanded' && (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <SpotDetailContent variant="sheet" ... />
    </ScrollView>
  )}
</Animated.View>
```

#### compact のレイアウト順（確定）

```
ヘッダー（名前 ＋ 種別バッジ ＋ 訪問済みバッジ ＋ 行きたい標示 / 📍住所）
  ↓
SpotInfoSection（🅿駐車場・🕐受付時間・🏛兼務社。0件なら行ごと消える）
  ↓
限定御朱印 N件（0件なら行ごと消える）
  ↓
御朱印サムネイル 最大3枚（0件なら行ごと消える）
  ↓
[ 🔖 行きたい ][ 📷 記録する ]
```

**`SpotInfoSection` は compact に残す**（現状 `SpotCompactCard.tsx:56` が描画しているものを維持する）。根拠:

- 本監査の発端となった実機フィードバックで、ユーザーは「初期表示の時点で、その神社が空いている時間などの情報も表示したい」と要望している。受付時間は compact に出したい情報である
- `SpotInfoSection.tsx:40` は表示項目が 0 件のとき `null` を返す。データが無いスポットでは行ごと消えるため、`SpotThumbnailStrip` と同じ「空なら行ごと消す」挙動になり、S-6 の可変高さと整合する（間延びの懸念が無い）
- 本 Issue は情報**設計**の改善であって情報**量**の削減ではない。現に表示されているものを消すのは逆方向のスコープ外作業にあたる

配置は現状の `SpotCompactCard` / `SpotDetailContent` 両方と同じ「ヘッダーの直後・限定御朱印の直前」を踏襲する。モック `ia-options.html` の画面⑥には対応要素が無いが、モックは住所の下に `.sheet-sub` の細い情報行を積む構造（`:1287-1288`）で、`SpotInfoSection` はまさにその位置に収まる。

#### `variant="sheet"` の責務範囲（二重描画の防止）

`spot-sheet-primary` が常時描画する要素は、`SpotDetailContent` 側では描画してはならない。

| 要素                                   | `variant="sheet"`（シート内） | `variant="standalone"`（既定 / `SpotDetailScreen`） |
| -------------------------------------- | ----------------------------- | --------------------------------------------------- |
| `SpotSheetHeader`                      | 描画しない                    | 描画する                                            |
| `SpotInfoSection`                      | **描画しない**                | 描画する（`spotInfo` があるとき）                   |
| `SpotSheetActions`                     | 描画しない                    | 描画する                                            |
| `LimitedGoshuinSection variant="full"` | 描画する                      | 描画する                                            |
| 御朱印グリッド / `ImageGalleryModal`   | 描画する                      | 描画する                                            |
| ミニマップ（`showMiniMap`）            | 呼び出し側の指定どおり        | 呼び出し側の指定どおり                              |

これにより **A-6 の並び順不整合が全経路で解消される**（`SpotSheetHeader` が並び順を1箇所で決めるため）。また `SpotInfoSection` は compact / expanded を通じて**画面上の同じ位置に留まり続ける**ため、A-5 の「展開時に内容が飛ぶ」問題も同時に解消される。

---

### SpotSheetHeader（新規）

```ts
interface SpotSheetHeaderProps {
  spot: Spot;
  isVisited: boolean;
  isWishlisted?: boolean;
}
```

**訪問済みの判定は呼び出し側が決める**（両者の定義が食い違っていた現状を解消する）:

| 呼び出し元                                | 渡す値                                          | 理由                               |
| ----------------------------------------- | ----------------------------------------------- | ---------------------------------- |
| `SpotBottomSheet`                         | `isAuthenticated && visitedSpotIds.has(spotId)` | 地図ピンの色と同一のソースに揃える |
| `SpotDetailContent`（variant=standalone） | `isAuthenticated && visitCount > 0`             | 既存挙動を維持                     |

レイアウト（モック `ia-options.html:1282-1287` の `.sheet-line1` / `.sheet-sub` に対応）:

```
行1: [ スポット名（flex:1, numberOfLines=1） ] [神社|寺院] [訪問済み] [🔖]
行2: 📍 住所（numberOfLines=1）
```

| 要素                   | testID                          | 仕様                                                                                                                                                                       |
| ---------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| コンテナ               | `spot-sheet-header`             | `paddingHorizontal: spacing.lg`                                                                                                                                            |
| 行1                    | `spot-sheet-name-row`           | `flexDirection: 'row'`, `alignItems: 'center'`, `gap: spacing.sm`                                                                                                          |
| 名前                   | `spot-name`                     | `typography.h3` + `colors.gray[900]`, `flex: 1`, `numberOfLines={1}`。children は文字列そのもの                                                                            |
| 種別バッジ             | `badge-shrine` / `badge-temple` | 既存 `Badge`。`spot.type === 'shrine' ? 'shrine' : 'temple'`                                                                                                               |
| 訪問済みバッジ         | `badge-visited`                 | 既存 `Badge`。`isVisited` が true のときのみ                                                                                                                               |
| 行きたい標示（非活性） | `spot-sheet-wishlist-indicator` | `MaterialIcons name="bookmark" size={18} color={colors.pin.wishlisted}`。**`isWishlisted === true` のときのみ描画**。押せない（`View`/`Text` であって Touchable ではない） |
| 住所行                 | `spot-sheet-address`            | `place` アイコン（14, `colors.gray[400]`）+ `typography.bodySmall` / `colors.gray[500]`。`spot.address` が falsy なら行ごと非描画                                          |

**行きたいの操作系はアクション行に一本化する**。ヘッダーの `bookmark` は状態の標示のみ。1つの状態に対してトグルが2箇所あると押し分けが不明瞭になるため。

---

### SpotThumbnailStrip（新規・A-8 と空状態）

```ts
export const SHEET_THUMBNAIL_LIMIT = 3;

export interface SheetThumbnail {
  id: string;
  imagePath: string;
}

/** 自分の記録を優先し、次に他ユーザーの公開御朱印。id で重複排除し limit 件に切る */
export function selectSheetThumbnails(
  stamps: Stamp[],
  publicStamps: PublicStampWithUser[],
  limit: number = SHEET_THUMBNAIL_LIMIT
): SheetThumbnail[];
```

| 条件                | 描画                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| 選択結果が **0 件** | **コンポーネントが `null` を返す**（プレースホルダも空枠も出さない） |
| 1〜3 件             | 件数分だけ左詰めで描画（3枠固定にして空枠を埋めることはしない）      |

**空状態の設計方針（リリース直後の間延び対策）**: 画像が無いときは行ごと消える。行が消えると `spot-sheet-primary` の実測高さが縮み、compact の高さも自動的に縮む（S-6 の可変高さと連動）。**空枠・グレーのプレースホルダ・「まだ御朱印がありません」といったテキストは置かない**。compact は「名前・住所・限定御朱印・アクション行」だけで完結し、余白が生まれない。

| 要素     | testID                   | 仕様                                                                                                                                                                                                                         |
| -------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| コンテナ | `spot-thumbnails`        | `flexDirection: 'row'`, `gap: spacing.xs`, `paddingHorizontal: spacing.lg`, `marginTop: spacing.sm`                                                                                                                          |
| 各サムネ | `spot-thumbnail-{index}` | `TouchableOpacity`。0 始まりの連番                                                                                                                                                                                           |
| 画像     | —                        | `width = height = (Dimensions.get('window').width - spacing.lg * 2 - spacing.xs * 2) / 3`（`SpotDetailContent.tsx:20` の `STAMP_IMAGE_SIZE` と同一式）、`borderRadius: borderRadius.md`、`backgroundColor: colors.gray[100]` |

タップ時は `onPress()` を呼ぶだけ（`SpotBottomSheet` 側で expanded に切り替える）。**ギャラリーモーダルは compact からは開かない** — 展開後の御朱印グリッドが既存の `ImageGalleryModal` を持っており、モーダル表示中のドラッグ抑止（`galleryOpenRef`）もそちらに実装済みのため、二重実装を避ける。

---

### SpotSheetActions（新規・A-7 / A-12）

```ts
interface SpotSheetActionsProps {
  isWishlisted?: boolean;
  onWishlistPress?: () => void;
  onRecordPress: () => void;
}
```

モック `ia-options.html:1294-1297` / CSS `:756-770` に対応。

| ボタン   | testID                   | variant   | icon                           | ラベル     | 意味         |
| -------- | ------------------------ | --------- | ------------------------------ | ---------- | ------------ |
| 行きたい | `wishlist-action-button` | `outline` | `bookmark` / `bookmark-border` | `行きたい` | 未来（計画） |
| 記録する | `record-action-button`   | `primary` | `photo-camera`                 | `記録する` | 過去（記録） |

**視覚的対比（A-12 の中核）**:

- 記録する = **塗り**（`colors.primary[500]` 背景・`colors.white` 文字）＝ シート内で最も強い CTA
- 行きたい = **枠のみ**（`colors.transparent` 背景・`colors.primary[500]` 枠 1px・`colors.primary[500]` 文字）
- 行きたいが有効（`isWishlisted === true`）のときのみ: 背景 `colors.primary[50]`、枠 `colors.primary[500]`、文字 `colors.primary[700]`、アイコン `bookmark`（塗り）
- アイコンで意味を分ける: `bookmark`（保存＝これから行く）と `photo-camera`（撮る＝行った）

`onWishlistPress` が `undefined` または `isWishlisted` が `undefined` のときは**行きたいボタンを描画せず、記録するボタンが横幅いっぱいになる**（`SpotDetailScreen` 経由の `variant="standalone"` がこのケース）。

スタイル:

| 対象       | 値                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 行コンテナ | testID `spot-sheet-actions`, `flexDirection: 'row'`, `gap: spacing.sm`, `paddingHorizontal: spacing.lg`, `marginTop: spacing.md` |
| 各ボタン   | `flex: 1`, `minHeight: 44`, `paddingHorizontal: spacing.md`（`Button` 既定の 24 を上書き）                                       |

---

### Button の `icon` 拡張（後方互換）

```ts
interface ButtonProps {
  // ...既存はすべて維持
  icon?: keyof typeof MaterialIcons.glyphMap; // 追加
}
```

- `icon` が未指定のときは**現在とまったく同じ DOM/スタイル**（既存の全呼び出し箇所は無変更で動く）
- 指定時: `styles.base` に `flexDirection: 'row'` と `gap: spacing.xs` を加え、`<MaterialIcons name={icon} size={18} color={resolvedColor} />` をラベルの前に描画
- `resolvedColor` = `(textStyle?.color as string) ?? variantTextStyles[variant].color`（文字色とアイコン色を必ず一致させる）

---

### 可変 COMPACT_HEIGHT（S-6）

**判断: 固定値をやめ、内容に応じた可変高さにする。** 理由:

- 本 Issue で compact の要素が「名前/バッジ/住所」の 3 行から「ヘッダー + 限定御朱印チップ + サムネイル + アクション行」に増える。サムネイルの有無だけで実測差が約 120pt 出るため、単一の固定値では**画像ありで見切れ / 画像なしで間延び**の両方が起きる
- 監査 A-5 も「240px 固定なので、限定御朱印が多いスポットでは compact 内で情報が切れる」を課題として挙げている

```ts
export const COMPACT_MIN_HEIGHT = 176;
export const COMPACT_MAX_HEIGHT = 380;
export const COMPACT_FALLBACK_HEIGHT = 240; // 初回レイアウト計測前の初期値（従来値）

/** 計測値を [MIN, min(MAX, 画面高の50%)] に丸める。不正値は FALLBACK */
export function resolveCompactHeight(contentHeight: number, screenHeight: number): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return COMPACT_FALLBACK_HEIGHT;
  const upper = Math.min(COMPACT_MAX_HEIGHT, Math.round(screenHeight * 0.5));
  const lower = Math.min(COMPACT_MIN_HEIGHT, upper);
  return Math.min(Math.max(Math.round(contentHeight), lower), upper);
}
```

`screenHeight * 0.5` の上限は、小型端末（iPhone SE = 667pt）で compact が画面の半分以上を覆って地図が見えなくなるのを防ぐため。

計測とアニメーションの取り回し（**実装時の必須制約**）:

1. `spot-sheet-primary` の `onLayout` で `Math.round(e.nativeEvent.layout.height)` を state に入れる
2. **`mode === 'expanded'` のときは計測値を反映しない**。expanded では compact 専用要素（限定御朱印チップ・サムネイル）が描画されず、そのまま採用すると compact の高さが不当に縮むため。直前の compact 計測値を保持する
3. 丸めた値が現在値と同じなら `setState` を呼ばない（無限ループ防止）
4. 現状の open/close 用 `useEffect`（`SpotBottomSheet.tsx:76-85`）は依存配列に `compactPosition` を持つため、**計測で `compactPosition` が変わるたびに `setMode('compact')` が走って expanded から引き戻される**。以下の 2 つに分割する:
   - **開閉エフェクト**: 依存は `[spotId, spot]`。開くとき `setMode('compact')` + `animateTo(compactPosition)`、閉じるとき `animateTo(SCREEN_HEIGHT)`
   - **再配置エフェクト**: 依存は `[compactPosition, mode]`。**`mode === 'compact'` のときだけ** `animateTo(compactPosition)` を実行

`expandedHeight`（`SCREEN_HEIGHT * 0.85`）とスナップ判定の閾値（`dy < -40` / `dy > 40` / `dy > 80` / `vy`）は**変更しない**。

---

### ハンドルのタップで展開/収納（S-3 の付随・検証イネーブラ）

`sheet-handle`（`TouchableOpacity`）のタップで `compact ⇄ expanded` をトグルする。

- ドラッグでしか展開できない現状は、(a) Expo Web / Playwright で PanResponder のドラッグを安定して再現できない、(b) アクセシビリティ上もタップ手段が無い、の 2 点で不利
- `onStartShouldSetPanResponder: false` のため、ハンドルの単純タップは PanResponder に奪われず `onPress` が発火する。8px 以上動けば従来どおりドラッグになる
- **これは Issue #114 の本文に明記が無い追加項目**。実装前に人間ゲートで確認する（本契約書の「判断が必要だった論点」参照）

---

### web スタブの補強（S-7）

`src/utils/react-native-maps.web.ts`:

```ts
const MapView = React.forwardRef((props: any, ref: any) => {
  React.useImperativeHandle(ref, () => ({
    animateToRegion: () => {},
    animateCamera: () => {},
    fitToCoordinates: () => {},
  }));
  return React.createElement(View, props);
});
```

- `Marker` は**変更しない**（押せるようにしても地図投影が無く全ピンが重なるため、指定ピンのタップ検証は成立しない）
- ネイティブビルドではこのファイルは解決されない（`metro.config.js` の `platform === 'web'` 条件）ため、ネイティブ挙動への影響は無い
- これにより Expo Web での到達経路が確立する: **地図タブ → 検索バー → スポット名で検索 → 検索結果をタップ → 地図に戻りボトムシートが compact で表示される**

---

## テスト方針

TDD（t-wada 流 / `tdd-workflow` スキル）。Red → Green → Refactor を 1 スライス = 1 コミットで回す。

推奨スライス順（後段が前段に依存する）:

1. `Button` の `icon` 拡張（純粋に加算的・既存テスト無変更で通る）
2. `WishlistButton` のアイコン語彙とタップ領域
3. `SpotSheetHeader`（純表示）
4. `SpotThumbnailStrip`（`selectSheetThumbnails` の純関数テストから）
5. `SpotSheetActions`
6. `SpotDetailContent` の `variant` 対応
7. `SpotBottomSheet` の再構成 + `resolveCompactHeight` + ハンドルのタップ
8. `SpotCompactCard` とそのテストの削除
9. web スタブ補強

検証手段の割り当て:

| 手段                          | 対象                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Jest                          | 構造・条件付きレンダリング・ハンドラ発火・純関数・`toHaveStyle` によるトークン検証 |
| Expo Web（目視・Playwright）  | 実データでの見た目・レイアウト崩れ・空状態                                         |
| native-only（実機 / Maestro） | ドラッグによるスナップ、ドラッグ中のボタン誤発火抑止、地図ピンからの到達           |

---

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準に基づいて合否判定を行う。

**Expo Web での到達手順（W 系の共通前提）**: `npx expo start --web --port 8081` → ブラウザで `http://localhost:8081` → 地図タブ → 上部の検索バーをタップ → 検索画面でスポット名を入力 → 検索結果の行をタップ → 地図に戻り、下部にボトムシートが compact で表示される。

### A. 構造（S-3 / S-5）

- [ ] **AC-1**: `SpotBottomSheet` を `mode='compact'` で描画したとき、`spot-sheet-header` が存在する
- [ ] **AC-2**: `sheet-handle` を press した後（mode が expanded）も、`spot-sheet-header` が**同一の testID のまま**存在し続ける（compact/expanded でヘッダーが差し替わらない）
- [ ] **AC-3**: `mode='compact'` のとき `spot-detail-content` が存在しない
- [ ] **AC-4**: `sheet-handle` を press すると `spot-detail-content` が出現する
- [ ] **AC-5**: `spot-detail-content` が出現した状態でも `spot-sheet-actions` が存在する（アクション行は両モードで常時表示）
- [ ] **AC-6**: `sheet-handle` を 2 回 press すると `spot-detail-content` が再び存在しなくなる（トグル）
- [ ] **AC-7**: `mode='compact'` かつ**`spotInfo.receptionHours` あり・限定御朱印 1 件以上・`stamps` または `publicStamps` 1 件以上**のフィクスチャで、`spot-sheet-primary` の children 順が `sheet-handle` → `spot-sheet-header` → `spot-info-section` → `limited-goshuin-compact` → `spot-thumbnails` → `spot-sheet-actions` の順である（前提を満たさないと各要素が `null` になり検証が空振りする）
- [ ] **AC-7b**: `mode='compact'` かつ `spotInfo = { receptionHours: { open: '9:00', close: '17:00' } }` のとき `spot-info-section` が描画され、その中に `受付 9:00〜17:00` を含むテキストが存在する（受付時間が初期表示から見える）
- [ ] **AC-7c**: `mode='compact'` かつ `spotInfo` が `null`（`useSpotInfo` が何も返さない）のとき `spot-info-section` が描画されない
- [ ] **AC-7d**: `mode='compact'` かつ `spotInfo = { limitedGoshuin: {...} }`（`parking` / `receptionHours` / `affiliatedShrines` がいずれも無い）のとき `spot-info-section` が描画されない（`SpotInfoSection.tsx:40` の 0 件時 `null` に依存。空の枠が残らない）
- [ ] **AC-7e**: `sheet-handle` を press して expanded にしたとき、`spot-info-section` が**ちょうど 1 個**存在する（`getAllByTestId('spot-info-section')` の length が 1。`variant="sheet"` 側との二重描画が無い）
- [ ] **AC-7f**: `sheet-handle` を press して expanded にした後も `spot-info-section` が存在し続ける（compact で見えていた受付時間が展開で消えない）
- [ ] **AC-8**: `SpotCompactCard.tsx` および `__tests__/SpotCompactCard.test.tsx` がリポジトリに存在しない（`test -e` で不在）
- [ ] **AC-9**: `src/` 配下に文字列 `record-link` が 1 件も存在しない（`grep -r "record-link" src` が 0 件）

### B. ヘッダーの並び順（S-4 / A-6）

- [ ] **AC-10**: `SpotSheetHeader` を `spot.type='shrine'` で描画すると、`spot-sheet-name-row` の children 順が `spot-name` → `badge-shrine` の順である（名前が先、バッジが後）
- [ ] **AC-11**: `SpotDetailContent` を `variant='standalone'`（既定）で描画したときも `spot-sheet-name-row` の children 順が `spot-name` → `badge-shrine` である（compact と expanded で順序が一致）
- [ ] **AC-12**: `spot.type='temple'` のとき `badge-temple` が描画され、`badge-shrine` は描画されない
- [ ] **AC-13**: `isVisited={true}` のとき `badge-visited` が `spot-sheet-name-row` 内に描画される。`isVisited={false}` のとき描画されない
- [ ] **AC-14**: `spot-name` を持つ `Text` の `props.children` がスポット名の文字列そのものである（`SpotDetailScreen.test.tsx:160,177` の既存アサーションが通る）
- [ ] **AC-15**: `spot.address` が `null` のとき `spot-sheet-address` が描画されない
- [ ] **AC-16**: `isWishlisted={true}` のとき `spot-sheet-wishlist-indicator` が描画され、`isWishlisted={false}` / `undefined` のとき描画されない
- [ ] **AC-17**: `spot-sheet-wishlist-indicator` は Touchable ではない（`fireEvent.press` しても `onWishlistPress` が呼ばれない）

### C. アクション行（S-2 / S-5 / A-7 / A-12）

- [ ] **AC-18**: `SpotBottomSheet` を `mode='compact'` で描画したとき `record-action-button` が存在する（展開せずに記録 CTA に到達できる）
- [ ] **AC-19**: `record-action-button` を press すると `onRecord` が対象 `spotId` を引数に 1 回呼ばれる
- [ ] **AC-20**: `record-action-button` のラベルテキストが `記録する` である
- [ ] **AC-21**: `mode='compact'` のとき `wishlist-action-button` が存在し、press すると `onWishlistToggle` が対象 `spotId` を引数に 1 回呼ばれる
- [ ] **AC-22**: `wishlist-action-button` のラベルテキストが `行きたい` である
- [ ] **AC-23**: `onWishlistPress` が `undefined` のとき `wishlist-action-button` が描画されず、`record-action-button` は描画される
- [ ] **AC-24**: 未ログイン（`useAuth().isAuthenticated === false`）でも `record-action-button` が描画され、`disabled` プロップが `true` でない（未ログイン分岐は `MapScreen.tsx:276-285` の既存結線に委ねる）
- [ ] **AC-25**: `SpotDetailContent` を `variant='sheet'` で描画したとき `spot-sheet-header` / `spot-info-section` / `spot-sheet-actions` のいずれも描画されない（シート側との二重描画が無い）
- [ ] **AC-26**: `SpotDetailContent` を `variant='standalone'`（既定）で描画したとき `spot-sheet-header` と `spot-sheet-actions` が描画され、`spotInfo` を渡した場合は `spot-info-section` も描画される
- [ ] **AC-26b**: `SpotDetailContent` を `variant='sheet'` で描画したとき `limited-goshuin-section`（full）と、`stamps`/`publicStamps` があれば `stamp-grid` は描画される（抑止対象はヘッダー・情報行・アクション行の3つだけ）

### D. サムネイルと空状態（S-1 / A-8）

- [ ] **AC-27**: `stamps` と `publicStamps` がいずれも空配列のとき、`SpotThumbnailStrip` が `null` を返す（`spot-thumbnails` が存在しない）
- [ ] **AC-28**: `stamps` 1 件 / `publicStamps` 0 件のとき `spot-thumbnail-0` のみが存在し、`spot-thumbnail-1` は存在しない（空枠で 3 つに埋めない）
- [ ] **AC-29**: `stamps` 2 件 / `publicStamps` 3 件のとき、描画されるサムネイルは `spot-thumbnail-0` 〜 `spot-thumbnail-2` の 3 件で、`spot-thumbnail-3` は存在しない
- [ ] **AC-30**: `selectSheetThumbnails([s1, s2], [p1], 3)` の戻り値の `id` 配列が `['s1','s2','p1']` である（自分の記録が先）
- [ ] **AC-31**: `selectSheetThumbnails([], [], 3)` が空配列を返す
- [ ] **AC-32**: `spot-thumbnail-0` を press すると `SpotThumbnailStrip` の `onPress` が 1 回呼ばれる。`SpotBottomSheet` 経由では press 後に `spot-detail-content` が出現する
- [ ] **AC-33**: `spot-thumbnails` が存在しないケースでも `spot-sheet-actions` が描画される（画像が無くてもアクション行は消えない）

### E. 可変 COMPACT_HEIGHT（S-6）

- [ ] **AC-34**: `resolveCompactHeight(0, 844)` が `240`（`COMPACT_FALLBACK_HEIGHT`）を返す
- [ ] **AC-35**: `resolveCompactHeight(NaN, 844)` が `240` を返す
- [ ] **AC-36**: `resolveCompactHeight(120, 844)` が `176`（`COMPACT_MIN_HEIGHT`）を返す
- [ ] **AC-37**: `resolveCompactHeight(300, 844)` が `300` を返す（下限と上限の間はそのまま）
- [ ] **AC-38**: `resolveCompactHeight(500, 844)` が `380`（`COMPACT_MAX_HEIGHT`）を返す
- [ ] **AC-39**: `resolveCompactHeight(500, 667)` が `334`（`round(667 * 0.5)`）を返す（小型端末では画面の 50% を超えない）
- [ ] **AC-40**: `src/components/spot-detail/SpotBottomSheet.tsx` に文字列 `COMPACT_HEIGHT = 240` が存在しない（`grep` が 0 件）
- [ ] **AC-41**: `sheet-handle` を press して expanded にした後、`spot-sheet-primary` の `onLayout` を（compact より小さい高さで）発火させても、`spot-detail-content` が存在し続ける。かつ `Animated.spring` の spy が compact 位置（`SCREEN_HEIGHT - compactHeight - insets.bottom`）を `toValue` として追加で呼ばれない（expanded 中は計測値を反映しない／再配置エフェクトが走らない）
- [ ] **AC-42**: `spotId` を `null` → `'spot-1'` に変えて再描画すると `mode` が compact になり `spot-detail-content` が存在しない（開閉エフェクトの分割後も既存の開き方が壊れていない）

### F. 視覚仕様（トークン。Jest の `toHaveStyle` で検証）

- [ ] **UI-1**: `record-action-button` の `backgroundColor` が `colors.primary[500]`（`#f27f0d`）である
- [ ] **UI-2**: `record-action-button` のラベル `Text` の `color` が `colors.white`（`#FFFFFF`）である
- [ ] **UI-3**: `isWishlisted={false}` のとき `wishlist-action-button` の `backgroundColor` が `colors.transparent` で、`borderWidth: 1` かつ `borderColor` が `colors.primary[500]` である（塗り／枠の対比が成立している）
- [ ] **UI-4**: `isWishlisted={true}` のとき `wishlist-action-button` の `backgroundColor` が `colors.primary[50]`（`#FFF7ED`）、ラベル `Text` の `color` が `colors.primary[700]`（`#C2410C`）である
- [ ] **UI-5**: `record-action-button` と `wishlist-action-button` の両方が `minHeight: 44` を持つ（44×44pt 基準）
- [ ] **UI-6**: `record-action-button` と `wishlist-action-button` の両方が `flex: 1` を持ち、`spot-sheet-actions` が `flexDirection: 'row'` と `gap: spacing.sm`（8）を持つ（等幅で横並び）
- [ ] **UI-7**: `record-action-button` 内に `photo-camera` アイコンが描画されている（`@expo/vector-icons` のモックがアイコン名をテキストとして描画するため `getByText('photo-camera')` で検証可能）
- [ ] **UI-8**: `isWishlisted={false}` の `wishlist-action-button` 内に `bookmark-border`、`isWishlisted={true}` のとき `bookmark` が描画されている
- [ ] **UI-9**: `spot-sheet-wishlist-indicator` の `color` プロップが `colors.pin.wishlisted`（`#F59E0B`）である
- [ ] **UI-10**: `spot-name` の `Text` が `typography.h3`（`fontSize: 18`, `fontWeight: '600'`）と `colors.gray[900]`（`#111827`）を持ち、`numberOfLines` が 1 である
- [ ] **UI-11**: `spot-sheet-name-row` が `flexDirection: 'row'`, `alignItems: 'center'`, `gap: spacing.sm`（8）を持つ（1 行に収まる指定）
- [ ] **UI-12**: `spot-sheet-address` 内のテキストが `typography.bodySmall`（`fontSize: 14`）と `colors.gray[500]`（`#6B7280`）を持つ
- [ ] **UI-13**: `spot-thumbnails` が `flexDirection: 'row'` と `gap: spacing.xs`（4）を持ち、各サムネイル画像が `borderRadius: borderRadius.md`（8）と `backgroundColor: colors.gray[100]`（`#F3F4F6`）を持つ
- [ ] **UI-14**: `WishlistButton` の外側コンテナが `minWidth: 44` と `minHeight: 44` を持つ（`CollectionScreen` 経由でも 44pt を満たす）
- [ ] **UI-15**: `WishlistButton` が `isWishlisted={true}` で `bookmark`、`false` で `bookmark-border` を描画し、有効時の `color` が `colors.pin.wishlisted`（`#F59E0B`）である（`flag` / `outlined-flag` が残っていない）
- [ ] **UI-16**: `src/` 配下に文字列 `outlined-flag` が 1 件も存在しない（`grep -r "outlined-flag" src` が 0 件。`CollectionScreen.tsx:320` の空状態アイコンを含めて置換済み）
- [ ] **UI-17**: `Button` に `icon` を渡さない既存呼び出しでは `flexDirection` が指定されず、アイコン相当の `Text` が描画されない（後方互換）

### G. Expo Web での目視・操作検証（W）

- [ ] **W-1**: 上記「Expo Web での到達手順」でボトムシートが表示される（現状は `animateToRegion` の TypeError で表示されない。S-7 の成果物）
- [ ] **W-2**: compact 表示で、スポット名・種別バッジ・住所が**縦 2 行**に収まっている（名前とバッジが同じ行にある）
- [ ] **W-3**: compact 表示の最下部に「行きたい」「記録する」の 2 ボタンが等幅で横並びに見えている
- [ ] **W-4**: 「記録する」がオレンジ塗り（`#f27f0d`）、「行きたい」が枠線のみ、で見分けられる
- [ ] **W-5**: 公開御朱印が 0 件のスポットで、サムネイル行が**存在せず**、その分 compact の高さが低い（空枠・空白のブロックが無い）
- [ ] **W-6**: 公開御朱印が 1 件以上あるスポットで、サムネイルが最大 3 枚まで横並びに表示される
- [ ] **W-6b**: 受付時間または駐車場のデータがあるスポット（本番実測で `reception_hours` 2件 / `parking` 3件。`spot_aggregated_info` を検索して対象スポットを1件特定してから検証する）で、**展開せずに** compact に受付時間・駐車場の情報行が見えている
- [ ] **W-6c**: 受付時間も駐車場も兼務社も無いスポットで、compact に情報行の**空の枠や余白が残っていない**
- [ ] **W-7**: ハンドルをクリックするとシートが expanded になり、ヘッダー（名前・バッジ・住所）と情報行とアクション行が**同じ位置に残ったまま**、下に詳細情報が追加される（内容が丸ごと入れ替わらない）
- [ ] **W-7b**: expanded で受付時間・駐車場の情報行が**画面上に1組だけ**表示されている（二重に出ていない）
- [ ] **W-8**: expanded で「行きたい」「記録する」が引き続き見えている
- [ ] **W-9**: 未ログイン状態（web の既定状態）で「記録する」をクリックすると `LoginPromptModal` が表示される
- [ ] **W-10**: ブラウザのコンソールに新規のエラーが出ていない

### H. native-only（実機 / Maestro）

Expo Web では地図背景とスワイプが動作しないため、以下は実機確認に割り当てる。

- [ ] **N-1**: **native-only（実機）** 地図のピンをタップするとボトムシートが compact で開く（回帰確認）
- [ ] **N-2**: **native-only（実機）** compact のハンドル付近から上に 40px 以上ドラッグすると expanded になる（既存のスナップ閾値が維持されている）
- [ ] **N-3**: **native-only（実機）** compact から下に 40px 以上ドラッグするとシートが閉じ `onDismiss` が呼ばれる
- [ ] **N-4**: **native-only（実機）** 「記録する」ボタンの上に指を置いてそのまま縦に 8px 以上ドラッグすると、**シートが動き、指を離しても記録画面に遷移しない**（PanResponder との競合が正しく解決されている）
- [ ] **N-5**: **native-only（実機）** 「記録する」ボタンを 8px 未満の移動でタップすると記録画面に遷移する
- [ ] **N-6**: **native-only（実機）** サムネイルの上から縦ドラッグしてもギャラリーが開かずシートが動く
- [ ] **N-7**: **native-only（実機）** サムネイルが 0 件のスポットと 3 件のスポットで、compact の高さが目視で変わっている（可変高さが効いている）
- [ ] **N-8**: **native-only（実機・iPhone SE 相当の小型端末）** compact が画面の縦半分を超えない
- [ ] **N-9**: **native-only（実機）** 「行きたい」ボタンをタップするとアイコンが `bookmark-border` → `bookmark` に変わり、ヘッダーに `bookmark` 標示が現れ、地図ピンがアンバー（`#F59E0B`）になる（シートと地図の語彙が一致している）
- [ ] **N-10**: **native-only（実機）** ログイン済み状態で「記録する」をタップすると記録画面に遷移する（ログインは Google ネイティブサインインのため Expo Web では到達不能）

### I. 品質基準

- [ ] **Q-1**: `npm test` が全件パスする
- [ ] **Q-2**: `npm run lint` がエラー 0 件
- [ ] **Q-3**: `npm run typecheck` がエラー 0 件
- [ ] **Q-4**: `src/components/spot-detail/` 配下と `src/components/spot-detail/SpotSheet*.tsx` に色・余白・フォントサイズの直値が無い（`StyleSheet.create` 内に `#` で始まる文字列リテラルと、`spacing`/`borderRadius`/`typography` を経由しない数値リテラルが無い。ただし `borderWidth: 1`、`flex: 1`、`minHeight: 44`、`numberOfLines` 等の非トークン量は除く）
- [ ] **Q-5**: 新規コンポーネント 3 本すべてに `__tests__/` の対応テストファイルが存在する
- [ ] **Q-6**: `git diff --stat` に `src/screens/MapScreen.tsx`、`src/hooks/`、`src/services/`、`src/theme/`、`supabase/` の変更が含まれない（スコープ逸脱の検出）

**受入基準の合計: 94 項目**

| 群                                                   | 件数 | 検証手段                       |
| ---------------------------------------------------- | ---- | ------------------------------ |
| AC-1〜AC-42（機能・構造。AC-7b〜7f / AC-26b を含む） | 48   | Jest                           |
| UI-1〜UI-17（視覚仕様）                              | 17   | Jest（`toHaveStyle` / `grep`） |
| W-1〜W-10（Expo Web。W-6b/6c/7b を含む）             | 13   | Expo Web 目視・Playwright      |
| N-1〜N-10（ネイティブ動線）                          | 10   | native-only（実機 / Maestro）  |
| Q-1〜Q-6（品質）                                     | 6    | コマンド実行                   |

---

## 注意事項

### 実装時に気をつけること

1. **`onLayout` の無限ループ**: 計測値は必ず `Math.round` してから比較し、同値なら `setState` しない
2. **`useEffect` の分割を忘れない**: 現状の `[spotId, spot, compactPosition, animateTo]` のままだと、計測で高さが変わるたびに expanded から compact へ引き戻される（AC-41 が落ちる）
3. **`modeRef` の更新タイミング**: 既存コードはレンダー中に `modeRef.current = mode` を代入している。`onLayout` ハンドラ内で `modeRef.current` を読む場合、この既存パターンを踏襲する（新たに `useEffect` で同期し直さない）
4. **`dy > 8` を触らない**: 「ボタンが押しにくい」と感じても閾値ではなくボタンのサイズ（`minHeight: 44`）で解決する
5. **`spot-name` の children**: `<Text testID="spot-name">{spot.name}</Text>` の形を崩さない。`{spot.name}{' '}` のような書き方をすると `props.children` が配列になり `SpotDetailScreen.test.tsx` が落ちる
6. **`SpotDetailContent` の既存 props はすべて維持**: `variant` は**追加**であって置換ではない。`showMiniMap` / `onGalleryVisibleChange` / `publicStamps` 等はそのまま
7. **`Button` の既定挙動を変えない**: `icon` 未指定時のスタイルオブジェクトが現在と一致すること（UI-17）
8. **web スタブはネイティブに影響しない**: `metro.config.js` は変更しない。`react-native-maps.web.ts` の `Marker` も変更しない
9. **`SpotInfoSection` を消さない・二重に出さない**: 現状 compact に出ている受付時間・駐車場は**維持**する（ユーザーの明示的な要望）。同時に、`spot-sheet-primary` が常時描画するため `SpotDetailContent` の `variant="sheet"` 側では描画しないこと（AC-7e / AC-25）。`SpotInfoSection.tsx` 自体は 1 行も変更しない

### 監査項目との対応（本 Issue で「解けない」もの）

| 監査項目 | 本 Issue での扱い                                                                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-5      | 解決（共通ヘッダー + 段階的追加 / 可変高さ）。ただし**中間スナップは追加しない**                                                                                                                                      |
| A-6      | 解決（1 行集約 + 並び順統一）                                                                                                                                                                                         |
| A-7      | 解決（`Button` 化 + compact から到達可能 + 44pt）                                                                                                                                                                     |
| A-8      | **部分的に解決**。compact にサムネイルを出すところまで。外観写真の供給源は未解決のまま（`spots` に画像カラムが無い）。空状態は「行ごと消す」で対処                                                                    |
| A-12     | **部分的に解決**。アイコン語彙（`bookmark`）とラベル付きの並置で未来/過去の対比は立つ。ただし「行った」を能動的に押せるトグルにする IA 変更は行わない（記録フローは写真必須のまま）                                   |
| A-9      | スコープ外（Issue #99 の描画コスト制約）                                                                                                                                                                              |
| B-7      | **記述が訂正済み**。「受付時間のカラムが無い」は誤りで、`spot_aggregated_info.reception_hours` 経由の表示は既に成立している。本 Issue では **compact での表示を維持**し、データのカバレッジ拡大（本番実測 2件）は別途 |

### 人間ゲート前に確認すること

以下は Issue #114 の本文に明記が無く、契約書側で追加した判断。push / PR 作成の直前の人間ゲートで確認する。

1. **`src/utils/react-native-maps.web.ts` の補強（S-7）** — Expo Web での検証を可能にするための web 専用スタブ変更。ネイティブ影響は無いが、issue 本文のスコープには無い
2. **ハンドルのタップで展開/収納** — アクセシビリティ改善かつ web 検証のイネーブラだが、issue 本文には無い
3. **`WishlistButton` / `CollectionScreen` のアイコン語彙変更** — ボトムシート外への波及。A-12 の一貫性のためだが、issue のスコープ記述は「ボトムシート」に限定されている
