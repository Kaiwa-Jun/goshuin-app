# Issue #272: プラスの「購入を復元」を目立たない場所へ移し、無料のカードに「いまのプラン」を付ける

## 概要

#270（PR #271・develop にマージ済み）で作ったプラスの購入の導線について、オーナーから「『購入を復元』という言葉が分かりにくい」「無料と有料のカードに加えて復元のリンクもあると、どこを押せばよいか迷う」と指摘があった。スイッチを入れる前（#270 H-7 の前）に、次の3つだけを直す。**`BILLING_ENABLED = false` のまま出す**（利用者から見た変化は無い）。

1. **予定の2件目のシート（B・`PlusSheet`）から「購入を復元」を外す**。押せるのは「{priceString}でプラスにする」「あとで」・✕・利用規約・プライバシーポリシーだけ。シートの復元の流れ（#270 D-11 の後半）は消す
2. **プラスの画面（E・`PlusScreen`）の「購入を復元」を、利用規約・プライバシーポリシーの行の下の小さな1行「以前に購入した方は 購入を復元」へ移す**。「購入を復元」の部分だけが押せる。審査で探される「購入を復元」の言葉は残す
3. **カード2枚（`PlusPlanCards`）に札「いまのプラン」**。無料のときは無料のカード、プラスのときはプラスのカードに付き、プラスのときは「おすすめ」を出さない

プラスは買い切りなので、一度買った人が無料に戻ることはない。以前に買った人が無料に見えるのは別のアカウントでログインした等のまれな場合だけで、そのときも「プラスにする」を押せば App Store が「購入済み」と出して課金されずにプラスに戻る（v4 の H。この契約では確かめず、#270 H-7 の Issue で sandbox で確かめる）。

## 関連ドキュメント

- **承認デザイン（正）**: [`docs/design/mockups/2026-09-plus-paywall-v4.html`](../design/mockups/2026-09-plus-paywall-v4.html) / `-v4.png`。2026-09-26 オーナー承認。**画面 B（v4）・E（v4）・H・F（v4）**。「B（v3・いま）」は比べるための今の形で、作らない。H の確認ダイアログは App Store が出すもので、アプリでは作らない
- **前の契約書**: [`issue-270-plus-purchase.md`](./issue-270-plus-purchase.md)（D-9〜D-16・AC-19〜45・UI-7〜9）。この契約書で置き換える箇所は D-1 に書く。#270 の契約書そのものは書き換えない（履歴として残す）
- 前の承認デザイン: `docs/design/mockups/2026-09-plus-paywall-v3.html`（v4 は v3 を元にした差分）
- 収益化の設計: [`docs/product/2026-09-monetization-design.md`](../product/2026-09-monetization-design.md) §3 原則（押し売りしない）。`docs/product/direction.md` の収益化の行はこれが正
- シミュレータでの確認のやり方: `.claude/harness/progress.md` の 2026-09-26（夜・途中）/（夜・S6）の記録（ローカルの Debug ビルド・`/dev` の Metro・Test Store のキー・ローカルだけの一時的な書き換え）
- 確認済み: `docs/product/requirements.md`・`docs/design/ui-design.md` と矛盾なし。`ui-design.md` は変えない（`BILLING_ENABLED = false` の間は画面に出ないため。#270 と同じ）

## 設計上の決定（要件に無い点）

| #    | 決めたこと                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | **#270 の契約から置き換える箇所**: ① D-10 の最後の文「実行中（busy）は購入・復元の両方の文字ボタンを押せない」→ 復元は E にしか無いので E の話になる（本 D-8）② D-11 の後半「B で復元できたときは…`navigate('PlanEditor', { date })`」→ 無くなる ③ D-14 の「左上に札『おすすめ』」→ 札は `isPlus` で決まる（本 D-2・D-3）④ D-15 の「その下に文字ボタン『購入を復元』（`plus-restore`）と、B のときだけ『あとで』」→ 復元は E だけ・規約の行の下（本 D-5・D-6）⑤ AC-21 の「購入を復元」・AC-25 全部・AC-32 の「`canRestore` が false なら `plus-restore` が disabled」・AC-33 の「`plus-restore` が disabled」→ 本 AC-8・AC-9・AC-13〜16 ⑥ UI-8 の「アプリを消して入れ直し…『購入を復元』で『購入を復元しました』」→ B では無くなる。E の復元は本 UI-4、本物の復元は sandbox（#270 H-7）。**これ以外の #270 の決定・基準は変えない**                                                                                                                                                                                                                              |
| D-2  | **`PlusPlanCards` の props を `{ priceString: string \| null; isPlus: boolean }` にする**（`isPlus` は省略できない。呼ぶ側の渡し忘れを型で止める）。`isPlus = false`: 無料のカード（`plus-card-free`）に札「いまのプラン」（`testID="plus-card-tag-now"`）、プラスのカード（`plus-card-plus`）に今の札「おすすめ」（`testID="plus-card-tag"` のまま）。`isPlus = true`: 札「いまのプラン」（`plus-card-tag-now`）がプラスのカードへ移り、「おすすめ」（`plus-card-tag`）は出さない。無料のカードには札なし。どちらのときも「いまのプラン」は画面に1つだけ。カードの中身（値段・行・プラスのカードの枠と地・浮く動き）は変えない                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-3  | **札「いまのプラン」の見た目**（v4 の `.tag.now`）: 「おすすめ」の札（`styles.tag`）と同じ位置・形（`position: 'absolute'`・`top: -10`・`left: spacing.md`・`borderRadius: borderRadius.full`）で、地 `colors.white`・枠 `borderWidth: 1`・`borderColor: colors.pin.wishlisted`（試作の teal `#0D9488`。無料のカードのチェックと同じ色。新しいトークンは足さない＝#270 の注意事項と同じ理由）。字は `colors.pin.wishlisted`、大きさと太さは「おすすめ」の字と同じ（`fontSize: 10`・`fontWeight: '800'`）。**枠の 1px ぶん内側の余白を減らし、外寸を「おすすめ」と揃える**（試作 `padding: 1px 7px` ＝「おすすめ」の `paddingVertical: 2`・`paddingHorizontal: spacing.sm` から 1 ずつ引いた値。`padding` ではなく `paddingVertical` / `paddingHorizontal` のキーで書く）。「おすすめ」の札の見た目は変えない                                                                                                                                                                                                                                                     |
| D-4  | **B に渡す `isPlus` は `shown.isPlus`**: `PlusSheet` は「開いていて購入の最中でない」ときだけ `shown`（日付と isPlus）を更新している（#270 の fix fb2651a・c35ed7e）。`PlusPlanCards` にも `isPlus={shown.isPlus}` を渡し、**買えた直後の閉じる動きの間に札が動かない**ようにする（`plus.isPlus` を直接渡さない）。`shown` を更新する条件（`targetDate !== null && !plus.busy`）は変えない。コメントの「買う・復元するの最中」は、シートに復元が無くなるので「買う最中」に直す。E は `isPlus={plus.isPlus}`（画面なので止める必要が無い）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D-5  | **B から「購入を復元」を外す**: `PlusPurchasePanel` に props **`showRestore?: boolean`**（既定 `false`）を足し、復元の行は `showRestore` が true のときだけ描く。**E だけが `showRestore` を渡し、B は渡さない**（「あとで」の有無＝`onLater` から B かどうかを推し量らない）。使われなくなる **`onRestored` を `PlusPurchasePanel`・`PlusSheet` の props と `PlanCalendarScreen` の `PlusSheet` への受け渡しから消す**（E は今も `onRestored` を渡していない＝復元できたら E に留まる）。`PlanCalendarScreen` の `closeSheetThen` は買えたとき・規約・ポリシーで使い続けるので残す。「あとで」の行（今の `subRow`）は `onLater` があるときだけ描く（E に空の行と余白を残さない。**これは S3 のあとの最終形**。S2 の間は E の「購入を復元」もまだこの行に置くので、S2 では「`onLater` があるか、`showRestore` かつ `isPlus` が false のとき」に描く）。B で押せるのは「{priceString}でプラスにする」（`plus-buy`）・「あとで」（`plus-later`）・✕（`accessibilityLabel="閉じる"`）・「利用規約」（`plus-terms`）・「プライバシーポリシー」（`plus-privacy`）だけ |
| D-6  | **E の下の1行**（v4 の `.restore`）: `PlusPurchasePanel` の利用規約・プライバシーポリシーの行（今の `styles.legal` の View。**`testID="plus-legal"` を足す**）の**すぐ下**に、横並びの View（`testID="plus-restore-row"`・`flexDirection: 'row'`・`justifyContent: 'center'`・`alignItems: 'center'`・`marginTop: spacing.sm`（試作 10px））。中は、押せない Text「以前に購入した方は」と、押せる `TouchableOpacity`（**`testID="plus-restore"` を引き継ぐ**・`accessibilityRole="button"`・`hitSlop={8}`（字が小さいので ✕ と同じだけ広げる））の中の Text「購入を復元」。**`<Text onPress>` を入れ子にする形にしない**（`toBeDisabled()` で押せないことを確かめられる今の形を保つ）。出すのは **`showRestore` が true かつ `isPlus` が false のときだけ**（`isPlus` のときは出さない＝今と同じ）。`canRestore` が false または `busy` のときは `disabled`（今と同じ）。E で `status` が `'unavailable'`・`'loading'` でも `isPlus` が false なら行は出す（今の「購入を復元」と同じ）                                                                           |
| D-7  | **下の1行の見た目**: 「以前に購入した方は」= `typography.caption`・`colors.gray[400]`（規約の文字リンク `styles.link` と同じ大きさ・色。下線なし）。「購入を復元」= `typography.caption`・`colors.gray[500]`・`fontWeight: '700'`・`textDecorationLine: 'underline'`。押せないとき（`!canRestore \|\| busy`）の「購入を復元」の色は `colors.gray[300]`（#270 の `subDisabled` を引き継ぐ。試作に押せない形は無い）。前半と「購入を復元」の間は `gap: spacing.xs`（試作の半角スペースの代わり）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D-8  | **押したときの流れは #270 のまま**（処理は `PlusPurchasePanel` の `restore` に1つ）: `restorePurchases` が plus ありで resolve → Alert「購入を復元しました」を出して **E に留まる**（`popTo`・`navigate` は呼ばない）。`isPlus` が true になるので、ボタンが「購入済み」（押せない）、札がプラスのカードへ移り「おすすめ」が消え、「1回だけの支払い」と下の1行が消える（#270 D-12）。plus なしで resolve → Alert「復元できる購入が見つかりませんでした」、reject → Alert「購入を復元できませんでした」（どちらも E のまま・表示は変わらない）。E で購入の実行中は「購入を復元」を、復元の実行中は購入のボタンを押せない（`busy`）                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D-9  | **読み込み中の札**: `usePlus` の `isPlus` は `false` から始まる（#270 D-5）。プラスの人が E を開くと、CustomerInfo が届くまでの一瞬、札が無料のカードにあってからプラスのカードへ移りうる（今のボタンが「読み込み中…」から「購入済み」に変わるのと同じ）。**この契約では `usePlus` を変えないので抑えない**。UI-5 で目に見えるかを記録し、気になる場合は別の Issue にする                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D-10 | **変えないもの**: 購入の仕組み（`src/hooks/usePlus.ts`・`src/services/purchases.ts`・RevenueCat の設定・`jest.setup.js` のモック）、`BILLING_ENABLED = false`、設定のカード（`PlusSettingsCard`）と設定の画面、トースト（`PlusThanksToast`）、「1回だけの支払い・毎月はかかりません」の行（`isPlus` のときは出さないのも今と同じ）、復元・購入の Alert の文言、`src/theme/` のトークン、ナビゲーション                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## 詳細設計

### 対象ファイル

| ファイル                                                                    | 変更                                                                                                                                                              | スライス |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/components/plus/PlusPlanCards.tsx`                                     | props に `isPlus`・札「いまのプラン」（D-2・D-3）                                                                                                                 | S1       |
| `src/components/plus/PlusSheet.tsx`                                         | `PlusPlanCards` に `isPlus={shown.isPlus}`（D-4）/ S2: props から `onRestored` を消す・コメントを直す（D-4・D-5）                                                 | S1 / S2  |
| `src/screens/PlusScreen.tsx`                                                | `PlusPlanCards` に `isPlus={plus.isPlus}`（D-4）/ S2: `PlusPurchasePanel` に `showRestore`（D-5）                                                                 | S1 / S2  |
| `src/components/plus/__tests__/PlusPlanCards.test.tsx`（新規）              | 札の位置と見た目（AC-1・2・UI-1）                                                                                                                                 | S1       |
| `src/components/plus/PlusPurchasePanel.tsx`                                 | S2: `showRestore`・`onRestored` を消す・「あとで」の行は `onLater` のときだけ（D-5）/ S3: 復元を規約の行の下の1行へ・`plus-legal`・`plus-restore-row`（D-6・D-7） | S2 / S3  |
| `src/screens/PlanCalendarScreen.tsx`                                        | `PlusSheet` への `onRestored` を消す（D-5）                                                                                                                       | S2       |
| `src/components/plus/__tests__/PlusSheet.test.tsx`                          | 下の「既存テストの扱い」のとおり                                                                                                                                  | S1 / S2  |
| `src/screens/__tests__/PlanCalendarPlus.test.tsx`                           | 下の「既存テストの扱い」のとおり                                                                                                                                  | S1 / S2  |
| `src/screens/__tests__/PlusScreen.test.tsx`                                 | 下の「既存テストの扱い」のとおり                                                                                                                                  | S1 / S3  |
| `.claude/harness/progress.md` / `feature-list.json` / `evidence/issue-272/` | S4 の確認結果・スクリーンショット                                                                                                                                 | S4       |

**S2 と S3 の順番**: S2 で `showRestore` を足した時点では、E の「購入を復元」は**今の場所（ボタンの下の行）に残す**（E の既存テスト AC-41・44 を途中で落とさないため）。S3 でそれを規約の行の下へ移し、文言を「以前に購入した方は 購入を復元」にする。

### 画面仕様（文言・具体値は試作 v4 のまま。値段だけ `priceString`）

#### B. プラスの案内のシート — 予定タブ（これからの予定が1件以上）→「＋ 予定を組む」または空いた日

- 上から: ✕・見出し「予定をいくつでも入れるならプラス」・入っている予定と押そうとした日・カード2枚（無料に「いまのプラン」、プラスに「おすすめ」）・「{priceString}でプラスにする」・「**1回だけの支払い**・毎月はかかりません」・「あとで」・「利用規約・プライバシーポリシー」
- 「購入を復元」も「以前に購入した方は」も無い
- 買えた直後の閉じる動きの間は、札・ボタンの文言・日付の枠を買う前のまま止める（D-4）

#### E. プラスの画面（`Plus`）— 設定 →「御朱印さんぽ プラス」

- 上から: 上のバー・「御朱印さんぽ プラス」・見出し「予定を、先までいくつでも」・ミニカレンダー・カード2枚（無料に「いまのプラン」、プラスに「おすすめ」）・「{priceString}でプラスにする」・「**1回だけの支払い**・毎月はかかりません」・「利用規約・プライバシーポリシー」・**「以前に購入した方は 購入を復元」**（いちばん下）
- 「あとで」は無い（今と同じ）

#### F. 買ったあとのプラスの画面 — 同じ経路（プラスの人）

- 札「いまのプラン」がプラスのカードに付き、「おすすめ」は無い。無料のカードに札は無い
- ボタン「購入済み」（押せない）・「利用規約・プライバシーポリシー」。「1回だけの支払い」と「以前に購入した方は 購入を復元」は無い

## テスト方針

- **札の位置と見た目は `PlusPlanCards` の単体テスト（新規 `PlusPlanCards.test.tsx`）で縛る**（`isPlus` の true / false を props で渡す）。画面のテストでは「その画面で無料・プラスのどちらのカードに札があるか」だけを見る
- **B で札がプラスへ移る・閉じる動きの間に札が動かないことは `PlusSheet.test.tsx` で確かめる**。予定タブ（`PlanCalendarScreen`）からはプラスの人にシートが出ない（#270 AC-29）ので、画面のテストでは見られない。`PlusSheet.test.tsx` の既存の `Modal` のモック（開閉にかかわらず中身を描く）をそのまま使う
- 位置の検査は `within(getByTestId('plus-card-free'))` / `within(getByTestId('plus-card-plus'))` で「どちらのカードの中か」を見る（testID があるだけでは合格にしない）
- 並びの検査は `getAllByTestId(/正規表現/)` が木の順に返すことを使う（`SettingsPlus.test.tsx` の #270 AC-36 と同じ書き方）
- 見た目は `StyleSheet.flatten(el.props.style)` で値を見る（#270 の UI-1〜3 と同じ）。色は `colors` のトークンで比べる
- `BILLING_ENABLED = false` のままなので **Expo Web での見た目の確認はしない**（コミットした状態では画面に出ない）。実際の見え方はシミュレータ（UI-3〜5・native-only）で確かめる
- `react-native-purchases` は `jest.setup.js` のモック（#270 D-22）。テストの値段は `'¥980'`

### 既存テストの扱い（直す・消す・そのまま）

| ファイル                                                                                                       | テスト                                                                                     | 扱い                                                                                                                                                                                               | スライス |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/screens/__tests__/PlanCalendarPlus.test.tsx`                                                              | 冒頭のコメント（契約書の参照）                                                             | #272 の契約書を足す                                                                                                                                                                                | S1       |
| 〃                                                                                                             | `AC-21: カード2枚・値段・支払いの一言・復元・あとで・規約`                                 | **直す**。S1: 本 AC-3（「いまのプラン」が無料のカードの中）を足す（別の `it` でもよい）。S2: 期待の一覧から「購入を復元」を外し、タイトルの「復元・」を消す                                        | S1 / S2  |
| 〃                                                                                                             | `AC-33: 実行中は購入と復元を押せない`                                                      | **直す**。`plus-restore` が disabled の行を消し、タイトルを「実行中は購入を押せない」にする（本 AC-9）                                                                                             | S2       |
| 〃                                                                                                             | `describe('AC-25: 購入を復元')` の2本（復元できたら予定を組む画面へ / 見つからない・失敗） | **消す**。シートに復元が無い。Alert の3種類は E のテスト（本 AC-13・14）で確かめる                                                                                                                 | S2       |
| 〃                                                                                                             | `AC-32` の3本目「復元できないときは「購入を復元」も押せない」                              | **消す**。E のテスト（本 AC-15）へ。AC-32 の1本目（unavailable）・2本目（loading）はそのまま                                                                                                       | S2       |
| 〃                                                                                                             | `UI-1`（`plus-card-tag` の地が `colors.primary[500]`）                                     | **そのまま**（`plus-card-tag` は「おすすめ」のまま残す）                                                                                                                                           | —        |
| 〃                                                                                                             | AC-19・20・22〜24・26〜31・UI-2・UI-3                                                      | **そのまま**（変えずに通ること＝本 AC-10）                                                                                                                                                         | —        |
| `src/components/plus/__tests__/PlusSheet.test.tsx`                                                             | 冒頭のコメント・helper `sheet()` の `onRestored={jest.fn()}`                               | **消す**（`PlusSheet` の props から無くなり型エラーになる）。コメントに #272 を足す                                                                                                                | S2       |
| 〃                                                                                                             | 1本目「買っている最中に isPlus が先に true になっても、閉じるまで「購入済み」に変えない」  | **直す**。S1: 札が無料のカードのまま・「おすすめ」が残ることを足す（本 AC-4）。S2: 58行目の `getByText('購入を復元')`（買う前の形のままかの目印）を「1回だけの支払い」が出たままの検査に置き換える | S1 / S2  |
| 〃                                                                                                             | 3本目「開いている間に買う以外で plus と分かったら…「購入済み」にする」                     | **直す**。札がプラスのカードへ移り「おすすめ」が消えることを足す（本 AC-5）                                                                                                                        | S1       |
| 〃                                                                                                             | 5本目「閉じる動きの間は押せない…」                                                         | **直す**。`plus-restore` を押す行（86行目）と `plus.restore` の検査（88行目）を消す。`plus-buy` の検査は残す                                                                                       | S2       |
| 〃                                                                                                             | 2本目・4本目（日付の枠）                                                                   | **そのまま**                                                                                                                                                                                       | —        |
| `src/screens/__tests__/PlusScreen.test.tsx`                                                                    | 冒頭のコメント                                                                             | #272 の契約書を足す                                                                                                                                                                                | S1       |
| 〃                                                                                                             | `AC-41`                                                                                    | **そのまま**（「購入を復元」は E に残る）。本 AC-6・AC-11 は別の `it` で足す                                                                                                                       | —        |
| 〃                                                                                                             | `AC-44: 復元できたらこの画面のまま「購入済み」`                                            | **直す**。S3: 札がプラスへ移る・「おすすめ」「以前に購入した方は」・`plus-restore-row` が消えることを足す（本 AC-13）                                                                              | S3       |
| 〃                                                                                                             | `AC-45: プラスで開くとボタンは「購入済み」で押せない`                                      | **直す**。S1: 札がプラスのカード・「おすすめ」なし（本 AC-7）。S3: 下の1行が無く規約の行はある（本 AC-17）                                                                                         | S1 / S3  |
| `src/screens/__tests__/SettingsPlus.test.tsx`・`src/hooks/__tests__/usePlus.test.ts`・`RootNavigator.test.tsx` | 全部                                                                                       | **そのまま**（`usePlus` の `restore()` は E で使い続ける＝#270 AC-18 は残す）                                                                                                                      | —        |

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準に基づいて合否判定を行う。B の条件は #270 AC-19 と同じ（今日 2026-09-26・予定 `{ 2026-10-03: 東山めぐり }`・`BILLING_ENABLED = true` をモック・plus なし・`priceString: '¥980'`）。E は `BILLING_ENABLED = true` をモック・ログイン済み・キー `appl_x`。

### 機能基準 — 札「いまのプラン」（S1・Jest）

- [ ] AC-1: `PlusPlanCards` を `priceString="¥980"`・`isPlus={false}` で描くと、`plus-card-free` の中に `plus-card-tag-now`（文字「いまのプラン」）があり、`plus-card-plus` の中に `plus-card-tag`（文字「おすすめ」）がある。`plus-card-plus` の中に `plus-card-tag-now` は無い。`getAllByText('いまのプラン')` が1件
- [ ] AC-2: `PlusPlanCards` を `isPlus={true}` で描くと、`plus-card-plus` の中に `plus-card-tag-now`（文字「いまのプラン」）があり、`plus-card-free` の中には無い。`plus-card-tag` と文字「おすすめ」は無い。`getAllByText('いまのプラン')` が1件
- [ ] AC-3: B（予定タブ →「＋ 予定を組む」`plan-new`）で出たシートの `plus-card-free` の中に「いまのプラン」、`plus-card-plus` の中に「おすすめ」がある
- [ ] AC-4: `PlusSheet`（`targetDate='2026-10-10'`・plus なし）を描き、`busy: true, isPlus: true` で描き直しても、`plus-card-tag-now` は `plus-card-free` の中のままで「おすすめ」も残る。続けて `targetDate=null`・`isPlus: true`・`busy: false` で描き直す（閉じる動きの間）と、`sheet-closed` の状態で、`plus-card-tag-now` は `plus-card-free` の中・「おすすめ」あり・`plus-buy` の文字「¥980でプラスにする」・「1回だけの支払い」ありのまま
- [ ] AC-5: `PlusSheet` を `targetDate='2026-10-10'`・`status: 'loading'`・`priceString: null` で描き、同じ日付のまま `isPlus: true`・`busy: false` で描き直すと、`plus-card-tag-now` が `plus-card-plus` の中に移り、「おすすめ」が無く、`plus-buy` の文字が「購入済み」
- [ ] AC-6: E（`PlusScreen`・plus なし）で、`plus-card-free` の中に「いまのプラン」、`plus-card-plus` の中に「おすすめ」がある
- [ ] AC-7: plus ありで E を開くと（`getCustomerInfo` が plus あり）、`plus-buy` が「購入済み」になったあと、`plus-card-plus` の中に「いまのプラン」があり、`plus-card-free` の中に無く、「おすすめ」が無い

### 機能基準 — B から「購入を復元」を外す（S2・Jest）

- [ ] AC-8: B のシート（`plus-sheet`）の中に、`plus-restore`・`plus-restore-row`・文字「購入を復元」・文字 /以前に購入した方は/ のどれも無い。`plus-buy`・`plus-later`・`accessibilityLabel="閉じる"` の要素・`plus-terms`・`plus-privacy` はある。これを **`status = 'ready'` のときと、キーが無いとき（`EXPO_PUBLIC_REVENUECAT_IOS_KEY` を消す＝`unavailable`・`canRestore` false）の両方**で確かめる
- [ ] AC-9: B で購入の実行中（`purchasePackage` が未解決）は `plus-buy` が disabled で、もう一度押しても `purchasePackage` は1回のまま（#270 AC-33 から復元の部分を除いたもの）
- [ ] AC-10: B の購入・キャンセル・失敗・「あとで」・✕・規約・ポリシーの動き（#270 AC-22・23・24・26・27）が変わらない: `PlanCalendarPlus.test.tsx` のこの5つのテストが残っていて、期待値を変えずに通る

### 機能基準 — E の下の1行（S3・Jest）

- [ ] AC-11: E（plus なし・`status = 'ready'`）に `plus-restore-row` があり、その中に文字「以前に購入した方は」と「購入を復元」がある。`plus-restore` の中にあるのは「購入を復元」だけで、`within(plus-restore)` で /以前に購入した方は/ が見つからない。`getAllByTestId('plus-restore')` が1件。`plus-later` と「あとで」は無い
- [ ] AC-12: E の並び: `getAllByTestId(/^plus-(buy|legal|restore-row)$/)` の testID が順に `['plus-buy', 'plus-legal', 'plus-restore-row']`。`plus-legal` の中に `plus-terms` と `plus-privacy` がある
- [ ] AC-13: E で `plus-restore` を押し、`restorePurchases` が plus ありで resolve すると、`Alert.alert` が「購入を復元しました」で呼ばれ、`popTo`・`navigate` は呼ばれない。そのあと `plus-buy` が「購入済み」で disabled、`plus-restore-row`・文字「以前に購入した方は」「購入を復元」「1回だけの支払い」「おすすめ」が無く、`plus-card-plus` の中に「いまのプラン」がある
- [ ] AC-14: E で `restorePurchases` が plus なしで resolve すると `Alert.alert` が「復元できる購入が見つかりませんでした」、reject すると「購入を復元できませんでした」で呼ばれる。どちらのあとも `plus-restore-row` が残り、`plus-buy` の文字は「¥980でプラスにする」、`popTo`・`navigate` は呼ばれない
- [ ] AC-15: キーが無いとき（`EXPO_PUBLIC_REVENUECAT_IOS_KEY` を消す＝`canRestore` false）、E に `plus-restore-row` はあり、`plus-restore` が disabled で、押しても `restorePurchases` は呼ばれない
- [ ] AC-16: E で購入の実行中（`purchasePackage` が未解決）は `plus-restore` が disabled。復元の実行中（`restorePurchases` が未解決）は `plus-buy` が disabled で、`plus-restore` をもう一度押しても `restorePurchases` は1回のまま
- [ ] AC-17: plus ありで E を開くと、`plus-buy` が「購入済み」になったあと、`plus-restore-row`・文字「以前に購入した方は」「購入を復元」「1回だけの支払い」が無く、`plus-legal`（`plus-terms`・`plus-privacy`）はある

### UI基準

- [ ] UI-1: 札の見た目（Jest・`PlusPlanCards` を `isPlus={false}` で描く。画面では B・E のカード）: `StyleSheet.flatten(plus-card-tag-now の style)` が `{ position: 'absolute', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.pin.wishlisted, borderRadius: borderRadius.full }` を含み、`top`・`left` が `plus-card-tag`（おすすめ）と同じ値、`paddingVertical`・`paddingHorizontal` がそれぞれ `plus-card-tag` の値より 1 小さい。「いまのプラン」の字の `color` が `colors.pin.wishlisted`、`fontSize`・`fontWeight` が「おすすめ」の字と同じ。「おすすめ」の札の地は `colors.primary[500]`・字は `colors.white` のまま。`isPlus={true}` のときも `plus-card-tag-now` の地は `colors.white`・枠は `colors.pin.wishlisted`
- [ ] UI-2: 下の1行の見た目（Jest・E＝設定 →「御朱印さんぽ プラス」）: `plus-restore-row` の style が `flexDirection: 'row'`・`justifyContent: 'center'` を含む。「以前に購入した方は」の字は `color: colors.gray[400]` で、`fontSize` が `plus-terms` の中の「利用規約」の字と同じ。「購入を復元」の字は `color: colors.gray[500]`・`fontWeight: '700'`・`textDecorationLine: 'underline'` で、`fontSize` が「利用規約」の字と同じ。キーが無いとき（押せない）の「購入を復元」の字は `color: colors.gray[300]`
- [ ] UI-3: **native-only（シミュレータ・Test Store）**: 下の「シミュレータでの確認」の状態で、予定タブ（これからの予定が1件以上）→ 空いた日 → シート B に、無料のカードの札「いまのプラン」（白地・teal の枠と字）、プラスのカードの札「おすすめ」が出て、ボタンの下が「1回だけの支払い・毎月はかかりません」「あとで」「利用規約・プライバシーポリシー」だけで「購入を復元」が無い。札の上の端が上の日付の枠（「ここにも入れる」の行）と重ならない。「{priceString}でプラスにする」→ Test Store の「Test valid purchase」で買うと、**閉じる動きの間、札は無料のカードのまま・ボタンの文字は「{priceString}でプラスにする」のまま**で（画面の録画で確かめる）、予定を組む画面とトースト「プラスになりました。ありがとうございます」が出る。スクリーンショットと録画を `.claude/harness/evidence/issue-272/` に置き、v4 の B（v4）と並べて PR に貼る
- [ ] UI-4: **native-only（シミュレータ・Test Store）**: 同じ状態で、設定 →「御朱印さんぽ プラス」→ E に、無料のカードの札「いまのプラン」と、利用規約・プライバシーポリシーの行の下に「以前に購入した方は 購入を復元」が小さく出る。「購入を復元」の字を押すと Alert が1つ出る（「購入を復元しました」「復元できる購入が見つかりませんでした」「購入を復元できませんでした」のどれか）でアプリが落ちない。「購入を復元しました」なら E に留まり、ボタン「購入済み」・札がプラスのカードへ・「おすすめ」と下の1行と「1回だけの支払い」が消える。**どの Alert が出たかを progress.md に書く**（「購入を復元しました」以外なら、Test Store の復元の結果として記録し、本物の復元は sandbox＝#270 H-7 の Issue で確かめる）。スクリーンショットを v4 の E（v4）と並べて PR に貼る
- [ ] UI-5: **native-only（シミュレータ・Test Store）**: 一時的な書き換えを入れずに（テスト用アカウントはプラス）、設定 →「御朱印さんぽ プラス」→ E が v4 の F（v4）の形: 札「いまのプラン」がプラスのカード・「おすすめ」なし・無料のカードに札なし・ボタン「購入済み」・「1回だけの支払い」と「以前に購入した方は 購入を復元」なし・利用規約・プライバシーポリシーの行はある。**開いた直後に札が無料のカードからプラスのカードへ動くのが目に見えるか**（D-9）を録画で確かめて progress.md に書く（見えても、この契約の不合格にはしない）

### E2E

- なし。`BILLING_ENABLED = false` のまま出すので、コミットした状態のアプリには購入の導線が出ず、Maestro で辿れない（#270 と同じ）

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: `BILLING_ENABLED = false` のまま: `git diff origin/develop...HEAD -- src/constants/plus.ts` が空（#270 AC-1 のテストも通る）
- [ ] Q-5: 変えたファイルが次の中だけ: `git diff --name-only origin/develop...HEAD` が `docs/issues/issue-272-plus-restore-link.md`・`docs/design/mockups/2026-09-plus-paywall-v4.html`・`docs/design/mockups/2026-09-plus-paywall-v4.png`・`src/components/plus/PlusPlanCards.tsx`・`src/components/plus/PlusPurchasePanel.tsx`・`src/components/plus/PlusSheet.tsx`・`src/screens/PlusScreen.tsx`・`src/screens/PlanCalendarScreen.tsx`・`src/components/plus/__tests__/PlusPlanCards.test.tsx`・`src/components/plus/__tests__/PlusSheet.test.tsx`・`src/screens/__tests__/PlanCalendarPlus.test.tsx`・`src/screens/__tests__/PlusScreen.test.tsx`・`.claude/harness/` の下 に含まれる（`src/hooks/usePlus.ts`・`src/services/`・`src/theme/`・`PlusSettingsCard.tsx`・`PlusThanksToast.tsx`・`SettingsScreen.tsx`・`jest.setup.js`・`metro.config.js`・`app.json` に差分が無い）
- [ ] Q-6: `package.json` / `package-lock.json` に差分が無い（`git diff origin/develop...HEAD -- package.json package-lock.json` が空）
- [ ] Q-7: 死んだコードを残していない: `grep -rn "onRestored" src` が0件
- [ ] Q-8: 「購入を復元」の押す所は1か所: `grep -rln "plus-restore" src --include='*.tsx' | grep -v __tests__` が `src/components/plus/PlusPurchasePanel.tsx` の1件だけ
- [ ] Q-9: 色の直値が無い: `grep -rnE "['\"]#[0-9A-Fa-f]{3,8}['\"]" src/components/plus src/screens/PlusScreen.tsx | grep -v __tests__` が0件
- [ ] Q-10: 値段をハードコードしていない: `grep -rn "980" src/components/plus src/screens/PlusScreen.tsx | grep -v __tests__` が0件
- [ ] Q-11: #270 D-23 の import の制限が保たれている: `grep -rlE "usePlus|PlusSheet|PlusPurchasePanel" src --include='*.tsx' --include='*.ts' | grep -v __tests__` が `src/hooks/usePlus.ts`・`src/screens/PlanCalendarScreen.tsx`・`src/screens/SettingsScreen.tsx`・`src/screens/PlusScreen.tsx`・`src/components/plus/` の中だけ
- [ ] Q-12: `.env` / `.env.local` / `ios/` をコミットしていない。`git grep -nE "test_[A-Za-z0-9]{10,}"` が0件（S4 の一時的な書き換え・Test Store のキーを持ち込まない）

## スライス（1スライス = 1コミット・TDD）

| #   | 中身                                                                                                                                                                                                                                                                                        | 主な基準             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| S1  | 札: `PlusPlanCards` に `isPlus`・「いまのプラン」/ `PlusSheet` は `shown.isPlus`・`PlusScreen` は `plus.isPlus` を渡す / `PlusPlanCards.test.tsx`（新規）・`PlusSheet.test.tsx`・`PlanCalendarPlus.test.tsx`・`PlusScreen.test.tsx` に札の検査                                              | AC-1〜7・UI-1        |
| S2  | シートから復元を外す: `PlusPurchasePanel` に `showRestore`・`onRestored` を消す・「あとで」の行は `onLater` のときだけ / `PlusSheet`・`PlanCalendarScreen` の `onRestored` を消す / `PlusScreen` は `showRestore`（E の「購入を復元」はまだ今の場所）/ 既存テストを上の表のとおり直す・消す | AC-8〜10・Q-7        |
| S3  | E の下の1行: 規約の行に `plus-legal`・その下に `plus-restore-row`（「以前に購入した方は」＋`plus-restore`「購入を復元」）/ `PlusScreen.test.tsx` に AC-11〜17・UI-2                                                                                                                         | AC-11〜17・UI-2・Q-8 |
| S4  | シミュレータで確認（コードの変更が出たら fix のコミット）。`progress.md`・`feature-list.json` に記録・証跡を `.claude/harness/evidence/issue-272/`                                                                                                                                          | UI-3〜5              |

## 手順

### シミュレータでの確認（S4・native-only・実装する人が行う）

#270 S6 と同じやり方（`.claude/harness/progress.md` の 2026-09-26（夜・途中）/（夜・S6）の記録）。**ネイティブの依存は変えないので、ビルドし直しは要らない**（Debug のアプリは JS を Metro から読む）。

1. **アプリ**: #270 S6 で作ったローカルの Debug ビルド（`ios/build/dd/Build/Products/Debug-iphonesimulator/` の .app・シミュレータ goshuin-repro）を使う。無ければ progress.md のとおり `ios/` で `pod install` → `xcodebuild -workspace app.xcworkspace -scheme app -sdk iphonesimulator -destination 'id=<UDID>' -derivedDataPath build/dd` で作る（`npx expo run:ios` は Xcode 26 の devicectl の出力を読めずに止まる）
2. **キー**: `.env.local` の `EXPO_PUBLIC_REVENUECAT_IOS_KEY` が Test Store のキー（`test_` で始まる）であることを、キーを画面に出さずに確かめる（例: `grep -c '^EXPO_PUBLIC_REVENUECAT_IOS_KEY=test_' .env.local` が 1）
3. **スイッチ**: `src/constants/plus.ts` を**ローカルでだけ** `BILLING_ENABLED = true` にする（コミットしない）
4. **無料の状態を作る（UI-3・UI-4 だけ）**: いまのテスト用アカウントはすでにプラス（RevenueCat のサーバーで entitlement `plus` が付いている）なので、そのままでは B・E の無料の形が出ない。**コミットしないローカルだけの一時的な書き換え**を入れる: `src/hooks/usePlus.ts` で、モジュールの変数を1つ持ち、**この起動中に `purchase()` が `'purchased'` か `restore()` が `'restored'` を返すまで、`isPlus` を `false` として返す**（#270 S6 で「閉じていくシートの中身」を確かめたときと同じ考え方。Test Store は持っている買い切りも買い直せた）。復元でも外すのは、UI-4 で E の復元を押したあとの形まで見るため
5. **Metro**: `/dev` で起動し（`.env.local` を読み直すため、起動中なら止めてから）、シミュレータのアプリを開く
6. UI-3 → UI-4 の順に行う（UI-3 で買うと書き換えが外れるので、UI-4 の前にアプリを起動し直して無料の形に戻す）。次に**書き換えを外して** Metro を読み直し、UI-5 を行う。スクリーンショット・録画は `.claude/harness/evidence/issue-272/` へ
7. 終わったら `BILLING_ENABLED` を `false` に、`usePlus.ts` を元に戻し、`git status` で `src/constants/plus.ts`・`src/hooks/usePlus.ts` に差分が無いことを確かめる（Q-4・Q-5）

## やらないこと（スコープ外）

- 購入の仕組み（`usePlus`・`services/purchases`・RevenueCat の設定・Restore Behavior の設定）の変更
- `BILLING_ENABLED` を true にすること（#270 H-7 の別の Issue）
- 設定のカード（`PlusSettingsCard`）・トースト（`PlusThanksToast`）・設定の画面の変更
- 「1回だけの支払い・毎月はかかりません」の行、購入・復元の Alert の文言の変更
- 「購入を復元」という言葉を別の言葉に変えること（審査で探される言葉なので残す）
- H の「購入済みです」の確認をアプリで作ること（App Store が出す）
- 読み込み中に札がちらつくのを抑えること（D-9。`usePlus` を変えないため）
- 札に動き（アニメーション）を足すこと
- #270 の契約書・`docs/design/ui-design.md` の書き換え
- Expo Web での確認・Android

## リスク・不確実な点／申し送り

- **v4 の H（以前に買った人が「プラスにする」を押すと、App Store が「購入済み」と出して課金されずにプラスになる）は sandbox でしか確かめられない**ので、この契約の受入基準に入れない。**#270 H-7 の Issue（スイッチを入れる Issue）で確かめる**こととして、そこへ申し送る。確かめること: ① 持っている買い切りを `purchasePackage` したとき、App Store がどんな確認を出し、課金されないか ② RevenueCat を通して `'purchased'` が返り、F と同じ流れ（B なら予定を組む画面とトースト・E なら設定へ戻ってトースト）になるか ③ **RevenueCat の Restore Behavior の設定**（前のアカウントに付いていた購入を今のアカウントへ移すか）。移さない設定だと、別のアカウントでは「プラスにする」も「購入を復元」もプラスにならず、「購入できませんでした」「復元できる購入が見つかりませんでした」になりうる。v4 の H の前提はこの設定で決まる
- **App Store の審査（Guideline 3.1.1 の復元の仕組み）**: 復元は E（設定 →「御朱印さんぽ プラス」）にだけ残る。案内のシート B には無い。E で「購入を復元」の言葉が見えるので足りる見込みだが、審査員が B で探して却下することはありうる。そのときは B の `PlusPurchasePanel` に `showRestore` を渡すだけで同じ1行を出せる（D-5・D-6 の作り）
- **「購入を復元」の押せる範囲が小さい**（`typography.caption` の字）。`hitSlop={8}` で広げる（D-6）。押しやすさは UI-4 で確かめる
- **Test Store の `restorePurchases` の結果は未確認**（#270 では、プラスのアカウントでは「購入を復元」が出ず試せなかった）。UI-4 は一時的な書き換えで無料に見せて押すので、どの Alert が出るかを記録する。本物の復元の経路は sandbox（#270 H-7）
- **D-9 の札のちらつき**: プラスの人が E を開いた直後に札が無料 → プラスへ動きうる。UI-5 で目に見えるかを記録する。見えて気になるなら、`usePlus` に「CustomerInfo を読み込み中か」を足す別の Issue にする
- **#270 の契約書の記述が一部古くなる**（D-1 の①〜⑥）。書き換えずに、この契約書で置き換えを明記している。あとで #270 の契約書を読む人は、この契約書も合わせて読む必要がある
