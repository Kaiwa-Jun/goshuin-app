# Issue #292: 寺社のマスタの座標のずれを直す（第1弾: Wikidata と OSM で決まった 458 件）

## 概要

寺社のマスタ（seed から入れた `spots`。`created_by_user_id IS NULL` の 1,109 件）のうち、座標がずれている **458 件**を直す。直すのは本番の `spots` と `supabase/seeds/*.sql` の両方。

- 直す値は、リポジトリに置く**台帳**（`supabase/data/spot-coords-292.json`）に書く。1行 = 1寺社で、旧座標・新座標・出どころ・確かさ・根拠を持つ
- 本番の migration・本番で流す確かめる SQL・seed の書き換えは、どれも台帳からスクリプト（`supabase/scripts/spot-coords/`、Deno）で作る。458 件を手で書かない
- 本番の migration は、1件ずつ「ちょうど1行が変わった」ことを確かめ、1件でも違えば全体を止める。2回流しても壊れない
- 残り（確かさ 中・国土地理院由来・オーナーが見るものなど 117 件）は第2弾（別の PR）。オーナーの選択の JSON を同じスクリプトで台帳に取り込めるようにしておく

背景: 2026-09-27、寺社の写真の調査で seed の座標と Wikidata の座標が大きく離れている寺社が見つかった（Issue の標本 8 件）。2026-09-27〜28 に全 1,109 件を Wikidata・国土地理院・OpenStreetMap と突き合わせ、直すものを決めた（下の「調べた結果」）。

> **2026-09-28 リーダーの判断**（オーナーは就寝中で「承認なしで進めて」と指示）: 「リーダーに決めてもらうこと」は次のとおり。① スクリプトは `supabase/scripts/spot-coords/`（Deno）でよい ② `revert` は入れる ③ `source_ref` を足す準備は実装する人が行う。AC-12 は scratchpad に頼らず、リポジトリの台帳を見る AC-11・AC-13 で代える ④ 本番で流すのはマージの後 ⑤ OSM 由来の上限 99 の検査は入れる ⑥ seed のコメントの文面は案のとおり ⑦ H-1 で `total`・`rest` だけが違うときも止める

## 関連ドキュメント

- Issue: `gh issue view 292`
- プロダクト方針: [`docs/product/direction.md`](../product/direction.md)（データの直しで、方針の変更は無い）
- 本番の migration の当て方（`db push` は使えない）と、確かめる SQL の様式: [`issue-285-growth-metrics.md`](./issue-285-growth-metrics.md)（H-2・H-3、`supabase/validation/growth_metrics_check.sql`、PGlite の `sql_test.ts`）
- マスタの寺社と利用者が足した寺社の区別（`created_by_user_id`）: [`issue-248-spot-add-research.md`](./issue-248-spot-add-research.md)
- Deno のスクリプトの前例: `supabase/scripts/judge-pending/`（#248 S6）
- seed の説明: `supabase/seeds/README.md`
- 後に続く Issue: #293（ピンのシートの帯。第2段の写真の突き合わせは #292 の後）

## 詳細設計

### いまのコードと DB（前提の確認）

| 場所                                                   | いまの状態（2026-09-28 に確かめた）                                                                                                                                                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.spots`（`20260208102535` ほか）                | `lat` / `lng` は `DOUBLE PRECISION NOT NULL`。`prefecture` は `20260402100000` で追加。`status`（active / pending / merged）。索引は `(lat, lng)` と `status`                                                                            |
| `spots` のトリガー                                     | `on_spots_updated`（BEFORE UPDATE → `public.handle_updated_at()` が `updated_at = now()`）。repo の migration にある spots のトリガーはこれだけ                                                                                          |
| `spots.updated_at` を読む所                            | 無い（`src/` と `supabase/functions/` を grep。型定義 `src/types/supabase.ts` に列があるだけ）                                                                                                                                           |
| 座標を持つテーブル                                     | `spots` だけ（migration を grep）。`stamps`・`visit_plan_stops`・`wishlists`・巡礼の札所は `spot_id` で結ぶ                                                                                                                              |
| seed（寺社の行）                                       | `supabase/seeds/` の 9 ファイル（01〜06・東京2・京都）1,019 行と `supabase/seed_miyagi_spots_and_pilgrimages.sql` の 90 行、計 **1,109 行**。1行 = 1寺社の `('名前', 緯度, 経度, 'type', '住所', '都道府県', rank, 'active'),`           |
| seed のコメント                                        | 宮城以外は、寺社の行の**すぐ次の行**に `-- 住所確認: … \| 座標: <作り方>` がある。宮城は無い。座標は宮城が小数6桁、ほかは4桁                                                                                                             |
| seed の流し方                                          | 手で流す（`supabase/config.toml` に `[db.seed]` は無い）。`supabase/seeds/README.md` の「投入手順」。寺社の行がある 10 本は、コメント・`INSERT INTO spots (…) VALUES`・寺社の行・`;` だけでできている（ほかの文は無い。grep で確かめた） |
| 本番の `spots`（オーナーの書き出し `prod-spots.json`） | `created_by_user_id IS NULL` は 1,109 行で seed と 1 対 1。名前＋都道府県の重なりは無い。座標は **1,109 件すべて seed と完全に一致**（数として同じ値）。全件 active（merged は無い）                                                     |
| 本番への migration の当て方                            | `supabase db query --linked -f <file>` → `supabase migration repair --status applied <version>`（#285 H-2 と同じ）                                                                                                                       |
| migration の最新                                       | `20260927000000_growth_metrics.sql`。この契約は `20260928000000` を使う                                                                                                                                                                  |
| `supabase/scripts/`                                    | Deno のスクリプト（`judge-pending`）。`tsconfig.json` の `exclude` と `.eslintrc.js` の `ignorePatterns` に入っていて、`npm run typecheck` / `npm run lint` の対象外                                                                     |
| PGlite（`npm:@electric-sql/pglite@0.3.16`）            | #285 で Deno 2.9.4 から動くことを確かめた。`deno test -A --node-modules-dir=none` で走らせる                                                                                                                                             |
| lint-staged                                            | `*.{js,jsx,json,md}` に `prettier --write` がかかる。**台帳の JSON はコミットのときに整形される**。`.sql` はかからない                                                                                                                   |
| リポジトリ                                             | **PUBLIC**（`gh repo view`）。台帳と seed は公開される                                                                                                                                                                                   |

### 調べた結果（材料。リポジトリの外）

置き場所: 2026-09-27〜28 の調べもの用の作業フォルダ（リポジトリの外。`coords-292/`。以下「材料」）。台帳を作ったあとは、リポジトリの台帳 `supabase/data/spot-coords-292.json` が正

| ファイル                                 | 中身                                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `summary.md` / `audit.json`              | 全 1,109 件の突き合わせ（Wikidata・国土地理院の住所検索・OSM Nominatim）。`audit.json` の `sources.wikidata.qid` と `sources.osm.osm` に、当たった項目の ID がある            |
| `spotcheck-432.md`                       | 「直す」の抜き取り検査。30 件中 誤り 0。432 件中 411 件に地理院のベクトルタイルの注記・記号という別の証人がある。誤り 1 件（idx 278 姉倉比賣神社）は `fix_corrected` に直した |
| `narrow-205.md` / `narrow-205.json`      | 「確かめる」205 件の絞り込み（決めた 161・要調査 27・オーナーが見る 17）                                                                                                      |
| `decisions-draft.json`                   | 全件の下書き（`items[]`: `idx`・`name`・`prefecture`・`file`・`line`・`prod_match`・`seed`・`decision`・`lat`・`lng`・`source`・`confidence`・`reason`）                      |
| `review-owner.html`                      | オーナーが見る 17 件の地図。「選んだ結果を JSON で書き出す」で `coords-292-review.json` を出す（第2弾の入力。形は D-11）                                                      |
| `wd_match.json` / `cache/nom/<idx>.json` | Wikidata の同名候補（`wdc*`）と Nominatim の結果（`osmc*`）。ID はここから引く                                                                                                |

### 第1弾で直す範囲（2026-09-28 に `decisions-draft.json` から数え直した）

| 区分                                                           | 件数    | 出どころ（台帳の `source`） |
| -------------------------------------------------------------- | ------- | --------------------------- |
| `decision = fix` かつ `source = wikidata`                      | 382     | wikidata                    |
| `decision = fix` かつ `source = osm`                           | 47      | osm                         |
| `decision = check_decided`・`confidence = 高`・`source = wd`   | 20      | wikidata                    |
| 同上・`source = osm`                                           | 7       | osm                         |
| 同上・`source = wdc6`（久伊豆神社・埼玉。Wikidata の同名候補） | 1       | wikidata                    |
| 同上・`source = osmc0`（若狭姫神社・福井。OSM の同名候補）     | 1       | osm                         |
| **計**                                                         | **458** | wikidata 403・osm 55        |

- ファイル別: 05 中国・四国 136、06 九州・沖縄 108、03 中部 101、04 近畿 67、02 関東 27、01 北海道・東北 15、宮城 3、京都 1
- 動く距離: 300m 未満 1（最小 180m）、300〜500m 66、500m〜1km 99、1〜5km 225、5km 以上 67（最大 78.9km、藤基神社）
- Issue の標本 8 件のうち 7 件（尊永寺・志賀海神社・金倉寺・長崎縣護國神社・倭姫宮・秋田諏訪宮・伊佐爾波神社）が入る。護国寺（那覇）は `keep` で入らない
- 抜き取り検査で「100m 程度の小さなずれの疑い」とされた 3 件（難波神社・箱崎八幡神社・沖宮）は、提案のまま入れる（記録画面の既定選択 500m には効かない）

**第2弾に回すもの（この PR では変えない）**: `check_decided` の 中（seed 以外 60 件）・`source` が国土地理院由来（`gsi` / `gsi_label` 高。12 件）・`fix_corrected`（1 件）・`check_owner`（17 件）・`check_seed_investigate`（27 件）。`check_decided` で `source = seed` の 62 件と `keep` 472 件は座標を変えない。

### 設計上の決定（この契約で確定する）

| #    | 決定                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 理由                                                                                                                                                                                                                                                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | **第1弾の選び方は純関数 `selectFirstBatch(item)` に固定する**: `decision = 'fix'` かつ `source` が `wikidata` か `osm`、または `decision = 'check_decided'` かつ `confidence = '高'` かつ `source` が `/^(wd\|osm\|wdc\d+\|osmc\d+)$/`。出どころは `wikidata`・`wd`・`wdc\d+` → `wikidata`、`osm`・`osmc\d+` → `osm` にそろえる                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | リーダーが決めた範囲をそのまま機械の規則にする。規則をテストで固定すれば、458 件の中身を人が1件ずつ見なくても、台帳が規則どおりかを確かめられる（AC-12）                                                                                                                                                                                                          |
| D-2  | **本番は migration 1本、その中は `DO` ブロック1つ**。1件ずつ、まず `name = … AND prefecture = … AND created_by_user_id IS NULL` で**ちょうど1行**に絞る（0行・2行以上なら例外）。そのあと、その行の座標で分ける: 旧座標 → 直す対象 / 新座標 → もう直っている / どちらでもない → 例外。UPDATE は旧座標も WHERE に入れ、`GET DIAGNOSTICS` で**ちょうど1行**変わったかを見て、違えば例外。例外は `DO` ブロック全体を巻き戻す                                                                                                                                                                                                                                                                                                                                                                                                                                       | `DO` は1つの文なので、途中で例外になれば、それまでの UPDATE もすべて戻る。`supabase db query` がファイルをトランザクションで包むかどうかに左右されない。座標を最初の絞りに入れないのは、2回目に「もう直っている」と「行が消えた・名前が変わった」を区別するため                                                                                                   |
| D-3  | **全体の分かれ方**: ① マスタの行（`created_by_user_id IS NULL`）が1件も無い → 何もせず終わる（空の DB）② 全件が旧座標 → 全件を直す ③ 全件が新座標 → 何もせず終わる（2回目・新しい seed を流した DB）④ それ以外（旧と新が混ざる・どちらでもない行がある・1行に絞れない）→ 例外で止まり、何も変わらない。①③では `RAISE NOTICE` を出すが、確かめには使わない（結果は確かめる SQL で見る）                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 本番で2回流しても壊れない。ローカルで `supabase db reset` のように migration が seed より先に走っても、例外で止まらない。④は「本番が台帳を作った時点から変わった」しるしなので、止めて人が見る                                                                                                                                                                    |
| D-4  | **浮動小数の比べ方**: `abs(lat - x) < 1e-6 AND abs(lng - x) < 1e-6`（度。約 0.1m）。台帳の新座標は**小数6桁に丸める**（丸めで動くのは最大 0.06m）。台帳の検査で、旧と新の距離が **10m 以上 100km 以下**であることを求める                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 本番の値は seed の文字列（小数4〜6桁）から入ったもので、`prod-spots.json` と seed は完全に一致した。等号でも合うはずだが、`1e-6` の幅を持たせても、seed の刻み（1e-4）と最小の移動（180m ≒ 1.6e-3 度）よりずっと小さい。旧座標と新座標の幅が重ならないので、「旧でも新でもある」行は起きない                                                                      |
| D-5  | **`status` は絞りに入れない**。merged の行は無い（全件 active）ことを、確かめる SQL の `inactive=0` で H-1 のときに確かめる                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 行を決めるのは名前・都道府県・作成者なし・旧座標で足りる。万一 active でない行があれば H-1 で止まる                                                                                                                                                                                                                                                               |
| D-6  | **`updated_at` のトリガーはそのまま効かせる**。`DISABLE TRIGGER` はしない。直した 458 行の `updated_at` は migration の時刻（`now()` はトランザクションの開始時刻なので、全行が同じ値）になる                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `spots.updated_at` を読む所は無い。直した時刻が痕跡として残る。トリガーを止めるにはテーブルの強いロックと持ち主の権限が要り、得るものが無い                                                                                                                                                                                                                       |
| D-7  | **RLS**: 本番の migration と確かめる SQL は、`db query --linked` の接続（テーブルの持ち主の `postgres`）で流れる前提。万一 RLS で行が見えない・変えられないときは、D-2 の「1行に絞れない」「1行変わらない」で例外になり、何も変わらない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 持ち主は RLS を通らない。#285 の H-3 で、この接続から `SET LOCAL ROLE` できることは確かめてある。見えないときに黙って 0 行で終わらない形にしておく                                                                                                                                                                                                                |
| D-8  | **seed の書き換え**: 行の特定は台帳の `seedFile` と `seedLine`。その行を読み、1番目の値が `name`、6番目が `prefecture`、2・3番目が旧座標（差 1e-9 未満）であることを照合し、2・3番目の数だけを `toFixed(6)` の新座標に替える（行のほかの文字は変えない）。すでに新座標なら何もしない。どれにも合わなければ `ファイル:行 名前` を出して止める。**すぐ次の行**が `--` で始まり `\| 座標:` を含むときだけ、`座標: ` から行末を D-12 の出典の文に替える（455 件。宮城の 3 件はコメントが無いので行を足さない）。**ファイルの行数を変えない**                                                                                                                                                                                                                                                                                                                        | 行の番号は、下書き（`decisions-draft.json`）とオーナーの書き出しがそのまま使っている。行数が変わらなければ、第2弾も同じ番号で書き換えられる。古い「座標: Wikipedia ✓」を残すと、今の値の出どころと食い違う                                                                                                                                                        |
| D-9  | **台帳** `supabase/data/spot-coords-292.json` を正とする（形は下の「台帳の形」）。1行 = 1寺社。`(name, prefecture)` と `idx` は台帳の中で重ならない。migration・確かめる SQL・seed はすべて台帳から作る**生成物**で、手で直さない。`generate --check` で、生成物とファイルが同じことを確かめられる。**生成物には日付・時刻・実行した環境の値を入れない**（同じ台帳から、いつ作っても1バイトも変わらない）                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 458 件を手で書くと、本番と seed で値が食い違う。生成物にしておけば、どちらも同じ台帳の値になる                                                                                                                                                                                                                                                                    |
| D-10 | **スクリプトは Deno で `supabase/scripts/spot-coords/` に置く**（`scripts/` の Node にはしない）。判定と文字列づくりは純関数（`coords.ts`）、ファイルの読み書きは `main.ts` の `runCli(args, io)`（依存注入）。サブコマンドは `import-draft` / `import-owner` / `generate` / `revert` の4つ（下の「スクリプト」）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | PGlite の SQL のテストが Deno（#285 の前例）。`judge-pending` と同じ置き場所で、`tsconfig` と ESLint の対象外なので Jest・型検査・Lint に巻き込まれない。`scripts/` には Jest の置き場所（`__tests__`）の前例が無く、`.mjs` を jest-expo で読むのは手間                                                                                                           |
| D-11 | **第2弾の入口**: ① オーナーの選択は `review-owner.html` の書き出し（`{ issue, exported_at, count, items: [{ idx, name, prefecture, file, line, verdict, priority, seed: {lat, lng}, choice, lat, lng, note, chosen_at }] }`）を `import-owner` で取り込む。`choice` は `seed` → 取り込まない（座標を変えない）、`wd` → `wikidata`、`osm` → `osm`、`custom` → `owner`、`gsi` → **止める**。`file` はファイル名だけなので `supabase/seeds/<file>`（宮城は `supabase/<file>`）に直す ② 下書きのまとまり（例: 確かさ 中）を丸ごと採るときは、`import-draft` にプリセットを1つ足す（第2弾の PR で） ③ 第2弾は別の版の migration（`…_spot_coords_292_batch2.sql`）にし、台帳の第1弾の行は変えない                                                                                                                                                                     | 同じ台帳・同じ生成器・同じ確かめる SQL で第2弾も回せる。国土地理院由来は出典の表示を決めていないので、取り込みの時点で止めて、契約を直す機会を作る                                                                                                                                                                                                                |
| D-12 | **ライセンスと出典**（リーダーの判断。法的な確認ではない）: ① Wikidata は CC0 1.0。義務は無いが、`ref` に Q-ID を残す ② OSM は ODbL 1.0。OSMF の「Substantial - Guideline」（2014-06-06 理事会承認）は、一回きりの抽出で **100 Features 未満**を「実質的でない」とし、**繰り返した小さな抽出は合わせて1つの大きな抽出と見る**。第1弾の OSM 由来は 55 件。第2弾の候補（OSM の 中 23 件＋同名候補 1 件）を足すと 79 件で、オーナーの選択しだいで 100 に近づく。そこで**台帳の OSM 由来は、全部の弾を合わせて 99 件まで**を検査で守る（`MAX_OSM_FEATURES = 99`）。`ref` に OSM の要素（`node/…` など）を残し、seed のコメントと台帳の `attribution` に `© OpenStreetMap contributors`（ODbL）を書く ③ 国土地理院由来は今回入れない（出典の表示の要否が未決）。台帳の `source` に `gsi` を許さない ④ `owner`（オーナーが地図を見て置いた点）は `ref` を null にする | リポジトリは PUBLIC なので、台帳と seed に入れた座標は公開の配布になる。上限を検査にしておけば、第2弾で気づかずに超えることが無い。取り込むのは、人気の寺社という自前の一覧（1,109 件）に対する補正で、ある地域の寺社を丸ごと取るものではない。アプリの地図はすでに OpenFreeMap（OSM のデータ）を帰属の表示つきで出している（`SpotDetailContent.tsx` のコメント） |
| D-13 | **確かめ方**: ① 本番は、読むだけの確かめる SQL（`supabase/validation/spot_coords_292_check.sql`。台帳の全件を持つ）を、migration の前（H-1）と後（H-3）に流す。最後に `RAISE EXCEPTION 'RESULT …'`（#285 と同じ様式）② 手元は PGlite。**本物の seed ファイル 10 本**を最小のスキーマに流し、台帳の 458 件を旧座標に戻して本番を再現し、**本物の migration ファイル**を当てて件数と座標を見る                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 本番で直した件数・残り・旧座標の行が無いことを、数だけで見られる。PGlite なら、2回流す・空の DB・1件だけ違う・同名の行が増えた、の各場合を本物の SQL で確かめられる                                                                                                                                                                                               |
| D-14 | **戻す SQL**（`revert --batch 1`）を同じ生成器で作れるようにする。旧と新を入れ替えただけの同じ形（D-2・D-3）で、**標準出力に出すだけでコミットしない**。PGlite で「直す → 戻す → 元と同じ」を確かめる                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 旧座標は台帳にあるので、作る手間はほぼ無い。本番で何か見つかったときに、手で 458 件の UPDATE を書かずに済む。使うかはリーダーの判断（「戻すとき」）                                                                                                                                                                                                               |

### 台帳の形（`supabase/data/spot-coords-292.json`）

```json
{
  "schemaVersion": 1,
  "issue": 292,
  "note": "寺社のマスタ（created_by_user_id が NULL の spots と seed）の座標の直し。old は直す前の本番と seed の値、new は直す値（小数6桁）。migration・確かめる SQL・seed の書き換えはこの台帳から supabase/scripts/spot-coords/main.ts で作る",
  "attribution": {
    "wikidata": "Wikidata（CC0 1.0）https://www.wikidata.org/",
    "osm": "© OpenStreetMap contributors（ODbL 1.0）https://www.openstreetmap.org/copyright"
  },
  "entries": [
    {
      "batch": 1,
      "idx": 391,
      "name": "尊永寺",
      "prefecture": "静岡県",
      "seedFile": "supabase/seeds/03_chubu.sql",
      "seedLine": 372,
      "old": { "lat": 34.7669, "lng": 137.8116 },
      "new": { "lat": 34.737787, "lng": 137.97723 },
      "source": "wikidata",
      "ref": "Q11555090",
      "confidence": "high",
      "basis": "前の作業者の直す提案（wikidata+osm+gsi）。今回の地理院の照合: 要注意"
    }
  ]
}
```

| キー          | 型・決まり                                                                                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `batch`       | 1 以上の整数。第1弾は 1                                                                                                                                                                              |
| `idx`         | 調べたときの番号（`decisions-draft.json` と `review-owner.html` の `idx`）。台帳の中で重ならない                                                                                                     |
| `name`        | 空でない。`$` を含まない（SQL の `$…$` の囲みと混ざらないように）                                                                                                                                    |
| `prefecture`  | `都` `道` `府` `県` のどれかで終わる                                                                                                                                                                 |
| `seedFile`    | `SEED_FILES`（「対象ファイル」の下の注。寺社の行がある seed 10 本）のどれか                                                                                                                          |
| `seedLine`    | 1 以上の整数（1 から数える）                                                                                                                                                                         |
| `old` / `new` | `lat` は 20〜46、`lng` は 122〜154。`new` は小数6桁まで。`old` と `new` の距離は 10m 以上 100km 以下（D-4）                                                                                          |
| `source`      | `wikidata` / `osm` / `owner` のどれか（`gsi` は D-12 で許さない）                                                                                                                                    |
| `ref`         | `wikidata` は `^Q\d+$`、`osm` は `^(node\|way\|relation)/\d+$`、`owner` は null。**batch 1 は全件が null でない**。`import-owner` で入る `wikidata` / `osm` は、書き出しに ID が無ければ null でよい |
| `confidence`  | `high` / `medium`。batch 1 は全件 `high`（`fix` は2つ以上の出どころがそろい、抜き取り 0/30。`check_decided` は `高` のものだけ）                                                                     |
| `basis`       | 根拠の短い文（空でない）。batch 1 は下書きの `reason` をそのまま                                                                                                                                     |

台帳全体の検査（`parseLedger`）: `(name, prefecture)` と `idx` が重ならない。`source = osm` の行が 99 件以下（D-12）。書き出すときは `(batch, seedFile, seedLine)` の順に並べ、`JSON.stringify(ledger, null, 2)` に改行1つを足す（コミットのときに prettier が整形しても、中身は変わらない。比べるときは JSON として比べる）。

### スクリプト（`supabase/scripts/spot-coords/`）

```sh
# 下書きから台帳に足す（第1弾）。--dry-run は書かずに台帳の全体を標準出力に出す
deno run -A supabase/scripts/spot-coords/main.ts import-draft <draft.json> --preset batch1 --batch 1 [--dry-run] [--root <dir>]
# オーナーの選択（review-owner.html の書き出し）から台帳に足す（第2弾）
deno run -A supabase/scripts/spot-coords/main.ts import-owner <owner.json> --batch 2 [--dry-run] [--root <dir>]
# 台帳から、その弾の migration・確かめる SQL（全弾）・seed の書き換えを作る。--check は書かずに比べ、違えば終了コード 1
deno run -A supabase/scripts/spot-coords/main.ts generate --batch 1 --version 20260928000000 [--check] [--root <dir>]
# 戻す SQL を標準出力に出す（コミットしない。D-14）
deno run -A supabase/scripts/spot-coords/main.ts revert --batch 1
```

- `--root` の既定はカレントディレクトリ（リポジトリの直下で打つ）。テストでは一時フォルダを渡す
- `import-*` は、台帳にすでにある `(name, prefecture)` か `idx` が来たら、何も書かずに止める（上書きしない）
- エラーは標準エラーに、寺社の名前・都道府県・ファイル:行を含めて出し、終了コード 1

| 関数（`coords.ts`、純関数）                           | 中身                                                                                                                                                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectFirstBatch(item)`                              | D-1                                                                                                                                                                                                                        |
| `draftItemToEntry(item, batch)`                       | 下書きの1行 → 台帳の1行。`old` は `prod_match`、`new` は `lat` / `lng` を小数6桁に丸める、`source` は D-1 のとおりそろえる、`ref` は `source_ref`（無ければ名前を出して throw）、`confidence: 'high'`、`basis` は `reason` |
| `ownerItemToEntry(item, batch)`                       | D-11 ①。`choice = 'seed'` は null を返す。`gsi` と知らない `choice` は throw。`old` は `seed`、`confidence: 'high'`、`basis` は `オーナーが選んだ（<choice>）` に `note` があれば続ける                                    |
| `resolveSeedPath(file)`                               | `03_chubu.sql` → `supabase/seeds/03_chubu.sql`、`seed_miyagi_spots_and_pilgrimages.sql` → `supabase/seed_miyagi_spots_and_pilgrimages.sql`、それ以外の名前は throw                                                         |
| `parseLedger(json)` / `mergeEntries(ledger, entries)` | 上の「台帳の形」の検査。重なり・上限は throw                                                                                                                                                                               |
| `buildMigrationSql(entries, { batch, direction })`    | 下の見本の形。`direction` は `apply`（直す）か `revert`（戻す。旧と新を入れ替える）                                                                                                                                        |
| `buildCheckSql(ledger, seedRowCount)`                 | 下の見本の形。先頭のコメントに、弾ごとの前・後の期待値を書く                                                                                                                                                               |
| `rewriteSeed(text, path, entries)`                    | D-8。`{ text, changed, already }` を返す                                                                                                                                                                                   |
| `countSeedRows(text)`                                 | 寺社の行（`('名前', 数, 数,` で始まる行）を数える。`SEED_FILES` の合計（1,109）を、確かめる SQL の `total` の期待値に使う                                                                                                  |
| `coordText(n)` / `distanceMeters(a, b)`               | `n.toFixed(6)` / ハバーサイン（地球の半径 6,371km。`src/utils/geo.ts` と同じ）                                                                                                                                             |

### migration の形（S2: `supabase/migrations/20260928000000_spot_coords_292_batch1.sql`。生成物）

形の見本。細部は実装で詰めてよいが、D-2〜D-7 と AC-7・AC-17 を満たすこと。台帳の1件は jsonb の1行（`"name":` は1行に1回）。

```sql
-- Issue #292 第1弾: 寺社のマスタ（created_by_user_id が NULL の spots）の座標を 458 件直す。
-- 生成物。手で直さない。台帳 supabase/data/spot-coords-292.json から次で作る:
--   deno run -A supabase/scripts/spot-coords/main.ts generate --batch 1 --version 20260928000000
-- 1件ずつ「名前・都道府県・作成者なし」でちょうど1行に絞り、座標で分ける。
-- 全件が旧座標なら全件を直す / 全件が新座標なら何もしない（2回目）/ それ以外は例外で全体を止める。
-- マスタの寺社が1件も無い DB（seed を入れる前）では何もしない。
DO $spot_coords_292$
DECLARE
  fixes CONSTANT jsonb := $fixes$[
{"name":"恐山菩提寺","prefecture":"青森県","old_lat":41.279,"old_lng":141.12,"new_lat":41.327256,"new_lng":141.090254},
…（458 行）
]$fixes$;
  eps CONSTANT float8 := 1e-6;
  expected CONSTANT int := 458;
  f record;
  n int;
  at_old int := 0;
  at_new int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.spots WHERE created_by_user_id IS NULL) THEN
    RAISE NOTICE 'spot_coords_292 batch1: マスタの寺社が無いので何もしない';
    RETURN;
  END IF;

  FOR f IN SELECT * FROM jsonb_to_recordset(fixes)
      AS x(name text, prefecture text, old_lat float8, old_lng float8, new_lat float8, new_lng float8)
  LOOP
    SELECT count(*) INTO n FROM public.spots s
     WHERE s.name = f.name AND s.prefecture = f.prefecture AND s.created_by_user_id IS NULL;
    IF n <> 1 THEN
      RAISE EXCEPTION 'spot_coords_292 batch1: %（%）: 名前と都道府県で % 行（1 行のはず）', f.name, f.prefecture, n;
    END IF;
    IF EXISTS (SELECT 1 FROM public.spots s
                WHERE s.name = f.name AND s.prefecture = f.prefecture AND s.created_by_user_id IS NULL
                  AND abs(s.lat - f.old_lat) < eps AND abs(s.lng - f.old_lng) < eps) THEN
      at_old := at_old + 1;
    ELSIF EXISTS (… 同じ条件で new_lat / new_lng …) THEN
      at_new := at_new + 1;
    ELSE
      RAISE EXCEPTION 'spot_coords_292 batch1: %（%）: 旧座標でも新座標でもない', f.name, f.prefecture;
    END IF;
  END LOOP;

  IF at_new = expected THEN
    RAISE NOTICE 'spot_coords_292 batch1: もう直っている（% 件）。何もしない', at_new;
    RETURN;
  END IF;
  IF at_new > 0 THEN
    RAISE EXCEPTION 'spot_coords_292 batch1: 直っている % 件と直っていない % 件が混ざっている', at_new, at_old;
  END IF;

  FOR f IN SELECT * FROM jsonb_to_recordset(fixes) AS x(…) LOOP
    UPDATE public.spots s SET lat = f.new_lat, lng = f.new_lng
     WHERE s.name = f.name AND s.prefecture = f.prefecture AND s.created_by_user_id IS NULL
       AND abs(s.lat - f.old_lat) < eps AND abs(s.lng - f.old_lng) < eps;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'spot_coords_292 batch1: %（%）: 変わったのが % 行（1 行のはず）', f.name, f.prefecture, n;
    END IF;
  END LOOP;
END
$spot_coords_292$;
```

- 数は jsonb の数の文字のまま `float8` に読む（`34.7669` の文字から作った double は、seed の INSERT で入った値と同じ）。新座標は `coordText`（`toFixed(6)`）、旧座標は `String(n)`（JavaScript の最短の表し方）で書く。どちらも seed の文字と同じ double になる
- `revert` は同じ形で、`old_*` と `new_*` を入れ替え、メッセージの `batch1` を `batch1 revert` にする

### 確かめる SQL（S2: `supabase/validation/spot_coords_292_check.sql`。生成物・読むだけ）

- 台帳の**全件（全部の弾）**を jsonb で持ち、1件ずつ数える。書き換える文（UPDATE / INSERT / DELETE）は含めない
- `RESULT` の項目

| 項目       | 意味                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| `total`    | `created_by_user_id IS NULL` の行の数（期待値は seed の寺社の行の数 = 1109） |
| `listed`   | 台帳の件数                                                                   |
| `rest`     | `total` − 1行に絞れた台帳の件数（台帳に無いマスタの寺社。直さない残り）      |
| `at_new`   | 1行に絞れて、新座標にある件数（直した件数）                                  |
| `at_old`   | 1行に絞れて、旧座標にある件数（まだ直っていない件数）                        |
| `neither`  | 1行に絞れたが、旧でも新でもない件数                                          |
| `not_one`  | 名前・都道府県・作成者なしで 0 行か 2 行以上だった件数                       |
| `inactive` | 1行に絞れて、`status` が `active` でない件数                                 |

- 先頭のコメントに、実行コマンドと、弾ごとの期待値を書く。第1弾だけの今は次の2行
  - 第1弾の前（H-1）: `RESULT total=1109 listed=458 rest=651 at_new=0 at_old=458 neither=0 not_one=0 inactive=0`
  - 第1弾の後（H-3）: `RESULT total=1109 listed=458 rest=651 at_new=458 at_old=0 neither=0 not_one=0 inactive=0`
- 第2弾で台帳が増えたら、生成器が「第 k 弾の前 / 後」を弾ごとに書く（前: `at_new` = それより前の弾の合計、`at_old` = その弾から後の合計）

### seed の書き換え（S2。D-8）

例（`supabase/seeds/03_chubu.sql` の 372〜373 行）:

```diff
-('尊永寺', 34.7669, 137.8116, 'temple', '静岡県袋井市豊沢2777', '静岡県', 4, 'active'),
--- 住所確認: ホトカミ ✓, Wikipedia ✓ | 座標: Wikipedia推定 ✓
+('尊永寺', 34.737787, 137.977230, 'temple', '静岡県袋井市豊沢2777', '静岡県', 4, 'active'),
+-- 住所確認: ホトカミ ✓, Wikipedia ✓ | 座標: Wikidata Q11555090（#292 で直した）
```

コメントの出典の文（`座標: ` から行末）:

| `source`   | 文                                                                               |
| ---------- | -------------------------------------------------------------------------------- |
| `wikidata` | `座標: Wikidata <ref>（#292 で直した）`                                          |
| `osm`      | `座標: OpenStreetMap <ref>（© OpenStreetMap contributors, ODbL・#292 で直した）` |
| `owner`    | `座標: オーナーが地図で決めた（#292 で直した）`                                  |

宮城の3件（秋保神社・陸奥国分寺・青麻神社）は、行の数だけ替わる（`38.218600` → `38.263611` のように小数6桁）。

### S2 の準備（リポジトリの外。材料のあるリーダーの環境で、S2 の最初に行う）

下書きには、採った座標の ID（Q-ID・OSM の要素）が無い。`import-draft` に渡す前に、材料の中で次を作る。

- 作るもの: `材料/decisions-draft-refs.json`（`decisions-draft.json` と同じ形で、D-1 で選ばれる 458 件に `source_ref` を足したもの）
- `source` が `wikidata` / `wd` → `audit.json` の同じ `idx` の `sources.wikidata.qid`
- `source` が `osm` → `audit.json` の同じ `idx` の `sources.osm.osm`
- `wdc6`（久伊豆神社）→ `wd_match.json` の候補のうち座標が一致する `Q11368930`
- `osmc0`（若狭姫神社）→ `cache/nom/306.json` の結果のうち座標が一致する `way/799099092`
- 照合: 足した ID の項目の座標（`audit.json` の値など）と、下書きの `lat` / `lng` の距離が 1m 未満であること。座標の文字（7桁と9桁）では比べない。1件でも合わなければ止めて、その寺社を契約書の注意事項に書く
- 2026-09-28 に契約を書くときに試した結果: 456 件は `audit.json` の ID の座標と最大 0.007m で一致、`Q11368930` は `wd_match.json` に、`way/799099092` は `cache/nom/306.json` に同じ座標であった。外れは 0 件
- 作った `decisions-draft-refs.json` は、scratchpad が消えても AC-12 を回せるように、リポジトリの外の消えない場所にも写し、そのパスを AC-12 の `M` に書き直す（写さないときは、AC-12 は AC-11・AC-13 で代える）

### アプリへの影響（画面の変更は無い）

| 所                                                                                                 | 影響                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 地図のピン（`useSpots` → `fetchAllActiveSpots`、`MapScreen` の `fetchSpotsByPrefecture`）          | 次に取り直したときから新しい位置に立つ。`useSpots` は現在地が変わるたびに取り直す。それまでは画面の state に古い位置が残る（アプリを開き直せば新しい位置）                                                                                                                                                 |
| 記録の「現在地のまわりの寺社」（`useNearbySpots` → `autoSelectSpot`）                              | 距離を新しい座標で測る。500m 以上動く 391 件は、境内にいれば既定で選ばれるようになる見込み（`AUTO_SELECT_SPOT_RADIUS_KM = 0.5`）                                                                                                                                                                           |
| よく行くエリア・まわりの寺社（`useCollectionStats` / `frequentArea`、5km）                         | 直した寺社に記録のある人は、エリアのまとまりと距離が変わりうる                                                                                                                                                                                                                                             |
| もう少し・月参り（`mouSukoshi`）・参拝の予定（`visitPlan` / `planRoute`）                          | 距離は表示のたびに座標から測るので、新しい値になる。予定の寺社の**順番**（`visit_plan_stops.position`）は保存されたままで、並べ直さない                                                                                                                                                                    |
| 探す・同名の判定（`useMapSearch` / `useSearchScreen` / `registeredSpot`）、`add-spot` の近くの寺社 | 新しい座標で比べる。利用者が「近くに見つからない」と足した寺社が、直したマスタと重なることがありうる（スコープ外）                                                                                                                                                                                         |
| #293 の帯                                                                                          | 位置を使わない。影響なし                                                                                                                                                                                                                                                                                   |
| 利用者の記録（`stamps`）・行きたい・予定・巡礼の札所                                               | `spot_id` で結ぶので変わらない                                                                                                                                                                                                                                                                             |
| 端末のキャッシュ                                                                                   | 無い。AsyncStorage にあるのは、探した履歴（`search_history`。`spotId` と名前だけ）・認証のセッション・オンボーディングと表示の設定・レビュー依頼と年報のしるし。寺社のデータを同梱していない（seed の寺社名で `src/` `assets/` を grep して 0 件）。`src/services/supabase.ts` は fetch を差し替えていない |

### 対象ファイル

| ファイル                                                                                                  | スライス | 変更                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/scripts/spot-coords/coords.ts`（新規）                                                          | S1       | 純関数（上の表）と定数 `EPS = 1e-6` / `COORD_DECIMALS = 6` / `MIN_MOVE_M = 10` / `MAX_MOVE_M = 100_000` / `MAX_OSM_FEATURES = 99` / `SEED_FILES`（寺社の行がある seed 10 本。下の注） |
| `supabase/scripts/spot-coords/main.ts`（新規）                                                            | S1       | `runCli(args, io)`（`io`: ファイルの読み書き・標準出力・標準エラー）と `if (import.meta.main)`                                                                                        |
| `supabase/scripts/spot-coords/coords_test.ts` / `main_test.ts`（新規）                                    | S1       | Deno のユニットテスト                                                                                                                                                                 |
| `supabase/scripts/spot-coords/sql_test.ts`（新規）                                                        | S1 / S2  | PGlite。S1 はフィクスチャで SQL の形を確かめる（AC-7〜AC-9）。S2 で本物の seed と migration を使うテスト（AC-16）を足す                                                               |
| `supabase/data/spot-coords-292.json`（新規）                                                              | S2       | 台帳（458 件、batch 1）                                                                                                                                                               |
| `supabase/migrations/20260928000000_spot_coords_292_batch1.sql`（新規・生成物）                           | S2       | 直す migration                                                                                                                                                                        |
| `supabase/validation/spot_coords_292_check.sql`（新規・生成物）                                           | S2       | 確かめる SQL                                                                                                                                                                          |
| `supabase/seeds/01_hokkaido_tohoku.sql` ほか 7 ファイル、`supabase/seed_miyagi_spots_and_pilgrimages.sql` | S2       | 458 行の座標と 455 行のコメント（生成物の書き換え）。01〜06・京都・宮城の 8 ファイル                                                                                                  |
| `supabase/data/README.md`（新規）                                                                         | S3       | 台帳の説明・第2弾の手順・出典（下の「docs に書くこと」）                                                                                                                              |
| `supabase/seeds/README.md`                                                                                | S3       | 「データ品質基準」の座標の行に #292 と台帳の場所を足す                                                                                                                                |

`SEED_FILES`（寺社の行がある seed。この 10 本だけを数え、書き換え、PGlite に流す）: `supabase/seeds/01_hokkaido_tohoku.sql` `02_kanto.sql` `03_chubu.sql` `04_kinki.sql` `05_chugoku_shikoku.sql` `06_kyushu_okinawa.sql` `seed_tokyo_spots.sql` `seed_tokyo_rank3_4_spots.sql` `seed_kyoto_rank_spots.sql`（ここまで `supabase/seeds/`）と `supabase/seed_miyagi_spots_and_pilgrimages.sql`。`supabase/seeds/` の `seed_reception_hours_2026-08.sql` と `seed_spot_info_sources_phase1.sql`、`supabase/seed_pilgrimages_and_spots.sql` は寺社の行を持たないので入れない。

`src/` は変えない。

### docs に書くこと（S3）

`supabase/data/README.md`:

1. 台帳が何か（マスタの座標の直しの正。migration・確かめる SQL・seed は生成物）と、各キーの意味（上の表）
2. コマンド4つ（上の「スクリプト」）と、テストの走らせ方 `deno test -A --node-modules-dir=none supabase/scripts/spot-coords/`
3. 第2弾の手順: `review-owner.html` で「選んだ結果を JSON で書き出す」→ `import-owner <書き出し> --batch 2` → `generate --batch 2 --version <新しい版>` → PR → 本番は H-1〜H-5 と同じ形（確かめる SQL の期待値は生成物の先頭のコメント）。第1弾の行は変えない。国土地理院由来を入れるときは、出典の表示を決めて契約を直してから
4. 出典: Wikidata は CC0。OSM は ODbL で、OSMF の Substantial - Guideline（100 Features 未満・繰り返しは合算）により台帳の OSM 由来は全部で 99 件まで（検査で止まる）。国土地理院由来は今回入れていない。リポジトリは公開
5. 戻すとき（`revert`）の使い方

`supabase/seeds/README.md` の「データ品質基準」の座標の行: `座標: …（2026-09 の #292 で 458 件を Wikidata / OpenStreetMap の値に直した。直した行はコメントに「#292 で直した」。値の正は supabase/data/spot-coords-292.json）` の旨を足す。

## スライス（1スライス = 1コミット、TDD）

| #   | コミット（Conventional Commits）                                               | 中身                                                                                                                                                  | 検証                                                                 |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| S1  | `feat: 寺社の座標の台帳から、直す SQL と確かめる SQL と seed の書き換えを作る` | `coords.ts` / `main.ts` / `coords_test.ts` / `main_test.ts` / `sql_test.ts`（フィクスチャ）。データはまだ入れない（AC-1〜AC-10）                      | `deno test -A --node-modules-dir=none supabase/scripts/spot-coords/` |
| S2  | `fix: 寺社のマスタの座標を 458 件直す（#292 第1弾・Wikidata と OSM）`          | 準備（リポジトリの外）→ `import-draft` → 台帳 → `generate` → migration・確かめる SQL・seed 8 本、`sql_test.ts` に本物の seed のテスト（AC-11〜AC-18） | 上の deno test + `generate --check` + grep + `git diff --numstat`    |
| S3  | `docs: 座標の台帳と第2弾の手順（#292）`                                        | `supabase/data/README.md` / `supabase/seeds/README.md`（AC-19〜AC-20）                                                                                | grep                                                                 |

各スライスの最初に、失敗するテストを書いてから（Red）通し、コミットする。S2 の台帳・migration・確かめる SQL・seed は、`import-draft` と `generate` の出力をそのままコミットする（手で直さない）。本番への反映は、push / PR のあとにオーナーが行う（下の「手順」）。

## テスト方針

- **純関数（S1。`coords_test.ts`）**: 下書き・オーナーの書き出し・台帳・seed の文字列はフィクスチャで渡す。seed のフィクスチャには、4桁の行・宮城の6桁の行・コメントのある行・無い行・VALUES の最後の行（`)` で終わり、次の行がコメント、その次が `;`）を入れる
- **CLI（S1。`main_test.ts`）**: `runCli` に一時フォルダの `--root` と、書き込みを覚える `io` を渡す。`--check` と `--dry-run` がファイルを書かないことを確かめる
- **SQL（S1。`sql_test.ts`）**: PGlite に最小のスキーマを作る（`public.spot_type` / `public.spot_status` の enum、`public.handle_updated_at()`、seed の8列 + `id` / `created_by_user_id` / `created_at` / `updated_at` の `public.spots`、`on_spots_updated` トリガー）。`buildMigrationSql` / `buildCheckSql` の出力をそのまま流す。例外は捕まえて message を見る
- **本物のデータ（S2。`sql_test.ts`）**: 同じスキーマに、seed の 10 ファイルを `Deno.readTextFile` でそのまま流す（seed の `INSERT INTO spots` は `public` を付けていないので、テーブルは `public` に置く）。台帳を読み、migration ファイルと確かめる SQL を**ファイルから**読む
- PGlite の import は `npm:@electric-sql/pglite@0.3.16` に固定し、`--node-modules-dir=none` を付けて走らせる（#285 の注意事項）
- 本番は H-1・H-3 で確かめる（オーナーの手順。PR の合否には含めない）

## 受入基準（Acceptance Criteria）

UI 基準は無い（画面の変更が無い）。本番の確かめは「手順」の H-1〜H-6 で行い、この PR の合否には含めない。

### 機能基準: スクリプト（S1）

- [ ] AC-1: `selectFirstBatch` を確かめる。次のフィクスチャで、選ばれるのが ①〜⑥ だけ（Deno test）
  - 選ばれる: ① `fix`/`wikidata` ② `fix`/`osm` ③ `check_decided`/`高`/`wd` ④ `check_decided`/`高`/`osm` ⑤ `check_decided`/`高`/`wdc6` ⑥ `check_decided`/`高`/`osmc0`
  - 選ばれない: `fix`/`gsi`、`check_decided`/`高`/`gsi_label`、`check_decided`/`高`/`seed`、`check_decided`/`中`/`wd`、`check_decided`/`中`/`osm`、`fix_corrected`/`wikidata:Q135194979`、`check_owner`/null、`check_seed_investigate`/`seed`、`keep`/`seed`
- [ ] AC-2: `draftItemToEntry` を確かめる（Deno test）
  - `wd` と `wdc6` は `source: 'wikidata'`、`osmc0` は `source: 'osm'` になる
  - `old` は `prod_match` の `lat` / `lng`、`new` は `lat: 38.2208931` → `38.220893` のように小数6桁に丸める
  - `confidence: 'high'`、`basis` は `reason`、`seedFile` / `seedLine` / `idx` は下書きの `file` / `line` / `idx`
  - `source_ref` が無い行は、その寺社の名前を含む message で throw する
- [ ] AC-3: `ownerItemToEntry` と `resolveSeedPath` を確かめる（Deno test）
  - `choice: 'seed'` は null
  - `choice: 'gsi'` は message に `地理院` を含めて throw。知らない `choice` も throw
  - `wd` → `wikidata`、`osm` → `osm`、`custom` → `owner`（`ref: null`）。`old` は書き出しの `seed`
  - `resolveSeedPath('03_chubu.sql')` は `supabase/seeds/03_chubu.sql`、`resolveSeedPath('seed_miyagi_spots_and_pilgrimages.sql')` は `supabase/seed_miyagi_spots_and_pilgrimages.sql`、`resolveSeedPath('../x.sql')` と `resolveSeedPath('seed_pilgrimages_and_spots.sql')` は throw
- [ ] AC-4: `parseLedger` / `mergeEntries` が、次のそれぞれで throw し、正しいフィクスチャは通す（Deno test）
  - `(name, prefecture)` の重なり、`idx` の重なり
  - `source: 'gsi'`、`wikidata` の `ref: 'node/1'`、`osm` の `ref: 'Q1'`、batch 1 の `ref: null`
  - `new.lat` が小数7桁、旧と新の距離が 9m、100.1km、`lat: 19.9`、`name` に `$` を含む
  - `source: 'osm'` の行が 100 件（99 件なら通る）
- [ ] AC-5: `rewriteSeed` を確かめる（Deno test）
  - 旧座標の行は、2・3番目の数だけが `toFixed(6)` の新座標に替わり、行のほかの文字は同じ
  - すぐ次の行が `-- … | 座標: Wikipedia推定 ✓` なら、`| ` より前は同じで、`座標: ` から行末が上の表の文になる（`wikidata` / `osm` / `owner` のそれぞれ）
  - コメントの無い行（宮城の形）は、その1行だけが替わる
  - 同じ入力に2回かけると、2回目は `changed: 0` で文字列が1回目と同じ（新座標の行は `already` に数える）
  - 行の名前・都道府県・座標が台帳と合わないときは、`<ファイル>:<行> <名前>` を含む message で throw
  - どの場合も、出力の行数が入力と同じ
- [ ] AC-6: `buildMigrationSql` の文字列を確かめる（Deno test）
  - `DO $spot_coords_292$` がちょうど1回
  - `"name":` の数が渡した件数と同じ
  - `created_by_user_id IS NULL` と `GET DIAGNOSTICS` を含む
  - `BEGIN;` `COMMIT;` `DISABLE TRIGGER` を含まない
  - `direction: 'revert'` では、各行の `old_lat` と `new_lat` の値が `apply` と入れ替わっている
- [ ] AC-7: PGlite で `buildMigrationSql`（apply）の動きを確かめる。フィクスチャは台帳 3 件 + 台帳に無いマスタの寺社 2 件（Deno test）
  - 全件が旧座標: 流すと 3 件が新座標になる。台帳に無い 2 件の座標と `updated_at` は変わらない。直した 3 件の `updated_at` は、前に入れておいた `2026-01-01T00:00:00Z` より後になる
  - 続けてもう1回流す: 例外にならず、座標も `updated_at` も変わらない
  - 1件だけ座標を別の値にしておく: 例外になり、message にその寺社の名前がある。ほかの 2 件も旧座標のまま
  - 台帳の1件と同じ名前・都道府県の、作成者なしの行をもう1行足す: 例外（`2 行`）で、何も変わらない
  - 同じ名前・都道府県・旧座標で `created_by_user_id` がある行（利用者が足した寺社）を足す: 例外にならず、その行は旧座標のまま
  - `spots` が空: 例外にならず、行は0のまま
  - 2 件が新座標・1 件が旧座標: 例外（`混ざっている`）で、何も変わらない
- [ ] AC-8: PGlite で `buildCheckSql` を確かめる（Deno test）
  - AC-7 のフィクスチャ（マスタ 5 行）を流す前は `RESULT total=5 listed=3 rest=2 at_new=0 at_old=3 neither=0 not_one=0 inactive=0`、流した後は `… at_new=3 at_old=0 …` の例外になる
  - 1件の `status` を `merged` にすると `inactive=1`、1件の座標を別の値にすると `neither=1`
  - 流す前と後で、`spots` の全行の座標と `updated_at` が同じ（読むだけ）
  - 出力の最後の文が `RAISE EXCEPTION 'RESULT` で始まり、`grep -inwE "update|insert|delete|truncate|drop|alter"` に当たる語を含まない
- [ ] AC-9: PGlite で、apply を流したあと `direction: 'revert'` を流すと、全行の座標が apply の前と同じに戻る。revert を2回流しても例外にならない（Deno test）
- [ ] AC-10: `runCli` を確かめる（Deno test）
  - `generate --check` は、生成物が無い・1バイト違うときは終了コード 1 で、違うファイルの名前を標準エラーに出し、ファイルを書かない。同じなら 0
  - `import-draft --dry-run` と `import-owner --dry-run` はファイルを書かない
  - 台帳にすでにある `(name, prefecture)` を `import-*` すると終了コード 1 で、台帳は変わらない

### 機能基準: 第1弾のデータ（S2）

- [ ] AC-11: 台帳 `supabase/data/spot-coords-292.json` が `parseLedger` を通り、`entries` がちょうど 458 件で、全件 `batch: 1`・`confidence: 'high'`・`ref` が null でない。`source` は `wikidata` 403 件・`osm` 55 件（Deno test）
- [ ] AC-12: 台帳が規則どおりに作られている（**リーダーの判断で AC-11・AC-13 で代える**。材料はリポジトリの外で CI から読めないため。2026-09-28 に Evaluator が `v3/` を指定して手で1回流し、差が無いことを確かめた）。次のコマンドの出力が空（差が無い）。`M` は「調べた結果」の置き場所

  ```sh
  M=<材料のフォルダ>   # 作業フォルダ（リポジトリの外）。refs の下書きは v3/ に置いた
  T=$(mktemp -d) && deno run -A supabase/scripts/spot-coords/main.ts import-draft "$M/v3/decisions-draft-refs.json" --preset batch1 --batch 1 --root "$T" --dry-run > "$T/out.json" && diff <(jq -S . "$T/out.json") <(jq -S . supabase/data/spot-coords-292.json)
  ```

- [ ] AC-13: Issue の標本と、入れないものを確かめる（Deno test。座標は台帳の `new` と 1m 未満）
  - 入る: 尊永寺（静岡県）`34.737787, 137.977230`・`Q11555090` / 志賀海神社（福岡県）`33.667891, 130.313194` / 金倉寺（香川県）`34.250097, 133.781014` / 長崎縣護國神社（長崎県）`32.777222, 129.855556` / 倭姫宮（三重県）`34.485830, 136.723060` / 秋田諏訪宮（秋田県）`39.423611, 140.542778` / 伊佐爾波神社（愛媛県）`33.850726, 132.788679` / 久伊豆神社（埼玉県）`ref: 'Q11368930'` / 若狭姫神社（福井県）`source: 'osm'`・`ref: 'way/799099092'`
  - 入らない: 護国寺（那覇）（沖縄県。keep）・姉倉比賣神社（富山県。fix_corrected）・讃岐宮香川縣護國神社（香川県。fix の gsi）・蠶養國神社（福島県。gsi_label 高）・雲昌寺（秋田県。wd 中）
- [ ] AC-14: `deno run -A supabase/scripts/spot-coords/main.ts generate --batch 1 --version 20260928000000 --check` が終了コード 0 で終わる（migration・確かめる SQL・seed 8 本が、台帳からの生成物と同じ）
- [ ] AC-15: seed の変わり方を確かめる（`git diff --numstat` と grep）
  - `git diff --numstat $(git merge-base HEAD origin/develop) -- 'supabase/seeds/*.sql' supabase/seed_miyagi_spots_and_pilgrimages.sql` に出るのは 8 ファイルで、どのファイルも足した行と消した行が同じ。合計は足した 913・消した 913（458 行 + コメント 455 行）
  - `cat supabase/seeds/*.sql supabase/seed_miyagi_spots_and_pilgrimages.sql | grep -c '#292 で直した'` が 455
  - `cat supabase/seeds/*.sql | grep -c '© OpenStreetMap contributors, ODbL'` が 55
- [ ] AC-16: PGlite で本物のデータを確かめる（Deno test）
  - seed の 10 ファイルを流すと、`created_by_user_id IS NULL` の行が 1,109
  - その状態で確かめる SQL（ファイルから）を流すと `RESULT total=1109 listed=458 rest=651 at_new=458 at_old=0 neither=0 not_one=0 inactive=0`。migration（ファイルから）を流しても例外にならず、座標は変わらない
  - 台帳の 458 件を `old` に戻す（本番の再現）と、確かめる SQL が `… at_new=0 at_old=458 …`
  - そこへ migration を流すと、確かめる SQL が `… at_new=458 at_old=0 …` になり、全 1,109 行の座標が、seed を流した直後と同じ（差 1e-9 未満）
  - もう一度 migration を流しても、例外にならず、座標は変わらない
- [ ] AC-17: migration ファイル `supabase/migrations/20260928000000_spot_coords_292_batch1.sql` を grep で確かめる
  - `DO $spot_coords_292$` が1件、`"name":` が 458 件、`created_by_user_id IS NULL` が1件以上、`RAISE EXCEPTION` が1件以上
  - 先頭のコメントに `生成物` と `main.ts generate --batch 1 --version 20260928000000` がある
  - `grep -inwE "insert|delete|truncate|drop|alter|disable"` が0件
- [ ] AC-18: 確かめる SQL `supabase/validation/spot_coords_292_check.sql` を grep で確かめる
  - 先頭のコメントに、実行コマンド `supabase db query --linked -f supabase/validation/spot_coords_292_check.sql` と、2行の期待値 `RESULT total=1109 listed=458 rest=651 at_new=0 at_old=458 neither=0 not_one=0 inactive=0` / `RESULT total=1109 listed=458 rest=651 at_new=458 at_old=0 neither=0 not_one=0 inactive=0` がある
  - `"name":` が 458 件。最後の文が `RAISE EXCEPTION 'RESULT` で始まる
  - `grep -inwE "update|insert|delete|truncate|drop|alter"` が0件、`npx` が0件

### 機能基準: docs（S3）

- [ ] AC-19: `supabase/data/README.md` があり、次の語をそれぞれ1回以上含む（grep）: `spot-coords-292.json`、`import-owner`、`import-draft`、`generate --batch 2`、`revert`、`review-owner.html`、`CC0`、`ODbL`、`© OpenStreetMap contributors`、`99`、`国土地理院`、`deno test -A --node-modules-dir=none supabase/scripts/spot-coords/`
- [ ] AC-20: `supabase/seeds/README.md` に `#292` と `supabase/data/spot-coords-292.json` がある（grep）

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`。`src/` は変えないので既存のまま通る）
- [ ] Q-2: Lint エラーが無い（`npm run lint`）
- [ ] Q-3: 型エラーが無い（`npm run typecheck`。`supabase/scripts` は対象外なので、Deno 側は Q-4〜Q-6 で見る）
- [ ] Q-4: `deno test -A --node-modules-dir=none supabase/scripts/spot-coords/` が通る
- [ ] Q-5: `deno test -A --node-modules-dir=none supabase/functions/ supabase/scripts/` が通る（既存の Deno テストを壊していない）
- [ ] Q-6: `deno check supabase/scripts/spot-coords/main.ts` がエラー無しで通る
- [ ] Q-7: Q-4・Q-5 を走らせたあと、`test -e node_modules/@electric-sql` が偽（PGlite をリポジトリの `node_modules` に入れていない）

## 手順（本番。push / PR のあと、オーナーが実行）

- 「ターミナル」は、自分のターミナルで、このブランチ（またはマージしたあとの develop）を checkout したリポジトリの直下（`supabase/` がある階層。`supabase link` 済み。#285 の H-2 と同じ場所）
- `supabase …` をそのまま打つ（`!` は付けない。npx は使わない）
- 順序: H-1 → H-2 → H-3 → H-4 → H-5 → H-6。どこかで「違ったら止める」に当たったら、その先へ進まない
- H-2 で例外になったときは、何も変わっていない（D-2）

| #   | 場所       | 打つもの・すること                                                                                                                                                                       | 正しい結果                                                                                                                                      | 違ったら止める条件                                                                                                                                                                                                                                                                                   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1 | ターミナル | `supabase db query --linked -f supabase/validation/spot_coords_292_check.sql`（直す前の確かめ。読むだけ）                                                                                | エラーで終わり、その文が `RESULT total=1109 listed=458 rest=651 at_new=0 at_old=458 neither=0 not_one=0 inactive=0`（エラーで終わるのが正しい） | 1つでも値が違う。とくに `at_new` が 0 でない（誰かがもう直した）、`neither` / `not_one` / `inactive` が 0 でない（台帳を作ったあとに本番が変わった）。`total` と `rest` だけが違うときも止めてリーダーに渡す（退会で作成者が外れた寺社が増えた可能性がある）                                         |
| H-2 | ターミナル | `supabase db query --linked -f supabase/migrations/20260928000000_spot_coords_292_batch1.sql`（直す）                                                                                    | `ERROR` を含まずに終わる（何も表示されないか、空の表）                                                                                          | `ERROR` が出る。① `spot_coords_292 batch1: <寺社>（<県>）: …` で始まるなら、データが台帳と合わない ② それ以外（大きさ・時間切れ・接続など）なら、データではなく送り方の問題（約 60KB の1文を送るのは、このプロジェクトでは初めて）。どちらも本番は何も変わっていない。出た文をそのままリーダーに渡す |
| H-3 | ターミナル | H-1 と同じコマンド（直した後の確かめ）                                                                                                                                                   | エラーで終わり、その文が `RESULT total=1109 listed=458 rest=651 at_new=458 at_old=0 neither=0 not_one=0 inactive=0`                             | 1つでも値が違う。H-4 へ進まない                                                                                                                                                                                                                                                                      |
| H-4 | ターミナル | `supabase migration repair --status applied 20260928000000`                                                                                                                              | エラーが出ずに終わる                                                                                                                            | `error` / `failed` が出る                                                                                                                                                                                                                                                                            |
| H-5 | ターミナル | `supabase migration list --linked`                                                                                                                                                       | `20260928000000` の行があり、Local と Remote の両方の列に `20260928000000` がある                                                               | Remote の列が空。H-4 をやり直す                                                                                                                                                                                                                                                                      |
| H-6 | 実機       | native-only（Maestro は使わない）。アプリを一度終了して開き直す → 地図タブ → 上の検索バーを押す →「尊永寺」と打つ → 結果の「尊永寺」を押す（地図に戻り、その寺社に寄ってピンが選ばれる） | 選ばれたピンが、静岡県袋井市豊沢の法多山（尊永寺）のあたりに立つ。直す前の位置（約 15km 西北西）ではない                                        | ピンが直す前の位置のまま。アプリを開き直しても変わらなければ、H-3 の結果と一緒にリーダーに渡す                                                                                                                                                                                                       |

H-2 をうっかり2回流しても、2回目は何もしない（D-3）。

### 戻すとき（リーダーが決めたときだけ）

| #   | 場所       | 打つもの                                                                                              | 正しい結果                                                              | 違ったら止める条件                     |
| --- | ---------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| R-1 | ターミナル | `deno run -A supabase/scripts/spot-coords/main.ts revert --batch 1 > /tmp/spot_coords_292_revert.sql` | ファイルができ、先頭の文が `DO $spot_coords_292$` を含む                | エラーが出る・ファイルが空             |
| R-2 | ターミナル | `supabase db query --linked -f /tmp/spot_coords_292_revert.sql`                                       | `ERROR` を含まずに終わる                                                | `ERROR` が出る（本番は変わっていない） |
| R-3 | ターミナル | H-1 と同じコマンド                                                                                    | H-1 と同じ `RESULT … at_new=0 at_old=458 …`                             | 1つでも値が違う                        |
| R-4 | ターミナル | `supabase migration repair --status reverted 20260928000000`                                          | エラーが出ずに終わる。そのあと、seed と台帳を戻す PR を作る（リーダー） | `error` / `failed` が出る              |

## 本番の記録（第1弾・2026-10-03、オーナーが実行）

| 手順 | 結果                                                                                          |
| ---- | --------------------------------------------------------------------------------------------- |
| H-1  | ✅ `RESULT total=1109 listed=458 rest=651 at_new=0 at_old=458 neither=0 not_one=0 inactive=0` |
| H-2  | ✅ `ERROR` なしで終わった（約 61KB の1文も `db query --linked` で送れた）                     |
| H-3  | ✅ `RESULT total=1109 listed=458 rest=651 at_new=458 at_old=0 neither=0 not_one=0 inactive=0` |
| H-4  | ✅ `Repaired migration history: [20260928000000] => applied`                                  |
| H-5  | ✅ `20260928000000` が Local と Remote の両方にある（2026-03〜08 の食い違いは前からのもの）   |
| H-6  | ✅ 実機で尊永寺のピンが袋井市豊沢に立つ（オーナーが確認）                                     |

## 第2弾（2026-10-03）

### 中身

- 入力: #301 の選ぶ画面（`supabase/scripts/spot-wikidata/main.ts serve`）の書き出し `coords-292-review.json`（リポジトリの外の作業フォルダ）。画面に出た 162 件から **46 件**（wikidata 38・osm 8）。オーナーが選んだのは 1 件（宝珠山立石寺）で、残りの 45 件は**オーナーの依頼でリーダーが選んだ**（各行の `basis` に「オーナーの依頼でリーダーが選んだ」と、一致した点とその距離が入る）
- 選び方（リーダー）: ① `suggest`（別の出どころの点が 150m 以内で一致し、seed は支えられていない）は提案のとおり。ただし #301 の申し送りの既知の誤り 2 件（龍泉寺（埼玉厄除け開運大師）・八坂神社（長崎））と、寺社の住所の点が seed の近く（403m）で 2km 先の Wikidata・OSM と食い違う大御神社（宮崎）は選ばない ② `owner` のうち、2〜4 の出どころが約 200m 先で一致し、seed の 100m 以内に点が無い 3 件（松江護國神社・平安神宮・銭洗弁財天宇賀福神社）は Wikidata の点。ほかの `owner` 82 件と `investigate` 31 件は選ばない（第3弾以降の材料）③「地図で置く」は使わない（地理院の地図を見て置くと、実質は地理院由来になる）
- 2km 以上動くもの: 菟橋神社 11km・八海山尊神社 10km（Wikidata と住所の点が同じ位置で、出どころは実質1つ）・百済寺 9km・總持寺祖院 8km・由加神社本宮 5km・縣主神社 4km・臼杵石仏 4km・大神山神社奥宮 2km
- OSM 由来は全部の弾で 55 + 8 = 63 件（上限 99）
- 変えたもの: `import-owner` が書き出しの `ref`（Q-ID・OSM の要素）を台帳に残す（形が出どころに合わなければ止める。`ref` の無い書き出しは今までどおり null）。#301 の決めてもらうこと 2 の「第2弾の PR」。seed のコメントにも ID が出る
- 生成物: `supabase/migrations/20261003000000_spot_coords_292_batch2.sql`（第1弾の migration は変えない）・確かめる SQL（弾ごとの期待値）・seed 9 本の 46 行（とコメント 45 行。宮城の 1 件はコメントが無い）

### 受入基準（第2弾）

- [ ] B-AC-1: `ownerItemToEntry` が書き出しの `ref` を残し、形が合わなければ止める（`coords_test.ts` の「第2弾」2 本）
- [ ] B-AC-2: 台帳の第2弾が 46 件（wikidata 38・osm 8）・全件 `high` で `ref` がある・OSM 由来は全部で 63 件・既知の誤りの 3 件が入っていない（`coords_test.ts`）
- [ ] B-AC-3: `generate --batch 1 --version 20260928000000 --check` と `generate --batch 2 --version 20261003000000 --check` がどちらも 0（`main_test.ts` の AC-14）
- [ ] B-AC-4: 本物の seed で、台帳の全件を old に戻す → 第1弾 → 確かめる SQL が「第2弾の前」→ 第2弾 → 「第2弾の後」・全 1,109 行が seed と同じ → 2回目は何もしない（`sql_test.ts` の AC-16）
- [ ] B-AC-5: 第1弾の migration ファイルと、台帳の第1弾の行が変わっていない（`git diff origin/develop -- supabase/migrations/20260928000000_spot_coords_292_batch1.sql` が空・第1弾の 458 行が同じ）
- [ ] B-AC-6: `basis` に URL・パス・座標・メールの形が無い（`parseLedger` の検査）

### 手順（本番・第2弾。マージのあと、オーナーが実行）

- 場所・打ち方は第1弾と同じ（`supabase link` 済みのリポジトリの直下で、develop を pull したあと。`supabase …` をそのまま打つ。`!` は付けない）
- 順序: B-1 → B-2 → B-3 → B-4 → B-5 → B-6。どこかで「違ったら止める」に当たったら、その先へ進まない

| #   | 場所       | 打つもの・すること                                                                                                  | 正しい結果                                                                                                                                       | 違ったら止める条件                                                                             |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| B-1 | ターミナル | `supabase db query --linked -f supabase/validation/spot_coords_292_check.sql`（直す前の確かめ。読むだけ）           | エラーで終わり、その文が `RESULT total=1109 listed=504 rest=605 at_new=458 at_old=46 neither=0 not_one=0 inactive=0`（エラーで終わるのが正しい） | 1つでも値が違う（`total` と `rest` だけが違うときも）。出た文をそのままリーダーに渡す          |
| B-2 | ターミナル | `supabase db query --linked -f supabase/migrations/20261003000000_spot_coords_292_batch2.sql`（直す）               | `ERROR` を含まずに終わる                                                                                                                         | `ERROR` が出る（本番は何も変わっていない）。出た文をそのままリーダーに渡す                     |
| B-3 | ターミナル | B-1 と同じコマンド（直した後の確かめ）                                                                              | エラーで終わり、その文が `RESULT total=1109 listed=504 rest=605 at_new=504 at_old=0 neither=0 not_one=0 inactive=0`                              | 1つでも値が違う。B-4 へ進まない                                                                |
| B-4 | ターミナル | `supabase migration repair --status applied 20261003000000`                                                         | エラーが出ずに終わる                                                                                                                             | `error` / `failed` が出る                                                                      |
| B-5 | ターミナル | `supabase migration list --linked`                                                                                  | `20261003000000` の行があり、Local と Remote の両方の列にある                                                                                    | Remote の列が空。B-4 をやり直す                                                                |
| B-6 | 実機       | アプリを一度終了して開き直す → 地図タブ → 上の検索バーを押す →「八海山尊神社」と打つ → 結果の「八海山尊神社」を押す | 選ばれたピンが、新潟県南魚沼市大崎（八海山の西の麓）のあたりに立つ。直す前の位置（約 10km 南）ではない                                           | ピンが直す前の位置のまま。アプリを開き直しても変わらなければ、B-3 の結果と一緒にリーダーに渡す |

- #301 のテストのうち本物の台帳を読むもの（data_test・match_test・server_test の 5 本）は、台帳が第1弾だけの前提だったので、第1弾の時点で見る形に直した
- #301 の対応表を作り直す `spot-wikidata/main.ts build` は、第2弾で seed の座標が動いたため、地理院のタイルが 6 枚足りない（`fetch all` で取り足す）。この PR では対応表を作り直さない（公開のデータ `spot-wikidata-301.json`・`spot-photos-301.json` は #301 のまま）

B-2 をうっかり2回流しても、2回目は何もしない（D-3）。戻すときは「戻すとき」の `--batch 1` を `--batch 2` に、`20260928000000` を `20261003000000` に、R-3 の期待値を B-1 のものに読み替える。

### 本番の記録（第2弾・2026-10-03。オーナーの依頼でリーダーが実行）

| 手順 | 結果                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------- |
| B-1  | ✅ `RESULT total=1109 listed=504 rest=605 at_new=458 at_old=46 neither=0 not_one=0 inactive=0` |
| B-2  | ✅ `ERROR` なしで終わった                                                                      |
| B-3  | ✅ `RESULT total=1109 listed=504 rest=605 at_new=504 at_old=0 neither=0 not_one=0 inactive=0`  |
| B-4  | ✅ `Repaired migration history: [20261003000000] => applied`                                   |
| B-5  | ✅ `20261003000000` が Local と Remote の両方にある                                            |
| B-6  | 未（実機で八海山尊神社のピンを見る。B-3 で本番の値は確かめた）                                 |

- リーダーが `supabase …` を打つと、オーナーの Mac にキーチェーンのモーダルが出る（CLI が ad-hoc 署名のため「常に許可」が効かない）。オーナーがキーチェーンアクセスで「Supabase CLI」の項目のアクセス制御を変えて止めた

## やらないこと（スコープ外）

- 第2弾の 117 件（確かさ 中 60・国土地理院由来 12・`fix_corrected` 1・オーナーが見る 17・要調査 27）。この PR では座標も台帳も変えない
- 国土地理院由来の座標の取り込みと、その出典の表示（D-12 ③）
- 住所・名前・種別・rank の直し（座標だけを直す）
- 利用者が足した寺社（`created_by_user_id` がある行）の座標
- 直したマスタと、利用者が足した同じ寺社（重複）の見つけ出しと統合（必要なら別の Issue）
- 予定の寺社の順番の並べ直し
- アプリの画面・コードの変更（`src/` は変えない）
- `supabase/validation/validate_spots.sql` の直し（中の3番の SQL は `GROUP BY` の無い `HAVING` で、このままでは Postgres でエラーになりそうだが、確かめていない。この契約では使わない）
- CI で Deno テストを走らせること（今の CI は `pr-review.yml` だけ）
- 座標の出どころを定期的に取り直す仕組み（OSMF の指針の「繰り返しの抽出」に当たるので、しない）

## 注意事項

- **migration の版**は `20260928000000`。develop の最新は `20260927000000`。ほかのブランチと重ならないか、push の前に `git fetch && git ls-tree -r --name-only origin/develop supabase/migrations | tail -3` で確かめる。変えるときは `generate --version` の値と、この契約書の H・AC の版をそろえて直す
- **生成物を手で直さない**。直すときは台帳かスクリプトを直し、`generate` をやり直す。AC-14 の `--check` が、手で直したものを見つける
- **台帳は lint-staged の prettier に整形される**。AC-12 は JSON として比べる（`jq -S`）。migration・確かめる SQL・seed の `.sql` は整形されない
- **行の番号は変えない**。S2 のあとで seed に行を足す・消す変更を入れると、第2弾の `import-owner`（書き出しの `line`）が合わなくなる。そういう変更が要るときは、台帳の `seedLine` も同じ PR で直す
- **ローカルで一部の seed だけを流した DB** では、台帳の寺社が見つからず migration が例外で止まる（D-3 ④）。本番の安全を優先した。全部の seed を流すか、新しい seed だけで作り直す（新しい seed は直した座標を持つので、migration は何もしない）
- **PGlite と本番の違い**: PGlite は Postgres 17 の WASM で、Supabase のロールや RLS の持ち主の扱いまでは同じでない。本番の接続で行が見えること・変えられることは H-1・H-3 で確かめる（D-7）
- **Deno のテストは `--node-modules-dir=none` を付けて走らせる**（#285 の注意事項と同じ理由）
- **ライセンスの判断**は、リーダーの判断で法的な確認ではない。OSMF の指針の原文は 2026-09-28 に https://wiki.osmfoundation.org/wiki/Licence/Community_Guidelines/Substantial_-_Guideline で読んだ（「Less than 100 Features」「we regard repeated small extractions as one big extraction」）
- **S2 の準備（`source_ref`）で ID が合わない寺社が出たら**、その寺社は第1弾から外して第2弾に回し、この契約書の件数（458・403・55・913・455）をすべて直す
- 同じ名前の寺社（護国寺・東京と那覇、大日寺・徳島と高知など）は、都道府県で分かれている。seed の中で `(name, prefecture)` が重ならないことは 2026-09-28 に確かめた（1,109 行）
