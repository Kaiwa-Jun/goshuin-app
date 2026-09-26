# Issue #258: 参拝の予定を組めるようにする

## 概要

休日に何社か回るときに、寺社を選んで**ある日の予定**を作り、回る順番を決めて、カレンダーに残せるようにする。

- 下のタブに **「予定」** を足す（地図 / **予定** / 御朱印帳 / あゆみ / 設定）。開くとカレンダー
- 予定を組む画面は **上が地図（MapLibre）・下がドロワー**。ピンを押すと小さなカード →「＋ 予定に入れる」でドロワーへ流れ込む。空のときは「行きたいから選ぶ」
- **「順番を決める」**で同じ画面のままドロワーが順番の表示に変わる。地図には番号つきのピンと点線（1番から順に描く）。順番は**位置と受付時間から自動で提案**し、長押しで並べ替えもできる
- 区間ごとに**距離からの目安**（徒歩 約N分 / 電車などで移動・約N.Nkm）と **「Google マップで」**（その1区間の電車＋徒歩の道順を開く）
- 「この予定を保存」→ 名前だけ聞いてカレンダーに印。日付はドロワーの見出し（「10月3日（土）の予定 ▾」）で変える
- 日が過ぎた予定は、**その日に実際に記録した寺社に ✓**
- 課金はオンにしない。**「プラスなら」の分かれ目（無料は予定1つ）だけ**を純関数と定数で作る。`BILLING_ENABLED = false` の間は全員いくつでも

> ⚠ 要件 `docs/design/2026-09-route-plan-spec.md` は **§0（決定事項1〜12）が正**。§2 の ①（地図の検索欄の横・スポットのシートに入口）と ④（自動並べはプラス）は §0 の 1 と 7 で置き換わっている。**入口は下のタブだけ、順番の自動提案は無料**。

## 関連ドキュメント

- **要件（正）**: [`docs/design/2026-09-route-plan-spec.md`](../design/2026-09-route-plan-spec.md) §0・§1・§4
- **承認デザイン（正）**: [`docs/design/mockups/2026-09-route-plan-v3.html`](../design/mockups/2026-09-route-plan-v3.html) / `-v3.png`（2026-09-26 オーナー承認）。v1・v2 は経緯
- 収益化: [`docs/product/2026-09-monetization-design.md`](../product/2026-09-monetization-design.md) §8
- プロダクト方針: [`docs/product/direction.md`](../product/direction.md) / memory「日々開きたくなる・愛着の仕組み」（参拝ルート計画を採用）
- 地図の作り: `src/components/map/`（Issue #140 のピン色・MapLibre 移行）/ シートの作り: [`issue-114-bottom-sheet-redesign.md`](./issue-114-bottom-sheet-redesign.md)・[`issue-253-spot-sheet-stable-order.md`](./issue-253-spot-sheet-stable-order.md)
- RLS 検証の様式: `supabase/validation/spots_owner_visibility.sql`（Issue #248）
- 確認済み: `docs/product/direction.md`（Phase 3「巡礼・ルート計画」）・`docs/product/requirements.md`（将来拡張「巡礼ルート生成」）と矛盾なし。`docs/design/ui-design.md` は4タブの記述なので S3 で注記を更新する

## 設計上の決定（要件に無い点）

| #    | 決めたこと                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-1  | **保存の単位は「予定1つ = `visit_plans` 1行 + `visit_plan_stops` N行」**。保存は RPC `save_visit_plan(p_plan_id uuid, p_planned_on date, p_name text, p_spot_ids uuid[]) RETURNS uuid` の1回で行う（`SECURITY INVOKER` = RLS がそのまま効く）。新規は `p_plan_id = NULL`。既存は plan の行を UPDATE し、stops を全部消して `p_spot_ids` の順に `position = 0..N-1` で入れ直す。2表を別々に書くと途中で落ちたときに寺社の無い予定が残るため、1トランザクションにする                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-2  | **同じ日に予定は1つまで**（`UNIQUE (user_id, planned_on)`）。カレンダーが「日 → 予定」で引く作りなので2つ目を置く場所が無い。保存・日付の変更で既に他の予定がある日を選んだら、RPC が一意制約違反（`23505`）で失敗し、画面は Alert「{M月D日（曜）}にはもう「{名前}」があります。別の日を選んでください」（ボタン「OK」のみ）を出して保存シートを閉じない。置き換えはしない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D-3  | **「次の土曜日」= 今日より後の最初の土曜日**。今日が土曜なら **7日後**（試作 `(6 - day + 7) % 7 \|\| 7`）。端末のローカル日付で数え、`toLocalDateString`（`src/utils/localDate.ts`）で `YYYY-MM-DD` にする。`toISOString()` は使わない（Issue #204）。例: 2026-09-26（土）→ 2026-10-03、2026-09-28（月）→ 2026-10-03、2026-10-02（金）→ 2026-10-03                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D-4  | **予定の寺社が見えなくなった場合（merged・他人の pending 等で spots の RLS に落ちる）は、表示から黙って落とす**。spots の SELECT ポリシーは merged を本人にも見せない（20260925000000）ので `merged_into_spot_id` もクライアントからは辿れない。stops の行は DB に残るが、次に保存したときに画面に出ていた寺社だけで入れ直されて消える。✓ の分母（「k / N社 回れた」の N・カレンダーの「✓k/N」「●N社」）は**表示している寺社の数**。表示が0社になった予定もカレンダーには残す（「●0社」）。寺社の行が DELETE された場合は FK の `ON DELETE CASCADE` で stops から消える                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-5  | **並べ替えは行の右端の「⋮⋮」を長押し（300ms）してから縦にドラッグ**。gesture-handler / reanimated は未導入なので **PanResponder + Animated**（`SpotBottomSheet` と同じ作り）で書き、**新しい依存を足さない**。行の高さは固定（計測値）で、指の位置 ÷ 行の高さで挿入位置を決め、指を離したら順番を確定する。VoiceOver 向けに各行へ `accessibilityActions`（`moveUp`「上へ」/ `moveDown`「下へ」）を付ける（Jest で機械チェックできる操作にもなる）。手で並べ替えたら提案のバナーを消す（試作どおり）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-6  | **順番の自動提案 `suggestOrder` は純関数**。出発点を**選んだ寺社の全通り**試し、それぞれ「いまいる寺社から一番近い寺社へ」を繰り返して並べる（最近傍）。候補のうち **①受付に間に合わない寺社の数が少ない → ②区間の目安の分の合計が少ない** 方を採る。同点は**先に試した方**（出発点は入力順＝選んだ順に試す。最近傍の距離が同じなら入力順が先）。0社は `[]`、1社はそのまま。距離は既存の `calculateDistance`（`src/utils/geo.ts`、Haversine・km）を使う                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-7  | **区間の目安 `estimateLeg`**: `d = 直線距離(m) × 1.3`。`d ≤ 1500` → 徒歩・`round(d / 80)` 分・表示「徒歩 約N分」。それより遠い → 電車など・`round(d/1000 × 4 + 10)` 分・表示「電車などで移動・約N.Nkm」（`d/1000` を小数1桁）。分は時刻の見積もりにだけ使い、電車の区間では画面に分を出さない（試作どおり）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D-8  | **時刻の見積もり `buildSchedule`**: 出発 **9:00**、各寺社に **30分**滞在、そのあと区間の目安の分を足して次の寺社の「着く時刻」にする。表示は `H:MM`（例 `9:00`・`10:26`）。**受付に間に合わない = 着く時刻 > 受付の終わり − 30分**（試作 v3 の判定。滞在30分のうちに受付を済ませる前提）。受付の終わりが無い寺社は間に合わない扱いにしない。出発時刻・滞在時間は画面で変えない（定数 `PLAN_START_MINUTES = 540` / `PLAN_STAY_MINUTES = 30` / `LATE_MARGIN_MINUTES = 30`。判定は `isLate(arrive, close) = close !== null && arrive > close - LATE_MARGIN_MINUTES`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D-9  | **受付時間**: `useSpotInfo` は1社ずつなので、一括の `fetchReceptionHours(spotIds): Promise<Map<string, string>>`（`spot_aggregated_info` の `info_type = 'reception_hours'` を `.in('spot_id', ids)` で1回）を `src/services/spotInfo.ts` に足す。値は `info_data.close`。`close` は自由文字列なので **`/^([01]?\d\|2[0-3]):[0-5]\d$/` に合うときだけ**判定に使い（`parseClock`）、合わないときは判定に使わず表示もしない。`close` が無い寺社は「受付 〜」の行を出さない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D-10 | **Google マップ**: URL は `https://www.google.com/maps/dir/?api=1&origin={lat},{lng}&destination={lat},{lng}&travelmode=transit`（`googleMapsTransitUrl(from, to)`・純関数。座標は Spot の値をそのまま文字列化）。`Linking.openURL(url)` で開く（Google マップのアプリがあればアプリ、無ければブラウザが開く。`canOpenURL` は https なので呼ばない）。`openURL` が reject したら Alert「Google マップを開けませんでした」                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D-11 | **過ぎた予定の ✓**: `planned_on < 今日（ローカル）` の予定を「過ぎた予定」とする。**今日の予定は過ぎていない**扱い（時刻と Google マップを出す）。✓ は「その日付（`stamps.visited_at = planned_on`）に本人が記録した stamps の `spot_id`」に含まれる寺社。別の日に記録した寺社には付けない。取得は `fetchVisitedSpotIdsByDate(dates: string[]): Promise<Map<string, Set<string>>>`（`stamps` を `.in('visited_at', dates)`、RLS で本人のみ）を1回                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D-12 | **アニメーション**: ①「＋ 予定に入れる」でカードがドロワーの一覧の末尾へ流れ込む（`Animated.timing` 400ms・translateY と scale 1→0.6・opacity 1→0.2）。終わったら行を足し、件数が弾む（scale 1→1.2→1、200ms）。②「順番を決める」で番号ピンと点線を **1区間 200ms** ごとに1番から増やし、ドロワーの行も同じ間隔で上から出す。点線の「引かれる」動きは MapLibre の line で dashoffset を動かせないので、**GeoJSON の features を 200ms ごとに1つずつ増やす**方式にする。③「視差効果を減らす」（既存 `useReduceMotion` = `AccessibilityInfo.isReduceMotionEnabled`）がオンなら①②とも動かさず、最終状態を即座に出す                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D-13 | **選んだピンの見せ方**: 定数 `CHOSEN_PIN_STYLE: 'big-check' \| 'ring'`（`src/components/plan/planMapStyle.ts`）を1つ置き、既定は **`'big-check'`**。`big-check` = 選んだピンの `icon-size` を通常の **1.45倍**にし、右上に ✓ の画像（丸 `colors.primary[500]`・白フチ・白の ✓）を重ねる。`ring` = 通常の大きさのピンの頭に朱の輪（`colors.seal`・幅3・塗り無し）を重ねる。✓ と輪は地図フォントに ✓ のグリフが無い可能性があるので **`scripts/generate-map-pins.py` で `pin-chosen-check.png` / `pin-chosen-ring.png` を焼き足し**、選んだ寺社だけを載せた symbol レイヤで出す。今の script は `colors.ts` の `pin` ブロックしか読まないので、**`primary[500]` と `seal` を直接読むように拡張する（`pin` ブロックには足さない。足すと `theme.test.ts` の「ピンの状態どうしの色が離れている」検査に未訪問 `#FB923C` との近さで掛かる）**。画像は `spotPins.tsx` の `PIN_IMAGES` に `spot-pin-chosen-check` / `spot-pin-chosen-ring` として足す（地図ごとに `<SpotPinImages />` が1つ、を保つ）。どちらにするかは実機で比べて決め、決まったら定数を書き換える（別コミット） |
| D-14 | **プラスの分かれ目**: `src/constants/plus.ts` に `BILLING_ENABLED = false` と `FREE_PLAN_LIMIT = 1`。`src/utils/plus.ts` に純関数 `canAddPlan(plansCount: number, isPlus: boolean, billingEnabled: boolean): boolean` = `!billingEnabled \|\| isPlus \|\| plansCount < FREE_PLAN_LIMIT`。**`plansCount` は保存済みの予定の全件（過ぎた予定を含む）**。既存の予定を開いて保存し直すのは「足す」ではないので呼ばない。`isPlus` は購入の仕組みが無いので呼び出し側で `false` 固定（`IS_PLUS = false` を同ファイルに置く）。false のときは Alert（題「予定をいくつでも入れるのはプラスです」・本文「無料では予定を1つまで入れられます。いまの予定を消すと、新しい予定を組めます。」・「閉じる」）を出して予定を組む画面へ進まない。**課金オンの前に「数えるのは全件か今日以降か」をオーナーに確認する**（リスク欄）                                                                                                                                                                                                                                                          |
| D-15 | **予定を消す**（試作に無い。D-14 の「消すと新しく組める」の出口として最小限で足す）: 保存済みの予定を「編集」で開いたとき、保存シートの下に文字ボタン「この予定を消す」。押すと確認 Alert（「この予定を消しますか？」・「消す」（destructive）/「やめる」）→ `deleteVisitPlan(id)` → カレンダーへ戻る。新規のときは出さない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D-16 | **未ログイン**: 予定タブは御朱印帳・あゆみと同じく**ゲストの空状態**（`testID="plan-guest-empty-state"`・本文「ログインすると、行きたい寺社を回る予定を組めます」・ボタン「ログインして始める」→ `Login`）。カレンダーも予定を組む画面も出さない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-17 | **日付を変える**: 見出し「{M月D日（曜）}の予定 ▾」を押すと下からのシート（既存 `Modal` の `variant="bottom"`）「いつの予定？」。中身は試作どおり **‹ 日付 ›** の1日ずつのステッパーと「この日にする」。`@react-native-community/datetimepicker` は使わない。**‹ は今日より前に戻れない**（日付が今日以前のとき disabled。過ぎた予定を編集していて日付が今日より前でも ‹ は押せず、› だけで今日以降へ動かせる）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D-18 | **名前**: 保存シート「この予定を保存」・ラベル「{M月D日（曜）}の予定の名前」・入力（`maxLength={30}`・placeholder「例: 東山めぐり」・新規の初期値は空、編集は今の名前）・ボタン「保存してカレンダーに入れる」。空のまま保存したら名前は「{M}月{D}日の予定」。DB は `CHECK (char_length(name) BETWEEN 1 AND 30)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D-19 | **ナビゲーション**: `MainTabParamList` に `PlanTab: NavigatorScreenParams<PlanStackParamList>`。新 `PlanStack`: `PlanCalendar: { savedOn?: string } \| undefined` / `PlanEditor: { planId?: string; date?: string }`。予定を組む画面はタブバーの上に出す（`PlanStack` 内の画面。タブバーは隠さない＝試作どおり）。保存後は `navigate('PlanCalendar', { savedOn })` で戻り、カレンダーはその月を開いて「{M月D日（曜）} に保存しました」を 3.2 秒出す。状態はカスタム hooks + ローカル state のみ（グローバル状態は入れない）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D-20 | **タブのアイコン**: MaterialIcons `event`・`motion="draw"`（既存の動きを流用。`TabIconMotion` に新しい動きは足さない）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D-21 | **予定を組む画面の地図**: 寺社は地図タブと同じ `useSpots`（active + 本人の pending）・`useUserStamps`・`useWishlist` を使い、ピンは既存の `SpotMapLayers`（同じ色・団子・ランクの間引き）をそのまま置く。順番の表示のときは選んでいない寺社のピンを `icon-opacity: 0.45` にする（`SpotMapLayers` に `dimmed?: boolean` を足す）。最初のカメラ: 選んだ寺社があればそれが全部入る `fitBounds`、無ければ現在地（`useLocation`）、取れなければ `DEFAULT_LOCATION`、ズーム 13                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D-22 | **番号ピンと点線は GeoJSON レイヤ**: ソース `plan-route`（LineString を区間ごとに1 feature、`properties.index`）→ line レイヤ（`line-color: colors.seal`・`line-width: 3`・`line-dasharray: [2, 2]`）。ソース `plan-stops`（Point、`properties.number` = 1始まり）→ circle レイヤ（半径 13・`colors.seal`・白フチ 2.5）＋ symbol レイヤ（`text-field: number`・白・`Noto Sans Bold`・12）。組み立ては純関数 `buildPlanRouteSources(orderedSpots, revealedCount)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-23 | **「順番を決める」は2社以上で押せる**（1社以下は disabled）。そのため保存できる予定は2社以上。寺社の数に上限は設けない（`suggestOrder` は n³ で 50社でも十分速い）。D-4 で見える寺社が1社以下になった保存済みの予定は、「編集」を押すと順番の表示ではなく②（寺社を選ぶ）で開く（読むだけの表示はそのまま出せる）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-24 | **カレンダーの日を押したとき**: 予定のある日 → その予定を**読むだけ**の順番の表示で開く（下は「編集」/「カレンダーへ」）。予定の無い今日以降の日 → その日付で予定を組む画面（D-14 の判定を通してから）。**予定の無い過ぎた日は押せない**（`disabled`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D-25 | **読み込みの失敗**: 予定の取得に失敗したらカレンダーの下に「予定を読み込めませんでした」と「もう一度」を出す（空のカレンダーと区別する。wishlist のように空へ黙って倒さない）。受付時間・その日の記録の取得失敗は、受付の行・✓ を出さないだけにする（誤情報にならないため）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## 詳細設計

### データ構造

#### migration `supabase/migrations/20260926000000_create_visit_plans.sql`

```sql
CREATE TABLE public.visit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  planned_on DATE NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, planned_on)                         -- D-2
);
CREATE TRIGGER ... BEFORE UPDATE ... EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.visit_plan_stops (
  plan_id UUID NOT NULL REFERENCES public.visit_plans(id) ON DELETE CASCADE,
  spot_id UUID NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,   -- D-4
  position INT NOT NULL CHECK (position >= 0),
  PRIMARY KEY (plan_id, position),
  UNIQUE (plan_id, spot_id)
);
CREATE INDEX idx_visit_plan_stops_spot_id ON public.visit_plan_stops (spot_id);

-- RLS: 本人だけが読み書きする
ALTER TABLE public.visit_plans ENABLE ROW LEVEL SECURITY;
--   SELECT / INSERT / UPDATE / DELETE とも auth.uid() = user_id（INSERT・UPDATE は WITH CHECK も）
ALTER TABLE public.visit_plan_stops ENABLE ROW LEVEL SECURITY;
--   SELECT / INSERT / UPDATE / DELETE とも
--   EXISTS (SELECT 1 FROM public.visit_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())

-- D-1: 保存を1トランザクションで。SECURITY INVOKER（RLS をそのまま効かせる）・SET search_path = public
CREATE FUNCTION public.save_visit_plan(p_plan_id UUID, p_planned_on DATE, p_name TEXT, p_spot_ids UUID[])
RETURNS UUID ...
--   p_plan_id IS NULL → INSERT ... RETURNING id
--   それ以外 → UPDATE ... WHERE id = p_plan_id（RLS で他人の行は 0 行）→ 0 行なら RAISE EXCEPTION 'visit plan not found'
--   DELETE FROM visit_plan_stops WHERE plan_id = id;
--   INSERT ... SELECT id, s, ord - 1 FROM unnest(p_spot_ids) WITH ORDINALITY AS t(s, ord);
REVOKE EXECUTE ON FUNCTION public.save_visit_plan(UUID, DATE, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_visit_plan(UUID, DATE, TEXT, UUID[]) TO authenticated;
```

#### 型（`src/types/visitPlan.ts`）

```ts
export interface VisitPlanStop {
  spotId: string;
  position: number;
  spot: Pick<Spot, 'id' | 'name' | 'type' | 'lat' | 'lng'>;
}
export interface VisitPlan {
  id: string;
  plannedOn: string /* YYYY-MM-DD */;
  name: string;
  stops: VisitPlanStop[]; /* position 昇順・見えない寺社は除外済み（D-4） */
}
export interface PlanLeg {
  mode: 'walk' | 'transit';
  minutes: number;
  km: number;
  label: string;
}
export interface ScheduledStop {
  spotId: string;
  arriveMinutes: number;
  late: boolean;
  leg: PlanLeg | null;
}
```

### API / エンドポイント（`src/services/visitPlans.ts`・新規）

| 関数                                                     | 中身                                                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchVisitPlans(): Promise<VisitPlan[]>`                | `visit_plans` を `select('id, planned_on, name, visit_plan_stops(position, spot_id, spots(id, name, type, lat, lng))')`・`planned_on` 昇順。`spots` が null の stop を落とす。error は throw |
| `saveVisitPlan({ planId?, plannedOn, name, spotIds })`   | `supabase.rpc('save_visit_plan', {...})` → id。一意制約違反は `code === '23505'` を `VisitPlanDateTakenError` にして throw                                                                   |
| `deleteVisitPlan(id)`                                    | `visit_plans` を DELETE（stops は CASCADE）。error は throw                                                                                                                                  |
| `fetchVisitedSpotIdsByDate(dates)`                       | D-11                                                                                                                                                                                         |
| `fetchReceptionHours(spotIds)`（`services/spotInfo.ts`） | D-9                                                                                                                                                                                          |

### 純関数（S1）

| ファイル                         | 関数                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/visitPlan.ts`（新規） | `estimateLeg(a, b)`（D-7）/ `parseClock(s)` → 分 or null / `formatClock(min)` → `H:MM` / `buildSchedule(stops)`（D-8）/ `suggestOrder(stops)` → spotId[]（D-6）/ `googleMapsTransitUrl(a, b)`（D-10）/ `countVisited(stopSpotIds, visitedOn: Set)` → `{ done: Set<string>; count: number }`（D-11）/ `isPastPlan(plannedOn, today)` |
| `src/utils/planDate.ts`（新規）  | `nextSaturday(today: Date): string`（D-3）/ `formatPlanDate('2026-10-03')` → `10月3日（土）` / `buildMonthGrid(year, month)` → 日曜始まり 42 日の `YYYY-MM-DD` / `addDays(date, n)`                                                                                                                                                 |
| `src/utils/plus.ts`（新規）      | `canAddPlan(plansCount, isPlus, billingEnabled)`（D-14）                                                                                                                                                                                                                                                                            |
| `src/utils/planRoute.ts`（新規） | `buildPlanRouteSources(orderedSpots, revealedCount)` → `{ route, stops }` の FeatureCollection（D-22）                                                                                                                                                                                                                              |

`stops` の入力は `{ spotId: string; lat: number; lng: number; closeMinutes: number | null }[]`。どれも入力を破壊しない。

### 対象ファイル

| ファイル                                                                      | 変更                                                                   | スライス |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| `src/utils/visitPlan.ts` / `planDate.ts` / `plus.ts` / `planRoute.ts`（新規） | 上表                                                                   | S1 / S5  |
| `src/constants/plus.ts`（新規）                                               | `BILLING_ENABLED = false` / `FREE_PLAN_LIMIT = 1` / `IS_PLUS = false`  | S1       |
| `supabase/migrations/20260926000000_create_visit_plans.sql`（新規）           | 上記                                                                   | S2       |
| `supabase/validation/visit_plans_owner_only.sql`（新規）                      | RLS 検証（下記）                                                       | S2       |
| `src/types/visitPlan.ts`（新規）/ `src/services/visitPlans.ts`（新規）        | 型・service                                                            | S2       |
| `src/services/spotInfo.ts`                                                    | `fetchReceptionHours` を足す                                           | S2       |
| `src/navigation/types.ts` / `TabNavigator.tsx` / `PlanStack.tsx`（新規）      | D-19・D-20                                                             | S3       |
| `src/hooks/useVisitPlans.ts`（新規）                                          | 予定一覧・その日の記録・再取得（`useFocusEffect`）                     | S3       |
| `src/screens/PlanCalendarScreen.tsx`（新規）                                  | カレンダー・次の予定・「＋ 予定を組む」・ゲスト・保存した旨            | S3       |
| `src/components/plan/PlanCalendar.tsx`（新規）                                | 月の格子                                                               | S3       |
| `src/hooks/usePlanEditor.ts`（新規）                                          | 選んだ寺社・順番・日付・表示（build / order / readonly）のローカル状態 | S4       |
| `src/screens/PlanEditorScreen.tsx`（新規）                                    | 地図＋ドロワー                                                         | S4       |
| `src/components/plan/PlanDrawer.tsx`（新規）                                  | PanResponder のドロワー（`SpotBottomSheet` と同じ作り・フッター固定）  | S4       |
| `src/components/plan/PlanSpotCard.tsx`（新規）                                | ピンのカード・流れ込み                                                 | S4       |
| `src/components/plan/planMapStyle.ts` / `PlanMapLayers.tsx`（新規）           | 選んだピン（D-13）・番号ピンと点線（D-22）                             | S4 / S5  |
| `src/components/map/SpotMapLayers.tsx`                                        | `dimmed?: boolean`（D-21）                                             | S5       |
| `scripts/generate-map-pins.py` / `assets/map-pins/pin-chosen-*.png`           | ✓ と輪の画像（D-13）                                                   | S4       |
| `src/components/plan/PlanStopList.tsx`（新規）                                | 順番の行・区間・並べ替え・Google マップ                                | S5       |
| `src/components/plan/PlanSaveSheet.tsx` / `PlanDateSheet.tsx`（新規）         | 保存（名前）・日付                                                     | S6       |
| `src/navigation/__tests__/TabNavigator.test.tsx`                              | 「renders all 4 tabs」と並び順のテストを5タブに更新                    | S3       |
| `e2e/flows/smoke.yaml`                                                        | `assertVisible: "予定"` を足す                                         | S3       |
| `src/components/map/spotPins.tsx`                                             | `PIN_IMAGES` に ✓ と輪の画像（D-13）                                   | S4       |
| `docs/design/ui-design.md`                                                    | 冒頭の注記のタブ構成に「予定」を足す（4タブ → 5タブ）                  | S3       |
| `e2e/flows/visit-plan.yaml`（新規）                                           | 予定を組む動線                                                         | S7       |

### 画面仕様（文言・具体値は試作 v3 のまま）

#### ① 予定タブ（`PlanCalendar`）— 地図タブ → 下のタブ「予定」

- 見出し「{YYYY}年{M}月」と ‹ ›（前の月・次の月）。曜日「日 月 火 水 木 金 土」。日曜始まり6週 × 7日の格子（前後の月の日は数字を薄く `colors.gray[400]`。**前後の月の日も今の月の日と同じく押せる**）。日のセルは `testID="plan-day-YYYY-MM-DD"`
- 今日のセルは丸（`colors.primary[500]` の枠）
- 予定のある今日以降の日: 数字の下に「●N社」（● は `colors.primary[500]`）。過ぎた日: 「✓k/N」
- 格子の下に **「次の予定」** カード（`planned_on ≥ 今日` の最初の1件）: 上に小さく「次の予定」、太字「{M月D日（曜）} {名前}」、その下に寺社名を「 → 」でつないだ行。押すとその予定を開く。無ければ案内「行きたい寺社を回る予定を組んでみましょう。」「空いている日を押すと、その日の予定を組めます。」
- 右下に FAB「＋ 予定を組む」（日付の初期値は D-3）

#### ② 予定を組む（`PlanEditor` の build）— 予定タブ →「＋ 予定を組む」または空いた日

- 上のバー: 左に「✕」（カレンダーへ戻る・確認は出さない）、中央「予定を組む」
- 上が地図、下がドロワー（つまみ付き・上下に引ける。2段: 画面の 45% / 80%）
- ピンを押す → 地図の下端に **カード**: 寺社名（太字）＋ 種別バッジ（「神社」/「寺院」）＋ 小さく「受付 〜{close}」「・行きたい」「・参拝済み」（あるものだけ）、右にボタン「＋ 予定に入れる」（選び済みなら「予定から外す」）
- ドロワーの見出し: 左「{M月D日（曜）}の予定 ▾」（押すと D-17）、右「**{N}**社・ピンを押して足す」
- 選んだ寺社の行: 寺社名・種別バッジ・右端「✕」（外す）。選んだ順
- 0社のとき: 「まだありません。地図のピンを押すか、下の「行きたい」から足してください。」
- 見出し「行きたいから選ぶ」＋ 行きたいの寺社（選んでいないもの・`useSpots` の `allSpots` に居るものだけ・**名前の昇順**（`localeCompare(b, 'ja')`））の行: 寺社名・種別バッジ・右端「＋」（名前は `colors.pin.wishlisted`）。押すと足す（流れ込みは無し・件数は弾む）
- ドロワーの下に固定のボタン「順番を決める」（`colors.primary[500]`・2社未満は disabled）

#### ③ 順番（同じ `PlanEditor` の order）

- 上のバー: 左「‹」（②へ戻る＝「選び直す」と同じ）、中央「予定を組む」
- 地図: 番号ピンと点線（D-22）。選んでいない寺社のピンは薄く（0.45）
- ドロワーの見出し: 左「{M月D日（曜）}の予定 ▾」、右「⋮⋮ で並べ替え」
- 提案した直後だけバナー「✦ 近い順・受付の早い順に並べました。つまんで変えられます」
- 行: 左に番号の丸（`colors.seal`）・寺社名（太字）・その下「受付 〜{close}」（間に合わないときは `colors.seal` で「受付 〜{close}　間に合わないかも」）・右に着く時刻 `H:MM`・右端「⋮⋮」
- 行と行のあいだに区間: 目安の文字（D-7）＋ ボタン「Google マップで」
- 下に固定: 「選び直す」（②へ。選んだ寺社は今の順番のまま）/「この予定を保存」（`colors.primary[500]`）

#### ③' 保存済みの予定を開いた（読むだけ）

- 上のバー中央は予定の名前。ドロワーの見出し左は「{M月D日（曜）}」（▾ 無し・押せない）
- 今日以降: 行に時刻と区間の「Google マップで」は出す。「⋮⋮」は出さない。下は「編集」（③ を編集できる状態に）/「カレンダーへ」
- 過ぎた予定: 見出し右「{k} / {N}社 回れた」。行の右は「✓ 記録」（`colors.primary[500]`）か「行けなかった」（`colors.gray[400]`）、行けなかった寺社は番号の丸を `colors.gray[300]`。時刻と「Google マップで」は出さない

#### ④ 保存 — ③の「この予定を保存」

- D-18 のシート。保存すると D-19 のとおりカレンダーへ戻り、その日に印

## テスト方針

- **S1 の純関数はすべて入力→出力を数値で固定**（試作 v3 の京都5社を固定データにする）。`jest.useFakeTimers().setSystemTime` は使わず、`today` を引数で渡す
- service は既存の `wishlist.test.ts` と同じく supabase クライアントをモックして、呼ぶテーブル・条件・rpc 名と引数を確かめる
- 画面・コンポーネントは testing-library。地図は `jest.setup.js` の MapLibre モック（ソース/レイヤが `id` を testID に持ち、`getByTestId('plan-route').props.data` で中身が見える）で、描く features の数と properties を見る
- 動き（流れ込み・順に描く）は `jest.useFakeTimers()` で時間を進めて、途中と終わりの状態を見る。Reduce Motion は `AccessibilityInfo.isReduceMotionEnabled` をモックして true/false の両方
- RLS は `supabase/validation/visit_plans_owner_only.sql` をリンク先の DB で流し、期待の1行と一致するか
- 地図の見た目・長押しドラッグ・Google マップが実際に開くかは native-only（Maestro と実機）

### 固定データ（試作 v3 と同じ）

| key      | 名前         | lat     | lng      | 受付の終わり |
| -------- | ------------ | ------- | -------- | ------------ |
| yasaka   | 八坂神社     | 35.0036 | 135.7780 | 17:00        |
| kennin   | 建仁寺       | 34.9996 | 135.7742 | 16:30        |
| kiyomizu | 清水寺       | 34.9950 | 135.7843 | 18:00        |
| sanju    | 三十三間堂   | 34.9897 | 135.7727 | 16:00        |
| fushimi  | 伏見稲荷大社 | 34.9672 | 135.7732 | 16:30        |

受付を優先する確認用: p1 (35.0000, 135.7700, 受付無し) / p2 (35.0050, 135.7700, 受付無し) / p3 (35.0300, 135.7700, 受付 10:00)

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準に基づいて合否判定を行う。

### 機能基準 — 純関数（S1・Jest）

- [ ] AC-1: `estimateLeg(八坂神社, 建仁寺)` が `{ mode: 'walk', minutes: 9, label: '徒歩 約9分' }` を含む
- [ ] AC-2: `estimateLeg(三十三間堂, 伏見稲荷大社)` が `{ mode: 'transit', minutes: 23, label: '電車などで移動・約3.3km' }` を含む
- [ ] AC-3: `直線距離 × 1.3` がちょうど 1500m の2点では `mode: 'walk'`・`minutes: 19`、1501m では `mode: 'transit'` になる（座標は距離から逆算したものか、距離を注入できる内部関数で確かめる）
- [ ] AC-4: `suggestOrder([清水寺, 八坂神社, 伏見稲荷大社, 建仁寺, 三十三間堂])` が `[八坂神社, 建仁寺, 清水寺, 三十三間堂, 伏見稲荷大社]` の spotId を返す
- [ ] AC-5: 上の順の `buildSchedule` の着く時刻が `9:00, 9:39, 10:26, 11:12, 12:05`（`formatClock` で）、`late` がすべて false、最後の寺社の `leg` が null
- [ ] AC-6: `suggestOrder([p1, p2, p3])` が `[p3, p2, p1]` を返す（p1 から始める順は移動の合計が同じ 33 分でも p3 に間に合わないので採らない）
- [ ] AC-7: `suggestOrder([])` が `[]`、`suggestOrder([x])` が `[x]`、入力配列が呼ぶ前と同じ（破壊しない）
- [ ] AC-8: `isLate(arriveMinutes, closeMinutes)`（`buildSchedule` が使う判定。export する）が `isLate(570, 600) === false`（9:30 着・受付 10:00）、`isLate(571, 600) === true`、`isLate(1380, null) === false`。`LATE_MARGIN_MINUTES === 30`
- [ ] AC-9: `parseClock('17:00') === 1020`、`parseClock('9:30') === 570`、`parseClock('17時まで')`・`parseClock('')`・`parseClock('25:00')` はどれも `null`
- [ ] AC-10: `nextSaturday` が 2026-09-26（土）→ `'2026-10-03'`、2026-09-28（月）→ `'2026-10-03'`、2026-10-02（金）→ `'2026-10-03'`、2026-10-03（土）→ `'2026-10-10'` を返す
- [ ] AC-11: `formatPlanDate('2026-10-03') === '10月3日（土）'`、`formatPlanDate('2026-10-12') === '10月12日（月）'`
- [ ] AC-12: `buildMonthGrid(2026, 10)` が 42 要素で、先頭が `'2026-09-27'`（日）、`'2026-10-01'` が index 4、末尾が `'2026-11-07'`
- [ ] AC-13: `googleMapsTransitUrl({lat: 35.0036, lng: 135.778}, {lat: 34.9996, lng: 135.7742})` が `'https://www.google.com/maps/dir/?api=1&origin=35.0036,135.778&destination=34.9996,135.7742&travelmode=transit'`
- [ ] AC-14: `countVisited([a, b, c, d], new Set([a, c, x]))` が `count: 2`・`done` が `{a, c}`（予定に無い x は数えない）
- [ ] AC-15: `isPastPlan('2026-09-25', 2026-09-26)` が true、`isPastPlan('2026-09-26', 2026-09-26)` が false
- [ ] AC-16: `canAddPlan` が `(1, false, false) → true`、`(5, false, false) → true`、`(0, false, true) → true`、`(1, false, true) → false`、`(1, true, true) → true`。`BILLING_ENABLED` が `false` で export されている
- [ ] AC-17: `buildPlanRouteSources(5社, revealedCount)` が `revealedCount = 0` で route 0・stops 0、`= 3` で stops 3（`number` 1〜3）・route 2、`= 5` で stops 5・route 4 の features を返す

### 機能基準 — DB（S2・SQL 検証 / Jest）

- [ ] AC-18: migration に `visit_plans` と `visit_plan_stops` があり、両方 `ENABLE ROW LEVEL SECURITY`、`UNIQUE (user_id, planned_on)`、`visit_plan_stops.spot_id` と `plan_id` が `ON DELETE CASCADE`
- [ ] AC-19: `npx supabase@latest db query --linked -f supabase/validation/visit_plans_owner_only.sql` が（最後に RAISE EXCEPTION で巻き戻す様式で）次の1行を出す: `RESULT own_plan=visible other_plan=hidden other_stops=hidden update_other=0rows delete_other=0rows rpc_own=ok rpc_other=denied same_day=denied order=kept`（`order=kept` = `save_visit_plan` に渡した順の `position` 0..N-1 で入る）。**本番への migration 適用後に実行する（下の「手順」）**
- [ ] AC-20: `saveVisitPlan` が `supabase.rpc('save_visit_plan', { p_plan_id: null, p_planned_on: '2026-10-03', p_name: '東山めぐり', p_spot_ids: [...] })` を呼び、error の `code: '23505'` のときは `VisitPlanDateTakenError` を throw する（Jest）
- [ ] AC-21: `fetchVisitPlans` は `spots` が null の stop を結果から除き、残りを `position` 昇順で返す（Jest）
- [ ] AC-22: `fetchReceptionHours(['a', 'b'])` が `spot_aggregated_info` に `info_type = 'reception_hours'` と `spot_id in (a, b)` で1回だけ問い合わせ、`info_data.close` を持つ寺社だけの Map を返す（Jest）
- [ ] AC-23: `fetchVisitedSpotIdsByDate(['2026-09-20'])` が `stamps` を `visited_at in ('2026-09-20')` で1回だけ問い合わせ、日付ごとの Set を返す（Jest）

### 機能基準 — 画面（S3〜S6・Jest）

- [ ] AC-24: 下のタブが左から「地図」「予定」「御朱印帳」「あゆみ」「設定」の順に並ぶ（`TabNavigator.test.tsx`）
- [ ] AC-25: 未ログインで「予定」タブを押すと `plan-guest-empty-state` が出て、「ログインして始める」を押すと `Login` へ遷移する
- [ ] AC-26: 今日を 2026-09-26、予定 `{ 2026-10-12: 東山めぐり 5社 }` `{ 2026-09-20: 東山の朝 4社 }`、2026-09-20 の記録が4社中3社のとき、開いた直後（9月の格子）の `plan-day-2026-09-20` に「✓3/4」、「次の予定」に「10月12日（月） 東山めぐり」が出て、› で10月にすると見出しが「2026年10月」になり `plan-day-2026-10-12` に「●5社」が出る
- [ ] AC-27: 予定が0件のとき「行きたい寺社を回る予定を組んでみましょう。」が出て、「次の予定」は出ない
- [ ] AC-28: 今日が 2026-09-26 のとき「＋ 予定を組む」で開いた画面の見出しが「10月3日（土）の予定 ▾」、`plan-day-2026-10-05` を押して開いた画面の見出しが「10月5日（月）の予定 ▾」
- [ ] AC-29: 予定の無い過ぎた日（`plan-day-2026-09-25`）を押しても画面は変わらない（`disabled`）
- [ ] AC-30: `BILLING_ENABLED` を true・予定1件にモックすると、「＋ 予定を組む」で Alert「予定をいくつでも入れるのはプラスです」が出て `PlanEditor` へ遷移しない。`BILLING_ENABLED = false`（既定）なら予定が5件でも遷移する
- [ ] AC-31: 予定を組む画面で `goshuin-pinned` / `goshuin-spots` の `onPress` に寺社 id を渡すと、カードに寺社名と「＋ 予定に入れる」が出る。押すと Reduce Motion オフでは 400ms 進めた後に、オンでは即座に、ドロワーの一覧にその寺社の行が足され、件数が1増える。同じピンのカードは「予定から外す」に変わる
- [ ] AC-32: 0社のとき「まだありません。地図のピンを押すか、下の「行きたい」から足してください。」と「行きたいから選ぶ」の一覧（行きたいの寺社だけ）が出る。一覧の「＋」で足した寺社は一覧から消えて選んだ行に移る。「✕」で外すと一覧に戻る
- [ ] AC-33: 選んだ寺社が1社のとき「順番を決める」が disabled、2社で押せる
- [ ] AC-34: 京都5社を選んで「順番を決める」を押すと、ドロワーの行が上から 八坂神社・建仁寺・清水寺・三十三間堂・伏見稲荷大社 の順で、時刻 `9:00`〜`12:05`、区間の文字「徒歩 約9分」「徒歩 約17分」「電車などで移動・約1.6km」「電車などで移動・約3.3km」、バナー「✦ 近い順・受付の早い順に並べました。つまんで変えられます」が出る
- [ ] AC-35: 「順番を決める」の直後、Reduce Motion オフなら `plan-stops` の features が 0 → 200ms ごとに1つ増えて 1000ms で 5（`plan-route` は 4）になる。オンなら直後から 5 / 4
- [ ] AC-36: 受付の終わりが `9:00` の寺社を含む予定で「順番を決める」を押すと、その寺社の行に「間に合わないかも」が出て、その文字の色が `colors.seal`
- [ ] AC-37: 受付時間が無い寺社の行には「受付 〜」が出ない
- [ ] AC-38: 2番目の行に `accessibilityAction` の `moveUp` を送ると1番目と入れ替わり、時刻と区間が新しい順で計算し直され、バナーが消える
- [ ] AC-39: 1番目と2番目のあいだの「Google マップで」を押すと `Linking.openURL` が AC-13 の形式の URL（1番目 → 2番目の座標）で1回呼ばれる。reject したら Alert「Google マップを開けませんでした」
- [ ] AC-40: 見出し「10月3日（土）の予定 ▾」を押すとシート「いつの予定？」が出て、› を2回・「この日にする」で見出しが「10月5日（月）の予定 ▾」になる。日付が今日のとき ‹ が disabled
- [ ] AC-41: 「この予定を保存」→ ラベル「10月3日（土）の予定の名前」→ 名前「東山めぐり」→「保存してカレンダーに入れる」で `saveVisitPlan` が `{ plannedOn: '2026-10-03', name: '東山めぐり', spotIds: [今の順番] }` で呼ばれ、カレンダーへ戻って「10月3日（土） に保存しました」が出る
- [ ] AC-42: 名前を空のまま保存すると `name: '10月3日の予定'` で保存される
- [ ] AC-42b: 保存済みの予定（id `plan-1`・名前「東山めぐり」）を開いて「編集」→ 2番目の行に `moveUp` →「この予定を保存」→ シートの名前の初期値が「東山めぐり」→「保存してカレンダーに入れる」で `saveVisitPlan` が `{ planId: 'plan-1', ... , spotIds: [入れ替えた順番] }` で呼ばれる
- [ ] AC-42c: 見える寺社が1社になった保存済みの予定を開いて「編集」を押すと、②（見出し「{N}社・ピンを押して足す」・「順番を決める」が disabled）で開く
- [ ] AC-43: `saveVisitPlan` が `VisitPlanDateTakenError` を投げると Alert「10月3日（土）にはもう「{名前}」があります。別の日を選んでください」が出て、保存シートが開いたまま
- [ ] AC-44: 今日以降の保存済みの予定を開くと、上のバーに予定の名前、下に「編集」「カレンダーへ」、行に時刻と「Google マップで」があり「⋮⋮」が無い
- [ ] AC-45: 過ぎた予定（2026-09-20・4社・記録3社）を開くと見出し右に「3 / 4社 回れた」、記録した3行に「✓ 記録」、残り1行に「行けなかった」が出て、「Google マップで」と時刻は出ない
- [ ] AC-46: 保存済みの予定を「編集」→「この予定を保存」で開いたシートに「この予定を消す」があり、確認 Alert の「消す」で `deleteVisitPlan(id)` が呼ばれてカレンダーへ戻る。新規のシートには「この予定を消す」が無い
- [ ] AC-47: 予定の取得が失敗するとカレンダーに「予定を読み込めませんでした」と「もう一度」が出て、「もう一度」で再取得する
- [ ] AC-48: 予定の stops のうち `spots` が見えない寺社がある予定（4社中1社が見えない）は、カレンダーで「●3社」、開くと3行だけ出る

### UI基準

- [ ] UI-1: 下のタブ「予定」のアイコンが MaterialIcons `event`（`testID="tab-icon-event"`）、選ばれたときの色が `colors.primary[500]`（Expo Web: `http://localhost:8081` → 下のタブ「予定」）
- [ ] UI-2: 予定タブのカレンダーに見出し「2026年9月」形式・曜日「日」〜「土」・7列の格子・右下の「＋ 予定を組む」が出る（Expo Web: 予定タブ・ログイン済み）
- [ ] UI-3: 予定を組む画面のドロワーに見出し「{M月D日（曜）}の予定 ▾」と「{N}社・ピンを押して足す」、下に固定の「順番を決める」が出る（Expo Web: 予定タブ →「＋ 予定を組む」。地図の背景は Web では出ない）
- [ ] UI-4: 順番の表示で番号の丸の色が `colors.seal`、「この予定を保存」の背景が `colors.primary[500]`（Expo Web: 予定タブ →「＋ 予定を組む」→「行きたいから選ぶ」で2社 →「順番を決める」）
- [ ] UI-5: `plan-route` の line レイヤの paint が `line-color: colors.seal`・`line-width: 3`・`line-dasharray: [2, 2]`、`plan-stops` の circle が `circle-color: colors.seal`・`circle-radius: 13`（Jest でレイヤの props を見る）
- [ ] UI-6: `CHOSEN_PIN_STYLE` の既定が `'big-check'` で、そのとき選んだ寺社のレイヤの `icon-size` が通常の 1.45 倍の式、✓ の画像 `spot-pin-chosen-check` を使う。`'ring'` に替えると `spot-pin-chosen-ring` を使い大きさは通常（Jest）
- [ ] UI-7: 順番の表示のとき `SpotMapLayers` のピンのレイヤに `icon-opacity: 0.45` が付き、②の表示では付かない（Jest）
- [ ] UI-8: **native-only（実機確認）**: 地図の上に番号つきのピンと朱の点線が 1番から順に引かれ、ピンの番号と名前が重ならずに読める。iOS 実機（dev build）で予定タブ →「＋ 予定を組む」→ 3社 →「順番を決める」でスクリーンショット
- [ ] UI-9: **native-only（実機確認）**: 「＋ 予定に入れる」でカードがドロワーの一覧の末尾に向かって縮みながら動き、件数が弾む。設定 → アクセシビリティ →「視差効果を減らす」オンでは動かずに行が出る
- [ ] UI-10: **native-only（実機確認）**: 「⋮⋮」を長押しして縦にドラッグすると行が指について動き、離した位置に入る。ドロワー自体は動かない（つまみを引いたときだけ動く）
- [ ] UI-11: **native-only（実機確認）**: 「Google マップで」で Google マップ（アプリ、無ければ Safari）が開き、その1区間の出発地・目的地・「電車」の経路が表示される
- [ ] UI-12: **native-only（実機確認）**: 選んだピンの見せ方を `'big-check'` と `'ring'` の両方でビルドして見比べ、結果（どちらにしたか・理由）を PR に書く。朱の輪が地図のフォーカスの印と紛れないかを見る

### E2E（S7・Maestro・native-only）

- [ ] E-1: `e2e/flows/smoke.yaml` に `assertVisible: "予定"` があり、5タブで通る
- [ ] E-2: `e2e/flows/visit-plan.yaml`: ログイン済み・行きたいが2件以上ある状態で、予定タブ →「＋ 予定を組む」→「行きたいから選ぶ」の「＋」を2回 →「順番を決める」→ `assertVisible: "Google マップで"` →「この予定を保存」→ 名前入力 →「保存してカレンダーに入れる」→ `assertVisible: "に保存しました"` → 作った予定を開いて「編集」→「この予定を保存」→「この予定を消す」→「消す」で後片付けまで通る。ログイン状態の用意は `e2e/README.md` の方法に従い、用意できない環境ではフロー冒頭に理由を書いて `runFlow: when` で飛ばさない（静かに緑にしない）

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: 新しい npm 依存を足していない（`package.json` の dependencies が変わっていない）
- [ ] Q-5: 新しいファイルで色・余白・文字に直値を書いていない（`src/components/plan/` と `src/screens/Plan*.tsx` に `#` で始まる色の直値が無い）
- [ ] Q-6: グローバル状態管理（Context / Zustand / Redux）を足していない

## スライス（1スライス = 1コミット・TDD）

| #   | 中身                                                                                                                                                                                                   | 主な AC                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| S1  | 純関数: `estimateLeg` / `parseClock` / `formatClock` / `buildSchedule` / `suggestOrder` / `googleMapsTransitUrl` / `countVisited` / `isPastPlan` / `planDate.ts` / `canAddPlan` と `constants/plus.ts` | AC-1〜16                              |
| S2  | migration + RLS + `save_visit_plan` / `supabase/validation/visit_plans_owner_only.sql` / `types/visitPlan.ts` / `services/visitPlans.ts` / `fetchReceptionHours`                                       | AC-18〜23（AC-19 は手順後）           |
| S3  | 予定タブ: `PlanStack` / `TabNavigator`（5タブ）/ `useVisitPlans` / `PlanCalendarScreen`（格子・印・次の予定・ゲスト・読み込み失敗・プラスの分かれ目）/ smoke.yaml                                      | AC-24〜30・47・48 / UI-1・2 / E-1     |
| S4  | 予定を組む画面: `usePlanEditor` / `PlanEditorScreen`（地図＋ドロワー）/ `PlanDrawer` / `PlanSpotCard`（流れ込み）/ 行きたいから選ぶ / 選んだピン（D-13・画像の焼き足し）                               | AC-31〜33 / UI-3・6・9                |
| S5  | 順番: `planRoute.ts`（AC-17）/ `PlanMapLayers`（番号ピン・点線・順に描く）/ `SpotMapLayers` の `dimmed` / `PlanStopList`（時刻・受付・区間・並べ替え・Google マップ）                                  | AC-17・34〜39 / UI-4・5・7・8・10・11 |
| S6  | 保存・日付・読むだけ・過ぎた予定の ✓・消す: `PlanSaveSheet` / `PlanDateSheet` / 保存後のカレンダー                                                                                                     | AC-40〜46                             |
| S7  | `e2e/flows/visit-plan.yaml`                                                                                                                                                                            | E-2 / UI-12                           |

## 手順（オーナーが実行する。受入基準の外）

S2 のコミット後、PR の前に:

```bash
! npx -y supabase@latest db query --linked -f supabase/migrations/20260926000000_create_visit_plans.sql && npx -y supabase@latest migration repair --status applied 20260926000000   # 本番に適用（このリポジトリでは db push が使えないので query -f + repair）
! npx supabase@latest db query --linked -f supabase/validation/visit_plans_owner_only.sql   # AC-19（エラーで終わるのが正しい。RESULT 行を見る）
```

適用前に Supabase が pause していないか dashboard で確認する。

## やらないこと（スコープ外）

- アプリの中での本当の道順・乗り換え・所要時間（経路検索の API は使わない。将来プラスで足す）
- Google マップに複数の目的地をまとめて渡すこと（電車の経路では扱えない。区間ごとだけ）
- 予定の共有・他人との同時編集
- 通知（前日のお知らせ など）
- 予定の寺社をまとめて記録する（その日の夜に「今日の予定の寺社を記録」など）
- 地図タブの検索欄の横・スポットのシートに「予定」の入口を置くこと（§0-1。入口は下のタブだけ）
- フィルタを検索欄の下のバッジにする改善（§0-1。別の改善）
- 購入の仕組み・プラスの画面・`isPlus` の判定（`BILLING_ENABLED = false` と純関数だけ）
- 出発時刻・滞在時間を画面で変えること（9:00 / 30分の固定）
- 出発地点（家・駅・現在地）を順番の計算に入れること（寺社どうしだけで並べる）
- 同じ日に2つ目の予定・予定の置き換え
- 1社だけの予定の保存
- 予定の複製・テンプレート・並べ替えの取り消し
- 予定の寺社を地図タブのピンに出すこと
- merged の寺社を統合先に付け替えること
- 受付時間の自由文字列（「17時まで」等）を解釈すること

## 注意事項

- **要件 §1 と試作で「間に合わない」の判定が違う**: §1 は「目安の時刻が受付の終わりを過ぎたら」、試作 v3 は「着く時刻 > 受付の終わり − 30分」。承認された試作に合わせた（D-8）。オーナーが §1 の文字どおりを望むなら `LATE_MARGIN_MINUTES` を 0 にする1行の変更で済むよう定数にしておく
- 地図のピンは GL のレイヤで VoiceOver から個々に選べない（`spotPins.tsx` のコメント）。予定を組む画面では「行きたいから選ぶ」が代替の導線になる。行きたいに入れていない寺社を VoiceOver だけで選ぶ手段は v1 では無い
- ピン画像は事前レンダリング。✓ と輪の画像を足したら `npm run gen:map-pins` で焼き、`assets/map-pins/baked-colors.json` も更新されることを確かめる。色は `colors.primary[500]` と `colors.seal` から読ませる（直値を書かない）
- `PlanDrawer` のドラッグ（ドロワーを引く）と行の長押しドラッグ（並べ替え）がぶつからないよう、ドロワーの PanResponder は**つまみと見出しの範囲だけ**で `onMoveShouldSetPanResponder` を返す
- 順に描く・流れ込みのタイマーは画面を離れたら必ず止める（アンマウント後の setState を出さない）
- 日付はすべて `YYYY-MM-DD` の文字列で持ち、`new Date('YYYY-MM-DD')`（UTC 解釈）を挟まない。`formatPlanDate` は文字列を分解して `new Date(y, m - 1, d)` で曜日を出す
- 予定は数十件程度の想定なので `fetchVisitPlans` は全件1回で取る（ページングしない）。stops の寺社は embed で取るので `useSpots` の全件取得を待たずにカレンダーが描ける
- `useSpots` は予定を組む画面を開くたびに全件を取る（地図タブと同じ）。重さが気になっても v1 では共有キャッシュを作らない（グローバル状態を入れない方針）

## リスク・不確実な点

- **無料の「予定1つ」の数え方**（D-14）: 全件で数えると、過ぎた予定を消さない限り無料の人は2つ目を組めない。課金をオンにする前にオーナーに「全件か今日以降か」を確認する（今は `BILLING_ENABLED = false` なので挙動に出ない）
- **選んだピンの見せ方**（D-13）: `'big-check'` 既定。実機で比べて決める（UI-12）
- **試作に無い追加**: 「この予定を消す」（D-15）は試作 v3 に無い。無料上限の出口として最小限で足したが、オーナーの確認が要る（見た目は Stitch / 試作で起こしていない）
- **長押しドラッグの手触り**（D-5）: 依存を足さずに PanResponder で作るので、ScrollView との取り合いで実機の調整が要る可能性がある。どうしても安定しなければ、並べ替えを「上へ / 下へ」のボタンに落とす案をオーナーに相談する（勝手に替えない）
- **受付時間のデータの量**: `spot_aggregated_info` の `reception_hours` があり、かつ `close` が `H:MM` 形式の寺社がどれだけあるかは未計測。少なければ「間に合わないかも」はほとんど出ない
- **MapLibre の fitBounds と ドロワーの高さ**: 選んだ寺社がドロワーの裏に隠れないよう、カメラの padding の下側をドロワーの高さにする必要がある（実機で確認）
