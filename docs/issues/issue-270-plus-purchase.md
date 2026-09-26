# Issue #270: プラスの課金導線（RevenueCat・980円の買い切り）

## 概要

課金をオンにする時期（記録のあるユーザー50人 か 月に使う人30人）に、**スイッチ `BILLING_ENABLED` を true にするだけで「御朱印さんぽ プラス」を売れる**ように、購入の導線を先に作っておく。**このブランチでは `BILLING_ENABLED = false` のまま出す**（利用者から見た変化は無い）。

- 課金の仕組みは **RevenueCat**（`react-native-purchases` 10.x）。商品は非消耗型（買い切り）1つ、entitlement `plus`
- 購入の状態は hook **`usePlus()`** で持つ（グローバル状態は入れない）。定数 `IS_PLUS` はこの hook に置き換える
- 無料は **「これからの予定」1件**。`planned_on >= 今日` の予定だけ数え、過ぎた予定は数えない（#258 D-14 のリスク「全件か今日以降か」はこれで決着）
- 入口は2つだけ: **① 予定の2件目**（B のシート）/ **② 設定の「御朱印さんぽ プラス」カード**（D）→ プラスの画面（E）。起動時・オンボーディング・地図には出さない
- 購入後は F（トースト「プラスになりました。ありがとうございます」・設定のカード「購入済み」・E のボタン「購入済み」）
- 開発中の確認は **RevenueCat の Test Store のキー + `npx expo run:ios`（ローカルのシミュレータ用ビルド）**。App Store の sandbox での確認はオーナーの手順（有料 App 契約・課金アイテムの登録）の後

## 関連ドキュメント

- **承認デザイン（正）**: [`docs/design/mockups/2026-09-plus-paywall-v3.html`](../design/mockups/2026-09-plus-paywall-v3.html) / `-v3.png`（B・C・D・E・F。G は将来の参考の絵で作らない）。v1・v2 は不採用
- **収益化の設計（正）**: [`docs/product/2026-09-monetization-design.md`](../product/2026-09-monetization-design.md) §3 原則（押し売りしない・有料の案内は使おうとした場所で一度だけ）・§7 実装の形・§8 決定（980円の買い切り）
- 分かれ目の元: [`issue-258-visit-plan.md`](./issue-258-visit-plan.md) D-14（`canAddPlan`・`BILLING_ENABLED`・仮の Alert）・D-19（ナビゲーション）
- RevenueCat Test Store: https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store （全プロジェクトに自動で付く。Test 用のキーで初期化すると App Store Connect の設定なしで購入・entitlement・CustomerInfo の更新まで試せる。**Test Store のキーを本番のビルドに入れて提出してはいけない**）
- RevenueCat MCP: `https://mcp.revenuecat.ai/mcp`（商品・entitlement・offering を AI から作れる）
- 確認済み: `docs/product/direction.md`（収益化は monetization-design.md が正）・`docs/product/requirements.md` と矛盾なし。`docs/design/ui-design.md` は変えない（BILLING_ENABLED=false の間は画面に出ないため）

## 設計上の決定（要件に無い点）

| #    | 決めたこと                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-1  | **RevenueCat の設定値**: entitlement `plus`（`src/constants/plus.ts` に `PLUS_ENTITLEMENT = 'plus'`）。売るのは `offerings.current.availablePackages[0]`（current の最初の package。package の種類は `$rc_lifetime`）。App Store の商品 ID は `com.goshuin.app.plus`（非消耗型・980円）。appUserID は Supabase の `user.id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D-2  | **公開 SDK キー**は `EXPO_PUBLIC_REVENUECAT_IOS_KEY`（秘密ではない公開キー。`appl_` で始まる）。`EXPO_PUBLIC_*` はビルド時にインライン化されるので、**Test Store のキー（`test_` で始まる）は `.env.local` など git に入れない所だけで使う**（`.gitignore` に `.env.local` あり）。純関数 `resolveRevenueCatKey(key: string \| undefined, isDev: boolean, platform: string): string \| null` を `src/utils/plus.ts` に置き、次のどれかなら `null`（= 初期化しない）: ① key が無い・空白だけ ② `platform !== 'ios'`（Android・Web は対象外）③ `!isDev && key.startsWith('test_')`（本番ビルドに Test Store のキーが紛れても SDK を動かさない）。呼び出し側は `resolveRevenueCatKey(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, __DEV__, Platform.OS)`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-3  | **`BILLING_ENABLED = false` の間は SDK を一切呼ばない**（`Purchases.configure` も呼ばない。ネットワークもキーも要らない）。`usePlus()` は `{ isPlus: false, status: 'unavailable', ... }` を返すだけ。①のシートも設定のカードも出ない（買えても何も増えないため）。テストは `@/constants/plus` の `BILLING_ENABLED` を getter で true にモックして確かめる（#258 の `PlanCalendarScreen.test.tsx` と同じ書き方）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-4  | **初期化と利用者の切り替えは service に1か所**（`src/services/purchases.ts`。supabase クライアントと同じくモジュールの中に1つだけ持つ）。`syncPurchasesUser(userId: string \| null): Promise<boolean>`: キー（D-2）が null なら何もせず false。まだ初期化していなくて userId があれば `Purchases.configure({ apiKey, appUserID: userId })`。初期化済みで前回と違う userId なら `Purchases.logIn(userId)`、null になったら `Purchases.logOut()`。**前回と同じ userId なら何も呼ばない**（`usePlus` は設定・予定・プラスの画面で同時にマウントされる）。**実行中の呼び出しの Promise をモジュールで持ち、同時に来た呼び出しは同じ Promise を待ってから判断する**（設定 → プラスの画面のように2つの `usePlus` が同時に初回を迎えても `configure` は1回）。ゲスト（userId が null）のまま一度も初期化しない＝ゲストは SDK を使わない                                                                                                                                                                                                                                                                                                                                         |
| D-5  | **`usePlus()`**（`src/hooks/usePlus.ts`）の形: `{ isPlus: boolean; status: 'loading' \| 'ready' \| 'unavailable'; priceString: string \| null; canRestore: boolean; busy: boolean; purchase(): Promise<'purchased' \| 'cancelled' \| 'failed'>; restore(): Promise<'restored' \| 'none' \| 'failed'> }`。`useAuth()` の `user?.id` で D-4 を呼び（**`useAuth()` の `isLoading` の間は呼ばない**。useAuth は画面ごとに user=null から始まるので、待たないと画面を開くたびに logOut → logIn になり匿名の利用者ができる。S6 で見つけて直した）、初期化できたら `Purchases.getCustomerInfo()` と `Purchases.getOfferings()` を取る。`isPlus` は純関数 `hasPlus(customerInfo) = customerInfo.entitlements.active[PLUS_ENTITLEMENT] !== undefined`。`Purchases.addCustomerInfoUpdateListener` で更新し、アンマウントで `removeCustomerInfoUpdateListener`。`status`: 取得中は `'loading'`、package と `priceString` が取れたら `'ready'`、キーが無い・ゲスト・BILLING オフ・offerings の取得失敗・current が無い・package が0個のときは `'unavailable'`。`canRestore` は SDK を初期化できたとき true（offerings が取れなくても復元はできる）。`busy` は購入・復元の実行中 true |
| D-6  | **値段は `package.product.priceString` をそのまま出す**（ハードコードしない。「980円」の文字列をコードに書かない）。無料のカードの「0円」は固定の文字でよい                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D-7  | **無料の数え方**: 純関数 `countUpcomingPlans(plans: { plannedOn: string }[], todayKey: string): number` = `plannedOn >= todayKey` の件数（今日の予定は数える・過ぎた予定は数えない）。`canAddPlan(upcomingCount: number, isPlus: boolean, billingEnabled: boolean)` の第1引数を「これからの予定の数」にする（式は同じ `!billingEnabled \|\| isPlus \|\| upcomingCount < FREE_PLAN_LIMIT`）。`PlanCalendarScreen` の `guardAdd` は `canAddPlan(countUpcomingPlans(plans, todayKey), isPlus, BILLING_ENABLED)`。**すでに入っている予定を開く・直す・消すのは判定しない**（今と同じ）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D-8  | **① の出し方**: `guardAdd` が false のとき、#258 の仮の Alert の代わりにシート **`PlusSheet`**（`src/components/plus/PlusSheet.tsx`・既存 `Modal` の `variant="bottom"`）を開く。押そうとした日は、空いた日を押したらその日、「＋ 予定を組む」なら今日（`todayKey`）。**自動では出さない**＝ユーザーが「＋ 予定を組む」か空いた日を押したときだけ出る。「あとで」・右上の ✕・背景を押すと閉じて元のカレンダーに戻るだけ（予定を組む画面へは進まない・次に同じ操作をしたらまた出る）。起動時・オンボーディング・地図・予定を組む画面の中には出さない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-9  | **B のシートからの利用規約・プライバシーポリシー**: `Modal` は RN の Modal なので、開いたまま navigate すると画面がシートの下に出る。**シートを閉じてから** `navigation.navigate('TermsOfService')` / `navigate('PrivacyPolicy')`（既存の画面）。同じ tick で「閉じる」と navigate を続けると iOS では Modal がまだ出ている間に push が走り、画面が裏に出る・遷移が遅れることがあるので、**navigate は閉じたのを反映したあと（`Modal` に `onDismiss` を通すか、閉じる state の変化を受けた effect）で行う**。D-11 の「買えたら予定を組む画面へ」も同じ。戻ってきてもシートは自動で開き直さない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D-10 | **購入の結果**（B と E で同じ。処理は `PlusPurchasePanel` に1つ）: 購入は `Purchases.purchasePackage(pkg)`。reject の `userCancelled === true` は**何も出さない**（`'cancelled'`）。それ以外の reject、または resolve したのに `hasPlus` が false なら Alert「購入できませんでした」（ボタン「OK」のみ）。復元は `Purchases.restorePurchases()`: `hasPlus` が true → Alert「購入を復元しました」、false → Alert「復元できる購入が見つかりませんでした」、reject → Alert「購入を復元できませんでした」（最後の1つは試作・オーナー決定に無い。失敗と「見つからない」を混ぜないために足した）。実行中（`busy`）は購入・復元の両方の文字ボタンを押せない（二重押しの防止）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D-11 | **B で買えたあと**: シートを閉じて `navigation.navigate('PlanEditor', { date: 押そうとした日, purchased: true })`。`PlanEditor` は `purchased` があればトースト `PlusThanksToast`（「プラスになりました。ありがとうございます」・3.2秒）を出して `setParams({ purchased: undefined })`（`PlanCalendar` の `savedOn` と同じ作り）。**B で復元できたとき**は Alert「購入を復元しました」を出し、シートを閉じて `navigate('PlanEditor', { date })`（トーストは出さない。Alert と重ねない）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-12 | **ナビゲーション**: Settings はスタックを持たないタブ画面なので（`types.ts` のコメント）、プラスの画面は **RootStack に `Plus: undefined`** で足す（`TermsOfService` と同じ置き方・`headerShown: false`）。`MainTabParamList` の `Settings` を `{ purchased?: boolean } \| undefined` にする。`PlanStackParamList` の `PlanEditor` に `purchased?: boolean` を足す。**E で買えたら** `navigation.popTo('MainTabs', { screen: 'Settings', params: { purchased: true } })` で設定へ戻り（React Navigation v7 の `navigate` は既存の画面へ戻らず積むため `popTo`。progress.md 2026-09-26）、設定がトーストを出して `setParams({ purchased: undefined })`。E で復元できたら Alert「購入を復元しました」を出して E に留まる（ボタンが「購入済み」に変わる）                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D-13 | **設定のカード `PlusSettingsCard`**（D）: アカウントのセクションのすぐ下に新しいセクション「プラス」（`testID="settings-section-plus"`）。`BILLING_ENABLED = false` の間はセクションごと出さない。カード（`testID="plus-settings-card"`）: 左にアイコン（MaterialIcons `auto-awesome`・`colors.primary[500]`・白い角丸の地）、太字「御朱印さんぽ プラス」、その下「予定をいくつでも入れられます」、右に値段（`priceString`・`colors.primary[700]`）と `chevron-right`（`colors.gray[400]`）。地は `colors.primary[50]`・枠 `colors.primary[100]`。押すと `navigation.getParent()?.navigate('Plus')`。**購入済み**: 右が「購入済み」（`colors.pin.wishlisted`＝試作の teal `#0D9488`。新しいトークンは足さない）、地は `colors.white`・枠 `colors.gray[200]`、押すと E。**値段が取れていない**（loading / unavailable）: 右の値段を出さない（chevron だけ）。**ゲスト**: 下の行を「ログインすると購入できます」にし、値段を出さず、押すと `Login`（買えない）                                                                                                                                                                                                             |
| D-14 | **カード2枚 `PlusPlanCards`**（B と E で同じ部品）: 左「無料」`0円`・行「記録・地図」「御朱印帳・あゆみ」「予定 1件」（3行目は太字）。右「プラス」（枠 2px `colors.primary[500]`・地 `colors.primary[50]`・左上に札「おすすめ」（地 `colors.primary[500]`・白字））・値段 `priceString`＋小さく「1回だけ」（`priceString` が null なら値段の所は「—」）・行「記録・地図」「御朱印帳・あゆみ」「予定 いくつでも」（3行目は太字、「いくつでも」は `colors.primary[700]`）。行の頭は MaterialIcons `check`（無料は `colors.pin.wishlisted`、プラスは `colors.primary[500]`）。G の「着せ替え」「記録の書き出し」の行は作らない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D-15 | **購入のボタンまわり `PlusPurchasePanel`**（B と E で同じ部品）: ボタン（`testID="plus-buy"`・地 `colors.primary[500]`・白字）の文言は `status` で決める — `'ready'`: 「{priceString}でプラスにする」/ `'loading'`: 「読み込み中…」（押せない）/ `'unavailable'`: 「プラスにする」（押せない）＋ボタンの下に「いまは購入できません」（`testID="plus-unavailable"`）。`isPlus` のとき: ボタンは「購入済み」（押せない）で、「1回だけの支払い・毎月はかかりません」と「購入を復元」は出さない。それ以外のとき、ボタンの下に「**1回だけの支払い**・毎月はかかりません」（前半が太字）。その下に文字ボタン「購入を復元」（`testID="plus-restore"`・`canRestore` が false なら押せない）と、B のときだけ「あとで」（`testID="plus-later"`）。一番下に「利用規約」・「プライバシーポリシー」の文字リンク（`testID="plus-terms"` / `"plus-privacy"`）                                                                                                                                                                                                                                                                                                                           |
| D-16 | **B の中身**（`PlusSheet`）: 右上に ✕（MaterialIcons `close`・`colors.gray[400]`・`accessibilityLabel="閉じる"`）、見出し「予定をいくつでも入れるならプラス」。その下に2つ並べる: 左（入っている予定）= `nextPlan`（`plannedOn >= 今日` の最初の1件）の「{M月D日（曜）}」と名前（名前は `colors.primary[700]`）/ 右（押そうとした日）= 「{M月D日（曜）}」と「＋ ここにも入れる」（MaterialIcons `add`・破線の枠 `colors.primary[500]`・地 `colors.primary[50]`）。日付の文字は既存 `formatPlanDate`。その下に `PlusPlanCards`・`PlusPurchasePanel`（「あとで」あり）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-17 | **E の中身**（`src/screens/PlusScreen.tsx`）: 上のバー（左 `chevron-left` で戻る・中央「御朱印さんぽ プラス」）。本文: 小さく `auto-awesome`＋「御朱印さんぽ プラス」（`colors.primary[700]`）、見出し「予定を、先までいくつでも」、飾りのミニカレンダー `PlusMiniCalendar`（下記）、`PlusPlanCards`、`PlusPurchasePanel`（「あとで」なし）。**将来の約束（「今後の機能も追加の支払いなしで」など）は書かない**。ゲストが開いた場合（通常は D-13 で来ない）は `status = 'unavailable'` の表示になる                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-18 | **飾りのミニカレンダー `PlusMiniCalendar`**: 押せない・読み上げない（`accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`）。**来月**（今日の月 + 1）の格子を既存 `buildMonthGrid` で作り、その月の日を含む週だけ（5週か6週）を出す。見出し左「{YYYY}年{M}月」・右に札「プラス」。その月の**土曜日すべて**に「●{N}社」（N は土曜の順に 4, 3, 5, 2, 3, 4 の繰り返し）。見た目は `PlanCalendar` の予定のある日と同じ（地 `colors.primary[50]`・印 `colors.primary[500]`）。`PlanCalendar` を再利用せず小さな専用の部品にする（`PlanCalendar` は押す・スワイプの作りを持つため）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D-19 | **トースト `PlusThanksToast`**（F）: 地 `colors.gray[900]`・白字「プラスになりました。ありがとうございます」・左に `auto-awesome`（`colors.primary[300]`）。3.2秒で消える（`PlanCalendarScreen` の `SAVED_TOAST_MS` と同じ長さ。消すタイマーは params と切り離す＝#258 の直した不具合と同じ形にしない）。出すのは設定（E で買えたあと）と予定を組む画面（B で買えたあと）だけ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D-20 | **動き**: シートが上がるのは既存 `Modal` の `animationType="slide"` のまま（新しい動きを足さない）。プラスのカードは試作の `lift .5s .35s` のとおり、**遅延 350ms・500ms** で `translateY: 6 → 0`・`opacity: 0.6 → 1`（`Animated.timing`・`useNativeDriver: false`＝Jest で値が見える形にする。#213 の教訓）。`useReduceMotion()` が true なら動かさず、最初から `translateY: 0`・`opacity: 1`。E でも同じ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D-21 | **Web の扱い**: `react-native-purchases` 10.x は Web では Web Billing 用の別のキー（`rcb_`）が前提で、iOS のキーでは動かない。**`metro.config.js` の `WEB_STUBS` に `'react-native-purchases': 'src/utils/purchases.web.ts'` を足す**（`@maplibre/maplibre-react-native` と同じ）。スタブは `default` に D-4・D-5 で使う関数を持ち、呼ばれたらどれも `Promise.reject(new Error('react-native-purchases is not available on web'))`（`configure` は何もしない）。実際には D-2 の②で Web は初期化しないので呼ばれない。Web の表示は `'unavailable'`（「いまは購入できません」）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D-22 | **Jest のモック**: `react-native-purchases` は `jest.setup.js` に集約する（`default` に `configure` / `logIn` / `logOut` / `getCustomerInfo` / `getOfferings` / `purchasePackage` / `restorePurchases` / `addCustomerInfoUpdateListener` / `removeCustomerInfoUpdateListener` の `jest.fn()`。既定の戻り値は「plus なし・offerings の current に `priceString: '¥980'` の package が1つ」）。各テストは `jest.mocked(Purchases.xxx).mockResolvedValueOnce(...)` で上書きする。テストの値段は `'¥980'` のように**アプリの文言と違う形**にして、コードに「980円」を書いていないことが分かるようにする                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-23 | **`usePlus` を使う場所を限る**: `usePlus` / `PlusSheet` / `PlusPurchasePanel` を import してよいのは `src/screens/PlanCalendarScreen.tsx`・`src/screens/SettingsScreen.tsx`・`src/screens/PlusScreen.tsx`・`src/components/plus/` の中だけ（地図・オンボーディング・起動時の `App.tsx` / `RootNavigator.tsx` には入れない。`RootNavigator.tsx` は `PlusScreen` の登録だけ）。`PlusThanksToast` は `SettingsScreen` と `PlanEditorScreen` だけ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## 詳細設計

### 純関数・定数（S1）

| ファイル                | 中身                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/constants/plus.ts` | `BILLING_ENABLED = false`（変えない）/ `FREE_PLAN_LIMIT = 1` / `PLUS_ENTITLEMENT = 'plus'` を足す / **`IS_PLUS` は消す**（D-5 の hook に置き換え）                                                                                                                                         |
| `src/utils/plus.ts`     | `canAddPlan(upcomingCount, isPlus, billingEnabled)`（D-7・式は同じ）/ `countUpcomingPlans(plans, todayKey)`（D-7）/ `resolveRevenueCatKey(key, isDev, platform)`（D-2）/ `hasPlus(customerInfo)`（D-5。引数は `{ entitlements: { active: Record<string, unknown> } }` の形だけを要求する） |

### service（S2・`src/services/purchases.ts`・新規）

| 関数                                                          | 中身                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `syncPurchasesUser(userId: string \| null): Promise<boolean>` | D-4。初期化済みかどうかを返す。キーは `resolveRevenueCatKey(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, __DEV__, Platform.OS)` |
| `fetchPlusPackage(): Promise<PurchasesPackage \| null>`       | `Purchases.getOfferings()` の `current?.availablePackages[0] ?? null`。reject はそのまま throw                                 |
| `fetchCustomerInfo(): Promise<CustomerInfo>`                  | `Purchases.getCustomerInfo()`                                                                                                  |
| `purchasePlus(pkg): Promise<CustomerInfo>`                    | `Purchases.purchasePackage(pkg)` の `customerInfo`。reject はそのまま throw（`userCancelled` の判定は呼び出し側）              |
| `restorePlus(): Promise<CustomerInfo>`                        | `Purchases.restorePurchases()`                                                                                                 |
| `subscribeCustomerInfo(listener): () => void`                 | `addCustomerInfoUpdateListener(listener)` し、`removeCustomerInfoUpdateListener(listener)` を呼ぶ関数を返す                    |

### 対象ファイル

| ファイル                                                                                 | 変更                                                                                                                              | スライス |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/constants/plus.ts`                                                                  | `PLUS_ENTITLEMENT` を足す・`IS_PLUS` を消す                                                                                       | S1       |
| `src/utils/plus.ts`                                                                      | `countUpcomingPlans` / `resolveRevenueCatKey` / `hasPlus` を足す・`canAddPlan` の第1引数の名前と JSDoc を「これからの予定の数」に | S1       |
| `src/utils/__tests__/plus.test.ts`（新規）                                               | S1 の純関数                                                                                                                       | S1       |
| `src/utils/__tests__/visitPlan.test.ts`                                                  | #258 の AC-16（`canAddPlan`）を D-7 の意味に合わせて直す（`plus.test.ts` に移してもよい）                                         | S1       |
| `package.json` / `package-lock.json`                                                     | `react-native-purchases`（10.x）を足す（`npx expo install react-native-purchases`）                                               | S2       |
| `jest.setup.js`                                                                          | `react-native-purchases` のモック（D-22）                                                                                         | S2       |
| `src/services/purchases.ts`（新規）/ `src/services/__tests__/purchases.test.ts`（新規）  | 上表                                                                                                                              | S2       |
| `src/utils/purchases.web.ts`（新規）/ `metro.config.js`                                  | Web のスタブ（D-21）                                                                                                              | S2       |
| `.env.example`                                                                           | `EXPO_PUBLIC_REVENUECAT_IOS_KEY=` の行と「Test Store のキー（test\_）は .env.local だけに」の注記                                 | S2       |
| `src/hooks/usePlus.ts`（新規）/ `src/hooks/__tests__/usePlus.test.ts`（新規）            | D-5                                                                                                                               | S3       |
| `src/components/plus/PlusPlanCards.tsx`（新規）                                          | カード2枚・浮く動き（D-14・D-20）                                                                                                 | S4       |
| `src/components/plus/PlusPurchasePanel.tsx`（新規）                                      | ボタン・1回だけ・復元・あとで・規約（D-10・D-15）                                                                                 | S4       |
| `src/components/plus/PlusSheet.tsx`（新規）                                              | B（D-16）                                                                                                                         | S4       |
| `src/components/plus/PlusThanksToast.tsx`（新規）                                        | F のトースト（D-19）                                                                                                              | S4       |
| `src/components/plus/__tests__/*.test.tsx`（新規）                                       | 部品のテスト                                                                                                                      | S4       |
| `src/screens/PlanCalendarScreen.tsx`                                                     | `guardAdd` を D-7 に・Alert をやめて `PlusSheet`・`usePlus`・買えたら/復元できたら `PlanEditor` へ（D-8・D-9・D-11）              | S4       |
| `src/screens/__tests__/PlanCalendarScreen.test.tsx`                                      | #258 の AC-30（Alert 前提）をシートの形に書き換える・`IS_PLUS` のモックを消す                                                     | S4       |
| `src/navigation/types.ts`                                                                | `Plus: undefined`・`Settings: { purchased?: boolean } \| undefined`・`PlanEditor` に `purchased?: boolean`（D-12）                | S4 / S5  |
| `src/screens/PlanEditorScreen.tsx`                                                       | `purchased` でトースト（D-11）                                                                                                    | S4       |
| `src/screens/PlusScreen.tsx`（新規）/ `src/components/plus/PlusMiniCalendar.tsx`（新規） | E（D-17・D-18）                                                                                                                   | S5       |
| `src/navigation/RootNavigator.tsx`                                                       | `Plus` を登録                                                                                                                     | S5       |
| `src/components/plus/PlusSettingsCard.tsx`（新規）                                       | D（D-13）                                                                                                                         | S5       |
| `src/screens/SettingsScreen.tsx`                                                         | 「プラス」のセクション・`purchased` のトースト（D-12・D-13）                                                                      | S5       |
| `src/screens/__tests__/PlusScreen.test.tsx`（新規）/ `SettingsScreen.test.tsx`           | E・D・F                                                                                                                           | S5       |
| `.claude/harness/progress.md`                                                            | S6 の確認結果（Test Store で買えたか・`useFrameworks: static` での Pod の結果）                                                   | S6       |

### 画面仕様（文言・具体値は試作 v3 のまま。値段だけ `priceString`）

#### A / C. 予定タブ（`PlanCalendar`）— 下のタブ「予定」

- 変わるのは「＋ 予定を組む」と空いた日を押したときの判定だけ（D-7）。カレンダーの見た目は変えない
- C: 過ぎた予定しか無ければ、「＋ 予定を組む」・空いた日でシートは出ずに予定を組む画面へ進む

#### B. プラスの案内のシート — 予定タブ（これからの予定が1件）→「＋ 予定を組む」または空いた日

- D-16 の中身。下から上がる（`Modal` の slide）・プラスのカードが少し遅れて浮く（D-20）
- 「{priceString}でプラスにする」→ App Store の購入シート → 買えたら閉じて予定を組む画面（見出しは押そうとした日の「{M月D日（曜）}の予定 ▾」）＋トースト
- 「購入を復元」→ D-10 / D-11。「あとで」・✕ → 閉じてカレンダーのまま
- 「利用規約」「プライバシーポリシー」→ シートを閉じて既存の画面（D-9）

#### D. 設定の「プラス」 — 下のタブ「設定」

- アカウントのすぐ下（D-13）。位置情報・アプリ情報の並びは変えない

#### E. プラスの画面（`Plus`）— 設定 →「御朱印さんぽ プラス」

- D-17 の中身。上のバーの ‹ で設定へ戻る
- 買えたら設定へ戻ってトースト（D-12）

#### F. 買ったあと

- 設定のカードが「購入済み」（D-13）、E のボタンが「購入済み」（D-15）、トースト（D-19）
- 予定タブで「＋ 予定を組む」・空いた日を押してもシートが出ずに予定を組む画面へ進む

## テスト方針

- 純関数は入力→出力を値で固定する。日付は `todayKey` を引数で渡す
- `react-native-purchases` は `jest.setup.js` のモック（D-22）。`BILLING_ENABLED` は `jest.mock('@/constants/plus', () => ({ get BILLING_ENABLED() { return mockBilling; }, FREE_PLAN_LIMIT: 1, PLUS_ENTITLEMENT: 'plus' }))` で切り替える
- `process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY` はテストの中で書き換え、service のモジュール内の状態（初期化済み・前回の userId）は `jest.isolateModules` か `jest.resetModules` でテストごとに作り直す
- `usePlus` の CustomerInfo の更新は、`addCustomerInfoUpdateListener` に渡された関数をテストから呼んで確かめる
- 動き（D-20）は `jest.useFakeTimers()` で時間を進めて途中と終わりの style を見る。Reduce Motion は `AccessibilityInfo.isReduceMotionEnabled` を true / false の両方でモック
- 実際の購入シート・Test Store・App Store の sandbox は native-only（UI 基準の最後）

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準に基づいて合否判定を行う。

### 機能基準 — 純関数・定数（S1・Jest）

- [ ] AC-1: `BILLING_ENABLED` が `false`、`FREE_PLAN_LIMIT` が `1`、`PLUS_ENTITLEMENT` が `'plus'` で export されていて、`@/constants/plus` に `IS_PLUS` が無い（`'IS_PLUS' in module === false`）。`grep -rn "IS_PLUS" src` が0件
- [ ] AC-2: `countUpcomingPlans([{plannedOn:'2026-09-20'},{plannedOn:'2026-09-26'},{plannedOn:'2026-10-03'}], '2026-09-26') === 2`、`countUpcomingPlans([{plannedOn:'2026-09-20'}], '2026-09-26') === 0`、`countUpcomingPlans([], '2026-09-26') === 0`
- [ ] AC-3: `canAddPlan` が `(1, false, false) → true`、`(0, false, true) → true`、`(1, false, true) → false`、`(1, true, true) → true`、`(5, false, false) → true`
- [ ] AC-4: `resolveRevenueCatKey('appl_x', false, 'ios') === 'appl_x'`、`resolveRevenueCatKey('test_x', true, 'ios') === 'test_x'`、`resolveRevenueCatKey('test_x', false, 'ios') === null`、`resolveRevenueCatKey(undefined, true, 'ios') === null`、`resolveRevenueCatKey('  ', true, 'ios') === null`、`resolveRevenueCatKey('appl_x', true, 'web') === null`、`resolveRevenueCatKey('appl_x', true, 'android') === null`
- [ ] AC-5: `hasPlus({ entitlements: { active: { plus: {} } } }) === true`、`hasPlus({ entitlements: { active: {} } }) === false`、`hasPlus({ entitlements: { active: { other: {} } } }) === false`

### 機能基準 — service（S2・Jest）

- [ ] AC-6: キーが `appl_x`・iOS のとき、`syncPurchasesUser('u1')` が `Purchases.configure({ apiKey: 'appl_x', appUserID: 'u1' })` を1回呼んで true を返す。続けて `syncPurchasesUser('u1')` を呼んでも `configure` / `logIn` は増えない。`syncPurchasesUser('u2')` で `Purchases.logIn('u2')` が1回、`syncPurchasesUser(null)` で `Purchases.logOut()` が1回呼ばれる。初期化前に `syncPurchasesUser('u1')` を2つ同時に呼んで（`Promise.all`）も `configure` は1回
- [ ] AC-7: キーが無いとき（`EXPO_PUBLIC_REVENUECAT_IOS_KEY` を消して `jest.isolateModules` で読み直す）、`syncPurchasesUser('u1')` が false を返し、`Purchases` のどの関数も呼ばれない。service がキーを `resolveRevenueCatKey(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, __DEV__, Platform.OS)` で決めていることをコードで確かめる（`__DEV__ = false` と `test_` の組み合わせは AC-4 の純関数で担保する。Jest の `__DEV__` は書き換えない）
- [ ] AC-8: 一度も初期化していない状態で `syncPurchasesUser(null)` を呼ぶと false を返し、`configure` も `logOut` も呼ばれない（ゲストは SDK を使わない）
- [ ] AC-9: `fetchPlusPackage()` が `getOfferings` の `current.availablePackages[0]` を返し、`current` が null のときと `availablePackages` が空のときは `null` を返す
- [ ] AC-10: `subscribeCustomerInfo(fn)` が `addCustomerInfoUpdateListener(fn)` を呼び、返した関数を呼ぶと `removeCustomerInfoUpdateListener(fn)` が呼ばれる
- [ ] AC-11: `metro.config.js` の `resolver.resolveRequest(context, 'react-native-purchases', 'web')` が `filePath` の末尾 `src/utils/purchases.web.ts` を返し、`platform = 'ios'` のときは `context.resolveRequest` に渡す。`src/utils/purchases.web.ts` の `default.getOfferings()` が reject する
- [ ] AC-12: `jest.setup.js` に `jest.mock('react-native-purchases'` があり、テストファイルの中で `react-native-purchases` を個別に `jest.mock` していない（`grep -rln "jest.mock('react-native-purchases'" src` が0件）

### 機能基準 — `usePlus`（S3・Jest）

- [ ] AC-13: `BILLING_ENABLED = false` のとき、ログイン済みでも `usePlus()` が `{ isPlus: false, status: 'unavailable', priceString: null }` を返し、`Purchases` のどの関数も呼ばれない
- [ ] AC-14: `BILLING_ENABLED = true`・ログイン済み（user.id `'me'`）・キーあり・plus なし・package の `priceString` が `'¥980'` のとき、はじめ `status: 'loading'`、そのあと `{ isPlus: false, status: 'ready', priceString: '¥980', canRestore: true }` になり、`configure` が `appUserID: 'me'` で呼ばれる
- [ ] AC-15: AC-14 の状態で `addCustomerInfoUpdateListener` に渡された関数を `{ entitlements: { active: { plus: {} } } }` で呼ぶと `isPlus` が true になる。アンマウントで `removeCustomerInfoUpdateListener` が同じ関数で呼ばれる
- [ ] AC-16: `BILLING_ENABLED = true` でも、ゲストのとき・キーが無いとき・`getOfferings` が reject したとき・current が無いとき、`status` が `'unavailable'`。`getOfferings` だけ reject したときは `canRestore` が true、キーが無いときとゲストのときは false
- [ ] AC-17: `purchase()` が、`purchasePackage` が plus ありの customerInfo で resolve → `'purchased'`（`isPlus` true）、`{ userCancelled: true }` で reject → `'cancelled'`、`{ userCancelled: false }` で reject → `'failed'`、plus なしで resolve → `'failed'` を返す。実行中は `busy` が true
- [ ] AC-18: `restore()` が、plus ありで resolve → `'restored'`、plus なしで resolve → `'none'`、reject → `'failed'` を返す

### 機能基準 — ① 予定の2件目（S4・Jest）

今日を 2026-09-26、予定 `{ 2026-10-03: 東山めぐり 4社 }` とする（試作 A / B と同じ）。`BILLING_ENABLED = true`・plus なし・`priceString: '¥980'`。

- [ ] AC-19: 「＋ 予定を組む」（`plan-new`）を押すと `navigate` は呼ばれず、見出し「予定をいくつでも入れるならプラス」のシートが出る。シートに「10月3日（土）」「東山めぐり」「9月26日（土）」「ここにも入れる」が出る。`Alert.alert` は呼ばれない
- [ ] AC-20: `plan-day-2026-10-10` を押すとシートが出て、押そうとした日が「10月10日（土）」になる
- [ ] AC-21: シートに「無料」「0円」「予定 1件」「プラス」「おすすめ」「¥980」「1回だけ」「予定 いくつでも」（「予定」と「いくつでも」が別の Text でもよい）、ボタン「¥980でプラスにする」、「1回だけの支払い」「毎月はかかりません」、「購入を復元」「あとで」「利用規約」「プライバシーポリシー」が出る
- [ ] AC-22: `plus-buy` → `purchasePackage` が plus ありで resolve すると、シートが閉じて `navigate('PlanEditor', { date: '2026-10-10', purchased: true })` が1回呼ばれる（AC-20 の続き）
- [ ] AC-23: `purchasePackage` が `{ userCancelled: true }` で reject すると、`Alert.alert` は呼ばれず、シートは開いたまま、`navigate` は呼ばれない
- [ ] AC-24: `purchasePackage` が `{ userCancelled: false }` で reject すると `Alert.alert` が「購入できませんでした」で呼ばれ、シートは開いたまま、`navigate` は呼ばれない
- [ ] AC-25: 「購入を復元」→ plus ありで resolve すると `Alert.alert` が「購入を復元しました」で呼ばれ、シートが閉じて `navigate('PlanEditor', { date: '2026-10-10' })`（`purchased` なし）が呼ばれる。plus なしなら「復元できる購入が見つかりませんでした」でシートは開いたまま。reject なら「購入を復元できませんでした」
- [ ] AC-26: 「あとで」を押すとシートが閉じ、`navigate` は呼ばれない。そのあと同じ `plan-day-2026-10-10` を押すとまたシートが出る。✕（`accessibilityLabel="閉じる"`）でも閉じる
- [ ] AC-27: 「利用規約」を押すとシートが閉じてから `navigate('TermsOfService')`、「プライバシーポリシー」なら `navigate('PrivacyPolicy')` が呼ばれる。`navigate` の時点でシートの `visible` が false
- [ ] AC-28: 予定が `{ 2026-09-20: 東山の朝 }`（過ぎた予定）だけのとき、`plan-new` で `navigate('PlanEditor', { date: '2026-09-26' })` が呼ばれ、シートは出ない
- [ ] AC-29: 予定 `{ 2026-10-03 }` があり plus ありのとき、`plan-day-2026-10-10` で `navigate('PlanEditor', { date: '2026-10-10' })` が呼ばれ、シートは出ない
- [ ] AC-30: `BILLING_ENABLED = false`（既定）のとき、これからの予定が5件あっても `plan-new` で `PlanEditor` へ進み、シートは出ず、`Purchases` のどの関数も呼ばれない
- [ ] AC-31: 予定 `{ 2026-10-03 }` がある日（`plan-day-2026-10-03`）を押すと、シートは出ずに `navigate('PlanEditor', { planId })` が呼ばれる（入っている予定を開く・直すのは無料）
- [ ] AC-32: `status = 'unavailable'` のとき、シートのボタンが「プラスにする」で押せず（`plus-buy` が disabled）、「いまは購入できません」（`plus-unavailable`）が出る。`status = 'loading'` のときボタンは「読み込み中…」で押せない。`canRestore` が false なら `plus-restore` が disabled
- [ ] AC-33: 購入の実行中（`purchasePackage` が未解決）は `plus-buy` と `plus-restore` が disabled で、もう一度押しても `purchasePackage` は1回のまま
- [ ] AC-34: `PlanEditor` を `route.params = { date: '2026-10-10', purchased: true }` で開くと「プラスになりました。ありがとうございます」が出て、3200ms 進めると消える。`setParams({ purchased: undefined })` が呼ばれる。`purchased` が無ければ出ない

### 機能基準 — ② 設定とプラスの画面（S5・Jest）

- [ ] AC-35: `BILLING_ENABLED = false` のとき、設定に `settings-section-plus` と「御朱印さんぽ プラス」が無い
- [ ] AC-36: `BILLING_ENABLED = true`・ログイン済み・plus なし・`'¥980'` のとき、`settings-section-plus` がアカウントのセクション（`settings-section-account`）のすぐ次にあり、カードに「御朱印さんぽ プラス」「予定をいくつでも入れられます」「¥980」が出る。押すと `navigation.getParent().navigate('Plus')`
- [ ] AC-37: plus ありのとき、カードの右が「購入済み」で「¥980」が無い。押すと `Plus` へ
- [ ] AC-38: ゲストのとき、カードに「ログインすると購入できます」が出て値段は出ず、押すと `Login` へ（`Plus` へは行かない）
- [ ] AC-39: `status = 'unavailable'` のとき、カードは出るが値段の文字が無い
- [ ] AC-40: 設定を `route.params = { purchased: true }` で開くと「プラスになりました。ありがとうございます」が出て 3200ms で消え、`setParams({ purchased: undefined })` が呼ばれる
- [ ] AC-41: `PlusScreen` に「御朱印さんぽ プラス」（上のバー）・「予定を、先までいくつでも」・カード2枚（AC-21 と同じ文言）・「¥980でプラスにする」・「1回だけの支払い」・「購入を復元」・「利用規約」・「プライバシーポリシー」が出て、「あとで」は無い
- [ ] AC-42: `PlusScreen` に「今後」「追加の支払いなし」「将来」の文字が無い（将来の約束を書かない）
- [ ] AC-43: `PlusScreen` で購入が plus ありで resolve すると `navigation.popTo('MainTabs', { screen: 'Settings', params: { purchased: true } })` が1回呼ばれる。キャンセルなら何も呼ばれない
- [ ] AC-44: `PlusScreen` で復元が plus ありで resolve すると `Alert.alert` が「購入を復元しました」で呼ばれ、`popTo` は呼ばれず、ボタンが「購入済み」（disabled）になり、「購入を復元」と「1回だけの支払い」が消える
- [ ] AC-45: plus ありで `PlusScreen` を開くと、ボタンが「購入済み」で disabled、`purchasePackage` を呼ぶ手段が無い
- [ ] AC-46: 今日が 2026-09-26 のとき、`PlusMiniCalendar` の見出しが「2026年10月」、`●` の付いた日が 10/3・10/10・10/17・10/24・10/31 の5つで、印が順に「●4社」「●3社」「●5社」「●2社」「●3社」。今日が 2026-12-15 なら見出しが「2027年1月」
- [ ] AC-47: `PlusMiniCalendar` の外側の View に `accessibilityElementsHidden` が true、`importantForAccessibility` が `'no-hide-descendants'`、`onPress` を持つ要素が中に無い
- [ ] AC-48: `PlusScreen` の上のバーの ‹ を押すと `navigation.goBack()` が呼ばれる
- [ ] AC-49: `RootNavigator` に `Plus` の画面が登録されている（`RootNavigator.test.tsx` の既存の「終えたあとでも、Onboarding へ行ける」と同じ書き方で、`navigate('Plus')` した先に「予定を、先までいくつでも」が出る）

### UI基準

- [ ] UI-1: シートのプラスのカードの枠が 2px・`colors.primary[500]`、地が `colors.primary[50]`、札「おすすめ」の地が `colors.primary[500]`。無料のカードの枠は `colors.gray[200]`（Jest で style を見る）
- [ ] UI-2: `plus-buy` の地が `colors.primary[500]`、文字が `colors.white`。設定のカードの地が `colors.primary[50]`・枠 `colors.primary[100]`、購入済みのとき地 `colors.white`・枠 `colors.gray[200]`・「購入済み」の色 `colors.pin.wishlisted`（Jest）
- [ ] UI-3: Reduce Motion オフのとき、シートを開いた直後のプラスのカードが `opacity: 0.6`・`translateY: 6`、349ms 進めても同じ、850ms 進めると `opacity: 1`・`translateY: 0`。オンのときは開いた直後から `opacity: 1`・`translateY: 0`（Jest・fake timers）。Jest で Animated の値が時間で動かない場合に限り、`Animated.timing` が `{ duration: 500, delay: 350 }` を含む引数で呼ばれ、Reduce Motion オンでは呼ばれないことを spy で見る形に替えてよい（替えたら PR に理由を書く）
- [ ] UI-4: トーストの地が `colors.gray[900]`、アイコンが `auto-awesome`・`colors.primary[300]`（Jest）
- [ ] UI-5: **Expo Web**（`npx expo start --web --port 8081`）で、`src/constants/plus.ts` をローカルでだけ `BILLING_ENABLED = true` にして（コミットしない）ログイン済みで 下のタブ「設定」→「御朱印さんぽ プラス」→ プラスの画面を開くと、見出し「予定を、先までいくつでも」・来月のミニカレンダー・カード2枚・押せない「プラスにする」・「いまは購入できません」が出て、画面が落ちない（Web は D-2 の②と D-21 で購入できない形。スクリーンショットを PR に貼る）
- [ ] UI-6: **Expo Web**: 同じ状態で 下のタブ「予定」→ 今日以降に予定を1件作ってから「＋ 予定を組む」でシートが下から出て、見出し「予定をいくつでも入れるならプラス」・左右の日付・カード2枚・「いまは購入できません」・「購入を復元」「あとで」・「利用規約・プライバシーポリシー」が 390px 幅で1画面に収まる（はみ出すなら下へスクロールできる）。スクリーンショットを PR に貼る
- [ ] UI-7: **native-only（シミュレータ・Test Store）**: `.env.local` に Test Store のキー（`test_`）を入れ、`BILLING_ENABLED` をローカルでだけ true にして `npx expo run:ios` で作ったシミュレータのアプリで、設定 →「御朱印さんぽ プラス」→「{priceString}でプラスにする」→ Test Store の購入の画面で買う → 設定へ戻ってトースト・カードが「購入済み」、予定タブで2件目の予定をシート無しで組める。結果（スクリーンショット・`priceString` の実際の文字）を PR と progress.md に書く
- [ ] UI-8: **native-only（シミュレータ・Test Store）**: 同じアプリで、予定を1件入れた状態から 予定タブ → 空いた日 → シート →「{priceString}でプラスにする」→ 買えたら予定を組む画面（見出しがその日）とトーストが出る。**買えた直後に予定を組む画面がシートの裏ではなく前に出て、そのまま操作できる**（D-9 の Modal と push の順番。Jest では見えない）。Test Store の画面でキャンセルするとシートが開いたまま何も出ない。シートの「利用規約」で利用規約の画面が前に出る。アプリを消して入れ直し、同じアカウントでログインして「購入を復元」で「購入を復元しました」が出る
- [ ] UI-9: **native-only（シミュレータ）**: シートが下から上がり、プラスのカードが少し遅れて浮く。設定 → アクセシビリティ →「視差効果を減らす」オンではカードが浮かない
- [ ] UI-10: **native-only（実機・App Store sandbox）**: オーナーの手順 H-1〜H-5 の後、`appl_` のキーの開発用ビルドを sandbox のアカウントで買い、App Store の購入シートに「御朱印さんぽ プラス」と日本円の値段が出て、買えたら「購入済み」になる。**これはスイッチを入れる前に1回やる。このブランチの PR の合否には含めない**（有料 App 契約が済んでいないとできないため）

### E2E

- なし。`BILLING_ENABLED = false` のまま出すので、コミットした状態のアプリには購入の導線が出ず、Maestro で辿れない。購入の動線は UI-7・UI-8（Test Store）で確かめる

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: `package.json` の `dependencies` の差分が `react-native-purchases`（10.x）の1件だけ。`devDependencies` は変わらない
- [ ] Q-5: `src/components/plus/` と `src/screens/PlusScreen.tsx` に `#` で始まる色の直値が無い
- [ ] Q-6: グローバル状態管理（Context / Zustand / Redux）を足していない（`grep -rn "createContext\|zustand\|redux" src` が増えていない）
- [ ] Q-7: 値段をハードコードしていない（`grep -rn "980" src/components/plus src/screens/PlusScreen.tsx src/hooks/usePlus.ts src/services/purchases.ts` が0件、かつ `grep -rn "980円" src --include='*.ts' --include='*.tsx' | grep -v __tests__` が0件）
- [ ] Q-8: D-23 の import の制限: `grep -rlE "usePlus|PlusSheet|PlusPurchasePanel" src --include='*.tsx' --include='*.ts' | grep -v __tests__` が `src/hooks/usePlus.ts`・`src/screens/PlanCalendarScreen.tsx`・`src/screens/SettingsScreen.tsx`・`src/screens/PlusScreen.tsx`・`src/components/plus/` の中だけ
- [ ] Q-9: `.env` / `.env.local` をコミットしていない。リポジトリに `test_` で始まる RevenueCat のキーの文字列が無い（`git grep -nE "test_[A-Za-z0-9]{10,}"` が0件）
- [ ] Q-10: `ios/` / `android/` をコミットしていない（`npx expo run:ios` の生成物。`.gitignore` 済み）

## スライス（1スライス = 1コミット・TDD）

| #   | 中身                                                                                                                                                                                            | 主な AC             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| S1  | 純関数と定数: `countUpcomingPlans` / `canAddPlan` の意味 / `resolveRevenueCatKey` / `hasPlus` / `PLUS_ENTITLEMENT`・`IS_PLUS` を消す（`PlanCalendarScreen` は一時的に `isPlus = false` を渡す） | AC-1〜5             |
| S2  | `react-native-purchases` を入れる / `jest.setup.js` のモック / `services/purchases.ts` / Web のスタブと `metro.config.js` / `.env.example`                                                      | AC-6〜12 / Q-4      |
| S3  | `usePlus`                                                                                                                                                                                       | AC-13〜18           |
| S4  | ①: `PlusPlanCards` / `PlusPurchasePanel` / `PlusSheet` / `PlusThanksToast` / `PlanCalendarScreen`（Alert → シート）/ `PlanEditorScreen` のトースト / types                                      | AC-19〜34 / UI-1〜4 |
| S5  | ②: `PlusScreen` / `PlusMiniCalendar` / `RootNavigator` / `PlusSettingsCard` / `SettingsScreen`                                                                                                  | AC-35〜49 / UI-5・6 |
| S6  | シミュレータで Test Store の確認（コードの変更が出たら fix のコミット）。progress.md に記録                                                                                                     | UI-7〜9             |

## 手順

### 開発中の確認（S6・実装する人が行う。オーナーの作業はキーの受け渡しだけ）

1. オーナーが RevenueCat のプロジェクトの Test Store の公開キー（`test_...`）を渡す（H-2 の後）。**`.env.local` にだけ**書く: `EXPO_PUBLIC_REVENUECAT_IOS_KEY=test_...`
2. `src/constants/plus.ts` を**ローカルでだけ** `BILLING_ENABLED = true` にする（コミットしない。AC-1 が false を縛っているので、紛れてコミットするとテストが落ちる）
3. `npx expo run:ios`（EAS は 10/1 まで使えない。この Mac の Xcode 26.6 でシミュレータ用をローカルで作る。`ios/` は CNG で生成され `.gitignore` 済み）。**最初のビルドで `expo-build-properties` の `useFrameworks: "static"` と `react-native-purchases`（PurchasesHybridCommon / RevenueCat の Pod）が通るかを確かめ、結果を progress.md に書く**
4. UI-7〜9 を行う。終わったら `BILLING_ENABLED` を false に戻し、`git status` で `src/constants/plus.ts` に差分が無いことを確かめる
5. StoreKit Configuration ファイル（`.storekit`）は使わない（Test Store で足りるため）

### オーナーの手順（受入基準の外）

役割の分け方: **アカウント・契約・お金・秘密に関わることはオーナー**、RevenueCat の中の商品・entitlement・offering の作成は **Claude が RevenueCat MCP で行う**。

| #   | 誰               | いつ                   | 中身                                                                                                                                                                                                                                                                                          |
| --- | ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1 | オーナー         | このブランチの S6 の前 | RevenueCat のアカウントとプロジェクト（「御朱印さんぽ」）を作る                                                                                                                                                                                                                               |
| H-2 | オーナー         | S6 の前                | Claude Code に RevenueCat MCP（`https://mcp.revenuecat.ai/mcp`）を接続して OAuth で許可する。Test Store の公開キー（`test_...`）を dashboard から取り、手順「開発中の確認」1 のとおり `.env.local` に入れる（会話には貼らない）                                                               |
| M-1 | Claude（MCP）    | H-2 の後・S6 の前      | Test Store に商品 `plus`（買い切り・980円相当）、entitlement `plus`（商品を付ける）、offering `default`（current に設定・package `$rc_lifetime` に商品）を作る。作った ID を progress.md に書く                                                                                               |
| H-3 | オーナー         | スイッチを入れる前     | App Store Connect の**有料 App 契約**（銀行口座・税の書類）。あわせて Apple の **Small Business Program**（手数料15%）に申し込む                                                                                                                                                              |
| H-4 | オーナー         | H-3 の後               | App Store Connect に課金アイテムを登録: 非消耗型・参照名「御朱印さんぽ プラス」・製品 ID `com.goshuin.app.plus`・価格 980円・日本語の表示名と説明・審査用のスクリーンショット。App Store Connect の「アプリ内課金キー」（.p8）を作って RevenueCat の iOS アプリに登録する                     |
| M-2 | Claude（MCP）    | H-4 の後               | RevenueCat の iOS アプリ（bundle `com.goshuin.app`）に App Store の商品 `com.goshuin.app.plus` を足し、entitlement `plus` と offering `default` の `$rc_lifetime` に付ける                                                                                                                    |
| H-5 | オーナー         | M-2 の後               | RevenueCat の iOS アプリの公開 SDK キー（`appl_...`）を EAS の環境変数に登録: `eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_... --environment production --environment preview --environment development --visibility plaintext`。**Test Store のキーは EAS に入れない** |
| H-6 | オーナー         | スイッチを入れる前     | **プライバシーポリシー・利用規約の改訂**: RevenueCat（購入の記録・appUserID＝アカウントの ID を送る第三者）の追記、買い切りの購入・返金（Apple の手続きによる）・復元の記載。App Store Connect の「App のプライバシー」に「購入」（購入履歴・ユーザーに紐づく）を足す                         |
| H-7 | オーナー＋Claude | スイッチを入れるとき   | `BILLING_ENABLED = true` にする別の Issue を立てる。UI-10（sandbox）をそこで行う。**初めての課金アイテムはアプリのバージョンと一緒に審査に出す**ので、スイッチを入れたバージョンの提出に H-4 の課金アイテムを付ける                                                                           |

## やらないこと（スコープ外）

- `BILLING_ENABLED` を true にすること（別の Issue。H-7）
- RevenueCat の webhook → Supabase に購入の状態を持たせること（サーバー側でプラスを使う機能がまだ無い）
- Android / Google Play（`resolveRevenueCatKey` は iOS 以外で null を返す）
- Web で買えるようにすること（RevenueCat Web Billing）
- 着せ替え・記録の書き出しなど、ほかのプラスの機能（G は参考の絵。カードに行を足さない）
- 月額・年額の商品、割引・期間限定・「残りわずか」・利用者数の表示
- 起動時・オンボーディング・地図・予定を組む画面の中でのプラスの案内。「あとで」のあとに時間をおいてもう一度出すこと
- プライバシーポリシー・利用規約の本文の改訂（H-6 としてオーナーが行う。このブランチでは画面の文章を変えない）
- StoreKit Configuration ファイル（`.storekit`）・Maestro の購入フロー
- 予定を組む画面・カレンダーの見た目の変更（判定とシートとトースト以外）
- 購入済みの人の無料の枠を超えた予定を、プラスでなくなったとき（返金など）に消す・隠すこと（増えた予定はそのまま見える・直せる。新しく足すときだけ判定する）

## 注意事項

- **試作とオーナーの決定の食い違い**: 試作 F の説明文は「E は購入ボタンの代わりに『ありがとうございます』」だが、オーナーの決定は「E のボタンは『購入済み』」。**オーナーの決定を採った**（D-15）。お礼の一言はトースト（D-19）に任せる
- 試作の値段は「980円」だが、画面の値段は `priceString`（日本の App Store では「¥980」の形で来ることが多い）。試作と文字の形が変わる可能性がある。見た目で「980円」に揃えるために文字列を加工しない（Apple の表示のまま）
- 試作の teal（`#0D9488`）はテーマでは `colors.pin.wishlisted` だけにある。意味は「行きたい」のピンの色だが、新しいトークンを足すと `theme.test.ts` の色の近さの検査に掛かる恐れがあるので使い回す（D-13・D-14）
- `usePlus` は画面ごとに状態を持つ（グローバル状態を入れない）。同じ時刻に複数の画面で `getOfferings` を呼ぶことがあるが、SDK が内部でキャッシュするので v1 ではまとめない。利用者の切り替え（configure / logIn / logOut）だけは service で1回にする（D-4）
- ①のシートで押そうとした日が、入っている次の予定と同じ日（今日の予定があって「＋ 予定を組む」を押した）になることがある。そのまま両方に同じ日付を出す。買ったあと予定を組む画面で保存すると #258 D-2 の「同じ日に予定は1つまで」の Alert になる（今の「＋ 予定を組む」と同じ動き。このブランチでは変えない）
- `purchased` のトーストは `PlanCalendarScreen` の `savedOn` と同じく「params を読んだら setParams で消す・消すタイマーは params と切り離す」（#258 で `setParams` のせいでタイマーが消えて残り続けた不具合があった）
- `Purchases.logOut()` は匿名の利用者で呼ぶと reject する。D-4 のとおり「初期化済み かつ 前回の userId が null でない」ときだけ呼び、reject は `console.warn` にして握り潰さない（画面には出さない）
- Test Store のキーは「本番に入れて提出してはいけない」（RevenueCat の注意書き）。D-2 の③はその保険で、正しい運用は H-5（EAS には `appl_` だけ）

## リスク・不確実な点

- **ネイティブの依存を足すので、この変更は OTA（expo-updates）では届かない**。`runtimeVersion.policy: "fingerprint"` なのでフィンガープリントが変わり、次のストア用ビルド（EAS は 10/1 以降）で出る。**このブランチをマージした後の develop からの OTA は、新しいビルドを入れた人にしか届かなくなる**。マージの時期はオーナーと決める（S6 まで終わっても、ストア用ビルドの予定が立つまで develop に入れない選択もある）
- **`useFrameworks: "static"` と `react-native-purchases` の Pod の相性**は未確認。`npx expo run:ios` の最初のビルドで分かる（手順「開発中の確認」3）。通らなければ実装を止めてオーナーに相談する（勝手に `useFrameworks` を変えない。maplibre・Google Sign-In に効いている設定のため）
- **`metro.config.js` を Jest から require できるか**（AC-11）: `expo/metro-config` の `getDefaultConfig` が Jest の node 環境で動くかは未確認。動かなければ `WEB_STUBS` と `resolveRequest` を `metro.web-stubs.js` のような小さなファイルに切り出して、それを Jest から見る（挙動は同じ。契約の意図は「Web で `react-native-purchases` がスタブに解決されること」）
- **Test Store の購入の画面の見え方**・Test Store の `priceString` がどんな文字で来るか（`¥980` か `$9.99` 相当か）は未確認。UI-7 で記録する
- **App Store の審査**: 初めての課金アイテムは、その購入の導線が審査員から見えるバージョンで出す必要がある。`BILLING_ENABLED = false` のこのバージョンには付けない（H-7）
- **ゲストの設定のカード**（「ログインすると購入できます」）と**復元の失敗の文言**（「購入を復元できませんでした」）は試作・オーナーの決定に無い。最小限で足したので、オーナーの確認が要る
- **ミニカレンダーを「来月」にした**（試作は 2026年10月の固定の絵）。固定の月だと時間が経つと古い月が出るため。土曜日に並べる社数（4, 3, 5, 2, 3, 4 の繰り返し）も試作の数を延ばしたもの
