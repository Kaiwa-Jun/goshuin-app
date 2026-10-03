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

1. オーナーが見るもの: 調べた結果の `review-owner.html`（リポジトリの外）で選び、「選んだ結果を JSON で書き出す」で `coords-292-review.json` を出す
2. `deno run -A supabase/scripts/spot-coords/main.ts import-owner coords-292-review.json --batch 2 --dry-run` で中身を見て、よければ `--dry-run` を外して台帳に足す
   - `choice` が `seed` の行は入れない（座標を変えない）。`wd` → `wikidata`、`osm` → `osm`、`custom` → `owner`
   - `gsi`（国土地理院）を選んだ行があると止まる（下の「出典」）
3. 下書きのまとまり（例: 確かさ 中）を丸ごと採るときは、`main.ts` の `PRESETS` にプリセットを1つ足して `import-draft --preset <名前> --batch 2` で入れる
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
