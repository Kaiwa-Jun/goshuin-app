# Issue #213: オンボーディング4画面を、本物の動きにする

## 概要

オンボーディングの4スライドの絵を、**アプリの中で実際に動いているもの**に置き換える。
いまは MaterialIcon（地図 / カメラ / トロフィー / ピン）を色つきの角丸96pxに載せているだけで、
このアプリが何をするものかを1つも見せていない。

| #   | いま                          | これから                                                                    |
| --- | ----------------------------- | --------------------------------------------------------------------------- |
| 1   | `map` アイコン（オレンジ）    | **47県が南→北に塗られていく日本地図**（あゆみ画面と同じ塗り広がり）         |
| 2   | `camera-alt` アイコン（紫）   | **彫った御朱印 → 引っ込む → 地図 → 東京にピンが刺さる**（保存直後と同じ筋） |
| 3   | `emoji-events` アイコン（黄） | **`Seal` が6つ、順に押される**（#212 の印そのもの）                         |
| 4   | `place` アイコン（緑）        | **波紋＋近くのピン**（地の色は実際の地図スタイルから）                      |

絵と間（ms）と文言は、承認済み試作 `docs/design/mockups/2026-09-onboarding.html` と
`docs/design/mockups/2026-09-goshuin-art.html` が**そのまま実装になる**。
**この契約書は図形も間も作り直していない**。承認された動きから、機械チェック可能な受入基準を起こしたもの。

⚠️ このブランチは `feature/issue-212-badge-seal` の上に積んでいる。`src/components/common/Seal.tsx` に依存する。

## 関連ドキュメント

- **承認デザイン（正）**: [`docs/design/mockups/2026-09-onboarding.html`](../design/mockups/2026-09-onboarding.html)
  — `SLIDES` の `art()` / `play()` と `HINTS`、`svgPin`、`goSumi`、`goshuinSvg` が実装すべきもの
- **御朱印の彫り（正）**: [`docs/design/mockups/2026-09-goshuin-art.html`](../design/mockups/2026-09-goshuin-art.html) — `nib` / `tick` / `sumi` / `goshuin`
- 印: [`docs/issues/issue-212-badge-seal.md`](./issue-212-badge-seal.md)（`Seal` の API と `colors.seal` / `colors.washi` / `colors.sumi`）
- 地図の塗り: [`docs/issues/issue-209-ayumi-japan-map.md`](./issue-209-ayumi-japan-map.md)、`src/components/collection/JapanMap.tsx`
- 保存直後の演出: `src/components/record/SaveMapReveal.tsx`（ピンの形・置き方・タイマーの畳み方の先例）
- 審査に関わる遷移: [`docs/design/ui-design.md`](../design/ui-design.md) §3「初回起動フロー」（**§4.1 の表はこの Issue で追い越される**）
- プロダクト方針: [`docs/product/direction.md`](../product/direction.md)

### 承認デザイン・既存ドキュメントとの食い違い（この契約書を正とする）

調査で見つかった食い違い。**黙って直さない**ため、ここに全部出す。どれも1行で反転できる。

| #   | 出どころ                                     | そこの記述                              | この契約書での扱い                                                                                                                                                                                                                                 |
| --- | -------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 試作 `cta` の文言                            | 最終スライドのボタンが `許可して始める` | **`続ける` のまま変えない**。2026-08-10 の審査で落ちた文言が「位置情報を許可して始める」で、試作の文字列はその2文字違い。既存テスト4件・`e2e/flows/smoke.yaml`・`ui-design.md` §3 も `続ける`。**審査に触る変更を絵の Issue でやらない**（AC G-4） |
| 2   | 試作 `pin()` のコメント                      | 「雫型のピン。地図タブと同じ形」        | **アプリの実際のピンは雫型ではない**（丸頭＋白フチ＋尾。`scripts/generate-map-pins.py` / `SaveMapReveal.tsx`）。決定事項1「アプリの中で動いているものをそのまま出す」を優先し、**アプリの形**を使う（AC D-5 / F-7）                                |
| 3   | 試作 2枚目のピンの色                         | `var(--seal)`（#C2342B）                | 保存直後のピンと同じ `colors.pin.shrineVisited`（#DC2626）。試作の意図（朱っぽい赤）とずれない                                                                                                                                                     |
| 4   | 試作 4枚目のピンの色                         | 2本が `--seal`、1本が `#9333EA`         | **`colors.pin.unvisited`（#FB923C）を3本**。4枚目は「まだ行っていない近くの寺社」で、アプリはそれを未訪問1色で出す（神社/寺の区別もつけない）。決定事項1に寄せる                                                                                   |
| 5   | 試作 `.pref{transition:fill .5s}`            | 塗りが0.5秒かけて変わる                 | **県ごとに即座に切り替える**。RN は SVG の `fill` をネイティブドライバで動かせない。`JapanMap` も `SaveMapReveal` も即座の切り替えで、46ms 刻みで塗ると同じ絵になる                                                                                |
| 6   | 試作 `.mapbg{mask-image:radial-...}`         | 地図の地が円形にぼけて消える            | **`borderRadius: 125` の丸窓**（くっきり切る）。放射マスクには `@react-native-masked-view` が要る＝新しい依存。決定事項7に反する                                                                                                                   |
| 7   | 試作 `goStamp(190,24,36,5,ring(25.5,7.6,0))` | 小さい朱印の点が `r=7.6`                | `Seal mark="mangan"`（`r=6.6`）を使う。100単位の viewBox で1単位差、実寸36pxで0.36px。**彫りを2本持たない**方を取る                                                                                                                                |
| 8   | 試作 3枚目のコメント                         | 「バッジ行と同じ間（170ms）」           | `BADGE_STEP_MS` は **150**（#212）。試作の主張は誤りだが、**間は試作の 170ms を正とする**（決定事項: 試作の ms がそのまま実装）。`BADGE_STEP_MS` は触らない                                                                                        |
| 9   | 決定事項5「地の色は map-style.json から」    | 道 `#dddddd` / 地 `#fafafa`             | **その値のまま使う**。ただし `assets/map-style.json` でその2色が付いているのは鉄道レイヤで、実際の地の色は `rgb(242,243,240)`、道は白＋`hsl(0,0%,88%)`。承認値を優先し、出どころだけ注記する                                                       |
| 10  | 試作 4枚目の細い道 `#e8e8e8`                 | 7px の道と 3px の細い道で色が違う       | **細い道も `colors.mapGround.road`（#dddddd）**。`#e8e8e8` は map-style.json に無い。太さ（7 / 3）で差が出る                                                                                                                                       |
| 11  | `ui-design.md` §4.1 の表                     | アイコン名・背景色・旧タイトル4行       | この Issue の内容に書き換える（S5）。§3 の遷移フローは**1文字も変えない**                                                                                                                                                                          |

## 詳細設計

### 対象ファイル

| ファイル                                                     | 役割                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `src/components/onboarding/sumi.ts`                          | **新規**。`nib` / `tick` / `SUMI_STROKES`（16本の `d`）。React を import しない純粋な計算  |
| `src/components/onboarding/Goshuin.tsx`                      | **新規**。御朱印1枚（和紙＋刷毛目＋墨16本＋`Seal` 2つ）                                    |
| `src/components/onboarding/OnboardingArt.tsx`                | **新規**。4枚ぶんの絵・`useSteps`・`PrefectureMap`・間の定数・`pinTip`                     |
| `src/components/onboarding/__tests__/sumi.test.ts`           | **新規**。墨の本数・点の数・先頭座標                                                       |
| `src/components/onboarding/__tests__/OnboardingArt.test.tsx` | **新規**。4枚の絵と `Goshuin`（fake timers）                                               |
| `src/screens/OnboardingScreen.tsx`                           | `slides` を差し替え、`active` を渡す。**skip / CTA / 権限リクエストの流れは1行も触らない** |
| `src/screens/__tests__/OnboardingScreen.test.tsx`            | 絵をモックし、`onboarding-icon` の assert を差し替える。**審査に関わる7件はそのまま**      |
| `src/navigation/__tests__/RootNavigator.test.tsx`            | 絵をモックする（実タイマーを他のテストへ持ち込まない）                                     |
| `src/components/animated/OnboardingIcon.tsx`                 | **削除**                                                                                   |
| `src/components/__tests__/animated.test.tsx`                 | `OnboardingIcon` の import と describe を削除                                              |
| `src/theme/colors.ts`                                        | `colors.mapGround`（地図の地5色）と `colors.washiGrain` を足す                             |
| `src/theme/__tests__/theme.test.ts`                          | `mapGround` の値が `assets/map-style.json` に実在することを見る                            |
| `docs/design/ui-design.md`                                   | §4.1 の4スライド表を書き換える（§3 は触らない）                                            |

**`e2e/flows/smoke.yaml` は変更しない**（食い違い#1 により `スキップ` / `続ける` / `あとで設定する` の assert がそのまま生きる）。

### 実装方針

- 依存は**増やさない**。`react-native-svg`（既存）と RN の `Animated` だけ。ネイティブ変更が無い＝この Issue に EAS ビルドは要らない
- 色は `src/theme/colors.ts` のトークン経由。直値を書かない（`mapGround` / `washiGrain` はこの Issue で足す）
- 状態は**カスタム hooks とローカル state のみ**（CLAUDE.md）。新しいグローバル状態を入れない
- `useReduceMotion()` を尊重する。オンなら**最終状態を即座に出す**（出るものは出る。動きだけ消す）

#### `JapanMap` を流用せず、専用の描画を起こす（判断1）

**流用しない。** ただし**重複するのは描画の殻（`<Svg>` と `<Path>` の写経 ≒ 25行）だけ**で、意味のあるものは全部共有する。

| 共有するもの                                                  | 重複するもの                      |
| ------------------------------------------------------------- | --------------------------------- |
| `JAPAN_PREFECTURE_PATHS` / `JAPAN_PREFECTURE_NAMES`（県境）   | `<Svg viewBox>` と `map()` の囲い |
| `JAPAN_PREFECTURE_BOXES`（ピンの座標の出どころ）              | `stroke` / `strokeWidth` の指定   |
| `revealOrder()`（南→北の並べ方。`JapanMap` から import する） |                                   |
| `colors.prefectureFill`（3段の濃さ＋`empty`＋`border`）       |                                   |

流用しない理由は `JapanMap` が**オンボーディングに要らないものを必ず連れてくる**から:

1. `onPressPrefecture` が必須。オンボーディングの絵は**押せてはいけない**（押すと県の詳細へ行ける口ができる）
2. `PanResponder` のピンチ・ドラッグを持っている。**横スクロールの FlatList の中**に置くと、2本指とドラッグをどちらが取るかの喧嘩になる
3. `REVEAL_STEP_MS = 90` × 47県 = **4.2秒**。試作は 46ms 刻みで 2.4秒。`JapanMap` の間を変えるとあゆみ画面の演出が変わる
4. 濃さが `stampCountByPrefecture`（枚数）から決まる。オンボーディングには枚数が無く、**試作が決めた固定の並び**で塗る
5. 「全体に戻す」ボタン・a11y ラベル（`47都道府県のうち◯県`）が付いてくる。決定事項2の「数字は出さない」と正面から衝突する

**先例がある**: `SaveMapReveal.tsx` は既に同じ理由で47本の `<Path>` を自前で描いている（`JapanMap` は使っていない）。
この Issue はその3本目ではなく、`OnboardingArt.tsx` の中に**内部コンポーネント `PrefectureMap({ fills, width })` を1つ置いて、1枚目と2枚目で共有する**。

#### 墨の `d` は実行時に `nib()` で計算する（判断2）

**焼かない。** `sumi.ts` の**モジュール読み込み時に1回**計算して `SUMI_STROKES` に入れる。

- 量が小さい。16本 × 27点 = 432点、出力7.8KB。`Array.from` と `Math.hypot` だけで、起動時間に出る規模ではない
- 焼くと**生成スクリプトが1本増え**（`scripts/gen-*.mjs`）、生成物と生成器がずれる余地ができる。`japanMap.ts` は県境7万字ぶんの外部データなので焼く価値があるが、こちらは自前の式16行
- `nib()` が残っていれば、**運びを1本足すのが数値4組**で済む。焼くと毎回スクリプトを回すことになる
- 計算が壊れたことは `SUMI_STROKES` の先頭座標の固定（AC A-3）で気づける。焼いた場合と同じだけ機械チェックできる

#### `OnboardingIcon` は削除する（判断3）

この Issue のあと `OnboardingIcon` を使う画面が無くなる。使われないコンポーネントを残すのは、
次に読む人に「どこかで使われている」と思わせるだけの負債。`animated.test.tsx` の import と 4行の describe も一緒に消す
（**あのテストは「レンダリングできる」以上のことを見ていない**ので、消しても失われる検証は無い）。

### データ構造（新しく公開する API）

```ts
// src/components/onboarding/sumi.ts
/** 三次ベジェを刻んで、接線の法線方向に太さを振った可変幅ストローク（閉じた path の d） */
export function nib(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  wIn: number,
  wOut: number,
  n?: number // n の既定は 26
): string;
/** 短い点。打ち込みだけの画（内部で n=10 の nib） */
export function tick(x: number, y: number, dx: number, dy: number, w: number): string;
/** 墨書16本。240×320 の紙の上の座標。**読める字ではない** */
export const SUMI_STROKES: readonly string[];

// src/components/onboarding/Goshuin.tsx
/** 御朱印1枚。240×320 を width に合わせて縮める */
export function Goshuin({ width }: { width: number }): JSX.Element;

// src/components/onboarding/OnboardingArt.tsx
interface ArtProps {
  /** いま画面に出ているスライドか。true になった最初の1回だけ再生する */
  active: boolean;
}
export function MapFillArt(props: ArtProps): JSX.Element; // 1枚目
export function RecordArt(props: ArtProps): JSX.Element; // 2枚目
export function SealsArt(props: ArtProps): JSX.Element; // 3枚目
export function NearbyArt(props: ArtProps): JSX.Element; // 4枚目

/** ピンの先端が来る場所（地図の viewBox の座標）。県の枠の中心 */
export function pinTip(prefecture: string): { x: number; y: number };

/** active になってから marks[] の節目を越えた数。reduce motion なら即 marks.length。
 *  一度進んだら戻さない（スワイプで戻っても出し直さない） */
function useSteps(active: boolean, marks: readonly number[], reduceMotion: boolean): number;

/* 間（ms）。すべて試作の値 */
export const MAP_START_MS = 260,
  MAP_STEP_MS = 46;
export const SHOT_IN_MS = 200,
  SHOT_OUT_MS = 1250,
  MINIMAP_MS = 1600,
  PIN_DROP_MS = 2150;
export const SEAL_START_MS = 280,
  SEAL_STEP_MS = 170;
export const NEAR_START_MS = 600,
  NEAR_STEP_MS = 260;
```

```ts
// src/theme/colors.ts に足す
/**
 * 地図の地。出どころは assets/map-style.json（オンボーディング4枚目で
 * 「アプリの地図」に見せるため、絵の色ではなく実際のスタイルの色を使う）
 */
mapGround: {
  base: '#fafafa',   // 地
  water: '#A9CFE8',  // 水
  park: '#D2E7CB',   // 公園
  wood: '#C3DCBA',   // 緑地
  road: '#dddddd',   // 道
},
/** 和紙の刷毛目。washi の上に 2.5% で重ねる縦のむら */
washiGrain: '#6B5B4A',
```

### 画面仕様

到達: **アプリ初回起動 → `Onboarding`**（`onboarding_completed` が未設定のときだけ `RootNavigator` が出す）。

各スライドの構成は変えない（上に絵、下にタイトル・説明、フッタにドットとボタン）。差し替えるのは**絵と文言**だけ。

| #   | タイトル（`\n` で改行）                  | 説明                                           | 絵の testID             |
| --- | ---------------------------------------- | ---------------------------------------------- | ----------------------- |
| 1   | `集めるたび、\n地図があなたの旅になる。` | `訪れた県が濃くなっていきます`                 | `onboarding-art-map`    |
| 2   | `写真を1枚。\nそれだけ。`                | `撮ると、地図にピンが刺さります`               | `onboarding-art-record` |
| 3   | `続けると、\n印が増えていく。`           | `訪問数だけでなく、通い方や季節でも`           | `onboarding-art-seals`  |
| 4   | `近くの寺社を\n見つけます。`             | `許可すると、まわりの神社やお寺が地図に出ます` | `onboarding-art-nearby` |

絵の高さ: `ART_HEIGHT = Math.min(360, SCREEN_HEIGHT * 0.42)`（試作の 400 は 844pt 前提。iPhone SE の 667pt では
タイトルとボタンを押し出す）。地図は**高さ基準**で描き、幅は `ART_HEIGHT * 1000 / 1132`。

**1枚目**（`MapFillArt`）

- 47県ぜんぶを `revealOrder(JAPAN_PREFECTURE_NAMES)`（南→北）の順に塗る。`MAP_START_MS + i * MAP_STEP_MS`
- 濃さは試作の固定並び `['tier1','tier2','tier1','tier3','tier1','tier2','tier2','tier1','tier3','tier2'][i % 10]`
- まだの県は `colors.prefectureFill.empty`、境目は `border` を `strokeWidth={2}`（`JapanMap` と同じ）
- **数字を出さない**

**2枚目**（`RecordArt`）

1. `SHOT_IN_MS`: 御朱印（168×224、角丸14、`shadows.lg`）が下から 550ms で出る（opacity 0→1 / translateY 24→0 / scale .94→1）
2. `SHOT_OUT_MS`: 450ms で引っ込む（opacity 1→0 / scale 1→.6 / translateY 0→−14）
3. `MINIMAP_MS`: 地図が 500ms でフェードインする（全県 `empty` のまま）
4. `PIN_DROP_MS`: ピンが 500ms で刺さる。**先端が東京都の座標に来る**

ピンは**地図と同じ `<Svg>` の中**に置く。`%` 指定は実寸に依存して海に落ちる。
置き場所は `pinTip('東京都')` ＝ `JAPAN_PREFECTURE_BOXES['東京都']` の中心 `(627.25, 754.4)`
（試作の手書き値 `(627, 754)` と一致する。**定数を書かず県の枠から引く**ので、県境データを焼き直しても海に落ちない）。

**3枚目**（`SealsArt`）: `Seal`（`earned`、`size=76`）を `['ichi','go','juu','mangan','shiki','mitsu']` の順に
3列グリッド（幅264、行間22・列間14）。`SEAL_START_MS + i * SEAL_STEP_MS` に 420ms で押す
（scale 2.1→.93→1 / rotate −8deg→−2deg→0deg / opacity 0→1→1、節目は 55%）。

**4枚目**（`NearbyArt`）: 250×250 の丸窓（`borderRadius: 125`）に地図の地。中心は `MapPin type="current-location"`（既存）。
波紋3本（`colors.primary[500]`、`borderWidth: 2`、2400ms のループ、遅延 0 / 800 / 1600、46→250px、opacity .55→0）。
近くのピン3本を `NEAR_START_MS + i * NEAR_STEP_MS` に落とす（左30/上50、右20/上85、左65/下25）。

## テスト方針

- 図形は `react-native-svg` のプリミティブの数と `d` 文字列で見る。ピクセル比較はしない
- 色は ARGB に正規化されるので、期待値も変換して比べる（`Seal.test.tsx` / `JapanMap.test.tsx` と同じ `asPayload`）
- 間は `jest.useFakeTimers()` ＋ `act(() => jest.advanceTimersByTime(ms))` で節目の前後を見る
- `nib` / `SUMI_STROKES` / `pinTip` は**純粋な計算**として単体テストで見る（画面を通さない）
- **画面のテストは絵をモックする**。`OnboardingScreen.test.tsx` と `RootNavigator.test.tsx` で
  `jest.mock('@components/onboarding/OnboardingArt')` を置き、素の `View` に差し替える。
  モックは `active` を**表に出す**こと（`<View testID="onboarding-art-map" accessibilityState={{ selected: active }} />`）。
  出さないと AC G-7 / G-8 が画面から検証できない。
  47本のタイマーと `Animated.loop` を**審査に関わるテストの中に持ち込まない**（1本でも生き残ると別のテストの最中に発火する）
- **native-only は「位置情報の許可ダイアログ」だけ**。絵は全部 Expo Web で見える（`react-native-svg` も `Animated` も web で動く）。
  スワイプでのスライド送りは Web では確認できない（ボタンでの送りは確認できる）

### 書き直しが要る既存テスト

| ファイル                                          | 箇所                                          | 直し方                                                                                    |
| ------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/screens/__tests__/OnboardingScreen.test.tsx` | `renders onboarding icons`                    | `onboarding-icon` は消えるので、`onboarding-art-map` 等の存在に差し替える（AC G-1 / G-2） |
| 同上                                              | ファイル先頭                                  | `jest.mock('@components/onboarding/OnboardingArt')` を足す                                |
| 同上                                              | **審査に関わる7件**（下記）                   | **1文字も変えない**。文言も testID も変えないので、手を入れる必要が無い                   |
| `src/components/__tests__/animated.test.tsx`      | `OnboardingIcon` の import と describe（4行） | 削除                                                                                      |
| `src/navigation/__tests__/RootNavigator.test.tsx` | ファイル先頭                                  | `jest.mock('@components/onboarding/OnboardingArt')` を足す（実タイマー対策）              |

**絶対に壊さない7件**（`OnboardingScreen.test.tsx`。App Store Guideline 5.1.1(iv) に直結する）:

1. `displays skip button`
2. `hides skip button on last slide so the only way out is the permission request`
3. `does not leave onboarding when skip is pressed`
4. `requests location permission when "続ける" is pressed on last slide`
5. `calls completeOnboarding and navigates when "続ける" is pressed`
6. `calls completeOnboarding even when location permission is denied` / `... throws`
7. `offers no way to skip the permission request on the last slide`

⚠️ このうち4〜6（テストケースとしては4件。6は2件ある）は `getByText('続ける')` に依存している。**だから食い違い#1 で文言を変えない**。
変える判断をするなら、この4件と `e2e/flows/smoke.yaml` と `ui-design.md` §3 を同時に変え、審査観点で別途レビューすること。

## 受入基準（Acceptance Criteria）

### A. 墨書（`src/components/onboarding/sumi.ts`）

- [ ] **A-1**: `SUMI_STROKES.length === 16`（右の列4 ＋ 中央4 ＋ 左の列8）
- [ ] **A-2**: 16本すべてが `M` で始まり ` Z` で終わり、`NaN` / `undefined` を含まない
- [ ] **A-3**: 先頭座標が試作と一致する。`SUMI_STROKES[0].startsWith('M194.6 39.5')` / `SUMI_STROKES[4].startsWith('M111.9 60.2')`
- [ ] **A-4**: 既定の `nib()` は**54点**（`d.split('L')` の長さが 54 ＝ 27点 × 左右）、`tick()` は**22点**。
      `SUMI_STROKES` のうち `tick` 由来の5本（index 7・8・10・12・14）が22点、残り11本が54点
- [ ] **A-5**: `tick(156, 76, 9, 16, 5.0)` の戻り値が `'M153.8 77.2 L154.7 78.7L...'` で始まり、`'L158.2 74.8 Z'` で終わる
- [ ] **A-6**: `sumi.ts` は `react` も `react-native` も import しない（純粋な計算）

### B. 御朱印（`src/components/onboarding/Goshuin.tsx`）

- [ ] **B-1**: `within(getByTestId('onboarding-sumi')).UNSAFE_queryAllByType(Path)` が**16本**（墨書。`SUMI_STROKES` と同じ `d`）。
      刷毛目の `Rect` が**22本**（`x = i × 11.4` / `width = 1.4 + (i % 5) × 0.9`）で、その `G` は `opacity={0.025}` / `fill` が `colors.washiGrain`
- [ ] **B-2**: 紙の地は `colors.washi`（`#EFEAE0`）、墨の `G` は `fill` が `colors.sumi`（`#2B2622`）で `opacity={0.92}`
- [ ] **B-3**: `Seal` が**2つ**（`seal-frame` が2つ）。どちらも `mark="mangan"` / `earned` / `opacity={0.88}`
- [ ] **B-4**: `width=168` のとき、大きい印は `{ left: 46.2, top: 105, width: 75.6 }` で `transform` に `{ rotate: '-6deg' }`、
      小さい印は `{ left: 133, top: 16.8, width: 25.2 }` で `{ rotate: '5deg' }`（240×320 の座標 × 0.7）
- [ ] **B-5**: `Goshuin` は `Text`（RN / SVG とも）を**1つも描かない**。墨は読める字ではなく、寺社の名前も日付も書かない

### C. 1枚目 — 地図が埋まる（`onboarding-art-map`）

到達: 初回起動 → オンボーディング1枚目（最初に出る画面）

- [ ] **C-1**: `prefecture-{県名}` が**47本**。`d` は `JAPAN_PREFECTURE_PATHS` の値と一致
- [ ] **C-2**: `MAP_START_MS === 260` / `MAP_STEP_MS === 46`。`active` になってから 259ms では塗られた県が0、
      260ms で1（沖縄県）、2376ms（260+46×46）で47
- [ ] **C-3**: 塗る順は `revealOrder(JAPAN_PREFECTURE_NAMES)`。先頭5つが `沖縄県 / 鹿児島県 / 宮崎県 / 熊本県 / 長崎県`、
      末尾が `北海道`
- [ ] **C-4**: 塗り終わりの濃さが `['tier1','tier2','tier1','tier3','tier1','tier2','tier2','tier1','tier3','tier2'][i % 10]`。
      実値で: 沖縄県 `#FDBA74` / 鹿児島県 `#f27f0d` / 熊本県 `#C2410C` / 東京都 `#FDBA74` / 北海道 `#f27f0d`
- [ ] **C-5**: まだの県は `colors.prefectureFill.empty`（`#E3E4E8`）、`stroke` は `colors.prefectureFill.border`（`#FFFFFF`）で `strokeWidth={2}`
- [ ] **C-6**: **数字を出さない**。`onboarding-art-map` の中に `Text` が0個で、画面全体でも `queryByText(/47/)` と `queryByText(/都道府県/)` が null
- [ ] **C-7**: 県の `Path` に `onPress` が無い（絵は押せない）
- [ ] **C-8**: `useReduceMotion()` が true のとき、`active` 直後（0ms）に47県すべてが塗られている

### D. 2枚目 — 写真1枚 → ピン（`onboarding-art-record`）

到達: 1枚目 →「次へ」→ 2枚目

- [ ] **D-1**: 間の定数が `SHOT_IN_MS === 200` / `SHOT_OUT_MS === 1250` / `MINIMAP_MS === 1600` / `PIN_DROP_MS === 2150`
- [ ] **D-2**: 順番が守られている。199ms では御朱印も地図もピンも見えない（opacity 0）／750ms で御朱印だけ（地図 opacity 0）／
      2100ms で地図が見えて御朱印が消えている／2650ms でピンが見えている
- [ ] **D-3**: `pinTip('東京都')` が `{ x: 627.25, y: 754.4 }`（= `JAPAN_PREFECTURE_BOXES['東京都']` の中心。
      四捨五入すると試作の `(627, 754)`）。**座標リテラルを書かず県の枠から計算していること**を、
      `pinTip` が `JAPAN_PREFECTURE_BOXES` の値から導かれる（全県で `box.x + box.width/2` に一致する）ことで見る
- [ ] **D-4**: ピンは地図と**同じ `<Svg>`（同じ viewBox）の中**にある。`onboarding-pin` は
      `onboarding-minimap` の `Svg` の子孫で、絶対配置の `View` ではない
- [ ] **D-5**: ピンの形はアプリの地図ピンと同じ（丸頭＋白フチ＋尾）。`Circle` 2つ（白 `#FFFFFF` / 色）と
      `Polygon` 2つ（白 / 色）で、色は `colors.pin.shrineVisited`（`#DC2626`）。**雫型（`M12 0C5.4 0 ...`）は使わない**
- [ ] **D-6**: ピンの先端（84×120 の形の**下端の中央**）が `pinTip('東京都')` に来る。
      `s = 0.7` で地図の viewBox 単位に直すと 58.8×84 なので、置き方は `translate(627.25 − 29.4, 754.4 − 84) scale(0.7)`
      ＝ `translate(597.85 670.4) scale(0.7)`。**この数を直接書かず `pinTip()` と `s` から計算する**
      （`left + 29.4 === tip.x` / `top + 84 === tip.y` を assert する）
- [ ] **D-7**: 地図の47県はすべて `colors.prefectureFill.empty`（2枚目では塗らない）
- [ ] **D-8**: `useReduceMotion()` が true のとき、0ms で「御朱印が消え・地図が見え・ピンが刺さった」最終状態
- [ ] **D-9**: 御朱印は `<Goshuin width={168} />`（角丸14 / `shadows.lg` の枠に入る）

### E. 3枚目 — 印が押される（`onboarding-art-seals`）

到達: 2枚目 →「次へ」→ 3枚目

- [ ] **E-1**: `Seal` が6つ、`['ichi','go','juu','mangan','shiki','mitsu']` の順。すべて `earned` で `size={76}`
      （`seal-frame` が6つ、`seal-mark` が6つ）
- [ ] **E-2**: `SEAL_START_MS === 280` / `SEAL_STEP_MS === 170`。279ms で0個、280ms で1個、
      1130ms（280+170×5）で6個が出ている（未出は opacity 0）
- [ ] **E-3**: コンテナ幅 `264` に**3列**。行間 `22` / 列間 `14`（＝1セル 78.7 に 76 の印が乗る）
- [ ] **E-4**: 押す動きが scale `2.1 → 0.93 → 1` / rotate `-8deg → -2deg → 0deg`（`inputRange` が `[0, 0.55, 1]`）、420ms
- [ ] **E-5**: `useReduceMotion()` が true のとき、0ms で6つとも見えている（opacity 1・scale 1）

### F. 4枚目 — 近くの寺社（`onboarding-art-nearby`）

到達: 3枚目 →「次へ」→ 4枚目（＝最終スライド。`skip-button` が消える）

- [ ] **F-1**: 地の色が `colors.mapGround`。`base` `#fafafa` / `water` `#A9CFE8` / `park` `#D2E7CB` / `wood` `#C3DCBA` / `road` `#dddddd`。
      道は `stroke` が `road` で `strokeWidth` が `7` と `3` の2本立て
- [ ] **F-2**: `colors.mapGround` の5つの値が `assets/map-style.json` の中に文字列として存在する（`theme.test.ts`）
- [ ] **F-3**: 地図の地は 250×250 で `borderRadius: 125` / `overflow: 'hidden'`（丸窓）
- [ ] **F-4**: 中心が既存の `MapPin type="current-location"`（`map-pin-current-location` が1つ）。色は `colors.pin.currentLocation`（`#3B82F6`）
- [ ] **F-5**: `onboarding-wave` が**3つ**。`borderColor` が `colors.primary[500]`（`#f27f0d`）/ `borderWidth: 2`、
      ループ 2400ms、遅延 `0 / 800 / 1600`
- [ ] **F-6**: `NEAR_START_MS === 600` / `NEAR_STEP_MS === 260`。599ms で0本、600ms で1本、1120ms で3本
- [ ] **F-7**: 近くのピン3本は D-5 と同じ形で、色は3本とも `colors.pin.unvisited`（`#FB923C`）。
      置き場所は `{left:30, top:50}` / `{right:20, top:85}` / `{left:65, bottom:25}`
- [ ] **F-8**: `useReduceMotion()` が true のとき、`onboarding-wave` が**0個**（無限に動くものは消す）で、ピン3本は 0ms で見えている
- [ ] **F-9**: 画面から外れる（unmount）と波紋のループが止まる（`Animated.loop` の `stop()` が呼ばれ、タイマーが残らない）

### G. 画面（`Onboarding`）— 審査に関わる振る舞いを含む

- [ ] **G-1**: `onboarding-slide` が4つ。それぞれに `onboarding-art-map` / `-record` / `-seals` / `-nearby` が1つずつ
- [ ] **G-2**: `onboarding-icon` が画面に**1つも無い**。`OnboardingIcon.tsx` がリポジトリから消えている
- [ ] **G-3**: タイトルと説明が「画面仕様」の表どおり（4組8文字列の完全一致）。旧文言
      （`御朱印を地図で管理` / `かんたん記録` / `コレクションを楽しむ` / `近くのスポットを発見`）が画面に無い
- [ ] **G-4**: **最終スライドのボタンは `続ける`**。`許可して始める` / `あとで設定する` は画面に無い（食い違い#1）
- [ ] **G-5**: `skip-button` は1〜3枚目だけに出て、押しても `navigate` も `completeOnboarding` も呼ばれない（最終スライドへ飛ぶだけ）
- [ ] **G-6**: `続ける` を押すと `Location.requestForegroundPermissionsAsync()` が呼ばれ、
      許可・拒否・例外のいずれでも `completeOnboarding()` → `navigate('MainTabs', { screen: 'MapTab', params: { screen: 'Map' } })`
- [ ] **G-7**: 絵に `active` が渡る。表示中のスライドだけ `active === true`（`onViewableItemsChanged` で index 3 を発火させると
      4枚目だけ true）
- [ ] **G-8**: 一度再生した絵は、戻ってきても**出し直さない**（`active` が false→true になっても最終状態のまま）
- [ ] **G-9**: 絵の外枠は読み上げから外れている（`accessibilityElementsHidden` と `importantForAccessibility="no-hide-descendants"`）。
      読まれるのはタイトルと説明だけ
- [ ] **G-10**: 絵の `Path` / `Circle` に `accessibilityLabel` が無い（47県を読み上げない）

### H. 品質

- [ ] **H-1**: 全テストが通る（`npm test`）
- [ ] **H-2**: Lint エラーがない（`npm run lint`。警告は既存の `require()` 15件まで）
- [ ] **H-3**: 型エラーがない（`npm run typecheck`）
- [ ] **H-4**: `package.json` の依存が**1つも増えていない**
- [ ] **H-5**: 直値の色が `src/components/onboarding/` に無い（`'#` / `"#` を grep して0件（コメント中の `#212` は数えない）。全部 `@theme/colors` 経由）
- [ ] **H-6**: `e2e/flows/smoke.yaml` が変更されておらず、そのまま通る（native-only。シミュレータ＋dev build）

## スライス（1スライス = 1コミット）

| #   | コミット                                           | 中身                                                                                                     | 先に赤にするテスト                    |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| S1  | `feat: 御朱印を彫る（墨書は読める字にしない）`     | `sumi.ts` / `Goshuin.tsx` / `colors.washiGrain`。画面はまだ触らない                                      | `sumi.test.ts`（A-1〜A-6）＋ B-1〜B-5 |
| S2  | `feat: オンボーディングの地図に、47県とピンを置く` | `OnboardingArt.tsx` の `PrefectureMap` / `useSteps` / `MapFillArt` / `RecordArt` / `pinTip`              | `OnboardingArt.test.tsx`（C・D）      |
| S3  | `feat: オンボーディングに印と近くの寺社を出す`     | `SealsArt` / `NearbyArt` / `colors.mapGround` / `theme.test.ts`                                          | 同上（E・F）                          |
| S4  | `feat: オンボーディングを本物の動きに差し替える`   | `OnboardingScreen` の `slides` と文言、`active` の受け渡し、`OnboardingIcon` 削除、既存テスト3件の手当て | `OnboardingScreen.test.tsx`（G）      |
| S5  | `docs: オンボーディングの画面仕様を実装に合わせる` | `ui-design.md` §4.1 の表（§3 は触らない）                                                                | —                                     |

S1〜S3 は画面に出ないので、**途中のコミットでもアプリは壊れない**（S4 まで旧アイコンのまま動く）。

## スコープ外（やらないこと）

- **スライドの枚数を変えない**。4枚のまま
- **遷移と抜け道を変えない**。スキップ＝最終スライドへ飛ぶだけ、抜ける道は `続ける`＝権限リクエストの1本だけ。
  ボタンを増やさない・減らさない・文言を変えない（食い違い#1）
- **位置情報を頼む場所を動かさない**。最終スライドのまま（App Store Guideline 5.1.1(iv)）
- **`onboarding_completed` の持ち方を変えない**（`useOnboarding` / AsyncStorage / キー名）
- **オンボーディングを再表示する導線（設定の「もう一度見る」等）を作らない**
- **`JapanMap` / `SaveMapReveal` / `Seal` / `BADGE_STEP_MS` / `REVEAL_STEP_MS` を変更しない**。
  読むだけ（`revealOrder` の import と `Seal` の利用のみ）
- **墨書を読める字にしない**。寺社の名前・日付・「奉拝」を書かない（実在しない寺社を捏造しないため）
- **御朱印の写真（実画像）を使わない**。SVG で彫ったものだけ
- **`e2e/flows/smoke.yaml` に新しいフローを足さない**。絵は Web で見える
- **新しい依存を足さない／ネイティブ変更をしない**（＝この Issue に EAS ビルドの焼き直しは要らない）
- **`ui-design.md` §3 の初回起動フローを書き換えない**

## 注意事項

### 確認のしかた（`onboarding_completed` が立つと二度と出ない）

1. **Expo Web（絵の確認はこれで足りる）**: `npx expo start --web --port 8081` → DevTools のコンソールで
   `localStorage.removeItem('onboarding_completed')` → リロード。
   AsyncStorage の web 実装は `window.localStorage` を**接頭辞なし**で使うので、このキーで消える。
   4枚とも動きが見える（`react-native-svg` も `Animated` も web で動く）。**スワイプは効かないので「次へ」で送る**
2. **実機 / シミュレータ（native-only の確認）**: dev build を**削除して入れ直す**（AsyncStorage ごと消える）。
   位置情報の許可ダイアログが出ること、拒否しても地図画面へ進むことはここで見る
3. **Maestro**: `launchApp: { clearState: true }` を付けたフローなら毎回オンボーディングから始まる。
   ただし `smoke.yaml` は**今のまま**にする（`when: visible スキップ` で初回だけ通る作りを変えない）
4. 小さい画面（iPhone SE 375×667）でタイトルとボタンが切れないことを Web の幅 375 で見る（`ART_HEIGHT` の上限が効く）

### 実装で踏む穴

- **`Animated.delay` を使わない**。イージングを渡せず既定の `Easing.ease` になり、その遅延 `require` が
  `jest.resetModules()` のあとに発火すると壊れる（`SaveMapReveal.tsx` L82-87 に同じ事故の記録がある）。
  待ちは `setTimeout`、**unmount で必ず `clearTimeout` と `stop()`**
- **`react-native-svg` の要素を動かすときは `useNativeDriver: false`**。`Animated.createAnimatedComponent(G)` に
  `opacity` / `y` / `scale`（＋ `originX` / `originY`）を渡す。`true` にすると落ちる。
  もし `G` のアニメーションが手に負えなくなっても、**座標の出どころ（地図の viewBox）は変えない**。
  最後の手段は `transform` 文字列を state で2段階（落下前 / 着地）に切り替えること（D-3 / D-6 は変わらない）
- **`<Svg>` には数値の `width` と `height` を必ず渡す**。省くと親のサイズ次第でレターボックスが入り、
  viewBox 座標と実寸の対応がずれる＝ピンがまた海に落ちる
- `useReduceMotion()` は **false で始まって非同期に true になる**。切り替わった時点で最終状態へ飛ぶ実装にする
  （解決前の数フレームが動くのは許容する。`JapanMap` も同じ）
- 4スライドは FlatList が**最初に全部マウントする**。`active` を渡さないと、2〜4枚目の動きは
  ユーザーが着く前に終わっていて、**何も動かない絵**になる。これがこの Issue で一番踏みやすい穴
- `Seal` は**印1つにつき `seal-frame` / `seal-mark` が1組**。3枚目は6つ、御朱印は2つ出るので、
  `getByTestId` を素で使うと「複数見つかった」で落ちる。`within()` か `getAllByTestId` で絞る
- 承認されたのは**試作の見た目**。墨の座標を「きれいに」整えない。中央の3本が不揃いなのは、
  等間隔の縦横で組むと格子（井）に見え、読める字になってしまうため（試作のコメントに経緯がある）
- `colors.mapGround` の `base`（`#fafafa`）と `road`（`#dddddd`）は、`assets/map-style.json` では
  **鉄道レイヤの色**であって地と道の色ではない（実際の地は `rgb(242,243,240)`、道は白 + `hsl(0,0%,88%)`）。
  承認値をそのまま使うが、「実際の地図と並べると少し白い」という指摘が出たらここを直す（食い違い#9）
