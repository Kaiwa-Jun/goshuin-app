# ルーティンから growth-metrics を呼ぶ手順（Issue #285）

Edge Function `growth-metrics` は、グロースの**集計した数だけ**を JSON で返す読み取り専用の関数。合言葉が合ったときだけ答える。

- 契約書: [`docs/issues/issue-285-growth-metrics.md`](../issues/issue-285-growth-metrics.md)（決定 D-1〜D-16・本番の手順 H-1〜H-6）
- 関数: `supabase/functions/growth-metrics/`（数えるのは SQL の関数 `public.growth_metrics_counts`）

## 1. 何のためか

- ルーティン D（claude.ai のクラウドで毎週動く Claude）が週1回この関数を呼び、Slack #御朱印さんぽ に週次のグロース数値を投稿する
- 本番 DB の鍵（service role）はルーティンに渡さない。鍵は関数の中だけで使い、外に出すのは集計値だけ
- 個人を特定できる値（user_id・メール・寺社名・座標・画像のパス・1人だけの内訳）は返さない

## 2. 呼び方

- `GET https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/growth-metrics`
- ヘッダー `Authorization: Bearer <合言葉>` を付ける
- **合言葉は URL のクエリに載せない**（アクセスログに残りやすい）
- GET 以外（POST・HEAD・OPTIONS など）は 405。CORS には答えない（ブラウザから呼ぶものではない）

シェルの変数 `GROWTH_METRICS_TOKEN` に合言葉が入っているときの例:

```sh
curl -sf -H "Authorization: Bearer $GROWTH_METRICS_TOKEN" https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/growth-metrics
```

## 3. 合言葉の置き場所

関数側の合言葉は Supabase secrets の `GROWTH_METRICS_TOKEN`（契約書の H-1 で作る。32 文字以上。未設定・短いときは、関数はどんなリクエストにも 401 を返す）。ルーティン側には、同じ値を次のどちらかで置く。

### 第一候補: ルーティンの API credentials

- ホスト `tvnozkpxncmnehyomoff.supabase.co` に、ヘッダー `Authorization: Bearer <合言葉>` を差し込む設定にする
- 値は Claude にも見えない。プロンプトには合言葉を書かず、URL を GET するだけでよい
- この機能で、このホストに `Authorization` ヘッダーを差し込めるかは、契約を書いた時点で確かめられていない。H-6 で確かめる

### 第二候補: ルーティンの環境変数

- API credentials が使えない・ヘッダーを選べないときは、ルーティンの環境変数 `GROWTH_METRICS_TOKEN` に入れる
- 呼ぶときは上の `curl` の例のとおり、ヘッダーに載せる
- このときは、ルーティンのプロンプトに「合言葉を出力・投稿・ログに書かない」を**必ず**入れる（下の 6 の例に入れてある）

### いまの置き場所（2026-09-27）

- ルーティン D は `goshuin-growth-weekly`（毎週月曜 9:03 JST）。実行環境は **D 専用の `goshuin-metrics`**（ネットワーク Full）で、合言葉はその環境の環境変数 `GROWTH_METRICS_TOKEN` に置いた（第二候補）
- 第一候補の API credentials は、claude.ai の「クラウド環境を追加」の画面に欄が無く、既存の環境の設定（歯車）も開けなかったため使えなかった
- 環境変数は、その環境を使える人とルーティンの Claude に見える（画面の注意書き）。見られるのは集計した数だけで、D 専用の自分だけの環境にしたので、オーナーの判断で許容した
- ストア・季節・SNS のルーティン（A〜C）は `goshuin-growth` 環境のままで、合言葉は見えない。**`goshuin-growth` には合言葉を入れない**

## 4. 返す値の意味

時刻はすべて日本時間（`Asia/Tokyo`）。週は**月曜**はじまり。月は日本時間の暦の月。配列は古い順。

| キー            | 中身                                                                                                                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | 返す形の版（いまは `1`）。キーを足す・意味を変えるときに上がる                                                                                                                                                                                                                               |
| `generatedAt`   | 数えた時刻（日本時間。例 `2026-09-28T09:00:00+09:00`）                                                                                                                                                                                                                                       |
| `timezone`      | いつも `Asia/Tokyo`                                                                                                                                                                                                                                                                          |
| `period`        | 「この7日」の `from` / `to`（日本時間の日付。どちらも含む）。**今日（呼んだ日）は含まない**。今日の 0 時より前の、まる7日。月曜の朝に呼ぶと、ちょうど前の週の月〜日になる                                                                                                                    |
| `users`         | `total`: 全利用者数。`last7Days`: この7日に登録した人数                                                                                                                                                                                                                                      |
| `activation`    | 活性化。今週の前の4週について、その週（月〜日）に登録した人（`signups`）のうち、登録から7日（168時間）以内に1件以上記録した人（`activated`）と割合（`rate`、0〜1 の小数3桁）。`windowDays` は 7                                                                                              |
| `retention`     | 継続（月次コホート）。今月の前の6か月について、その月に1件以上記録した人（`recorders`）のうち、翌月にも記録した人（`retained`）と割合（`rate`）                                                                                                                                              |
| `stamps`        | `total`: 全記録数。`last7Days`: この7日に記録した件数。`recordersLast7Days`: この7日に記録した人数。「記録した」はアプリで記録した時刻で数える（参拝日ではない）                                                                                                                             |
| `spotResearch`  | `requestsLast7Days`: この7日に「探して追加」で調べた回数（受け付けた回数。調べるのに失敗した分も含み、回数の上限で断った分は含まない）                                                                                                                                                       |
| `addedSpots`    | 利用者が足した寺社の数。`total`（全期間）と `last7Days`（この7日に足した分）を、`active`（公開中）と `pending`（確認待ち）に分ける。まとめた寺社（merged）とマスタの寺社は数えない                                                                                                           |
| `complete`      | 週・月ごとの `true` / `false`。`false` は**途中**の意味。活性化は、その週に登録した全員に7日が過ぎたら `true`（週の月曜 0 時 + 14日）。継続は、翌月が終わったら `true`。いちばん新しい週・月はふつう `false`                                                                                 |
| `minCohortSize` | 伏せる閾値（いまは `3`）。週・月の人数（`signups` / `recorders`）が 1〜2 人のときは、内訳（`activated` / `retained`）と `rate` を `null` にする（その人を知っていれば分かってしまうため）。人数そのものと全体の数（`users.total` など）は伏せない。人数が 0 のときは内訳 0・`rate` は `null` |

応答: 200 のほか、合言葉が無い・違う・関数側が未設定なら 401（`{ "error": "unauthorized" }`）、GET 以外は 405（`{ "error": "method not allowed" }`、ヘッダー `Allow: GET`）、DB の失敗は 500（`{ "error": "internal error" }`）。

## 5. 数字の注意

- 数は**呼んだ時点の DB の状態**で、出来事の台帳ではない。同じ週を後で数え直すと変わることがある
- 退会すると、その人の記録・調べた回数は消え、足した寺社は `addedSpots` から落ちる（寺社そのものは残る）
- 記録を消すと、過去の週・月の数も減る
- オーナーやテスト用のアカウントも数に入る（除いていない）
- #248 より前にアプリから足した確認待ちの寺社も `addedSpots.total.pending` に入る

## 6. ルーティン D のプロンプトの例

スケジュールは毎週**月曜** 9:00（日本時間）。

```text
御朱印アプリの先週のグロース数値を Slack の #御朱印さんぽ に投稿してください。

1. https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/growth-metrics を GET で呼ぶ。
   合言葉は Authorization: Bearer ヘッダーで送る（API credentials で差し込まれる。
   環境変数 GROWTH_METRICS_TOKEN を使う場合は、その値をヘッダーに載せる）。
   合言葉を出力・投稿・ログに書かない。URL のクエリにも載せない。
2. 返ってきた JSON から次をまとめる。
   - 期間（period.from〜period.to）
   - 利用者（users.total、うち先週の登録 users.last7Days）
   - 記録（stamps.total、先週の記録 stamps.last7Days、記録した人 stamps.recordersLast7Days）
   - 活性化（activation.weeks を週ごとに。rate はパーセントで）
   - 継続（retention.months を月ごとに）
   - 探して追加（spotResearch.requestsLast7Days、addedSpots の total と last7Days）
3. complete が false の週・月には「途中」と添える。
   null は「少人数のため非表示」と書く（数を推測して埋めない）。
4. 401・405・500 のときは数を作らず、「growth-metrics が HTTP <コード> を返した」とだけ投稿する。
```

初回は手動で1回動かし、投稿に数が出ることを見る（H-6）。

## 7. 合言葉の入れ替え

1. 契約書の H-1 をやり直す（自分のターミナルで新しい値を作り、`supabase secrets set GROWTH_METRICS_TOKEN=...` で入れる。値は画面にも履歴にも出さない）
2. ルーティン側を同じ値に替える（いまは claude.ai の環境 `goshuin-metrics` の環境変数 `GROWTH_METRICS_TOKEN`）
3. 替えるまでの間、ルーティンの呼び出しは 401 になる
4. 関数を再デプロイしたときは、毎回 401 と 405 をもう一度確かめる（H-5）

## 8. 失敗したとき

- **401**: 合言葉が違うか、関数側の `GROWTH_METRICS_TOKEN` が未設定（32 文字未満も同じ）。ルーティン側の値と Supabase secrets の値をそろえる
- **405**: GET 以外で呼んでいる
- **500**: Supabase のダッシュボードで Edge Functions → growth-metrics → Logs を見る（`[growth-metrics] failed:` の行）
  - RPC が `PGRST202`（関数が見つからない）なら、migration `20260927000000_growth_metrics.sql` が未適用（H-2）か、スキーマのキャッシュが古い（SQL で `NOTIFY pgrst, 'reload schema';`）
  - `failed: invalid counts` なら、SQL の関数が返した形が Edge Function の期待と合っていない（migration と関数の版がずれている）
- ログには決まった文（`[growth-metrics] ok` / `unauthorized` / `method not allowed` / `token not configured` / `failed: …`）だけが出る。合言葉・ヘッダー・集計した数は出ない
