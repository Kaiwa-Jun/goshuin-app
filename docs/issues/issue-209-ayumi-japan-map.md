# Issue #209: あゆみを日本地図にして、保存した県が色づくようにする

## 概要

あゆみ画面の集計カードと地域別セクションを、**本物の県境で描いた日本地図1枚**に置き換える。
県は御朱印の**枚数**で3段に濃くなり、タップするとその県の御朱印一覧（シートではなく**画面**）へ進む。
あわせて、保存直後の完了画面に**全国からその県へ寄って色づくミニ地図**を置く。

要件はすでに確定している（下記2本）。この契約書は**確定要件と実装から、機械チェック可能な受入基準を起こしたもの**で、
要件を作り直してはいない。実装はブランチ `feature/ayumi-map-v3`（`origin/develop..HEAD` で9コミット）に入っている。

各受入基準には **現状** を付けた。チェックボックスの意味は1つに固定する。

| 書き方                     | 意味                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| `[x]`                      | **自動テスト（または `npm` コマンド）がこの基準の中身を見ている** |
| `[ ]` + PASS（テスト無し） | 実装は満たしているが、壊れても気づけない                          |
| `[ ]` + **形だけ緑**       | テストは存在するが、基準の中身を見ていない                        |
| `[ ]` + **FAIL**           | 確定要件・承認デザインに対して未達。対応は呼び出し側の判断        |

⚠️ 「現状」は **2026-09-21 時点の `feature/ayumi-map-v3`** に対する判定。契約書の本体は AC の文面で、
現状欄は追認用。契約書を書いている間に E-6 / F-2 / G-4 が別作業で直っており、その3つは実測で追認済み。

## 関連ドキュメント

- 確定要件①（あゆみ）: [`docs/design/2026-09-ayumi-map-spec.md`](../design/2026-09-ayumi-map-spec.md)（v3。§0 に v2 からの差分）
- 確定要件②（保存直後）: [`docs/design/2026-09-record-complete-spec.md`](../design/2026-09-record-complete-spec.md)
- 承認デザイン: [`docs/design/mockups/2026-09-ayumi-v3-motion.html`](../design/mockups/2026-09-ayumi-v3-motion.html)（動きつき）
- 県境データの出どころ: [`docs/design/mockups/japan-paths.README.md`](../design/mockups/japan-paths.README.md)
- プロダクト方針: [`docs/product/direction.md`](../product/direction.md) / UI設計: [`docs/design/ui-design.md`](../design/ui-design.md)

### 仕様書のうち、承認デザインに追い越されている記述

②の仕様書に、承認デザイン（`2026-09-ayumi-v3-motion.html`）と食い違う行が2つ残っている。
**承認デザインを正とする**（実装もそちらに従っている）。

| ②仕様書の記述                      | 承認デザイン                 | 扱い                         |
| ---------------------------------- | ---------------------------- | ---------------------------- |
| ミニ地図は「132px幅」（§3 #5）     | `.minimap{width:210px}`      | 210px が正（E-16）           |
| ミニ地図の下に「13 / 47 都道府県」 | 保存直後カードにその行は無い | 出さないのが正（スコープ外） |

## 詳細設計

### 対象ファイル

| ファイル                                     | 役割                                                         |
| -------------------------------------------- | ------------------------------------------------------------ |
| `src/constants/japanMap.ts`                  | **生成物**。47県のパスと bbox（`scripts/gen-japan-map.mjs`） |
| `src/components/collection/JapanMap.tsx`     | あゆみの日本地図。塗り分け・塗り広がり・指の操作             |
| `src/components/collection/RecentVisits.tsx` | 最近の参拝（直近3件）                                        |
| `src/screens/CollectionScreen.tsx`           | 地図カード・凡例・縦スクロールの制御                         |
| `src/screens/PrefectureDetailScreen.tsx`     | 県別**画面**（シートではない）                               |
| `src/hooks/usePrefectureStamps.ts`           | 県別画面のデータ                                             |
| `src/services/collection.ts`                 | `fetchRegionStats` に `stampCount` を追加                    |
| `src/services/stamps.ts`                     | `fetchStampsByPrefecture` / `fetchAllStamps(limit)`          |
| `src/utils/japanMapZoom.ts`                  | 寄りと指の操作の**純関数**                                   |
| `src/utils/completeMapParams.ts`             | 完了画面へ渡す値の組み立て                                   |
| `src/components/record/SaveMapReveal.tsx`    | 保存直後のミニ地図（全国 → 寄る → ピン → 色づく）            |
| `src/screens/RecordCompleteScreen.tsx`       | 御朱印と地図を主役にした完了画面                             |
| `src/theme/colors.ts`                        | `colors.prefectureFill`（4段 + 境）                          |

### 実装方針

- 県境は **Natural Earth**（`ne_10m_admin_1_states_provinces`、Open Data Commons PDDL = パブリックドメイン）。
  アプリに同梱するのでライセンスを理由に選んだ。Wikimedia の県地図（CC BY-SA が多い）は使わない
- 状態管理は既存どおり**カスタム hooks + ローカル state のみ**。新しいグローバル状態は入れない
- ジェスチャは `PanResponder`（RN 標準）。`react-native-gesture-handler` は入れない
- 動きは `Animated`（`useNativeDriver`）。Reanimated / Lottie / Rive は入れない

### データ構造

```ts
// src/services/collection.ts
interface RegionStat {
  prefecture: string;
  visitedCount: number; // spot_id で重複排除した箇所数
  stampCount: number;   // 御朱印の枚数。**地図の濃さはこちら**
  totalCount: number;   // その県の寺社の総数（県別画面の分母）
}

// src/navigation/types.ts — RecordComplete に追加された params
visitedAt?: string;                              // YYYY-MM-DD のまま
spotType?: 'shrine' | 'temple';                  // ピンの色
prefecture?: string;                             // 寄る先
isFirstInPrefecture?: boolean;                   // チップの出し分け
stampCountByPrefecture?: Record<string, number>; // 今回のぶんを足した状態
totalStampCount?: number;                        // 通算の枚数
```

### 画面仕様

**あゆみ**（`MainTabs > CollectionTab > CollectionList`）

1. 地図カード（`ayumi-map-card`）: 上部の数字 → 地図 → 凡例
2. 最近の参拝（`recent-visits-section`、直近3件）
3. 獲得バッジ（従来のまま）
4. 巡礼チャレンジ（従来のまま）

**県別**（あゆみ → 県をタップ → `CollectionStack > PrefectureDetail`）
ヘッダー（戻る + 正式名）→ 県の形74px + 集計 → 3列グリッド → タップで `ImageGalleryModal`。

**保存直後**（記録 → 保存 → `RecordComplete`）
白カードに 御朱印150px → 通算の枚数 → （この日N枚）→（はじめてチップ）→ ミニ地図210px → 寺社名・日付 →（バッジ）。

## テスト方針

- 計算（濃さの段・塗る順・寄り・ピンチの倍率・移動量の頭打ち）はすべて**純関数**に出し、単体テストで見る
- 色は `react-native-svg` が ARGB 数値に正規化するので、期待値も同じ形に変換して比べる
- 動きは fake timers + `AccessibilityInfo.isReduceMotionEnabled` のモックで、**節目の状態**だけ見る

### ピンチを単体テストしていないことの扱い（妥当と判断する）

ピンチの動きそのもの（指を広げたら寄る）は単体テストしていない。
`PanResponder` のハンドラを直接呼ぶには内部の `touchHistory` を作り込む必要があり、
**実装ではなく PanResponder の形に依存したテスト**になるため。代わりに、

- 倍率（`pinchScale`）・移動量の頭打ち（`clampPan`）・つまんだ点を軸にする補正（`panForPinch`）・
  距離（`touchDistance`）は**純関数として全部テスト済み**
- 「指を横取りするかどうか」は `onMoveShouldSetPanResponder` を述語として直接呼んでテスト済み

**この切り分けは妥当**。ただし境界を明記する: `now.current.scale` は `apply` 経由でしか変わらず、
`apply` は PanResponder の move からしか呼ばれないので、**`scale > ZOOMED_AT` の側にある分岐は
すべて単体テストの外にある**（寄っているときの一本指移動 / 触れた瞬間のスクロール停止 / 「全体に戻す」の
出現と復帰 / 4px のしきい値）。「ピンチ」の一語でこの4つを代表させない。**個別に I 群へ置く**。

---

## 受入基準（Acceptance Criteria）

### A. 地図データ（`src/constants/japanMap.ts`）

- [x] **A-1**: `JAPAN_PREFECTURE_NAMES` が `src/utils/regionBlocks.ts` の `REGION_BLOCKS.flatMap(b => b.prefectures)` と
      **過不足なく一致する**（両方向。ソートして完全一致）。DB の `spots.prefecture` と突き合わせるため、
      「京都」「京都府」のような表記ゆれがあると県ごとの集計が静かに消える
      — 検証: `src/constants/__tests__/japanMap.test.ts`「regionBlocks の47県と過不足なく一致する」／**現状 PASS**
- [x] **A-2**: 47県すべてが `JAPAN_PREFECTURE_PATHS`（`/^M[\d.\s LMZ]+Z$/`）と `JAPAN_PREFECTURE_BOXES` を持ち、
      bbox が viewBox `0 0 1000 1132` の内側に収まる — 同上ファイル／**現状 PASS**
- [x] **A-3**: 東京の bbox に小笠原が入っていない（`tokyo.height < kanagawa.height * 3` かつ
      `tokyo.y < kanagawa.y + kanagawa.height`）。入ると保存直後のカメラが太平洋の真ん中を指す
      — 同上ファイル／**現状 PASS**
- [x] **A-4**: 北→南の並びが地理と一致する（`y(北海道) < y(東京都) < y(鹿児島県) < y(沖縄県)`）
      — 同上ファイル／**現状 PASS**
- [ ] **A-5**: `japanMap.ts` の冒頭に「このファイルは生成物。手で直さない（`node scripts/gen-japan-map.mjs`）」と
      出どころ（Natural Earth / PDDL）が書かれている — 検証: `head -20 src/constants/japanMap.ts`／**現状 PASS（テスト無し）**

### B. 色に載せる意味は「枚数」ひとつだけ

- [x] **B-1**: 濃さの境目が **0 / 1〜2 / 3〜5 / 6枚〜** の4段。`prefectureTier(0)='empty'`、
      `(1)=(2)='tier1'`、`(3)=(5)='tier2'`、`(6)='tier3'`。2と3、5と6で必ず段が変わる
      — 検証: `src/components/collection/__tests__/JapanMap.test.tsx`／**現状 PASS**
- [x] **B-2**: 濃さの基準は**御朱印の枚数であって箇所数ではない**。同じ寺社に2回通い別の寺社に1回なら
      `visitedCount: 2, stampCount: 3` が返り、地図は `stampCount` を読む
      — 検証: `src/services/__tests__/collection.test.ts`「同じ寺社に2回通うと、箇所数は2でも枚数は3になる」
      ＋ `CollectionScreen` が `regionStats.map(s => [s.prefecture, s.stampCount])` を渡す／**現状 PASS**
- [x] **B-3**: `colors.prefectureFill` のキーが `border / empty / tier1 / tier2 / tier3` の**5つだけ**。
      枚数以外の意味を持つ色が増えていない — 検証: `src/theme/__tests__/theme.test.ts`／**現状 PASS**
- [x] **B-4**: 色の値が `empty: #E3E4E8` / `tier1: primary[300] (#FDBA74)` / `tier2: primary[500] (#f27f0d)` /
      `tier3: primary[700] (#C2410C)` / `border: #FFFFFF`、県境の太さは viewBox 単位で 2
      — 検証: `theme.test.ts` ＋ `JapanMap.tsx` の `strokeWidth={2}`／**現状 PASS**
- [x] **B-5**: **「いちばん新しい」を地図に出していない**。あゆみ配下に「いちばん新しい」の文言が無く、
      `fetchRegionStats` は `latestVisitedAt` / `latestCreatedAt` / `latestPrefecture` を返さない
      — 検証: `CollectionScreen.test.tsx`「「いちばん新しい」を地図に出さない」＋
      `grep -rn "latestVisitedAt\|latestCreatedAt\|latestPrefecture" src/` が空／**現状 PASS**
- [x] **B-6**: 凡例が**枚数の段**で、左から `まだ {47 - 塗られた県数}` / `1〜2枚` / `3〜5枚` / `6枚〜` の4つ
      — 検証: `CollectionScreen.test.tsx`「凡例が枚数の段になっている」／**現状 PASS**
- [ ] **B-7**: 凡例の4つのスウォッチ（`ayumi-legend-swatch`）の `backgroundColor` が、左から
      `prefectureFill.empty / tier1 / tier2 / tier3` と**順番どおりに一致する**
      — **現状 形だけ緑**: いまのテストは個数（4つ）と文言しか見ておらず、色が入れ替わっても緑のまま
- [x] **B-8**: 地図カード上部が 左「塗られた県数」34px/900 +「/ 47 都道府県」13px、右「通算の枚数」+「枚」。
      0件なら「0」「まだ 47」で、イラストや説明文で埋めない（`御朱印を記録すると地域別の統計が表示されます` が無い）
      — 検証: `CollectionScreen.test.tsx`「0件でも47県の地図を出し、説明文で埋めない」／**現状 PASS**
- [x] **B-9**: 旧構成が残っていない（`これまでの達成` / `御朱印（枚）` / `地域別` / `北海道・東北` のいずれも画面に無い）
      — 検証: `CollectionScreen.test.tsx`「集計カードと地域別セクションが無い」／**現状 PASS**
- [x] **B-10**: 未ログインでは地図を出さず、`collection-guest-empty-state` が受ける
      — 検証: `CollectionScreen.test.tsx`／**現状 PASS**

### C. 指の操作（地図アプリと同じ作法）

- [x] **C-1**: **二本指で拡大縮小**できる。倍率は指の距離の比に比例し、下限1倍（全体より小さくしない）・
      上限8倍（`MAX_SCALE`） — 検証: `src/utils/__tests__/japanMapZoom.test.ts`（`pinchScale`）／**現状 PASS**
- [x] **C-2**: **全体表示（scale ≤ 1.01）の一本指は横取りしない**。`onMoveShouldSetPanResponder` が
      1本指 + `{dx:0, dy:40}` で `false` を返す（返すと画面の縦スクロールが死ぬ）
      — 検証: `JapanMap.test.tsx`「全体表示の一本指では、指の動きを横取りしない」／**現状 PASS**
- [x] **C-3**: 二本指なら全体表示でも引き取る（`onMoveShouldSetPanResponder` が `true`）
      — 検証: 同上「二本指なら、全体表示でも引き取る」／**現状 PASS**
- [x] **C-4**: 寄っているときだけ一本指で移動でき、移動量は `clampPan` で枠内に収まる
      （拡大した地図が枠を必ず覆い、外の地が見えない。全体表示では `{x:0, y:0}` に固定）
      — 検証: `japanMapZoom.test.ts`（`clampPan`）／**現状 PASS（純関数のみ。述語の zoomed 側は I-2）**
- [x] **C-5**: **地図に触れている間は親の縦スクロールを止める**。二本指が触れた時点（動き出す前）で
      `onInteraction(true)`、指が全部離れたら `(false)`、同じ値は二度伝えない、操作中に unmount しても必ず `(false)` を出す
      — 検証: `JapanMap.test.tsx`「親のスクロールを止める」4件／**現状 PASS**
- [x] **C-6**: 全体表示の一本指では `onInteraction` を呼ばない（縦スクロールを止めない）
      — 検証: 同上「全体表示の一本指では止めない」／**現状 PASS**
- [x] **C-7**: `CollectionScreen` が合図を受けて `ayumi-scroll` の `scrollEnabled` を false/true に切り替える
      — 検証: `CollectionScreen.test.tsx`「地図からの合図で縦スクロールを止め、戻す」／**現状 PASS**
- [ ] **C-8**: 寄っているときだけ `japan-map-reset`（「全体に戻す」）が出て、押すと 380ms で
      scale=1 / pan=(0,0) に戻る — **現状 PASS（テスト無し）**。`scale > ZOOMED_AT` の側にあるため単体では踏めない → **I-4**

### D. 県別は「シート」ではなく「画面」

- [x] **D-1**: あゆみで県をタップすると `navigate('PrefectureDetail', { prefecture })` で**画面**へ進む。
      `CollectionStack` に `PrefectureDetail` が登録され、`presentation: 'modal'` 等のシート指定が無い
      — 検証: `CollectionScreen.test.tsx`「県をタップすると県別の画面へ進む」＋ `src/navigation/CollectionStack.tsx`／**現状 PASS**
- [x] **D-2**: 御朱印をタップすると `ImageGalleryModal` が `visible: true` / `initialIndex: タップした位置` で開き、
      **全画面ビューアが入れ子になっていない**（`useModal` が `undefined`）。あゆみからは編集・削除に入れない
      （`onEdit` / `onDelete` が `undefined`）
      — 検証: `PrefectureDetailScreen.test.tsx`「御朱印をタップすると、その1枚から全画面で開く」／**現状 PASS**
- [x] **D-3**: ヘッダーに戻るボタン（`prefecture-back` → `goBack`）と正式名（例「東京都」）が出る
      — 検証: 同上「見出しは正式名で、戻る導線がある」／**現状 PASS**
- [x] **D-4**: 県の形を 74px の**正方形** viewBox で描く（幅=高さ、県の中心と枠の中心が一致、まわりに余白が残る）。
      比を揃えないと描画側の解釈任せになり、実機で県の左が切れた
      — 検証: 同上「squareViewBox」2件／**現状 PASS**
- [x] **D-5**: 集計が「N枚」と「x / y箇所」で、**画面に出ている一覧と同じ元から数える**
      （3枚・2箇所の一覧なら「3枚」「2 / 20箇所」）。枚数0なら「まだ御朱印がありません」で箇所数を出さない
      — 検証: 同上「枚数と箇所数を、一覧と同じ元から数える」／**現状 PASS**
- [x] **D-6**: 御朱印は3列グリッド（`aspectRatio: 3/4`）、`testID` は `prefecture-stamp-{id}`。
      縮小版が無ければ元の写真に落として表示を続ける
      — 検証: 同上「縮小版が無ければ、元の写真に落として出し続ける」／**現状 PASS（列幅31.5%はテスト無し）**
- [x] **D-7**: 未訪問の県は**行き止まりにしない**。「この県の寺社を見る」（`prefecture-see-spots`）が
      `MapTab > Map` へ `{ focusPrefecture: 県名 }` で渡す
      — 検証: 同上「行き止まりにせず、地図への導線を出す」／**現状 PASS**
- [x] **D-8**: その県のデータ取得は1回だけ（`fetchStampsByPrefecture` が1度）
      — 検証: 同上「その県で1回だけ取りに行く」／**現状 PASS**

### E. 保存直後（②）

- [x] **E-1**: 地図の順序が **全国 → 寄る → ピン → 色づく**。寄り終わるまで今回の県は `empty` のままで、
      ピンが落ちきってから tier 色になる（他県は最初から色がついている）
      — 検証: `SaveMapReveal.test.tsx`「寄り終わってから、その県が色づく」／**現状 PASS**
- [ ] **E-2**: 時刻が `HOLD_MS=560` / `ZOOM_MS=1100`（`Easing.out(cubic)`）/ `PIN_MS=520`
      — 検証: `SaveMapReveal.tsx` の定数／**現状 PASS（体感は I-8）**
- [x] **E-3**: 寄りは①のタップ時と**同じ計算**（`zoomToPrefecture`、`REGION_SPAN=5.5`、`MIN_SCALE=1.8`）を使う
      — 検証: `japanMapZoom.test.ts`／**現状 PASS**
- [ ] **E-4**: ピンは地図タブと**同じ雫型**（`scripts/generate-map-pins.py` の実寸: viewBox 84×120、
      頭 `cx42 cy44 r34`、尾 `23,54 61,54 42,112`、白フチ `r41.5`）で、地図の縮尺で伸び縮みしない
      — 検証: `SaveMapReveal.tsx` の Svg ／**現状 PASS（テスト無し）**
- [ ] **E-5**: ピンの色が寺社の種別に合う（`spotType='shrine'` → `colors.pin.shrineVisited (#DC2626)` /
      `'temple'` → `colors.pin.templeVisited (#9333EA)`）
      — **現状 形だけ緑**: `SaveMapReveal.test.tsx`「ピンの色を寺社の種別に合わせる」は
      `polygons.length > 0` と `getByTestId('save-map-pin')).toBeTruthy()` しか見ておらず、
      **色を一度も比べていない**。神社と寺を取り違えても緑のまま
- [x] **E-6**: **ピンの尾の先が、寄せたあとのその県の上に来る**（尾の先の画面座標
      `left + 幅/2, top + 高さ` が、同じ変換で写したその県の位置と一致する）。
      `東京都` だけでなく **`沖縄県`・`鹿児島県`・`北海道`** でも成り立つ
      — 背景: ピンを枠の中心に固定すると、`zoomToPrefecture` が端の県で移動量を頭打ちにするぶん県から外れる。
      幅210pxでの実測: **沖縄県** は県が画面 x59〜93 / y194〜237 にあるのにピンは (105, 119) で**完全に外**、
      **鹿児島県** も x43〜73 / y174〜213 に対して外。**北海道**は bbox の内側だが下端から6px（本体の南の海）で境界例。
      承認デザインは頭打ちをせず、ピン位置を寄りと**同じ変換から計算**している
      — **現状 PASS（契約書作成中に修正された）**: `prefectureScreenPoint` が追加され、
      `SaveMapReveal.test.tsx`「端の県でも、ピンがその県の上に来る」と
      `japanMapZoom.test.ts`「prefectureScreenPoint」2件が見ている
- [x] **E-7**: `countUnavailable` のとき、**大きい数字（`stamp-total`）も地図（`save-map`）も出さない**。
      御朱印・寺社名・日付は出し、注記「通信エラーのため記録数を表示できません」（`visit-count-unavailable`、
      `colors.gray[500]` / `typography.caption.fontSize`）を1行添える
      — 検証: `RecordCompleteScreen.test.tsx`「取得に失敗したら、数字も地図も出さない」／**現状 PASS**
- [ ] **E-8**: `countUnavailable` のとき、**「はじめて」チップ（`first-in-prefecture`）も出さない**
      — **現状 FAIL + 形だけ緑**: 描画条件が `isFirstInPrefecture && prefecture` だけで
      `!countUnavailable` のガードが無い。`visitedSpotIds` と `regionStats` は別々の取得なので
      `countUnavailable: true` と `isFirstInPrefecture: true` は同時に起こりうる。
      いまの countUnavailable テストはルートに `isFirstInPrefecture` を入れていないので踏めていない
- [x] **E-9**: 県が分からない（`prefecture` が `undefined`）ときは地図を出さない
      — 検証: `RecordCompleteScreen.test.tsx`「県が分からなければ地図を出さない」／**現状 PASS**
- [x] **E-10**: その県が初めてのときだけチップ「🗾 {県名}、はじめて」を出す
      — 検証: 同上「その県が初めてのときだけチップを出す」／**現状 PASS**
- [x] **E-11**: 大きい数字は**通算の枚数**（`totalStampCount` + 「枚目」、36px/900）。
      まとめ登録のときは別行に「この日 N枚」。両者を混ぜない
      — 検証: 同上「通算の枚数を大きく出す」「まとめ枚数と通算の枚数を混ぜない」／**現状 PASS**
- [x] **E-12**: 完了画面に渡す値は **`RecordScreen.save()` から渡す**（完了画面では取りに行かない）。
      今回のぶんを足した `stampCountByPrefecture` と `totalStampCount` を渡し、
      集計が取れなければ地図の params ごと渡さない
      — 検証: `src/utils/__tests__/completeMapParams.test.ts` 3件／**現状 PASS**
- [ ] **E-13**: `fetchRegionStats` を **`form.submit()` より前**に呼び、**失敗しても保存を止めない**
      （祝っている最中に地図の色が後から変わらないようにするため）
      — **現状 形だけ緑**: 実装（`RecordScreen.tsx`）は満たしているが、`RecordScreen.test.tsx` は
      `fetchRegionStats` を `[]` に固定するだけで、**呼ぶ順序も reject 時の挙動も見ていない**。
      呼び出しが `submit()` の後ろに移ると `isFirstInPrefecture` が常に false になるが、テストは緑のまま
- [x] **E-14**: 御朱印が主役。`ConfettiEffect`（`confetti-effect`）・`CheckmarkAnimation`（`checkmark-animation`）・
      見出し「登録完了！」が**どれも無い**。写真は150px幅 3:4、無ければ `stamp-image-placeholder`
      — 検証: `RecordCompleteScreen.test.tsx`「チェックマークと紙吹雪を出さない」／**現状 PASS**
- [x] **E-15**: 参拝日は `YYYY-MM-DD` のまま渡して和暦で出す（`new Date()` を挟まない。Issue #204 の1日ずれ）
      — 検証: 同上「参拝日を和暦で出す（DATE のまま渡す）」／**現状 PASS**
- [ ] **E-16**: ミニ地図の幅は **210px**（承認デザイン `.minimap{width:210px}`）
      — 検証: `RecordCompleteScreen.tsx` の `MAP_WIDTH`／**現状 PASS（テスト無し）**
- [ ] **E-17**: 通算の枚数が **33 → 34 に数え上がる**（②§4「同時」・承認デザインは 90ms 刻み）
      — **現状 FAIL（未実装）**: `totalStampCount` を静止したまま描いている
- [ ] **E-18**: その県が2回目以降のとき、色づく瞬間に**朱で光らせる**
      （承認デザイン: `@keyframes flash{0%,100%{fill:brand300}35%{fill:#DC2626}}` を 0.5s×2、最後は tier 色に落ち着く）
      — **現状 FAIL（未実装）**: `tierOf` は settle 後にそのまま tier 色へ切り替えるだけで、朱の点灯が無い。
      ⚠️ 範囲は②§5「2回目以降」に合わせたが、**承認デザインは初回か2回目かに関わらず光らせている**
      （`LATEST` に無条件で `'v1 flash'`。試作の東京は2回目以降）。どちらで実装するかは呼び出し側の判断
- [ ] **E-20**: 御朱印の写真が**影で浮いている**（②§3 #1「150px幅・3:4・影で浮かす」、
      承認デザイン `.sstamp{box-shadow:0 10px 26px rgba(17,24,39,.22)}`）。
      検証は `StyleSheet.flatten(getByTestId('stamp-image').props.style)` が `shadows` トークンの値を持つこと
      — **現状 FAIL（未実装）**: `styles.stampImage` に影が無く、白カードの上で写真が平らに乗っている（軽微）
- [x] **E-19**: バッジは御朱印カードの**後**に出す（`BadgeAnimation` が `badge` のときだけ）
      — 検証: 同上「バッジは御朱印と地図のあとに出す」／**現状 PASS**

### F. 塗り広がりと再生の条件（①§4-3）

- [x] **F-1**: 県が**南から北へ1県ずつ**塗られる（`REVEAL_STEP_MS = 90`、viewBox の y が大きい順）。
      沖縄 → 東京 → 北海道 の順になる — 検証: `JapanMap.test.tsx`「revealOrder」「animate のとき、南から順に塗られる」／**現状 PASS**
- [ ] **F-2**: **画面を離れて戻るたびには再生しない**。枚数が変わっていなければ、戻ったとき県は塗られたまま
      （①§4-3「フォーカスのたびではなく、データが変わったときだけ」）
      — 背景: `useCollectionStats` は `useFocusEffect` で毎フォーカス取り直すので `regionStats` の identity が
      毎回変わり、`animate={!isLoading}` も false→true に振れる。中身が同じでも再生し直していた
      — **現状 PASS（契約書作成中に修正された）だが テスト無し**: `JapanMap` が塗った県ぶれ（`signature`）を
      ref で覚える形になり、実測で再生しないことを確認した。`JapanMap.test.tsx` は未更新なので、
      戻したら気づけない。**追加するテスト**: 中身の等しい別インスタンスの `Map` で rerender しても
      `prefecture-沖縄県` が `tier2` のままであること
- [ ] **F-3**: 塗り広がりと**同時に上部の数字も増える**（①§4-3「上部の数字も同時に増える」、
      承認デザインは `#cnt` が 0 から数え上がる）
      — **現状 FAIL（未実装）**: `CollectionScreen` は `visitedPrefectureCount` を最初から確定値で描く（軽微）

### G. アクセシビリティ

- [ ] **G-1**: 県ごとに読み上げが枚数を持つ（`accessibilityLabel` が `{県名}、{N}枚` / 未訪問は `{県名}、まだ`）。
      色だけで段を区別させない — **現状 PASS（テスト無し）**: `JapanMap.test.tsx` に a11y の assertion が1つも無い
- [ ] **G-2**: 県に `accessibilityRole="button"` が付く（①§7）
      — **現状 FAIL**: `JapanMap.tsx` の `Path` は `accessible` と `accessibilityLabel` だけで role が無い
- [ ] **G-3**: **地図のコンテナ（`japan-map`）に `accessible` を付けない**（`accessible === false`）。
      付けると47県が1要素にまとめられ、県ごとの読み上げが消える
      — **現状 PASS（テスト無し）**。⚠️ 仕様①§7 はこれと同時に「地図全体に
      `accessibilityLabel`「47都道府県のうち12県」」も求めているが、RN では `accessible={false}` の View の
      ラベルは読まれないので**両立しない**。実装は「県ごとの読み上げを優先し、全体ラベルは属性として残す」を選んでいる。
      実機での実際の読み上げは **I-9** で確認する
- [x] **G-4**: 保存直後のミニ地図の読み上げが「{県名}がいま色づきました。47都道府県のうちN県」（②§8）
      — **現状 PASS（契約書作成中に修正された）**: 以前は `{県名}が色づきました` で「いま」と県数が欠けていた。
      `SaveMapReveal.test.tsx`「読み上げで、どの県が色づいたか分かる」が見ている
- [x] **G-5**: 「はじめて」チップは色だけで意味を持たせない（🗾 と文言の両方を持つ）
      — 検証: `RecordCompleteScreen.test.tsx`（文字列 `🗾 東京都、はじめて`）／**現状 PASS**
- [x] **G-6**: 動きを減らす設定（`AccessibilityInfo.isReduceMotionEnabled`）が真なら、
      あゆみの地図は**最終状態を即座に出し**、保存直後の地図は**寄り終わった状態を即座に出す**
      — 検証: `JapanMap.test.tsx` / `SaveMapReveal.test.tsx` 各1件／**現状 PASS**
- [x] **G-7**: 4段（empty / tier1 / tier2 / tier3）がどのペアも知覚上離れている
      （通常 ΔE ≥ 20、deutan・protan ≥ 18）。意味が1つなのでリング等の補いは要らない
      — 検証: `src/theme/__tests__/theme.test.ts` 2件／**現状 PASS**

### H. 依存とドキュメント

- [x] **H-1**: **新しい依存は `react-native-svg` 1つだけ**。
      `git diff origin/develop..HEAD -- package.json` の `dependencies` 追加行が
      `"react-native-svg": "15.12.1"` の1行のみ — **現状 PASS**
- [x] **H-2**: `react-native-reanimated` / `lottie-react-native` / `rive-react-native` /
      `react-native-gesture-handler` を入れていない（`grep` で `package.json` に無い）— **現状 PASS**
- [x] **H-3**: 県境データがパブリックドメイン（Natural Earth / ODC PDDL）で、出どころと変換手順が
      `docs/design/mockups/japan-paths.README.md` に書かれている — **現状 PASS**
- [ ] **H-4**: **使われない値を残さない**（①§6 が `latest*` を消した理由と同じ）。
      `latest*` は削除済みだが、`visitCount` が `src/navigation/types.ts` に型として残り、
      `src/screens/RecordScreen.tsx:229` から渡され続けているのに `RecordCompleteScreen` が読んでいない
      — **現状 FAIL**: 検証は `grep -rn "visitCount" src/` の結果が「渡す側と読む側が揃っている」こと
- [ ] **H-5**: `docs/design/ui-design.md` §4.8 が v3 を書いている
      — **現状 FAIL**: 「正方形のマス」「いちばん新しい県だけ朱 + リング」「シートで出る」「Issue #208」「v2 の mockup」が
      そのまま残っており、v3 の決定（本物の県境 / 最新を外す / 画面）と食い違う。
      検証: `grep -n "タイルマップ\|リング\|シートで出る\|ayumi-map-v2" docs/design/ui-design.md` が空

### Q. 品質基準

- [x] **Q-1**: 全テストが通る（`npm test`）
- [x] **Q-2**: Lint エラーがない（`npm run lint`）
- [x] **Q-3**: 型エラーがない（`npm run typecheck`）

---

## I 群: Expo Web で検証できない項目（native-only）

Expo Web は `metro.config.js` で react-native-maps をスタブに解決しており、ジェスチャ・VoiceOver・
ネイティブ SVG の描画は確認できない。下記は**実機（EAS development build）**または **Maestro フロー**で見る。
`react-native-svg` を足したので、**dev build の焼き直しが1回要る**（`eas build --profile development --platform ios`）。

| ID       | 見ること                                                                                                         | 検証方法                            |
| -------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **I-1**  | 二本指で広げると寄る・つまんだ場所が軸になる（PanResponder の内部に依存するため単体テスト無し）                  | 実機                                |
| **I-2**  | 寄っているとき一本指で地図を動かせる（`scale > 1.01` 側の分岐）                                                  | 実機                                |
| **I-3**  | 全体表示では縦スクロールが効き、地図に触れている間だけ止まり、指を離すと戻る                                     | 実機                                |
| **I-4**  | 寄ると「全体に戻す」が出て、押すと380msで全体へ戻る（C-8）                                                       | 実機                                |
| **I-5**  | 4px のしきい値でタップと移動が切り分かる（軽いタップで県が選べ、なぞると移動になる）                             | 実機                                |
| **I-6**  | あゆみ → 県タップ → 県別画面 → 御朱印タップで**全画面ビューアが見切れずに開き、閉じられる**（v2 の差し戻し理由） | **Maestro フロー**（`e2e/` に追加） |
| **I-7**  | 地図タブの未訪問ピン `#FB923C` と、あゆみの1〜2枚 `#FDBA74` を並べて紛れないか（①§7）                            | 実機                                |
| **I-8**  | 保存直後の 0.56s → 1.1s → 0.52s が「寄ってから落ちる」に見えるか。ピンが縮尺で伸び縮みしないか                   | 実機                                |
| **I-9**  | VoiceOver で県が1つずつ読まれるか。全体ラベル「47都道府県のうちN県」が読まれるか（G-3 の両立不能）               | 実機                                |
| **I-10** | 県別画面の県の形が、長崎・鹿児島・沖縄・北海道で本体だけになり豆粒に潰れていないか                               | 実機                                |
| **I-11** | 焼き直した dev build で 47県の SVG が実機のスクロール中もカクつかないか                                          | 実機                                |
| **I-12** | 動きを減らす設定 ON の実機で、あゆみも保存直後も最終状態が即出るか                                               | 実機                                |

---

## 未達の一覧 → 対応済み（2026-09-21）

契約書を起こした時点の未達を、そのまま潰した。**残したのは2件だけ**。

| ID   | 内容                                            | 対応                                                                                                                                |
| ---- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| E-6  | 端の県でピンが県から外れる                      | ✅ `prefectureScreenPoint()` を足して、**寄せたあとの県の位置**に刺す。端の県は移動量を頭打ちにしていて中心まで寄り切らないのが原因 |
| E-8  | `countUnavailable` でも「はじめて」チップが出る | ✅ 地図と同じ条件で出さない（嘘を祝わない）                                                                                         |
| E-17 | 枚数が数え上がらない                            | ✅ 地図が色づく合図（`onSettled`）に合わせて 90ms 刻みで数え上げる                                                                  |
| E-20 | 御朱印に影が無い                                | ✅ 影は枠側に置く（`Image` に影は乗らない）                                                                                         |
| F-2  | 戻るたびに塗り広がりが再生する                  | ✅ 塗る県が同じなら動かさない。テストも追加                                                                                         |
| F-3  | 上の数字が増えない                              | ✅ `onRevealed` で塗り広がりに合わせて増やす。凡例の「まだ」も揃う                                                                  |
| G-4  | 読み上げが仕様より短い                          | ✅ 「◯◯県がいま色づきました。47都道府県のうちN県」                                                                                  |
| H-4  | `visitCount` が読まれないまま渡り続ける         | ✅ 型・実装・テストから削除                                                                                                         |
| H-5  | `ui-design.md` §4.8 が v2 のまま                | ✅ v3 に更新                                                                                                                        |
| E-5  | ピンの色を比べていない（形だけ緑）              | ✅ 神社=朱 / 寺=紫 を実際に比べる                                                                                                   |
| E-13 | 取得の順と失敗時の挙動を見ていない（形だけ緑）  | ✅ `fetchRegionStats` → `submit` の順と、失敗しても保存が止まらないことを固定                                                       |
| B-7  | 凡例スウォッチの色を見ていない（形だけ緑）      | ✅ 4つの色を並び順で比べる                                                                                                          |
| G-1  | 県ごとの読み上げを見ていない                    | ✅ テスト追加                                                                                                                       |
| G-3  | コンテナの `accessible === false` を見ていない  | ✅ テスト追加                                                                                                                       |

### 残したもの（理由つき）

| ID   | 内容                            | 判断                                                                                                                                                                           |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G-2  | 県に `accessibilityRole` が無い | **react-native-svg の `Path` が受け付けない**（型にも無い）。読み上げは `accessible` + `accessibilityLabel` で届くので、「ボタン」と付かないのは**既知の天井**として受け入れる |
| E-18 | 2回目以降の県が朱で光らない     | ②§5 は「ピンが落ちて、その県が1段濃くなる」で、そのとおり実装してある。試作にあった朱の点滅は**仕様として採らなかった**（実機で確認して良いと判断された動きに入っていない）    |

## スコープ外（やらないこと）

契約書に無いことは実装しない。

- 他人との比較・ランキング・シェアボタン・SNS 投稿導線
- 「何県制覇」の煽り。**塗られていない県を責めない**
- 地図に「いちばん新しい」を出すこと（①§0）。県の達成率（「28/35」）をあゆみのトップに出すこと
- 県名ラベルを県の上に出すこと（本物の県境なら形で分かる。47個の文字は密になる）
- 県別画面の集計に「・いちばん新しい」を添えること（承認デザインの試作に残っているが、①§0 で外した情報）
- ミニ地図の下に「13 / 47 都道府県」を出すこと（承認デザインに無い）
- 沖縄の全島（与那国〜南大東）を描くこと。本島の2%より小さい島を描くこと
- 「最近の参拝」を3件より増やすこと（①§10 で「3件で始める」と決めた）
- `react-native-svg` 以外の依存を足すこと（Reanimated / Lottie / Rive / gesture-handler）
- グローバル状態管理の導入
- 地図を有料機能にすること。`docs/product/direction.md` の収益化はコア体験（記録・地図・ギャラリー・
  コレクション）を**永久無料**と決めており、買い切りの「統計・分析強化」はこの地図の先の話
- 「連続◯日」「今日のノルマ」の類い

## 注意事項

- **県名は DB の `spots.prefecture` と文字列で突き合わせる**。`japanMap.ts` は生成物なので、
  直すときは `scripts/gen-japan-map.mjs` を直して作り直す。A-1 のテストが表記ゆれを止める唯一の関所
- **県別をシートに戻さない**。モーダルの中に全画面ビューアを入れ子にすると、ビューアがシートを基準に
  レイアウトを組んでボタンが見切れ、シートが伸びてヘッダーが押し出され行き止まりになる（どちらも実機で出た）
- **`Animated.delay` を使わない**。イージングを渡せず既定の `Easing.ease` になり、その遅延 `require` が
  `jest.resetModules()` のあとに発火すると、**無関係なテスト**が `_bezier is not a function` で落ちる。
  `jest.setup.js` で先に `Easing.ease(0)` を呼んで覚えさせてある
- **画面から外れたらタイマーと Animated を必ず止める**。止めたまま外れると、`onInteraction(true)` のまま
  親のスクロールが死ぬ（`JapanMap` の cleanup が `onInteraction(false)` を出している）
- `visited_at` は DATE 型。`new Date()` を挟むと Issue #204 と同じ1日ずれを踏む
- **既存の `useReduceMotion` を使っていないのは意図的**。あの hook は `false` から始めて後から真値に
  差し替わるので、開いた瞬間に動き出す演出（塗り広がり・寄り）では「一瞬動いてから止まる」になる。
  ここは値を**得てから**始める必要があるため `AccessibilityInfo.isReduceMotionEnabled()` を直に呼んでいる。
  検証: `grep -rn "isReduceMotionEnabled" src/components src/screens` の結果が
  `JapanMap.tsx` と `SaveMapReveal.tsx` の2箇所に限られること（他の演出は `useReduceMotion` のまま）
