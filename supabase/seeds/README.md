# スポットマスタデータ シードファイル

## ファイル一覧

| ファイル                       | 対象地域                  | 内容                     |
| ------------------------------ | ------------------------- | ------------------------ |
| `01_hokkaido_tohoku.sql`       | 北海道・東北（宮城除く）  | 各県 rank5×10 + rank4×10 |
| `02_kanto.sql`                 | 関東（東京除く）          | 同上                     |
| `03_chubu.sql`                 | 中部                      | 同上                     |
| `04_kinki.sql`                 | 近畿（京都除く）          | 同上                     |
| `05_chugoku_shikoku.sql`       | 中国・四国                | 同上                     |
| `06_kyushu_okinawa.sql`        | 九州・沖縄                | 同上                     |
| `seed_tokyo_spots.sql`         | 東京都                    | rank5×10 + rank4×10      |
| `seed_tokyo_rank3_4_spots.sql` | 東京都（増強分・2026-08） | rank4×13 + rank3×86      |
| `seed_kyoto_rank_spots.sql`    | 京都府                    | rank5×10 + rank4×10      |

※ 宮城県は `seed_miyagi_spots_and_pilgrimages.sql`（親ディレクトリ）で投入済み（2026-08 に本番 DB からエクスポートした rank 付き90件）
※ 巡礼コース6件と札所の紐付け75件は `seed_pilgrimages_and_spots.sql`（親ディレクトリ、名前ベースの INSERT ... SELECT）。スポット投入後に実行する

## 投入手順

1. Supabase MCP または `psql` で各SQLファイルを番号順に実行
2. 各ファイル実行後に `../validation/validate_spots.sql` で整合性チェック
3. 問題があれば修正してから次のファイルへ

## データ品質基準

- 住所: 最低2つの情報源で確認済み
- 座標: geocoding.jp で住所から変換、都道府県バウンディングボックス内を確認
- rank: ホトカミ御朱印ランキング基準（rank 5: TOP10、rank 4: 11〜20位）
- type: 神社→shrine、寺院→temple
