# Issue #282: 「調べずに、地図で場所を決める」を、AI で見つからなかったときだけ出す

## 概要

「調べて追加」のシートで、地域を聞く画面（⓪ `asking`。「変える」から来た ⓪' `redo: true` も含む）と調べている間（② `researching`）から、枠線ボタン「調べずに、地図で場所を決める」を外す。地図で決める（④）へ進めるのは、調べたあとの次の4か所だけにする（どれも今と同じ場所・文言）。

- 見つかりませんでした（`notFound`）の「地図で場所を決める」
- 調べられませんでした（`error`）の「地図で場所を決める」
- 今日の回数の上限（`limit`）の「地図で場所を決める」
- 候補（`candidates`）の「どれでもない（地図で決める）」

背景: オーナーから「地図でユーザーが決めた場所と名前は正確である保証がない。AI の調査はちゃんと調べるので今の仕様でよいが、調べずに地図で決めるのは微妙」（2026-09-27）。地図で決めた寺社は今も add-spot で必ず pending（本人の地図にだけ出る）だが、調べずに済ませる入口が目立つと、確かめられていない寺社が増える。ボタンを無くしきると AI で見つからない・通信エラー・上限のときに記録できなくなる（記録にスポットが必須）ので、**AI で見つからない時だけ出す**。

## 関連ドキュメント

- Issue: `gh issue view 282`
- 今の文言・testID の出典: [`issue-248-spot-add-research.md`](./issue-248-spot-add-research.md)（画面仕様 ②③②'・UI-4・UI-6）、[`issue-277-spot-research-region.md`](./issue-277-spot-research-region.md)（D-9・D-11・UI-1・UI-6・UI-7・UI-11）
- 画面仕様: [`docs/design/ui-design.md`](../design/ui-design.md) の「5. モーダル仕様」スポット追加の行
- Web・シミュレータでの確認のやり方: #277 の「UI 基準: Expo Web」「UI 基準: シミュレータ」

## 詳細設計

### いまのコード（前提の確認）

| 場所                                                         | いまの状態                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/record/SpotResearchSheet.tsx`                | `manualButton(title, variant)`（`Button`・`testID="research-open-manual"`・`disabled={saving}`）を5か所で使う: `asking`（`RegionAsk` の `children`、「調べずに、地図で場所を決める」outline）/ `researching`（同 outline）/ `notFound`（「地図で場所を決める」primary）/ `error`（同 outline）/ `limit`（同 primary）。`candidates`・`saving` は文字ボタン「どれでもない（地図で決める）」（`research-none`）。コンポーネントの説明コメント（267 行目）は「どの状態でも押せる（④へ）」 |
| `src/components/record/SpotResearchSheet.tsx` の `RegionAsk` | 末尾が `<View style={styles.gap} />{children}`（`children` は地図のボタンだけ）                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/hooks/useSpotAdd.ts`                                    | `openManual` は状態を見ずに `askingName = null`・`requestId++`・`status: 'manual'`・`placing: true` にする                                                                                                                                                                                                                                                                                                                                                                             |
| `src/screens/RecordScreen.tsx`                               | `onOpenManual={spotAdd.openManual}` をシートに渡すだけ（`openManual` を呼ぶのはシートだけ）                                                                                                                                                                                                                                                                                                                                                                                            |
| `e2e/`                                                       | 「調べて追加」のフローは無い                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### 設計上の決定（この契約で確定する）

| #   | 決定                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 理由                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | **出す所**: 下の表のとおり。「出す」の4か所は testID・文言・`variant`・置き場所を今のまま変えない。<br>`asking`（`redo: false`）: 出さない / `asking`（`redo: true`＝⓪'）: 出さない / `researching`: 出さない / `notFound`: `research-open-manual`「地図で場所を決める」`primary`（地域の行の下）/ `error`: `research-open-manual`「地図で場所を決める」`outline`（「もう一度調べる」の下）/ `limit`: `research-open-manual`「地図で場所を決める」`primary` / `candidates`・`saving`: `research-none`「どれでもない（地図で決める）」（保存中は押せない）                                      | Issue のスコープとオーナーの判断「AI で見つからない時だけ出す」。⓪' も `asking` なので出さない（「調べずに」の入口であることは ⓪ と同じ）                                                                                                                         |
| D-2 | **フック（`useSpotAdd`）は変えない**。出す・出さないはシートだけで決める。`openManual` に状態の守りを足さない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `openManual` を呼ぶのはシートだけ（`RecordScreen.tsx` はそのまま渡す）。守りを足すと `state.status` を見る閉包（同じ描画の中では古い値。#277 の D-2 と同じ落とし穴）と、`requestId`・`askingName` を倒す順番を組み直すことになり、この Issue の小ささに見合わない |
| D-3 | **外したあとの見た目**: `RegionAsk` から `children` の prop と末尾の `<View style={styles.gap} />` を消す（⓪ の最後は「ほかの地域を入れる」、開いたあとは入力欄＋「この地域で調べる」、⓪' の最後は回数の知らせ `region-quota`）。`researching` は手順3行（`Steps`）で終わる。`manualButton` は残る3か所（notFound・error・limit）で使い続ける。新しい色・余白・部品は足さない                                                                                                                                                                                                                  | 下に余った `spacing.lg` の隙間を残さない。シートの下の余白は `Modal`（`variant="bottom"`）の `padding` が持つ                                                                                                                                                     |
| D-4 | **説明コメント**: `SpotResearchSheet` の説明（267 行目）の「「調べずに、地図で場所を決める」はどの状態でも押せる（④へ）」を「地図で決める（④）へは、調べたあと（見つからない・調べられない・上限・どれでもない）からだけ進める（Issue #282）」に替える                                                                                                                                                                                                                                                                                                                                         | 次に読む人が #248 の「いつでも押せる」を前提にしないように                                                                                                                                                                                                        |
| D-5 | **`docs/design/ui-design.md` の書き換え**: 「5. モーダル仕様」のスポット追加の行の内容を、次の一文にそのまま替える（表の列幅は `npx prettier --write docs/design/ui-design.md` でそろえる）。<br>「⓪ 地域を聞く（あなたの記録の県・全国から・ほかの地域。選ぶとすぐ調べる。Issue #277）→ ② 調べています（地域の行）→ ③ これですか？（候補カード・ここです・どれでもない（地図で決める））/ 見つからない・調べられない・今日の回数の上限（地図で場所を決める）→ ④ 全画面で地図の中心にピンを合わせ、名前と種別（Issue #248）。④ へは調べたあとからだけ進み、⓪・② からは進めない（Issue #282）」 | ui-design.md が今の画面仕様の正（docs/README.md）。ここで「調べずに」が消える                                                                                                                                                                                     |
| D-6 | **過去の文書は書き換えない**: `issue-248-spot-add-research.md`・`issue-277-spot-research-region.md`・`docs/design/2026-09-spot-add-spec.md`（42・50 行目の「いつでも押せる」）・`docs/design/mockups/2026-09-spot-add-v1.html`・`2026-09-spot-research-region-v1.html`                                                                                                                                                                                                                                                                                                                         | その時点の契約・要件・承認試作の記録。今の仕様は ui-design.md（D-5）とこの契約書で読む                                                                                                                                                                            |

### 対象ファイル

| ファイル                                                                                                  | 変更                                                                                                                               | スライス |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/components/record/SpotResearchSheet.tsx`                                                             | `asking`・`researching` の `manualButton(...)` を消す / `RegionAsk` の `children`・末尾の `gap` を消す（D-3）/ 説明コメント（D-4） | S1       |
| `src/components/record/__tests__/SpotResearchSheet.test.tsx`                                              | 書き換え（下の「既存テストの書き換え」）                                                                                           | S1       |
| `src/hooks/__tests__/useSpotAdd.test.ts`                                                                  | 書き換え（同上）。`src/hooks/useSpotAdd.ts` は変えない（D-2）                                                                      | S1       |
| `docs/design/ui-design.md`                                                                                | スポット追加の行（D-5）                                                                                                            | S1       |
| `.claude/harness/progress.md`・`.claude/harness/feature-list.json`・`.claude/harness/evidence/issue-282/` | 確認結果と証跡                                                                                                                     | S2       |

**変えないもの**: `src/hooks/useSpotAdd.ts`・`src/screens/RecordScreen.tsx`・`src/components/record/SpotPlacePicker.tsx`・`src/services/`・`supabase/`（add-spot・research-spot・1日10回の上限）。DB・API の変更は無い。

### 画面仕様

到達手順（共通）: ログインした状態で 地図タブ → 記録ボタン →「御朱印を記録」→「スポット」の検索欄にマスタに無い寺社の名前を2文字以上入れる →「「{名前}」を調べて追加」。

| #   | シート               | #282 のあと（下の端）                                                                                    |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| ⓪   | 地域を聞く           | 「ほかの地域を入れる」で終わる（開いたあとは入力欄＋「この地域で調べる」）。地図のボタンは無い           |
| ⓪'  | 地域を決めて調べ直す | 「調べ直すと、今日の回数（10回）を1回使います」で終わる。地図のボタンは無い                              |
| ②   | 調べています         | 手順3行で終わる。地図のボタンは無い                                                                      |
| ③   | これですか？         | 今のまま（「ここです」/「どれでもない（地図で決める）」/ 注記）                                          |
| ②'  | 見つからない等       | 今のまま（notFound・limit は主ボタン「地図で場所を決める」、error は「もう一度調べる」＋枠線ボタン同文） |
| ④   | 場所を決める         | 今のまま                                                                                                 |

## スライス（1スライス = 1コミット、TDD）

| #   | コミット（Conventional Commits）                                                        | 中身                                                                                                               | 基準                    |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| S1  | `feat: 「調べずに、地図で場所を決める」を外し、地図で決めるのは調べたあとだけに (#282)` | 先にシートのテストを UI-1〜4 の形に書き換えて Red → シートを直して Green。フックのテストの書き換え・ui-design.md   | AC-1 / UI-1〜8 / Q-1〜5 |
| S2  | `docs: #282 の Expo Web とシミュレータでの確認結果と証跡`                               | UI-9〜11 を確かめ、`progress.md`・`feature-list.json`（`ISSUE-282`）・証跡。直すところが出たら別の `fix:` コミット | UI-9〜11                |

### 既存テストの書き換え（必要なもの）

- **`src/components/record/__tests__/SpotResearchSheet.test.tsx`**
  - 冒頭の契約書コメントに `docs/issues/issue-282-manual-after-research.md（S1 / UI-1〜UI-8）` を足す
  - 49〜64 行「調べている間: 名前・「{地域} で探しています」・「調べずに、地図で場所を決める」。…」→ 題名から「調べずに…」を外し、最後の「押すと `onOpenManual`」（62〜63 行）を「`research-open-manual` と `/地図で/` が無い」に替える（UI-4）。66〜79 行（手がかりが無いとき）にも同じ「無い」を足す
  - 169〜201 行（⓪ の文言の並び）: 確かめる文言の一覧から「調べずに、地図で場所を決める」を外し、「無い」を足す（UI-1）。題名の「・地図で」も外す
  - 288〜296 行「「調べずに、地図で場所を決める」は onOpenManual だけ（調べない）」→ 消して UI-2（「ほかの地域を入れる」を開いたあとも無い）に置き換える
  - 429〜458 行（調べ直し `redo`）: 題名の「地図のボタンの間に」を「「ほかの地域を入れる」の下に」に替える。testID の一覧から `research-open-manual` を、`getByText('調べずに、地図で場所を決める')` を外し、並びの確かめは `region-other` < `region-quota` だけにする。「無い」を足す（UI-3）
  - 81〜102 行（notFound / error / limit の `it.each`）・104〜131 行（候補）は残し、UI-5〜8 の確かめ（`variant` のスタイル・並び・`research-none` を押す・保存中は押せない）を足す（別の `it` でもよい）
  - そのままで通るもの: 322〜373 行（調べたあとの地域の行。error / limit の `getAllByText(/地図で場所を決める/)` を含む）・376〜427 行の「変える」のテスト
- **`src/hooks/__tests__/useSpotAdd.test.ts`**（`useSpotAdd.ts` は変えないので、今のままでも通る。仕様と食い違う題名・道筋だけ直す）
  - 冒頭の契約書コメントに `docs/issues/issue-282-manual-after-research.md（S1 / AC-1）` を足す
  - 164〜182 行「地図で決める → 保存で add-spot（manual）の結果を渡す。調べている最中からでも開ける」→ `researchSpot` を `{ kind: 'ok', researchId: 'r1', candidates: [] }` で解決させて `notFound` にしてから `openManual` する形に替え、題名を「見つからないとき、地図で決める → 保存で add-spot（manual）の結果を渡す」にする（AC-1）
  - 195〜202 行「地域を聞いている間に「調べずに、地図で場所を決める」を開ける。調べない」→ 中身はそのまま、題名を「openManual は状態を見ない（出す所はシートが決める。#282 D-2）。asking から呼んでも調べない」に替える
- **`src/screens/__tests__/RecordScreen.test.tsx`**・**`e2e/`**: 変更なし（「調べずに、地図で場所を決める」・`research-open-manual`・`research-none` を使うテストが無い）

## テスト方針

- **シート**（S1）: 今のテストと同じく `state` を渡して描き、何が出る・出ないか、押すと何が呼ばれるかを見る。「出ない」は `queryByTestId('research-open-manual')` と `queryAllByText(/地図で/)` の両方で見る（testID を付け替えただけの取り残しも拾う）。`variant` は `StyleSheet.flatten(getByTestId('research-open-manual').props.style)` で見る。並びは `JSON.stringify(ui.toJSON())` の中の testID の位置で見る（今のテストと同じやり方）
- **フック**（S1）: 変えない。題名・道筋の書き換えだけ
- **Expo Web / シミュレータ**（S2）: Web は ⓪ と error（未ログインで research-spot が 401）の2画面。② の間は Web では一瞬で error になるので、シミュレータで録画して見る
- Maestro のフローは足さない（research-spot は Claude と1日10回の枠を使い、結果が毎回同じにならない。#277 と同じ）

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準で合否を判定する。

### 機能基準（Jest。対象: `useSpotAdd`）

- [ ] AC-1: `start('鹿島台神社')` → `pick(null)` で `researchSpot` が `{ kind: 'ok', researchId: 'r1', candidates: [] }` を返して `state.status === 'notFound'` になったあと、`openManual()` を呼ぶと `state.status === 'manual'`・`state.placing === true`。続けて `saveManual({ name: '鹿島台神社', type: 'shrine', lat: 38.4, lng: 141.0 })` を呼ぶと `addManualSpot` がその値で1回呼ばれ、`onAdded` に `addManualSpot` の結果が渡り、`state.status === 'idle'`・`state.placing === false` になる

### UI 基準: シート（Jest。対象: `SpotResearchSheet`。到達は上の「画面仕様」の共通手順）

- [ ] UI-1: `status: 'asking'`・`redo: false`・`name: '八幡神社'`・`recentPrefectures: ['宮城県', '京都府', '東京都']` のとき、`research-open-manual` と `research-none` は無く、`queryAllByText(/地図で/)` が0件。「「八幡神社」を調べます」と `region-other`（「ほかの地域を入れる」）はある
- [ ] UI-2: `status: 'asking'`・`recentPrefectures: []` で `region-other` を押して `region-input`・`region-submit`（「この地域で調べる」）が出たあとも、`research-open-manual` は無く、`queryAllByText(/地図で/)` が0件
- [ ] UI-3: `status: 'asking'`・`redo: true`・`recentPrefectures: ['宮城県']` のとき、`research-open-manual` は無く、`queryAllByText(/地図で/)` が0件。`region-quota`（「調べ直すと、今日の回数（10回）を1回使います」）はあり、`JSON.stringify(ui.toJSON())` の中で `"testID":"region-other"` が `"testID":"region-quota"` より前にある
- [ ] UI-4: `status: 'researching'` で `hint: { prefecture: '宮城県', city: '大崎市' }` のときと `hint: null` のときの両方で、`research-open-manual` は無く、`queryAllByText(/地図で/)` が0件。`hint-line` と「「鹿島台神社」を調べています」はある
- [ ] UI-5: `status: 'notFound'`・`hint: null` のとき、`research-open-manual` の中に「地図で場所を決める」があり、そのスタイル（`StyleSheet.flatten`）の `backgroundColor` が `colors.primary[500]`。ツリーの中で `"testID":"hint-line"` が `"testID":"research-open-manual"` より前にある。押すと `onOpenManual` が1回呼ばれ、`onChangeRegion` は呼ばれない。「調べずに、地図で場所を決める」は無い
- [ ] UI-6: `status: 'error'` のとき、`research-retry`（「もう一度調べる」）と `research-open-manual`（「地図で場所を決める」）があり、ツリーの中で `"testID":"research-retry"` が `"testID":"research-open-manual"` より前にある。`research-open-manual` のスタイルは `borderWidth: 1`・`borderColor: colors.primary[500]`・`backgroundColor: colors.transparent`。押すと `onOpenManual` が1回呼ばれる
- [ ] UI-7: `status: 'limit'` のとき、「今日調べられる回数（10回）を使い切りました」と `research-open-manual`（「地図で場所を決める」、スタイルの `backgroundColor` が `colors.primary[500]`）があり、押すと `onOpenManual` が1回呼ばれる
- [ ] UI-8: `status: 'candidates'`・候補2件のとき、`research-none` の中に「どれでもない（地図で決める）」があり、押すと `onOpenManual` が1回呼ばれる。`research-open-manual` は無い。同じ候補で `status: 'saving'` のときは `research-none` を押しても `onOpenManual` は呼ばれない

### UI 基準: Expo Web（`npx expo start --web --port 8081`。ログインしない）

到達: `http://localhost:8081/?preview=goshuincho` → 下のタブ「御朱印帳」→ ページを左へ送り切り、白紙のページ（「ここに御朱印を追加する」）を押す →「御朱印を記録」→「スポット」の検索欄に `架空稲荷神社` を入れる →「「架空稲荷神社」を調べて追加」（#277 の UI-13 と同じ）。

- [ ] UI-9: シートに「「架空稲荷神社」を調べます」「全国から」「ほかの地域を入れる」が出て、「調べずに、地図で場所を決める」と「地図で」を含む文字はシートのどこにも無い。「ほかの地域を入れる」を押して入力欄と「この地域で調べる」が出たあとも無い。2枚のスクリーンショットを `.claude/harness/evidence/issue-282/` に置く
- [ ] UI-10: 同じシートで「全国から」を押すと（未ログインなので research-spot が失敗する）、「調べられませんでした。通信を確かめてください」「もう一度調べる」「地図で場所を決める」が出る。「地図で場所を決める」を押すと全画面の「場所を決める」が開き、「地図を動かして、ピンを寺社の場所に合わせてください」と、名前欄の `架空稲荷神社` が出る（地図の背景は Web ではスタブ）。保存はしない。それぞれのスクリーンショットを証跡に置く

### UI 基準: シミュレータ（native-only。#277 と同じ Debug ビルド＋`/dev` の Metro。ログイン済みのテスト用アカウント）

- [ ] UI-11: **native-only（シミュレータ・録画）**: 上の到達手順で「「{名前}」を調べて追加」（マスタに無い名前。例 `秋保神社`）→ ⓪ に「調べずに、地図で場所を決める」が無い → 県のチップか「全国から」を押す → ② の手順3行が進む間、シートに「地図で」を含むボタンが無い → 結果が、候補なら「どれでもない（地図で決める）」、見つからないか上限なら「地図で場所を決める」が出て、押すと ④「場所を決める」が開く（‹ で戻り、保存しない）。**research-spot を呼ぶのは1回まで**。どの結果だったかを `progress.md` に書き、録画を証跡に置く

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: 「調べずに」の入口がコードとコメントに残っていない: `grep -rn "調べずに、地図で場所を決める" src --exclude-dir=__tests__` と `grep -n "どの状態でも" src/components/record/SpotResearchSheet.tsx` がどちらも0件。`grep -c "調べずに" docs/design/ui-design.md` が `0`、`grep -c "Issue #282" docs/design/ui-design.md` が `1`
- [ ] Q-5: 変えないものに差分が無い: `git diff 384e0eb --stat -- src/hooks/useSpotAdd.ts src/screens/RecordScreen.tsx src/components/record/SpotPlacePicker.tsx src/services/ supabase/` の出力が空

## やらないこと（スコープ外）

- add-spot・research-spot（Edge Function）・1日10回の上限の変更。地図で決めた寺社が本人だけ（pending）なのは今のまま
- `useSpotAdd`（`openManual` に状態の守りを足すこと。D-2）
- 残す4か所の文言・testID・`variant`・置き場所の変更
- ⓪'（「変える」から来た地域選び）にだけ地図のボタンを残すこと
- 過去の契約書・`2026-09-spot-add-spec.md`・試作 HTML の書き換え（D-6）
- 同じ名前の寺社がマスタにあると「調べて追加」が出ない件（#278）
- Maestro のフロー

## 注意事項

- **④ へ進むには、調べるのが必ず1回要る**（上限に達していれば research-spot がすぐ 429 を返して「地図で場所を決める」が出る）。通信が無いときは、`RESEARCH_TIMEOUT_MS`（25 秒）で打ち切られるか通信エラーになるまで、地図のボタンが出ない。オーナーの判断どおりの引き換え
- **「変える」を押したら戻れない**: 見つからない（②'）で「変える」を押すと ⓪' に移り、そこに地図のボタンは無い。④ へ行くには、もう一度調べる（1回使う）か、閉じて「調べて追加」からやり直す（やはり調べる）。前の結果に戻る手段が無いのは #277 のまま。⓪' にだけ残す場合は `redo` のときだけ地図のボタンを出す小さな変更で済むので、オーナーが望めば別 Issue にする
- **比べる基準は `384e0eb`**: このワークツリーのローカルの `develop` は古い（`527065d`）。`git diff develop` を使わない（Q-5）。`origin/develop` を使うなら取り込みのあとで動いていないか確かめる
- 契約書・ui-design.md は `npx prettier --write` で表をそろえる（lint-staged が md にも prettier をかける）
- Expo Web の確認で Playwright を使うときは、0ms の合成クリックだと押す操作にならないことがある（#274 の記録。押し始めと離しの間を空ける）
