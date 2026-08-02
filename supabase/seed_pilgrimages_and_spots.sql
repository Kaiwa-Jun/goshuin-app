-- ============================================================
-- 巡礼コースと札所の紐付けマスタデータ
-- 2026-08-02 に本番 DB からエクスポート（pilgrimages 6件 + pilgrimage_spots 75件）
-- ID はデータベースごとに異なるため、名前ベースの INSERT ... SELECT で移植可能にしている
-- 適用は1回のみ実行すること
-- ============================================================

-- ------------------------------------------------------------
-- 1. 巡礼コース（6件）
-- ------------------------------------------------------------
INSERT INTO pilgrimages (name, description, region, category, total_spots) VALUES
('仙台三十三観音霊場', '仙台藩4代藩主伊達綱村が開創した仙台市内33箇所の観音霊場', '宮城県', '観音霊場', 33),
('仙台六芒星巡り', '伊達政宗が仙台城下に配置した六芒星を形成する6つの神社を巡る', '宮城県', '神社巡り', 6),
('仙臺伍社巡り', '仙台市中心部の5つの神社を巡り、各社で巡玉守を受けて証を完成させる', '宮城県', '神社巡り', 5),
('奥州三十三観音霊場（宮城）', '旧陸奥国内（岩手・宮城・福島）にまたがる33箇所の観音霊場のうち、宮城県内の18箇所を巡る。', '宮城県', '観音霊場', 18),
('奥州仙臺七福神', '1983年開創の東北最古の七福神霊場。仙台市内の6寺1社を巡る', '宮城県', '七福神', 7),
('東北三十六不動尊霊場（宮城）', '東北六県に各6箇所、合計36の札所からなる不動明王霊場。宮城県内の6箇所（第25番〜第30番）を巡る。', '宮城県', '不動霊場', 6);

-- ------------------------------------------------------------
-- 2. 札所の紐付け（75件）
-- ------------------------------------------------------------
-- === 仙台三十三観音霊場（33件）===
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 1, '第一番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '法楽院 観音堂' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 2, '第二番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '充国寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 3, '第三番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '資福寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 4, '第四番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '永昌寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 5, '第五番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '昌繁寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 6, '第六番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '荘厳寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 7, '第七番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '大願寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 8, '第八番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '満願寺（宝光院）' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 9, '第九番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '満願寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 10, '第十番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '善入院' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 11, '第十一番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '仙岳院' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 12, '第十二番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '慈恩寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 13, '第十三番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '金勝寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 14, '第十四番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '大林寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 15, '第十五番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '愚鈍院' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 16, '第十六番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '成覚寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 17, '第十七番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '阿弥陀寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 18, '第十八番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '光寿院' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 19, '第十九番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '皎林寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 20, '第二十番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '円福寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 21, '第二十一番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '瑞雲寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 22, '第二十二番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '保寿寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 23, '第二十三番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '松音寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 24, '第二十四番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '国分尼寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 25, '第二十五番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '陸奥国分寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 26, '第二十六番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '両全院' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 27, '第二十七番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '満蔵寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 28, '第二十八番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '円乗寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 29, '第二十九番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '祐善寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 30, '第三十番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '高福院 観音堂' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 31, '第三十一番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '大善寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 32, '第三十二番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '常蔵院' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 33, '第三十三番札所' FROM pilgrimages p, spots s
WHERE p.name = '仙台三十三観音霊場' AND s.name = '大蔵寺' AND s.prefecture = '宮城県';
-- === 仙台六芒星巡り（6件）===
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 1, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙台六芒星巡り' AND s.name = '大崎八幡宮' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 2, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙台六芒星巡り' AND s.name = '青葉神社' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 3, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙台六芒星巡り' AND s.name = '仙台東照宮' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 4, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙台六芒星巡り' AND s.name = '榴岡天満宮' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 5, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙台六芒星巡り' AND s.name = '愛宕神社' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 6, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙台六芒星巡り' AND s.name = '亀岡八幡宮' AND s.prefecture = '宮城県';
-- === 仙臺伍社巡り（5件）===
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 1, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙臺伍社巡り' AND s.name = '青葉神社' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 2, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙臺伍社巡り' AND s.name = '愛宕神社' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 3, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙臺伍社巡り' AND s.name = '仙台東照宮' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 4, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙臺伍社巡り' AND s.name = '榴岡天満宮' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 5, NULL FROM pilgrimages p, spots s
WHERE p.name = '仙臺伍社巡り' AND s.name = '宮城縣護國神社' AND s.prefecture = '宮城県';
-- === 奥州三十三観音霊場（宮城）（18件）===
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 1, '第一番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '紹楽寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 2, '第二番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '秀麓斎' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 3, '第三番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '新宮寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 4, '第四番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '斗蔵寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 5, '第五番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '名取千手観音堂' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 6, '第六番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '瑞巌寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 7, '第七番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '大仰寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 8, '第八番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '梅渓寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 9, '第九番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '箟峯寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 10, '第十番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '興福寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 14, '第十四番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '大慈寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 15, '第十五番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '華足寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 16, '第十六番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '清水寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 21, '第二十一番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '観音寺（有壁）' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 22, '第二十二番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '勝大寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 23, '第二十三番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '長承寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 24, '第二十四番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '長谷寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 30, '第三十番札所' FROM pilgrimages p, spots s
WHERE p.name = '奥州三十三観音霊場（宮城）' AND s.name = '補陀寺' AND s.prefecture = '宮城県';
-- === 奥州仙臺七福神（7件）===
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 1, 'えびす神' FROM pilgrimages p, spots s
WHERE p.name = '奥州仙臺七福神' AND s.name = '藤崎えびす神社' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 2, '大黒天' FROM pilgrimages p, spots s
WHERE p.name = '奥州仙臺七福神' AND s.name = '秀林寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 3, '寿老尊' FROM pilgrimages p, spots s
WHERE p.name = '奥州仙臺七福神' AND s.name = '玄光庵' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 4, '弁才天' FROM pilgrimages p, spots s
WHERE p.name = '奥州仙臺七福神' AND s.name = '林香院' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 5, '毘沙門天' FROM pilgrimages p, spots s
WHERE p.name = '奥州仙臺七福神' AND s.name = '満福寺' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 6, '布袋尊' FROM pilgrimages p, spots s
WHERE p.name = '奥州仙臺七福神' AND s.name = '福聚院' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 7, '福禄寿' FROM pilgrimages p, spots s
WHERE p.name = '奥州仙臺七福神' AND s.name = '鉤取寺' AND s.prefecture = '宮城県';
-- === 東北三十六不動尊霊場（宮城）（6件）===
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 25, '第二十五番札所' FROM pilgrimages p, spots s
WHERE p.name = '東北三十六不動尊霊場（宮城）' AND s.name = '観音寺（身代不動尊）' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 26, '第二十六番札所' FROM pilgrimages p, spots s
WHERE p.name = '東北三十六不動尊霊場（宮城）' AND s.name = '大徳寺（横山不動尊）' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 27, '第二十七番札所' FROM pilgrimages p, spots s
WHERE p.name = '東北三十六不動尊霊場（宮城）' AND s.name = '松景院（神寺不動尊）' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 28, '第二十八番札所' FROM pilgrimages p, spots s
WHERE p.name = '東北三十六不動尊霊場（宮城）' AND s.name = '五大堂' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 29, '第二十九番札所' FROM pilgrimages p, spots s
WHERE p.name = '東北三十六不動尊霊場（宮城）' AND s.name = '西光寺（秋保大滝不動尊）' AND s.prefecture = '宮城県';
INSERT INTO pilgrimage_spots (pilgrimage_id, spot_id, sort_order, label)
SELECT p.id, s.id, 30, '第三十番札所' FROM pilgrimages p, spots s
WHERE p.name = '東北三十六不動尊霊場（宮城）' AND s.name = '愛敬院（駒場滝不動尊）' AND s.prefecture = '宮城県';
