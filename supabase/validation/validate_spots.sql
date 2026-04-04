-- ============================================================
-- スポットマスタデータ 整合性チェック
-- 各シードファイル投入後に実行すること
-- ============================================================

-- 1. 重複チェック（同名+近距離 0.001度≒100m未満）
SELECT '1. 重複チェック' AS check_name;
SELECT a.name, a.prefecture, a.lat, a.lng, b.name AS duplicate_name, b.prefecture AS dup_prefecture
FROM spots a
JOIN spots b ON a.id < b.id
  AND a.name = b.name
  AND ABS(a.lat - b.lat) < 0.001
  AND ABS(a.lng - b.lng) < 0.001
WHERE a.status = 'active' AND b.status = 'active';

-- 2. 座標範囲チェック（日本国内: 北緯20〜46度、東経122〜154度）
SELECT '2. 座標範囲チェック（日本国外）' AS check_name;
SELECT name, prefecture, lat, lng
FROM spots
WHERE status = 'active'
  AND (lat < 20 OR lat > 46 OR lng < 122 OR lng > 154);

-- 3. 都道府県別の座標バウンディングボックスチェック
SELECT '3. 都道府県別座標チェック' AS check_name;
SELECT name, prefecture, lat, lng,
  CASE
    WHEN prefecture = '北海道' AND (lat < 41.3 OR lat > 45.6 OR lng < 139.3 OR lng > 145.8) THEN 'OUT'
    WHEN prefecture = '青森県' AND (lat < 40.2 OR lat > 41.6 OR lng < 139.4 OR lng > 141.7) THEN 'OUT'
    WHEN prefecture = '岩手県' AND (lat < 38.7 OR lat > 40.5 OR lng < 140.6 OR lng > 142.1) THEN 'OUT'
    WHEN prefecture = '宮城県' AND (lat < 37.7 OR lat > 39.0 OR lng < 140.2 OR lng > 141.7) THEN 'OUT'
    WHEN prefecture = '秋田県' AND (lat < 39.0 OR lat > 40.5 OR lng < 139.6 OR lng > 140.7) THEN 'OUT'
    WHEN prefecture = '山形県' AND (lat < 37.7 OR lat > 39.2 OR lng < 139.5 OR lng > 140.6) THEN 'OUT'
    WHEN prefecture = '福島県' AND (lat < 36.8 OR lat > 37.9 OR lng < 139.1 OR lng > 141.0) THEN 'OUT'
    WHEN prefecture = '茨城県' AND (lat < 35.7 OR lat > 36.9 OR lng < 139.6 OR lng > 140.9) THEN 'OUT'
    WHEN prefecture = '栃木県' AND (lat < 36.2 OR lat > 37.2 OR lng < 139.3 OR lng > 140.3) THEN 'OUT'
    WHEN prefecture = '群馬県' AND (lat < 36.0 OR lat > 37.1 OR lng < 138.6 OR lng > 139.7) THEN 'OUT'
    WHEN prefecture = '埼玉県' AND (lat < 35.7 OR lat > 36.3 OR lng < 138.7 OR lng > 139.9) THEN 'OUT'
    WHEN prefecture = '千葉県' AND (lat < 34.9 OR lat > 36.1 OR lng < 139.7 OR lng > 140.9) THEN 'OUT'
    WHEN prefecture = '東京都' AND (lat < 20.4 OR lat > 35.9 OR lng < 136.0 OR lng > 154.0) THEN 'OUT'
    WHEN prefecture = '神奈川県' AND (lat < 35.1 OR lat > 35.7 OR lng < 138.9 OR lng > 139.8) THEN 'OUT'
    WHEN prefecture = '新潟県' AND (lat < 36.7 OR lat > 38.6 OR lng < 137.8 OR lng > 140.0) THEN 'OUT'
    WHEN prefecture = '富山県' AND (lat < 36.2 OR lat > 36.9 OR lng < 136.7 OR lng > 137.8) THEN 'OUT'
    WHEN prefecture = '石川県' AND (lat < 36.1 OR lat > 37.9 OR lng < 136.2 OR lng > 137.4) THEN 'OUT'
    WHEN prefecture = '福井県' AND (lat < 35.5 OR lat > 36.3 OR lng < 135.5 OR lng > 136.8) THEN 'OUT'
    WHEN prefecture = '山梨県' AND (lat < 35.2 OR lat > 35.9 OR lng < 138.2 OR lng > 139.2) THEN 'OUT'
    WHEN prefecture = '長野県' AND (lat < 35.2 OR lat > 37.0 OR lng < 137.3 OR lng > 138.7) THEN 'OUT'
    WHEN prefecture = '岐阜県' AND (lat < 35.1 OR lat > 36.5 OR lng < 136.2 OR lng > 137.7) THEN 'OUT'
    WHEN prefecture = '静岡県' AND (lat < 34.6 OR lat > 35.6 OR lng < 137.5 OR lng > 139.2) THEN 'OUT'
    WHEN prefecture = '愛知県' AND (lat < 34.6 OR lat > 35.4 OR lng < 136.6 OR lng > 137.8) THEN 'OUT'
    WHEN prefecture = '三重県' AND (lat < 33.7 OR lat > 35.2 OR lng < 135.8 OR lng > 136.9) THEN 'OUT'
    WHEN prefecture = '滋賀県' AND (lat < 34.8 OR lat > 35.5 OR lng < 135.7 OR lng > 136.5) THEN 'OUT'
    WHEN prefecture = '京都府' AND (lat < 34.7 OR lat > 35.8 OR lng < 134.8 OR lng > 136.1) THEN 'OUT'
    WHEN prefecture = '大阪府' AND (lat < 34.3 OR lat > 34.9 OR lng < 135.1 OR lng > 135.8) THEN 'OUT'
    WHEN prefecture = '兵庫県' AND (lat < 34.2 OR lat > 35.7 OR lng < 134.2 OR lng > 135.5) THEN 'OUT'
    WHEN prefecture = '奈良県' AND (lat < 34.0 OR lat > 34.8 OR lng < 135.5 OR lng > 136.2) THEN 'OUT'
    WHEN prefecture = '和歌山県' AND (lat < 33.4 OR lat > 34.4 OR lng < 135.0 OR lng > 136.0) THEN 'OUT'
    WHEN prefecture = '鳥取県' AND (lat < 35.1 OR lat > 35.6 OR lng < 133.2 OR lng > 134.5) THEN 'OUT'
    WHEN prefecture = '島根県' AND (lat < 34.3 OR lat > 37.3 OR lng < 131.6 OR lng > 133.4) THEN 'OUT'
    WHEN prefecture = '岡山県' AND (lat < 34.3 OR lat > 35.3 OR lng < 133.4 OR lng > 134.4) THEN 'OUT'
    WHEN prefecture = '広島県' AND (lat < 34.0 OR lat > 35.0 OR lng < 132.0 OR lng > 133.5) THEN 'OUT'
    WHEN prefecture = '山口県' AND (lat < 33.7 OR lat > 34.8 OR lng < 130.8 OR lng > 132.2) THEN 'OUT'
    WHEN prefecture = '徳島県' AND (lat < 33.7 OR lat > 34.3 OR lng < 133.6 OR lng > 134.8) THEN 'OUT'
    WHEN prefecture = '香川県' AND (lat < 34.0 OR lat > 34.5 OR lng < 133.5 OR lng > 134.5) THEN 'OUT'
    WHEN prefecture = '愛媛県' AND (lat < 33.0 OR lat > 34.1 OR lng < 132.0 OR lng > 133.7) THEN 'OUT'
    WHEN prefecture = '高知県' AND (lat < 32.7 OR lat > 33.9 OR lng < 132.5 OR lng > 134.3) THEN 'OUT'
    WHEN prefecture = '福岡県' AND (lat < 33.0 OR lat > 33.9 OR lng < 130.0 OR lng > 131.2) THEN 'OUT'
    WHEN prefecture = '佐賀県' AND (lat < 33.0 OR lat > 33.6 OR lng < 129.7 OR lng > 130.5) THEN 'OUT'
    WHEN prefecture = '長崎県' AND (lat < 32.5 OR lat > 34.7 OR lng < 128.6 OR lng > 130.4) THEN 'OUT'
    WHEN prefecture = '熊本県' AND (lat < 32.0 OR lat > 33.2 OR lng < 130.1 OR lng > 131.3) THEN 'OUT'
    WHEN prefecture = '大分県' AND (lat < 32.7 OR lat > 33.7 OR lng < 130.8 OR lng > 132.1) THEN 'OUT'
    WHEN prefecture = '宮崎県' AND (lat < 31.4 OR lat > 32.8 OR lng < 130.7 OR lng > 131.9) THEN 'OUT'
    WHEN prefecture = '鹿児島県' AND (lat < 27.0 OR lat > 32.3 OR lng < 128.4 OR lng > 131.2) THEN 'OUT'
    WHEN prefecture = '沖縄県' AND (lat < 24.0 OR lat > 27.9 OR lng < 122.9 OR lng > 131.3) THEN 'OUT'
    ELSE 'OK'
  END AS bbox_check
FROM spots
WHERE status = 'active'
HAVING bbox_check = 'OUT';

-- 4. rank分布チェック（県別）
SELECT '4. rank分布チェック' AS check_name;
SELECT prefecture, rank, COUNT(*) AS count
FROM spots
WHERE status = 'active' AND rank >= 4
GROUP BY prefecture, rank
ORDER BY prefecture, rank DESC;

-- 5. type整合性チェック（名前と種別の不一致）
SELECT '5. type整合性チェック' AS check_name;
SELECT name, type, prefecture,
  CASE
    WHEN type = 'temple' AND (name LIKE '%神社%' OR name LIKE '%大社%' OR (name LIKE '%宮%' AND name NOT LIKE '%宮城%')) THEN 'MISMATCH: temple but name suggests shrine'
    WHEN type = 'shrine' AND (name LIKE '%寺%' OR name LIKE '%院%' OR name LIKE '%堂%') THEN 'MISMATCH: shrine but name suggests temple'
    ELSE 'OK'
  END AS type_check
FROM spots
WHERE status = 'active'
HAVING type_check != 'OK';

-- 6. 住所-prefecture不一致チェック
SELECT '6. 住所-prefecture不一致' AS check_name;
SELECT name, address, prefecture
FROM spots
WHERE status = 'active'
  AND address NOT LIKE prefecture || '%';

-- 7. 総件数サマリー
SELECT '7. 総件数サマリー' AS check_name;
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE rank = 5) AS rank5,
  COUNT(*) FILTER (WHERE rank = 4) AS rank4,
  COUNT(*) FILTER (WHERE rank = 3) AS rank3,
  COUNT(*) FILTER (WHERE rank = 2) AS rank2,
  COUNT(*) FILTER (WHERE rank = 1) AS rank1,
  COUNT(DISTINCT prefecture) AS prefectures
FROM spots
WHERE status = 'active';
