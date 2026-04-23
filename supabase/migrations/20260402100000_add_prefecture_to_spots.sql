-- spots テーブルに prefecture カラムを追加（地域別集計用）
ALTER TABLE public.spots ADD COLUMN prefecture text;

-- 既存データのバックフィル（住所から都道府県を抽出）
-- 「〜県」のパターン
UPDATE public.spots
SET prefecture = split_part(address, '県', 1) || '県'
WHERE address LIKE '%県%' AND prefecture IS NULL;

-- 「〜府」のパターン（京都府、大阪府）
UPDATE public.spots
SET prefecture = split_part(address, '府', 1) || '府'
WHERE address LIKE '%府%' AND prefecture IS NULL;

-- 東京都
UPDATE public.spots
SET prefecture = '東京都'
WHERE address LIKE '東京都%' AND prefecture IS NULL;

-- 北海道
UPDATE public.spots
SET prefecture = '北海道'
WHERE address LIKE '北海道%' AND prefecture IS NULL;
