# Issue #305: 予定タブのアイコンを「空押しから色が差す」動きにする

## 概要

下タブ「予定」のアイコン（MaterialIcons `event`）は、あゆみと同じ「左から右へ現れる」動き（`motion="draw"`）を流用している（#258 D-20）。カレンダーの意味が無く、あゆみと見分けがつかない。

`TabBarIcon` に新しい動き **`emboss`（空押しから色が差す）** を足し、予定タブだけをそれに替える。別のタブから予定を選んだ瞬間に1回だけ、次のように動く（600ms）。

```
進み  0 ────────── 0.35 ─────────── 0.65 ─────────── 1
      枠だけ        日付の四角の輪郭が   中に朱が入る      朱が引いて、タブの色の
                    うっすら押される                       四角に戻る（= 今の event）
                    （空押し）
```

止まった姿は今の `event` と同じ。回らない・弾まない・1回だけ。「視差効果を減らす」では動かさない。動かすのは opacity と transform（scale）だけで、native driver で動かす。

## 関連ドキュメント

- GitHub Issue #305（スコープ・範囲外）
- 承認された試作: `docs/design/mockups/2026-10-plan-tab-icon-v2.html` の **D「空押しから色が差す」（variant `emboss`）**。朱は「朱が差す」（試作の既定）。2026-10-03 にオーナーが選んだ
- 比較の経緯: `docs/design/mockups/2026-10-plan-tab-icon-v1.html`（4案）。オーナーは案1「予定に印を捺す」を「熱盛っぽい、もっとおしとやかに」と言い、v2 で案1をおしとやかにした4つから D を選んだ
- `docs/issues/issue-258-visit-plan.md` の D-20（予定タブのアイコン）← **この契約の D-1 で上書きする**
- `src/components/animated/TabBarIcon.tsx`（発火条件・`lastActive`・reduce motion・React Navigation の2枚重ねの説明）
- react-native 0.81.5 の `Libraries/Animated/NativeAnimatedAllowlist.js` の `SUPPORTED_INTERPOLATION_PARAMS`: native driver の interpolate が受け付ける設定は `inputRange`・`outputRange`・`extrapolate`・`extrapolateLeft`・`extrapolateRight` だけ。`easing` は入っていない（渡すと native driver で実行時に落ちる）

## 設計上の決定

| #    | 決定                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-1  | **#258 D-20 を上書きする**: D-20 の「`TabIconMotion` に新しい動きは足さない」をやめ、`TabIconMotion` に 5つ目の値 `'emboss'` を足す。予定タブ（`PlanTab`）だけを `motion="emboss"` に替え、あゆみ（`CollectionTab`）は `motion="draw"` のまま。予定タブの `name="event"` は変えない。`docs/issues/issue-258-visit-plan.md` は書き換えない（上書きはこの契約書と feature-list の ISSUE-305 に残す）                                                                                                                                                                                                                                                                                                                                                                             |
| D-2  | **素材は試作と同じ組み方**: `react-native-svg`（依存にある 15.12.1）の `<Svg width={size} height={size} viewBox="0 0 24 24">` に、`event` から日付の四角を除いた枠の path（定数 `EVENT_FRAME_PATH`）を `fill={color}` で描く。path は `M16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z`。日付の四角（24 の格子の x12〜17・y12〜17。元の `event` の `M17 12h-5v5h5v-5z`）は、絶対配置の `Animated.View` 3枚で重ねる。3枚とも `left = top = size * 12 / 24`・`width = height = size * 5 / 24`: ① 輪郭（ring）: `borderWidth: size / 24`・`borderColor: color`（背景なし）② 四角（square）: `backgroundColor: color` ③ 朱（seal）: `backgroundColor: colors.seal`。`emboss` は `MaterialIcons` を描かない |
| D-3  | **重なり順と testID**: 後ろから「枠（Svg）→ 輪郭 → 四角 → 朱」（試作の DOM 順と同じ）。朱を四角の上に置くのは、四角が 0.65 で不透明に切り替わる瞬間を、不透明な朱の下に隠すため。testID は、外側が既存と同じ `tab-icon-${name}`、中が `tab-icon-${name}-frame`（枠の `Svg`）・`-ring`・`-square`・`-seal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-4  | **朱の有無は1つの定数で切り替える**: `TabBarIcon.tsx` に `const EMBOSS_SEAL = true;`。false にすると朱の層（`-seal`）を描かない（オーナーが「朱なし」に変えたらこの1行で朱の層ごと消せる）。朱の色は `colors.seal`（`#C2342B`）。新しいトークンは足さない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-5  | **動きは progress 1本**: 既存の `useRef(new Animated.Value(motion === 'gear' ? 0 : 1))` の「1」側に乗る（静止時は 1）。選ばれたら既存の非 gear の道筋どおり `progress.setValue(0)` → `Animated.timing(progress, { toValue: 1, duration: EMBOSS_DURATION_MS, easing: Easing.linear, useNativeDriver: true })`。`EMBOSS_DURATION_MS = 600`（既存の `SPIN_DURATION_MS` などと同じ並びに置く）。既存の duration / easing の三項に emboss の枝を足す。緩急は timing の easing ではなく interpolate の節で出す（D-6）                                                                                                                                                                                                                                                                |
| D-6  | **形は interpolate の節（knot）に持たせる。interpolate に `easing` を渡さない**（native driver で落ちる。関連ドキュメントの許可リスト）。設計値は下の「節の表」。interpolate に渡す設定のキーは `inputRange`・`outputRange`（と必要なら `extrapolate` 系）だけ。区間の緩急を近似する節は、モジュールの読み込み時に `Easing.bezier` などで値を計算して配列にしてよい（interpolate に渡るのは数の配列だけ）                                                                                                                                                                                                                                                                                                                                                                      |
| D-7  | **動かすのは opacity と transform の scale だけ**: interpolate の結果を使ってよいのは、輪郭の `opacity` と `transform: [{ scale }]`、四角の `opacity`、朱の `opacity` だけ。色・位置・幅・`borderWidth` は動かさない（固定値）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D-8  | **止まった姿 = 今の `event`**: progress = 1 で輪郭 0・朱 0・四角 1（輪郭の scale 1）になる節にしてあるので、静止時は「枠 + 四角」だけが見える。React Navigation が重ねて描く非アクティブ側の複製（`focused = false`）は動かないので progress = 1 のまま、同じ「枠 + 四角」の姿                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D-9  | **発火条件は既存の motion と同じ**: `focused` が false の複製では動かさない・初回（`lastActive` が undefined）は動かさない＝起動直後に勝手に動かない・`useReduceMotion()` が true なら動かさない・選び直されるたびに `setValue(0)` で先頭から（連打で走行中のものを打ち切る）。発火の判定（`useEffect` の中の `previous` / `isActive`）は変えない                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D-10 | **一過性のアニメだけ**（#99 追補3: 止まらないアニメを作らない）。`Animated.loop`・`iterations` は使わない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-11 | **`name` の扱い**: `emboss` は形が `event` 固定で、`name` のグリフは描かない。`name` は testID（`tab-icon-${name}`）にだけ使う。props の型（`name: IconName` 必須）は変えない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### 節の表（D-6）

試作 v2 の `emboss` の keyframes（600ms・`fill: both`）を、progress 0〜1 の節に写したもの。試作で cubic-bezier / ease-in-out だった区間は、**その区間の中に節を足して近似してよい**。ただし下の「固定する点」は変えず、`inputRange` は狭義単調増加にする。

| 層          | 値      | inputRange（固定する点） | outputRange          | 試作での区間の形                      | 節を足してよいか                                                                     |
| ----------- | ------- | ------------------------ | -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| 輪郭 ring   | opacity | `[0, 0.35, 0.75, 1]`     | `[0, 0.55, 0.55, 0]` | 0→0.35 は cubic-bezier(0.22,1,0.36,1) | 0〜0.35 に足してよい。0→0.55 へ単調に増え、0.55 を超えない                           |
| 輪郭 ring   | scale   | `[0, 0.35, 1]`           | `[1.12, 1, 1]`       | 0→0.35 は cubic-bezier(0.22,1,0.36,1) | 0〜0.35 に足してよい。1.12→1 へ単調に減り、1 を下回らない（弾まない）。0.35 以降は 1 |
| 朱 seal     | opacity | `[0, 0.3, 0.65, 1]`      | `[0, 0, 1, 0]`       | 0.3→0.65・0.65→1 は ease-in-out       | 0.3〜0.65（単調に増える）・0.65〜1（単調に減る）に足してよい。値は 0〜1              |
| 四角 square | opacity | `[0, 0.64, 0.65, 1]`     | `[0, 0, 1, 1]`       | 0.65 で朱の下に隠れたまま切り替わる   | 足さない                                                                             |

## 詳細設計

### 対象ファイル

| ファイル                                                | 変更                                                                                                                                                          | スライス |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/components/animated/TabBarIcon.tsx`                | `TabIconMotion` に `'emboss'`・`EMBOSS_DURATION_MS`・`EMBOSS_SEAL`・`EVENT_FRAME_PATH`・timing の三項に emboss の枝・`motion === 'emboss'` の描画の枝・styles | S1       |
| `src/components/animated/__tests__/TabBarIcon.test.tsx` | AC-1〜13 のテストを足す（既存のテストは変えない）                                                                                                             | S1       |
| `src/navigation/TabNavigator.tsx`                       | `PlanTab` の `motion="draw"` → `motion="emboss"`（1行）                                                                                                       | S2       |
| `src/navigation/__tests__/TabNavigator.test.tsx`        | AC-15 のテストを1本足す                                                                                                                                       | S2       |
| `.claude/harness/feature-list.json`・`progress.md`      | ISSUE-305 の記録                                                                                                                                              | S3       |
| `.claude/harness/evidence/issue-305/`                   | Expo Web の証跡（UI-1〜4）                                                                                                                                    | S3       |

### 画面仕様

#### 下タブ（全画面）→「予定」タブのアイコン

- 止まっているとき（灰・オレンジとも）: 今の `event` と同じ形（上の綴じ輪2つ・上の帯・右下の日付の四角が塗られている）
- 別のタブ → 予定 を押した瞬間: 日付の四角が消えて枠だけ → 四角の輪郭がうっすら（タブの色・不透明度 0.55）少し大きいところから等倍に押される → 中に朱（`colors.seal`）が入る → 朱が引いて、タブの色の四角に戻る。600ms で1回だけ
- 予定タブを押したまま（すでに選ばれている予定を押し直す）では動かない（既存の motion と同じ）

## テスト方針

- **`TabBarIcon.test.tsx` に足す**。モックは既存のまま（`@react-navigation/native` の `useNavigationState` を `mockActiveRoute` で切り替える・`resetTabBarIconMotion()`・`AccessibilityInfo` の spy）
- 特に書かない限り、描くのは `<TabBarIcon name="event" routeName="PlanTab" motion="emboss" color="#f27f0d" focused />`（size は既定の 24）。「選び直し」は `mockActiveRoute` を `'PlanTab'` で描く → `'MapTab'` で rerender → `'PlanTab'` で rerender（既存の `it.each` と同じ手順）
- spy: `Animated.timing`（既存）に加え、`jest.spyOn(Animated.Value.prototype, 'interpolate')`・`jest.spyOn(Animated.Value.prototype, 'setValue')`。どちらも元の実装を呼ぶ（`mockImplementation` しない）。`afterEach` で `mockRestore()`
- **Animated の値（opacity・transform）に `toHaveStyle` や `StyleSheet.flatten` を当てない**（不安定）。見てよいのは動かない値（位置・寸法・背景色・枠線）だけで、`StyleSheet.flatten(getByTestId(...).props.style)` で見る
- 節は interpolate の spy で受け取った設定（`interpolate.mock.calls[i][0]`）で見る。`at(c, x)` = 設定 `c` の `inputRange` / `outputRange` から求めた x での区分線形の値（テストの中に小さな関数として書く）。節の数ではなく、固定する点の値と単調さを見るので、D-6 の範囲で節を足してもテストは壊れない
- 枠の fill は `Seal.test.tsx` の `asPayload` / `fillOf` と同じやり方（react-native-svg は fill を ARGB の数値に正規化する）
- `MaterialIcons` のモック（`jest.setup.js`）はアイコン名を文字として描くので、`queryByText('event')` が null なら `emboss` はフォントのグリフを描いていない

### 既存テストの扱い

| ファイル                                                | テスト                                                                                          | 扱い                                 | スライス |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ | -------- |
| `src/components/animated/__tests__/TabBarIcon.test.tsx` | 既存の全部（spin の発火条件・open-book / draw の `it.each`・gear）                              | **そのまま**。emboss のテストを足す  | S1       |
| `src/navigation/__tests__/TabNavigator.test.tsx`        | 既存の全部（「御朱印帳は menu-book、設定は settings のアイコンを使う」は `event` を見ていない） | **そのまま**。AC-15 を足す           | S2       |
| `src/navigation/__tests__/RootNavigator.test.tsx`       | 全部                                                                                            | **そのまま**                         | —        |
| `e2e/flows/visit-plan.yaml`・`smoke.yaml`               | 文字「予定」で押す・見る                                                                        | **そのまま**（アイコンを見ていない） | —        |

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準に基づいて合否判定を行う。

### 機能基準 — emboss の部品（S1・Jest・`src/components/animated/__tests__/TabBarIcon.test.tsx`）

- [ ] AC-1: `grep -c "export type TabIconMotion = 'spin' | 'open-book' | 'gear' | 'draw' | 'emboss';" src/components/animated/TabBarIcon.tsx` が 1
- [ ] AC-2: 描画: `getByTestId('tab-icon-event')` と `getByTestId('tab-icon-event-frame')` がある。`queryByText('event')` が null（フォントのグリフを描かない）。`UNSAFE_getAllByType(Svg)` が1つで、その `props` が `{ viewBox: '0 0 24 24', width: 24, height: 24 }` を含む。`UNSAFE_getAllByType(Path)` が1つで、その `props` が `{ d: <D-2 の path の文字列>, fill: '#f27f0d' }` を含む
- [ ] AC-3: 層の動かない値（size 24）: `-ring`・`-square`・`-seal` の3つとも `StyleSheet.flatten(props.style)` が `{ position: 'absolute', left: 12, top: 12, width: 5, height: 5 }` を含む。さらに `-ring` は `{ borderWidth: 1, borderColor: '#f27f0d' }`、`-square` は `{ backgroundColor: '#f27f0d' }`、`-seal` は `{ backgroundColor: colors.seal }` を含む
- [ ] AC-4: 大きさに比例する: `size={48}` で描くと、`Svg` の `width`・`height` が 48、`-square` が `{ left: 24, top: 24, width: 10, height: 10 }`、`-ring` が `{ borderWidth: 2 }` を含む
- [ ] AC-5: 重なり順: `getAllByTestId(/^tab-icon-event-(frame|ring|square|seal)$/).map(n => n.props.testID)` が `['tab-icon-event-frame', 'tab-icon-event-ring', 'tab-icon-event-square', 'tab-icon-event-seal']`
- [ ] AC-6: interpolate の設定（native driver で落ちない）: 描いて選び直したあと、`interpolate.mock.calls` が1つ以上あり、**すべての**設定について ① キーが `inputRange`・`outputRange`・`extrapolate`・`extrapolateLeft`・`extrapolateRight` のどれか（`easing` が無い）② `outputRange` の要素がすべて `typeof === 'number'`（色・角度の文字列を動かさない）③ `inputRange` の先頭が 0・末尾が 1・狭義単調増加
- [ ] AC-7: 節（D-6 の固定する点）: AC-6 と同じ設定の中に、次を満たすものがそれぞれ1つ以上ある（`at` はテスト方針の区分線形）
  - 輪郭の opacity: `at(0) = 0`・`at(0.35) = 0.55`・`at(0.75) = 0.55`・`at(1) = 0`・`outputRange` の最大が 0.55
  - 輪郭の scale: `at(0) = 1.12`・`at(0.35) = 1`・`at(1) = 1`・`outputRange` が単調非増加で最小が 1
  - 朱の opacity: `at(0) = 0`・`at(0.3) = 0`・`at(0.65) = 1`・`at(1) = 0`
  - 四角の opacity: `inputRange` が `[0, 0.64, 0.65, 1]`・`outputRange` が `[0, 0, 1, 1]`
- [ ] AC-8: 起動直後に動かない: `mockActiveRoute = 'PlanTab'` で描いただけでは `Animated.timing` が0回
- [ ] AC-9: 選び直しで1回動く: 選び直すと `Animated.timing` が1回。その設定が `{ toValue: 1, useNativeDriver: true }` を含み、`duration` が 0 より大きく 600 以下、`easing` が `Easing.linear`（`toBe`）
- [ ] AC-10: 連打で先頭から: 選び直しを2回（`PlanTab` → `MapTab` → `PlanTab` → `MapTab` → `PlanTab`）すると、`Animated.timing` が2回でどちらも `toValue: 1`。`setValue` の spy が `0` で2回呼ばれ、それぞれ対応する `Animated.timing` より前（`invocationCallOrder` が小さい）
- [ ] AC-11: 非アクティブ側の複製で動かない: `focused={false}` で描いて選び直しても `Animated.timing` が0回
- [ ] AC-12: 視差効果を減らす: `AccessibilityInfo.isReduceMotionEnabled` が true で resolve するとき、描いて（`findByTestId('tab-icon-event')` で待って）選び直しても `Animated.timing` が0回
- [ ] AC-13: ほかの動きは今までどおり: 既存のテスト（spin の5本・`it.each` の `open-book` / `draw`・gear）を消さず・書き換えずに通る。`git diff origin/develop...HEAD -- src/components/animated/__tests__/TabBarIcon.test.tsx | grep -E "^-\s*(it(\.each)?\(|\['(open-book|draw)'|expect\()"` が0行（テストの宣言・`it.each` の行・`expect` を消していない。import や spy の準備の行は変えてよい）

### 機能基準 — 予定タブを替える（S2）

- [ ] AC-14: `src/navigation/TabNavigator.tsx` で、`awk '/name="PlanTab"/,/\/>/' src/navigation/TabNavigator.tsx | grep -c 'motion="emboss"'` が 1、`awk '/name="CollectionTab"/,/\/>/' src/navigation/TabNavigator.tsx | grep -c 'motion="draw"'` が 1。ファイル全体で `grep -c 'motion="emboss"'` が 1・`grep -c 'motion="draw"'` が 1。`awk '/name="PlanTab"/,/\/>/' src/navigation/TabNavigator.tsx | grep -c 'name="event"'` が 1
- [ ] AC-15: `TabNavigator.test.tsx`（既存の「御朱印帳は menu-book、設定は settings のアイコンを使う」と同じ `mockUseAuth`・初期表示の地図）: `getAllByTestId('tab-icon-event-square').length` が 1 以上（予定タブが emboss で描かれている）、`getAllByText('timeline').length` が 1 以上、`queryAllByTestId(/^tab-icon-timeline-(frame|ring|square|seal)$/).length` が 0（あゆみは draw のまま）

### UI基準（Expo Web・goshuin-evaluator）

手順は下の「Expo Web での確かめ方」。予定タブのアイコンは React Navigation が2枚（アクティブ・非アクティブ）重ねて描くので、DOM では `tab-icon-event` が2つある。

- [ ] UI-1: **止まった姿の寸法（DOM で計る）**: 地図タブが選ばれている状態と、地図 → 予定 を押して 1000ms 待った状態の両方で、`[data-testid="tab-icon-event"]` の2つとも `getBoundingClientRect()` が 24×24。その中の `svg` が1つで 24×24・`viewBox="0 0 24 24"`。`[data-testid="tab-icon-event-square"]` が外側からの位置 (12, 12)・5×5 で、`getComputedStyle` の `background-color` が同じ外側の中の `svg path` の塗りの色と同じ（rgb で比べる）。`-ring` と `-seal` の `getComputedStyle(...).opacity` が `'0'`。測った値を `.claude/harness/evidence/issue-305/dom.json` に置く
- [ ] UI-2: **止まった姿の見た目（スクショ・3倍）**: 地図が選ばれているとき（予定は灰）と、地図 → 予定 の 1000ms 後（予定はオレンジ = `colors.primary[500]`）の予定タブのアイコンを、`deviceScaleFactor: 3` で切り出す。どちらも ① 上の綴じ輪2つ・上の帯・右下の日付の四角（塗りつぶし）が見える ② 日付の四角のまわりに輪郭の線が出ていない ③ 朱（`#C2342B` に近い赤）の画素が無い ④ 日付の四角の中心の色と、枠の左の縦線（24 の格子で x4・y14）の色が同じ。比べる用に、同じ画面の他の4つのタブのアイコンを含むタブバー全体のスクショも置く（`static-inactive.png`・`static-active.png`・`tabbar.png`）
- [ ] UI-3: **動き（録画）**: 地図 → 予定 を押すところを録画する（Playwright の `recordVideo` など 25fps 以上）。① 押してから 300ms までに、日付の四角の位置が塗られていない（枠だけ、またはうっすらした輪郭だけ）コマがある ② 朱（`#C2342B` に近い赤）が日付の四角の位置に出るコマがある ③ 押してから 800ms 以降のコマは UI-2 のオレンジの姿と同じで、2000ms まで変わらない（1回だけ）④ 予定 → 地図 → 予定 を 300ms 以内に押しても、最後は UI-2 の姿で止まる ⑤ 5つのタブを順に押して回る間、ブラウザのコンソールに新しいエラーが出ない（既存の `useNativeDriver` の警告は除く）。`motion.webm`（またはコマの画像）を置く
- [ ] UI-4: **視差効果を減らす（Web の代わり）**: `page.emulateMedia({ reducedMotion: 'reduce' })`（または DevTools の「prefers-reduced-motion: reduce」）にしてから読み込み直し、地図 → 予定 を録画する。朱の画素が出るコマが無く、押した直後から UI-2 のオレンジの姿。`reduce-motion.webm` を置く

### native-only（Web で確かめられないもの）

Web の Animated は native driver を使わず JS で動くので、「native driver で落ちない」「iPhone での見え方」は Web では確かめられない。下の H-1（人間ゲート）に回す。落ちる原因になりうる「interpolate の `easing`」「色・幅を動かす」は AC-6・Q-8 で Jest とコードで先に塞いでいる。

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: 依存を足していない: `git diff --name-only origin/develop...HEAD -- package.json package-lock.json` が空
- [ ] Q-5: 色の直値が無い: `grep -nE "['\"]#[0-9A-Fa-f]{3,8}['\"]" src/components/animated/TabBarIcon.tsx src/navigation/TabNavigator.tsx` が0件（朱は `colors.seal`）
- [ ] Q-6: 止まらないアニメが無い: `grep -nE "Animated\.loop|iterations" src/components/animated/TabBarIcon.tsx` が0件
- [ ] Q-7: ほかの動きの値を変えていない: `git diff origin/develop...HEAD -- src/components/animated/TabBarIcon.tsx | grep -E '^-.*(SPIN_DURATION_MS|OPEN_DURATION_MS|GEAR_DURATION_MS|GEAR_DETENT_DEG|DRAW_DURATION_MS|PAGE_WIDTH_RATIO|PAGE_HEIGHT_RATIO|SPINE_GAP_RATIO) ='` が0行
- [ ] Q-8: 朱の切り替え: `grep -nE "^const EMBOSS_SEAL = true;" src/components/animated/TabBarIcon.tsx` が1行、`grep -cw "EMBOSS_SEAL" src/components/animated/TabBarIcon.tsx` が 2 以上（`-w` で `EMBOSS_SEAL_OPACITY` などを数えない）。さらにコードを読んで、`-seal` の層を描くかどうかがこの定数だけで決まっていること、`motion === 'emboss'` の枝で interpolate の結果が使われている style のキーが `opacity` と `transform` の `scale` だけであること（D-7）、`EMBOSS_DURATION_MS = 600` であること（D-5）を確かめる
- [ ] Q-9: 発火の判定を変えていない: `git diff origin/develop...HEAD -- src/components/animated/TabBarIcon.tsx | grep -E '^-.*(lastActive|previous !== false|if \(!focused\) return)'` が0行
- [ ] Q-10: 変えたファイルが次の中だけ: `git diff --name-only origin/develop...HEAD` が `src/components/animated/TabBarIcon.tsx`・`src/components/animated/__tests__/TabBarIcon.test.tsx`・`src/navigation/TabNavigator.tsx`・`src/navigation/__tests__/TabNavigator.test.tsx`・`docs/issues/issue-305-plan-tab-emboss.md`・`docs/design/mockups/2026-10-plan-tab-icon-v1.html`・`docs/design/mockups/2026-10-plan-tab-icon-v2.html`・`.claude/harness/feature-list.json`・`.claude/harness/progress.md`・`.claude/harness/evidence/issue-305/` 以下だけ（`.agents/`・`.codex/`・`AGENTS.md` を入れない）

## スライス（1スライス = 1コミット・TDD）

| #   | 中身                                                                                                                                                                                                                                                                            | 主な基準         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S1  | `TabBarIcon` に `emboss`。テストを先に書く（AC-2〜7・9・10 が赤になるのを見てから実装で緑。AC-8・11・12 は「動かない」ことを見るので実装前から緑になりうる）→ `TabIconMotion`・定数・timing の枝・描画の枝。`feat: 予定タブのアイコンに「空押しから色が差す」動きを足す (#305)` | AC-1〜13・Q-5〜9 |
| S2  | `TabNavigator` の `PlanTab` を `motion="emboss"` に替える。AC-15 のテストを先に足して赤を見てから1行を替える                                                                                                                                                                    | AC-14・15        |
| S3  | goshuin-evaluator の Expo Web の確認（UI-1〜4）の証跡を `.claude/harness/evidence/issue-305/` に置き、`feature-list.json` に ISSUE-305（未確認の H-1 を note に書く）・`progress.md` に1〜3行。`docs: #305 の確認と記録`                                                        | UI-1〜4・Q-10    |

## 手順

### Expo Web での確かめ方（goshuin-evaluator・UI-1〜4）

1. `npx expo start --web --port 8081`。ログインしない（ゲスト）。オンボーディングが出たら最後まで進めて、下タブが見える地図の画面にする
2. UI-1: DevTools（または Playwright の `page.evaluate`）で `document.querySelectorAll('[data-testid="tab-icon-event"]')` から測る。測った値を `dom.json` に書く
3. UI-2: Playwright を `deviceScaleFactor: 3` で開き、予定タブのアイコンを切り出す。画素の色は切り出した画像から読む
4. UI-3: Playwright の `recordVideo`（`size` はビューポートと同じ）で録画しながら、地図 → 予定 → 地図 → 予定（間を 300ms 以内）→ 御朱印帳 → あゆみ → 設定 → 予定 の順に押す。コンソールのメッセージも保存する
5. UI-4: 新しいページで `page.emulateMedia({ reducedMotion: 'reduce' })` してから読み込み、地図 → 予定 を録画する
6. 証跡を `.claude/harness/evidence/issue-305/` へ（`dom.json`・`static-inactive.png`・`static-active.png`・`tabbar.png`・`motion.webm`・`reduce-motion.webm`・`console.txt`）

### オーナーの手順（H）

| #   | いつ                    | やること                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1 | 人間ゲート（push の前） | **ターミナルで** `cd /Users/kaiwajun/orca/workspaces/goshuin-app/hamlet` → `./scripts/dev.sh`（2分ほど待つ。正しく終わると `Dev tunnel ready` の下に `URL: https://…trycloudflare.com` が出る。`ERROR:` が出たらその行を伝えて止める）。iPhone の開発用アプリ（今のままでよい。ネイティブの変更は無い）で、その URL を開く（QR か「Enter URL manually」）。確かめること: ① 地図 → 予定 を押すと、日付の四角の輪郭がうっすら出る → 朱が入る → オレンジの四角に戻る、が1回だけ（試作 v2 の D と同じ印象）② 止まっているとき、予定のアイコン（灰とオレンジの両方）の線の太さ・大きさが、ほかの4つのタブと並べて浮いて見えない ③ 予定 ↔ 地図 を素早く5回往復しても固まらず、最後は止まった姿 ④ あゆみは今までどおり左から右へ現れる。**止める条件**: 赤い画面（エラー）か下に黄色・赤の帯（LogBox）が出たら、その1行目の文字をそのまま伝え、push しない。②で浮いて見える・「朱なし」にしたい、と思ったら、そのまま伝える（直してから再確認）。終わったら **ターミナルで** `./scripts/dev.sh stop` |
| H-2 | H-1 のあと（任意）      | iPhone の「設定」アプリ → アクセシビリティ → 動作 →「視差効果を減らす」をオン → 御朱印さんぽで 地図 → 予定 を押すと、動かずに色だけ変わる。確かめたら「視差効果を減らす」を元に戻す。Jest（AC-12）と Web（UI-4）で確かめてあるので、省いてもよい                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## やらないこと（スコープ外）

- ほかのタブ（地図・御朱印帳・あゆみ・設定）の動きとアイコン。あゆみは `draw` のまま
- `TabIconMotion` のほかの値（`spin`・`open-book`・`gear`・`draw`）の動き・定数の変更
- 予定の画面の中の `event` アイコン（ゲストの案内の 40px の `MaterialIcons`）
- 試作のほかの案（A そっと置く・B 押し当てる・C にじむ）や「朱なし」を選べる設定・フラグ（切り替えは定数 `EMBOSS_SEAL` の1つだけ）
- テーマのトークンの追加（`colors.seal`・`colors.primary` を使う）・新しい依存（`react-native-svg` は既に 15.12.1）
- `docs/issues/issue-258-visit-plan.md`・`docs/design/ui-design.md`（タブの動きの節が無い）・試作 HTML の書き換え
- E2E（`e2e/flows/` はアイコンを見ていない）・Android 固有の確認
- `@react-navigation/bottom-tabs` の2枚重ねへの依存の解消（既存のまま）

## リスク・不確実な点／申し送り

- **SVG の枠とフォントのグリフの描画の差**: 枠は `event` と同じ path だが、フォント（ヒンティング・アンチエイリアス）と SVG で線の見え方が少し違いうる。Web（UI-2）で差が見えても、枠の path は変えずに H-1 の実機で判断する。実機で目立つなら、止まっているときだけフォントのグリフに渡す形（`open-book` が最後に本物のグリフへ渡すのと同じ手）を別の Issue で検討する（この契約ではやらない）
- **押した瞬間に日付の四角が消える**: 試作どおり progress 0 では四角の opacity が 0 なので、選んだ瞬間は「枠だけ」になる。React Navigation はアクティブ・非アクティブの2枚を opacity で入れ替えるだけなので、灰の四角 → オレンジの枠だけ、と一瞬で変わって見える。試作で承認済みの見え方として受け入れる
- **native driver で落ちないかは H-1 でしか見えない**: 落ちる原因の主なもの（interpolate の `easing`・native が扱えない style を動かす）は AC-6・Q-8 で塞いでいる。opacity と transform の scale は native driver が扱える。それでも、Jest の Animated は native のモジュールをモックしているので、最終の確認は H-1
- **「朱なし」に変えるとき**: H-1 でオーナーが「朱なし」を選んだら、`EMBOSS_SEAL = false` の1行と、`-seal` を前提にしたテスト（AC-3・AC-5・AC-7 の朱の行）を直す fix のコミットを足し、goshuin-evaluator の Jest と UI-3 をもう一度回す
- **2枚重ねへの依存**（既存）: 発火は `@react-navigation/bottom-tabs` 7.12.0 の内部実装（アイコンを2枚重ねる）に頼っている。`TabBarIcon.tsx` のコメントのとおりで、この契約では変えない
- **1.2.0 との関係**: JS だけの変更で、ネイティブのビルドは要らない。どのビルドに載せるかはこの契約では決めない
