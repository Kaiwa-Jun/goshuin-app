-- ============================================================
-- 宮城県 神社仏閣・巡礼コース 追加データ
-- 実行日: 2026-04-02
-- ============================================================

-- ============================================================
-- 1. 新規スポットの INSERT（主要な神社仏閣）
-- ============================================================
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
-- 主要神社仏閣（ユーザー指定分）
('金蛇水神社',      38.104200, 140.856300, 'shrine', '宮城県岩沼市三色吉字水神7',              '宮城県', 'active'),
('瑞巌寺',          38.372400, 141.061400, 'temple', '宮城県宮城郡松島町松島字町内91',          '宮城県', 'active'),
('五大堂',          38.370700, 141.062800, 'temple', '宮城県宮城郡松島町松島字町内111',         '宮城県', 'active'),
('円通院',          38.372000, 141.060600, 'temple', '宮城県宮城郡松島町松島字町内67',          '宮城県', 'active'),
('黄金山神社',      38.295300, 141.566800, 'shrine', '宮城県石巻市鮎川浜金華山5',              '宮城県', 'active'),
('御崎神社',        38.882500, 141.635800, 'shrine', '宮城県気仙沼市唐桑町崎浜2-3',            '宮城県', 'active'),
('柳津虚空蔵尊',    38.670800, 141.348600, 'temple', '宮城県登米市津山町柳津字大柳津63',        '宮城県', 'active'),
('鹿島御児神社',    38.420200, 141.298700, 'shrine', '宮城県石巻市日和が丘2-1-10',             '宮城県', 'active'),
('陸奥総社宮',      38.299100, 140.989400, 'shrine', '宮城県多賀城市市川字奏社1',              '宮城県', 'active'),
('白山神社',        37.971400, 140.782300, 'shrine', '宮城県角田市角田字牛舘1',                '宮城県', 'active'),
('熊野那智神社',    38.187600, 140.838500, 'shrine', '宮城県名取市高舘吉田字舘山8',            '宮城県', 'active'),
('早馬神社',        38.878200, 141.613500, 'shrine', '宮城県気仙沼市唐桑町宿浦75',            '宮城県', 'active'),
('櫻岡大神宮',      38.282000, 140.847600, 'shrine', '宮城県仙台市青葉区桜ケ岡公園1-1',       '宮城県', 'active');

-- ============================================================
-- 2. 巡礼コース用の新規スポット INSERT
--    （東北三十六不動尊霊場・奥州三十三観音霊場 の札所）
-- ============================================================

-- --- 東北三十六不動尊霊場（宮城県6箇所）---
-- 第25番 観音寺（気仙沼市）
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('観音寺（身代不動尊）', 38.908200, 141.572500, 'temple', '宮城県気仙沼市本町1-4-16',                 '宮城県', 'active');
-- 第26番 大徳寺（横山不動尊）
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('大徳寺（横山不動尊）', 38.683600, 141.368200, 'temple', '宮城県登米市津山町横山字本町3',             '宮城県', 'active');
-- 第27番 松景院（神寺不動尊）
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('松景院（神寺不動尊）', 38.544800, 141.063700, 'temple', '宮城県遠田郡美里町中埣字町80',             '宮城県', 'active');
-- 第28番 瑞巌寺五大堂 → 既に「五大堂」として上で INSERT 済み
-- 第29番 西光寺（秋保大滝不動尊）
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('西光寺（秋保大滝不動尊）', 38.296000, 140.639200, 'temple', '宮城県仙台市太白区秋保町馬場字大滝11',   '宮城県', 'active');
-- 第30番 愛敬院（駒場滝不動尊）
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('愛敬院（駒場滝不動尊）', 37.918700, 140.718900, 'temple', '宮城県伊具郡丸森町字不動59',              '宮城県', 'active');

-- --- 奥州三十三観音霊場（宮城県内の札所）---
-- 第1番 紹楽寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('紹楽寺',           38.188200, 140.840100, 'temple', '宮城県名取市高舘吉田字西真坂17',           '宮城県', 'active');
-- 第2番 秀麓斎
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('秀麓斎',           38.190500, 140.838900, 'temple', '宮城県名取市高舘吉田字上鹿野東88',         '宮城県', 'active');
-- 第3番 新宮寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('新宮寺',           38.185400, 140.834700, 'temple', '宮城県名取市高舘熊野堂字岩口中45',         '宮城県', 'active');
-- 第4番 斗蔵寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('斗蔵寺',           37.946200, 140.812600, 'temple', '宮城県角田市小田字斗蔵95',                '宮城県', 'active');
-- 第5番 名取千手観音堂
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('名取千手観音堂',    38.173500, 140.878200, 'temple', '宮城県名取市増田柳田385-4',               '宮城県', 'active');
-- 第6番 瑞巌寺 → 既に上で INSERT 済み
-- 第7番 大仰寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('大仰寺',           38.356300, 141.093200, 'temple', '宮城県宮城郡松島町手樽字三浦93',           '宮城県', 'active');
-- 第8番 梅渓寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('梅渓寺',           38.433500, 141.312000, 'temple', '宮城県石巻市湊字梅渓寺25',                '宮城県', 'active');
-- 第9番 箟峯寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('箟峯寺',           38.567000, 141.143200, 'temple', '宮城県遠田郡涌谷町箟岳字神楽岡1',         '宮城県', 'active');
-- 第10番 興福寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('興福寺',           38.690200, 141.218800, 'temple', '宮城県登米市南方町本郷大嶽18',             '宮城県', 'active');
-- 第14番 大慈寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('大慈寺',           38.714600, 141.367400, 'temple', '宮城県登米市東和町米川町下56',             '宮城県', 'active');
-- 第15番 華足寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('華足寺',           38.737800, 141.402500, 'temple', '宮城県登米市東和町米川字小山下2',          '宮城県', 'active');
-- 第16番 清水寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('清水寺',           38.749500, 141.007200, 'temple', '宮城県栗原市栗駒岩ケ崎裏山49',            '宮城県', 'active');
-- 第21番 観音寺（有壁）
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('観音寺（有壁）',    38.859500, 141.092700, 'temple', '宮城県栗原市金成有壁下大林17',            '宮城県', 'active');
-- 第22番 勝大寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('勝大寺',           38.816300, 141.068400, 'temple', '宮城県栗原市金成小迫字大光院11',           '宮城県', 'active');
-- 第23番 長承寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('長承寺',           38.677500, 141.183600, 'temple', '宮城県登米市中田町上沼大泉門畑28',         '宮城県', 'active');
-- 第24番 長谷寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('長谷寺',           38.665200, 141.175400, 'temple', '宮城県登米市中田町浅水字長谷山39',         '宮城県', 'active');
-- 第30番 補陀寺
INSERT INTO spots (name, lat, lng, type, address, prefecture, status) VALUES
('補陀寺',           38.899400, 141.563600, 'temple', '宮城県気仙沼市古町1-4-12',                '宮城県', 'active');


-- ============================================================
-- 3. 巡礼コースの INSERT
-- ============================================================
INSERT INTO pilgrimages (name, description, region, category, total_spots) VALUES
(
  '東北三十六不動尊霊場（宮城）',
  '東北六県に各6箇所、合計36の札所からなる不動明王霊場。宮城県内の6箇所（第25番〜第30番）を巡る。身代不動尊（気仙沼）、横山不動尊（登米）、神寺不動尊（美里）、五大堂（松島）、秋保大滝不動尊（仙台）、駒場滝不動尊（丸森）。',
  '宮城県',
  '不動霊場',
  6
),
(
  '奥州三十三観音霊場（宮城）',
  '旧陸奥国内（岩手・宮城・福島）にまたがる33箇所の観音霊場のうち、宮城県内の18箇所を巡る。名取の紹楽寺（第1番）に始まり、松島の瑞巌寺（第6番）、石巻・涌谷・登米・栗原・気仙沼の古刹を経て補陀寺（第30番）まで。',
  '宮城県',
  '観音霊場',
  18
);
