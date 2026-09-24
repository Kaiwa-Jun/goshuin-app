# Issue #253: スポットのシートを、開いても中身が入れ替わらない並びにする

## 概要

地図でスポットを押したときのボトムシート（`SpotBottomSheet`）を、**閉じても（compact）開いても（expanded）同じ並び**にする。

- 並び: 名前（`SpotSheetHeader`）→ 受付・駐車場（`SpotInfoSection`）→ 写真の帯（`SpotThumbnailStrip`）→ 限定御朱印（見出し「限定御朱印 N件」）→ 月参り → アクセス
- 「行きたい」「記録する」（`SpotSheetActions`）は**画面の下端に固定したフッター**。compact・expanded・スクロール中も同じ位置
- 開くときに位置が変わる要素は無い。**限定御朱印の中身だけ**が見出しの下で高さを伸ばして開く

背景: いまは開くと「限定御朱印 N件」のチップと写真の帯が消え、ボタンが上に跳び、下に詳細と御朱印グリッドが瞬時に出る。どの情報がどこへ行ったか分からない。

## 関連ドキュメント

- Issue: `gh issue view 253`（2026-09-25 オーナー承認）
- **承認デザイン（正）**: [`docs/design/mockups/2026-09-spot-sheet-motion.html`](../design/mockups/2026-09-spot-sheet-motion.html) の「**案B — ボタンは下に固定・写真は名前の下**」/ 静止画 `2026-09-spot-sheet-closed.png`・`2026-09-spot-sheet-open.png`（ブランチ `docs/spot-sheet-mock`）
- 前回のシート改修: [`issue-114-bottom-sheet-redesign.md`](./issue-114-bottom-sheet-redesign.md)（共通ヘッダー・`variant="sheet"`・compact 高さの実測を入れた回）
- 月参りの仕様: `docs/design/2026-09-tsukimairi-spec.md` §3
- UI 設計: [`docs/design/ui-design.md`](../design/ui-design.md) §4.4

## 実装前の見直し（2026-09-25、リーダー）

- **D-12 を撤回**: シートにアクセス（ミニマップ）は出さない。いまのシートも出していない（`showMiniMap={false}`）うえ、シートは地図の上に出るので2枚目の地図は重いだけ。試作のアクセス枠は、試作を作った側の思い込み。`SpotAccessSection` の抽出もしない（S3 は月参りの抽出だけ）
- **D-7 を変更**: 有効な限定御朱印が0件で公式SNSだけある寺社は、見出し「限定御朱印」（件数なし）を出し、開くと公式SNSを出す（いまシートに出ている公式SNSを消さない）

## 詳細設計

### いまのコード（前提の確認）

| 場所                                                          | いまの状態                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/spot-detail/SpotBottomSheet.tsx:231-241`      | `Animated.View`（`testID="bottom-sheet"`）は `height: expandedHeight` 固定 + `translateY`。compact では下端が**画面外**（`availableHeight + expandedHeight - compactHeight`）にある                                                                                |
| 同 `:243-270`                                                 | `spot-sheet-primary`（常に出す）= ハンドル → Header → SpotInfoSection → **compact だけ** `LimitedGoshuinSection variant="compact"`（チップ）+ `SpotThumbnailStrip` → `SpotSheetActions`                                                                            |
| 同 `:273-295`                                                 | **expanded だけ** `ScrollView` に `SpotDetailContent variant="sheet" showMiniMap={false}` を描画                                                                                                                                                                   |
| 同 `:121-128`                                                 | `handlePrimaryLayout`: `spot-sheet-primary` の onLayout 実測値を `resolveCompactHeight` で丸めて compact 高さにする。expanded 中の計測は捨てる                                                                                                                     |
| 同 `:40-54`                                                   | `COMPACT_MIN_HEIGHT=176` / `COMPACT_MAX_HEIGHT=380` / `COMPACT_FALLBACK_HEIGHT=240`。上限は `min(380, round(available * 0.5))`                                                                                                                                     |
| 同 `:66-75`                                                   | 親はタブバーを除いた領域。`bottomOffset = tabBarHeight ?? insets.bottom`（タブバーの高さは下部セーフエリア込み）                                                                                                                                                   |
| 同 `:149-194`                                                 | PanResponder（縦 8px 超でキャプチャ、`galleryOpenRef` が true なら取らない）。`Animated.spring(tension 65, friction 11, useNativeDriver: true)`                                                                                                                    |
| 同 `:216-222`                                                 | `toggleMode`（`sheet-handle` のタップで compact ⇔ expanded）。`SpotThumbnailStrip` の `onPress` にも渡している                                                                                                                                                     |
| `src/components/spot-detail/SpotDetailContent.tsx:110-209`    | `standalone`: Header → Info → 限定御朱印(full) → Actions → 月参り（`TsukimairiCard` / `TsukimairiPast`）→ `stamp-grid` → `ImageGalleryModal` → アクセス（`showMiniMap` のとき「アクセス」見出し + `mini-map` + 住所）。`sheet`: Header / Info / Actions を描かない |
| 同 `:70-77`                                                   | 月参りは `tsukimairiOf(stamps.map(s => s.visited_at), toLocalDateString(new Date()))`                                                                                                                                                                              |
| 同 `:94-108`                                                  | ギャラリー画像は `stamps` + `publicStamps` を**重複排除せず**連結                                                                                                                                                                                                  |
| `src/components/spot-detail/LimitedGoshuinSection.tsx:68-145` | `full`: 見出し「限定御朱印」+ 有効項目 + 取得日時 + 公式SNS。有効0件かつ SNS 0件なら null。`compact`: チップ「限定御朱印 N件」（`limited-goshuin-compact`）。有効0件なら null（SNS だけでも null）                                                                 |
| `src/components/spot-detail/SpotThumbnailStrip.tsx`           | `SHEET_THUMBNAIL_LIMIT=3`。`selectSheetThumbnails` は自分 → 公開の順、id で重複排除、3件で打ち切り。0件なら null。タップはどれも `onPress()`（= 展開）                                                                                                             |
| `src/components/spot-detail/SpotSheetActions.tsx`             | `spot-sheet-actions` に「行きたい」（outline、`onWishlistPress` があるときだけ）・「記録する」（primary）。`marginTop: spacing.md`                                                                                                                                 |
| `src/screens/SpotDetailScreen.tsx:62`                         | `SpotDetailContent`（standalone 既定）を使う。`publicStamps` / `spotInfo` は渡していない                                                                                                                                                                           |
| `src/screens/CollectionScreen.tsx:36-37,308`                  | `LayoutAnimation` の既存例（Android は `UIManager.setLayoutAnimationEnabledExperimental(true)`）                                                                                                                                                                   |
| `e2e/flows/store-shot-limited.yaml:54-58`                     | ハンドルを座標 `'50%,73%'` でタップして展開                                                                                                                                                                                                                        |

### 設計上の決定（試作・Issue に書かれていない所。この契約で確定する）

| #    | 決定                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 理由                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | **シートの木は compact / expanded で1本**。ハンドル（`sheet-handle`）は `ScrollView` の外（上）に固定、それ以外の中身はすべて1つの `ScrollView`（`testID="spot-sheet-scroll"`）に入れ、両モードで同じ要素を同じ順で描画する。モードで分岐してよいのは「限定御朱印の中身」「`scrollEnabled`」「ミニマップのマウント（D-8）」だけ                                                                                                                                                                                                                                                                                                                                                                                                                                        | 入れ替え・消える・現れるを構造で起こせなくする。ハンドルを ScrollView に入れるとドラッグとタップ展開を ScrollView に取られる                                                                                                                                                                                                                              |
| D-2  | **フッターはシートの兄弟**。`SpotBottomSheet` は `<>{Animated.View(bottom-sheet)}{Animated.View(spot-sheet-footer)}</>` を返し、フッターは親領域の `position: 'absolute', left: 0, right: 0, bottom: 0` に置く。中に `SpotSheetActions` を1つだけ描く。シートと同じ `translateY` から `interpolate({ inputRange: [compactPosition, compactPosition + 1], outputRange: [0, 1], extrapolateLeft: 'clamp' })` でフッターの `translateY` を作る（compact 位置より上では 0 = 動かない、下へ引くと 1:1 で一緒に下がる）                                                                                                                                                                                                                                                      | シート自身の下端は compact で画面外にあるので、シート内の末尾に置くと compact でボタンが見えない。試作もフッターは `.sheet` ではなく画面に付けている。シート内で逆向きに動かす方式は Android で親の外のタッチが届かない                                                                                                                                   |
| D-3  | フッターの見た目: 背景 `colors.white`、上辺に `StyleSheet.hairlineWidth` の `colors.gray[200]` の線、`paddingHorizontal: spacing.lg`、`paddingTop: spacing.sm`、`paddingBottom` は**タブの中（`BottomTabBarHeightContext` が数値）なら `spacing.md`、タブの外（undefined）なら `spacing.md + insets.bottom`**。`SpotSheetActions` の `marginTop` はフッター内では 0 にする（`style` prop を追加して上書き。standalone の見た目は変えない）                                                                                                                                                                                                                                                                                                                             | タブの中では親領域がすでにタブバー（セーフエリア込み）を除いているので、`insets.bottom` を足すと二重になる（`SpotBottomSheet.tsx:67-71` のコメントと同じ理由）                                                                                                                                                                                            |
| D-4  | **スクロールする中身の末尾にフッターの高さ分の余白**: `ScrollView` の `contentContainerStyle.paddingBottom = footerHeight + spacing.lg`（`footerHeight` はフッターの onLayout 実測、未計測時は 0）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 最後のアクセスがフッターの裏に隠れない                                                                                                                                                                                                                                                                                                                    |
| D-5  | **compact の高さ = ハンドル + 見出しまでの中身 + フッター**を実測して合算する。`ScrollView` 先頭に `View testID="spot-sheet-primary" onLayout` を置き、中身は Header → Info → 写真の帯 → 限定御朱印（見出し + 折りたたみの中身）。compact では中身が描かれないので実測値 =「見出しまで」。ハンドル・`spot-sheet-primary`・フッターの3つを onLayout で測り、和を `resolveCompactHeight` に渡す。expanded 中の `spot-sheet-primary` の計測は従来どおり捨てる（ハンドル・フッターの計測はモードに関係なく使う）                                                                                                                                                                                                                                                           | 試作の `compactY()`（`cutB` までの高さ + フッター）と同じ定義                                                                                                                                                                                                                                                                                             |
| D-6  | `resolveCompactHeight` の上限を `min(COMPACT_MAX_HEIGHT, round(screenHeight * 0.6))` に変える（0.5 → 0.6）。`COMPACT_MAX_HEIGHT=380` / `MIN=176` / `FALLBACK=240` は変えない。定数 `COMPACT_SCREEN_RATIO = 0.6` を export する。第2引数に渡るのは従来どおり `availableHeight`（画面高 − タブバー）                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 実スタイルでの概算（iPhone SE、幅 375）: ハンドル 20 + Header 約 50 + Info 44（チップ 24 + `marginBottom: spacing.xl`）+ 帯 約 120（(375−32−8)/3 ≈ 112 + `marginTop` 8）+ 見出し 約 36 + `paddingBottom` 12 + フッター 約 65 ≈ 347px。SE の availableHeight は 667 − 49 = 618。0.5 → 309、0.55 → 340 ではフッターが見出しを覆う。0.6 → 371 で約 24px 余る |
| D-7  | **（公式SNSだけの寺社の扱いを変更。冒頭の見直しを参照）** 限定御朱印は `LimitedGoshuinSection` に `variant="sheet"` を追加し、`expanded: boolean` と `onHeadingPress?: () => void` を受ける。**見出し行**（`testID="limited-goshuin-heading"`）= `auto-awesome` アイコン（`colors.primary[500]`, 14）+「限定御朱印 N件」（N = `filterActiveItems` の件数）+ 右端の山形アイコン（compact: `chevron-right` / expanded: `expand-more`、`colors.gray[400]`, 18）。見出しのタップで `onHeadingPress`（シートでは `toggleMode`）。**中身**（`testID="limited-goshuin-body"`）は `expanded` のときだけ描画し、中身は `full` の項目・取得日時・公式SNS と同じ（`limited-goshuin-item-{i}` 等の testID も同じ）。**有効 0 件なら見出しごと null**（公式SNS があっても出さない） | 試作の `.limhead`（クリックで開閉）どおり。「限定御朱印 0件」の見出しは出さない、が Issue の決定                                                                                                                                                                                                                                                          |
| D-8  | 高さが伸びる動き: `SpotBottomSheet` が `mode` を変える直前（`toggleMode` とドラッグ離しの両方）に `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` を呼ぶ。Android は `UIManager.setLayoutAnimationEnabledExperimental(true)` をモジュール先頭で1回（`CollectionScreen.tsx:36-37` と同じ書き方）                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 伸びるのは限定御朱印の中身だけ。その下の月参り・アクセスは押し下げられるだけで、順番は変わらない                                                                                                                                                                                                                                                          |
| D-9  | `LimitedGoshuinSection variant="compact"`（チップ）は**削除**する（呼び出し元が無くなる）。`variant="full"` は standalone 用にそのまま残す                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 死にコードを残さない                                                                                                                                                                                                                                                                                                                                      |
| D-10 | **写真の帯は開いてもグリッドにしない**。シートから `stamp-grid` を無くし、帯だけにする。帯の上限は `SHEET_THUMBNAIL_LIMIT=3` のまま。**重複排除後の総数が 3 を超えるとき、3 枚目に `+N`（N = 総数 − 3）を重ねる**（`testID="spot-thumbnail-more"`。サムネイル全面に `backgroundColor: colors.black` + `opacity: 0.4` の View を重ね、その上に `colors.white` の `typography.h3` で「+N」を中央に置く。色トークンに半透明色が無いため `opacity` で作る）。枚数を増やす・横スクロールにはしない                                                                                                                                                                                                                                                                          | 帯の高さを一定に保つ（開閉で帯の高さが変わると「位置が変わる要素なし」に反する）。全件はギャラリーで見られる                                                                                                                                                                                                                                              |
| D-11 | **写真を押すと既存の `ImageGalleryModal` を開く**（compact でも expanded でも同じ）。展開はしない。ギャラリーの画像列は新設の純関数 `buildSpotGalleryImages(stamps, publicStamps): GalleryImage[]`（自分 → 公開の順、**id で重複排除**。自分の記録は `memo`・`visitedAt`、公開は加えて `userName`）で作り、帯はその先頭 3 件を描く。帯の i 枚目を押すと `initialIndex = i`。`+N` の3枚目を押したときも `initialIndex = 2`。ギャラリーの開閉で `galleryOpenRef` を更新する（PanResponder を止める）。`SpotThumbnailStrip` の props は `onPress: () => void` → `onPressThumbnail: (index: number) => void` に変える                                                                                                                                                      | 同じ要素は両モードで同じ振る舞い（押したら展開、の役目はハンドルと見出しが持つ）。重複排除した列と帯の列を同じ関数から作れば index がずれない（いまの `allGalleryImages` は重複排除していない）                                                                                                                                                           |
| D-12 | **（撤回。冒頭の見直しを参照）** ~~アクセス~~はシートにも出す。`SpotAccessSection`（新規。`testID="spot-sheet-access"`）= 見出し「アクセス」+ ミニマップ（`mini-map`）+ 住所行。セクション自体（見出し・住所）は両モードで描画する。**ミニマップだけは、そのスポットでシートを初めて expanded にしたときにマウント**し、以後そのスポットのシートが閉じる（hidden / spotId が変わる）まで保つ（compact に戻しても外さない）                                                                                                                                                                                                                                                                                                                                             | 試作にアクセスがある。compact ではアクセスはフッターの裏で見えないため、ピンを押すたびに2枚目の MapLibre を作らない。1回開いたら外さないので、閉じる動きの途中で消える要素にもならない                                                                                                                                                                    |
| D-13 | **月参り**は `SpotTsukimairi`（新規。`tsukimairiOf` の計算 + `TsukimairiCard` + 途切れ時の `TsukimairiPast`）に切り出し、シートと standalone の両方で使う                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 計算が SpotDetailContent の中にあり、シートが SpotDetailContent を使わなくなるため                                                                                                                                                                                                                                                                        |
| D-14 | **シートは `SpotDetailContent` を使わない**。`SpotBottomSheet` が D-1 の並びを直接組む。`SpotDetailContent` の `variant` prop と `sheet` 分岐は**削除**する                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 並びを1箇所（SpotBottomSheet）で決める。variant 分岐が残ると standalone と sheet の差が読み取りにくい                                                                                                                                                                                                                                                     |
| D-15 | **SpotDetailScreen（standalone）の並びと見た目は変えない**: Header → Info → 限定御朱印(full) → Actions → 月参り → `stamp-grid` → アクセス。変更は D-13 / D-12 のコンポーネント抽出（中身は同じ）と D-14 の prop 削除だけ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 今回はシートだけを直す。standalone（Map スタックの `SpotDetail`）はいま `src/` のどこからも `navigate` されておらず、ユーザーが到達しない。並びを揃えるかは別 Issue で扱う                                                                                                                                                                                |
| D-16 | compact に戻したとき `ScrollView` を先頭へ戻す（`scrollTo({ y: 0, animated: false })`）。compact では `scrollEnabled={false}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | compact で名前が上にスクロールアウトしたまま残らない。compact で見出しの下を覗けないようにする                                                                                                                                                                                                                                                            |
| D-17 | フッター上のドラッグではシートを動かさない（PanResponder はシートの `Animated.View` にだけ付ける）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ボタンの押し間違いでシートが動くのを避ける                                                                                                                                                                                                                                                                                                                |
| D-18 | **expanded で中身の上を下へ引いても、シートは閉じない（ScrollView のスクロールになる）**。expanded から閉じる手段はハンドルのドラッグ・ハンドルのタップ・限定御朱印の見出しのタップ。compact は `scrollEnabled={false}` なので中身の上のドラッグでも従来どおりシートが動く                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 中身を1つの ScrollView に入れる（D-1）ため。試作もドラッグはハンドル（`.grab`）でだけ受ける。いまは Header 等が ScrollView の外にあり、そこを引けば閉じられるので、振る舞いが変わる点としてここに残す                                                                                                                                                     |

### 並び（D-1）

```
┌ Animated.View  testID=bottom-sheet（translateY / PanResponder）
│  ハンドル            testID=sheet-handle        ← ScrollView の外
│  ScrollView          testID=spot-sheet-scroll   scrollEnabled={isExpanded}
│  ├ View              testID=spot-sheet-primary  onLayout（compact 高さ用）
│  │  ├ SpotSheetHeader         spot-sheet-header
│  │  ├ SpotInfoSection         spot-info-section     （spotInfo があり項目が1つ以上のとき）
│  │  ├ SpotThumbnailStrip      spot-thumbnails       （写真が1枚以上のとき）
│  │  └ LimitedGoshuinSection variant="sheet"
│  │       ├ 見出し             limited-goshuin-heading（有効1件以上のとき）
│  │       └ 中身               limited-goshuin-body  （expanded のときだけ）
│  ├ SpotTsukimairi              tsukimairi-card / tsukimairi-past（条件は従来どおり）
│  └ SpotAccessSection           spot-sheet-access（mini-map は D-12）
│     paddingBottom = footerHeight + spacing.lg
└
Animated.View  testID=spot-sheet-footer（親領域の bottom: 0。兄弟）
   └ SpotSheetActions            spot-sheet-actions
```

### 対象ファイル

| ファイル                                                   | 変更                                                                                                                                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/spot-detail/SpotBottomSheet.tsx`           | D-1〜D-6, D-8, D-11, D-12, D-16, D-17。`SpotDetailContent` の import を外す                                                                                                                               |
| `src/components/spot-detail/LimitedGoshuinSection.tsx`     | `variant="sheet"` 追加（D-7）、`variant="compact"` 削除（D-9）                                                                                                                                            |
| `src/components/spot-detail/SpotThumbnailStrip.tsx`        | `buildSpotGalleryImages` 追加、`+N`（D-10）、`onPressThumbnail(index)`（D-11）                                                                                                                            |
| `src/components/spot-detail/SpotSheetActions.tsx`          | `style?: ViewStyle` を追加（D-3。既定は従来の `marginTop: spacing.md`）                                                                                                                                   |
| `src/components/spot-detail/SpotTsukimairi.tsx`（新規）    | D-13                                                                                                                                                                                                      |
| `src/components/spot-detail/SpotAccessSection.tsx`（新規） | D-12。props: `spot: Spot`, `showMap: boolean`。中身は `SpotDetailContent.tsx:170-208` を移す                                                                                                              |
| `src/components/spot-detail/SpotDetailContent.tsx`         | D-13 / D-12 の部品に置き換え、`variant` 削除（D-14）。並び・testID は変えない（D-15）。ギャラリーは `buildSpotGalleryImages` を使ってよい（standalone の `stamp-grid` の index も重複排除後の列に揃える） |
| `src/components/spot-detail/__tests__/*.test.tsx`          | 下記テスト方針                                                                                                                                                                                            |
| `e2e/flows/store-shot-limited.yaml`                        | ハンドルのタップを `point: '50%,73%'` → `id: 'sheet-handle'` に変える（compact の高さが変わり座標が外れるため）                                                                                           |

`src/screens/MapScreen.tsx` / `SpotDetailScreen.tsx` / hooks / services / DB は変更しない（MapScreen でシートより後に描くのは `LoginPromptModal` だけで、フッターの上に絶対配置で重なる要素は無い）。

### 画面仕様（承認デザイン 案B）

- 閉じた状態（compact）: 名前・住所 → 受付・駐車場 → 写真の帯 → 「✦ 限定御朱印 N件 ›」→ フッター（行きたい / 記録する）。フッターの上端が見出しのすぐ下に来る
- 開いた状態（expanded）: シートが上がり、同じ並びのまま見出しの下に限定御朱印の項目が伸びる。その下に月参り・アクセス。フッターは画面の下端のまま
- 写真の帯・見出しは開閉で**画面上の相対位置（シート上端からの距離）が変わらない**

## スライス（1スライス = 1コミット、TDD）

| #   | 内容                                                                                                                                            | コミット例                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| S1  | `LimitedGoshuinSection variant="sheet"`（見出し・中身・山形・`onHeadingPress`）と `compact` 削除。テスト置き換え                                | `feat: 限定御朱印を、見出しの下に中身が開く形にする`            |
| S2  | `buildSpotGalleryImages`、帯の `+N`、`onPressThumbnail(index)`                                                                                  | `feat: 写真の帯から、押した写真でギャラリーを開く`              |
| S3  | `SpotTsukimairi` / `SpotAccessSection` の抽出と `SpotDetailContent` の `variant` 削除（standalone の並び・testID は不変。既存テストが通ること） | `refactor: 月参りとアクセスをシートでも使える部品に分ける`      |
| S4  | `SpotBottomSheet` を1本の木 + 兄弟フッターに組み直す（D-1〜D-6, D-8, D-11, D-12, D-16, D-17）                                                   | `feat: スポットのシートを、開いても並びが変わらない形にする`    |
| S5  | `e2e/flows/store-shot-limited.yaml` のハンドルを id 指定に。`.claude/harness/progress.md` 更新                                                  | `chore: 限定御朱印のスクショ手順をハンドルの id で押す形にする` |

## テスト方針

- Jest（jest-expo + testing-library）。対象と同階層の `__tests__/`
- `SpotBottomSheet.test.tsx` は hooks のモックを `jest.fn` にして fixture を切り替えられるようにする。新 fixture:
  - `FULL`: `stamps` 2件（id `s1`,`s2`）+ `publicStamps` 3件（うち1件は id `s2` の重複）→ 重複排除後 4件。`spotInfo` に有効な限定御朱印 2件・駐車場あり・受付時間あり。月参りが続いている `visited_at`（`tsukimairiOf` は今日を基準に数えるので、`jest.useFakeTimers().setSystemTime(new Date('2026-09-25T12:00:00+09:00'))` で今日を固定し、`2026-09-10` と `2026-08-10` にする）
  - `NO_LIMITED`: `spotInfo.limitedGoshuin.items` が全件期限切れ、`snsLinks` 1件
  - `NO_PHOTO`: `stamps` / `publicStamps` とも空
- **並び順の検査**: `toJSON()` を深さ優先でたどって `testID` を集め、`['spot-sheet-header','spot-info-section','spot-thumbnails','limited-goshuin-heading','tsukimairi-card']` に含まれるものだけ残した配列を、`sheet-handle` を押す前後で `toEqual` 比較する
- 置き換える既存テスト（`spot-detail-content` 前提のもの）: 「compact では詳細を描画しない」「ハンドルのタップで詳細が現れる」「ハンドルを2回タップすると詳細が閉じる」→ `limited-goshuin-body` の有無で書き直す。`LimitedGoshuinSection.test` の `variant="compact"` の describe → `variant="sheet"` に置き換え。`SpotThumbnailStrip.test` の「タップで onPress」→ `onPressThumbnail(index)`
- `resolveCompactHeight` のテスト「小型端末では画面の半分を超えない」は D-6 に合わせて期待値を更新（`resolveCompactHeight(999, 667)` → `380`（0.6 倍の 400 より `COMPACT_MAX_HEIGHT` が小さい）、iPhone SE の実値として `resolveCompactHeight(999, 618)` → `371` を追加）
- `MapScreen.test.tsx` は変更不要の想定（`bottom-sheet` の有無しか見ていない）。落ちたら原因を直し、期待値は変えない
- LayoutAnimation・spring・ドラッグの見た目は Jest で見ない（native-only）

## 受入基準（Acceptance Criteria）

### 機能基準: LimitedGoshuinSection（S1）

- [ ] AC-1: `variant="sheet"` で有効項目 2件（期限切れ 1件を含む 3件）を渡すと、`limited-goshuin-heading` に「限定御朱印 2件」が表示される
- [ ] AC-2: `variant="sheet" expanded={false}` のとき `limited-goshuin-body` と `limited-goshuin-item-0` が存在しない
- [ ] AC-3: `variant="sheet" expanded={true}` のとき `limited-goshuin-body` の中に `limited-goshuin-item-0`・`limited-goshuin-item-1`・`limited-goshuin-fetched-at` があり、`snsLinks` を渡せば `limited-goshuin-sns-0` もある
- [ ] AC-4: `variant="sheet"` で有効項目 0件・`snsLinks` 1件なら、見出しは「限定御朱印」（件数なし）で、`expanded` のとき本文に `limited-goshuin-sns-0` がある。有効項目も `snsLinks` も 0件なら何も描画しない（オーナー確認前の決定。いまシートで出ている公式SNSを消さない）
- [ ] AC-5: `limited-goshuin-heading` を押すと `onHeadingPress` が1回呼ばれる
- [ ] AC-6: `variant="compact"` は型から無くなっている（`LimitedGoshuinSection.test.tsx` に `// @ts-expect-error` 付きで `variant="compact"` を渡す1行があり、`npm run typecheck` が通る。`grep -r "limited-goshuin-compact" src` が0件）

### 機能基準: 写真の帯とギャラリー（S2）

- [ ] AC-7: `buildSpotGalleryImages` は自分の記録 → 公開の順に並べ、id が重複する要素を後から来た方で除く（`FULL` fixture で長さ 4、先頭2件の id が `s1`,`s2`）
- [ ] AC-8: 重複排除後 4件のとき `spot-thumbnail-0`〜`spot-thumbnail-2` の3枚だけ描画し、`spot-thumbnail-more` に「+1」が表示される
- [ ] AC-9: 重複排除後 3件以下のとき `spot-thumbnail-more` が存在しない
- [ ] AC-10: `spot-thumbnail-1` を押すと `onPressThumbnail` が引数 `1` で呼ばれる
- [ ] AC-11: 写真が 0件のとき `spot-thumbnails` が存在しない（既存どおり）

### 機能基準: standalone は変わらない（S3）

- [ ] AC-12: `SpotDetailContent`（props に `variant` を渡さない）の描画で、testID の出現順が `spot-sheet-header` → `limited-goshuin-section` → `spot-sheet-actions` → `tsukimairi-card`（または `tsukimairi-past`）→ `stamp-grid` → `mini-map` である（`showMiniMap` 既定 true、写真・限定御朱印ありの fixture）
- [ ] AC-13: `src/components/spot-detail/__tests__/SpotDetailContent.test.tsx` の既存テストが、期待値を変えずにすべて通る
- [ ] AC-14: `SpotDetailContent` の props 型に `variant` が無い（`grep -n "variant" src/components/spot-detail/SpotDetailContent.tsx` が `LimitedGoshuinSection` への `variant` 指定以外で0件）

### 機能基準: シート（S4）

- [ ] AC-15: `FULL` fixture で、並び順の検査（テスト方針の方法）の結果が compact でも、`sheet-handle` を押した後（expanded）でも `['spot-sheet-header','spot-info-section','spot-thumbnails','limited-goshuin-heading','tsukimairi-card']` と一致する
- [ ] AC-16: `FULL` fixture で `sheet-handle` を押した後も `spot-thumbnails` と `limited-goshuin-heading` が存在する（compact にあった要素が expanded で消えない）
- [ ] AC-17: `FULL` fixture で expanded にしても `stamp-grid` と `spot-detail-content` が存在しない
- [ ] AC-18: `limited-goshuin-item-0` は compact で存在せず、`sheet-handle` を押すと存在し、もう一度押すと存在しない
- [ ] AC-19: `limited-goshuin-heading` を押すと expanded になる（`limited-goshuin-item-0` が現れる）
- [ ] AC-20: compact・expanded の両方で `spot-sheet-actions` がちょうど1つあり、`within(getByTestId('spot-sheet-scroll'))` からも `within(getByTestId('bottom-sheet'))` からも見つからず、`within(getByTestId('spot-sheet-footer'))` から見つかる
- [ ] AC-21: `spot-sheet-scroll` に `scroll` イベント（`contentOffset.y = 200`）を発火した後も、`spot-sheet-actions` は `spot-sheet-footer` の子のまま
- [ ] AC-22: `spotId` を `null` にすると `bottom-sheet` と `spot-sheet-footer` の両方が存在しない
- [ ] AC-23: `spot-sheet-scroll` の `scrollEnabled` が compact で `false`、expanded で `true`
- [ ] AC-24: `spot-sheet-footer` の onLayout に高さ 70 を与えると、`spot-sheet-scroll` の `contentContainerStyle` の `paddingBottom` が `70 + spacing.lg`（= 86）になる
- [ ] AC-25: タブの中（`BottomTabBarHeightContext` = 49）ではフッターの `paddingBottom` が `spacing.md`（12）。Provider の value を `undefined` にすると `spacing.md + insets.bottom`（jest.setup のモックで 12 + 34 = 46）
- [ ] AC-26: 純関数 `sumCompactParts({ handle, primary, footer })` が3値の和を返す（`{20, 250, 70}` → 340、未計測の値は 0 として足す: `{20, 0, 70}` → 90）。`SpotBottomSheet` の compact 高さは `resolveCompactHeight(sumCompactParts(...), availableHeight)` で決まる（`jest.spyOn(Animated, 'spring')` で、3つの onLayout に 20 / 250 / 70 を与えた後の最後の呼び出しの `toValue` が `availableHeight - 340` であることを確認。availableHeight はテスト内で `Dimensions.get('window').height - 49` として求める）
- [ ] AC-27: `resolveCompactHeight(999, 618)` が `371`、`resolveCompactHeight(999, 800)` が `380`、`COMPACT_SCREEN_RATIO` が `0.6`
- [ ] AC-28: `NO_LIMITED` fixture（有効項目も公式SNSも無い）で `limited-goshuin-heading` が compact・expanded とも存在しない
- [ ] AC-29: `NO_PHOTO` fixture で `spot-thumbnails` が compact・expanded とも存在しない
- [ ] AC-30: `spot-thumbnail-1` を押すと `ImageGalleryModal` が `visible=true`・`initialIndex=1`・`images` の長さ 4 で描画され、シートは compact のまま（`limited-goshuin-item-0` が存在しない）
- [ ] AC-31: （削除）シートにアクセス・ミニマップは出さない（いまのシートも `showMiniMap={false}` で出していない。地図の上に2枚目の地図を重ねない）
- [ ] AC-32: 既存の「記録するのタップで onRecord に spotId」「行きたいのタップで onWishlistToggle に spotId」「onWishlistToggle が無いとき行きたいを出さない」が、期待値を変えずに通る

### 機能基準: E2E（S5）

- [ ] AC-33: `e2e/flows/store-shot-limited.yaml` がハンドルを `id: 'sheet-handle'` で押しており、`point: '50%,73%'` が残っていない

### UI 基準（Expo Web で確認。到達: `npx expo start --web --port 8081` → 地図タブ → 画面上部の検索バー → 「靖國」を入力 → `search-result-card` を押す → シートが compact で出る）

- [ ] UI-1: compact で、上から 名前 → 受付・駐車場 → 写真の帯 → 「限定御朱印 N件」の見出し → 「行きたい」「記録する」の順に見え、ボタンの下に他の要素が見えない
- [ ] UI-2: 見出しの行に `colors.primary[500]` のアイコン、右端に `colors.gray[400]` の山形がある
- [ ] UI-3: ハンドルを押して expanded にすると、名前・受付駐車場・写真の帯・見出しの並びは compact と同じで、見出しの直下に限定御朱印の項目が並び、その下に月参り（続いている場合）が続く。写真のグリッドは出ない
- [ ] UI-4: expanded で中身を一番下までスクロールすると、一番下の要素がボタンのフッターに隠れず、フッターとの間に余白がある
- [ ] UI-5: compact・expanded・スクロール中のいずれでも、「行きたい」「記録する」がタブバーのすぐ上の同じ位置にあり、上辺に `colors.gray[200]` の線がある
- [ ] UI-6: 写真を押すとギャラリーが開き、押した写真から表示される。（写真が 4 枚以上ある寺社で帯の3枚目に「+N」が重なることは、本番データで該当寺社を特定できないため AC-8 の Jest で代える）
- [ ] UI-7: 限定御朱印が無い寺社（例: 検索で任意の、限定御朱印の無い寺社を開く）では見出しの行が無く、写真の帯のすぐ下にフッターが来る
- （standalone の SpotDetailScreen は、いまアプリ内に `navigate('SpotDetail')` する導線が無く Web で到達できないため、UI 基準は置かない。不変性は AC-12 / AC-13 の Jest で見る）

### native-only（EAS Development Build。検証方法を併記）

- [ ] N-1: expanded にする/戻すとき、限定御朱印の中身が見出しの下で高さを伸ばして（縮めて）開閉し、月参り・アクセスが押し下げられる。瞬時に切り替わらない — **実機確認**（iPhone、`/dev`）
- [ ] N-2: シートを上下にドラッグしている間、フッターは画面下端から動かない。compact 位置より下へ引いて閉じると、フッターもシートと一緒に下がって消える。expanded で中身（ハンドル以外）の上を下へ引くと中身がスクロールし、シートは動かない（D-18） — **実機確認**
- [ ] N-3: 地図のピンを押してシートが出るとき、フッターがシートと一緒に下から上がってくる — **実機確認**
- [ ] N-4: iPhone SE 相当（`development-simulator`、iPhone SE 3rd generation）の compact で、限定御朱印の見出しがフッターに覆われない — **実機確認（シミュレータ）**
- [ ] N-6: `maestro test e2e/flows/store-shot-limited.yaml` が完走し、`04-limited-goshuin` のスクリーンショットで限定御朱印の項目が見える — **Maestro フロー**

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: 変更したファイルに色・余白の直値が無い（`colors` / `spacing` / `borderRadius` / `typography` を参照。例外は `StyleSheet.hairlineWidth` と D-10 の `opacity`）

## やらないこと（スコープ外）

- SpotDetailScreen（standalone）の並び・見た目の変更（D-15）。standalone にフッター固定を入れることもしない
- 写真の帯の枚数増加・横スクロール化・開いた状態のグリッド（D-10）
- 限定御朱印の有効0件の寺社で、公式SNS をシートに出す別の場所を作ること（D-7。standalone では従来どおり出る）
- 案A（ボタンを名前の下）
- expanded で中身を先頭までスクロールした状態から下へ引いて閉じる操作（D-18）
- シートの段数を増やす（半開き以外の中間位置、全画面化）、ドラッグのしきい値・spring の係数の変更
- `useSpotDetail` / `useSpotStamps` / `useSpotInfo` / services / DB の変更
- MapScreen の FAB・検索バーなど、シート以外の位置調整
- `store-screenshots.yaml` / `store-shots-public.yaml` / `smoke.yaml` の変更（座標でシートを押していないため）
- Expo Web で LayoutAnimation を効かせる対応

## 注意事項

- `Animated.View` の兄弟を返すので、`SpotBottomSheet` の戻り値は Fragment。`spotId` / `spot` が無いときは両方とも描かない（AC-22）
- フッターの `translateY` の interpolate は `compactPosition` が変わるたびに作り直してよい（`translateY` 自体は同じ `Animated.Value`）。native driver のまま使える
- `galleryOpenRef` はシート側で持つ（いまは `SpotDetailContent` から `onGalleryVisibleChange` で受けている）。ギャラリーが開いている間は PanResponder が取らないこと
- compact 高さの計測で expanded 中の `spot-sheet-primary` を捨てる理由は変わらない（expanded では限定御朱印の中身ぶん高くなる）
- LayoutAnimation は `setMode` と同じフレームで呼ぶ。`translateY` の spring（native driver）とは別系統なので干渉しない想定だが、N-1 で見た目を確認する
- D-6 の 0.6 は概算に基づく。N-4 で見出しが覆われる場合は、上限を変えずに原因（どの要素が高いか）を記録して止める（契約外の変更をしない）
