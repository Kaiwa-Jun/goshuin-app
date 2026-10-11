# Issue #327: はじめての人を、最初の1枚の記録まで連れていく（地図のカード・1枚目の色の差し方・空の画面の言葉）

## 概要

実際の利用者 6 人のうち 2 人が、登録のあと 1 枚も記録せずに戻っていない。記録した 4 人のうち 3 人は登録したその日に 1 枚目を記録している（最初の 1 日で決まる）。利用者の記録の 4 枚に 3 枚は参拝から 1 週間以内（参拝してすぐ撮る使い方）。

今のアプリは、記録 0 枚の人に何も案内していない（地図には右下の＋だけ。あゆみは灰色の「0 / 47」と凡例。御朱印帳は「コレクション」「追加する」という使わない言葉・作る側の言葉）。

この契約で作るのは次の 3 つ（2026-10-10 にオーナーが試作から選んだ組み合わせ）。

1. **地図のカード（案①）**: 記録 0 枚の間だけ、地図の下に小さなカードを出す（その間は＋を隠す）。「参拝したら、写真1枚で日本地図に。」「撮ると、〇〇府に色が差します」と［御朱印を撮る］［近くの寺社を見る］。カードの中の小さな日本地図で、いる県が空押しでうっすら浮く。「近くの寺社を見る」は近い順・距離つきの一覧 → 寺社のシート →「行きたい」。✕ はカードを＋の位置へ畳む（その回だけ）。ログイン前の人にも出す
2. **1枚目の保存直後（共通）**: 保存直後の地図（`SaveMapReveal`）で、寄る間にその県を空押しで浮かせ、ピンが落ちたら 0.6 秒で色を差す（点滅なし。#305 の「空押しから色が差す」と同じ考え方）
3. **言葉の直し（案③の言葉だけ）**: あゆみの空の日本地図の凡例の代わりに「最初の1枚で、〇〇府に色が差します。」。御朱印帳の空の表示「御朱印を記録して、コレクションを始めましょう」と、めくる表示の白紙「ここに御朱印を追加する」を直す

案②（登録の直後に 1 回だけ出るシート）は作らない（「やらないこと／次の候補」）。この変更は次のアプリの版に、App Store のキーワードとスクショの差し替え（施策 B）と一緒に出す。スクショ・キーワードはこの契約の外。

## 関連ドキュメント

- GitHub Issue #327（背景の数字・進め方）
- 試作（オーナーが 2026-10-10 に選んだ）: `~/goshuin-work/proto-327/index.html`（同じフォルダの `assets.js`・`img/`）。タブ「案① 地図のカード」「案③ あゆみの空の地図」「1枚目の保存直後（共通）」。素材の作り方は `build/build_assets.py`（日本地図は `src/constants/japanMap.ts`、アイコンは `MaterialIcons.ttf`、色・余白は `src/theme/`）。S0 でリポジトリの `docs/design/mockups/2026-10-first-stamp-v1/` に写す
- `docs/design/DESIGN.md`（色・文字・余白・影・「コレクション」は使わない）
- `docs/issues/issue-305-plan-tab-emboss.md`（空押しから色が差す・opacity と transform だけ・native driver）
- `docs/issues/issue-209-ayumi-japan-map.md`（朱の点滅を入れない理由）
- `docs/issues/issue-311-place-search.md`（`RegionSpotSheet` の出方・FAB を引っ込める作法）
- `docs/issues/issue-293-spot-sheet-hero.md`（`useUserStamps` の D-11・空押しの重ね方 `SealGlyph`）
- `docs/design/2026-09-record-complete-spec.md`（保存直後の画面）
- 過去の教訓（メモ）: 見た目が主題の変更は試作から（#139）・試作は実装と同じ素材・動きはおしとやかに（熱盛は NG）・画面の言葉は中の仕組みを見せない（#278 D-13）

## いまのコード（前提の確認。2026-10-10・origin/develop d1c2bc6）

| 場所                               | いまの姿                                                                                                                                                                    | この契約への影響                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MapScreen`                        | `useUserStamps()` の `visitedSpotIds`・`isLoading` を持つ。`useSpots(location, filterMode, …)` は**全寺社**を読む（`fetchAllActiveSpots`）。`useNearbySpots` は使っていない | 県と近くの寺社は、読み済みの `allSpots`／`displaySpots` と `location` から純関数で出す。`useNearbySpots` を足すと全寺社をもう一度読むので使わない |
| `useLocation`                      | 位置情報が許可されていない・取れないとき `location` に `DEFAULT_LOCATION`（仙台）を入れる                                                                                   | そのまま使うと「撮ると、宮城県に…」と嘘をつく。県を名指すのは `permissionStatus === GRANTED` かつ `error === null` のときだけ（D-5）              |
| `Spot.prefecture`                  | `string \| null`。値は「京都府」「東京都」「北海道」「神奈川県」のように都道府県の字まで入っている                                                                          | 言葉は `${prefecture}に色が差します`（字を足さない）。null の寺社は県の判定に使わない                                                             |
| `useAuth`                          | 画面ごとに別の state（Context なし）。`isLoading` の間は `isAuthenticated` が false                                                                                         | 起動直後、ログイン済みの人にもカードが一瞬出うる → `useAuth().isLoading` の間は出さない（D-2）                                                    |
| `useUserStamps`                    | ゲストは空の Set・`isLoading:false`。最初の取得の失敗も空の Set に倒す。戻ったときの取り直しでは `isLoading` を立てない（#293 D-11）                                        | 「失敗」と「0 枚」が区別できない／記録して戻った直後は古い空の Set のまま → 足す（D-2・D-8）                                                      |
| `MapScreen.handleLoginSuccess`     | ログインのきっかけにかかわらず、いつも `navigateToRecord()`（spotId なし）                                                                                                  | 「近くの寺社 → 行きたい → ログイン」で記録の画面に飛んでしまう → きっかけを覚える（D-7）                                                          |
| `RegionSpotSheet`                  | 見出し `${label}のあたりの寺社（N）`・rank の高い順・距離なし                                                                                                               | 「近く」用の並べ方・見出し・距離を足す（D-6）                                                                                                     |
| `MapScreen` の `Map`               | `attributionPosition={{ bottom: 78, left: 8 }}`（地図の出典の ⓘ）                                                                                                           | カード（高さ約 180）の下に隠れる → カードの間は上へ逃がす（D-12）                                                                                 |
| `SaveMapReveal`                    | 寄り終わってピンが落ちた瞬間（`settled`）に県の `fill` を切り替える。既存テストは `getAllByTestId(/^save-map-(?!pin)/)` が 47                                               | 新しい testID は `save-map-` で始めない（`save-reveal-…`）                                                                                        |
| `CollectionScreen`（あゆみ）       | 日本地図のカードは**ログインしている人だけ**。ゲストは「記録するとここに集計されます」のカード                                                                              | あゆみの一言はログインしている人だけ。ゲストは今のまま                                                                                            |
| `GoshuinchoFlipView`               | 白紙のページは**いつも最後に**付く（記録が 20 枚あっても）                                                                                                                  | 白紙の言葉は枚数で分ける（D-11）                                                                                                                  |
| `e2e/flows/store-screenshots.yaml` | `clearState` のゲストで地図のスクショを撮る                                                                                                                                 | このあと撮ると地図にカードが写る（申し送り）                                                                                                      |

## 設計上の決定

| #    | 決定                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | **何を入れるか**: 案①（地図のカード）＋ 共通（1 枚目の保存直後）＋ 案③の**言葉だけ**（あゆみの凡例の代わりの一言・御朱印帳の空の表示・白紙のページ）。案③のあゆみの［御朱印を撮る］［近くの寺社を見る］・あゆみの地図の空押し・保存直後の「あゆみに戻る」は入れない（オーナーの指示が「③ の言葉の直し」のため。「決めてもらうこと」の 7）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D-2  | **記録 0 枚かどうか（地図）**: `eligible = !auth.isLoading && !stamps.isLoading && !stamps.loadFailed && stamps.visitedSpotIds.size === 0`。ゲストは `useUserStamps` が空の Set・`isLoading:false` を返すので 0 枚として扱う（ログイン前の人にも出す）。最初の取得に失敗したときは「0 枚」と言い切れないので出さない（＋を出す。#133 の「嘘を言わない」と同じ）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D-3  | **カードと＋の出し分け**: `cardWanted = eligible && !awaitingStampsRefresh`。`overlay = selectedSpotId !== null \|\| showRegionSheet \|\| nearbyOpen`。カードを描くのは `cardWanted && !dismissed && prefectureResolved && !overlay`。＋（FAB）を出すのは `!overlay && !(cardWanted && !dismissed)`（＝カードを出したい間は、県の判定待ちでも＋を出さない。入れ替わりのちらつきを避ける）。カードは地図タブの `MapScreen` の中だけに出す                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D-4  | **✕ は「その回だけ」**: `dismissed` は `MapScreen` の `useState`（覚えない。AsyncStorage・Context を使わない）。地図タブは外れずに残るので、タブを行き来しても畳んだまま。アプリを終了して開き直すと（`MapScreen` が作り直されると）また出る。畳んだあと＋を押すと、記録やログインには進まずカードを戻す（試作の「＋を押すとカードに戻ります」。「決めてもらうこと」の 1）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-5  | **県の決め方**: 「今いる所から 50km 以内（`NEARBY_MAX_KM = 50`）で、`prefecture` が null でない寺社のうち、いちばん近い寺社の県」。今いる所は `permissionStatus === PermissionStatus.GRANTED && error === null && location !== null` のときだけ使う。地図では `useSpots` の `allSpots`（絞り込みに関係なく全部）から出す。`prefectureResolved = !location.isLoading && (origin === null \|\| !spots.isLoading)`（許可があるときは寺社を読み終えるまで待つ。最初に描いた言葉が後から変わらないように。位置が届いた描画で `useSpots` がまだ `isLoading:false` を返す隙間は D-9 で塞ぐ）。決まらないとき（許可なし・取れない・50km 以内に無い・寺社を読めない）は「撮ると、その県に色が差します」・小さな地図は全国・空押しなし                                                                                                                                                                                                                                                                                    |
| D-6  | **近くの寺社**: 地図に出ている寺社（`displaySpots`。絞り込みと揃える）のうち 50km 以内を近い順に最大 5 件（`NEARBY_LIMIT = 5`。同じ距離なら名前の順 `localeCompare(_, 'ja')`）。`RegionSpotSheet` に `variant: 'region' \| 'nearby'`（既定 `'region'` で今のまま）を足し、`'nearby'` では見出し「近くの寺社（N）」・距離の近い順（rank を見ない）・行の右に距離（`formatDistance`: 1km 未満は「350m」、以上は「1.2km」）。1 件も無いときは［近くの寺社を見る］を出さない（［御朱印を撮る］が横いっぱい）。開いてもカメラは動かさない。閉じるのは: 行を押す（寺社のシートへ）・地図を押す（ピン以外）・検索から寺社や地域が来たとき。開いている間はカードも＋も出さない。寺社のシートを閉じると、まだ 0 枚ならカードが戻る                                                                                                                                                                                                                                                                                       |
| D-7  | **ログインのきっかけを覚える**: `pendingAfterLogin: { kind: 'record'; spotId?: string } \| { kind: 'wish'; spotId: string } \| null` を `MapScreen` の state に持つ。＋・カードの［御朱印を撮る］→ `record`（spotId なし）、寺社のシートの「記録する」→ `record`（その寺社）、「行きたい」→ `wish`。ログインできたら `record` は `navigate('Record', { spotId, origin: 'map' })`、`wish` は記録の画面へ行かず地図に留まり（シートはそのまま）、`isAuthenticated` が true で、かつ `useWishlist` の `isLoading` が false（そのユーザーの行きたいを読み終えた）になった時点で、`wishlistSpotIds` にその寺社が無ければ `toggleWishlist(spotId)` を 1 回だけ呼ぶ。読み終える前に足すと、あとから届いた取得の結果で足した印が消えるため待つ（D-9）。「あとにする」で閉じたら忘れる                                                                                                                                                                                                                                   |
| D-8  | **記録して戻った直後にカードを出さない**: `MapScreen` から記録の画面へ進んだら（D-7 の経路すべて）`awaitingStampsRefresh = true`。地図に戻って `useUserStamps` の取得（`isLoading \|\| isRefreshing`）が **true → false** になった時点で false に戻す。その間カードは出さず＋を出す（1 枚目を記録した人には＋のまま。✕ で閉じて記録しなかった人には、取り直しのあとカードが戻る）。取り直しに失敗したら Set は変わらず、カードは次に取れるまで出ない（＋が出る）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D-9  | **`useUserStamps` に足すもの**: 戻り値に `isRefreshing`（2 回目以降の取得の最中だけ true）と `loadFailed`（最初の取得が失敗し、まだ一度も取れていない間だけ true）。さらに、**ゲスト → ログインに切り替わったその描画から** `isLoading` を true にする（今は focus effect が走るまでの 1 描画、`isAuthenticated:true` なのに `isLoading:false` の空の Set を返す）。既存の振る舞い（取り直しで `isLoading` を立てない・取り直しの失敗で Set を残す）は変えない。**`useWishlist` も同じ**: ゲスト → ログインに切り替わったその描画から、そのユーザーの最初の取得が終わるまで `isLoading` を true にする（今はゲストのときに false になったまま。D-7 が待つため）。`useWishlist` のほかの振る舞い（取り直し・楽観的更新・ロールバック）は変えない。**`useSpots` も同じ**: 位置が null から値になった・別の値に変わった、その描画から、その位置の取得が終わるまで `isLoading` を true にする（今は effect が走るまでの 1 描画、空の `allSpots` で `isLoading:false` を返し、カードが県なしの言葉で一瞬出てしまう） |
| D-10 | **1 枚目の保存直後**: `SaveMapReveal` に `firstStamp?: boolean`（既定 false）。`RecordCompleteScreen` は `totalStampCount !== undefined && totalStampCount - stampCount === 0` のとき true を渡す（まとめて登録した最初の記録も含む）。true のときだけ、その県に「空押し」と「色」の 2 枚を重ね、寄りと一緒に動かす（下の時間表）。false のときは今のまま（ピンが落ちた瞬間に切り替わる）。2 枚目以降・「その県で初めて」の記録には広げない（「決めてもらうこと」の 5）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-11 | **言葉**: 下の「言葉（確定の文字列）」の表のとおり。白紙のページは記録 0 枚なら「最初の1枚を撮る」、1 枚以上なら「次の1枚を撮る」（白紙は記録が何枚あっても最後に付くため）。`GoshuinchoPage` の白紙に `first?: boolean`、`GoshuinchoFlipView` が `first={stamps.length === 0}` を渡す                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D-12 | **地図の出典（ⓘ）を隠さない**: カードを描いている間は `Map` の `attributionPosition` を `{ bottom: 16 + カードの高さ + 8, left: 8 }`（カードの `onLayout` で測った高さ）、それ以外は今の `{ bottom: 78, left: 8 }`。OpenStreetMap 由来の地図の出典を、0 枚の人に出し続けるカードの下に隠さないため                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D-13 | **あゆみの一言の県**: 一言は `FirstStampNote`（新規）として、`isAuthenticated && !isLoading && error === null && stampCount === 0` のときだけ凡例の代わりに描く。県は新しいフック `useNearestPrefecture()`（`useLocation` ＋ 許可と位置があるときだけ `fetchSpotsByBounds(getBoundingBox(lat, lng, 50))` → D-5 と同じ規則）。フックは `FirstStampNote` の中で呼ぶので、記録のある人には位置も寺社も取りにいかない。決まるまでは一言も凡例も出さない。決まらなければ「最初の1枚で、日本地図に色が差します。」。あゆみの日本地図（`JapanMap`）は変えない。読み込み中（`isLoading`）は今までどおり凡例                                                                                                                                                                                                                                                                                                                                                                                                             |
| D-14 | **カードのボタンの字は 14pt**（`typography.buttonSmall`。試作は 16pt）。試作は 440pt 幅で描いていて、393pt 幅（iPhone 16 など）では 16pt の「近くの寺社を見る」＋アイコンがボタンの幅（約 160pt）に収まらない（字 128 ＋ アイコン 18 ＋ 間 4 ＋ 余白）。14pt なら 375pt 幅でも 1 行に収まる（「決めてもらうこと」の 4）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-15 | **動き**: どれも 1 回だけ・行き過ぎなし・弾みなし。動かすのは opacity と transform（translateY・scale）だけで、`useNativeDriver: true`。`Animated.loop`・`Animated.delay` は使わない（`Animated.delay` は既定の `Easing.ease` の遅延 require が Jest で壊れる。`SaveMapReveal` のコメントどおり `setTimeout` で待つ）。SVG の `fill` は動かさない（重ねた層の opacity で差す。`PrefectureMap` と同じ考え方）。「視差効果を減らす」では最後の姿をすぐ出す                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D-16 | **空押しの絵は 1 つの部品**: `PrefectureEmboss`（新規・`src/components/common/`）。`viewBox="0 0 1000 1132"` の `Svg` の中に置く `G` で、影（`colors.gray[600]`・左上へずらす）→ 光（`colors.white`・opacity 0.9・右下へずらす）→ 面（`colors.sealEmpty`）の 3 枚を重ねる。ずらしは `SealGlyph` と同じく `G` の `x`・`y`。カードの小さな地図は `offset 8`・影 0.45、保存直後は `offset 2.5`・影 0.26（試作の値）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### 言葉（確定の文字列）

| どこ                               | 文字列                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| カードの見出し                     | `参拝したら、写真1枚で\n日本地図に。`（試作どおり「日本地図に。」で改行）                                     |
| カードの下の行（県が分かる）       | `撮ると、${prefecture}に色が差します`（例「撮ると、京都府に色が差します」）                                   |
| カードの下の行（県が分からない）   | `撮ると、その県に色が差します`（試作の説明のまま）                                                            |
| カードのボタン                     | `御朱印を撮る`（アイコン `photo-camera`）／`近くの寺社を見る`（アイコン `near-me`）                           |
| カードの ✕                         | アイコン `close`・読み上げ `閉じる`                                                                           |
| 近くの寺社の一覧の見出し           | `近くの寺社（${n}）`（括弧は全角。地域の一覧と同じ）                                                          |
| あゆみの一言（県が分かる）         | `最初の1枚で、${prefecture}に色が差します。`                                                                  |
| あゆみの一言（県が分からない）     | `最初の1枚で、日本地図に色が差します。`                                                                       |
| 御朱印帳（並べる表示）の空の下の行 | `参拝したら、ここに1枚ずつ並びます`（上の行「御朱印がまだありません」とボタン「御朱印を記録する」は今のまま） |
| 御朱印帳（めくる表示）の白紙       | 記録 0 枚: `最初の1枚を撮る`／1 枚以上: `次の1枚を撮る`                                                       |

## 詳細設計

### 対象ファイル

| ファイル                                                                  | 変更                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/firstStamp.ts`（新規）                                         | `NEARBY_MAX_KM`・`NEARBY_LIMIT`・`nearbySpots()`・`nearestPrefecture()`・言葉（`FIRST_STAMP_CARD_TITLE`・`firstStampCardSubtitle()`・`ayumiFirstStampLine()`・`nearbySheetTitle()`）         |
| `src/utils/japanMapZoom.ts`                                               | `zoomToPrefecture(prefecture, width, fixedScale?)`。3 つ目を渡したら倍率をそれに固定（移動量の頭打ちは今と同じ式）                                                                           |
| `src/hooks/useUserStamps.ts`                                              | D-9                                                                                                                                                                                          |
| `src/hooks/useWishlist.ts`                                                | D-9（ログインに切り替わった描画からの `isLoading`）                                                                                                                                          |
| `src/hooks/useSpots.ts`                                                   | D-9（位置が届いた描画からの `isLoading`）                                                                                                                                                    |
| `src/hooks/useNearestPrefecture.ts`（新規）                               | D-13                                                                                                                                                                                         |
| `src/components/common/PrefectureEmboss.tsx`（新規）                      | D-16                                                                                                                                                                                         |
| `src/components/map/FirstStampCard.tsx`（新規）                           | 地図のカード（小さな日本地図・言葉・ボタン・✕・出る／畳む動き）                                                                                                                              |
| `src/components/map/RegionSpotSheet.tsx`                                  | `variant: 'nearby'`（D-6）。`label` は `'region'` のときだけ使う（型を `label?: string` にしてよい）                                                                                         |
| `src/screens/MapScreen.tsx`                                               | D-2〜D-8・D-12                                                                                                                                                                               |
| `src/components/record/SaveMapReveal.tsx`                                 | `firstStamp`（D-10）。寄りの transform を持つ `Animated.View` に `testID="save-reveal-zoom"`                                                                                                 |
| `src/screens/RecordCompleteScreen.tsx`                                    | `firstStamp` を渡す                                                                                                                                                                          |
| `src/components/collection/FirstStampNote.tsx`（新規）                    | あゆみの一言（D-13）                                                                                                                                                                         |
| `src/screens/CollectionScreen.tsx`                                        | 凡例と一言の出し分け                                                                                                                                                                         |
| `src/screens/GalleryScreen.tsx`                                           | 空の表示の下の行                                                                                                                                                                             |
| `src/components/gallery/GoshuinchoPage.tsx`・`GoshuinchoFlipView.tsx`     | 白紙の言葉（D-11）                                                                                                                                                                           |
| 上のそれぞれの `__tests__/`                                               | 下の受入基準                                                                                                                                                                                 |
| `docs/design/mockups/2026-10-first-stamp-v1/`                             | 試作の `index.html`・`assets.js`・`img/` だけを写す（`shots/`・`raw/`・`build/`・`.venv/` は入れない。`build_assets.py` は hamlet の作業ツリーの絶対パスを持っていてリポジトリでは動かない） |
| `.claude/harness/feature-list.json`・`progress.md`・`evidence/issue-327/` | 記録                                                                                                                                                                                         |

### インターフェース

```ts
// src/utils/firstStamp.ts
export const NEARBY_MAX_KM = 50;
export const NEARBY_LIMIT = 5;
type Origin = { latitude: number; longitude: number };
/** origin から maxKm 以内（以下を含む）を近い順に limit 件。同じ距離なら名前の順。入力は並べ替えない */
export function nearbySpots(
  spots: Spot[],
  origin: Origin | null,
  opts?: { maxKm?: number; limit?: number }
): { spot: Spot; distanceKm: number }[];
/** maxKm 以内で prefecture が null でない、いちばん近い寺社の県。無ければ null */
export function nearestPrefecture(spots: Spot[], origin: Origin | null): string | null;
export const FIRST_STAMP_CARD_TITLE = '参拝したら、写真1枚で\n日本地図に。';
export function firstStampCardSubtitle(prefecture: string | null): string;
export function ayumiFirstStampLine(prefecture: string | null): string;
export function nearbySheetTitle(count: number): string;

// src/hooks/useUserStamps.ts
interface UseUserStampsReturn {
  visitedSpotIds: Set<string>;
  isLoading: boolean;
  /** 2 回目以降（画面に戻ったとき）の取得の最中だけ true */
  isRefreshing: boolean;
  /** 最初の取得が失敗し、まだ一度も取れていない間だけ true */
  loadFailed: boolean;
}

// src/hooks/useNearestPrefecture.ts
export function useNearestPrefecture(): { prefecture: string | null; isResolved: boolean };

// src/components/common/PrefectureEmboss.tsx
interface PrefectureEmbossProps {
  prefecture: string;
  /** viewBox（幅 1000）の単位。影は (-offset, -offset)、光は (offset, offset) */
  offset: number;
  /** 影の不透明度 */
  shadeOpacity: number;
}

// src/components/map/FirstStampCard.tsx
interface FirstStampCardProps {
  /** 色が差す県。null なら全国・空押しなし・「その県」 */
  prefecture: string | null;
  /** ［近くの寺社を見る］を出すか */
  showNearby: boolean;
  reduceMotion: boolean;
  onShoot: () => void;
  onNearby: () => void;
  /** ✕。畳む動き（280ms）が終わってから呼ぶ。視差効果を減らすなら押してすぐ */
  onDismiss: () => void;
  /** カードの高さ（地図の出典を上へ逃がすため） */
  onHeightChange?: (height: number) => void;
}

// src/components/record/SaveMapReveal.tsx（足すもの）
firstStamp?: boolean; // 既定 false
export const EMBOSS_IN_DELAY_MS = 600; // 寄り始めから空押しが浮き始めるまで
export const EMBOSS_FADE_MS = 600;
export const TINT_FADE_MS = 600;

// src/components/gallery/GoshuinchoPage.tsx（白紙に足すもの）
first?: boolean; // 既定 false（「次の1枚を撮る」）
```

testID: `first-stamp-card`・`first-stamp-card-map`（小さな地図の窓）・`first-stamp-card-zoom`（寄りの transform を持つ View）・`first-stamp-card-emboss`（空押しの層）・`first-stamp-card-title`・`first-stamp-card-subtitle`・`first-stamp-shoot`・`first-stamp-nearby`・`first-stamp-close`・`region-spot-${i}-distance`・`save-reveal-zoom`・`save-reveal-emboss`・`save-reveal-tint`・`ayumi-first-stamp-note`。`save-map-` で始まる testID を新しく足さない（既存テストの 47 の数え方）。

### 画面仕様

#### 地図タブ（到達: 下タブ「地図」。記録 0 枚。ログイン前でも後でも）

試作 `shots/a1.png` の姿。値は `src/theme/` のトークン。

- **カード**: `position:absolute`・`left/right/bottom: spacing.lg（16）`・`backgroundColor: colors.white`・`borderRadius: borderRadius.xl（16）`・`padding: 14`（あゆみの地図のカードと同じ）・`shadows.floating`（地図に浮かせるもの）
  - 上の段（横並び・`gap: spacing.md`・縦中央）: 小さな日本地図 ＋ 文字
  - 小さな日本地図: 幅 84・高さ `84 × JAPAN_MAP_HEIGHT / JAPAN_MAP_WIDTH`（約 95.1）・`borderRadius.lg（12）`・`overflow:hidden`・地 `colors.white`。47 県を `fill: colors.prefectureFill.empty`・`stroke: colors.prefectureFill.border`・`strokeWidth: 3`。県が分かるときは `zoomToPrefecture(prefecture, 84, 1.8)` で寄せ、`PrefectureEmboss`（offset 8・影 0.45）をその県に重ねる
  - 見出し: `fontSize 17`・`fontWeight '700'`・`lineHeight 24`・`colors.gray[900]`（試作の値。`typography.h3` を元に上書き）
  - 下の行: `typography.bodySmall`・`colors.gray[600]`・`marginTop: spacing.xs`
  - ✕: カードの右上 `top 8・right 8`・32×32・`borderRadius 16`・アイコン `close` 20・`colors.gray[400]`
  - ボタンの段: `marginTop: spacing.md`・`gap: spacing.sm`。どちらも `Button`（`primary`／`outline`）・`flex: 1`・`minHeight: 44`・`paddingHorizontal: spacing.xs`・字は `typography.buttonSmall`（D-14）・アイコン 18
- **動き**（D-15）

| 何        | いつ               | 長さ  | 中身                                                                                                                                                                                                                                    |
| --------- | ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 出る      | カードを描いたとき | 300ms | translateY 16 → 0・opacity 0 → 1・`Easing.out(Easing.cubic)`（試作の `cubic-bezier(.215,.61,.355,1)`。`RegionSpotSheet` と同じ）                                                                                                        |
| 空押し    | 出てから 320ms 後  | 600ms | 空押しの層の opacity 0 → 1・`Easing.out(Easing.quad)`。1 回だけ（描き直されたら、また 1 回）                                                                                                                                            |
| 畳む（✕） | ✕ を押したとき     | 280ms | scale 1 → 0.12・opacity 1 → 0・`Easing.in(Easing.cubic)`。縮む中心は＋の中心（カードの右下の角から左へ 32・上へ 32 の点。`transformOrigin` に `onLayout` の幅・高さから入れる）。終わってから `onDismiss` → ＋が今の出方（160ms）で出る |

- 寺社のピンを押す・近くの寺社の一覧を開く・地域の一覧が出る → カードは（動きなしで）外す。戻ったらまた「出る」
- 視差効果を減らす: 出る・空押し・畳むの動きなし（空押しは最初から浮いた姿。✕ はすぐ消える）。動いている最中に設定が変わったら、その場で最後の姿にする

#### 近くの寺社（到達: 地図タブ → カードの［近くの寺社を見る］）

`RegionSpotSheet` の `variant="nearby"`（試作 `shots/an1.png`）。見出し「近くの寺社（N）」、行は今の行（アイコン・名前・住所 1 行）の右に距離（`fontSize 13`・`colors.gray[500]`）。出る動きは今の地域の一覧と同じ（300ms・視差効果を減らすなら動きなし）。行を押すと今のピンを押したときと同じ（寺社のシート・カメラはその寺社へ 300ms）。

#### 保存直後（到達: 記録 0 枚 → 記録 → 保存 → `RecordComplete`）

`firstStamp` のときの時間表（試作「1枚目の保存直後（共通）」の「案」。0 = 画面が出たとき）。

| ms                                     | 起きること                                                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0                                      | 全国（今のまま）                                                                                                                                                              |
| 560（`HOLD_MS`）                       | 寄り始める（今のまま 1100ms）                                                                                                                                                 |
| 1160（`HOLD_MS + EMBOSS_IN_DELAY_MS`） | その県の空押しが浮き始める（600ms・`Easing.out(Easing.quad)`）                                                                                                                |
| 1660                                   | 寄り終わる・ピンが落ち始める（今のまま 520ms）                                                                                                                                |
| 2180（`HOLD_MS + ZOOM_MS + PIN_MS`）   | ピンが落ちきる → `onSettled`（枚数の数え上げ。今のまま）。色の層が差し始める（600ms・`Easing.out(Easing.cubic)`）・空押しの層が引き始める（600ms・`Easing.out(Easing.quad)`） |
| 2780                                   | 色が入りきる・空押しが消える。下の県の `fill` を最後の濃さにする（上の色の層と同じ色なので見た目は変わらない）                                                                |

- 空押しの層: `PrefectureEmboss`（offset 2.5・影 0.26）。色の層: その県の `Path`（`fill: colors.prefectureFill[prefectureTier(枚数)]`・`stroke: colors.prefectureFill.border`・`strokeWidth 2`）。どちらも `save-reveal-zoom` の中（寄りと一緒に動く）、ピンより下
- 層は「`Animated.View`（opacity を native driver で動かす）の中に `Svg` を 1 枚ずつ」重ねる形にする（`PrefectureMap` のような `AnimatedPath` の JS 駆動にしない）
- 寄り始めからの待ちは `setTimeout`（`Animated.delay` を使わない）。外れたら止める（今の `holdTimer` と同じ）
- 視差効果を減らす: 寄り終わった姿をすぐ出し、色の層は 1・空押しは 0

#### あゆみ（到達: 下タブ「あゆみ」。ログインしていて記録 0 枚）

日本地図のカードの下、今の凡例（「まだ 47」「1〜2枚」…）の所に、凡例の代わりに一言（試作の値: `fontSize 15`・`lineHeight 22`・`colors.gray[700]`・`textAlign: 'center'`。凡例と同じ上の罫線 `borderTopWidth 1`・`colors.gray[200]`・`marginTop: spacing.md`・`paddingTop: spacing.md`）。地図・上の「0 / 47 都道府県」「0 枚」は今のまま。

#### 御朱印帳（到達: 下タブ「御朱印帳」。ログインしていて記録 0 枚）

並べる表示の空: 下の行の言葉だけ替える。めくる表示の白紙: 言葉だけ替える（アイコン・色・大きさは今のまま）。

## テスト方針

- TDD（t-wada 流）。各スライスでテストを先に書き、赤を見てから実装
- 動きは `jest.useFakeTimers()` ＋ `Animated.timing` の spy（設定の `duration`・`toValue`・`useNativeDriver`・`easing(0.5)` の値）と、時間を進めたあとの `StyleSheet.flatten(...).opacity` で見る（`LoadingBook.test.tsx` の読み方）。`easing` は関数の同一性ではなく `easing(0.5)` の値で比べる（`Easing.out(Easing.cubic)(0.5) = 0.875`・`Easing.out(Easing.quad)(0.5) = 0.75`・`Easing.in(Easing.cubic)(0.5) = 0.125`）
- `react-native-svg` の部品は合成コンポーネントの props で見る（`SpotSheetHero.test.tsx` の `findAllByType(SealGlyph)` と同じ）
- `MapScreen.test.tsx` のモックに足す: `useUserStamps` の `isRefreshing`・`loadFailed`（既定 false）、`useLocation` の `isLoading`・`error` の差し替え、`useWishlist` の `toggleWishlist` を外に出した `mockToggleWishlist` と `isLoading` の差し替え、`useSpots` の `isLoading` の差し替え。#327 のテストの寺社は `mockSpotsOverride` で `prefecture: '宮城県'` を付ける（既存の `mockSpots` は変えない）
- 下の「F」は `src/utils/__tests__/firstStamp.test.ts` の寺社（今いる所 O = `{ latitude: 35, longitude: 135 }`。どれも経度 135、緯度 `35 + km / 111.195`）

| id  | km  | prefecture | name |
| --- | --- | ---------- | ---- |
| s1  | 0.3 | null       | あ   |
| s2  | 0.8 | 京都府     | い   |
| s3  | 1.2 | 滋賀県     | う   |
| s4  | 2.0 | 京都府     | え   |
| s5  | 3.0 | 大阪府     | お   |
| s6  | 4.0 | 奈良県     | か   |
| s7  | 60  | 兵庫県     | き   |

F の並び（入力）は `[s5, s7, s2, s6, s1, s4, s3]`。

### 既存テストの扱い

- 消さない・書き換えないのが原則（Q-9）。書き換えてよいのは次だけ
  - `GoshuinchoPage.test.tsx` の `'ここに御朱印を追加する'` を新しい言葉に替える（2 か所。スタイルの確かめは残す）
  - `MapScreen.test.tsx` の「一覧が出ている間は、記録の FAB を引っ込める」（#311）: その `it` の中で `mockVisitedSpotIds = new Set(['spot-1'])` を足す（1 行。この describe の `beforeEach` が 0 枚にするので、閉じたあとに＋ではなくカードが出るため）
  - `MapScreen.test.tsx` の #311「AC-45: 「視差効果を減らす」なら、一覧の出る動き（Animated.timing）を呼ばない」: カードの動きが数に入るなら、FAB のテストと同じく `mockVisitedSpotIds = new Set(['spot-1'])` を足してよい（1 行）
  - `MapScreen.test.tsx`・`useUserStamps.test.ts`・`useWishlist.test.ts`・`useSpots.test.ts` のモックの戻り値に新しい項目を足す（`expect` は変えない）

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準に基づいて合否判定を行う。

### 機能基準 — 純関数（S1・Jest・`src/utils/__tests__/firstStamp.test.ts`・`japanMapZoom.test.ts`）

- [ ] AC-1: `nearbySpots(F, O)` の `spot.id` が `['s1','s2','s3','s4','s5']`、`distanceKm` がそれぞれ `[0.3, 0.8, 1.2, 2.0, 3.0]` に `toBeCloseTo(_, 2)`。呼んだあと F の並びが変わっていない。`nearbySpots(F, O, { limit: 10 })` が 6 件（s7 を含まない）。`nearbySpots(F, null)` が `[]`。`NEARBY_MAX_KM === 50`・`NEARBY_LIMIT === 5`。同じ座標の 2 寺社（名前「清水寺」「八坂神社」）は `['八坂神社','清水寺'].sort((a, b) => a.localeCompare(b, 'ja'))` の順
- [ ] AC-2: `nearestPrefecture(F, O) === '京都府'`（いちばん近い s1 は県が null なので飛ばす）。`nearestPrefecture([s7], O) === null`・`nearestPrefecture([s1], O) === null`・`nearestPrefecture(F, null) === null`
- [ ] AC-3: 言葉: `FIRST_STAMP_CARD_TITLE === '参拝したら、写真1枚で\n日本地図に。'`。`firstStampCardSubtitle('京都府') === '撮ると、京都府に色が差します'`・`('北海道') === '撮ると、北海道に色が差します'`・`(null) === '撮ると、その県に色が差します'`。`ayumiFirstStampLine('京都府') === '最初の1枚で、京都府に色が差します。'`・`(null) === '最初の1枚で、日本地図に色が差します。'`。`nearbySheetTitle(5) === '近くの寺社（5）'`
- [ ] AC-4: `zoomToPrefecture(name, 84, 1.8)` は `'京都府'`・`'北海道'`・`'沖縄県'` で `scale === 1.8`、`translateX`・`translateY` が「倍率 1.8 で今と同じ式（中心へ寄せ、`±(1.8 − 1) × 幅/2`・`±(1.8 − 1) × 高さ/2` で頭打ち）」の値に `toBeCloseTo(_, 6)`。3 つ目を渡さないときの値は今と同じ（既存の `japanMapZoom.test.ts` が消さず・書き換えずに通る）

### 機能基準 — 記録・行きたい・寺社の取得（S2・Jest・`src/hooks/__tests__/useUserStamps.test.ts`・`useWishlist.test.ts`・`useSpots.test.ts`）

- [ ] AC-5: 戻り値のキーが `visitedSpotIds`・`isLoading`・`isRefreshing`・`loadFailed`。ゲスト: `isLoading` false・`isRefreshing` false・`loadFailed` false・`size` 0・`fetchVisitedSpotIds` 0 回
- [ ] AC-6: ログイン済み・最初の取得が成功（`Set(['spot-1','spot-2'])`）: 終わったあと `isLoading` false・`isRefreshing` false・`loadFailed` false・`size` 2
- [ ] AC-7: ログイン済み・最初の取得が失敗: 終わったあと `isLoading` false・`loadFailed` true・`isRefreshing` false・`size` 0。続けて focus の callback をもう一度呼び、成功（`Set(['a'])`）させると、その最中は `isLoading` true、終わったあと `loadFailed` false・`size` 1
- [ ] AC-8: 取り直し: 最初に `Set(['a'])` が取れたあと focus の callback を呼び、解決しない Promise を返させると `isRefreshing` true・`isLoading` false・`visitedSpotIds.has('a')`。`Set(['a','b'])` で解決すると `isRefreshing` false・`size` 2。取り直しが失敗したときは `isRefreshing` false・`has('a')` のまま・`loadFailed` false
- [ ] AC-9: ゲスト → ログインの切り替えで空の Set を「取れた」と見せない: `renderHook` のコールバックで毎回 `{ auth: mockIsAuthenticated, isLoading: result.isLoading }` を配列に積む。ゲストで描いて `isLoading` false を待ち、`mockIsAuthenticated = true`・`fetchVisitedSpotIds` を解決しない Promise にして `rerender()` する。解決する前までに積まれたもののうち `auth === true` のものに `isLoading === false` が 1 つも無い（1 つ以上はある）。解決したあとは `isLoading` false
- [ ] AC-10: `useWishlist` も同じ: `renderHook` のコールバックで毎回 `{ auth: isAuthenticated, isLoading }` を積む。ゲスト（`user: null`）で描いて `isLoading` false を待ち、`useAuth` のモックを `{ isAuthenticated: true, user: { id: 'u1' } }`・`fetchWishlistSpotIds` を解決しない Promise にして `rerender()` する。解決する前までに積まれた `auth === true` のものに `isLoading === false` が 1 つも無い。`Set(['s'])` で解決すると `isLoading` false・`wishlistSpotIds.has('s')`。既存の `useUserStamps.test.ts`・`useWishlist.test.ts` は消さず・`expect` を書き換えずに通る（Q-9）
- [ ] AC-11: `useSpots` も、位置が null から値に変わったその描画から、その位置の取得が終わるまで `isLoading` を true にする: `renderHook(({ loc }) => useSpots(loc), { initialProps: { loc: null } })` で `isLoading` false を待ち、`fetchAllActiveSpots` を解決しない Promise にして `rerender({ loc: O })` する。コールバックで積んだ描画のうち、loc が O で解決する前のものに `isLoading === false` が 1 つも無い（1 つ以上はある）。解決すると `isLoading` false・`allSpots` が返した寺社。既存の `useSpots.test.ts` は消さず・`expect` を書き換えずに通る（Q-9）

### 機能基準 — 近くの寺社の一覧（S3・Jest・`src/components/map/__tests__/RegionSpotSheet.test.tsx`）

- [ ] AC-12: `variant` を渡さないときは今のまま: 既存のテストが消さず・書き換えずに通る。`queryAllByTestId(/^region-spot-\d+-distance$/)` が 0 件
- [ ] AC-13: `variant="nearby"`・`origin = O`・寺社 3 つ（近い順に rank 1・5・3 として、rank の高い順とは違う並びにする）: 見出しのテキストが `'近くの寺社（3）'`（`'のあたりの寺社'` を含むテキストが無い）。`region-spot-0`〜`2` の名前が距離の近い順
- [ ] AC-14: `variant="nearby"` の各行に `region-spot-${i}-distance` があり、テキストが `formatDistance(calculateDistance(O.latitude, O.longitude, spot.lat, spot.lng))`。それぞれ `region-spot-${i}` の中にあり、`StyleSheet.flatten(style)` が `{ fontSize: 13, color: colors.gray[500] }` を含む
- [ ] AC-15: `variant="nearby"` で行を押すと `onSelectSpot(その寺社の id)` が 1 回。`reduceMotion` が true なら `Animated.timing` を呼ばない（地域の一覧と同じ）

### 機能基準 — 空押しの部品とカード（S4・Jest・`src/components/common/__tests__/PrefectureEmboss.test.tsx`・`src/components/map/__tests__/FirstStampCard.test.tsx`）

- [ ] AC-16: `PrefectureEmboss`（`prefecture='京都府'`・`offset=8`・`shadeOpacity=0.45`）を `Svg` の中で描くと、`react-native-svg` の `G` が 3 つ、この順で props が `{ fill: colors.gray[600], opacity: 0.45, x: -8, y: -8 }`・`{ fill: colors.white, opacity: 0.9, x: 8, y: 8 }`・`{ fill: colors.sealEmpty }`（3 つ目は `opacity`・`x`・`y` のキーを持たない）を含む。それぞれの中の `Path` が 1 つで `d === JAPAN_PREFECTURE_PATHS['京都府']`
- [ ] AC-17: `FirstStampCard`（`prefecture='京都府'`・`showNearby`・`reduceMotion=false`）: `first-stamp-card-title` のテキストが `FIRST_STAMP_CARD_TITLE`、`first-stamp-card-subtitle` が `'撮ると、京都府に色が差します'`。`first-stamp-shoot` の中に `'御朱印を撮る'` と `'photo-camera'`、`first-stamp-nearby` の中に `'近くの寺社を見る'` と `'near-me'`。`first-stamp-close` の `accessibilityLabel` が `'閉じる'`・`accessibilityRole` が `'button'`・中に `'close'`
- [ ] AC-18: 形（`StyleSheet.flatten`）: `first-stamp-card` が `{ position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: colors.white, borderRadius: 16, padding: 14 }` と `shadows.floating` の 5 つのキーを含む。見出しが `{ fontSize: 17, fontWeight: '700', lineHeight: 24, color: colors.gray[900] }`、下の行が `{ fontSize: 14, lineHeight: 20, color: colors.gray[600] }` を含む。`first-stamp-shoot`・`first-stamp-nearby` が `{ flex: 1, minHeight: 44 }` を含み、その中の文字が `{ fontSize: 14, fontWeight: '600' }` を含む。`first-stamp-shoot` が `{ backgroundColor: colors.primary[500] }`、`first-stamp-nearby` が `{ borderWidth: 1, borderColor: colors.primary[500] }` を含む。`first-stamp-close` が `{ position: 'absolute', top: 8, right: 8, width: 32, height: 32 }` を含む
- [ ] AC-19: 小さな地図: `first-stamp-card-map` が `{ width: 84, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.white }` を含み、`height` が `84 * 1132 / 1000` に `toBeCloseTo(_, 2)`。その中の `strokeWidth === 3` の `Path` が 47 個で、どれも `fill: colors.prefectureFill.empty`・`stroke: colors.prefectureFill.border`。`first-stamp-card-zoom` の transform が `zoomToPrefecture('京都府', 84, 1.8)` の `translateX`・`translateY`・`scale`（1.8）。`first-stamp-card-emboss` の中に `PrefectureEmboss` が 1 つで props が `{ prefecture: '京都府', offset: 8, shadeOpacity: 0.45 }`。`prefecture={null}` なら `first-stamp-card-emboss` が無く、`first-stamp-card-zoom` の transform が無いか `scale` 1・`translateX` 0・`translateY` 0（全国のまま）で、下の行が `'撮ると、その県に色が差します'`
- [ ] AC-20: 出る・空押し（fake timers）: 描いた直後、`Animated.timing` の設定に `{ toValue: 1, duration: 300, useNativeDriver: true }` を含み `easing(0.5)` が 0.875（`toBeCloseTo(_, 3)`）のものがある。320ms までは `first-stamp-card-emboss` の opacity が 0。320ms を過ぎると `{ toValue: 1, duration: 600, useNativeDriver: true }`・`easing(0.5)` が 0.75 の設定が 1 回呼ばれ、`320 + 600 + 50` ms 後に opacity が 1（`toBeCloseTo(_, 2)`）。それより後も呼ばれる回数は増えない（1 回だけ）
- [ ] AC-21: 畳む: `first-stamp-card` に `layout`（`{ width: 361, height: 180 }`）を送ってから `first-stamp-close` を押すと、`onDismiss` はまだ 0 回。`{ duration: 280, useNativeDriver: true }`・`easing(0.5)` が 0.125 の設定が呼ばれる。280ms 進めると `onDismiss` が 1 回、`first-stamp-card` の opacity が 0・transform の `scale` が 0.12（`toBeCloseTo(_, 2)`）。`transformOrigin` が `[329, 148, 0]` か `'329px 148px'`（＝右下の角から左へ 32・上へ 32）
- [ ] AC-22: `reduceMotion=true`: 描いても `Animated.timing` が 0 回、`first-stamp-card` の opacity が 1・translateY が 0、`first-stamp-card-emboss` の opacity が 1。✕ を押すと同じ tick で `onDismiss` が 1 回。さらに `reduceMotion=false` で描いて 100ms 進めたところで `reduceMotion=true` に描き直すと、その場で opacity 1・translateY 0・空押し 1 になり、待っていた空押しの `setTimeout` も取り消される（そのあと 1000ms 進めても `duration: 600` の `Animated.timing` が呼ばれない）
- [ ] AC-23: `showNearby=false` なら `first-stamp-nearby` が無く `first-stamp-shoot` はある。`first-stamp-shoot` を押すと `onShoot` が 1 回、`first-stamp-nearby` で `onNearby` が 1 回。動きの途中で外しても（unmount）、そのあと `jest.getTimerCount()` が 0

### 機能基準 — 地図（S5・Jest・`src/screens/__tests__/MapScreen.test.tsx`）

「F0」= ゲスト・`mockVisitedSpotIds = new Set()`・寺社は `spot-1`・`spot-2`（今の座標）に `prefecture: '宮城県'` を付けたもの・位置情報 `'granted'`・`error: null`・`isLoading: false`。

- [ ] AC-24: F0: `first-stamp-card` がある。下の行が `'撮ると、宮城県に色が差します'`、`first-stamp-nearby` がある。`fab-button` が無い（`waitFor`）
- [ ] AC-25: F0 をログイン済み（`isAuthenticated: true`）にしても AC-24 と同じ
- [ ] AC-26: ログイン済み・`mockVisitedSpotIds = new Set(['spot-1'])`: `first-stamp-card` が無く、`fab-button` がある
- [ ] AC-27: F0 で、(a) `useAuth` の `isLoading: true`、(b) `useUserStamps` の `isLoading: true`、(c) `loadFailed: true` のそれぞれで `first-stamp-card` が無く、`fab-button` がある
- [ ] AC-28: F0 で、(a) `useLocation` の `isLoading: true`、(b) `useSpots` の `isLoading: true` のそれぞれで、`first-stamp-card` も `fab-button` も無い（県の判定待ち）
- [ ] AC-29: F0 で、(a) 位置情報 `'denied'`、(b) `useLocation` の `error: 'x'`、(c) 寺社が緯度 +1.0（約 111km）にしか無い、(d) 寺社の `prefecture` が null のそれぞれで、`first-stamp-card` があり、下の行が `'撮ると、その県に色が差します'`、`first-stamp-card-emboss` が無い。(a)(b)(c) では `first-stamp-nearby` が無く、(d) ではある
- [ ] AC-30: F0 をログイン済みにして `first-stamp-shoot` を押すと、`mockParentNavigate` が `('Record', { spotId: undefined, origin: 'map' })` で 1 回
- [ ] AC-31: F0（ゲスト）で `first-stamp-shoot` を押すと `modal-later-button` が出る。`UNSAFE_getByType(LoginPromptModal).props.onLoginSuccess()` を `act` の中で呼ぶと、`mockParentNavigate` が `('Record', { spotId: undefined, origin: 'map' })` で 1 回
- [ ] AC-32: ✕ はその回だけ: F0 で `first-stamp-close` を押すと、`waitFor` で `first-stamp-card` が無くなり `fab-button` が出る。同じ画面を `rerender` しても `first-stamp-card` は無いまま。`fab-button` を押すと `first-stamp-card` が戻り、`mockParentNavigate` は 0 回・`modal-later-button` は無い。いったん `unmount` して描き直すと、最初から `first-stamp-card` がある
- [ ] AC-33: F0 で `UNSAFE_getByType(SpotMapLayers).props.onPressSpot('spot-1')` → `first-stamp-card` が無い。`UNSAFE_getByType(SpotBottomSheet).props.onDismiss()` → `first-stamp-card` が戻る
- [ ] AC-34: 近くの寺社を開く: F0 で `first-stamp-nearby` を押すと、`region-sheet` があり、テキスト `'近くの寺社（2）'` がある。`region-spot-0` の中に `'Test Shrine'`、`region-spot-0-distance` のテキストが `formatDistance(calculateDistance(38.2682, 140.8694, 38.27, 140.87))`。`first-stamp-card` が無く、`fab-button` も無い（`waitFor`）。押す前と押したあとで `cameraMocks.flyTo`・`fitBounds`・`easeTo` の呼び出し回数が増えない（`flyTo` は描いたときに今いる所へ 1 回呼ばれている）
- [ ] AC-35: AC-34 のあと `region-spot-0` を押すと、`region-sheet` が無くなり、`UNSAFE_getByType(SpotBottomSheet).props.spotId === 'spot-1'`、`first-stamp-card` は無い
- [ ] AC-36: AC-34 のあと `map-view` を `fireEvent(…, 'press', { nativeEvent: {} })` で押すと、`region-sheet` が無くなり、`first-stamp-card` が戻る
- [ ] AC-37: AC-34 のあと `route.params = { focusSpotId: 'spot-2' }` で描き直すと、テキスト `'近くの寺社（2）'` が無い
- [ ] AC-38: 行きたい → ログイン: F0（ゲスト）で寺社 `spot-1` を選び、`SpotBottomSheet` の `onWishlistToggle('spot-1')` を呼ぶと `modal-later-button` が出る。`onLoginSuccess()` を呼ぶと、`mockParentNavigate` は 0 回、`modal-later-button` が無くなり、`SpotBottomSheet` の `spotId` は `'spot-1'` のまま。`mockUseAuthReturn` を `isAuthenticated: true`・`useWishlist` の `isLoading: true` にして描き直すと `mockToggleWishlist` は 0 回。`isLoading: false` にして描き直すと `('spot-1')` で 1 回。もう一度描き直しても 1 回のまま。別の場合: (a) `mockWishlistSpotIds` に `'spot-1'` があるときは 0 回、(b) `onLoginSuccess` の代わりに `modal-later-button` を押してから `isAuthenticated: true` で描き直したときは 0 回
- [ ] AC-39: シートの記録 → ログイン: F0（ゲスト）で `spot-2` を選び、`SpotBottomSheet` の `onRecord('spot-2')` → `onLoginSuccess()` で、`mockParentNavigate` が `('Record', { spotId: 'spot-2', origin: 'map' })` で 1 回
- [ ] AC-40: 記録して戻った直後: F0 をログイン済みにして `first-stamp-shoot` を押すと、同じ `act` のあとで `first-stamp-card` が無い。`rerender` しただけ（取得が動いていない）でも無い。`isRefreshing: true` で描き直すと無く、`fab-button` がある（`waitFor`）。続けて (a) `isRefreshing: false`・`mockVisitedSpotIds = new Set(['spot-1'])` で描き直すと `first-stamp-card` が無く `fab-button` がある、(b) `isRefreshing: false`・空の Set のままなら `first-stamp-card` が戻る。`isRefreshing` の代わりに `isLoading` を true → false にしても (a)(b) が同じ
- [ ] AC-41: 地図の出典: F0 で `first-stamp-card` に `layout`（`height: 180`）を送ると `getByTestId('map-view').props.attributionPosition` が `{ bottom: 204, left: 8 }`。ログイン済み・`Set(['spot-1'])` のときは `{ bottom: 78, left: 8 }`

### 機能基準 — 1 枚目の保存直後（S6・Jest・`src/components/record/__tests__/SaveMapReveal.test.tsx`・`src/screens/__tests__/RecordCompleteScreen.test.tsx`）

- [ ] AC-42: `firstStamp` を渡さないときは今のまま: `save-reveal-emboss`・`save-reveal-tint` が無い。既存のテストが消さず・書き換えずに通る（47 の数え方・「寄り終わってから色づく」など）
- [ ] AC-43: `firstStamp`・`prefecture='東京都'`・`stampCountByPrefecture={ 東京都: 1 }`・`addedCount=1`・`width=210`・視差効果を減らさない: 描いた直後、`save-reveal-emboss` の中に `PrefectureEmboss` が 1 つで props が `{ prefecture: '東京都', offset: 2.5, shadeOpacity: 0.26 }`。`save-reveal-tint` の中に `Path` が 1 つで props が `{ d: JAPAN_PREFECTURE_PATHS['東京都'], fill: colors.prefectureFill.tier1, stroke: colors.prefectureFill.border, strokeWidth: 2 }` を含む。両方の opacity が 0。両方とも `save-reveal-zoom` の子孫で、`save-map-pin` は `save-reveal-zoom` の子孫ではない
- [ ] AC-44: 時間（fake timers・`onSettled` は `jest.fn()`）: `HOLD_MS + EMBOSS_IN_DELAY_MS − 50` で空押しの opacity 0。`HOLD_MS + EMBOSS_IN_DELAY_MS + EMBOSS_FADE_MS + 50` で 1（`toBeCloseTo(_, 2)`）。`HOLD_MS + ZOOM_MS + PIN_MS − 50` で色の層 0・`save-map-東京都` の fill が `empty`・`onSettled` 0 回。`+ 50` で `onSettled` 1 回・`save-map-東京都` の fill はまだ `empty`。`+ 300` で色の層と空押しの opacity がどちらも 0 より大きく 1 より小さい。`+ TINT_FADE_MS + 50` で色の層 1・空押し 0・`save-map-東京都` の fill が `tier1`。`+50・+150・+300・+450・+600` で読んだ色の層の opacity が単調に増え（減らない）、空押しは単調に減る（増えない）。`EMBOSS_IN_DELAY_MS`・`EMBOSS_FADE_MS`・`TINT_FADE_MS` がどれも 600
- [ ] AC-45: AC-44 の間に呼ばれた `Animated.timing` のうち、空押しが浮く・色が差す・空押しが引くの 3 つの設定が `{ duration: 600, useNativeDriver: true }` を含み、`toValue` がそれぞれ 1・1・0、`easing(0.5)` がそれぞれ 0.75・0.875・0.75（`toBeCloseTo(_, 3)`）
- [ ] AC-46: `firstStamp` で視差効果を減らすとき: `await act` のあと、色の層の opacity 1、空押しは無いか opacity 0、`save-map-東京都` の fill が `tier1`。`duration: 600` の `Animated.timing` が 0 回
- [ ] AC-47: `firstStamp` で 1500ms のところで外す（unmount）と、そのあと `jest.getTimerCount()` が 0
- [ ] AC-48: `RecordCompleteScreen` が渡す `firstStamp`（`UNSAFE_getByType(SaveMapReveal).props.firstStamp`）: `totalStampCount: 1, stampCount: 1` → true、`totalStampCount: 5, stampCount: 1` → false、`totalStampCount: 2, stampCount: 2` → true。既存の `RecordCompleteScreen.test.tsx` が消さず・書き換えずに通る

### 機能基準 — あゆみ・御朱印帳の言葉（S7・Jest）

- [ ] AC-49: `useNearestPrefecture`（`useLocation` と `fetchSpotsByBounds` をモック。`src/hooks/__tests__/useNearestPrefecture.test.ts`）: (a) `'granted'`・位置 O・`error: null`・`fetchSpotsByBounds` が F を返す → `{ prefecture: '京都府', isResolved: true }`、`fetchSpotsByBounds` が `getBoundingBox(35, 135, 50)` で 1 回。(b) `'denied'` → `{ prefecture: null, isResolved: true }`、取得 0 回。(c) `useLocation` の `isLoading: true` → `isResolved: false`、取得 0 回。(d) `error: 'x'` → `{ prefecture: null, isResolved: true }`、取得 0 回。(e) 取得が `[]` → `{ prefecture: null, isResolved: true }`
- [ ] AC-50: `CollectionScreen`（ログイン済み・`isLoading: false`・`error: null`・`stampCount: 0`・`useNearestPrefecture` をモックして `{ '京都府', true }`）: `ayumi-first-stamp-note` のテキストが `'最初の1枚で、京都府に色が差します。'`、`StyleSheet.flatten(style)` が `{ fontSize: 15, lineHeight: 22, color: colors.gray[700], textAlign: 'center' }` を含む。`queryAllByTestId('ayumi-legend-swatch')` が 0 件。`getAllByTestId(/^prefecture-/)` が 47 件（地図はそのまま）
- [ ] AC-51: AC-50 で `{ null, true }` → `'最初の1枚で、日本地図に色が差します。'`。`{ null, false }` → `ayumi-first-stamp-note` が無く、`ayumi-legend-swatch` も 0 件
- [ ] AC-52: `stampCount: 25` → `ayumi-first-stamp-note` が無く `ayumi-legend-swatch` が 4 件、`useNearestPrefecture` のモックが 0 回呼ばれる。`stampCount: 0` でも、(a) `isLoading: true` (b) `error: 'x'` のときは `ayumi-first-stamp-note` が無く `ayumi-legend-swatch` が 4 件。ゲストは `ayumi-first-stamp-note` が無い（今のゲストのカード）
- [ ] AC-53: `GalleryScreen`（ログイン済み・並べる表示・0 枚）: `'参拝したら、ここに1枚ずつ並びます'` と `'御朱印がまだありません'` と `gallery-record-cta` がある。`queryByText(/コレクション/)` が null
- [ ] AC-54: `GoshuinchoPage` の白紙: `first` を渡すと `'最初の1枚を撮る'`、渡さないと `'次の1枚を撮る'`。どちらも `colors.gray[400]`・`typography.bodySmall.fontSize`（今の白紙の文字と同じ）。`queryByText('ここに御朱印を追加する')` が null
- [ ] AC-55: `GoshuinchoFlipView`: `stamps={[]}` で `'最初の1枚を撮る'` があり `'次の1枚を撮る'` が無い。御朱印 1 枚で `'次の1枚を撮る'` があり `'最初の1枚を撮る'` が無い

### UI基準（Expo Web・goshuin-evaluator）

手順は下の「Expo Web での確かめ方」。ログインしない（ゲスト）。地図の背景は Web ではスタブなので、カード・一覧・ボタンだけを見る。証跡は `.claude/harness/evidence/issue-327/`。

- [ ] UI-1: **カード（393×852）**: 地図タブで `[data-testid="first-stamp-card"]` が見える。`getBoundingClientRect()` の `left` 16・`right` 377（±1）、`[data-testid="map-screen"]` の `bottom` − カードの `bottom` が 16（±1）。見出しの `innerText` が「参拝したら、写真1枚で」「日本地図に。」の 2 行、下の行が「撮ると、京都府に色が差します」。`[data-testid="fab-button"]` が DOM に無い。カードが DOM に出てから 1500ms 後、`[data-testid="first-stamp-card-emboss"]` の `getComputedStyle(...).opacity` が `'1'`。`card-393.png`
- [ ] UI-2: **幅を変えても崩れない**: 375×667 と 440×956 でも開き直し、どちらでも ① 2 つのボタンの文字の要素の高さが 30 未満（1 行。`lineHeight` 20） ② 2 つのボタンの rect がカードの rect の内側 ③ 見出しの要素の高さが 50 以下（2 行）。`card-375.png`・`card-440.png`
- [ ] UI-3: **✕ で畳む・＋で戻る・開き直すとまた出る**: 録画しながら ✕ を押す。① 押してから 400ms までのコマで、カードが右下（＋の位置）へ向かって小さくなり、大きさが増えるコマが無い（弾まない） ② 800ms 後、カードが DOM に無く、`fab-button` の rect の `right` が 373（±1）・`map-screen` の `bottom` − `fab-button` の `bottom` が 20（±1）。＋を押すと 500ms 以内にカードが DOM に戻り、「ログインが必要です」は出ない。ページを読み込み直すとカードが出ている。`fold.webm`
- [ ] UI-4: **近くの寺社**: ［近くの寺社を見る］を押すと `[data-testid="region-sheet"]` が出て、見出しが「近くの寺社（N）」（N は 1〜5）・行が N 行。各行の距離の文字が `/^(\d+m|\d+\.\dkm)$/` に合い、m を km に直した値が上から順に減らず、どれも 50 以下。カードと＋は DOM に無い。`nearby.png`。0 行目を押すと `[data-testid="bottom-sheet"]` に 0 行目と同じ名前が出て、カードは DOM に無い
- [ ] UI-5: **行きたい → ログイン**: UI-4 の寺社のシートで「行きたい」を押すと「ログインが必要です」が出る。「あとにする」で閉じると、寺社のシートが出たままで、記録の画面（「この内容で記録する」）は出ない
- [ ] UI-6: **御朱印を撮る → ログイン**: 読み込み直して、カードの［御朱印を撮る］を押すと「ログインが必要です」が出る。「あとにする」で閉じるとカードが出たまま
- [ ] UI-7: **御朱印帳の白紙**: `http://localhost:8081/?preview=goshuincho` → 御朱印帳タブ（めくる表示）で、DOM に「次の1枚を撮る」があり、「ここに御朱印を追加する」が無い（DOM に無ければ、最後のページまでめくってから見る）
- [ ] UI-8: **視差効果を減らす**: `reducedMotion: 'reduce'` の新しいページで地図タブを録画する。カードは途中の位置・薄さのコマ無しに出て、空押しは最初から opacity 1。✕ を押すと小さくなるコマ無しに消える。`reduce.webm`
- [ ] UI-9: UI-1〜8 の間、ブラウザのコンソールに新しいエラーが出ない（既存の `useNativeDriver` の警告は除く）。`console.txt`

### 人間の確認（H。native-only。オーナーが実機で）

地図の背景・本物の位置情報・Apple／Google のログイン・カメラ・保存直後の画面（ログインが要る）は Web で見られない。手順は下の「オーナーの手順（H）」。

- [ ] H-1: ゲストの地図のカード（地図の背景の上の見え方・いる県の名前・空押し・出典の ⓘ・14pt のボタン）
- [ ] H-2: ✕ で＋へ畳む・＋で戻る・終了して開き直すとまた出る
- [ ] H-3: 近くの寺社 → 行きたい → Apple でログイン → 記録の画面へ行かず地図に留まり、行きたいの色になる
- [ ] H-4: 記録のある本アカウントで起動したとき、カードが一瞬も出ない
- [ ] H-5: 記録 0 枚のアカウントで、地図のカード・あゆみの一言・御朱印帳の 2 つの言葉
- [ ] H-6: 記録 0 枚のアカウントで 1 枚目を記録 → 保存直後に空押しから 0.6 秒で色が差す（点滅しない）→ 地図に戻るとカードが一瞬も出ず＋
- [ ] H-7（任意）: 視差効果を減らす

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: 依存を足していない: `git diff --name-only origin/develop...HEAD -- package.json package-lock.json` が空
- [ ] Q-5: 色の直値を足していない: `git diff origin/develop...HEAD -- src ':(exclude)src/**/__tests__/**' | grep -E "^\+.*['\"]#[0-9A-Fa-f]{3,8}['\"]"` が 0 行（テストでないファイルの、足した行だけを見る。今ある直値は数えない）
- [ ] Q-6: 止まらない動き・`Animated.delay` が無い: `grep -nE "Animated\.(loop|delay)|iterations" src/components/map/FirstStampCard.tsx src/components/common/PrefectureEmboss.tsx src/components/record/SaveMapReveal.tsx` が 0 件
- [ ] Q-7: 覚える・全体の状態を足していない: `git diff origin/develop...HEAD -- src | grep -E "^\+.*(AsyncStorage|createContext|zustand|redux)"` が 0 行
- [ ] Q-8: 古い言葉が残っていない: `grep -rn "コレクションを始めましょう\|ここに御朱印を追加する" src` が 0 件
- [ ] Q-9: 既存のテストを消していない: `git diff origin/develop...HEAD -- src | grep -E "^-\s*(it|test|describe)(\.each)?\("` が 0 行。`git diff origin/develop...HEAD -- src | grep -E "^-.*expect\("` の行は、どれも `ここに御朱印を追加する` を含む（「既存テストの扱い」の 2 か所だけ）
- [ ] Q-10: 動かす値: コードを読んで、`FirstStampCard`・`SaveMapReveal` の新しい動きで interpolate／`Animated.Value` をつないでいる style のキーが `opacity` と `transform`（`translateY`・`scale`）だけ、`fill` を動かしていない、新しい `Animated.timing` がすべて `useNativeDriver: true` であることを確かめる
- [ ] Q-11: 変えたファイルが次の中だけ: 「対象ファイル」の表のファイルとそれぞれのテスト・`docs/issues/issue-327-first-stamp.md`・`docs/design/mockups/2026-10-first-stamp-v1/` 以下・`.claude/harness/feature-list.json`・`.claude/harness/progress.md`・`.claude/harness/evidence/issue-327/` 以下（`.agents/`・`.codex/`・`AGENTS.md` を入れない）

## スライス（1スライス = 1コミット・TDD）

| #   | 中身                                                                                                                                                                                                         | 主な基準   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| S0  | 契約書と試作の写し（`index.html`・`assets.js`・`img/`）。`docs: #327 の契約書と、オーナーが選んだ試作を残す`                                                                                                 | —          |
| S1  | `firstStamp.ts`・`zoomToPrefecture` の固定倍率。`feat: 近くの寺社と今いる県を出す関数を足す (#327)`                                                                                                          | AC-1〜4    |
| S2  | `useUserStamps` の `isRefreshing`・`loadFailed`・切り替えの描画、`useWishlist`・`useSpots` の切り替えの描画。`feat: 記録・行きたい・寺社の取得が「取れた・失敗・取り直し中」を見分けられるようにする (#327)` | AC-5〜11   |
| S3  | `RegionSpotSheet` の `variant="nearby"`。`feat: 近くの寺社を近い順・距離つきで出す (#327)`                                                                                                                   | AC-12〜15  |
| S4  | `PrefectureEmboss`・`FirstStampCard`。`feat: 記録0枚の人に出す地図のカードを作る (#327)`                                                                                                                     | AC-16〜23  |
| S5  | `MapScreen` につなぐ（出し分け・✕・近くの寺社・ログインのきっかけ・戻った直後・出典）。`feat: 記録0枚の間だけ地図にカードを出す (#327)`                                                                      | AC-24〜41  |
| S6  | `SaveMapReveal` の `firstStamp`・`RecordCompleteScreen`。`feat: 1枚目の保存直後、県を空押しから色が差すようにする (#327)`                                                                                    | AC-42〜48  |
| S7  | `useNearestPrefecture`・`FirstStampNote`・あゆみ・御朱印帳の言葉。`feat: あゆみと御朱印帳の空の言葉を直す (#327)`                                                                                            | AC-49〜55  |
| S8  | goshuin-evaluator の Expo Web の確認の証跡・`feature-list.json` に ISSUE-327（未確認の H を note に）・`progress.md` に 1〜3 行。`docs: #327 の確認と記録`                                                   | UI-1〜9・Q |

## 手順

### Expo Web での確かめ方（goshuin-evaluator・UI-1〜9）

1. `npx expo start --web --port 8081`（要ネット: Supabase の寺社）
2. Playwright（chromium）の context を `viewport: { width: 393, height: 852 }`・`deviceScaleFactor: 3`・`locale: 'ja-JP'`・`geolocation: { latitude: 35.0037, longitude: 135.7788 }`（京都・八坂神社のあたり）・`permissions: ['geolocation']` で作る。UI-2 は viewport だけ替えて新しい context、UI-8 は `reducedMotion: 'reduce'` を足した新しい context
3. `http://localhost:8081` を開き、オンボーディングが出たら「スキップ」→「続ける」で地図へ。寺社を読み終えるまで 3 秒待つ
4. UI-3・UI-8 は `recordVideo`（`size` は viewport と同じ）。コンソールのメッセージは全部 `console.txt` に残す
5. 位置情報が Web で取れず下の行が「撮ると、その県に色が差します」になったら、UI-1 を不合格にせず止めて、その事実と `navigator.permissions.query({ name: 'geolocation' })` の結果を証跡に書き、リーダーに返す（UI-4 も同じ）

### オーナーの手順（H）

| #    | いつ                            | やること                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 準備 | H-1 の前                        | **ターミナルで** `cd /Users/kaiwajun/orca/workspaces/goshuin-app/first-stamp-327` → `./scripts/dev.sh`（2 分ほど待つ。正しく終わると `Dev tunnel ready` の下に `URL: https://…trycloudflare.com` が出る。`ERROR:` が出たらその行を伝えて止める）。iPhone の開発用アプリ（今のままでよい。ネイティブの変更は無い）で、その URL を開く（QR か「Enter URL manually」）                                                     |
| H-1  | 人間ゲート（push の前）         | 設定 → ログアウト → 地図タブ。① 地図の下にカード、右下の＋は無い ② 小さな日本地図で、今いる都道府県が 1 回だけうっすら浮き上がる（動き続けない） ③「撮ると、〇〇に色が差します」の〇〇が今いる都道府県 ④ 地図の左下の ⓘ（地図の出典）がカードの上に見えている ⑤ 2 つのボタンの字が 1 行に収まり、試作（16pt）より小さい 14pt で違和感がない                                                                             |
| H-2  | H-1 のあと                      | ✕ を押す → カードが右下へ縮んで＋になる（弾まない）→ ＋を押す → カードが戻る → アプリを完全に終了（画面の下から上へスワイプして止め、アプリを上へ払う）→ 開き直す（開発用アプリの最初の画面で、さっきの URL を押す）→ カードがまた出る                                                                                                                                                                                  |
| H-3  | H-2 のあと                      | ［近くの寺社を見る］→ 近い順・距離つきの一覧 → いちばん上を押す → 寺社のシート →「行きたい」→ Apple でサインイン（本アカウント）→ **記録の画面に行かず**地図のまま、その寺社のピンが青緑（行きたい）。本アカウントには記録があるので、カードは消えて＋になる。確かめたら、シートの「行きたい」をもう一度押して外す                                                                                                      |
| H-4  | H-3 のあと                      | アプリを完全に終了 → 開く（開発用アプリの最初の画面で、さっきの URL を押す）→ 地図に**カードが一瞬も出ず**＋だけ（記録はしない）                                                                                                                                                                                                                                                                                        |
| H-5  | 記録 0 枚のアカウントがあるとき | 設定 → ログアウト → 地図の［御朱印を撮る］→ 2 つ目の Google アカウント（記録 0 枚）でログイン → 記録の画面が開くので ✕ で閉じる。① 地図: カードが戻る ② あゆみ: 地図の下が「最初の1枚で、〇〇に色が差します。」（色の見本の行が無い） ③ 御朱印帳: 並べる表示「参拝したら、ここに1枚ずつ並びます」・めくる表示の白紙「最初の1枚を撮る」                                                                                  |
| H-6  | H-5 のあと                      | 地図の［御朱印を撮る］→ 写真（手元の御朱印帳でも、紙に書いた字でもよい。1 枚だけ）→ 保存 → 保存直後: 寄っている間にその県がうっすら浮き、ピンが落ちてから 0.6 秒かけて色が入る（点滅しない・弾まない）→「地図に戻る」→ **カードが一瞬も出ず**＋だけ。あゆみは色の見本の行に戻り、御朱印帳のめくる表示の最後は「次の1枚を撮る」。後片付け: 御朱印帳 → その 1 枚 → 削除（またはそのアカウントを 設定 → アカウントを削除） |
| H-7  | 任意                            | iPhone の「設定」→ アクセシビリティ → 動作 →「視差効果を減らす」をオン → ログアウトした地図でカードが動かずに出る・✕ ですぐ消える。終わったら元に戻す                                                                                                                                                                                                                                                                   |

**止める条件**: 赤い画面（エラー）か下に黄色・赤の帯（LogBox）が出たら、その 1 行目の文字をそのまま伝え、push しない。見た目・言葉で違和感があればそのまま伝える（直してから再確認）。2 つ目のアカウントが無く H-5・H-6 ができないときは、PR に「H-5・H-6 未確認（Jest の AC-42〜55 だけ）」と書き、feature-list の note にも残す（未確認を確認済みにしない）。

## やらないこと（スコープ外）／次の候補

- **案②（登録の直後に 1 回だけ出るシート）**: 作らない。オーナーは「結構いい」と言っている → **次の候補**（試作のタブ「案② 登録の直後のシート」。`LoadingBook` を 1 枚めくり「一」が空押しで浮く・「手元に御朱印がある／これから参拝する／あとで」）
- 案③のうち言葉以外: あゆみの［御朱印を撮る］［近くの寺社を見る］・あゆみの地図の空押し（`JapanMap` は変えない）・保存直後の出口「あゆみに戻る」 → 次の候補
- 2 枚目以降・「その県で初めて」の記録の空押し（`firstStamp` は記録全体の 1 枚目だけ） → 次の候補
- ✕ を覚える・「もう出さない」・AsyncStorage
- 近くの寺社を開いたときにカメラを寄せる・逆ジオコーディング（位置から住所を引く）・`useNearbySpots` の作り替え
- オンボーディング・`LoginPromptModal` の言葉（「行きたい」から開いても「御朱印を記録するには…」のまま）
- App Store のスクショ・キーワード（施策 B）・`e2e/flows/store-screenshots.yaml` の撮り直し・Maestro のフローの追加
- テーマのトークンの追加・新しい依存・ネイティブの変更
- `docs/design/ui-design.md`・`DESIGN.md`・過去の契約書の書き換え
- Android 固有の確認

## リスク・不確実な点／申し送り

- **カードが出るまでの待ち**: 位置情報が許可されているときは、位置と寺社を読み終えるまでカードも＋も出さない（D-3・D-5）。寺社の読み込みが遅い回線では、記録 0 枚の人の右下がしばらく空く。読み込みに失敗すれば県なしの言葉でカードが出る
- **取得の失敗は「出さない」側に倒す**: `useUserStamps` の最初の取得・あゆみの集計（`useCollectionStats` の `error`）が失敗したら、カード・一言を出さない。記録のある人に「最初の1枚で…」と言わないため
- **近くの寺社は地図の絞り込みに従う**: ログインしている人が「訪問済みのみ」に絞っていると、0 枚では近くの寺社が 0 件になりボタンが消える（県の名前は全寺社から出すので消えない）
- **50km の線**: 日本の外（App Store の審査を含む）や寺社の少ない所では、県なしの言葉・ボタン 1 つになる。線の値は `NEARBY_MAX_KM` の 1 か所
- **useAuth が画面ごとに別**: `MapScreen` と `useUserStamps`・`useWishlist` の中の `useAuth` は別の state。ログインの直後は同じ認証の出来事（`onAuthStateChange`）で同じ描画に揃う前提。D-7 は `MapScreen` の `isAuthenticated` と `useWishlist` の `isLoading`（D-9）の両方で待つ。H-3 で、ログイン直後に「行きたい」が入らない・入ったのにピンの色が戻る・二重に入る、があれば止める
- **地図の出典**: カードの間は ⓘ をカードの上へ上げる（D-12）。地域の一覧・近くの寺社の一覧が出ている間は、今と同じく一覧の下に隠れる（この契約では変えない）
- **ボタンの字の大きさ（14pt）**: 試作（16pt）との差。H-1 の ⑤ でオーナーが判断する。16pt に戻すなら、393pt 幅で収まる形（縦に 2 段・文言を短く）を別に決める
- **ストアのスクショ**: `e2e/flows/store-screenshots.yaml` は `clearState` のゲストで地図を撮るので、この変更のあとに撮ると地図にカードが写る（施策 B のスクショの作業で扱う）
- **版**: JS だけの変更（ネイティブのビルドは要らない）。どの版に載せるかはリリースの手順で決める（この契約の外）

## 決めてもらうこと（既定つき）

既定のまま実装してよい。H のときにオーナーが違うと言えば、fix のコミットで直す。

| #   | 何                         | 既定                                                                                                        | ほかの案                               |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | ✕ で畳んだあとの＋         | カードに戻す（試作どおり）                                                                                  | ＋はいつもどおり記録（ログイン）へ     |
| 2   | 県が分からないときの言葉   | カード「撮ると、その県に色が差します」（試作の説明のまま）／あゆみ「最初の1枚で、日本地図に色が差します。」 | どちらも「参拝した県」にする           |
| 3   | 御朱印帳の言葉             | 空の下の行「参拝したら、ここに1枚ずつ並びます」・白紙は 0 枚「最初の1枚を撮る」／1 枚以上「次の1枚を撮る」  | 白紙を枚数に関係なく 1 つの言葉にする  |
| 4   | カードのボタンの字         | 14pt（D-14）                                                                                                | 16pt で縦 2 段                         |
| 5   | 保存直後の空押しを出す記録 | 記録全体の 1 枚目だけ（オーナーの言葉どおり）                                                               | その県で初めての記録すべて             |
| 6   | 近くの範囲と距離の書き方   | 50km 以内・5 件・「350m」「1.2km」（`formatDistance`）                                                      | 試作の「0.1 km」の書き方               |
| 7   | あゆみ                     | 凡例の代わりの一言だけ（D-1）                                                                               | 試作の案③のとおりボタン 2 つと空押しも |
