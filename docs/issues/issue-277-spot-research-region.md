# Issue #277: 寺社を調べて追加するとき、調べる前に地域を聞く

## 概要

記録画面のスポット検索で「「〇〇」を調べて追加」を押したとき、**まだ調べずに**、シートの最初で地域を聞く。選択肢は「自分の記録にある県（新しい順に最大3つ）」と「全国から」。**押した瞬間に調べ始める**。一覧に無い地域は「ほかの地域を入れる」で入れる。調べている間は地域を変えるボタンを出さず、調べものが重ならないようにする。候補が出たとき・見つからなかったときだけ「変える」で地域を選び直せる（調べ直すと1日10回の枠を1回使うことを添える）。

背景: いまは押すとすぐ全国で調べ始め（`RecordScreen` の `spotAdd.start(name, null)`）、調べている途中に「地域を絞る」で県名を打っている間に最初の結果が出てしまう。絞り直すと最初の調べものは裏で走ったまま捨てられ、1日10回の枠を2回使う。オーナーが試作 A と C を比べて **A** を選んだ（2026-09-27）。

## 関連ドキュメント

- Issue: `gh issue view 277`
- **承認した試作（正）**: [`docs/design/mockups/2026-09-spot-research-region-v1.html`](../design/mockups/2026-09-spot-research-region-v1.html) の **A（左側）**。文言・順番・見た目はこれに合わせる。**C（右側）は実装しない**
- 元の契約: [`issue-248-spot-add-research.md`](./issue-248-spot-add-research.md)（「実機確認で変えたこと」で、手がかりを端末の位置から作るのをやめた経緯）
- 要件（#248）: [`docs/design/2026-09-spot-add-spec.md`](../design/2026-09-spot-add-spec.md)
- シミュレータでの確認のやり方: [`issue-272-plus-restore-link.md`](./issue-272-plus-restore-link.md) の「シミュレータでの確認」（ローカルの Debug ビルド・`/dev` の Metro）

## 詳細設計

### いまのコード（前提の確認）

| 場所                                                            | いまの状態                                                                                                                                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/RecordScreen.tsx`                                  | `handleResearch = (name) => spotAdd.start(name, null)`。押すとすぐ調べる。シートに `onChangeHint={spotAdd.changeHint}` を渡す                                                                                   |
| `src/hooks/useSpotAdd.ts`                                       | 状態 `idle / researching / candidates / notFound / error / limit / manual / saving`。`start(name, hint)` と `changeHint(hint)` はどちらも `research()` を呼ぶ。`requestId` で古い応答を捨てる（枠は使ったまま） |
| `src/components/record/SpotResearchSheet.tsx`                   | `HintChip` が「{地域} を優先して探しています ・ 変える」/「全国から探しています ・ 地域を絞る」を出し、押すと入力欄（`hint-input`）→「この手がかりで探す」（`hint-submit`）。researching・notFound で出る       |
| `src/utils/spotHint.ts`                                         | `parseHintText`（47都道府県＋「〜市区町村」の形だけ拾う。拾えなければ `null`）/ `formatHint`。**変えない**                                                                                                      |
| `src/services/spotAdd.ts` / `supabase/functions/research-spot/` | 送る本文は `{ name, hint }`。1日10回（Asia/Tokyo）。**変えない**                                                                                                                                                |
| `src/services/collection.ts`                                    | 記録の集計（`fetchRegionStats` / `fetchVisitLog` など）。エラーは `console.warn` して空を返す作り                                                                                                               |
| `src/constants/legal.ts`                                        | プライバシーポリシーは「地域を絞ったときはその都道府県・市区町村名を…送信」。県のチップを押すのは本人が地域を絞る操作なので、**文言はこのままで合う（変更しない）**                                             |

### 流れ（A）

```
SpotSelector「「〇〇」を調べて追加」
 └ ⓪ 地域を聞く（asking）※ まだ調べない。閉じれば回数は使わない
     ├ 県のチップ（あなたの記録から・最大3）/「全国から」→ 押した瞬間に ② へ
     ├「ほかの地域を入れる」→ 入力 →「この地域で調べる」→ ② へ
     └「調べずに、地図で場所を決める」→ ④
 ② 調べています（researching）「{地域} で探しています」※ 変えるボタンなし
     ├ ③ これですか？（candidates）「{地域} で探しました ・ 変える」
     ├ ②' 見つかりませんでした（notFound）「{地域} で探しました ・ 変える」
     │      └「変える」→ ⓪'（調べ直し: 見出し・説明が変わり、回数の知らせが出る）→ 選ぶと ② へ
     ├ 通信エラー・時間切れ（error）… #248 のまま（もう一度調べる / 地図で）
     └ 429（limit）… #248 のまま（地図で）
```

### 設計上の決定（この契約で確定する）

| #    | 決定                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | **状態の持ち方**: `SpotAddStatus` に `'asking'` を足し、`SpotAddState` に `redo: boolean`（「変える」から来た地域選び＝調べ直し）を足す（`IDLE` では `false`）。`start(name: string)` は**調べずに** `{ ...IDLE, status: 'asking', name }` にする（引数から `hint` を外す）。`pick(hint: SpotHint \| null)` で `research(state.name, hint)` を始める。`changeRegion()` は `candidates` / `notFound` のときだけ `{ ...s, status: 'asking', redo: true, candidates: [], researchId: null, saveFailed: false }`（`name`・`hint` はそのまま）にし、`requestId` を1つ進める。それ以外の状態では何もしない。`changeHint` は消す。`retry`（error の「もう一度調べる」＝同じ手がかりで調べ直す）・`choose`・`openManual`・`saveManual`・`close` は今のまま                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 「調べる」と「地域を決める」を分ける。変える操作を結果が出たあとに限ることで、調べものが重ならない（Issue の「調べものが重ならない」）                                                                                                                                                                                                                                                                                                                                                                                              |
| D-2  | **`pick` は1回の地域選びにつき1回だけ効く**。`asking` 以外では何もしない。チップを素早く2回押す・2つのチップを続けて押すなど、同じ描画の中で2回呼ばれても `researchSpot` は1回だけ（`useState` の値は次の描画まで古いので、`useRef` の旗などで守る）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 1回押すごとに1日10回の枠を使う。二度押しで2回分使わせない                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D-3  | **「変える」を出す所**: `researching` は「{地域} で探しています」/「全国から探しています」の**表示だけ**（ボタン・入力欄なし）。`candidates` と `notFound` は「{地域} で探しました」/「全国から探しました」＋「変える」。`error` と `limit` は #248 のまま（「変える」は足さない）。`saving` 中は「変える」を押せない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Issue・試作 A のとおり。試作に error / limit の画面は無いので、ここで決める（error は「もう一度調べる」で足りる。limit はもう調べられない）                                                                                                                                                                                                                                                                                                                                                                                         |
| D-4  | **県の取り方**: `src/services/collection.ts` に `fetchRecentPrefectures(userId: string): Promise<string[]>` を足す。**問い合わせは1本**: `supabase.from('stamps').select(… 'spots!inner(prefecture)' …).eq('user_id', userId).order('visited_at', { ascending: false }).order('created_at', { ascending: false })`。上から順に県を見て、`null`・47都道府県（`PREFECTURE_NAMES`）に無い値・すでに出た県を飛ばし、`RECENT_PREFECTURE_COUNT = 3` 個で打ち切る。`.limit()` は付けない。エラーは `console.warn('fetchRecentPrefectures error:', message)` して `[]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 「新しい順」はこのリポジトリでは御朱印帳・県別シートと同じ `visited_at → created_at`（`fetchAllStamps` / `fetchStampsByPrefecture`）。`limit` を付けると同じ県ばかり記録している人の2・3つ目が落ちる。重さは記録の保存時にすでに全件取っている `fetchVisitLog` より軽い（列が1つ）。県で絞り込むのはサーバーでなく端末で（既存のモックの形でテストできる）。手入力で追加した寺社は `prefecture: null` なので飛ぶ。47 に無い値を送ると research-spot が捨てて全国になるのに画面は「〇〇 で探しています」と出てしまうので、先に落とす |
| D-5  | **取るタイミング**: 新しいフック `src/hooks/useRecentPrefectures.ts`（`useRecentPrefectures(userId: string \| null): string[]`）を `RecordScreen` で使い、**記録画面を開いたときに1回だけ**取る。`userId` が `null`（未ログイン）なら取らずに `[]`。取った一覧は画面を閉じるまで持ち、「変える」のときもそれを使う（取り直さない）。取れなかったら `[]`（フックは例外を外に出さない）。画面を閉じたあとに返った結果で state を書かない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 「調べて追加」を押してから取ると、ほぼ毎回シートが開いてからチップが後から出てきて並びが動く。記録画面を開いてから名前を打って押すまでには数秒あるので、先に取っておけば普通は間に合う。記録を保存すると完了画面に置き換わり、「もう1枚記録する」で記録画面を開き直すので、直前の記録の県も入る                                                                                                                                                                                                                                     |
| D-6  | **取得中・取れない・記録が無い**: シートは待たずにすぐ開く。一覧が空（取得中・未ログイン・0件・エラー）のあいだは「あなたの記録から」の見出しと県のチップを出さず、「全国から」と「ほかの地域を入れる」だけを出す。シートを開いている間に一覧が届いたら、県のチップが「全国から」の前に加わる（状態・調べものには何もしない）。取得中に「全国から」などを押したら、そのまま調べ始める                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Issue の「記録がまだ無い人には全国からとほかの地域を入れるだけ」。スピナーは試作に無い                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D-7  | **手がかりの渡し方（変えない）**: 県のチップ → `{ prefecture: '宮城県', city: null }`、「全国から」→ `null`、「ほかの地域を入れる」→ `parseHintText(入力)`。`parseHintText` が `null`（空・県名も「〜市区町村」も読み取れない）のときも `pick(null)` で全国から調べる（いまの「空なら全国」と同じ。そのとき②の表示は「全国から探しています」になる）。research-spot に送る本文は今と同じ `{ name, hint }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Issue のスコープ外「手がかりの渡し方は今と同じ」                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D-8  | **押した瞬間に調べる**: チップ・「この地域で調べる」は押したらすぐ `pick` を呼ぶ。試作 A にある「押したチップが 160ms 朱色になってから調べる」待ちと色の変化は入れない（押した手応えは `TouchableOpacity` の `activeOpacity`）。入力欄で確定キー（`onSubmitEditing`）を押しても「この地域で調べる」と同じ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 状態がすぐ `researching` に変わるので、色を付けても見えない。わざと待たせると D-2 の守りが複雑になる                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D-9  | **文言（試作 A のとおり。一字一句）**: ⓪ 見出し「「{name}」を調べます」/ 説明「どのあたりの寺社ですか？ 選ぶとすぐ調べ始めます。」/ 見出し「あなたの記録から」（県が1つ以上あるときだけ）/ チップ「{県名}」…「全国から」/ 文字ボタン「ほかの地域を入れる」→ 入力欄のプレースホルダー「例: 宮城県 仙台市」＋枠線ボタン「この地域で調べる」/ 枠線ボタン「調べずに、地図で場所を決める」。⓪'（`redo: true`）見出し「地域を決めて調べ直す」/ 説明「選ぶとすぐ調べ直します。」/ 回数の知らせ「調べ直すと、今日の回数（10回）を1回使います」（「ほかの地域を入れる」の下、「調べずに、地図で場所を決める」の上）。② 地域の行「{formatHint} で探しています」/「全国から探しています」。③・②' 地域の行「{formatHint} で探しました」/「全国から探しました」＋「変える」。`{formatHint}` と「で」の間は半角スペース1つ（例「宮城県 仙台市 で探しています」）                                                                                                                                                                                                                                                                                                                                                                                                                    | 試作 A の `askBody()` / `hintLine()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D-10 | **見た目（トークン）**: チップ = `flexDirection: 'row'`・`gap: spacing.xs`・`borderWidth: 1`・`borderColor: colors.gray[200]`・`backgroundColor: colors.white`・`borderRadius: borderRadius.full`・`paddingVertical: spacing.sm`・`paddingHorizontal: spacing.md`。文字 `typography.bodySmall`＋`fontWeight: '600'`・`colors.gray[800]`。アイコンは MaterialIcons（県 `place` / 全国から `public`、`size={16}`、`colors.gray[500]`）。「全国から」だけ `backgroundColor: colors.gray[100]`・`borderColor: colors.gray[100]`。チップの並び = `flexDirection: 'row'`・`flexWrap: 'wrap'`・`gap: spacing.sm`。「あなたの記録から」= `typography.caption`＋`fontWeight: '700'`・`colors.gray[500]`・`marginTop: spacing.xs`・`marginBottom: spacing.sm`。「ほかの地域を入れる」= 今の `hintChange`（`typography.caption`＋`'700'`・`colors.primary[600]`）＋`marginTop: spacing.md`。入力欄は今の `hintInput` のまま、入力欄とボタンの間は `gap: spacing.sm`。回数の知らせ = `typography.caption`・`colors.gray[500]`・`marginTop: spacing.sm`。地図のボタンの上は今の `gap`（`spacing.lg`）。地域の行は今の `hint`（`colors.gray[100]` の丸い帯・`place` アイコン）を使い、③では説明文と候補カードの間（下に `spacing.sm`）、②'では見出しの下（上に `spacing.sm`）に置く | 試作の `8px 14px`・`10px` はトークンに無いので、近いトークン（`spacing.md` / `spacing.sm`）に寄せる（試作とのずれはこの2か所だけ）                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-11 | **testID**: 県のチップ `region-recent-0`〜`region-recent-2`（並び順）/「全国から」`region-all` /「ほかの地域を入れる」`region-other` / 入力欄 `region-input` /「この地域で調べる」`region-submit` / 回数の知らせ `region-quota` / 地域の行 `hint-line` /「変える」`hint-change`（今と同じ）/ 地図のボタン `research-open-manual`（今と同じ）。`hint-chip`・`hint-input`・`hint-submit` は無くす                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | テストと Expo Web の確認で使う                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-12 | **閉じたとき**: ⓪で閉じる（`close`）と `idle` に戻り、research-spot は呼ばれない（枠を使わない）。②で閉じたときは今のまま（呼んだ分は枠を使い、返った結果は捨てる）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 地域を聞く段階は、まだ何も使っていない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### 対象ファイル

| ファイル                                                                                                  | 変更                                                                                                                                                                                                                                                         | スライス |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `src/services/collection.ts`                                                                              | `fetchRecentPrefectures`・`RECENT_PREFECTURE_COUNT` を足す（D-4）                                                                                                                                                                                            | S1       |
| `src/services/__tests__/collection.test.ts`                                                               | `fetchRecentPrefectures` のテストを足す                                                                                                                                                                                                                      | S1       |
| `src/hooks/useRecentPrefectures.ts`（新規）/ `src/hooks/__tests__/useRecentPrefectures.test.ts`（新規）   | D-5                                                                                                                                                                                                                                                          | S1       |
| `src/hooks/useSpotAdd.ts`                                                                                 | `asking`・`redo`・`start(name)`・`pick`（S2）/ `changeRegion`（S3）。`changeHint` を消す                                                                                                                                                                     | S2・S3   |
| `src/hooks/__tests__/useSpotAdd.test.ts`                                                                  | 書き換え（下の「既存テストの書き換え」）                                                                                                                                                                                                                     | S2・S3   |
| `src/components/record/SpotResearchSheet.tsx`                                                             | ⓪ の本体（チップ・全国から・ほかの地域を入れる・地図で）/ `HintChip` を表示だけの地域の行に替える（S2）/ ③②' の「変える」・⓪' の文言と回数の知らせ（S3）。props: `recentPrefectures: string[]`・`onPick`・`onChangeRegion` を足し、`onChangeHint` を消す     | S2・S3   |
| `src/components/record/__tests__/SpotResearchSheet.test.tsx`                                              | 書き換え                                                                                                                                                                                                                                                     | S2・S3   |
| `src/screens/RecordScreen.tsx`                                                                            | `useRecentPrefectures(user?.id ?? null)`・`handleResearch = name => spotAdd.start(name)`・シートに `recentPrefectures` / `onPick` / `onChangeRegion` を渡す。#248 のコメント（「地域は本人が「地域を絞る」で指定したときだけ送る」）を今の動きに合わせて直す | S2・S3   |
| `src/screens/__tests__/RecordScreen.test.tsx`                                                             | `@services/collection` のモックに `fetchRecentPrefectures` を足す / #248 のテストの書き換え / AC-19・AC-20                                                                                                                                                   | S2       |
| `docs/design/ui-design.md`（302 行目）                                                                    | 「スポット追加」の行に「⓪ 地域を聞く（あなたの記録の県・全国から・ほかの地域）」を足し、Issue #277 を添える                                                                                                                                                  | S2       |
| `.claude/harness/progress.md`・`.claude/harness/feature-list.json`・`.claude/harness/evidence/issue-277/` | 確認結果と証跡                                                                                                                                                                                                                                               | S4       |

**変えないもの**: `src/services/spotAdd.ts`・`src/utils/spotHint.ts`・`supabase/`（Edge Function・migration）・`src/constants/legal.ts`・`SpotSelector`・`SpotPlacePicker`。

### データ構造

```ts
// src/hooks/useSpotAdd.ts
export type SpotAddStatus =
  | 'idle' | 'asking' | 'researching' | 'candidates' | 'notFound'
  | 'error' | 'limit' | 'manual' | 'saving';

export interface SpotAddState {
  // …今の項目…
  /** 「変える」から来た地域選び（調べ直し）。見出しと回数の知らせが変わる */
  redo: boolean;
}

// 返り値: { state, start, pick, changeRegion, retry, choose, openManual, saveManual, close }
start(name: string): void;
pick(hint: SpotHint | null): Promise<void> | undefined;
changeRegion(): void;

// src/services/collection.ts
export const RECENT_PREFECTURE_COUNT = 3;
export async function fetchRecentPrefectures(userId: string): Promise<string[]>;

// src/hooks/useRecentPrefectures.ts
export function useRecentPrefectures(userId: string | null): string[];

// src/components/record/SpotResearchSheet.tsx の Props
recentPrefectures: string[];
onPick: (hint: SpotHint | null) => void;
onChangeRegion: () => void;
// onChangeHint は消す
```

DB・API・Edge Function の変更は無い。

### 画面仕様（試作 A）

到達手順（共通）: ログインした状態で 地図タブ → 記録ボタン →「御朱印を記録」→「スポット」の検索欄に、マスタに無い寺社の名前を2文字以上入れる →「「{名前}」を調べて追加」。

| #   | シート               | 中身（上から）                                                                                                                                                                                                                                                                                                         |
| --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⓪   | 地域を聞く           | 「「{name}」を調べます」（`typography.h3`）/「どのあたりの寺社ですか？ 選ぶとすぐ調べ始めます。」（今の `why`）/「あなたの記録から」（県が1つ以上のとき）/ チップ: 県（最大3・新しい順）→「全国から」/「ほかの地域を入れる」（押すと入力欄＋「この地域で調べる」に替わる）/ 枠線ボタン「調べずに、地図で場所を決める」 |
| ⓪'  | 地域を決めて調べ直す | 「地域を決めて調べ直す」/「選ぶとすぐ調べ直します。」/ 見出し・チップ・「ほかの地域を入れる」は ⓪ と同じ /「調べ直すと、今日の回数（10回）を1回使います」/「調べずに、地図で場所を決める」                                                                                                                             |
| ②   | 調べています         | 「「{name}」を調べています」/ 説明（今のまま）/ 地域の行「{地域} で探しています」（ボタンなし）/ 骨組み / 手順3行 /「調べずに、地図で場所を決める」                                                                                                                                                                    |
| ③   | これですか？         | 「これですか？」/ 説明（今のまま）/ 地域の行「{地域} で探しました ・ 変える」/ 候補カード … 以下 #248 のまま                                                                                                                                                                                                           |
| ②'  | 見つかりませんでした | 「見つかりませんでした」/ 地域の行「{地域} で探しました ・ 変える」/ 主ボタン「地図で場所を決める」                                                                                                                                                                                                                    |

error・limit・④（地図で決める）は #248 のまま。

## スライス（1スライス = 1コミット、TDD）

各スライスの先頭で失敗するテストを書き（Red）、通してからコミットする。**各コミットで `npm run typecheck` と `npm test` が通る**ように切る（`useSpotAdd` の形を変えると `RecordScreen` とシートの型が同時に壊れるので、S2 は3つを一緒に変える）。

| #   | コミット（Conventional Commits）                                  | 中身                                                                                                                                                                                                                   | 基準                               |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| S1  | `feat: 自分の記録から、県を新しい順に3つまで取る (#277)`          | `fetchRecentPrefectures` / `useRecentPrefectures`（まだどこからも使わない）                                                                                                                                            | AC-1〜7                            |
| S2  | `feat: 寺社を調べる前に、地域を聞く (#277)`                       | `useSpotAdd` の `asking`・`start(name)`・`pick`（`changeHint` を消す）/ シートの ⓪・②の表示だけの地域の行・③②' の「で探しました」（「変える」はまだ無い）/ `RecordScreen` をつなぐ / テストの書き換え / `ui-design.md` | AC-8〜12・16〜20 / UI-1〜7・10・12 |
| S3  | `feat: 候補・見つからないのあと「変える」で地域を選び直す (#277)` | `changeRegion`・`redo` / ③②' の「変える」/ ⓪' の見出し・説明・回数の知らせ                                                                                                                                             | AC-13〜15 / UI-8・9・11            |
| S4  | `docs: #277 の Expo Web とシミュレータでの確認結果と証跡`         | Expo Web（UI-13〜15）・シミュレータ（UI-16〜19）で確かめ、`progress.md`・`feature-list.json`・証跡。直すところが出たら別の `fix:` コミット                                                                             | UI-13〜19                          |

### 既存テストの書き換え（必要なもの）

- **`src/hooks/__tests__/useSpotAdd.test.ts`**
  - 6本すべて `start(name, hint)` を使っている → `start(name)` のあと `pick(hint)` に書き換える（「調べて、候補が返れば candidates」「0件は notFound、429 は limit、失敗は error」「25 秒で返らなければ error」「「ここです」で add-spot」）
  - 「手がかりを変えると、その手がかりで調べ直す」（`changeHint`）→ S2 で消し、S3 で `changeRegion` → `pick` のテスト（AC-13）に置き換える
  - 「地図で決める → 保存で…どの状態からでも開ける」→ `start` だけだと `asking` から開くことになる。元の意図（調べている最中に開ける）を残すため `pick` を足してから `openManual`。`asking` から開くのは AC-17 で別に確かめる
  - 冒頭のコメントに `docs/issues/issue-277-spot-research-region.md` を足す
- **`src/components/record/__tests__/SpotResearchSheet.test.tsx`**
  - `state()` の既定に `redo: false` を足す。`handlers()` の `onChangeHint` を `onPick`・`onChangeRegion` に替え、すべての `render` に `recentPrefectures` を渡す
  - 「調べている間: 名前・手がかり・「変える」・…」→ UI-7 の内容（「宮城県 大崎市 で探しています」・「変える」が無い）に書き換え
  - 「手がかりが無ければ「全国から探しています」と「地域を絞る」」→「地域を絞る」が無いことを確かめる形に書き換え
  - 「「変える」で直した手がかりで調べ直す。空なら null」（`hint-change` / `hint-input` / `hint-submit` → `onChangeHint`）→ 消して UI-5 に置き換える
  - `it.each`（notFound / error / limit）: 文言のテストは残す。S3 で notFound に「変える」があり、error / limit に無いこと（UI-9・UI-10）を足す
- **`src/screens/__tests__/RecordScreen.test.tsx`**
  - `jest.mock('@services/collection', …)` に `fetchRecentPrefectures: (...a) => mockFetchRecentPrefectures(...a)` を足す（既定は `mockResolvedValue([])`）。**足さないと記録画面を描くすべてのテストが落ちる**（D-5 で画面を開いたときに呼ぶため）
  - 「「調べて追加」→「ここです」で…最初は全国から」→ AC-19 の形に書き換え（押した直後は `researchSpot` が呼ばれない → 「全国から」→ 呼ばれる）

## テスト方針

- **サービス**（S1）: `collection.test.ts` の既存のモックの形（`from → select → eq → order`）に `order` を2回つないで、呼び方と、重複・`null`・47 に無い値の飛ばし方、3つで打ち切ること、エラー時の `[]` を確かめる
- **フック**（S1・S2・S3）: `renderHook`。`useRecentPrefectures` は `@services/collection` をモック。`useSpotAdd` は今のテストと同じく `@services/spotAdd` をモックし、`researchSpot` が何回・何で呼ばれたかを数える（D-2 の二度押しは同じ `act` の中で2回呼ぶ）
- **シート**（S2・S3）: 状態を渡して描き、何が出るか・押すと何が呼ばれるか。並び順は `getAllByTestId(/^region-(recent-\d|all)$/)` の順で見る。色・余白は `StyleSheet.flatten(…props.style)` で見る
- **記録画面**（S2）: 今の #248 のテストと同じモックで、押した直後に調べないこと・県のチップから調べることを確かめる
- research-spot は変えないので Deno のテストは足さない（Q-5 で差分が無いことだけ確かめる）
- Maestro のフローは足さない（research-spot は Claude と1日10回の枠を使い、結果が毎回同じにならない。シミュレータでの確認で代える）

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準で合否を判定する。

### 機能基準: 記録から県を取る（S1）

- [ ] AC-1: `fetchRecentPrefectures('user-1')` は `supabase.from` を**1回だけ** `'stamps'` で呼び、`select` の引数に `spots!inner(prefecture)` を含み、`.eq('user_id', 'user-1')`、`.order('visited_at', { ascending: false })`、`.order('created_at', { ascending: false })` をこの順に呼ぶ。`.limit` は呼ばない（Jest）
- [ ] AC-2: 返る行の県が上から `宮城県, 宮城県, null, 京都府, 東京都, 大阪府` のとき、`['宮城県', '京都府', '東京都']` を返す（Jest）
- [ ] AC-3: 行の県が `ほげ県, '', 北海道` のとき `['北海道']` を返す（47都道府県に無い値を飛ばす）。行が0件なら `[]`（Jest）
- [ ] AC-4: 問い合わせが `{ data: null, error: { message: 'x' } }` を返すと、投げずに `[]` を返し、`console.warn('fetchRecentPrefectures error:', 'x')` を1回出す（Jest）
- [ ] AC-5: `useRecentPrefectures('user-1')` は最初 `[]` を返し、`fetchRecentPrefectures` が `['宮城県', '京都府']` で解決すると `['宮城県', '京都府']` を返す。`rerender` を2回しても `fetchRecentPrefectures` は合わせて1回しか呼ばれない（Jest）
- [ ] AC-6: `useRecentPrefectures(null)` は `fetchRecentPrefectures` を1回も呼ばず、`[]` を返す（Jest）
- [ ] AC-7: `fetchRecentPrefectures` が reject しても、`useRecentPrefectures('user-1')` は `[]` を返し続け、テストに例外が出ない（Jest）

### 機能基準: useSpotAdd（S2・S3）

- [ ] AC-8: `start('八幡神社')` のあと `state.status === 'asking'`・`state.name === '八幡神社'`・`state.redo === false` で、`researchSpot` は1回も呼ばれていない（Jest）
- [ ] AC-9: `asking` で `pick({ prefecture: '宮城県', city: null })` を呼ぶと、`researchSpot` が `('八幡神社', { prefecture: '宮城県', city: null })` で1回呼ばれ、`state.status === 'researching'`・`state.hint` がその値になる。別のテストで `pick(null)` なら `('八幡神社', null)` で呼ばれる（Jest）
- [ ] AC-10: `asking` で、同じ `act` の中で `pick({ prefecture: '宮城県', city: null })` と `pick(null)` を続けて呼んでも、`researchSpot` は1回だけ（1回目の値で）呼ばれる（Jest）
- [ ] AC-11: `researching` のときと `candidates` のときに `pick(null)` を呼んでも `researchSpot` の呼ばれた回数は増えず、`state.status` も変わらない（Jest）
- [ ] AC-12: `start` → `pick` のあと、候補1件以上なら `candidates`、0件なら `notFound`、429 なら `limit`、失敗なら `error`、25 秒で返らなければ `error` になり、そのあと返った結果で上書きしない（#248 の AC-35 と同じ。Jest、fake timers）
- [ ] AC-13: `candidates` で `changeRegion()` を呼ぶと `state.status === 'asking'`・`state.redo === true`・`state.name` は同じ・`state.candidates` は `[]`・`state.researchId === null` になり、この時点で `researchSpot` の呼ばれた回数は増えない。続けて `pick({ prefecture: '宮城県', city: null })` を呼ぶと `researchSpot` が `(同じ name, { prefecture: '宮城県', city: null })` で呼ばれ（合わせて2回）、`state.status === 'researching'`・`state.redo === false` になる（Jest）
- [ ] AC-14: `notFound` で `changeRegion()` を呼んでも AC-13 と同じく `asking`・`redo: true` になる（Jest）
- [ ] AC-15: `researching` で `changeRegion()` を呼んでも `state.status` は `researching` のままで、そのあと research-spot が候補を返すと `candidates` になる（調べものが捨てられない）。`error` と `limit` で呼んでも状態は変わらない（Jest）
- [ ] AC-16: `asking` で `close()` を呼ぶと `state.status === 'idle'` になり、`researchSpot` は1回も呼ばれていない（Jest）
- [ ] AC-17: `asking` で `openManual()` を呼ぶと `state.status === 'manual'`・`state.placing === true` になり、`researchSpot` は1回も呼ばれていない（Jest）
- [ ] AC-18: `useSpotAdd` の返り値に `changeHint` が無く、`grep -rn "changeHint\|onChangeHint" src` が0件

### 機能基準: 記録画面（S2）

- [ ] AC-19: 記録画面（`RecordScreen`、`searchQuery = '鹿島台神社'`、`fetchRecentPrefectures` は `[]`）で `spot-research` を押すと、`researchSpot` は呼ばれず、シートに「「鹿島台神社」を調べます」が出る。`region-all`（「全国から」）を押すと `researchSpot('鹿島台神社', null)` が1回呼ばれ、「これですか？」→「ここです」で `addResearchedSpot('r1', 0)` と `form.selectSpot(追加した寺社)` が呼ばれ、「これですか？」が消える（Jest。#248 のテストの書き換え）
- [ ] AC-20: `fetchRecentPrefectures` が `['宮城県']` を返すとき、記録画面を描くと `fetchRecentPrefectures('user-1')` が1回呼ばれ、`spot-research` を押したあとのシートに `region-recent-0`（「宮城県」）が出る。それを押すと `researchSpot('鹿島台神社', { prefecture: '宮城県', city: null })` が1回呼ばれる（Jest）

### UI 基準: シート（Jest。対象: `SpotResearchSheet`。到達は上の「画面仕様」の共通手順）

- [ ] UI-1: `status: 'asking'`・`redo: false`・`name: '八幡神社'`・`recentPrefectures: ['宮城県', '京都府', '東京都']` のとき、「「八幡神社」を調べます」「どのあたりの寺社ですか？ 選ぶとすぐ調べ始めます。」「あなたの記録から」「ほかの地域を入れる」「調べずに、地図で場所を決める」が出る。`getAllByTestId(/^region-(recent-\d|all)$/)` の順が `region-recent-0`（宮城県）→ `region-recent-1`（京都府）→ `region-recent-2`（東京都）→ `region-all`（全国から）。`region-quota`・「調べ直すと、今日の回数（10回）を1回使います」・`TextInput` は無い
- [ ] UI-2: UI-1 の状態で、`region-recent-0` の中の MaterialIcons（`within(チップ).UNSAFE_getByType(MaterialIcons).props`）は `name: 'place'`、`region-all` の中は `name: 'public'`（どちらも `size: 16`・`color: colors.gray[500]`）。`region-recent-0` のスタイルは `backgroundColor: colors.white`・`borderColor: colors.gray[200]`・`borderRadius: borderRadius.full`、`region-all` は `backgroundColor: colors.gray[100]`・`borderColor: colors.gray[100]`・`borderRadius: borderRadius.full`
- [ ] UI-3: UI-1 の状態で `region-recent-0` を押すと `onPick` が `{ prefecture: '宮城県', city: null }` で1回、`region-all` を押すと `onPick` が `null` で1回呼ばれる
- [ ] UI-4: `status: 'asking'`・`recentPrefectures: []` のとき、「あなたの記録から」と `region-recent-0` は無く、`region-all`（「全国から」）と `region-other`（「ほかの地域を入れる」）はある
- [ ] UI-5: `status: 'asking'` で `region-other` を押すと、`region-input`（プレースホルダー「例: 宮城県 仙台市」）と `region-submit`（「この地域で調べる」）が出て、`region-other` は消える。`region-input` に `宮城県 仙台市` を入れて `region-submit` を押すと `onPick({ prefecture: '宮城県', city: '仙台市' })`。空のまま押すと `onPick(null)`。`宮城県` を入れて `region-input` で `submitEditing` を起こすと `onPick({ prefecture: '宮城県', city: null })`
- [ ] UI-6: `status: 'asking'` で `research-open-manual`（「調べずに、地図で場所を決める」）を押すと `onOpenManual` が1回呼ばれ、`onPick` は呼ばれない
- [ ] UI-7: `status: 'researching'`・`hint: { prefecture: '宮城県', city: '大崎市' }` のとき `hint-line` に「宮城県 大崎市 で探しています」、`hint: null` のとき「全国から探しています」が出る。どちらも `hint-change`・「変える」・「地域を絞る」・`TextInput` はシートのどこにも無く、「調べずに、地図で場所を決める」はある
- [ ] UI-8: `status: 'candidates'`・`hint: { prefecture: '宮城県', city: null }`・候補2件のとき、「宮城県 で探しました」と `hint-change`（「変える」）が出て、`hint-line` は説明文「見つかった寺社です。…」より下・`candidate-0` より上にある。「変える」を押すと `onChangeRegion` が1回呼ばれる。同じ候補で `status: 'saving'` のときは「変える」を押しても `onChangeRegion` は呼ばれない
- [ ] UI-9: `status: 'notFound'`・`hint: null` のとき「見つかりませんでした」「全国から探しました」「変える」「地図で場所を決める」が出て、「変える」を押すと `onChangeRegion` が1回呼ばれる
- [ ] UI-10: `status: 'error'` と `status: 'limit'` のシートに `hint-change`・「変える」は無い。文言とボタン（「調べられませんでした。通信を確かめてください」「もう一度調べる」/「今日調べられる回数（10回）を使い切りました」、どちらも「地図で場所を決める」）は #248 のまま
- [ ] UI-11: `status: 'asking'`・`redo: true`・`recentPrefectures: ['宮城県']` のとき、見出し「地域を決めて調べ直す」・説明「選ぶとすぐ調べ直します。」・`region-quota`（「調べ直すと、今日の回数（10回）を1回使います」、スタイルに `color: colors.gray[500]` と `typography.caption` の `fontSize`）が出て、「「{name}」を調べます」は無い。`region-recent-0`・`region-all`・`region-other`・「調べずに、地図で場所を決める」はある
- [ ] UI-12: `status: 'asking'`・`recentPrefectures: []` で描いたあと、`recentPrefectures: ['宮城県']` で `rerender` すると `region-recent-0`（「宮城県」）が `region-all` の前に出て、「あなたの記録から」も出る。`onPick` は呼ばれていない

### UI 基準: Expo Web（`npx expo start --web --port 8081`。ログインしない＝記録が無い人と同じ表示）

到達: `http://localhost:8081/?preview=goshuincho` → 下のタブ「御朱印帳」→ ページを左へ送り切り、白紙のページ（「ここに御朱印を追加する」。#116 の W-9〜W-11 と同じ）を押す →「御朱印を記録」→「スポット」の検索欄に `架空稲荷神社` を入れる。

- [ ] UI-13: 「「架空稲荷神社」を調べて追加」を押すと、下からのシートに「「架空稲荷神社」を調べます」「どのあたりの寺社ですか？ 選ぶとすぐ調べ始めます。」「全国から」「ほかの地域を入れる」「調べずに、地図で場所を決める」が出て、「あなたの記録から」と「調べています」は出ない。スクリーンショットを `.claude/harness/evidence/issue-277/` に置く
- [ ] UI-14: 同じシートで「ほかの地域を入れる」を押すと、プレースホルダー「例: 宮城県 仙台市」の入力欄と「この地域で調べる」が出て、「ほかの地域を入れる」は消える。スクリーンショット
- [ ] UI-15: 同じシートで「全国から」を押すと research-spot が呼ばれ（未ログインなので失敗する）、最後に「調べられませんでした。通信を確かめてください」と「もう一度調べる」が出て、「変える」は出ない。画面が落ちない（コンソールに未処理の例外が無い）

### UI 基準: シミュレータ（native-only。`issue-272` の「シミュレータでの確認」と同じ Debug ビルド＋`/dev` の Metro。ログイン済みのテスト用アカウント）

前提: そのアカウントに、県のある寺社の記録が1件以上ある（無ければ UI-16 は「全国から」と「ほかの地域を入れる」だけが出ることを確かめ、その旨を progress.md に書く）。**research-spot を呼ぶのは UI-17・UI-18 の合わせて2回まで**（1日10回の枠を使うため）。名前はマスタに無い寺社（例 `秋保神社`。「調べて追加」の行が出なければ別の名前）。

- [ ] UI-16: **native-only（シミュレータ）**: 地図タブ → 記録ボタン →「御朱印を記録」→ 検索欄に名前 →「「{名前}」を調べて追加」で、シートに「「{名前}」を調べます」「あなたの記録から」、そのアカウントの記録の県が御朱印帳（並び「日付」）の新しい順で重複なく最大3つ、続けて「全国から」、「ほかの地域を入れる」「調べずに、地図で場所を決める」が出る。スクリーンショットを試作 A の地域を聞く画面と並べて PR に貼る
- [ ] UI-17: **native-only（シミュレータ）**: UI-16 のシートで県のチップを1回押すと、すぐ「「{名前}」を調べています」と「{県} で探しています」に替わり、結果が出るまでの間（手順の3行が進む間）シートに「変える」「地域を絞る」・入力欄が出ない。画面の録画を証跡に置く
- [ ] UI-18: **native-only（シミュレータ）**: UI-17 の結果（候補または「見つかりませんでした」）に「{県} で探しました ・ 変える」が出る。「変える」→「地域を決めて調べ直す」「選ぶとすぐ調べ直します。」「調べ直すと、今日の回数（10回）を1回使います」が出る →「全国から」で「全国から探しています」になって調べ直し、結果に「全国から探しました ・ 変える」が出る。画面の録画を証跡に置く
- [ ] UI-19: **native-only（シミュレータ）**: 地域を聞くシートで「ほかの地域を入れる」を押すと、キーボードが出て、入力欄と「この地域で調べる」がキーボードに隠れずに見える（押さずに閉じる。research-spot は呼ばない）。スクリーンショット

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: 足した見た目に直値が無い: `git diff develop -- src/components/record/SpotResearchSheet.tsx | grep '^+' | grep -E "'#[0-9A-Fa-f]{3,8}'|fontSize: *[0-9]|(padding|margin)[A-Za-z]*: *[0-9]|gap: *[0-9]"` の出力が空（色の直値は `'#…'` の形で探す。コメントの「#277」は拾わない）
- [ ] Q-5: 変えないものに差分が無い: `git diff develop --stat -- supabase/ src/services/spotAdd.ts src/utils/spotHint.ts src/constants/legal.ts` の出力が空
- [ ] Q-6: 地域の選択肢に位置情報を使わない: `grep -nE "useLocation|userLocation|latitude|longitude" src/hooks/useRecentPrefectures.ts` が0件で、`git diff develop -- src/services/collection.ts | grep '^+' | grep -E "lat|lng|latitude|longitude"` の出力が空

## やらないこと（スコープ外）

- 案 B（同じ名前が多い寺社だけ聞く）・案 C（結果のあとで聞く、「地域を決めて調べ直す」のリンク）
- research-spot（Edge Function）・1日10回の上限・候補の形・手がかりの形（`{ prefecture, city }`）・`parseHintText` の読み取り方（「仙台」を「仙台市」と読むなど）の変更
- 位置情報を使うこと（#248 のとおり。家に帰ってから記録する人がいる）
- 市区町村のチップ（記録から出すのは県だけ）
- 試作の「押したチップが 160ms 朱色になる」表示と待ち（D-8）
- 県の一覧をキャッシュ・保存すること（記録画面を開くたびに1回取る）
- `error` / `limit` に「変える」を足すこと
- 「変える」を押したあと、前の候補に戻る手段（閉じれば候補は捨てる。戻りたければ調べ直す）
- 同じ名前の寺社（例「八幡神社」）がマスタにあると「調べて追加」の行が出ないこと（#248 D-10。下の「注意事項」）
- Maestro のフロー

## 注意事項

- **「八幡神社」ではこの画面に来られない**: 記録画面の検索は全国の寺社（active と本人の pending）を持っていて、`SpotSelector` は**正規化した名前が一致する寺社が1つでもあると「調べて追加」の行を出さない**（#248 D-10）。マスタには「八幡神社」がそのままの名前で入っている（`supabase/seeds/03_chubu.sql`・`06_kyushu_okinawa.sql` など）ので、試作の想定（仙台で「八幡神社」を調べる）は今のままでは「調べて追加」まで届かない。この契約では直さない（別の Issue にする）。確認には「秋保神社」などマスタに無い名前を使う
- **「新しい順」は参拝日**（D-4）。昔の御朱印帳をまとめて記録している人（参拝日が古い）は、いま記録している県が3つに入らないことがある。「記録した順（`created_at`）」にするなら `order` の1行を替えるだけなので、オーナーが違うと言えばそちらにする
- **`RecordScreen.test.tsx` のモック**: `jest.clearAllMocks()` は `mockResolvedValue` の中身を消さないが、テストの中で `mockFetchRecentPrefectures` を上書きしたら次のテストの前に `[]` に戻すこと。記録画面を描くたびに取得の Promise が解けて state が変わるので、既存のテストに `act` の警告が増えることがある（失敗にはならない）。気になるならフックで「取れた一覧が空なら state を変えない」にする
- `useSpotAdd` の `research()` は今 `setState({ ...IDLE, status: 'researching', name, hint })` なので、`IDLE` に `redo: false` を入れておけば調べ始めたとき自動で `redo` が戻る
- `pick` の二度押しの守り（D-2）は `useState` の `status` を見るだけでは効かない（同じ描画の中では古い値のまま）。`start` と `changeRegion` で立て、`pick`・`close`・`openManual` で倒す `useRef` の旗などにする
- シートは `Modal`（`variant="bottom"`）の中の `KeyboardAvoidingView` にあるので、入力欄がキーボードに隠れないかは UI-19 で実機の見た目を確かめる（今の `HintChip` の入力欄と同じ置き方）
- 県のチップの文字は `spots.prefecture` の値そのもの（例「京都府」「東京都」「北海道」）。「府」「都」「道」を落とさない
