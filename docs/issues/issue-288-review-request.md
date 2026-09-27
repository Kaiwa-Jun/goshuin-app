# Issue #288: 3件目の記録のあとに App Store のレビューを依頼し、設定から評価を書けるようにする

## 概要

2026-09-27 のオーナー判断（マーケティングの整理）。**10月のビルド 1.2.0 に載せる**。評価はいま0件。

1. **記録の保存を終えて戻った少し後に、システムのレビュー依頼を出す**（`SKStoreReviewController` / `AppStore.requestReview`。`expo-store-review` のネイティブ部分を使う）。1回目は「通算の枚数が3枚以上になった最初の保存の後」。2回目・3回目は 10枚・30枚以上で、前回から90日以上あいたとき。依頼は1台の端末で3回まで。独自の依頼画面（独自の★・満足度で振り分ける画面）は作らない
2. **設定の「アプリ情報」の最後に「App Store でレビューを書く」の行を足す**（iOS だけ）。押すと `https://apps.apple.com/app/id6797201465?action=write-review` を開く。この行ではシステムの依頼を呼ばない
3. **今の開発用アプリ（`expo-store-review` のネイティブが入っていない）でも落ちない**。ネイティブのモジュールが無ければ何もしない。新しいネイティブのビルドが要るのは「依頼が出ること」自体の確認だけで、それはローカルのシミュレータ用 Debug ビルドで行う（**EAS のビルドは使わない**）

依頼を出す瞬間の流れ（D-6）:

```
記録画面で保存 → 完了画面（「N枚目」）が開く … ここで「この起動の中だけの印」に N を置く
  ├ 「地図に戻る」「御朱印帳に戻る」・下へのスワイプ → メインのタブにフォーカスが戻る
  │     → 印を取り出す → 1500ms 待つ → 履歴を読んで判定 → 出すなら requestReview → 履歴を書く
  └ 「もう1枚記録する」 → 記録画面が開く … ここで印を消す（✕ で戻っても、保存に失敗しても出さない）
```

## 関連ドキュメント

- GitHub Issue #288（スコープ・スコープ外）
- Apple の決まり（リーダーが出典つきで調べ済み・2026-09-27）
  - HIG「Ratings and reviews」（https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews ）: 一連の操作をやり遂げた後に出す。起動直後・オンボーディング中は避ける。依頼の間は1〜2週間以上あける。ボタンを押した結果として呼ばない
  - App Review Guidelines 5.6.1（https://developer.apple.com/app-store/review/guidelines/ ）: 独自のレビュー依頼画面は使わない
  - StoreKit の `requestReview`: 365日で3回まで・出すかどうかはシステムが決める。**TestFlight では出ない。開発中のビルドでは毎回出る**
- `expo-store-review` 9.0.9（Expo SDK 54 の `bundledNativeModules.json` の版）のソース（2026-09-27 に npm から取って確認）
  - `build/ExpoStoreReview.native.js`: `export default requireNativeModule('ExpoStoreReview')` を**読み込んだ瞬間に**実行する（無いと `Cannot find native module 'ExpoStoreReview'` の例外）
  - `ios/StoreReviewModule.swift`: `isAvailableAsync` は「TestFlight で配られていない」なら true（シミュレータは常に true）。`requestReview` は iOS 16 以上で `AppStore.requestReview(in:)`、前面の scene が無いと `MissingCurrentWindowSceneException` で reject
  - `build/StoreReview.js` の `requestReview()` は、ネイティブが無いとストアの URL を `Linking` で開く（`ios.appStoreUrl` があれば）
- 前例: 年報の自動再生 [`issue-274-annual-report.md`](./issue-274-annual-report.md) の D-17・D-18（`TabNavigator` の `useIsFocused` で「メインのタブが一番上にあるか」を見る。`src/hooks/useAnnualReportAutoPlay.ts`）
- 端末に残す値の書き方: `src/hooks/useOnboarding.ts`・`src/hooks/useGalleryViewMode.ts`（AsyncStorage）
- この起動の中だけのモジュールの変数の前例: `src/services/purchases.ts`（`configured`・`pending`）・`src/utils/annualReportNow.ts`（`devAsDecember`）
- シミュレータのローカルビルドのやり方: `.claude/harness/progress.md` の 2026-09-26（夜・途中）（`expo run:ios` は Xcode 26 の devicectl の出力を読めずに止まる → `pod install` ＋ `xcodebuild`）
- EAS のビルド回数の事情: `.claude/harness/resume-2026-10.md`（リセットは 2026-10-01。1回の確認で何本も使ったことがある）
- 画面仕様: [`docs/design/ui-design.md`](../design/ui-design.md) の「4.6 登録完了画面」「4.9 設定画面」（S4 で書き足す）
- 確認済み: `docs/product/requirements.md` にレビュー依頼の要件は無く、矛盾しない。`docs/product/direction.md` は Android を後回し（Google Play は未公開）としており、D-10 と合う

## 設計上の決定（要件に無い点）

| #    | 決めたこと                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | **ネイティブのモジュールの読み方**: `npx expo install expo-store-review`（`~9.0.9`）で入れるのは**ネイティブ側のため**（autolinking でビルドに入る）。**JS からは `expo-store-review` を import も require もしない**。理由: 入口が読み込んだ瞬間に `requireNativeModule` を呼ぶので、今の開発用アプリ（オーナーの iPhone・シミュレータの既存の .app）では import した時点で落ちる。遅延 require でも同じ例外になる。また JS の `requestReview()` はネイティブが無いとストアの URL を開きに行く（依頼ではない瞬間に App Store へ飛ぶ）。代わりに `src/services/storeReview.ts` で **`import { requireOptionalNativeModule } from 'expo'`**（SDK 54 の `expo` が `expo-modules-core` から再エクスポートしている）で `'ExpoStoreReview'` を読み、**null なら何もしない**。`requireOptionalNativeModule` は、無いときは null を返し、読み込みの例外も握って null にする（`expo-modules-core` 3.0.29 の `requireNativeModule.ts`）。使うのは `isAvailableAsync()` と `requestReview()` の2つだけで、型は `src/services/storeReview.ts` に自分で書く（`interface StoreReviewNative`）。**`Platform.OS !== 'ios'` のときは読みにも行かない**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-2  | **Jest のモック**: `jest.setup.js` に `jest.mock('expo', () => ({ ...jest.requireActual('expo'), requireOptionalNativeModule: jest.fn(…) }))` を足す。既定は **`'ExpoStoreReview'` なら null（＝今の開発用アプリと同じ「無い」）、それ以外は本物を呼ぶ**。モジュールがあるときのテストは `jest.mocked(requireOptionalNativeModule).mockImplementation(…)` で偽のモジュール（`isAvailableAsync`・`requestReview` が `jest.fn`）を返す。理由: jest-expo は `ExpoStoreReview` を自動でモックしており、何もしないと「モジュールがある・`isAvailableAsync()` が undefined」になる（2026-09-27 に scratchpad の使い捨てのテストで確認）。どのテストでも既定が「無い」に決まるようにする。テストファイルで `expo`・`expo-modules-core`・`expo-store-review` を `jest.mock` しない（expo のモックは `jest.setup.js` に集める決まり）。`jest.requireActual('expo')` を含む部分モックが jest-expo で動くことも同じ使い捨てのテストで確認した                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-3  | **何を数えるか**: **完了画面の「N枚目」と同じ値**＝`RecordComplete` の params の `totalStampCount`（保存の前に取ったサーバーの県ごとの枚数の合計に、今回の枚数を足したもの。`buildMapParams`）。単位は**枚**（1回の保存で3枚まとめて記録すれば、その保存で3枚になる）。**完了画面に「N枚目」が出るとき（`countUnavailable` が true でなく、`totalStampCount` が undefined でない）だけ数える**。取れなかったときは推し量らず、その保存では出さない（次の保存で判定し直す）。理由: ① 画面の数字と一致する ② サーバーが正（削除すれば減る・端末をまたいでも同じ）③ 既存の記録がある人も対象にできる（評価が0件なので、記録を続けている人に聞く価値が高い）。端末で保存の回数を数える案は採らない（既存の人は 1.2.0 のあと3回保存するまで聞けない・入れ直すと0に戻る・画面の数字とずれる）。**この決定の帰結（オーナーが知っておくこと）**: ⓐ すでに3枚以上ある人は、**1.2.0 に上げて最初の保存の後に**1回目の依頼の対象になる（オーナー自身のアカウントも同じ）ⓑ 初めての保存で3枚まとめて記録した人は、その保存の後に対象になる                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D-4  | **何回目に・どれだけあけて**: 依頼の履歴を**端末に1つ**持つ（AsyncStorage のキー **`store_review_history`**、値は JSON `{"count":n,"lastRequestedAt":"<ISO 8601>"}`。キーにユーザー ID を含めない）。**(count+1) 回目の依頼を出すのは、通算の枚数が `STORE_REVIEW_THRESHOLDS[count]` 以上で、count が1以上なら前回（`lastRequestedAt`）から `STORE_REVIEW_MIN_INTERVAL_DAYS` 日以上たったとき**。`STORE_REVIEW_THRESHOLDS = [3, 10, 30]`・`STORE_REVIEW_MIN_INTERVAL_DAYS = 90`。**count が3になったら二度と出さない**。90日ちょうどは「たった」に含める。履歴を書く（count を1増やし、`lastRequestedAt` をそのときの時刻にする）のは **`requestReview()` が resolve したときだけ**（実際に表示されたかはシステムが決めるので分からない。呼べたら1回と数える）。ネイティブが無い・`isAvailableAsync()` が false（TestFlight）・iOS 以外・`requestReview()` が reject のときは**書かない**（次の保存で判定し直す）。値が壊れているとき（JSON でない・count が 0〜3 の整数でない・count が1以上で `lastRequestedAt` が日時として読めない）は `{ count: 0, lastRequestedAt: null }` として扱う。理由: Apple の上限は365日で3回、HIG は1〜2週間以上あける。90日なら余裕があり、3回目が1回目から180日以上あとになる                                                                                                                                                                                                                                                                                                                                                                                                          |
| D-5  | **削除・ログアウト・退会・入れ直し**: 履歴は**減らさない・消さない**。記録を削除して3枚を割り、また3枚になっても、count は1のまま（2回目は 10枚・90日の条件）。**ログアウト・退会で履歴を消さない**（今もログアウト・退会で AsyncStorage は消していない＝`src/services/auth.ts`・`account.ts` で確認）。別のアカウントでログインしても同じ履歴を使う。理由: App Store の評価と Apple の上限は端末（Apple ID）のもので、アプリのアカウントのものではない。アプリを消して入れ直すと AsyncStorage ごと消えて最初からになる（まれなので受け入れる。Apple の上限は効く）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-6  | **出す瞬間**: ① `RecordCompleteScreen` が開いたとき（マウントの effect）、D-3 の条件を満たせば **`noteRecordCompleted(totalStampCount)`** で「この起動の中だけの印」に枚数を置く（前の印は上書き）② `RecordScreen` が開いたとき（マウントの effect）**`clearRecordCompleted()`** で印を消す（「もう1枚記録する」の後に ✕ で戻った・保存に失敗してエラー画面から戻った、のどちらでも、失敗や中断の直後に出さない）③ `TabNavigator` で呼ぶ新しいフック **`useStoreReviewRequest()`** が、メインのタブ（MainTabs）にフォーカスがあるとき **`takeRecordCompleted()`** で印を取り出す（取り出すと印は消える）。印が無ければ何もしない（AsyncStorage も読まない）④ 印があれば **`STORE_REVIEW_DELAY_MS` = 1500** ミリ秒待ち、**履歴を読む → D-4 で判定 → 出すなら `requestStoreReview()` → true なら履歴を書く**。⑤ 待っている間・読んでいる間に、**フォーカスを失う**（記録・年報・ログイン・プラス・規約など RootStack の画面が上に来る）・**アプリが裏へ回る**（`AppState` が `'active'` 以外になる）・**フックが外れる**、のどれかが起きたら取りやめ、**印は戻さない**（次の保存で判定し直す）。**印をモジュールの変数に置く理由**: 印は「この起動の中で、完了画面を見た」という一度きりの合図で、起動をまたいではいけない（AsyncStorage に置くと、完了画面でアプリを終了した人に**次の起動の直後に**出てしまう）。画面を描き直すための状態ではないので React の state・Context は使わない（グローバルの状態管理を入れない決まりのまま）。モジュールの変数は `services/purchases.ts`・`utils/annualReportNow.ts` に前例がある。1500ms は、完了画面が閉じる動き（native-stack の pop）が終わって地図が見えてからにするため |
| D-7  | **出さない場面**（どれも D-6 の仕組みで決まる）: 保存がすべて失敗（エラー画面へ・完了画面が開かない）/ 一部だけ保存（記録画面に残って「残りN枚をもう一度」・完了画面が開かない）/ **オフライン**（このアプリにオフラインの一時保存は無い＝`src` に offline・NetInfo・保存の待ち行列が無いことを確認。オフラインの保存は失敗してエラー画面へ行く）/ 県ごとの枚数を取れなかった（`totalStampCount` が無い）・訪問済みの取得に失敗した（`countUnavailable`）/ **起動直後**（印はモジュールの変数なので起動のたびに空）/ **オンボーディング中**（MainTabs にフォーカスが無い）/ **完了画面・年報・ログインなど RootStack の画面が開いている間**（同上）/ ゲスト（記録画面へ行けない＝地図はログインを促すモーダルを出す）/ Android・Web（D-10）/ TestFlight（`isAvailableAsync()` が false）/ ネイティブが無い開発用アプリ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-8  | **「ボタンを押した結果として」呼ばない**: `requestStoreReview()` を呼ぶのは `useStoreReviewRequest` のタイマーの中だけ。どの `onPress` の中でも呼ばない。完了画面の「地図に戻る」「御朱印帳に戻る」は画面を閉じるためのボタンで、依頼はメインのタブに戻ってから時間をおいて出る（下へのスワイプで閉じても同じ）。評価を書く導線は設定の行（D-9）で、そこは `Linking.openURL` だけ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D-9  | **設定の行**: 今の「アプリ情報」の行は「バージョン」「利用規約」「プライバシーポリシー」の3つだけ（意見・サポートの行は無い）。その**最後（「プライバシーポリシー」の下）に「App Store でレビューを書く」**の行を足す（法的な文書2つの並びを割らない。アプリの外へ出る行をいちばん下に置く）。形は「利用規約」の行と同じ: `TouchableOpacity`（`styles.row`）の中に `Text`（`styles.rowLabel`）と `MaterialIcons` `chevron-right`（`size={24}`・`color={colors.gray[400]}`）。`testID="store-review-row"`・`accessibilityRole="link"`。押すと `openAppStoreWriteReview()`（＝`Linking.openURL(APP_STORE_WRITE_REVIEW_URL)`）。reject したら `Alert.alert('App Store を開けませんでした')`（`PlanStopList` の「Google マップを開けませんでした」と同じ形）。ゲストにもログイン済みにも出す。**iOS だけ出す**（`Platform.OS === 'ios'`）。言葉は使う人の動作で書く（「評価する」「レビュー」だけにしない）。新しいトークン・新しいセクションは足さない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-10 | **Web・Android**: 設定の行は出さない（Android は Google Play が未公開で、App Store へのリンクは違う店になる。Web は配らない・UI の確認専用）。依頼は `requestStoreReview()` が `Platform.OS !== 'ios'` で false を返すので出ない（履歴も書かない）。Android の In-App Review はスコープ外                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D-11 | **定数と置き場所**: `src/constants/storeReview.ts` に `APP_STORE_WRITE_REVIEW_URL = 'https://apps.apple.com/app/id6797201465?action=write-review'`・`STORE_REVIEW_HISTORY_KEY = 'store_review_history'`・`STORE_REVIEW_THRESHOLDS = [3, 10, 30] as const`・`STORE_REVIEW_MIN_INTERVAL_DAYS = 90`・`STORE_REVIEW_DELAY_MS = 1500`。**アプリ ID `6797201465` を書くのはこのファイルだけ**。判定（純粋な関数）は `src/utils/storeReview.ts`（`parseStoreReviewHistory`・`decideStoreReview`。年報の `decideAutoPlay` と同じ分け方）、ネイティブ・印・履歴の読み書き・リンクは `src/services/storeReview.ts`、画面との橋渡しは `src/hooks/useStoreReviewRequest.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-12 | **変えないもの**: `app.json`（`expo-store-review` に config plugin は無い。JS の `storeUrl()` を使わないので `ios.appStoreUrl` も足さない）・`eas.json`・`metro.config.js`・`src/navigation/types.ts`（params を足さない）・`src/hooks/useAnnualReportAutoPlay.ts`・完了画面の見た目と文言・`src/theme/`。`package.json` の差分は `expo-store-review` の1行だけ（`npx expo prebuild` が `scripts` を書き換えたら戻す）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-13 | **確認とビルド**: **この Issue のために EAS のビルドは作らない**。依頼が出ること自体は**ローカルのシミュレータ用 Debug ビルド**（`npx expo prebuild` → `pod install` → `xcodebuild`）で確かめる（S5）。ネイティブが無いときに落ちないことは、**今のシミュレータの .app（`expo-store-review` が入る前のビルド）に新しい JS を読ませて**確かめる（オーナーの開発用アプリと同じ条件）。オーナーの iPhone の開発用アプリではビルドし直さずに、設定の行が App Store を開くことと落ちないことだけ確かめる（H-1）。TestFlight では依頼は出ない（Apple の仕様）ので、1.2.0 の TestFlight では「落ちない・出ない」だけを見る（H-2）。実機で依頼が出るのを見られるのは App Store で公開した後だけ（H-3・観察のみで合否にしない）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### オーナーの判断（2026-09-27）

- D-3 ⓐ: **はい**。すでに3枚以上ある人も、1.2.0 で最初に保存した後に1回目の依頼の対象にする
- D-3 ⓑ: 数える単位は**枚**（1回の保存で3枚まとめて記録すれば、その保存で3枚になる）

## 詳細設計

### 対象ファイル

| ファイル                                                                                                                                                | 変更                                                                                                                                                                                                                             | スライス |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/constants/storeReview.ts`（新規）                                                                                                                  | 定数（D-11）                                                                                                                                                                                                                     | S1       |
| `src/utils/storeReview.ts`（新規）                                                                                                                      | `StoreReviewHistory` 型・`parseStoreReviewHistory`・`decideStoreReview`（D-4）                                                                                                                                                   | S1       |
| `src/utils/__tests__/storeReview.test.ts`（新規）                                                                                                       | AC-1〜6                                                                                                                                                                                                                          | S1       |
| `package.json` / `package-lock.json`                                                                                                                    | `npx expo install expo-store-review`（`"expo-store-review": "~9.0.9"`）                                                                                                                                                          | S2       |
| `jest.setup.js`                                                                                                                                         | `expo` の `requireOptionalNativeModule` の部分モック（D-2）                                                                                                                                                                      | S2       |
| `src/services/storeReview.ts`（新規）                                                                                                                   | `requestStoreReview`・`noteRecordCompleted` / `clearRecordCompleted` / `takeRecordCompleted`・`readStoreReviewHistory` / `writeStoreReviewHistory`・`openAppStoreWriteReview`（D-1・D-4・D-6・D-9）                              | S2       |
| `src/services/__tests__/storeReview.test.ts`（新規）                                                                                                    | AC-7〜14                                                                                                                                                                                                                         | S2       |
| `src/hooks/useStoreReviewRequest.ts`（新規）                                                                                                            | D-6 の ③〜⑤                                                                                                                                                                                                                      | S3       |
| `src/hooks/__tests__/useStoreReviewRequest.test.ts`（新規）                                                                                             | AC-15〜25                                                                                                                                                                                                                        | S3       |
| `src/navigation/TabNavigator.tsx`                                                                                                                       | `useStoreReviewRequest()` を呼ぶ（`useAnnualReportAutoPlay` の隣）                                                                                                                                                               | S3       |
| `src/screens/RecordCompleteScreen.tsx`                                                                                                                  | マウントで `noteRecordCompleted`（D-6 ①）                                                                                                                                                                                        | S3       |
| `src/screens/RecordScreen.tsx`                                                                                                                          | マウントで `clearRecordCompleted`（D-6 ②）                                                                                                                                                                                       | S3       |
| `src/screens/__tests__/RecordCompleteScreen.test.tsx`・`src/screens/__tests__/RecordScreen.test.tsx`・`src/navigation/__tests__/RootNavigator.test.tsx` | AC-26〜31 を足す                                                                                                                                                                                                                 | S3       |
| `src/screens/SettingsScreen.tsx`                                                                                                                        | 「App Store でレビューを書く」の行（D-9・D-10）                                                                                                                                                                                  | S4       |
| `src/screens/__tests__/SettingsScreen.test.tsx`                                                                                                         | AC-32〜36・UI-1 を足す                                                                                                                                                                                                           | S4       |
| `docs/design/ui-design.md`                                                                                                                              | 4.9 の「アプリ情報」に「App Store でレビューを書く（iOS のみ・Issue #288）」、4.6 の末尾に「完了画面のあと、通算3枚以上などの条件でシステムのレビュー依頼（Issue #288・契約書 `docs/issues/issue-288-review-request.md`）」の1行 | S4       |
| `.claude/harness/progress.md` / `feature-list.json` / `evidence/issue-288/`                                                                             | S5 の確認結果・スクリーンショット・録画                                                                                                                                                                                          | S5       |

### データ構造・関数の形

```ts
// src/utils/storeReview.ts
export interface StoreReviewHistory {
  /** これまでに requestReview を呼べた回数（0〜3） */
  count: number;
  /** 最後に呼べた時刻（ISO 8601）。count が 0 なら null */
  lastRequestedAt: string | null;
}
export function parseStoreReviewHistory(raw: string | null): StoreReviewHistory;
export function decideStoreReview(input: {
  totalStampCount: number;
  history: StoreReviewHistory;
  now: Date;
}): boolean;

// src/services/storeReview.ts
export function noteRecordCompleted(totalStampCount: number): void;
export function clearRecordCompleted(): void;
/** 印を取り出す。取り出すと消える。無ければ null */
export function takeRecordCompleted(): number | null;
/** AsyncStorage の読み取りが失敗したら reject のまま返す（呼ぶ側で「出さない」にする） */
export function readStoreReviewHistory(): Promise<StoreReviewHistory>;
export function writeStoreReviewHistory(history: StoreReviewHistory): Promise<void>;
/** requestReview を呼べたら true。iOS 以外・モジュールが無い・使えない・失敗は false（reject しない） */
export function requestStoreReview(): Promise<boolean>;
/** Linking.openURL(APP_STORE_WRITE_REVIEW_URL) をそのまま返す */
export function openAppStoreWriteReview(): Promise<void>;

// src/hooks/useStoreReviewRequest.ts
export function useStoreReviewRequest(): void;
```

`requestStoreReview` の順: `Platform.OS !== 'ios'` → false（モジュールを読まない）→ `requireOptionalNativeModule<StoreReviewNative>('ExpoStoreReview')` が null → false → `await isAvailableAsync()` が true でない → false → `await requestReview()` が resolve → true / reject → `console.warn('[storeReview] …')` して false。

### 画面仕様

#### 設定タブ →「アプリ情報」（iOS）

- 上から: 「バージョン」（値）・「利用規約」＞・「プライバシーポリシー」＞・**「App Store でレビューを書く」＞**
- 行の形・字・矢印は「利用規約」と同じ（D-9）。押すと App Store アプリの「レビューを書く」画面が開く（実機）。シミュレータには App Store アプリが無いので Safari で開く
- Android・Web ではこの行は無く、今と同じ3行

#### 記録の完了画面 → メインのタブ（iOS・native-only）

- 完了画面が出ている間は依頼は出ない
- 「地図に戻る」「御朱印帳に戻る」（または下へのスワイプ）で戻り、約1.5秒後に、条件（D-4）を満たせばシステムの依頼（「"御朱印さんぽ"を楽しんでいますか？」の形。文言と見た目はシステムが決める）が出る。開発中のビルドでは送信できない形で毎回出る

## テスト方針

- **判定は純粋な関数（`decideStoreReview`・`parseStoreReviewHistory`）の単体テストで境界を縛る**（2枚/3枚・9枚/10枚・29枚/30枚・90日ちょうど/1分足りない・count 3・壊れた値）
- **ネイティブは D-2 のモックだけで差し替える**（既定は「無い」）。`Platform.OS` は `Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true })` で変え、`afterEach` で戻す（`SettingsScreen.test.tsx` の「開発用 — 年報」と同じ書き方）
- **フックのテストは `useAnnualReportAutoPlay.test.ts` と同じ形**: `@react-navigation/native` の `useIsFocused` をモックの変数で切り替え、`jest.useFakeTimers({ now: new Date('2026-10-05T12:00:00+09:00') })`、Promise は `act(async () => { for (…) await Promise.resolve(); })` で流す。AsyncStorage は `jest.setup.js` のモックに、テストの中で `getItem` / `setItem` が1つの Map に読み書きする実装を入れる（1回出したあとに2回目が出ないことを見るため）。`AppState` は `jest.spyOn(AppState, 'addEventListener')` で受け取った関数を呼んで裏へ回す
- **印はモジュールの変数なので、テストの `beforeEach` で `clearRecordCompleted()` を呼んで空にする**（同じファイルの中で前のテストの印が残らないように）
- **「戻った後に出る」「完了画面の上・年報の上では出ない」は `RootNavigator.test.tsx` の本物のナビゲーションで確かめる**（`navigationRef.navigate('RecordComplete', …)` → `button-exit` → `map-screen`）。フックの単体テストだけでは、native-stack の pop で `useIsFocused` が本当に変わるかを確かめられないため
- 時刻の比べ方は `lastRequestedAt` の文字列で比べる（fake timers の `now` から作った ISO 文字列）
- Expo Web では設定の行が出ないこと・落ちないことだけを見る（iOS だけの行・依頼は Web では確かめられない）。依頼と iOS の行の見え方はシミュレータ（native-only）で確かめる

### 既存テストの扱い

| ファイル                                              | テスト                                                                 | 扱い                                                                            | スライス |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| `src/screens/__tests__/SettingsScreen.test.tsx`       | `renders app info section`・位置情報の行・セクションの余白・開発用の行 | **そのまま**（行を足すだけで、既存の行・セクションは変えない）                  | —        |
| `src/screens/__tests__/SettingsPlus.test.tsx`         | 全部                                                                   | **そのまま**                                                                    | —        |
| `src/navigation/__tests__/TabNavigator.test.tsx`      | 全部                                                                   | **そのまま**（印が無いのでフックは何もしない。AsyncStorage も読まない）         | —        |
| `src/navigation/__tests__/RootNavigator.test.tsx`     | 既存の全部                                                             | **そのまま**。AC-30・31 を足し、`beforeEach` に `clearRecordCompleted()` を足す | S3       |
| `src/screens/__tests__/RecordCompleteScreen.test.tsx` | 既存の全部                                                             | **そのまま**。AC-26・27・29 を足す                                              | S3       |
| `src/screens/__tests__/RecordScreen.test.tsx`         | 既存の全部                                                             | **そのまま**。AC-28 を足す                                                      | S3       |
| `src/hooks/__tests__/useAnnualReportAutoPlay.test.ts` | 全部                                                                   | **そのまま**（`useAnnualReportAutoPlay` は変えない）                            | —        |

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準に基づいて合否判定を行う。Jest の `Platform.OS` の既定は `'ios'`（jest-expo）。「偽のモジュール」は `{ isAvailableAsync: jest.fn(async () => true), requestReview: jest.fn(async () => undefined) }` を `jest.mocked(requireOptionalNativeModule).mockImplementation(name => name === 'ExpoStoreReview' ? fake : null)` で返したもの。

### 機能基準 — 判定（S1・Jest・`src/utils/__tests__/storeReview.test.ts`）

- [ ] AC-1: `src/constants/storeReview.ts` の値が `STORE_REVIEW_THRESHOLDS` = `[3, 10, 30]`・`STORE_REVIEW_MIN_INTERVAL_DAYS` = `90`・`STORE_REVIEW_DELAY_MS` = `1500`・`STORE_REVIEW_HISTORY_KEY` = `'store_review_history'`・`APP_STORE_WRITE_REVIEW_URL` = `'https://apps.apple.com/app/id6797201465?action=write-review'`
- [ ] AC-2: 1回目: `history = { count: 0, lastRequestedAt: null }` のとき、`decideStoreReview` は `totalStampCount` 0・1・2 で false、3・4・50 で true
- [ ] AC-3: 2回目: `count: 1` で `lastRequestedAt` が `now` のちょうど90日前（`now - 90 * 86400000` ms）のとき、total 9 で false・10 で true。`lastRequestedAt` が `now - (90 * 86400000 - 60000)` ms（1分足りない）なら total 100 でも false
- [ ] AC-4: 3回目: `count: 2` でちょうど90日前のとき、total 29 で false・30 で true。89日前なら total 100 でも false
- [ ] AC-5: `count: 3` なら、total 1000・`lastRequestedAt` が400日前でも false
- [ ] AC-6: `parseStoreReviewHistory`: `null` → `{ count: 0, lastRequestedAt: null }`。`'{"count":1,"lastRequestedAt":"2026-10-01T00:00:00.000Z"}'` → `{ count: 1, lastRequestedAt: '2026-10-01T00:00:00.000Z' }`。`'abc'`・`'{"count":"1","lastRequestedAt":"2026-10-01T00:00:00.000Z"}'`・`'{"count":4,"lastRequestedAt":"2026-10-01T00:00:00.000Z"}'`・`'{"count":-1,"lastRequestedAt":null}'`・`'{"count":1.5,"lastRequestedAt":"2026-10-01T00:00:00.000Z"}'`・`'{"count":1}'`・`'{"count":1,"lastRequestedAt":"x"}'` → どれも `{ count: 0, lastRequestedAt: null }`

### 機能基準 — ネイティブ・印・履歴・リンク（S2・Jest・`src/services/__tests__/storeReview.test.ts`）

- [ ] AC-7: `jest.setup.js` の既定のまま（`requireOptionalNativeModule('ExpoStoreReview')` が null）、`Platform.OS = 'ios'` で `requestStoreReview()` が **false で resolve** する（reject しない）。`jest.setup.js` に `requireOptionalNativeModule` の文字がある
- [ ] AC-8: `Platform.OS` が `'android'` のときと `'web'` のときそれぞれ、偽のモジュールを返すようにしても `requestStoreReview()` が false で、`requireOptionalNativeModule`・偽の `isAvailableAsync`・偽の `requestReview` のどれも呼ばれない
- [ ] AC-9: iOS・偽のモジュールの `isAvailableAsync` が false で resolve（TestFlight）→ `requestStoreReview()` が false・偽の `requestReview` は0回
- [ ] AC-10: iOS・偽のモジュール（使える）→ `requestStoreReview()` が true・偽の `requestReview` が1回・`requireOptionalNativeModule` の引数が `'ExpoStoreReview'`
- [ ] AC-11: iOS・偽の `requestReview` が `new Error('MissingCurrentWindowSceneException')` で reject → `requestStoreReview()` が false で resolve・`console.warn` が1回
- [ ] AC-12: 印: 何もしなければ `takeRecordCompleted()` は null。`noteRecordCompleted(3)` → `takeRecordCompleted()` が 3 → もう一度呼ぶと null。`noteRecordCompleted(3)` → `noteRecordCompleted(4)` → 4。`noteRecordCompleted(3)` → `clearRecordCompleted()` → null
- [ ] AC-13: 履歴: `AsyncStorage.getItem` が null → `readStoreReviewHistory()` が `{ count: 0, lastRequestedAt: null }` で、`getItem` の引数が `'store_review_history'`。`writeStoreReviewHistory({ count: 1, lastRequestedAt: '2026-10-05T03:00:00.000Z' })` → `AsyncStorage.setItem('store_review_history', '{"count":1,"lastRequestedAt":"2026-10-05T03:00:00.000Z"}')`。`getItem` が reject → `readStoreReviewHistory()` も reject
- [ ] AC-14: `openAppStoreWriteReview()` が `Linking.openURL` を `'https://apps.apple.com/app/id6797201465?action=write-review'` で1回呼ぶ。`Linking.openURL` が reject すると `openAppStoreWriteReview()` も reject する

### 機能基準 — 出す瞬間（S3・Jest・`src/hooks/__tests__/useStoreReviewRequest.test.ts`）

条件（特に書かない限り）: フォーカスあり・偽のモジュール（使える）・履歴なし（Map が空）・今は `2026-10-05T12:00:00+09:00`（fake timers）。

- [ ] AC-15: 印が無いまま描く → 10000ms 進めても `AsyncStorage.getItem` は `'store_review_history'` で呼ばれず、偽の `requestReview` は0回
- [ ] AC-16: `noteRecordCompleted(3)` のあと描く → 1499ms 進めた時点で偽の `requestReview` は0回。さらに 1ms 進めて Promise を流すと1回。そのあと `AsyncStorage.setItem('store_review_history', '{"count":1,"lastRequestedAt":"2026-10-05T03:00:01.500Z"}')` が1回で、`setItem` の `invocationCallOrder` が `requestReview` より後
- [ ] AC-17: `noteRecordCompleted(2)` → 5000ms で偽の `requestReview`・`setItem('store_review_history', …)` とも0回。続けてフォーカスを外して戻しても 5000ms で0回（印は消えている）
- [ ] AC-18: `noteRecordCompleted(3)` → 描いて 1000ms でフォーカスを外す → 5000ms まで偽の `requestReview` は0回。もう一度フォーカスを得て 5000ms 進めても0回（印は戻らない）
- [ ] AC-19: `noteRecordCompleted(3)` → 描いて 1000ms で `AppState` の `change` に `'background'` を渡す → 5000ms まで偽の `requestReview` は0回
- [ ] AC-20: `noteRecordCompleted(3)` → 描いて 1000ms で unmount → 5000ms まで偽の `requestReview` は0回
- [ ] AC-21: `noteRecordCompleted(3)` で、①モジュールが無い（既定）②偽の `isAvailableAsync` が false ③偽の `requestReview` が reject、のそれぞれ → 5000ms で `setItem('store_review_history', …)` は0回。③でも例外が外へ出ない
- [ ] AC-22: 履歴 `{"count":1,"lastRequestedAt":"2026-09-25T03:00:00.000Z"}`（10日前）・`noteRecordCompleted(12)` → 5000ms で偽の `requestReview`・`setItem('store_review_history', …)` とも0回
- [ ] AC-23: `AsyncStorage.getItem` が reject・`noteRecordCompleted(3)` → 5000ms で偽の `requestReview` は0回・例外が外へ出ない
- [ ] AC-24: AC-16 のあと、`noteRecordCompleted(4)` → フォーカスを外して戻す → 5000ms 進めても偽の `requestReview` は合計1回のまま
- [ ] AC-25: フォーカスが無いまま `noteRecordCompleted(3)` のあと描く → 5000ms で0回。フォーカスを得ると、その 1500ms 後に1回

### 機能基準 — 画面とつなぐ（S3・Jest）

- [ ] AC-26: `RecordCompleteScreen` を `{ totalStampCount: 3, stampCount: 1, prefecture: '宮城県', stampCountByPrefecture: { 宮城県: 3 } }` で描くと、`takeRecordCompleted()` が 3（`RecordCompleteScreen.test.tsx`）
- [ ] AC-27: `RecordCompleteScreen` を `{ countUnavailable: true, totalStampCount: 3 }` で描くと `takeRecordCompleted()` が null。params が undefined でも null（`RecordCompleteScreen.test.tsx`）
- [ ] AC-28: `noteRecordCompleted(3)` のあと `RecordScreen` を描くと、`takeRecordCompleted()` が null（`RecordScreen.test.tsx`）
- [ ] AC-29: `RecordCompleteScreen` を AC-26 の params で描き、`unmount()` したあとでも `takeRecordCompleted()` が 3（完了画面が閉じても印は消さない。取り出すのはメインのタブのフック＝D-6 ③。effect の後始末で印を消すと AC-30 の流れが壊れる）（`RecordCompleteScreen.test.tsx`）
- [ ] AC-30: `RootNavigator.test.tsx`（オンボーディング済み・偽のモジュール（使える）・履歴なし）: `map-screen` が出たあと `navigationRef.navigate('RecordComplete', { totalStampCount: 3, stampCount: 1, prefecture: '宮城県', stampCountByPrefecture: { 宮城県: 3 }, origin: 'map' })` → 完了画面が出てから 3000ms たっても偽の `requestReview` は0回 → `button-exit` を押す → `map-screen` が出て、そこから 1500ms 以内に偽の `requestReview` が1回（1500ms より前には0回）
- [ ] AC-31: `RootNavigator.test.tsx`（AC-30 と同じ条件）: `button-exit` で `map-screen` に戻ってから 1000ms で `navigationRef.navigate('AnnualReport', { year: 2026, sample: 'full' })` → 年報が出てから 5000ms たっても偽の `requestReview` は0回

### 機能基準 — 設定の行（S4・Jest・`src/screens/__tests__/SettingsScreen.test.tsx`）

- [ ] AC-32: iOS で、ゲストのときもログイン済みのときも、`settings-section-app-info` の中に `store-review-row` があり、その中に文字「App Store でレビューを書く」がある。`accessibilityRole` が `'link'`
- [ ] AC-33: `Platform.OS` が `'android'` のときと `'web'` のときそれぞれ、`store-review-row` と文字「App Store でレビューを書く」が無く、「バージョン」「利用規約」「プライバシーポリシー」はある
- [ ] AC-34: `store-review-row` を押すと、`Linking.openURL` が `'https://apps.apple.com/app/id6797201465?action=write-review'` で1回呼ばれる。偽のモジュール（使える）にしておいても、`requireOptionalNativeModule` と偽の `requestReview` は呼ばれない。`navigation.navigate` と `getParent().navigate` は呼ばれない
- [ ] AC-35: `Linking.openURL` が reject するとき、押すと `Alert.alert` が `'App Store を開けませんでした'` で1回呼ばれ、画面は残る（`store-review-row` がまだある）
- [ ] AC-36: 並び: `within(getByTestId('settings-section-app-info')).getAllByText(/^(バージョン|利用規約|プライバシーポリシー|App Store でレビューを書く)$/)` の文字が順に `['バージョン', '利用規約', 'プライバシーポリシー', 'App Store でレビューを書く']`

### UI基準

- [ ] UI-1: 行の見た目（Jest・設定タブ →「アプリ情報」・iOS）: `StyleSheet.flatten(store-review-row の style)` が `{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md }` を含む。「App Store でレビューを書く」の字の `StyleSheet.flatten` が `typography.body` の各値と `color: colors.gray[700]`・`flex: 1` を含み、「利用規約」の字の `StyleSheet.flatten` と等しい。行の中の `MaterialIcons`（モックでは `name` を文字で出す）が `chevron-right` で、`size` が 24、`color` が `colors.gray[400]`
- [ ] UI-2: **Expo Web**（`npx expo start --web --port 8081`・ゲスト）: 設定タブ →「アプリ情報」の行が「バージョン」「利用規約」「プライバシーポリシー」の3つだけで、「App Store でレビューを書く」が無い。設定タブを開いてもブラウザのコンソールに `ExpoStoreReview`・`Cannot find native module` を含むエラーが出ない。スクリーンショットを `.claude/harness/evidence/issue-288/` に置く
- [ ] UI-3: **native-only（シミュレータ・`expo-store-review` が入る前の .app ＋新しい JS）**: 下の「シミュレータでの確認」の ①の状態で、ログイン済みのアカウント（3枚以上）で1枚記録 → 完了画面 →「地図に戻る」→ 地図が出てから10秒の間に、依頼が出ず、赤い画面（エラー）・LogBox の `Cannot find native module` が出ず、アプリが落ちない。設定タブに「App Store でレビューを書く」がある。録画を証跡に置く
- [ ] UI-4: **native-only（シミュレータ）**: 設定タブ →「アプリ情報」のいちばん下に「App Store でレビューを書く」＞（字と矢印が上の「プライバシーポリシー」と同じ形）。押すと SpringBoard のログに `Handling OpenURL` で `https://apps.apple.com/app/id6797201465?action=write-review` が渡り、アプリは落ちない。スクリーンショットを置く。**App Store の「レビューを書く」が開くことは H-1 ②（実機）で見る**（実装で分かったこと: `apps.apple.com` は 301 で `itms-appss://` に送るので、App Store アプリの無いシミュレータの Safari では「アドレスが無効」になる。新しい .app でも同じ）
- [ ] UI-5: **native-only（シミュレータ・新しい .app・履歴なし）**: 1枚記録 → 完了画面 →「もう1枚記録する」→ 記録画面の ✕ → 地図が出てから5秒の間に依頼が出ない（D-6 ②）
- [ ] UI-6: **native-only（シミュレータ・新しい .app・UI-5 の続き）**: 1枚記録 → **完了画面を3秒以上見ている間は依頼が出ない** →「地図に戻る」→ **地図が出てから約1.5秒後（1〜3秒の間）にシステムの依頼が出る**。閉じる（送信しない）。録画を置き、地図が出てから依頼が出るまでの秒数を progress.md に書く。**実装で分かったこと（2026-09-27、新しい .app・Debug のシミュレータ）**: アプリが依頼を呼んだのは戻り始めから 1.52 秒後（地図が見えてから約 0.9 秒）。呼んでから依頼が画面に出るまでに、システム側で約 2.3 秒かかり、地図が見えてから出始めるまでは約 3.2 秒だった。1〜3 秒はアプリが呼ぶまでの時間として読み、合格とした
- [ ] UI-7: **native-only（シミュレータ・新しい .app・UI-6 の続き）**: もう1枚記録 →「地図に戻る」→ 地図が出てから5秒の間に依頼が出ない（履歴 count 1・90日たっていない）

### E2E

- なし。記録にはログインと写真が要り、システムの依頼はアプリの外の画面なので、Maestro のフロー（`e2e/flows/`・まだ下書き）では安定して辿れない。UI-3〜7 はシミュレータで手で確かめ、録画を残す

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: `package.json` の差分が `expo-store-review` の1行だけ: `git diff origin/develop...HEAD -- package.json | grep -E '^[+-][^+-]'` の出力が `+    "expo-store-review": "~9.0.9",` の1行（`scripts` などに差分が無い）。`package-lock.json` に `node_modules/expo-store-review` がある
- [ ] Q-5: JS から `expo-store-review` を読まない: `grep -rnE "from ['\"]expo-store-review['\"]|require\(['\"]expo-store-review['\"]\)" src` が0件
- [ ] Q-6: 依頼を呼ぶ所が1か所: `grep -rln "requestReview" src --include='*.ts' --include='*.tsx' | grep -v __tests__` が `src/services/storeReview.ts` の1件だけ。`grep -rln "requestStoreReview" src --include='*.ts' --include='*.tsx' | grep -v __tests__` が `src/services/storeReview.ts`・`src/hooks/useStoreReviewRequest.ts` の2件だけ（`SettingsScreen.tsx`・`RecordCompleteScreen.tsx` に無い）
- [ ] Q-7: アプリ ID を書くのは定数のファイルだけ: `grep -rn "6797201465" src | grep -v __tests__` が `src/constants/storeReview.ts` の中だけ
- [ ] Q-8: expo のモックは `jest.setup.js` だけ: `grep -rnE "jest\.mock\(['\"](expo|expo-modules-core|expo-store-review)['\"]" src` が0件
- [ ] Q-9: グローバルの状態管理を入れていない: `grep -rnE "createContext|zustand|redux" src/services/storeReview.ts src/hooks/useStoreReviewRequest.ts src/utils/storeReview.ts` が0件（ライブラリを足していないことは Q-4）
- [ ] Q-10: 色の直値が無い: `grep -nE "['\"]#[0-9A-Fa-f]{3,8}['\"]" src/screens/SettingsScreen.tsx` が0件
- [ ] Q-11: 変えないファイル: `git diff --name-only origin/develop...HEAD -- app.json eas.json metro.config.js src/navigation/types.ts src/hooks/useAnnualReportAutoPlay.ts src/theme` が空
- [ ] Q-12: 変えたファイルが次の中だけ: `git diff --name-only origin/develop...HEAD` が `package.json`・`package-lock.json`・`jest.setup.js`・`src/constants/storeReview.ts`・`src/utils/storeReview.ts`・`src/services/storeReview.ts`・`src/hooks/useStoreReviewRequest.ts`・`src/navigation/TabNavigator.tsx`・`src/screens/RecordCompleteScreen.tsx`・`src/screens/RecordScreen.tsx`・`src/screens/SettingsScreen.tsx`・`src/utils/__tests__/storeReview.test.ts`・`src/services/__tests__/storeReview.test.ts`・`src/hooks/__tests__/useStoreReviewRequest.test.ts`・`src/screens/__tests__/RecordCompleteScreen.test.tsx`・`src/screens/__tests__/RecordScreen.test.tsx`・`src/screens/__tests__/SettingsScreen.test.tsx`・`src/navigation/__tests__/RootNavigator.test.tsx`・`docs/issues/issue-288-review-request.md`・`docs/design/ui-design.md`・`.claude/harness/` の下 に含まれる
- [ ] Q-13: ネイティブのフォルダをコミットしていない: `git ls-files ios android` が0件（S5 の prebuild で作った `ios/` は `.gitignore` 済み）

## スライス（1スライス = 1コミット・TDD）

| #   | 中身                                                                                                                                                                                                                                                                                                 | 主な基準                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| S1  | 判定: `src/constants/storeReview.ts`・`src/utils/storeReview.ts`（`parseStoreReviewHistory`・`decideStoreReview`）と単体テスト                                                                                                                                                                       | AC-1〜6                      |
| S2  | ネイティブの入口: `npx expo install expo-store-review`・`jest.setup.js` の部分モック・`src/services/storeReview.ts`（`requestStoreReview`・印・履歴・`openAppStoreWriteReview`）と単体テスト                                                                                                         | AC-7〜14・Q-4・Q-5・Q-7・Q-8 |
| S3  | 出す瞬間: `src/hooks/useStoreReviewRequest.ts`・`TabNavigator` で呼ぶ・`RecordCompleteScreen` のマウントで `noteRecordCompleted`・`RecordScreen` のマウントで `clearRecordCompleted` / フックの単体テスト・`RecordCompleteScreen.test.tsx`・`RecordScreen.test.tsx`・`RootNavigator.test.tsx` に足す | AC-15〜31・Q-6・Q-9          |
| S4  | 設定の行: `SettingsScreen` に「App Store でレビューを書く」（iOS だけ・アプリ情報の最後）/ `SettingsScreen.test.tsx` に足す / `docs/design/ui-design.md` の 4.6・4.9                                                                                                                                 | AC-32〜36・UI-1・Q-10        |
| S5  | 確かめる: Expo Web（UI-2）・シミュレータ（UI-3〜7。下の手順）。コードの変更が出たら fix のコミット。`progress.md`・`feature-list.json`（ISSUE-288）に記録・証跡を `.claude/harness/evidence/issue-288/`                                                                                              | UI-2〜7・Q-11〜13            |

## 手順

### Expo Web での確かめ方（goshuin-evaluator・UI-2）

1. `npx expo start --web --port 8081`（ログインしない）
2. 設定タブ →「アプリ情報」の3行を見る・ブラウザのコンソールを見る
3. スクリーンショットを `.claude/harness/evidence/issue-288/` へ

### シミュレータでの確認（S5・native-only・実装する人が行う。EAS のビルドは使わない）

前提: Mac の空きディスクが 15GB 以上（`df -h /`。#270 のときに満杯でビルドが落ちた）。シミュレータは goshuin-repro（UDID は `xcrun simctl list devices | grep goshuin-repro`）。ログイン済みのアカウント（3枚以上）がシミュレータのアプリに残っていること。

**① ネイティブが無いときに落ちない（UI-3）— ビルドし直さない**

1. 今シミュレータに入っている .app（`expo-store-review` が入る前に作ったもの＝オーナーの iPhone の開発用アプリと同じ条件）をそのまま使う。入れ替えていないことを `xcrun simctl get_app_container <UDID> com.goshuin.app` の日付などで記録する
2. この worktree で Metro を起動する（`npx expo start --dev-client --port 8083`。hamlet の Metro と重ならない番号。Supabase の鍵は worktree の `.env` から読む。無ければ hamlet から写し、コミットしない）。シミュレータのアプリから `http://localhost:8083` を開く（`xcrun simctl openurl <UDID> 'com.goshuin.app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8083'`）
3. 写真は `xcrun simctl addmedia <UDID> <画像>` で入れておき、ライブラリから選んで1枚記録する → UI-3
4. 読み込めなかった（開発用アプリが「ネイティブが違う」などで拒んだ）ら、その文言を progress.md に書く（`runtimeVersion` は fingerprint。H-1 で同じことが起きるかの手がかりになる）

**② 新しい .app を作る（UI-4〜7）**

1. `npx expo prebuild --platform ios --no-install`（`ios/` は `.gitignore` 済み）。終わったら `git status` を見て、`package.json`（`scripts` の `ios` / `android`）・`app.json` が書き換わっていたら `git checkout -- package.json app.json` で戻す（Q-4・Q-11）
2. `cd ios && PATH="$(RBENV_VERSION=3.2.2 rbenv prefix)/bin:$PATH" pod install`（CocoaPods は rbenv 3.2.2 に入っている）。`Podfile.lock` に `ExpoStoreReview` があることを確かめる
3. `xcodebuild -workspace app.xcworkspace -scheme app -configuration Debug -sdk iphonesimulator -destination 'id=<UDID>' -derivedDataPath build/dd build`（`npx expo run:ios` は Xcode 26 の devicectl の出力を読めずに止まるので使わない）
4. `xcrun simctl install <UDID> ios/build/dd/Build/Products/Debug-iphonesimulator/app.app`（上書きで入れるので、ログインと AsyncStorage は残る。`store_review_history` はまだ無い＝履歴なし）
5. ① と同じ Metro につなぐ
6. **UI-4 → UI-5 → UI-6 → UI-7 の順に行う**（UI-6 で履歴が count 1 になる。UI-5 は履歴を変えない）。画面は `xcrun simctl io <UDID> recordVideo` で録る
7. 終わったら、記録した御朱印（UI-3・5・6・7 で足した分）を御朱印帳 → 詳細 → 削除で消す。システムの依頼が出ても送信しない（開発中のビルドでは送信できない形で出る）
8. `git status` で `ios/`・`package.json`・`app.json` に差分が無いことを確かめる（Q-4・Q-11・Q-13）

**もし UI-6 で依頼が出なかったら**: Apple の資料では開発中のビルドでは毎回出るが、シミュレータの iOS の版で出ないことがありうる。そのときは `requestStoreReview()` が true を返したか（`console.warn` が出ていないか・履歴が count 1 になったか）を Metro のログで確かめて progress.md に書き、依頼が出ること自体は H-3 に回す（その場合は UI-6 を「依頼の呼び出しまで確認・表示は未確認」と記録する）。

### オーナーの手順（H）

| #   | いつ                                                 | やること                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ビルド                                        |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| H-1 | 人間ゲート（push の前）                              | iPhone の開発用アプリ（今のまま）で `/dev` の Metro につなぐ。① 起動して赤い画面が出ない（開発用アプリが読み込みを拒んだら、その文言を伝える）② 設定 →「アプリ情報」のいちばん下の「App Store でレビューを書く」を押すと、**App Store アプリで御朱印さんぽの「レビューを書く」画面が開く**。書かずに閉じる ③（任意・UI-3 で確かめ済みなら省いてよい）1枚記録して「地図に戻る」→ 依頼は出ず、落ちない（この開発用アプリにはネイティブが無いので何もしない）。記録は消す | 要らない                                      |
| H-2 | 1.2.0 の production ビルドを TestFlight に出したあと | 1枚記録して「地図に戻る」→ **依頼は出ない（TestFlight では Apple が出さない）**・落ちない。設定の行で App Store が開く。記録は消す                                                                                                                                                                                                                                                                                                                                     | 1.2.0 のビルド（この Issue のために足さない） |
| H-3 | App Store で 1.2.0 を公開したあと（任意・観察だけ）  | 自分のアカウントは3枚以上あるので、1.2.0 で最初に保存して戻った約1.5秒後に依頼の対象になる（出すかはシステムが決める）。出たかどうかを progress.md に残す。**出ても自分のアプリには評価を付けず「今はしない」で閉じる**（開発者が自分のアプリを評価しない）                                                                                                                                                                                                            | 要らない                                      |

## やらないこと（スコープ外）

- 独自の★の画面・満足度のアンケート・「気に入りましたか？」で振り分ける画面（App Review Guidelines 5.6.1）
- Android（Google Play の In-App Review）。Android では依頼も設定の行も出さない
- 評価の件数・依頼を出した回数の計測（送る仕組みも作らない）
- 依頼を出す条件をサーバーで変えられるようにすること・A/B テスト
- アプリの版が上がったら数え直すこと（履歴は版をまたいで1つ）
- 開発用の「依頼の履歴を消す」行（シミュレータの確認は UI-5 → UI-7 の順で足りる）
- `app.json` の `ios.appStoreUrl`・`expo-store-review` の JS の関数（`requestReview`・`storeUrl`・`hasAction`）を使うこと
- 年報の自動再生（`useAnnualReportAutoPlay`）を変えること
- 完了画面の見た目・文言の変更
- EAS のビルドを作ること（1.2.0 の production ビルドに乗る）

## リスク・不確実な点／申し送り

- **既存の利用者への1回目**（D-3 ⓐ）: 3枚以上ある人は、1.2.0 で最初の保存の後に依頼の対象になる。評価を集める目的には合うが、「3件目の記録の後」という言葉とは違って見える。オーナーが「1.2.0 以降に新しく3枚になった人だけ」にしたいなら、D-3 を「1.2.0 で初めて開いたときの枚数を覚え、そこから数える」に変える必要がある（この契約では採らない）。**2026-09-27 にオーナーが「対象にする（はい）」と決めた**（下の「オーナーの判断」）
- **12月の年報の自動再生と重なる**: 12月に、その年で初めて記録して戻ると、年報の自動再生（#274）の判定もメインのタブへのフォーカスで走る。年報が 1500ms より前に開けば依頼は取りやめ（AC-31）。判定の問い合わせが 1500ms より遅いと、依頼が先に出てから年報が開きうる（12月・その年で最初・3枚目などが重なるときだけ）。起きたら、年報の判定が終わるまで待つ形を別の Issue にする
- **メインのタブの中のモーダル**（地図のログインを促すモーダル・予定のプラスのシートなど RN の `Modal`）はフォーカスを変えないので、戻って 1.5秒の間にそれを開くと上に依頼が出うる（グローバルの状態を持たない決まりのまま、見分ける手段が無い）。1.5秒の間に開く操作はまれなので受け入れる
- **シミュレータで依頼が表示されるかは未確認**（Apple の資料は「開発中は毎回出る」）。出なければ S5 の手順のとおり記録して H-3 に回す
- **オーナーの開発用アプリが新しい JS を読むか**: `runtimeVersion` は fingerprint で、ネイティブの依存を足すと fingerprint が変わる。Metro から読む開発用アプリは通常そのまま読むが、未確認（①-4・H-1 で見る）。読めなければ、オーナーの iPhone での確認は 1.2.0 の TestFlight（H-2）まで待つ
- **`jest.setup.js` の `expo` の部分モック（D-2）は、使い捨てのテスト1本でしか試していない**。全部のテストで `jest.requireActual('expo')` が読まれるので、S2 のあと `npm test` が広く落ちたら、まずここを疑う（その場合は `requireActual` をやめ、`requireOptionalNativeModule` だけを返すモックにできるか＝`src` で `expo` から読むのが `src/services/storeReview.ts` だけであることを確かめる）
- **システムが依頼を出したかは分からない**: `requestReview` は結果を返さない。履歴の count は「呼べた回数」で、実際に表示された回数ではない（Apple の上限でシステムが出さなかった回も数える）
- **アプリを消して入れ直すと履歴が消える**（D-5）。そのあとの保存で、また1回目から数える（Apple の365日で3回の上限は効く）
- **1.2.0 の fingerprint が変わる**: `expo-store-review` を足すので、1.2.0 のビルドの runtime version は今の開発用アプリと別になる。EAS Update で既存のビルドへ JS だけを配ることはできない（1.2.0 は新しいビルドで出すので問題ない）
