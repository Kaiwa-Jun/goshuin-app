-- ============================================================
-- 東京都 ランク5・ランク4 スポット
-- 情報源: ホトカミ, Wikipedia, 公式サイト, geocoding.jp
-- 検証日: 2026-04-04
-- ============================================================

-- rank 5（TOP10級）
INSERT INTO spots (name, lat, lng, type, address, prefecture, rank, status) VALUES
('浅草寺', 35.7134, 139.7967, 'temple', '東京都台東区浅草2-3-1', '東京都', 5, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(senso-ji.jp) ✓ | 座標: geocoding.jp ✓
('明治神宮', 35.6741, 139.7030, 'shrine', '東京都渋谷区代々木神園町1-1', '東京都', 5, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 東京都神社庁 ✓ | 座標: geocoding.jp ✓
('神田神社', 35.7023, 139.7683, 'shrine', '東京都千代田区外神田2-16-2', '東京都', 5, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(kandamyoujin.or.jp) ✓ | 座標: geocoding.jp ✓
('靖國神社', 35.6953, 139.7437, 'shrine', '東京都千代田区九段北3-1-1', '東京都', 5, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(yasukuni.or.jp) ✓ | 座標: geocoding.jp ✓
('浅草神社', 35.7148, 139.7966, 'shrine', '東京都台東区浅草2-3-1', '東京都', 5, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(asakusajinja.jp) ✓ | 座標: latitude.to(浅草寺東隣) ✓
-- 注: 浅草寺と同一住所だが別施設。座標は浅草神社社殿位置に調整済み
('湯島天満宮', 35.7078, 139.7682, 'shrine', '東京都文京区湯島3-30-1', '東京都', 5, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 文京区公式 ✓ | 座標: geocoding.jp ✓
('東京大神宮', 35.7002, 139.7466, 'shrine', '東京都千代田区富士見2-4-1', '東京都', 5, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(tokyodaijingu.or.jp) ✓ | 座標: geocoding.jp ✓
('日枝神社', 35.6745, 139.7403, 'shrine', '東京都千代田区永田町2-10-5', '東京都', 5, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(hiejinja.net) ✓ | 座標: geocoding.jp ✓
('烏森神社', 35.6665, 139.7565, 'shrine', '東京都港区新橋2-15-5', '東京都', 5, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(karasumorijinja.or.jp) ✓ | 座標: geocoding.jp ✓
('増上寺', 35.6573, 139.7478, 'temple', '東京都港区芝公園4-7-35', '東京都', 5, 'active')
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(zojoji.or.jp) ✓ | 座標: geocoding.jp ✓
;

-- rank 4（11〜20位）
INSERT INTO spots (name, lat, lng, type, address, prefecture, rank, status) VALUES
('上野東照宮', 35.7154, 139.7706, 'shrine', '東京都台東区上野公園9-88', '東京都', 4, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(uenotoshogu.com) ✓ | 座標: geocoding.jp ✓
('花園神社', 35.6936, 139.7052, 'shrine', '東京都新宿区新宿5-17-3', '東京都', 4, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(hanazono-jinja.or.jp) ✓ | 座標: geocoding.jp ✓
('小網神社', 35.6842, 139.7806, 'shrine', '東京都中央区日本橋小網町16-23', '東京都', 4, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 東京都神社庁 ✓ | 座標: geocoding.jp ✓
('阿佐ヶ谷神明宮', 35.7070, 139.6368, 'shrine', '東京都杉並区阿佐谷北1-25-5', '東京都', 4, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(shinmeiguu.com) ✓ | 座標: geocoding.jp ✓
('蛇窪神社', 35.6025, 139.7151, 'shrine', '東京都品川区二葉4-4-12', '東京都', 4, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(hebikubo.jp) ✓ | 座標: geocoding.jp ✓
('芝大神宮', 35.6577, 139.7531, 'shrine', '東京都港区芝大門1-12-7', '東京都', 4, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(shibadaijingu.com) ✓ | 座標: geocoding.jp ✓
('根津神社', 35.7200, 139.7608, 'shrine', '東京都文京区根津1-28-9', '東京都', 4, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(nedujinja.or.jp) ✓ | 座標: geocoding.jp ✓
('亀戸天神社', 35.7031, 139.8206, 'shrine', '東京都江東区亀戸3-6-1', '東京都', 4, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(kameidotenjin-sha.jp) ✓ | 座標: geocoding.jp ✓
('赤坂氷川神社', 35.6683, 139.7356, 'shrine', '東京都港区赤坂6-10-12', '東京都', 4, 'active'),
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(akasakahikawa.or.jp) ✓ | 座標: geocoding.jp ✓
('愛宕神社', 35.6650, 139.7485, 'shrine', '東京都港区愛宕1-5-3', '東京都', 4, 'active')
-- 住所確認: ホトカミ ✓, Wikipedia ✓, 公式サイト(atago-jinja.com) ✓ | 座標: geocoding.jp ✓
;
