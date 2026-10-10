# supabase/data

## spot-coords-292.json（寺社のマスタの座標の台帳）

寺社のマスタ（`created_by_user_id` が NULL の `spots` と、seed の寺社の行）の座標の直しの**正**。Issue #292 で作った。

- 1行 = 1寺社。旧座標（直す前の本番と seed の値）・新座標・出どころ・確かさ・根拠を持つ
- 本番の migration・本番で流す確かめる SQL・seed の書き換えは、どれもこの台帳から `supabase/scripts/spot-coords/main.ts` で作る**生成物**。手で直さない（直すときは台帳かスクリプトを直して `generate` をやり直す）
- 生成物には日付・時刻・環境の値を入れない。同じ台帳から、いつ作っても1バイトも変わらない
- 契約書: [`docs/issues/issue-292-spot-coords.md`](../../docs/issues/issue-292-spot-coords.md)

いまの中身: 第1弾（`batch: 1`）の 458 件（Wikidata 403・OpenStreetMap 55）。migration は `supabase/migrations/20260928000000_spot_coords_292_batch1.sql`、確かめる SQL は `supabase/validation/spot_coords_292_check.sql`。

### キー

| キー          | 決まり                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `batch`       | 1 以上の整数（第何弾か）。第1弾は 1                                                                                                          |
| `idx`         | 調べたときの番号（下書き `decisions-draft.json` と `review-owner.html` の `idx`）。台帳の中で重ならない                                      |
| `name`        | 寺社の名前。空でない・`$` を含まない                                                                                                         |
| `prefecture`  | 都道府県（`都` `道` `府` `県` で終わる）。`(name, prefecture)` は台帳の中で重ならない                                                        |
| `seedFile`    | 寺社の行がある seed 10 本のどれか（`coords.ts` の `SEED_FILES`）                                                                             |
| `seedLine`    | seed の行の番号（1 から数える）                                                                                                              |
| `old` / `new` | `{ lat, lng }`。lat は 20〜46、lng は 122〜154。`new` は小数6桁まで。旧と新の距離は 10m 以上 100km 以下                                      |
| `source`      | `wikidata` / `osm` / `owner`（オーナーが地図で置いた点）。国土地理院由来（`gsi`）は入れられない                                              |
| `ref`         | `wikidata` は `Q…`、`osm` は `node/…` `way/…` `relation/…`、`owner` は null。第1弾は全件にある。オーナーの書き出しから入れた行は null でよい |
| `confidence`  | `high` / `medium`。第1弾は全件 `high`                                                                                                        |
| `basis`       | 根拠の短い文。第1弾は下書きの `reason` をそのまま                                                                                            |

台帳は `(batch, seedFile, seedLine)` の順に並べて書く。コミットのときに prettier が整形しても中身は同じ（比べるときは JSON として比べる）。

## コマンド

リポジトリの直下で打つ（`--root` の既定はカレントディレクトリ）。エラーは標準エラーに、寺社の名前・都道府県・ファイル:行を含めて出し、終了コード 1。

```sh
# 下書きから台帳に足す（第1弾）。--dry-run は書かずに台帳の全体を標準出力に出す
deno run -A supabase/scripts/spot-coords/main.ts import-draft <draft.json> --preset batch1 --batch 1 [--dry-run]
# オーナーの選択（review-owner.html の書き出し）から台帳に足す（第2弾）
deno run -A supabase/scripts/spot-coords/main.ts import-owner <owner.json> --batch 2 [--dry-run]
# 台帳から、その弾の migration・確かめる SQL（全弾）・seed の書き換えを作る。--check は書かずに比べ、違えば終了コード 1
deno run -A supabase/scripts/spot-coords/main.ts generate --batch 1 --version 20260928000000 [--check]
# 戻す SQL を標準出力に出す（コミットしない）
deno run -A supabase/scripts/spot-coords/main.ts revert --batch 1
```

- `import-draft` / `import-owner` は、台帳にすでにある `(name, prefecture)` か `idx` が来たら、何も書かずに止まる（上書きしない）
- `generate` は seed の行の名前・都道府県・旧座標を台帳と照らし、合わなければ止まる。seed で変えるのは座標の数2つと、すぐ次のコメントの「座標: 」から行末だけ。行数は変えない

テスト（PGlite で本物の seed と migration を流すものを含む）:

```sh
deno test -A --node-modules-dir=none supabase/scripts/spot-coords/
```

`--node-modules-dir=none` が要る（無いとルートの `package.json` 経由で `npm:` の解決に失敗する）。

## 第2弾の手順

第1弾で直さなかったもの（確かさ 中・オーナーが見るもの・要調査など）は、同じ台帳・同じスクリプトで、別の PR・別の版の migration にする。**第1弾の行は変えない。**

1. オーナーが見るもの: `deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts serve` の画面（`http://127.0.0.1:8301/`。下の「spot-wikidata-301.json」）で選び、「選んだ結果を書き出す」で `~/goshuin-work/spot-wikidata/review/coords-292-review.json` を出す。`deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts check-export ~/goshuin-work/spot-wikidata/review/coords-292-review.json` が終了コード 0 で終わることを確かめる
2. `deno run -A supabase/scripts/spot-coords/main.ts import-owner ~/goshuin-work/spot-wikidata/review/coords-292-review.json --batch 2 --dry-run` で中身を見て、よければ `--dry-run` を外して台帳に足す
   - `choice` が `seed` の行は入れない（座標を変えない）。`wd` → `wikidata`、`osm` → `osm`、`custom` → `owner`
   - `gsi`（国土地理院）を選んだ行があると止まる（下の「出典」）。画面には地理院の点を選ぶボタンが無い
   - 書き出しには `ref`（Q-ID・OSM の要素）と `verdict` もあるが、今の `import-owner` は読まない（`ref` は null で台帳に入る）。読むようにするのは第2弾の PR
3. 下書き（`decisions-draft.json`）は 2026-10-03 には消えていた（scratchpad に置いていたため）。第2弾は 1 の画面で選ぶ。下書きのまとまりを丸ごと採る `import-draft --preset` は第1弾のためのもの
4. `deno run -A supabase/scripts/spot-coords/main.ts generate --batch 2 --version <新しい版>` で `supabase/migrations/<版>_spot_coords_292_batch2.sql` を作り、確かめる SQL と seed を作り直す。`generate --batch 2 --version <版> --check` が 0 で終わることを確かめる
5. PR → マージのあと、本番は第1弾と同じ形（契約書の H-1〜H-5）: 確かめる SQL → migration → 確かめる SQL → `migration repair`。確かめる SQL の期待値は、生成物の先頭のコメントの「第2弾の前 / 後」の行

注意:

- seed に行を足す・消す変更を入れると、`seedLine` と書き出しの `line` が合わなくなる。そういう変更が要るときは、台帳の `seedLine` も同じ PR で直す
- 一部の seed だけを流したローカルの DB では、台帳の寺社が見つからず migration が例外で止まる（本番の安全を優先）。全部の seed を流すか、新しい seed だけで作り直す（新しい seed は直した座標を持つので migration は何もしない）

## 出典

リポジトリは公開なので、台帳と seed に入れた座標は公開の配布になる。

- **Wikidata**: CC0 1.0。義務は無いが、`ref` に Q-ID を残している
- **OpenStreetMap**: © OpenStreetMap contributors（ODbL 1.0）。`ref` に OSM の要素を残し、seed のコメントと台帳の `attribution` に出典を書いている。OSMF の「Substantial - Guideline」は、一回きりの抽出で 100 Features 未満を「実質的でない」とし、繰り返した小さな抽出は合わせて1つの大きな抽出と見る。そこで台帳の OSM 由来は**全部の弾を合わせて 99 件まで**とし、`parseLedger` の検査で止める（`MAX_OSM_FEATURES = 99`）。第1弾で 55 件使っている
- **国土地理院**: 出典の表示の要否を決めていないので、今回は入れていない（台帳の `source` に `gsi` を許さない）。入れるときは、出典の表示を決めて契約を直してから、スクリプトを直す
- これはリーダーの判断で、法的な確認ではない

## 戻すとき（revert）

リーダーが決めたときだけ。戻す SQL は `generate` と同じ形（1件ずつちょうど1行、2回流しても壊れない）で、旧と新を入れ替えたもの。**コミットしない。**

```sh
deno run -A supabase/scripts/spot-coords/main.ts revert --batch 1 > /tmp/spot_coords_292_revert.sql
supabase db query --linked -f /tmp/spot_coords_292_revert.sql
supabase db query --linked -f supabase/validation/spot_coords_292_check.sql   # 第1弾の前と同じ RESULT になる
supabase migration repair --status reverted 20260928000000
```

そのあと、seed と台帳を戻す PR を作る。

## spot-wikidata-301.json（寺社と Wikidata の対応表）・spot-photos-301.json（写真の候補）

寺社のマスタ（seed の 1,109 件）を Wikidata の項目に結びつけた**対応表**と、Wikimedia Commons の**写真の候補**。Issue #301 で作った。#292 第2弾の座標と、#302（帯の写真）の土台。

- どちらも `supabase/scripts/spot-wikidata/main.ts build` で作る**生成物**。手で直さない。`build` はキャッシュと seed と台帳だけから作り、ネットに出ない。同じキャッシュからは、いつ作っても同じ中身
- 入れるのは、seed の名前・都道府県と、Wikidata（CC0）の値（Q-ID・ラベル・P625・P18 のファイル名・P373）、Commons のファイルの情報（大きさ・ライセンス・撮影者とクレジットの表示・元のページ）、確かさと根拠の短い文だけ。**OpenStreetMap（ODbL）と国土地理院の座標は入れない**（作業フォルダの画面のデータだけに置く）。根拠の文には距離だけを書き、座標・URL・パスは書かない
- `idx` は seed の行の番号（`SEED_FILES` の順に寺社の行を数えた 1 から）。台帳 `spot-coords-292.json` の `idx` と同じ
- 契約書: [`docs/issues/issue-301-spot-wikidata.md`](../../docs/issues/issue-301-spot-wikidata.md)

### いまの中身（2026-10-03 に取ったキャッシュから）

| 項目                       | 数                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 取った日                   | 2026-10-03                                                                                                             |
| 対応表                     | 1,109 件: `high` 869（台帳 403・規則 466）・`medium` 48・`low` 7・`none` 185                                           |
| 写真の候補                 | 868 寺社・898 ファイル（`high` か `medium` で P18 がある寺社）                                                         |
| Commons に無かったファイル | 0                                                                                                                      |
| 第2弾の分け方（`counts`）  | `suggest` 46・`owner` 85・`investigate` 31・`keep` 489（台帳に無い 651 件）                                            |
| 画面に出る件数             | 162（`suggest` → `owner` → `investigate`）。OSM の点を持つ行は 57、OSM の提案は 8                                      |
| 取るのにかかった時間       | 約 53 分（`fetch all`。途中で止めて打ち直した分を含む）・呼び出し約 9,100 回                                           |
| 取った数                   | WDQS 8 回・検索 812・項目 8,438 + P131 の先 1,737・地理院の住所 706・タイル 7,182・Nominatim 142・Commons 895 ファイル |

- Wikidata は編集されるので、キャッシュを消して取り直すと結果が変わりうる（`build --check` が違いを見つける）
- `none` 185 件の内訳: 名前の合う項目が無い 110・名前は合うが括弧・距離・都道府県で外れた 44・強い候補が2件以上 13・支えの無い同名が2件以上 9・名前の一部だけ合う 4・同じ Q-ID を別の行が選んだ 4・seed の近くに同名が2件以上 1
- 台帳の第1弾で、2行（甲斐國一宮浅間神社・浅間神社（一宮）。山梨県）が同じ Q-ID（`Q11557476`）を持つ。人が確かめた台帳の行どうしに限って、対応表の Q-ID の重なりを許している（`parseMapping`）
- 分かっている取り違え: 龍泉寺（埼玉厄除け開運大師）（埼玉県）が川口市の龍泉寺（`Q134735558`。seed から約 26km）に `high` で結びついている。八坂神社（長崎）（長崎県）は新上五島町の八坂神社（`Q11390704`。約 71km）に `medium`。どちらも画面では「提案あり」に出るが、提案は採らない

### 対応表のキー

| キー                  | 決まり                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------- |
| `idx`                 | seed の行の番号。1〜1109 が1回ずつ、この順                                             |
| `name` / `prefecture` | seed の値そのまま                                                                      |
| `qid`                 | `Q…` か null。null ⇔ `confidence: none`。重ならない（台帳の第1弾の行どうしは除く）     |
| `label`               | Wikidata の日本語のラベルか null                                                       |
| `p625`                | Wikidata の座標（小数6桁）か null。**正しい位置とは限らない**（座標の正は台帳と seed） |
| `p18` / `p373`        | 写真のファイル名（`File:` を付けない。`preferred` が先）・Commons のカテゴリ           |
| `confidence`          | `high` / `medium` / `low` / `none`                                                     |
| `method`              | `ledger`（台帳の第1弾の Q-ID をそのまま）/ `rule`（契約書 D-5 の規則）                 |
| `candidates`          | 名前が合ったが選ばなかった Q-ID（Q の数の昇順）                                        |
| `basis`               | 根拠の短い文（例: `同名 3 件。名前の（富山市舟倉）が住所に合う。…`）                   |

写真の候補は、寺社ごとに `qid`・`linkConfidence`（対応表の確かさ）と、ファイルごとの `width`・`height`・`mime`・`sha1`・`url`・`descriptionUrl`・`license`・`licenseUrl`・`artist`・`artistHtml`・`credit`・`creditHtml`・`attributionRequired`・`copyrighted`・`restrictions`・`usageTerms` を持つ。採るか・`focus_y`・承認は持たない（#302 で決める）。`artist`・`credit` は Commons で公開の表示で、写真を使うときに出す。クレジットの文に Commons の版の日時が入っているファイルがある（Commons の表示のまま）。

### 作業フォルダ `~/goshuin-work/spot-wikidata`

リポジトリの外。ホームの下なので macOS の定期処理で消えない。`--work` で変えられる。

- `cache/`: API の生の応答（`wdqs/`・`wd-search/`・`wd-entity/`・`gsi-addr/`・`gsi-tile/16/<x>/<y>.pbf`・`nominatim/`・`commons/`）。200 と 404 だけを残し、429・5xx・時間切れは残さない。2026-10-03 の時点で約 440MB
- `review/review-data.json`: 画面のデータ（地理院と OSM の点を含む。公開しない）
- `review/choices.json`: 画面で選んだ途中（選ぶたびに保存）
- `review/coords-292-review.json`: 書き出し（前のものは `coords-292-review.prev.json`）

### コマンド

リポジトリの直下で打つ。`--node-modules-dir=none` が要る（`npm:` のタイルの読み方を、リポジトリの `node_modules` に入れずに読む）。

```sh
# 取る（途中から再開できる。SPOT_WIKIDATA_CONTACT が要る）
SPOT_WIKIDATA_CONTACT=<連絡先> deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts fetch all [--limit <n>]
#   段ごと: fetch wikidata / fetch gsi / fetch osm / fetch commons
# 段ごとの 要る数・取った数・残り
deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts status
# 対応表と写真の候補を作る。--check は書かずに JSON として比べ、違えば終了コード 1
deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts build [--check]
# 画面のデータを作業フォルダに作る
deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts review-data
# 画面を開く（127.0.0.1 だけ。既定のポートは 8301）
deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts serve [--port 8301]
# 書き出しを確かめる（import-owner に渡す前）
deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts check-export ~/goshuin-work/spot-wikidata/review/coords-292-review.json
```

- `SPOT_WIKIDATA_CONTACT`: Wikimedia と Nominatim の User-Agent（`goshuin-spot-wikidata/1 (<連絡先>)`）に入れる連絡先（公開のリポジトリの URL など）。**既定の値は無い**（無ければ何も取らずに終了コード 1）。流すときだけ環境変数で渡し、コミットしない。キャッシュにも結果にも書かない
- 間隔: Nominatim 1,100ms・地理院の住所 1,000ms・地理院のタイル 200ms・WDQS 1,000ms。Wikimedia の API は1度に1つで `maxlag=5`。429・503 は `Retry-After`（無ければ 60 秒、長くても 300 秒）待って取り直し、3回続けてだめなら、それまでの分を残して終了コード 1（同じコマンドを打ち直せば続きから）
- 取りすぎない: 検索・住所・タイルは台帳の第1弾の Wikidata 403 件を除く 706 件だけ。Nominatim は第2弾の分け方で OSM 抜きで `owner` か `investigate` になった行だけ

テスト（ネットに出ない。公開の2ファイルの形・件数・標本は `data_test.ts` がキャッシュ無しで見る）:

```sh
deno test -A --node-modules-dir=none supabase/scripts/spot-wikidata/
```

### 画面（#292 第2弾の座標を選ぶ）

`serve` の画面は、左に寺社の一覧（提案あり / 食い違い / 手がかりなし）、右に地理院の地図（標準地図と写真を切り替える。右下に「出典: 国土地理院」）。点の色は 灰 = 今の位置（seed）・青 = Wikidata・緑 = OSM・橙 = 地理院の注記と記号・紫 = 地理院の住所・赤 = 地図で置いた点。選べるのは「提案のとおり」「今のまま」「Wikidata の点」「OSM の点」「地図で置く」で、地理院の点は見るだけ（出典の表示が未決）。

- 選ぶたびにサーバーが、それまでに選んだもの全部と合わせて確かめ（seed から 10m〜100km・日本の範囲・台帳に無い寺社・OSM 由来は台帳 55 + 選んだ数で 99 まで・メモは 200 文字までで、メールの形を含まない）、だめなら赤い文字で理由を出して保存しない
- メモは第2弾で台帳の `basis`（公開）に入る。人の名前・メールは書かない
- MapLibre GL JS は jsDelivr から版を固定（5.24.0）し、`integrity` を付けて読む

### 出典

- **Wikidata**: CC0 1.0。対応表の `attribution` に書いている
- **Wikimedia Commons**: ライセンスはファイルごと（`license`・`licenseUrl`）。使うときは撮影者・ライセンス・元のページを出す（#302）
- **OpenStreetMap**（ODbL）・**国土地理院**: 公開の2ファイルには入れない。画面のデータ（作業フォルダ）だけに置き、画面の地図には「出典: 国土地理院」を出す
- これはリーダーの判断で、法的な確認ではない

## spot-photos-302.json（地図のピンのシートの帯に出す寺社の写真の台帳）

`spot-photos-301.json` の写真の候補から、帯に出す写真を 1 寺社 1 枚選んで承認したものだけを入れた**公開の台帳**。Issue #302 で作った。本番の表 `spot_photos` の中身は、ここから作る migration で入れる。写真そのものは R2（`goshuin-images` の `spot-photos/<sha1>.<jpg|png>`）に置き、アプリは `img.goshuinsanpo.com` の変換 URL（幅 1200・webp）で読む。

- `supabase/scripts/spot-photos/main.ts export` で作る**生成物**。手で直さない（直すときは選ぶ画面で選び直して `export` する）
- 入れるのは、寺社（`idx`・`name`・`prefecture`・`qid`・結びつきの確かさ）と、写真（ファイル名・`sha1`・R2 のキー・縦横・`focusY`）と、Commons の表示のままの撮影者・ライセンス・元のページだけ。**日付・選んだ人・外した寺社と理由・パスは入れない**（外した理由は作業フォルダの `choices.json` だけ）
- 本番の SQL（`supabase/migrations/20261004010000_spot_photos_302_batch1.sql`・`supabase/validation/spot_photos_302_check.sql`）は台帳から `generate` で作る生成物。台帳を変えたら `generate` し直してコミットする
- 契約書: [`docs/issues/issue-302-spot-photo-band.md`](../../docs/issues/issue-302-spot-photo-band.md)

### いまの中身（第1弾・2026-10-04）

| 項目                 | 数                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| 候補                 | 733 寺社・755 ファイル（`high` 707・`medium` 26）                                                  |
| 採った（台帳の行）   | **688**（`high` 669・`medium` 19）。全部 `batch: 1`・`status: approved`                            |
| 外した               | 45（人が大きく写る 4・別の寺社や場所 7・寺社が写っていない 11・暗い/ぼけ/建物が小さい 17・ほか 6） |
| `focusY` が 0.5 以外 | 28                                                                                                 |
| 縮小版を取った時間   | 1,433 秒（S6 で採った 692 枚・277MB。あとで外した 4 枚もキャッシュに残る）                         |
| 生成した SQL         | migration 約 274KB・確かめる SQL 約 277KB                                                          |

- `medium` で外したのは、#301 で誤りと分かった尾張猿田彦神社・円福寺、Wikidata の項目がその寺社だと確かめきれない熊野皇大神社・尖閣神社、evaluator の抜き取り（AC-39）で写真が帯に合わないと分かった北海道神宮頓宮・月讀神社（壱岐）・射楯兵主神社（鹿児島）
- AC-39 で外した high の1つ: 平河天満宮（半分の帯では石柱と木だけ）
- 建物が主でないが例外として残したもの: 稲佐の浜（浜と弁天島の岩そのものがこの場所の顔）・雲昌寺（あじさいの寺として知られ、あじさいが主の写真がこの寺らしい）
- 同じファイルを持つ3組は、写真が写している寺社だけで採った（中尊寺金色堂・甲斐國一宮浅間神社・都農神社）

### 候補の規則（契約書 D-5。`select.ts` の `screenFile`）

次の全部を満たすファイルだけを候補にする。寺社は、候補のファイルが1つ以上あるもの。

1. 横長（`width > height`）
2. 幅 1280 以上（縮小版 1280 を作れる）
3. ライセンスがあり、`GFDL` で始まらない（GFDL だけのファイルは全文の同梱が要る）
4. `restrictions` が空（`personality`・`trademarked` を外す）
5. `image/jpeg` か `image/png`
6. 撮影者（`artist`）が無いなら、帰属の表示が要らないもの（`attributionRequired: false`）だけ

`medium` の寺社は、選ぶ画面で「Wikidata の項目がこの寺社だと確かめた」（`linkChecked`）を付けないと採れない。1 ファイルは 1 寺社だけ（同じ `sha1` を別の寺社で採れない）。

### 台帳のキー

| キー                                              | 決まり                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `batch` / `idx`                                   | 弾（いまは 1）と seed の行の番号。`(batch, idx)` の順                          |
| `name` / `prefecture` / `qid`                     | seed と対応表の値。本番では名前・都道府県・作成者なしで 1 行の `spots` に結ぶ  |
| `linkConfidence` / `linkChecked`                  | 対応表の確かさと、`medium` を人が確かめたしるし（`medium` は true だけ）       |
| `file` / `sha1`                                   | Commons のファイル名と、承認したときの元の写真の sha1                          |
| `r2Key`                                           | `spot-photos/<sha1>.jpg`（PNG は `.png`）                                      |
| `width` / `height`                                | 元の写真の縦横（縦横比にだけ使う）                                             |
| `focusY`                                          | 見せたい所の縦の位置（0〜1・小数2桁まで）                                      |
| `author` / `license` / `licenseUrl` / `sourceUrl` | Commons の表示のまま（`author` が null は Public domain・CC0。帯では「不明」） |
| `isCropped`                                       | いつも true（帯に合わせて切る）                                                |
| `status`                                          | `approved` か `withdrawn`（外すときは行を消さずに `withdrawn` にする）         |

### 作業フォルダ `~/goshuin-work/spot-photos`

リポジトリの外。`--work` で変えられる。

- `review/candidates.json`: 選ぶ画面のデータ（`candidates` で作る）
- `review/choices.json`: 選んだ途中と外した理由（選ぶたびに保存。閉じても続きから）
- `cache/<sha1>.<jpg|png>`・`cache/<sha1>.json`: Commons の縮小版（幅 1280）と、取ったときの API の値（連絡先・時刻は入れない）。`upload` はここだけを読む
- `review-sheets/`: S6 で全部を見た一覧の画像と、決めた控え（`decisions.txt`）

### コマンド

リポジトリの直下で打つ。`--node-modules-dir=none` が要る。

```sh
# 候補を作る（ネットに出ない）→ 作業フォルダの review/candidates.json
deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts candidates
# 選ぶ画面（127.0.0.1 だけ。既定のポートは 8302）
deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts serve [--port 8302]
# 決めた数・まだの数・採った数（high / medium）と、外した理由ごとの数
deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts status
# 採ったものを台帳に書く（まだがあっても書けるが、標準エラーに数を出す）
deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts export
# 台帳の写真の縮小版を Commons から取る（実装する人）→ 作業フォルダの cache/
SPOT_WIKIDATA_CONTACT=<連絡先> deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts fetch
# R2 に置く（オーナー。R2_ACCOUNT_ID・R2_ACCESS_KEY_ID・R2_SECRET_ACCESS_KEY が要る）。upload --dry-run は数えるだけ
deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts upload --dry-run
deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts upload
# 置いた写真が独自ドメインで読めるか（鍵は要らない。変換を使わない）
deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts verify
# 台帳から本番の migration と確かめる SQL を作る。generate --check は書かずに比べ、違えば終了コード 1
deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts generate [--check]
```

- `SPOT_WIKIDATA_CONTACT`: Commons の User-Agent（`goshuin-spot-photos/1 (<連絡先>)`）に入れる連絡先（公開のリポジトリの URL）。**既定の値は無い**。流すときだけ環境変数で渡し、コミットしない
- R2 の鍵は、オーナーが自分のターミナルで `read -rs` で入れる（会話・履歴・リポジトリに残さない）。`goshuin-images` だけに書ける短い期限のトークンを作り、終わったら消す。`upload` は `spot-photos/` の外のキーを作ろうとしたら何も置かずに止め、消すことはしない
- 間隔: Commons は1度に1つで、前の呼び出しの終わりから 1,000ms あける。imageinfo は 50 件ずつ・`maxlag=5`。429・5xx で止まる（同じコマンドで続きから）
- 本番への入れ方（オーナー）は契約書の「本番」の表（H-0〜H-15）。`db push` は使えない

テスト（ネットに出ない。本物の台帳の検査は `data_test.ts`）:

```sh
deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
```

### 戻すとき

- 1 寺社を出さなくする: 台帳のその行を `status: "withdrawn"` にして `generate` し直し、コミットしてから、同じ migration をもう一度 `supabase db query --linked -f` で流す（upsert なので上書き。行は消さず、RLS で見えなくなる）
- 全部をやめる: `UPDATE public.spot_photos SET status = 'withdrawn';`（アプリは写真の無い帯に戻る）。R2 の `spot-photos/` は残してよい

### 出典

- **Wikimedia Commons**: ライセンスは写真ごと（`license`・`licenseUrl`）。帯の左下の ⓘ で、撮影者・ライセンス（リンク）・元のページ（リンク）・トリミングの注記を出す
- これはリーダーの判断で、法的な確認ではない

## 写真第2弾（#320）

写真の無い rank 5 の対象150寺社。`spot-wikidata-manual-320.json` は24寺社を手で対応付けた台帳、`spot-photos-320.json` は99寺社・1,635枚の候補（結べない26、候補なし25、一覧打切り0）。採用89、除外10。第1弾688件はそのまま、`spot-photos-302.json` は合計777件。現在はローカル生成・検証段階で、本番未反映。

- `manual-link`: Wikidata の名前一致（exact/partial）・P625とseedの距離 **3 km** 以内・既存high/mediumとの項目重複禁止を検査。
- `gather`: P373カテゴリ直下と `haswbstatement:P180`、手動対応のP18から候補を集める。
- 候補は(1)重複ファイルをまとめる、(2)第1弾で採用したSHA-1を除く、(3)同寺社の第1弾で不採用の候補を除く、(4)`screenFile`の横長・幅1280以上・形式・ライセンス等を通す、(5)面積順の上位30枚に絞る。
- 作業フォルダは `~/goshuin-work/spot-photos/b2`。`pool --check` → `candidates --batch 2` → `serve --batch 2` → `status --batch 2` → `export --batch 2`。
- `fetch`は全777件のキャッシュを取得し、`generate`は第1弾を変えず第2弾 `20261004020000_spot_photos_302_batch2.sql` と `spot_photos_302_batch2_check.sql` を生成。
- 本番の手順と戻す方法は `docs/issues/issue-320-spot-photos-batch2.md`。本番への追加時点で1.2.0利用者にも89寺社の写真が出る。アプリの新ビルドは不要。
