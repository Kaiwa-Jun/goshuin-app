# Issue #212: 獲得バッジを「印」にする（絵文字の丸をやめる）

## 概要

バッジの絵を **SVG で彫った印**に置き換える。🎊🏆👑 はゲームの実績の顔で、御朱印アプリである理由がゼロだった。
さらに絵文字は OS が描くので iOS と Android で形も色も変わる。

- 訪問数の6個は**漢数字**（一 / 五 / 十 / 三十 / 五十 / 百）を矩形で組む
- 作法・旅のしかたの3個は字をやめて**紋**にする（満願＝12個の丸の環 / 四季＝四弁 / 1日に3箇所＝三つ巴）
- 獲得＝朱、未獲得＝**同じ絵の薄い灰**（鍵で塞がない）
- あゆみのバッジ節は横スクロール3本をやめ、軸ごとの**3列グリッド**にして9個ぜんぶ見せる
- 進捗は未獲得のうち**いちばん近い1つ**だけに「あと16箇所」形式で出す
- 保存直後（NewBadgeRow / ManganSeal）も同じ印に統一する

図形は承認済み試作 `docs/design/mockups/2026-09-badge-seal-v2.html` の SVG がそのまま実装になる。
**この契約書は図形やしきい値を作り直していない**。承認された絵と、確定した振る舞いから、機械チェック可能な受入基準を起こしたもの。

各受入基準には **現状** を付ける。チェックボックスの意味は1つに固定する。

| 書き方                     | 意味                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| `[x]`                      | **自動テスト（または `npm` コマンド）がこの基準の中身を見ている** |
| `[ ]` + PASS（テスト無し） | 実装は満たしているが、壊れても気づけない                          |
| `[ ]` + **形だけ緑**       | テストは存在するが、基準の中身を見ていない                        |
| `[ ]` + **FAIL**           | 未達。実装が要る                                                  |

⚠️ 現状は **2026-09-21 時点の `feature/issue-212-badge-seal` HEAD `66a51fd`**（`75dd0e1` → `2e8fc0e` → `66a51fd` の3コミットで
実装は一通り入っている。作業ツリーはこの契約書以外きれい）に対する判定。実測: `npx jest` = 112 suites / 1424 tests すべて green、
`npm run lint` = 0 errors / 15 warnings（既存の `require()` 警告のみ）、`npx tsc --noEmit` = エラー無し。
契約書の本体は AC の文面で、現状欄は追認用。**残っているのは「絵と振る舞いを実際に見ているテスト」と a11y ラベルと docs 更新**。
実装は並行して進んでいるので、現状欄は先に古くなる（例: A-7 のテストは `66a51fd` の直後に作業ツリーへ入った）。
**食い違ったら AC の文面が正**。

## 関連ドキュメント

- **承認デザイン（正）**: [`docs/design/mockups/2026-09-badge-seal-v2.html`](../design/mockups/2026-09-badge-seal-v2.html)
  — `FRAMES` / `GLYPH1` / `pair` / `GLYPH` の各定義が実装すべき図形そのもの
- 確定要件（軸・満願・「ご褒美はアプリの外にある」）: [`docs/design/2026-09-tsukimairi-spec.md`](../design/2026-09-tsukimairi-spec.md) §4-3 / §4-4 / §5
- あゆみ画面の現行仕様: [`docs/issues/issue-209-ayumi-japan-map.md`](./issue-209-ayumi-japan-map.md)
- プロダクト方針: [`docs/product/direction.md`](../product/direction.md) / 要件定義: [`docs/product/requirements.md`](../product/requirements.md)
- UI設計: [`docs/design/ui-design.md`](../design/ui-design.md) §4.8（**追い越されている**。下表参照）

### 既存ドキュメント・承認デザインとの食い違い（この契約書を正とする）

| 出どころ                           | そこの記述                         | この契約書での扱い                                                                                                                                          |
| ---------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-design.md` §4.8                | 「獲得済みは黄色、未獲得はグレー」 | **朱（`colors.seal`）/ 薄い灰（`colors.sealEmpty`）** に改める（AC E-4）                                                                                    |
| 試作 HTML `.bigseal` の最終角度    | `rotate(-7deg)`                    | コードの **-8deg** を維持（既存モーションを変えない＝決定事項9）                                                                                            |
| 試作 HTML `stampSmall`             | 小さい印も回りながら出る           | コードの**回さない pop** を維持（同上）                                                                                                                     |
| 試作 HTML の `<polygon>`（五・百） | `polygon`                          | `react-native-svg` の `Polygon` をそのまま使う（新しい依存ではない）                                                                                        |
| 試作 HTML の軸の説明文             | 無し（試作では軸ラベルのみ）       | 説明文（「神社や寺に、もとからあるもの」等）は**落とす**（AC B-3）                                                                                          |
| 試作 `nearestYet` の同率の解き方   | 試作の配列順（作法 → 旅 → 訪問数） | **`BADGE_DEFINITIONS` の定義順**（訪問数が先）を正とする（AC D-6）。記録0の人は試作だと満願に `あと12ヶ月`、実装だと `初めての御朱印` に `あと1箇所` が出る |

## 詳細設計

### 対象ファイル

| ファイル                                        | 役割                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/components/common/Seal.tsx`                | **新規**。印そのもの。枠3種＋9つの図形。フォントを使わない                       |
| `src/components/common/__tests__/Seal.test.tsx` | **新規**。図形の数・色・枠の evenodd を見る                                      |
| `src/theme/colors.ts`                           | `colors.seal`（朱）/ `colors.sealEmpty`（まだ押されていない）                    |
| `src/types/badge.ts`                            | `icon: string` → `mark: SealMark`、`BadgeDistance` を追加                        |
| `src/services/badges.ts`                        | 9個への印の割り当て、`distanceOf`、`nearestUnearned`                             |
| `src/screens/CollectionScreen.tsx`              | バッジ節を Card + 3列グリッドに。見出し「印」＋「7 / 9」、進捗1件                |
| `src/components/record/NewBadgeRow.tsx`         | 丸＋絵文字をやめて `Seal`（50px、まっすぐ小さく＝記録）                          |
| `src/components/record/ManganSeal.tsx`          | 枠＋「満願」の文字をやめて `Seal mark="mangan"`（120px、-8deg、`opacity 0.9`）   |
| `src/navigation/types.ts`                       | `badges?` の要素型を `Pick<Badge, 'id' \| 'name' \| 'description' \| 'mark'>` に |
| `docs/design/ui-design.md`                      | §4.8 の「黄色 / グレー」の1行を朱／薄い灰に直す                                  |

### 実装方針

- 図形は `react-native-svg`（15.12.1、既に依存にある）の `Svg` / `Path` / `Rect` / `Circle` / `Polygon` / `G` のみ。
  **新しい依存もネイティブ変更も無い**（＝この Issue に EAS ビルドは要らない）
- 枠は外周と内周を**1つの `d`** に入れて `fillRule="evenodd"` で帯にする。3種類を9個に散らす
- 2文字（三十・五十）は `G` の `transform="translate(...) scale(0.46,0.86)"` で**横に2つ**並べる（縦に積むと1文字に見える。三十が丰になった）
- 状態管理は既存どおり**カスタム hooks + ローカル state のみ**。新しいグローバル状態を入れない
- モーション（`BADGE_STEP_MS` のずらし、満願の押印カーブ、`AccessibilityInfo.isReduceMotionEnabled` の尊重）は**一切変えない**。差し替えるのは中身の絵だけ

### データ構造

```ts
// src/components/common/Seal.tsx
export type SealMark =
  | 'ichi'
  | 'go'
  | 'juu'
  | 'sanjuu'
  | 'gojuu'
  | 'hyaku' // 訪問数＝漢数字
  | 'mangan'
  | 'shiki'
  | 'mitsu'; // 作法・旅のしかた＝紋

interface Props {
  mark: SealMark;
  earned: boolean; // まだなら同じ絵を薄く出す
  size: number;
  opacity?: number; // 御朱印の上に押したときだけ 0.9
}

// src/types/badge.ts
export interface Badge {
  id: string;
  name: string;
  description: string;
  mark: SealMark; // ← icon: string を置き換え
  axis: BadgeAxis;
  condition: BadgeCondition;
}
export interface BadgeDistance {
  current: number;
  target: number;
  unit: string;
}

// src/services/badges.ts
export function distanceOf(condition: BadgeCondition, progress: BadgeProgress): BadgeDistance;
export function nearestUnearned(progress: BadgeProgress): Badge | null;
```

**印の割り当てと枠**（試作 `BADGES` の `g` / `f` と同じ）

| バッジ id      | 軸       | mark     | 枠  | 図形                    |
| -------------- | -------- | -------- | --- | ----------------------- |
| `mangan`       | practice | `mangan` | 0   | 12個の丸が閉じた環      |
| `four-seasons` | journey  | `shiki`  | 1   | 四弁（4つの円の重なり） |
| `same-day-3`   | journey  | `mitsu`  | 2   | 三つ巴                  |
| `first-stamp`  | count    | `ichi`   | 1   | 一                      |
| `visit-5`      | count    | `go`     | 2   | 五                      |
| `visit-10`     | count    | `juu`    | 0   | 十                      |
| `visit-30`     | count    | `sanjuu` | 2   | 三十（横に2文字）       |
| `visit-50`     | count    | `gojuu`  | 0   | 五十（横に2文字）       |
| `visit-100`    | count    | `hyaku`  | 1   | 百                      |

**進捗の単位**（`distanceOf` が条件の型から返す）

| `condition.type`  | current             | target      | unit   |
| ----------------- | ------------------- | ----------- | ------ |
| `visit_count`     | `visitCount`        | `threshold` | `箇所` |
| `tsukimairi`      | `longestTsukimairi` | `threshold` | `ヶ月` |
| `four_seasons`    | `seasonCount`       | `4`         | `つ`   |
| `same_day_visits` | `maxSameDayVisits`  | `threshold` | `つ`   |

### 画面仕様

**あゆみ**（`MainTabs > あゆみタブ > CollectionList`。日本地図 → 最近の参拝 → 月参り → **印** → 巡礼チャレンジ）

```
┌ Card ─────────────────────────────┐
│ 印                        7 / 9   │  ← 左 h3 / 右 caption（testID seal-count）
│ 作法                              │  ← 軸ラベル（説明文は無し）
│   [満願]                          │  ← 3列グリッド。1セル width 33.33%
│ 旅のしかた                        │
│   [四季を巡る] [1日に3箇所]       │
│ 訪問数                            │
│   [一][五][十]                    │
│   [三十][五十][百]                │
│        あと16箇所                 │  ← 未獲得のうち最も近い1つだけ（朱）
└───────────────────────────────────┘
```

**保存直後**（記録 → 保存 → `RecordComplete`）

- 大きい印（`mangan-seal`、120px、`-8deg`、`opacity 0.9`）＝ 御朱印の上に押される**演出**
- 小さい印（`new-badge-{id}`、50px、傾けない）＝ 下に整列して残る**記録**
- 満願は両方に出る（`2026-09-tsukimairi-spec.md` §4-4。役割が違う）

## テスト方針

- 図形は **`react-native-svg` のプリミティブの数と `d` 文字列**で見る。ピクセル比較はしない
- 色は `react-native-svg` が ARGB 数値に正規化するので、期待値も同じ形に変換して比べる
  （`JapanMap.test.tsx` と同じやり方: `const asPayload = (hex: string) => 0xff000000 + parseInt(hex.slice(1), 16)`）
- `seal-frame` / `seal-mark` の testID は印1つにつき1組なので、複数の印が出る画面では
  `within(getByTestId('badge-{id}')).getByTestId('seal-frame')` で絞る
- `distanceOf` / `nearestUnearned` は**純関数**として単体テストで見る（画面を通さない）
- モーションは既存どおり fake timers + `AccessibilityInfo.isReduceMotionEnabled` のモックで節目だけ見る
- **native-only は無い**。`react-native-svg` も `Animated` も Expo Web で動く。
  見た目の最終確認は `npx expo start --web --port 8081` → あゆみタブ／記録→保存 で足りる。Maestro フローの追加は不要

### 書き直しが要る既存テスト

| ファイル                                              | 箇所                                                 | 直し方                                                                                |
| ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/screens/__tests__/CollectionScreen.test.tsx`     | `jest.mock('@services/badges')`                      | `distanceOf` / `nearestUnearned` を足す（**済** `66a51fd`。無い間は25件が落ちていた） |
| 同上                                                  | 「バッジが BADGE_DEFINITIONS に基づいて表示される」  | `getByText('獲得バッジ')` → `getByText('印')`（**済** 3箇所）                         |
| 同上                                                  | 「未獲得のバッジも、その絵のまま薄く出す」           | 絵文字 `Text` の opacity ではなく `seal-mark` の fill payload を見る（**済**）        |
| 同上                                                  | 「バッジを軸ごとに分けて出す」                       | そのまま（`badge-axis-*` と `inAxis.length === 0` の間引きは維持）                    |
| `src/services/__tests__/badges.test.ts`               | `expect(badge.icon).toBeTruthy()`                    | `badge.mark` を見る（済）＋ `distanceOf` / `nearestUnearned` を追加（済）             |
| `src/screens/__tests__/RecordCompleteScreen.test.tsx` | `icon: '⛩'` 等のリテラル（L115/180/181/207/224/290） | `mark: 'mangan' as const` 等に（済）。満願の回に `opacity 0.9` の assert を足す       |
| `src/screens/__tests__/RecordScreen.test.tsx`         | L318 / L1250 の `icon` リテラル                      | `mark` に（済）。渡す形が変わるだけで振る舞いは同じ                                   |

⚠️ `RecordCompleteScreen.test.tsx` / `RecordScreen.test.tsx` は型を直しただけでは**形だけ緑**になる。
`mark` を渡していない `badges` でも Seal は例外を投げず枠なしで描かれるため、テストは通ってしまう。
AC C-1 / C-2 の assert（印が実際に描かれていること）を足して初めて中身を見たことになる。

## 受入基準（Acceptance Criteria）

### A. 印そのもの（`src/components/common/Seal.tsx`）

- [x] **A-1**: `SEAL_MARKS` は9種類（`ichi` `go` `juu` `sanjuu` `gojuu` `hyaku` `mangan` `shiki` `mitsu`）。現状 PASS
- [x] **A-2**: 9種類すべてで `seal-frame` の `d` が非空、`seal-mark` の children が非空（空の印が混ざっていない）。現状 PASS
- [x] **A-3**: `seal-frame` は `fillRule` が `0`（evenodd の正規化値）で、`d` に `M` が**ちょうど2つ**（外周＋内周の帯）。現状 PASS
- [x] **A-4**: 枠の `d` は9種類を通じて**ちょうど3通り**。現状 PASS
- [x] **A-5**: `earned` が true なら `seal-frame` と `seal-mark` の fill payload が `colors.seal`（`#C2342B`）、false なら `colors.sealEmpty`（`#D3D6DC`）。現状 PASS
- [x] **A-6**: `opacity` 未指定なら `Svg` の `opacity` は `undefined`、`opacity={0.9}` を渡したときだけ `0.9`。現状 PASS
- [ ] **A-7**: `Seal` は `Text` を1つも描かない（`render(<Seal .../>).UNSAFE_queryAllByType(Text)` が長さ0）。フォントに依存しないことの機械チェック。現状 **FAIL**（テスト未追加。実装は満たしている）
- [ ] **A-8**: 各 mark が承認デザインどおりの図形数で描かれる（下表。`Path` は枠の1本を含む）。現状 **FAIL**（テスト未追加。実装は満たしている）

| mark     | `Rect` | `Circle` | `Path` | `Polygon` | `G` |
| -------- | ------ | -------- | ------ | --------- | --- |
| `ichi`   | 1      | 0        | 1      | 0         | 2   |
| `go`     | 4      | 0        | 2      | 1         | 2   |
| `juu`    | 2      | 0        | 1      | 0         | 2   |
| `sanjuu` | 5      | 0        | 1      | 0         | 4   |
| `gojuu`  | 6      | 0        | 2      | 1         | 4   |
| `hyaku`  | 6      | 0        | 2      | 1         | 2   |
| `mangan` | 0      | 12       | 1      | 0         | 2   |
| `shiki`  | 0      | 4        | 1      | 0         | 2   |
| `mitsu`  | 0      | 0        | 4      | 0         | 2   |

この数は `UNSAFE_queryAllByType()` で実測した値（2026-09-21）。react-native-svg の作りが2つ効いている。

- `Svg` が children を `G` で包むので、**`G` の基準値は2**（`Svg` の内側の1つ＋`seal-mark`）。`sanjuu` / `gojuu` は2文字を横に並べる `G` が2つ増えて4
- `Polygon` は内部で `Path` を描くので、**`Polygon` は `Path` としても数えられる**（`go` / `gojuu` / `hyaku` の `Path` が2）。`mitsu` の4は枠1＋三つ巴3

### B. あゆみ画面（`MainTabs > あゆみタブ > CollectionList`）

- [x] **B-1**: 節の見出しが `印`。`獲得バッジ` という文字列は画面に無い。現状 PASS
- [x] **B-2**: `seal-count` のテキストが `{獲得数} / {getAllBadges().length}`（例: 獲得3個・定義5個のモックなら `3 / 5`）。**9 をリテラルで書かない**。現状 PASS（5個モックで `3 / 5` を assert 済み）
- [ ] **B-3**: 軸ラベルは `作法` / `旅のしかた` / `訪問数` のみ。`神社や寺に、もとからあるもの` / `出かける理由を増やす` / `これまでどおり` は画面に無い。現状 PASS（テスト無し）
- [ ] **B-4**: `badge-axis-{axis}` の中に `horizontal` な `ScrollView` が**0個**（`UNSAFE_queryAllByType(ScrollView).filter(s => s.props.horizontal)` が空）。現状 **形だけ緑**（「印は横スクロールせず、ぜんぶ並べる」は `ayumi-scroll` の数しか見ていない。横 ScrollView は testID を持たないので、戻ってきても気づけない）
- [ ] **B-5**: `badge-axis-count` の中の `badge-{id}` が6個、`badge-axis-journey` が2個、`badge-axis-practice` が1個。未獲得も含めて全部出ている。現状 **形だけ緑**（テストは5個のモックの総数しか見ておらず、軸ごとの数を見ていない）
- [ ] **B-6**: 1セルの幅が `'33.33%'`（3列）。現状 PASS（テスト無し）
- [x] **B-7**: 未獲得のバッジは、同じ印を `colors.sealEmpty` で描く（`within(getByTestId('badge-mangan')).getByTestId('seal-mark')` の fill payload が `colors.sealEmpty`）。鍵アイコンにも空欄にもしない。獲得済みは `colors.seal`。現状 PASS
- [x] **B-8**: `badge-remaining-{id}` は画面全体で**最大1つ**（`getAllByTestId(/^badge-remaining-/)` の長さ ≤ 1）。全部取っていれば0個。現状 PASS（「最大1つ」は assert 済み。**0個になる回（全獲得）は未検証**）
- [x] **B-9**: その1つは `nearestUnearned` が返したバッジのセルに付き、テキストが `あと{target - current}{unit}`（例: visitCount 34 で `visit-50` に `あと16箇所`）。文字色は `colors.seal`。現状 PASS（文字列は assert 済み、色は未検証）
- [ ] **B-10**: 各セルに `accessibilityLabel` があり、獲得済みは `{name}、獲得済み`、未獲得は `{name}、まだ`。状態が色だけの違いにならないようにする。現状 **FAIL**（未実装）
- [ ] **B-11**: バッジ節は `Card`（白・角丸）の中にある。現状 PASS（テスト無し）

### C. 保存直後（記録 → 保存 → `RecordComplete`）

- [ ] **C-1**: `new-badge-{id}` の中に `Seal`（`seal-frame` が1つ）があり、丸い `View` も絵文字 `Text` も無い。`new-badge-{id}` 配下の `Text` はバッジ名の**1つだけ**。印の大きさは 50。現状 **形だけ緑**（既存テストは `new-badge-{id}` の存在しか見ない。`mark` を渡し忘れても緑のまま）
- [ ] **C-2**: `mangan-seal`（`stampImageUrl` を渡さない回で検証）の中身が `mark="mangan"` の `Seal`、大きさ 120、`Svg` の `opacity` が `0.9`。`満願` という**文字は描かれない**（`within(getByTestId('mangan-seal')).queryByText('満願')` が null）。現状 **FAIL**（テスト未追加。実装は満たしている）
- [ ] **C-3**: `mangan-seal` の transform に `{ rotate: '-8deg' }` が残っている（演出＝大きい・傾く）。現状 PASS（テスト無し。`ManganSeal.test.tsx` は存在しない）
- [ ] **C-4**: `new-badge-{id}` の transform に `rotate` が無い（記録＝小さい・まっすぐ）。現状 PASS（テスト無し）
- [ ] **C-5**: `BADGE_STEP_MS === 150` / `SEAL_MS === 500`、`isReduceMotionEnabled()` が true のとき最終状態を即座に出す。現状 PASS（テスト無し。`NewBadgeRow` / `ManganSeal` の単体テストが無く、`RecordCompleteScreen.test.tsx` も動きを見ていない）
- [x] **C-6**: 満願のとき `mangan-seal` と `new-badge-mangan` と `mangan-note` の3つが出る（既存の振る舞いを壊していない）。現状 PASS

### D. 割り当てと進捗（`src/services/badges.ts`）

- [x] **D-1**: 9個のバッジすべてが `mark` を持ち、`mark` は**重複しない**。現状 PASS
- [ ] **D-2**: 印と枠の割り当てが「データ構造」の表と一致する。枠は `seal-frame` の `d` の一致で見る（`mangan` = `juu` = `gojuu` / `shiki` = `ichi` = `hyaku` / `mitsu` = `go` = `sanjuu` の3組）。現状 **FAIL**（`mark` の割り当てはテスト済みだが、A-4 は「3通りある」ことしか見ておらず、どれがどの枠かは見ていない）
- [x] **D-3**: `distanceOf` が4種類の条件すべてから `{ current, target, unit }` を返す（表のとおり）。現状 PASS
- [x] **D-4**: `nearestUnearned` は**残り数ではなく `current / target` の比が最大**の未獲得バッジを返す。例: `visitCount 48, seasonCount 3` → `visit-50`（0.96 > 0.75）。現状 PASS
- [x] **D-5**: 全部獲得していれば `nearestUnearned` は `null`。何も記録が無ければ `first-stamp`。現状 PASS
- [x] **D-6**: 比が同率のときは `BADGE_DEFINITIONS` の**定義順が先**のものを返す（毎回同じものが出る）。現状 PASS（記録0（全部 0/target で同率）→ `first-stamp` を assert 済み）
- [x] **D-7**: `isEarned` / `evaluateNewBadges` の判定結果は今回の変更で変わらない（しきい値・種類は不変）。現状 PASS

### E. 品質

- [x] **E-1**: `npm test` が全て通る。現状 PASS（112 suites / 1424 tests、2026-09-21 実測）
- [x] **E-2**: `npm run typecheck` にエラーが無い。現状 PASS
- [x] **E-3**: `npm run lint` にエラーが無い。現状 PASS（0 errors / 15 warnings。警告は既存の `require()` のみで、この Issue で増えていない）
- [ ] **E-4**: `src/` に `#C2342B` / `#D3D6DC` の直値が無い（`colors.seal` / `colors.sealEmpty` 経由）。`theme.test.ts` がこの2値を assert する。現状 PASS（テスト無し）
- [ ] **E-5**: バッジ関連のコードに絵文字が**描画として**残っていない（`grep -n "🎊\|🏆\|👑\|⛩\|🌸\|👣\|🌟" src/services/badges.ts src/components/record/*.tsx src/components/common/Seal.tsx src/screens/CollectionScreen.tsx` の結果が、`Seal.tsx` 冒頭の由来を書いたコメント1行だけ）。保存直後の `🗾 {県}、はじめて` チップは対象外。現状 PASS（実測: コメント1件のみ）
- [ ] **E-6**: `docs/design/ui-design.md` §4.8 のバッジの色の記述が朱／薄い灰に直っている。現状 **FAIL**

## スライス（1スライス = 1コミット）

| #   | コミット                                                           | 中身                                                                                                                | 先に赤にするテスト                                                | 状態                                           |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| S1  | `feat: 印を彫る（SVG のみ、フォントを使わない）`                   | `Seal.tsx` ＋ `colors.seal` / `colors.sealEmpty`。既存画面は無変更                                                  | `Seal.test.tsx`（A-1〜A-8）                                       | **済** `75dd0e1`（A-7 / A-8 が未追加）         |
| S2  | `feat: バッジに印を割り当て、条件までの道のりを読めるようにする`   | `types/badge.ts`（`icon`→`mark`）、`badges.ts`（割り当て・`distanceOf`・`nearestUnearned`）、`navigation/types.ts`  | `badges.test.ts`（D-1〜D-6）                                      | **済** `2e8fc0e`（D-6 が未追加）               |
| S3  | `feat: 保存直後のバッジも同じ印にする`                             | `NewBadgeRow` / `ManganSeal` を `Seal` に。`navigation/types.ts` の `badges?` の型もここ。モーションは触らない      | `RecordCompleteScreen.test.tsx`（C-1・C-2・C-4）                  | **済**（`66a51fd` に S4 と同居。テスト未追加） |
| S4  | `feat: あゆみの印を3列グリッドにして、いちばん近い1つに進捗を出す` | `CollectionScreen` の節を Card＋グリッドに。見出し「印」＋ `seal-count`、`badge-remaining-{id}`、軸の説明文を落とす | `CollectionScreen.test.tsx`（B-1〜B-9。**既存 mock の補修が先**） | **済** `66a51fd`                               |
| S5  | `test: 印が承認デザインどおりに彫られていることを見る`             | A-7 / A-8 / D-2 / B-4 / B-5 / C-1 / C-2 / C-4 の assert を足す（**実装は変えない**）                                | 足したテストがまず赤になることを確認してから実装に合わせる        | 進行中（A-7 は作業ツリーに入った）             |
| S6  | `feat: 印の獲得状況を読み上げに渡す`                               | あゆみのセルに `accessibilityLabel`（B-10）                                                                         | `CollectionScreen.test.tsx`（B-10）                               | 未着手                                         |
| S7  | `docs: バッジの色の記述を印に合わせる`                             | `ui-design.md` §4.8 の1行（E-6）                                                                                    | —                                                                 | 未着手                                         |

S1〜S4 は既に commit 済み（絵と振る舞いは入っている）。**残りは S5 → S6 → S7**。
S5 を1コミットにまとめるのは、どれも「実装を変えずにテストだけ足す」作業で、切ると意味のない粒度になるため。

## スコープ外（やらないこと）

- **バッジの種類・しきい値・軸・獲得条件を変えない**。9個のまま、1 / 5 / 10 / 30 / 50 / 100・12ヶ月・四季・同日3箇所のまま
- **印をタップしたときの詳細表示（モーダル・説明文・獲得日）を作らない**。セルはタップできないまま
- **獲得日時の保存・表示をしない**（`EarnedBadge` は今回使わない）
- **未獲得の進捗を2つ以上出さない**。全部に「あと◯」を並べると、集めた記録を見に来た画面が催促になる
- **モーションを変えない**（`BADGE_STEP_MS` / `SEAL_MS` / カーブ / 遅延 / 傾き -8deg / reduce-motion の扱い）
- **満願の朱印が出る条件と場所を変えない**。現状 `ManganSeal` は御朱印画像が無いとき（`imagePlaceholder` の中）にしか描かれない。
  画像があるときに押されないのは既存の挙動で、**この Issue では直さない**（別 Issue。AC C-2 の検証も画像なしの回で行う）
- **バッジを軸ごとに並べ替えたり、獲得順に並べ替えたりしない**。定義順のまま
- **共有・保存（印の画像書き出し）を作らない**
- **新しい依存を足さない／ネイティブ変更をしない**（＝この Issue のために EAS ビルドを焼き直さない）
- **他画面の絵文字（`🗾 {県}、はじめて` のチップ等）は触らない**

## 注意事項

- **承認されたのは試作 HTML の見た目**。座標を「きれいに」整えない。枠のたわみ・欠け、三の真ん中が短いこと、
  五の2画目が横棒を突き抜けることは意図であって誤差ではない（直すと篆刻の顔が消える／五が互に見える）
- `seal-frame` / `seal-mark` は**印1つにつき1組の testID**。同じ画面に9個出るので、`getByTestId` を素で使うと
  「複数見つかった」で落ちる。必ず `within(getByTestId('badge-{id}'))` で絞る
- `CollectionScreen.test.tsx` の `jest.mock('@services/badges')` は**手書きのモック**。
  サービスに関数を足したらモックにも足す必要がある（今まさにこれで25件落ちている）。
  同じ罠を繰り返さないよう、モックは `jest.requireActual('@services/badges')` を土台にして
  `isEarned` だけ差し替える形に寄せるのが安全
- `mark` を渡さない `badges` を `NewBadgeRow` に流しても例外にならず、枠なしの空の印が出る。
  型が通っていても実データの経路（`RecordScreen` → `navigation.replace('RecordComplete', { badges })`）で
  印が描かれていることを C-1 で必ず見る
- 進捗表示（「あと16箇所」）は `2026-09-tsukimairi-spec.md` §4-3 の「バッジが賞品にならないように」と張り合う。
  **1つだけに出す**ことでバランスを取っている（決定事項7）。数を増やす変更は要件の変更であって実装判断ではない
- `src/types/badge.ts` が `@components/common/Seal` から `SealMark` を import している（型 → コンポーネントの逆向き）。
  今は循環しないので動いているが、気になるなら `SealMark` を `types/badge.ts` へ移して `Seal` 側が import する形にできる。**この Issue では必須にしない**
- 未獲得の色 `#D3D6DC` は背景（`colors.white` のカード）に対してコントラストが低い。これは
  「まだ押されていない印」を表す意図的な弱さで、**情報はセル下の名前テキストが担う**。B-10 の `accessibilityLabel` で
  状態を読み上げに渡すこと（色だけに載せない）
