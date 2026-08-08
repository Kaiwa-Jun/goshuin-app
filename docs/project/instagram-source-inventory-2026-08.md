# Instagram 情報ソースの棚卸し(2026-08-08)

## 背景

P2-02(Issue #111)で Instagram Business Discovery を運用投入した後、対象29スポット(東京・宮城・京都の rank5)のうち **7件が Instagram リンク未登録**と判明。ユーザーが金蛇水神社の実例(Instagram で日々発信しているのにアプリに表示されない)から気づいた。

## 対象29スポットの再確認結果

rank5(ホトカミ御朱印ランキング TOP10)の全29スポットは `spot_info_sources` に**漏れなく登録済み**(official ソースは全件あり)。問題は Instagram(`sns_link`)の欠落のみ。

## 調査結果(WebSearch、2026-08-08)

| スポット             | 都道府県 | 結果                                                                       | 判定                                                                        |
| -------------------- | -------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 金蛇水神社           | 宮城県   | `@kanahebi_shrine`(公式広報、フォロワー約79,000人)                         | ✅ 追加対象                                                                 |
| 大崎八幡宮           | 宮城県   | `@osakihachimangu_shrine`(公式、フォロワー約1,400人)                       | ✅ 追加対象                                                                 |
| 湯島天満宮           | 東京都   | `@yushimatenmangu`(【公式】明記。**「#限定御朱印」投稿を実投稿で確認**)    | ✅ 追加対象(最有力)                                                         |
| 明治神宮             | 東京都   | `@meijijingu_sukeikai`(明治神宮崇敬会。本体公式サイトからの直接リンクなし) | △ 要検証(本体公式か不明瞭。追加するなら dry_run で code 110 が出ないか確認) |
| 志波彦神社・鹽竈神社 | 宮城県   | 見つからず(公式サイトに SNS リンクなし)                                    | ❌ 対象外                                                                   |
| 烏森神社             | 東京都   | 見つからず(公式サイトは X のみ)                                            | ❌ 対象外                                                                   |
| 東寺(教王護国寺)     | 京都府   | 見つからず(公式サイトにリンクなし、投稿元アカウント特定不可)               | ❌ 対象外                                                                   |

## 追加用 SQL(次セッションで SQL Editor で実行)

```sql
INSERT INTO public.spot_info_sources (spot_id, url, source_type)
SELECT s.id, v.url, v.source_type
FROM (VALUES
  ('金蛇水神社', '宮城県', 'https://www.instagram.com/kanahebi_shrine/', 'sns_link'),
  ('大崎八幡宮', '宮城県', 'https://www.instagram.com/osakihachimangu_shrine/', 'sns_link'),
  ('湯島天満宮', '東京都', 'https://www.instagram.com/yushimatenmangu/', 'sns_link')
) AS v(spot_name, prefecture, url, source_type)
JOIN public.spots s ON s.name = v.spot_name AND s.prefecture = v.prefecture
ON CONFLICT (spot_id, url) DO NOTHING;

-- 明治神宮(要検証。上記3件を先に確認してから判断)
-- INSERT INTO public.spot_info_sources (spot_id, url, source_type)
-- SELECT s.id, 'https://www.instagram.com/meijijingu_sukeikai/', 'sns_link'
-- FROM public.spots s WHERE s.name = '明治神宮' AND s.prefecture = '東京都'
-- ON CONFLICT (spot_id, url) DO NOTHING;

-- 確認
SELECT s.name, sis.url
FROM public.spot_info_sources sis
JOIN public.spots s ON s.id = sis.spot_id
WHERE sis.url ILIKE '%instagram.com%'
  AND s.name IN ('金蛇水神社', '大崎八幡宮', '湯島天満宮', '明治神宮');
```

## 追加後の確認手順

1. 上記 INSERT を SQL Editor で実行
2. `content_hash` は null のまま(新規行なので初回巡回で自動的に処理される)。**次の cron(火・金 02:30 JST)を待つか、手動で叩く**:
   ```
   curl -X POST -H "Authorization: Bearer <sb_secretキー>" -H "Content-Type: application/json" \
     -d '{"mode":"instagram","dry_run":true,"limit":25}' \
     https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/crawl-spot-sources
   ```
   `instagram.skipped_not_business` が増えていないか確認(個人・非ビジネスアカウントだと弾かれる)
3. dry_run で `not_business` にならなければ `dry_run:false` で本実行 → アプリで実機確認
4. 明治神宮は上記3件の結果を見てから追加するか判断

## 恒久的な運用の検討事項(未着手)

今回は既存29スポット内の欠落補完のみ。**巡回対象そのものを増やす(rank4以下や他都道府県への拡大)** かどうかは別途プロダクト判断が必要。
