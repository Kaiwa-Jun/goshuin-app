-- Issue #330: 寺社のマスタ（created_by_user_id が NULL の spots）に鼬幣稲荷神社（岩手県花巻市）を足す。
-- きっかけ: 公式 Instagram @itachibeiinari が @goshuinsampo の投稿にいいねした（2026-10-12）。マスタに無かった。
-- 住所: 公式 Instagram のプロフィール「岩手県花巻市石神町336鎮座」・ホトカミ（hotokami.jp/area/iwate/…/83196/）の 2 つで確かめた。
-- 座標: 国土地理院の住所検索「岩手県花巻市石神町３３６番地」→ 39.383331, 141.103516（seed にそろえて小数 4 桁）。
--       ホトカミの地図の点（39.383115, 141.103861）とは約 40m。Wikidata・OpenStreetMap には無い（2026-10-12）。
-- rank 3: 地域の寺社（地図はズーム 12.5 から出る）。東京の増強分（seed_tokyo_rank3_4_spots.sql）と同じ扱い。
-- 2 回目以降は何もしない（同じ名前・同じ県のマスタがあれば足さない）。
INSERT INTO public.spots (name, lat, lng, type, address, prefecture, rank, status)
SELECT '鼬幣稲荷神社', 39.3833, 141.1035, 'shrine', '岩手県花巻市石神町336', '岩手県', 3, 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.spots
  WHERE name = '鼬幣稲荷神社' AND prefecture = '岩手県' AND created_by_user_id IS NULL
);
