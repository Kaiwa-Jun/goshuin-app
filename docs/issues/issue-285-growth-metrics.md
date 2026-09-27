# Issue #285: グロースの数字を集計だけ返す、読み取り専用の Edge Function（ルーティン用）

## 概要

Edge Function `growth-metrics`（GET）を足す。合言葉が合ったときだけ、グロースの**集計した数だけ**を JSON で返す。合言葉は Supabase secrets の `GROWTH_METRICS_TOKEN`。

使い道はルーティン D。claude.ai のルーティン（クラウドで毎週動く Claude）がこの関数を呼び、Slack #御朱印さんぽ に週次のグロース数値を投稿する。本番 DB の service role の鍵はルーティンに渡さない。鍵は関数の中だけで使い、外に出すのは集計値だけ。

- 数えるのは DB の SQL 関数 `public.growth_metrics_counts`（読み取りだけ・service role だけが呼べる。D-1 / D-2）
- 期間の区切り・割合・少人数の伏せ・返す形は、Deno の純関数で決める（D-3）
- 返すもの: 利用者・活性化（登録週ごと）・継続（月次コホート）・記録・探して追加
- 個人を特定できる値は返さない。user_id・メール・寺社名・座標・画像のパス・1人だけの内訳が該当する（D-10）

背景: 2026-09-27 のオーナー判断。マーケティング戦略にある「週次のグロース数値」のため。

## 関連ドキュメント

- Issue: `gh issue view 285`
- Edge Function の型（依存注入 + Deno テスト）: [`issue-227-r2-image-migration.md`](./issue-227-r2-image-migration.md)（`sign-stamp-upload`）/ [`issue-248-spot-add-research.md`](./issue-248-spot-add-research.md)（`add-spot` / `research-spot`、`claim_spot_research` の REVOKE / GRANT）
- migration の本番適用（`db push` は使えない）: [`issue-225-storage-insert-policy.md`](./issue-225-storage-insert-policy.md)
- 本番で確かめる SQL の様式: `supabase/validation/visit_plans_owner_only.sql`（最後に `RAISE EXCEPTION 'RESULT …'`）
- プロダクト方針: [`docs/product/direction.md`](../product/direction.md)

## 詳細設計

### いまのコードと DB（前提の確認）

| 場所                                                               | いまの状態                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/sign-stamp-upload/` ほか                       | `index.ts` は I/O だけ。判定は依存注入した関数（`signUpload.ts` など）と `*_test.ts`（Deno。`jsr:@std/assert@1`）。この形に揃える                                                                                                   |
| `supabase/config.toml`                                             | 全関数が `verify_jwt = false`（鍵が `sb_secret_...` で、ゲートウェイの JWT 検証に弾かれるため）。関数ごとにコメントを付けている                                                                                                     |
| `supabase/functions/_shared/crawl.ts:16` `isServiceRoleAuthorized` | `authHeader === \`Bearer ${key}\`` で比べている（定数時間ではない）。**今回は使わない**                                                                                                                                             |
| `auth.users`                                                       | `id` / `created_at` など。PostgREST（`admin.from()`）からは読めない（`public` スキーマだけが出ている）                                                                                                                              |
| `public.profiles`（`20260208102520`）                              | `auth.users` の INSERT トリガー `handle_new_user` が同じ文の中で作る。`created_at` は `now()`。`email` を持つ                                                                                                                       |
| `public.stamps`（`20260208102547`）                                | `user_id`（`auth.users` への FK、ON DELETE CASCADE）/ `visited_at DATE`（本人が選ぶ参拝日。過去にもできる）/ `created_at`（記録した時刻）。索引は `user_id`・`spot_id`・`visited_at`・`(user_id, visited_at)`                       |
| `public.spots`（`20260208102535` / `20260811000000`）              | `status`（enum `spot_status`: active / pending / merged）/ `created_by_user_id`（退会で SET NULL）/ `created_at`。マスタ（seeds）は `created_by_user_id` が NULL                                                                    |
| `public.spot_research_requests`（`20260925000000`）                | `research-spot` が受け付けるたびに1行（`claim_spot_research`。Claude が失敗しても数える。429 で断った分は入らない）。`user_id` は ON DELETE CASCADE。ポリシー無し（service role だけ）                                              |
| `src/services/auth.ts`                                             | サインインは Google / Apple（`signInWithIdToken`）だけ。匿名サインイン（`signInAnonymously`）は使っていない（`grep` で0件）                                                                                                         |
| ローカルの Supabase                                                | 無し（Docker が応答しない。2026-09-27）                                                                                                                                                                                             |
| PGlite（`npm:@electric-sql/pglite@0.3.16`）                        | この環境の Deno 2.9.4 で動くことを 2026-09-27 に確かめた。`AT TIME ZONE 'Asia/Tokyo'` の週・月の区切り、`SECURITY DEFINER`、REVOKE 後に `SET ROLE authenticated` で呼ぶと `permission denied`、のいずれも本物の Postgres と同じ結果 |

### 設計上の決定（この契約で確定する）

| #    | 決定                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | **集計は SQL の関数で行い、migration で足す**。関数は `public.growth_metrics_counts(...)` で、JSONB で数だけを返す。Edge Function は service role で `rpc('growth_metrics_counts', …)` を1回呼ぶだけで、`from()` でテーブルを読まない。**索引は足さない**                                                                                                                                                                                                                                                                              | 活性化・継続は、1人ずつの突き合わせ（登録 → 7日以内の記録、ある月 → 翌月）が要る。Edge Function で組むと、`user_id` と時刻の行を全件関数に持ってくることになる（PostgREST の 1,000 行の上限でページングも要る）。`auth.users` は PostgREST から読めない。DB の中で数えれば、DB の外に出るのは数だけになる。stamps は数百件の規模。週1回の呼び出しなら、索引の無い `created_at` の範囲も全件を読んで足りる（10万件を超えたら `stamps(created_at)` の索引を検討する） |
| D-2  | SQL 関数の安全: `LANGUAGE sql` / **`STABLE`** / **`SECURITY DEFINER`** / **`SET search_path = ''`**（名前はすべて `auth.` `public.` を付けて書く）。`REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` と `GRANT EXECUTE … TO service_role`（`claim_spot_research` と同じ形）。引数は時刻の境目6つだけで、返すのは件数だけ                                                                                                                                                                                                            | `STABLE` の SQL 関数には INSERT / UPDATE / DELETE を書くと Postgres がエラーにする。読み取りだけであることを DB が守る。`auth.users` を読むには DEFINER が要る。そのぶん、ログインしたユーザー（authenticated）や anon から呼べないようにし、`search_path` を空にして乗っ取りを防ぐ                                                                                                                                                                                 |
| D-3  | **役割分担**。SQL は、渡された境目の中で数えることと、日本時間の週・月のラベルを付けることだけをする。Deno の純関数（`metrics.ts`）が次を受け持つ: 境目の計算（`metricWindows(now)`）、欠けた週・月を 0 で埋める、割合、少人数の伏せ、返す形（`buildMetrics`）、SQL の戻り値の型の検査                                                                                                                                                                                                                                                 | ローカルに Supabase が無いので、判断の多い所は純関数に寄せて Deno テストで固定する。SQL は PGlite のテストで確かめ（AC-3〜AC-9）、本番では H-3 で数を突き合わせる                                                                                                                                                                                                                                                                                                   |
| D-4  | **時刻はすべて日本時間（Asia/Tokyo）**。「この7日」は**今日（日本時間）の 0 時より前の、まる7日**（`[今日0時 − 7日, 今日0時)`）。今日の分は入れない。週は**月曜はじまり**（Postgres の `date_trunc('week')` と同じ）。月は日本時間の暦の月。返す `period.from` / `period.to` は日本時間の日付で、どちらも含む                                                                                                                                                                                                                          | ルーティンを月曜の朝に動かすと、`period` がちょうど前の週の月〜日になる。呼ぶ時刻が数分ずれても数が変わらない                                                                                                                                                                                                                                                                                                                                                       |
| D-5  | **登録の時刻は `auth.users.created_at`**。`profiles.created_at` は使わない                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `profiles` はトリガーが同じ文の中で作る写しで、時刻は同じになる。一方で本番の migration の履歴はずれている（ダッシュボードで直接当てた分がある）ので、トリガーが最初からあった保証が無い。元の `auth.users` を読む。DEFINER は D-2 でどのみち要る。匿名ユーザーは作っていないので、`is_anonymous` の絞り込みはしない                                                                                                                                                |
| D-6  | **「記録した」は `stamps.created_at`（アプリで記録した時刻）で数える**。`visited_at` は使わない                                                                                                                                                                                                                                                                                                                                                                                                                                        | `visited_at` は本人が選ぶ参拝日で、何年も前の日付にも、後から変えることもできる。それで数えると、アプリを使ったかどうかの数にならず、日付を直すたびに過去の数が動く                                                                                                                                                                                                                                                                                                 |
| D-7  | **活性化**: 集団は、日本時間のある週（月〜日）に登録した人。「活性化した」は、`stamps.created_at < 登録時刻 + 168時間` の記録が1件以上ある人。対象は**今週の前の4週**（古い順）。`complete` は `now ≥ 週の月曜0時 + 14日` のとき true（その週に登録した全員に、まる7日が過ぎた）                                                                                                                                                                                                                                                       | Issue の「直近4週の登録の週ごと」。一番新しい週は7日が過ぎていない人がいるので、途中であることを `complete: false` で示す。7日は `interval '168 hours'` で書く（セッションのタイムゾーンに左右されない）                                                                                                                                                                                                                                                            |
| D-8  | **継続（月次コホート）**: 集団は、日本時間のある月 M に1件以上記録した人（`recorders`）。「継続した」は、そのうち翌月 M+1 にも1件以上記録した人（`retained`）。対象は**今月の前の6か月**（古い順）。`complete` は M+1 が終わっている（`now ≥ M+2 の1日0時`）とき true。一番新しい月（先月）の翌月は今月なので、呼んだ時点までで数え、`complete: false`                                                                                                                                                                                 | Issue の「直近6か月」をそのまま取る。途中の月は `complete` で分かる                                                                                                                                                                                                                                                                                                                                                                                                 |
| D-9  | **探して追加**: `requestsLast7Days` は、この7日に作られた `spot_research_requests` の行数（受け付けた回数。Claude の失敗も含み、429 で断った分は含まない）。`addedSpots` は `created_by_user_id IS NOT NULL` の spots を `status` の active / pending で分けた数。全期間（`total`）と、この7日に作られた分（`last7Days`）の両方を返す。`merged` は数えない                                                                                                                                                                             | 利用者が足した寺社の目印は `created_by_user_id` しか無い（seeds は NULL）。退会すると SET NULL になり数から落ちる。この点と、#248 より前にアプリから足した pending も入る点は、docs の「数字の注意」に書く                                                                                                                                                                                                                                                          |
| D-10 | **個人を特定させない**。① 返すキーは下の「返す JSON」のものだけにする（許可リスト。SQL の戻り値に余計なキーがあっても出さない）② 分けるのは時間（この7日・週・月）だけにする。地域・寺社・種別・端末・サインイン方法では分けない ③ 1人ずつの値（最大・中央値・上位・一覧）や、1件ずつの時刻は出さない ④ **週・月の集団の人数（分母）が 1〜2 人なら、その内訳（`activated` / `retained`）と `rate` を `null` にする**（`MIN_COHORT_SIZE = 3`）。分母と全体の数（`users.total` など）は伏せない。分母が 0 なら内訳は 0、`rate` は `null` | 少人数のうちも実数は返す（オーナーの方針）。ただし「その週に登録した1人が記録したか」のような1人だけの内訳は、その人を知っていれば分かってしまう。伏せる閾値は定数1つにしておき、あとで変えられるようにする                                                                                                                                                                                                                                                         |
| D-11 | **返す JSON の形**（下の「返す JSON」）: キーは camelCase。`schemaVersion: 1`。配列は古い順。`rate` は 0〜1 を小数3桁で丸める（`Math.round(x * 1000) / 1000`）。`generatedAt` は日本時間の ISO（`+09:00`、秒まで）                                                                                                                                                                                                                                                                                                                     | 既存の関数の応答（`researchId` など）と揃える。ルーティンの Claude が読み違えないように、キー名に期間を含める（`last7Days`）。項目を足すときは `schemaVersion` を上げる                                                                                                                                                                                                                                                                                             |
| D-12 | **認可の順番**: ① メソッドが GET 以外なら 405 で、ヘッダー `Allow: GET` を付ける（HEAD と OPTIONS も 405）。CORS のヘッダーは付けない ② `Authorization: Bearer <合言葉>` を定数時間で比べ、合わなければ 401 ③ 合ったときだけ `rpc` を呼ぶ。`GROWTH_METRICS_TOKEN` が未設定・空・**32 文字未満**なら、どんなリクエストにも 401 を返す（閉じる側に倒す）                                                                                                                                                                                 | 呼ぶのはルーティン（サーバー）で、ブラウザではない。401・405 の前に DB に触らない。弱い合言葉の設定ミスで開きっぱなしにならないようにする                                                                                                                                                                                                                                                                                                                           |
| D-13 | **合言葉の比べ方**: `token.ts` に自前の `tokenMatches(provided, expected)` を置く。両方を `crypto.subtle.digest('SHA-256')` で 32 バイトにし、全バイトの XOR を OR で集めてから、最後に 0 かどうかを見る（途中で抜けない）。`isServiceRoleAuthorized`（`===`）は使わない。外部の依存は足さない                                                                                                                                                                                                                                         | 長さの違いも、何文字目で違うかも、時間に出ない。Deno の標準 API だけで書ける                                                                                                                                                                                                                                                                                                                                                                                        |
| D-14 | **ログ**: 決まった文だけを出す（`[growth-metrics] ok` / `unauthorized` / `method not allowed` / `token not configured` / `failed: <rpc のエラーの code と message>`）。合言葉、`Authorization` ヘッダー、送られてきた値、集計した数は出さない。500 の応答本文は `{ "error": "internal error" }` だけにし、Postgres のメッセージは返さない                                                                                                                                                                                              | ログは Supabase のダッシュボードに残る。合言葉が漏れる経路を作らない。SQL の引数は時刻だけなので、エラーの message に個人の値は入らない                                                                                                                                                                                                                                                                                                                             |
| D-15 | **ルーティンからの呼び方**: `GET https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/growth-metrics` に、ヘッダー `Authorization: Bearer <合言葉>` を付ける。合言葉を URL のクエリには載せない。合言葉の置き場所は、第一候補がルーティンの **API credentials**（ホストごとの鍵で、Claude にも見えない）、第二候補がルーティンの**環境変数** `GROWTH_METRICS_TOKEN`。手順は `docs/project/growth-metrics-routine.md` に書く                                                                                                           | `Authorization` は、資格情報を差し込む仕組みがふつう対象にするヘッダー。`verify_jwt = false` なので、ゲートウェイはこのヘッダーを JWT として見ない。クエリ文字列はアクセスログに残りやすい。API credentials で `Authorization` を差し込めるかはここから確かめられないので、H-6 で確かめる。使えなければ環境変数にする（コードは変えない）                                                                                                                           |
| D-16 | **テスト**（どれも `deno test -A --node-modules-dir=none` で走らせる）: 純関数と認可は Deno のユニットテスト（依存注入）で確かめる。SQL は **PGlite**（`npm:@electric-sql/pglite@0.3.16`）で確かめる。テストの中で最小のスキーマ（`auth.users` / `public.stamps` / `public.spots` / `public.spot_research_requests` と、ロールの anon / authenticated / service_role）を作り、**本物の migration ファイルを読み込んで**フィクスチャで数を確かめる。最後に、`metricWindows` → SQL → `buildMetrics` を1本でつないだテストを置く          | ローカルの Supabase が無くても、JST の境目・168時間・翌月の突き合わせ・権限を機械で確かめられる。TS が作るラベルと SQL が作るラベルが一致することも、つないだテストで確かめる                                                                                                                                                                                                                                                                                       |

### データ構造（S1 の migration: `supabase/migrations/20260927000000_growth_metrics.sql`）

形の見本を示す。細部は実装で詰めてよいが、AC-1〜AC-9 を満たすこと。

```sql
-- Issue #285: グロースの数字を数える（読み取りだけ・service role だけ）。
-- 返すのは件数だけ。user_id・メール・寺社名・座標・画像のパスは返さない。
-- 境目（日本時間の 0 時など）は Edge Function の純関数が決めて渡す（D-3）
CREATE FUNCTION public.growth_metrics_counts(
  p_period_start TIMESTAMPTZ,  -- この7日の始まり（含む）
  p_period_end   TIMESTAMPTZ,  -- この7日の終わり（含まない）= 今日の 0 時（日本時間）
  p_weeks_start  TIMESTAMPTZ,  -- 活性化: いちばん古い週の月曜 0 時
  p_weeks_end    TIMESTAMPTZ,  -- 今週の月曜 0 時（含まない）
  p_months_start TIMESTAMPTZ,  -- 継続: いちばん古い月の1日 0 時
  p_months_end   TIMESTAMPTZ   -- 今月の1日 0 時（含まない）
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH signups AS (
    SELECT u.id, u.created_at,
           to_char(date_trunc('week', u.created_at AT TIME ZONE 'Asia/Tokyo'), 'YYYY-MM-DD') AS week
    FROM auth.users u
    WHERE u.created_at >= p_weeks_start AND u.created_at < p_weeks_end
  ),
  activation AS (
    SELECT s.week, count(*) AS signups,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM public.stamps st
             WHERE st.user_id = s.id AND st.created_at < s.created_at + interval '168 hours'
           )) AS activated
    FROM signups s GROUP BY s.week
  ),
  monthly AS (  -- 最後の集団の「翌月」（今月）まで要るので、上の端は切らない
    SELECT DISTINCT st.user_id, date_trunc('month', st.created_at AT TIME ZONE 'Asia/Tokyo') AS month
    FROM public.stamps st
    WHERE st.created_at >= p_months_start
  ),
  retention AS (
    SELECT to_char(a.month, 'YYYY-MM') AS month, count(*) AS recorders, count(b.user_id) AS retained
    FROM monthly a
    LEFT JOIN monthly b ON b.user_id = a.user_id AND b.month = a.month + interval '1 month'
    WHERE a.month < (p_months_end AT TIME ZONE 'Asia/Tokyo')
    GROUP BY a.month
  )
  SELECT jsonb_build_object(
    'users_total',                (SELECT count(*) FROM auth.users),
    'users_period',               (SELECT count(*) FROM auth.users WHERE created_at >= p_period_start AND created_at < p_period_end),
    'stamps_total',               (SELECT count(*) FROM public.stamps),
    'stamps_period',              (SELECT count(*) FROM public.stamps WHERE created_at >= p_period_start AND created_at < p_period_end),
    'recorders_period',           (SELECT count(DISTINCT user_id) FROM public.stamps WHERE created_at >= p_period_start AND created_at < p_period_end),
    'research_period',            (SELECT count(*) FROM public.spot_research_requests WHERE created_at >= p_period_start AND created_at < p_period_end),
    'added_spots_total_active',   (SELECT count(*) FROM public.spots WHERE created_by_user_id IS NOT NULL AND status = 'active'),
    'added_spots_total_pending',  (SELECT count(*) FROM public.spots WHERE created_by_user_id IS NOT NULL AND status = 'pending'),
    'added_spots_period_active',  (SELECT count(*) FROM public.spots WHERE created_by_user_id IS NOT NULL AND status = 'active'  AND created_at >= p_period_start AND created_at < p_period_end),
    'added_spots_period_pending', (SELECT count(*) FROM public.spots WHERE created_by_user_id IS NOT NULL AND status = 'pending' AND created_at >= p_period_start AND created_at < p_period_end),
    'activation', COALESCE((SELECT jsonb_agg(jsonb_build_object('week', week, 'signups', signups, 'activated', activated) ORDER BY week) FROM activation), '[]'::jsonb),
    'retention',  COALESCE((SELECT jsonb_agg(jsonb_build_object('month', month, 'recorders', recorders, 'retained', retained) ORDER BY month) FROM retention), '[]'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.growth_metrics_counts(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.growth_metrics_counts(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
```

SQL の戻り値（生の数。**Edge Function の中だけ**で使い、そのまま外に返さない）は、上の12個のキーだけ。`activation` / `retention` には人のいる週・月だけが入る。欠けた週・月は `buildMetrics` が 0 で埋める。

### 純関数（S2: `supabase/functions/growth-metrics/metrics.ts` / `token.ts`）

| 関数                                               | 中身                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metricWindows(now: number)`                       | D-4・D-7・D-8 の境目を返す。`period: { start, end, from, to }`（`start` / `end` は UTC の ISO で RPC に渡す。`from` / `to` は日本時間の日付で、どちらも含む）、`weeks: { start, end, labels }`（labels は4つの月曜の日付 `YYYY-MM-DD`）、`months: { start, end, labels }`（labels は6つの `YYYY-MM`）。日本時間の暦の計算は、UTC に 9 時間足した `Date` の `getUTC*` で行う（`research.ts` の `startOfTodayJstIso` と同じ考え方） |
| `toRpcParams(windows)`                             | `{ p_period_start, p_period_end, p_weeks_start, p_weeks_end, p_months_start, p_months_end }`                                                                                                                                                                                                                                                                                                                                      |
| `buildMetrics(raw: unknown, windows, now)`         | 生の数を検査する（12個のキーがあり、数が0以上の整数で、配列の要素の形が合う。合わなければ throw）。ラベルの一覧に沿って週・月を並べ、欠けは 0、一覧に無いラベルは捨てる。`rate`・`complete`・伏せ（D-10）を決め、下の形のオブジェクトを**新しく組み立てる**（raw をコピーしない）                                                                                                                                                 |
| `extractBearerToken(header)`                       | `^Bearer\s+(.+)$`（大文字小文字は問わない）。前後の空白を除いて、空なら null                                                                                                                                                                                                                                                                                                                                                      |
| `tokenMatches(provided, expected)`                 | D-13。`provided` が null・空、または `expected` が未設定・空・32 文字未満なら false                                                                                                                                                                                                                                                                                                                                               |
| `handleGrowthMetrics(deps, method, authorization)` | D-12 の順で `{ status, headers, body }` を返す。`deps: { expectedToken: string \| undefined; fetchCounts(params): Promise<unknown>; now(): number; log(level, message): void }`                                                                                                                                                                                                                                                   |

定数: `SCHEMA_VERSION = 1` / `MIN_COHORT_SIZE = 3` / `ACTIVATION_WINDOW_DAYS = 7` / `ACTIVATION_WEEKS = 4` / `RETENTION_MONTHS = 6` / `MIN_TOKEN_LENGTH = 32`

### 返す JSON（200。D-11）

例: `now` = 2026-09-28（月）09:00 JST で呼んだとき。

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-28T09:00:00+09:00",
  "timezone": "Asia/Tokyo",
  "period": { "from": "2026-09-21", "to": "2026-09-27" },
  "users": { "total": 42, "last7Days": 5 },
  "activation": {
    "windowDays": 7,
    "minCohortSize": 3,
    "weeks": [
      { "weekStart": "2026-08-31", "signups": 4, "activated": 3, "rate": 0.75, "complete": true },
      {
        "weekStart": "2026-09-07",
        "signups": 2,
        "activated": null,
        "rate": null,
        "complete": true
      },
      { "weekStart": "2026-09-14", "signups": 0, "activated": 0, "rate": null, "complete": true },
      { "weekStart": "2026-09-21", "signups": 5, "activated": 1, "rate": 0.2, "complete": false }
    ]
  },
  "retention": {
    "minCohortSize": 3,
    "months": [
      { "month": "2026-03", "recorders": 0, "retained": 0, "rate": null, "complete": true },
      { "month": "2026-04", "recorders": 0, "retained": 0, "rate": null, "complete": true },
      { "month": "2026-05", "recorders": 0, "retained": 0, "rate": null, "complete": true },
      { "month": "2026-06", "recorders": 0, "retained": 0, "rate": null, "complete": true },
      { "month": "2026-07", "recorders": 3, "retained": 2, "rate": 0.667, "complete": true },
      { "month": "2026-08", "recorders": 9, "retained": 4, "rate": 0.444, "complete": false }
    ]
  },
  "stamps": { "total": 310, "last7Days": 25, "recordersLast7Days": 7 },
  "spotResearch": { "requestsLast7Days": 4 },
  "addedSpots": {
    "total": { "active": 3, "pending": 9 },
    "last7Days": { "active": 1, "pending": 2 }
  }
}
```

応答ヘッダー: 200 は `Content-Type: application/json` と `Cache-Control: no-store`。405 は `Allow: GET`。どの応答にも `Access-Control-Allow-*` を付けない。

| 状況                                                                     | status | body                                |
| ------------------------------------------------------------------------ | ------ | ----------------------------------- |
| GET 以外（POST / PUT / PATCH / DELETE / HEAD / OPTIONS）                 | 405    | `{ "error": "method not allowed" }` |
| 合言葉が無い・違う・`Bearer ` で始まらない・関数側が未設定か 32 文字未満 | 401    | `{ "error": "unauthorized" }`       |
| RPC の失敗・生の数の形が合わない                                         | 500    | `{ "error": "internal error" }`     |
| 合言葉が合った                                                           | 200    | 上の JSON                           |

### 対象ファイル

| ファイル                                                                      | スライス | 変更                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260927000000_growth_metrics.sql`（新規）               | S1       | 上の SQL 関数と REVOKE / GRANT だけ（テーブル・索引・ポリシーは触らない）                                                                                                                                                                                |
| `supabase/functions/growth-metrics/sql_test.ts`（新規）                       | S1 / S3  | PGlite で最小のスキーマを作り、migration ファイルを読み込んで確かめる（AC-3〜AC-9）。S3 で「つないだテスト」（AC-24）を足す                                                                                                                              |
| `supabase/validation/growth_metrics_check.sql`（新規）                        | S1       | 本番で確かめる SQL（H-3）。`visit_plans_owner_only.sql` と同じ様式で、最後に `RAISE EXCEPTION 'RESULT …'`。**数そのものは出さない**（一致したか・拒まれたかだけ）                                                                                        |
| `supabase/functions/growth-metrics/metrics.ts`（新規）                        | S2 / S3  | `metricWindows` / `toRpcParams` / `buildMetrics`（S2）、`handleGrowthMetrics`（S3）                                                                                                                                                                      |
| `supabase/functions/growth-metrics/token.ts`（新規）                          | S2       | `extractBearerToken` / `tokenMatches`                                                                                                                                                                                                                    |
| `supabase/functions/growth-metrics/metrics_test.ts` / `token_test.ts`（新規） | S2 / S3  | Deno のユニットテスト                                                                                                                                                                                                                                    |
| `supabase/functions/growth-metrics/index.ts`（新規）                          | S3       | I/O だけ。`Deno.serve` → `handleGrowthMetrics`。`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` の `rpc('growth_metrics_counts', toRpcParams(...))`。読む env は `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `GROWTH_METRICS_TOKEN` の3つだけ |
| `supabase/functions/growth-metrics/deno.json`（新規）                         | S3       | 他の関数と同じ imports                                                                                                                                                                                                                                   |
| `supabase/config.toml`                                                        | S3       | `[functions.growth-metrics]` に `verify_jwt = false`。コメントには次の2点を書く: 呼び出し元はルーティンで、ユーザーではないこと。合言葉（`GROWTH_METRICS_TOKEN`）の定数時間の比べが唯一の防衛線であること                                                |
| `docs/project/growth-metrics-routine.md`（新規）                              | S4       | ルーティンから呼ぶ手順（下の「docs に書くこと」）                                                                                                                                                                                                        |
| `docs/README.md`                                                              | S4       | `project/` の一覧に `growth-metrics-routine.md` を足す                                                                                                                                                                                                   |

`src/` は変えない（アプリの変更は無い）。

### docs に書くこと（S4: `docs/project/growth-metrics-routine.md`）

1. **何のためか**: ルーティン D が週1回呼び、Slack #御朱印さんぽ に投稿する。鍵（service role）はルーティンに渡さず、返すのは集計だけ
2. **呼び方**: `GET https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/growth-metrics`、ヘッダー `Authorization: Bearer <合言葉>`。合言葉はクエリに載せない。`curl -sf -H "Authorization: Bearer $GROWTH_METRICS_TOKEN" <URL>` の例
3. **合言葉の置き場所**: 第一候補はルーティンの **API credentials**（ホスト `tvnozkpxncmnehyomoff.supabase.co` に `Authorization: Bearer <合言葉>` を差し込む。Claude にも見えない）。使えない・ヘッダーを選べないときの第二候補は、ルーティンの**環境変数** `GROWTH_METRICS_TOKEN`。そのとき、ルーティンのプロンプトに「合言葉を出力・投稿・ログに書かない」と入れる
4. **返す値の意味**: 各キー（`period` / `users` / `activation` / `retention` / `stamps` / `spotResearch` / `addedSpots`）と定義（D-4〜D-10: 日本時間、月曜はじまり、「この7日」は今日を含まない、`complete`、分母 1〜2 の `null`）
5. **数字の注意**: 数は呼んだ時点の DB の状態で、出来事の台帳ではない。退会すると、その人の記録・調べた回数は消え、足した寺社は `addedSpots` から落ちる。記録を消すと過去の週・月の数も減る。オーナーやテスト用のアカウントも数に入る（除いていない）。#248 より前にアプリから足した pending も `addedSpots.total.pending` に入る
6. **ルーティン D のプロンプトの例**: 月曜 9:00（日本時間）に動かす。上の API を呼び、`complete: false` の週・月は「途中」と添え、`null` は「少人数のため非表示」と書いて、#御朱印さんぽ に投稿する
7. **合言葉の入れ替え**: H-1 をやり直し、ルーティン側（API credentials か環境変数）を同じ値に替える。替えるまでの間、ルーティンは 401 になる
8. **失敗したとき**: 401 は合言葉が違うか未設定。500 は Supabase のダッシュボードで Edge Functions → growth-metrics → Logs を見る（`failed:` の行）。RPC が `PGRST202`（関数が見つからない）なら migration が未適用か、スキーマのキャッシュが古い（`NOTIFY pgrst, 'reload schema';`）

## スライス（1スライス = 1コミット、TDD）

| #   | コミット（Conventional Commits）                                             | 中身                                                                                                 | 検証                                                                                            |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| S1  | `feat: グロースの数字を数える SQL の関数（読み取りだけ・service role だけ）` | migration / `sql_test.ts`（PGlite。AC-1〜AC-9）/ `supabase/validation/growth_metrics_check.sql`      | `deno test -A --node-modules-dir=none supabase/functions/growth-metrics/sql_test.ts` + grep     |
| S2  | `feat: growth-metrics の期間の区切り・返す形・合言葉の比べ方`                | `metrics.ts` の `metricWindows` / `toRpcParams` / `buildMetrics`、`token.ts`、テスト（AC-10〜AC-16） | `deno test -A --node-modules-dir=none supabase/functions/growth-metrics/`                       |
| S3  | `feat: Edge Function growth-metrics（GET と合言葉のときだけ集計を返す）`     | `handleGrowthMetrics` / `index.ts` / `deno.json` / `config.toml` / つないだテスト（AC-17〜AC-27）    | `deno test -A --node-modules-dir=none supabase/functions/growth-metrics/` + `deno check` + grep |
| S4  | `docs: ルーティンから growth-metrics を呼ぶ手順`                             | `docs/project/growth-metrics-routine.md` / `docs/README.md`（AC-28〜AC-29）                          | grep                                                                                            |

各スライスの最初に、失敗するテストを書いてから（Red）通し、コミットする。本番への適用・デプロイは、push / PR のあとにオーナーが行う（下の「手順」）。

## テスト方針

- **SQL（PGlite。S1）**: テストの最初に `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TYPE public.spot_status AS ENUM ('active', 'pending', 'merged');` を実行し、使う列だけのテーブルを作る。作るのは次の4つ: `auth.users(id, created_at)`、`public.spots(id, status public.spot_status, created_by_user_id, created_at)`、`public.stamps(id, user_id, created_at)`、`public.spot_research_requests(id, user_id, created_at)`。そのあと `Deno.readTextFile` で **migration ファイルをそのまま**流す。フィクスチャの時刻は UTC の ISO で書き、日本時間の境目の直前・直後を必ず入れる。PGlite の import は `npm:@electric-sql/pglite@0.3.16` に固定する
- **純関数（S2）**: `now` を注入して、境目（日本時間の 0 時・月曜・月初め・年越し）を確かめる。生の数はオブジェクトで渡す
- **認可と応答（S3）**: `handleGrowthMetrics` に依存を注入する。`fetchCounts` の呼ばれた回数と引数、`log` に出た文を取っておいて確かめる
- **つないだテスト（S3）**: PGlite に入れたフィクスチャに対して `metricWindows(now)` → SQL → `buildMetrics` を通し、返す JSON の全体を `assertEquals` で比べる
- 本番の SQL は H-3、本番の 401 / 405 / 200 は H-5 で確かめる（オーナーの手順。PR の合否には含めない）

## 受入基準（Acceptance Criteria）

UI 基準は無い（画面の変更が無い）。本番での確かめは「手順」の H-3・H-5 で行い、この PR の合否には含めない。

### 機能基準: SQL の関数（S1）

- [ ] AC-1: `supabase/migrations/20260927000000_growth_metrics.sql` で `public.growth_metrics_counts` を定義している。引数は `TIMESTAMPTZ` 6つ、`RETURNS JSONB`。次の5つを含む（grep で各1件以上）: `LANGUAGE sql` / `STABLE` / `SECURITY DEFINER` / `SET search_path = ''` / `auth.users`
- [ ] AC-2: 同じファイルに `REVOKE EXECUTE ON FUNCTION public.growth_metrics_counts(` … `FROM PUBLIC, anon, authenticated` と `GRANT EXECUTE ON FUNCTION public.growth_metrics_counts(` … `TO service_role` がある。`grep -inwE "insert|update|delete|truncate|drop|alter|create (table|index|policy)" supabase/migrations/20260927000000_growth_metrics.sql` が0件である（コメントも含めて、これらの語を書かない）
- [ ] AC-3: PGlite に migration ファイルを流すとエラー無く通る。`SET ROLE authenticated` と `SET ROLE anon` で関数を呼ぶと `permission denied` になり、`SET ROLE service_role` では呼べる（Deno test）
- [ ] AC-4: フィクスチャで `users_total` / `users_period` / `stamps_total` / `stamps_period` / `recorders_period` を確かめる。条件は次のとおり（Deno test）
  - `users_period` と `stamps_period` は、`p_period_start` ちょうどの行を数え、1ミリ秒前の行と `p_period_end` ちょうどの行を数えない
  - `recorders_period` は、期間の中で2件記録した人を1人と数える
- [ ] AC-5: 活性化の `activated` を確かめる。登録から 167時間59分 後の記録がある人は数える。168時間 ちょうど後の記録しか無い人は数えない。週のラベルは次のとおり（Deno test）
  - 日本時間の日曜 23:59（例 `2026-09-20T14:59:00Z`）の登録は、その週の月曜 `2026-09-14`
  - 日本時間の月曜 00:00（`2026-09-20T15:00:00Z`）の登録は `2026-09-21`
- [ ] AC-6: 継続を確かめる。7月と8月に記録した人は、`2026-07` の `retained` に入る。7月と9月だけの人は入らない。`2026-07-31T15:00:00Z`（日本時間 8/1 00:00）の記録は8月として数える。`p_months_end` の月（今月）はラベルに出ないが、先月の `retained` を数えるのには使う（Deno test）
- [ ] AC-7: `added_spots_*` を確かめる。`created_by_user_id` が NULL の寺社と `merged` の寺社は数えない。active と pending を分けて数える。`_period` は `created_at` が期間の中のものだけを数える。`research_period` は期間の中の `spot_research_requests` の行数（Deno test）
- [ ] AC-8: 同じフィクスチャを `SET TimeZone = 'UTC'` と `SET TimeZone = 'America/New_York'` で呼んでも、返る JSONB が同じになる（Deno test）
- [ ] AC-9: SQL が返す JSONB の最上位のキーが、ちょうど次の12個である: `users_total` `users_period` `stamps_total` `stamps_period` `recorders_period` `research_period` `added_spots_total_active` `added_spots_total_pending` `added_spots_period_active` `added_spots_period_pending` `activation` `retention`。`activation` の要素のキーは `week` `signups` `activated`、`retention` の要素のキーは `month` `recorders` `retained` だけである（Deno test）

### 機能基準: 純関数（S2）

- [ ] AC-10: `metricWindows(Date.parse('2026-09-28T09:00:00+09:00'))` の値を確かめる（Deno test）
  - `period`: `from: '2026-09-21'`、`to: '2026-09-27'`、`start: '2026-09-20T15:00:00.000Z'`、`end: '2026-09-27T15:00:00.000Z'`
  - `weeks.labels`: `['2026-08-31','2026-09-07','2026-09-14','2026-09-21']`。`weeks.end` は `'2026-09-27T15:00:00.000Z'`
  - `months.labels`: `['2026-03','2026-04','2026-05','2026-06','2026-07','2026-08']`。`months.start` は `'2026-02-28T15:00:00.000Z'`、`months.end` は `'2026-08-31T15:00:00.000Z'`
- [ ] AC-11: 日本時間の境目を確かめる（Deno test）
  - `now` = `2026-09-27T14:59:59.999Z`（日本時間の日曜 23:59:59.999）: `period.to` は `'2026-09-26'`、`weeks.labels` の最後は `'2026-09-14'`
  - `now` = `2026-09-27T15:00:00.000Z`（日本時間の月曜 0:00）: `period.to` は `'2026-09-27'`、`weeks.labels` の最後は `'2026-09-21'`
  - `now` = `2026-09-30T15:00:00.000Z`（日本時間 10/1 0:00）: `months.labels` は `2026-04`〜`2026-09`
  - `now` = `2027-01-04T01:00:00.000Z`: `months.labels` は `2026-07`〜`2026-12`、`weeks.labels` は `['2026-12-07','2026-12-14','2026-12-21','2026-12-28']`
- [ ] AC-12: `buildMetrics` の並べ方と計算を確かめる（Deno test）
  - 生の数に無い週・月は `signups: 0, activated: 0, rate: null`（継続は `recorders: 0, retained: 0, rate: null`）で埋め、`labels` に無いラベルの要素は捨てる
  - `rate` は 2/3 で `0.667`、1/4 で `0.25`
  - `complete` は D-7 / D-8 のとおりで、AC-10 の `now` なら週は `[true,true,true,false]`、月は `[true,true,true,true,true,false]`
- [ ] AC-13: 伏せ方を確かめる。分母（`signups` / `recorders`）が 1 と 2 のときは、`activated` / `retained` と `rate` が `null` になる。分母が 3 のときは実数と割合が出る。`users.total: 1`、`stamps.recordersLast7Days: 1`、`addedSpots.last7Days.active: 1` は伏せずにそのまま出る（Deno test）
- [ ] AC-14: 返す形を確かめる（Deno test）
  - フィクスチャの生の数から作った 200 の本文を、「返す JSON」の形と `assertEquals` で比べて一致する（キーの集合と順序・値）
  - 生の数に `user_id` `email` `name` `lat` `lng` `address` `image_path` を足しても、本文は変わらない
  - `JSON.stringify(body)` に UUID の形（`/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i`）と `@` が無い
- [ ] AC-15: 生の数の形が合わないときは `buildMetrics` が throw する。対象は、キーが欠ける、負の数、小数、文字列の数、`activation` が配列でない、のそれぞれ（Deno test）
- [ ] AC-16: `tokenMatches` の判定を確かめる（Deno test）
  - 同じ 64 文字なら true
  - 先頭の1文字が違う・最後の1文字が違う・1文字長い・1文字短い・空・null なら false
  - `expected` が未設定か空、または 31 文字なら、`provided` が同じ文字列でも false
  - `token.ts` に `crypto.subtle.digest('SHA-256'` がある（grep で1件以上）
  - `grep -rn "isServiceRoleAuthorized" supabase/functions/growth-metrics/` が0件

### 機能基準: Edge Function（S3）

- [ ] AC-17: 405 を確かめる。`POST` `PUT` `PATCH` `DELETE` `HEAD` `OPTIONS` は、合言葉が正しくても 405 になり、`headers.Allow` が `'GET'` で、`fetchCounts` は呼ばれない（Deno test）
- [ ] AC-18: GET の 401 を確かめる。次のどれでも 401・`{ error: 'unauthorized' }` になり、`fetchCounts` は呼ばれない（Deno test）
  - `Authorization` が無い
  - `Bearer <違う値>`
  - `Bearer ` の無い合言葉だけ
  - `Basic <合言葉>`
  - `expectedToken` が undefined
  - `expectedToken` が 31 文字（送られてきた値が同じでも）
- [ ] AC-19: GET で合言葉が合うと 200 になる。`fetchCounts` はちょうど1回呼ばれ、引数は `toRpcParams(metricWindows(now))` と同じ。`headers` は `Content-Type: application/json` と `Cache-Control: no-store` を持ち、`Access-Control-Allow-Origin` を持たない（Deno test）
- [ ] AC-20: 500 を確かめる。`fetchCounts` が `relation "public.stamps" does not exist` で throw したときも、生の数の形が合わないときも、本文はちょうど `{ error: 'internal error' }` で、エラーの文を含まない（Deno test）
- [ ] AC-21: `log` に渡る文字列を確かめる（Deno test）
  - 200 は `[growth-metrics] ok` だけ
  - 401 は `[growth-metrics] unauthorized`。関数側が未設定か 31 文字以下のときは `[growth-metrics] token not configured`
  - 405 は `[growth-metrics] method not allowed`
  - 500 は `[growth-metrics] failed:` で始まる。生の数の形が合わないときは `[growth-metrics] failed: invalid counts`
  - どの場合も、`expectedToken` の値と送られてきた合言葉の値を含まない
- [ ] AC-22: `index.ts` の中身を grep で確かめる
  - `Deno.env.get('…')` で読む名前が、`SUPABASE_URL` `SUPABASE_SERVICE_ROLE_KEY` `GROWTH_METRICS_TOKEN` の3つだけ
  - `headers.get(` は `'Authorization'` の1か所だけ
  - `.from(` が0件、`.rpc('growth_metrics_counts'` が1件
- [ ] AC-23: `supabase/config.toml` に `[functions.growth-metrics]` と、その下の `verify_jwt = false` がある。直前のコメントに「合言葉」または `GROWTH_METRICS_TOKEN` の語がある（grep）
- [ ] AC-24: つないだテストを確かめる。PGlite のフィクスチャで `metricWindows(now)` → `growth_metrics_counts` → `buildMetrics` を通す。SQL は、`toRpcParams` の**キーをそのまま引数名にした名前付きの呼び出し**（`public.growth_metrics_counts(p_period_start => $1, …)` を `Object.keys(toRpcParams(w))` から組み立てる）で呼ぶ。その本文が、手で書いた期待値の JSON 全体と `assertEquals` で一致する。フィクスチャには、4週それぞれの登録、6か月の記録、分母 2 の週を1つ含める（Deno test）
- [ ] AC-25: `deno check supabase/functions/growth-metrics/index.ts` がエラー無しで通る
- [ ] AC-26: `supabase/validation/growth_metrics_check.sql` を grep で確かめる
  - 先頭のコメントに実行コマンド `supabase db query --linked -f supabase/validation/growth_metrics_check.sql` と期待値 `RESULT definer=yes stable=yes users=match stamps=match signups=match authenticated=denied anon=denied` がある
  - 本文に `SET LOCAL ROLE authenticated` と `SET LOCAL ROLE anon` がある
  - 最後は `RAISE EXCEPTION 'RESULT` の1文で終わる
  - `npx` を含まない
- [ ] AC-27: `supabase/functions/growth-metrics/` の中で、テスト以外のファイルに `console.log(req` と `console.log(headers` が無い（grep で0件）

### 機能基準: docs（S4）

- [ ] AC-28: `docs/project/growth-metrics-routine.md` がある。次の語をそれぞれ1回以上含む（grep）
  - `https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/growth-metrics`
  - `Authorization: Bearer`
  - `GROWTH_METRICS_TOKEN`
  - `API credentials`
  - `環境変数`
  - 返す値のキー `schemaVersion` `period` `users` `activation` `retention` `stamps` `spotResearch` `addedSpots` `complete` `minCohortSize`
  - `Asia/Tokyo`、`月曜`

  あわせて、`API credentials` の節が `環境変数` の節より前にあり、`[0-9a-f]{64}` に合う文字列が無い（実際の合言葉を書いていない）

- [ ] AC-29: `docs/README.md` のディレクトリ構成の `project/` の下に `growth-metrics-routine.md` の行がある（grep）

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`。`src/` は変えないので既存のまま通る）
- [ ] Q-2: Lint エラーが無い（`npm run lint`）
- [ ] Q-3: 型エラーが無い（`npm run typecheck`。`supabase/functions` は tsconfig の対象外なので、Deno 側は Q-4・Q-5 で見る）
- [ ] Q-4: `deno test -A --node-modules-dir=none supabase/functions/growth-metrics/` が通る
- [ ] Q-5: `deno test -A --node-modules-dir=none supabase/functions/` が通る（既存の Deno テストを壊していない。2026-09-27 の develop（e6b03c7）で 177 件が通ることを確認済み）
- [ ] Q-6: 上の Q-4・Q-5 を走らせたあと、`test -e node_modules/@electric-sql` が偽（PGlite をリポジトリの `node_modules` に入れていない。`node_modules` は gitignore なので git status では見えない）

## 手順（本番。push / PR のあと、オーナーが実行）

Supabase のコマンドは `supabase …` で渡す（npx は使わない）。**H-1 と、H-5 の後半（合言葉を使う確認）は、Claude Code の `!` ではなく自分のターミナルで行う**。合言葉を会話に残さないため。

| #   | どこで                        | 手順                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H-1 | 自分のターミナル              | 合言葉を作って secrets に入れる（下のコマンド）。値は画面にも履歴にも出さない。**このターミナルは H-5 まで閉じない**                                                                                                                                                                                                                                                                                                                                                                                         |
| H-2 | `!`                           | migration の適用（`db push` は使えない）                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| H-3 | `!`                           | 本番の SQL の確認。`RESULT definer=yes stable=yes users=match stamps=match signups=match authenticated=denied anon=denied` で終わる（エラーで終わるのが正しい）。`users=match` にならず `auth.users` の権限エラーが出たら、関数の持ち主（`postgres`）が `auth.users` を読めていない。そこが直す点。`RESULT` の前に `permission denied to set role "service_role"` で止まったら、関数ではなく接続したロールの所属の問題（既存の確認 SQL は `authenticated` への切り替えしか使っていない。実装で分かったこと） |
| H-4 | `!`                           | デプロイ。もしデプロイが `sql_test.ts`（PGlite の `npm:` の import）のせいで失敗したら、PGlite のテストを `supabase/tests/growth-metrics/` に移し、Q-4 をそのフォルダも含めて走らせる（下の注意事項）                                                                                                                                                                                                                                                                                                        |
| H-5 | `!` と自分のターミナル        | 本番での確認。`!` で 401・401・405 を見て、H-1 のターミナルで 200 とキーの一覧を見る。最後に `unset T`。**再デプロイしたら、毎回 401 と 405 をもう一度確かめる**（delete-account と同じ運用）                                                                                                                                                                                                                                                                                                                |
| H-6 | claude.ai（ルーティンの設定） | ルーティン D を作る（下の説明）                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

H-1（自分のターミナル）:

```sh
T=$(openssl rand -hex 32)
supabase secrets set GROWTH_METRICS_TOKEN="$T" --project-ref tvnozkpxncmnehyomoff
printf %s "$T" | pbcopy   # H-6 でルーティンに貼る。パスワード管理にも保存しておく
supabase secrets list --project-ref tvnozkpxncmnehyomoff   # GROWTH_METRICS_TOKEN の行がある（値ではなくダイジェストが出る）
```

H-2（`!`）:

```sh
supabase db query --linked -f supabase/migrations/20260927000000_growth_metrics.sql && supabase migration repair --status applied 20260927000000
```

H-3（`!`）:

```sh
supabase db query --linked -f supabase/validation/growth_metrics_check.sql
```

H-4（`!`）:

```sh
supabase functions deploy growth-metrics --project-ref tvnozkpxncmnehyomoff --use-api --no-verify-jwt
```

H-5 の前半（`!` で1行。`401` `401` `405` の3行が出る）:

```sh
U=https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/growth-metrics; curl -s -o /dev/null -w '%{http_code}\n' "$U"; curl -s -o /dev/null -w '%{http_code}\n' -H 'Authorization: Bearer wrong' "$U"; curl -s -o /dev/null -w '%{http_code}\n' -X POST "$U"
```

H-5 の後半（H-1 のターミナルで。1行目は `200`。2行目はキーの一覧だけを出し、値は出さない。`user_id` `email` `name` `lat` `lng` の語が無いこと）:

```sh
U=https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/growth-metrics
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $T" "$U"
curl -s -H "Authorization: Bearer $T" "$U" | jq -c '[paths(scalars) | map(tostring) | join(".")]'
unset T
```

H-6（claude.ai のルーティンの設定）:

- 合言葉は、第一候補としてルーティンの API credentials に入れる（ホスト `tvnozkpxncmnehyomoff.supabase.co`、ヘッダー `Authorization: Bearer <H-1 の値>`）
- その機能でこのホストに `Authorization` を差し込めないときは、ルーティンの環境変数 `GROWTH_METRICS_TOKEN` に入れる
- スケジュールは毎週月曜 9:00（日本時間）。Slack #御朱印さんぽ に投稿できるようにする
- プロンプトは `docs/project/growth-metrics-routine.md` の例を使う
- 初回は手動で1回動かし、投稿に数が出ることを見る

順序: H-1 → H-2 → H-3 → H-4 → H-5 → H-6。secrets を先に入れるので、デプロイした時点から合言葉が効く。secrets が入る前にデプロイしても、D-12 のとおり 401 を返す（開きっぱなしにはならない）。

## 本番の記録（2026-09-27、オーナーが実行）

| 手順 | 結果                                                                                                                                                                                                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1  | ✅ secrets に `GROWTH_METRICS_TOKEN` が入った（`secrets list` に行がある）                                                                                                                                                                                                                                                         |
| H-2  | ✅ 1回目はターミナルで `!` を付けて打ったため、zsh が結果を反転し、`migration repair` が走らなかった。H-3 で関数ができていることを見てから、`migration repair --status applied 20260927000000` だけを打ち直した                                                                                                                    |
| H-3  | ✅ `RESULT definer=yes stable=yes users=match stamps=match signups=match authenticated=denied anon=denied`。接続ロールは service_role に切り替えられ、関数の持ち主は `auth.users` を読めた                                                                                                                                         |
| H-4  | ✅ 送られたのは `deno.json` `index.ts` `metrics.ts` `token.ts` の4つだけ（`*_test.ts` は入らない）。テストを移す必要は無かった                                                                                                                                                                                                     |
| H-5  | ✅ 合言葉なし 401・違う合言葉 401・POST 405。合言葉ありで 200、キーの一覧に `user_id` `email` `name` `lat` `lng` は無い                                                                                                                                                                                                            |
| H-6  | ✅ ルーティン `goshuin-growth-weekly`（毎週月曜 9:03 JST）。API credentials の欄が画面に無かったので、D 専用の環境 `goshuin-metrics` の環境変数に置いた（オーナー判断。`docs/project/growth-metrics-routine.md` の 3）。手動の実行で Slack #御朱印さんぽ に数が出た。合言葉を入れる前の1回は 401 を投稿して止まった（D-12 どおり） |

## やらないこと（スコープ外）

- 年報・課金の数（スイッチが切れている。足すときは `schemaVersion` を上げる）
- 個人単位のデータの書き出し（user_id・メール・寺社名・座標・画像のパス・1人ずつの値）
- 地域・寺社・種別・端末・サインイン方法ごとの内訳
- 日ごとの内訳（週・月・この7日だけ）
- 前の週との差（ルーティンが前回の投稿と比べるのは自由。関数は今の数だけを返す）
- オーナー・テスト用アカウントを数から除くこと（目印が無い。要るなら別の Issue）
- 書き込み（テーブル・索引・ポリシーの追加や変更。この関数は数えるだけ）
- ルーティン D そのものの作成と Slack の設定（H-6 のオーナー作業。docs に手順だけを書く）
- `_shared/crawl.ts` の `isServiceRoleAuthorized` を定数時間に直すこと（気づいたことは注意事項に残す）
- CI で Deno テストを走らせること（今の CI は `pr-review.yml` だけ）

## 注意事項

- **`verify_jwt = true` にしない**。このプロジェクトの鍵は `sb_secret_...` なので、ゲートウェイが弾く（`config.toml` 冒頭のコメント）。そのぶん、合言葉の比べが唯一の防衛線になる
- **PGlite と本番の違い**: PGlite は Postgres 17 を WASM にしたもので、Supabase のロールや `auth` スキーマの権限までは同じでない。関数の持ち主（`postgres`）が `auth.users` を読めることは、本番の H-3（`users=match`）で確かめる
- **Deno のテストは必ず `--node-modules-dir=none` を付けて走らせる**（2026-09-27 に確かめた）。リポジトリの直下に `package.json` があるので、付けないと Deno は `npm:` の import を `node_modules/` から探し、`Could not find a matching package for 'npm:@electric-sql/pglite@0.3.16'` で落ちる。関数のフォルダの `deno.json` に `"nodeModulesDir": "none"` を書いても効かなかった。`--node-modules-dir=none` を付けると Deno のキャッシュから読み、`node_modules/` は変わらない。既存の Deno テストもこの付け方で通る。初回はパッケージ（約 10MB）を npm から取ってくる
- 本番の DB のタイムゾーンは UTC の想定。ただし SQL は `AT TIME ZONE 'Asia/Tokyo'` と `interval '168 hours'` だけに頼る。セッションのタイムゾーンに左右されないことは AC-8 で確かめる
- RPC は名前付きの引数で呼ぶので、`toRpcParams` のキーと SQL の引数名がずれると本番で `PGRST202` になる。AC-24 は `toRpcParams` のキーから名前付きの呼び出しを組み立てるので、ずれはテストで落ちる
- migration の版は `20260927000000`。develop の最新は `20260926000000`。ほかのブランチと重ならないか、push の前に `git fetch && git ls-tree -r --name-only origin/develop supabase/migrations | tail -3` で確かめる
- `_shared/crawl.ts` の `isServiceRoleAuthorized` は `===` で比べている（`crawl-spot-sources` が使う）。時間差から鍵を当てる攻撃は、ネットワーク越しでは現実的でない。今回は触らない（必要なら別の Issue）
- **デプロイとテストのファイル**: `supabase functions deploy --use-api` がフォルダの中の `sql_test.ts`（`npm:` と WASM）まで取り込むかは確かめていない。既存の関数の `*_test.ts`（`jsr:` だけ）は同じフォルダのままデプロイできている。H-4 で失敗したら、PGlite のテスト（`sql_test.ts`）だけを `supabase/tests/growth-metrics/` に移す。移したら、Q-4 はそのフォルダも走らせる
- ルーティンの API credentials の仕様は、この契約を書いた時点で確かめられていない（D-15）。H-6 で使えなかったら環境変数にする。そのとき、ルーティンのプロンプトに合言葉を出力しない指示を必ず入れる
