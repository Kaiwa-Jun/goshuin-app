# スポットマスタデータ シードファイル

## ファイル一覧

| ファイル                 | 対象地域                 | 都道府県数 |
| ------------------------ | ------------------------ | ---------- |
| `01_hokkaido_tohoku.sql` | 北海道・東北（宮城除く） | 6          |
| `02_kanto.sql`           | 関東                     | 7          |
| `03_chubu.sql`           | 中部                     | 9          |
| `04_kinki.sql`           | 近畿                     | 7          |
| `05_chugoku_shikoku.sql` | 中国・四国               | 9          |
| `06_kyushu_okinawa.sql`  | 九州・沖縄               | 8          |

※ 宮城県は `seed_miyagi_spots_and_pilgrimages.sql`（親ディレクトリ）で投入済み

## 投入手順

1. Supabase MCP または `psql` で各SQLファイルを番号順に実行
2. 各ファイル実行後に `../validation/validate_spots.sql` で整合性チェック
3. 問題があれば修正してから次のファイルへ

## データ品質基準

- 住所: 最低2つの情報源で確認済み
- 座標: geocoding.jp で住所から変換、都道府県バウンディングボックス内を確認
- rank: ホトカミ御朱印ランキング基準（rank 5: TOP10、rank 4: 11〜20位）
- type: 神社→shrine、寺院→temple
