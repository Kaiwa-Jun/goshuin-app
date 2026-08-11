-- 限定御朱印ウォッチャー 第1弾 seed（東京都・宮城県・京都府の rank5 全29スポット）
-- 生成: 2026-08-02。全 URL は curl で HTTP 200 を確認済み（79/79）。
-- 運用ルール: URL は寺社の公式ドメインのみ。登録時に robots.txt と利用規約を目視確認し、
-- 拒否された場合は enabled = false にする（契約書 docs/issues/issue-104-limited-goshuin-watcher.md 参照）。
--
-- 特記事項:
-- * 仙台東照宮: 公式サイト s-toshogu.jp が HTTPS 非対応のため official 未登録（SNS リンクのみ）。HTTPS 対応後に追加する
-- * 浅草神社: 御朱印ページ /goshuin/ が 2026-08-02 時点で改ざんされていたためトップページで代替。復旧確認後に差し替える
-- * 平安神宮: SSL 中間証明書チェーンに不備あり。クローラーの fetch が失敗する場合は cron.job_run_details とログで確認する

INSERT INTO public.spot_info_sources (spot_id, url, source_type)
SELECT s.id, v.url, v.source_type
FROM (VALUES
  ('八坂神社', '京都府', 'https://www.yasaka-jinja.or.jp/prize_all/', 'official'),
  ('八坂神社', '京都府', 'https://www.yasaka-jinja.or.jp/news/', 'official'),
  ('八坂神社', '京都府', 'https://www.instagram.com/kyotogionyasaka/', 'sns_link'),
  ('伏見稲荷大社', '京都府', 'https://inari.jp/news/', 'official'),
  ('伏見稲荷大社', '京都府', 'https://www.instagram.com/fushimiinaritaisha_official', 'sns_link'),
  ('清水寺', '京都府', 'https://www.kiyomizudera.or.jp/news', 'official'),
  ('清水寺', '京都府', 'https://www.instagram.com/feel_kiyomizudera/', 'sns_link'),
  ('賀茂御祖神社（下鴨神社）', '京都府', 'https://www.shimogamo-jinja.or.jp/blog', 'official'),
  ('賀茂御祖神社（下鴨神社）', '京都府', 'https://x.com/kamomioyajinja', 'sns_link'),
  ('賀茂御祖神社（下鴨神社）', '京都府', 'https://www.instagram.com/kamomioyajinja', 'sns_link'),
  ('平安神宮', '京都府', 'https://www.heianjingu.or.jp/news/', 'official'),
  ('平安神宮', '京都府', 'https://x.com/kyotoheianjingu', 'sns_link'),
  ('平安神宮', '京都府', 'https://www.instagram.com/heianjingu_official/', 'sns_link'),
  ('鹿苑寺（金閣寺）', '京都府', 'https://www.shokoku-ji.jp/kinkakuji/news/', 'official'),
  ('鹿苑寺（金閣寺）', '京都府', 'https://www.instagram.com/rokuonji_kinkakuji.official/', 'sns_link'),
  ('北野天満宮', '京都府', 'https://kitanotenmangu.or.jp/news/', 'official'),
  ('北野天満宮', '京都府', 'https://x.com/kitano_bunka', 'sns_link'),
  ('北野天満宮', '京都府', 'https://www.instagram.com/kitano_tenmangu/', 'sns_link'),
  ('平等院', '京都府', 'https://www.byodoin.or.jp/guide/goshuin/', 'official'),
  ('平等院', '京都府', 'https://www.byodoin.or.jp/news/', 'official'),
  ('平等院', '京都府', 'https://www.instagram.com/byodoin_temple_official/', 'sns_link'),
  ('東寺（教王護国寺）', '京都府', 'https://toji.or.jp/nokyosho/', 'official'),
  ('賀茂別雷神社（上賀茂神社）', '京都府', 'https://www.kamigamojinja.jp/news/', 'official'),
  ('賀茂別雷神社（上賀茂神社）', '京都府', 'https://www.instagram.com/kamigamojinja.official/', 'sns_link'),
  ('大崎八幡宮', '宮城県', 'https://www.oosaki-hachiman.or.jp/gosyuin/', 'official'),
  ('大崎八幡宮', '宮城県', 'https://www.oosaki-hachiman.or.jp/', 'official'),
  ('仙台東照宮', '宮城県', 'https://x.com/Sendai_Toshogu', 'sns_link'),
  ('仙台東照宮', '宮城県', 'https://www.instagram.com/sendai_toshogu/', 'sns_link'),
  ('榴岡天満宮', '宮城県', 'https://tsutsujigaokatenmangu.jp/category/news/', 'official'),
  ('榴岡天満宮', '宮城県', 'https://www.instagram.com/tsutsujigaoka_tenmangu/', 'sns_link'),
  ('竹駒神社', '宮城県', 'https://takekomajinja.jp/s/jyuyo.html', 'official'),
  ('竹駒神社', '宮城県', 'https://takekomajinja.jp/', 'official'),
  ('竹駒神社', '宮城県', 'https://x.com/takekomainari', 'sns_link'),
  ('竹駒神社', '宮城県', 'https://www.instagram.com/takekoma.inari/', 'sns_link'),
  ('志波彦神社・鹽竈神社', '宮城県', 'https://shiogamajinja.jp/about/goshuin.html', 'official'),
  ('志波彦神社・鹽竈神社', '宮城県', 'https://shiogamajinja.jp/news/', 'official'),
  ('宮城縣護國神社', '宮城県', 'https://gokokujinja.org/kitou/goshuin.html', 'official'),
  ('宮城縣護國神社', '宮城県', 'https://gokokujinja.org/', 'official'),
  ('宮城縣護國神社', '宮城県', 'https://x.com/GokokuMiyagi', 'sns_link'),
  ('宮城縣護國神社', '宮城県', 'https://www.instagram.com/gokokumiyagi/', 'sns_link'),
  ('瑞巌寺', '宮城県', 'https://www.zuiganji.or.jp/guide/', 'official'),
  ('瑞巌寺', '宮城県', 'https://www.zuiganji.or.jp/', 'official'),
  ('瑞巌寺', '宮城県', 'https://x.com/Zuiganji_Temple', 'sns_link'),
  ('瑞巌寺', '宮城県', 'https://www.instagram.com/zuiganji.temple/', 'sns_link'),
  ('金蛇水神社', '宮城県', 'https://kanahebi.cdx.jp/', 'official'),
  ('櫻岡大神宮', '宮城県', 'https://sakuragaoka6826.sakura.ne.jp/posts/news_archive.html', 'official'),
  ('櫻岡大神宮', '宮城県', 'https://sakuragaoka6826.sakura.ne.jp/menu.html', 'official'),
  ('櫻岡大神宮', '宮城県', 'https://x.com/sakuragaoka729', 'sns_link'),
  ('櫻岡大神宮', '宮城県', 'https://www.instagram.com/sakuragaoka6826/', 'sns_link'),
  ('浅草寺', '東京都', 'https://www.senso-ji.jp/visit/jumotsu3.html', 'official'),
  ('浅草寺', '東京都', 'https://www.senso-ji.jp/info/', 'official'),
  ('浅草寺', '東京都', 'https://x.com/sensouji_O', 'sns_link'),
  ('浅草寺', '東京都', 'https://www.instagram.com/sensouji_official/', 'sns_link'),
  ('明治神宮', '東京都', 'https://www.meijijingu.or.jp/sanpai/2.php', 'official'),
  ('明治神宮', '東京都', 'https://www.meijijingu.or.jp/news/', 'official'),
  ('神田神社', '東京都', 'https://www.kandamyoujin.or.jp/news/', 'official'),
  ('神田神社', '東京都', 'https://x.com/kanda_myoujin', 'sns_link'),
  ('神田神社', '東京都', 'https://www.instagram.com/kandamyoujin/', 'sns_link'),
  ('靖國神社', '東京都', 'https://www.yasukuni.or.jp/news.html', 'official'),
  ('靖國神社', '東京都', 'https://www.instagram.com/yasukuni.official/', 'sns_link'),
  ('靖國神社', '東京都', 'https://www.instagram.com/yasukunijinja/', 'sns_link'),
  ('浅草神社', '東京都', 'https://asakusajinja.jp/', 'official'),
  ('浅草神社', '東京都', 'https://x.com/asakusajinja', 'sns_link'),
  ('浅草神社', '東京都', 'https://www.instagram.com/asakusajinja/', 'sns_link'),
  ('湯島天満宮', '東京都', 'https://www.yushimatenjin.or.jp/pc/page/syuin.htm', 'official'),
  ('湯島天満宮', '東京都', 'https://www.yushimatenjin.or.jp/', 'official'),
  ('湯島天満宮', '東京都', 'https://x.com/_yushimatenjin_', 'sns_link'),
  ('東京大神宮', '東京都', 'https://www.tokyodaijingu.or.jp/', 'official'),
  ('東京大神宮', '東京都', 'https://x.com/tokyodaijingu', 'sns_link'),
  ('東京大神宮', '東京都', 'https://www.instagram.com/tokyodaijingu/', 'sns_link'),
  ('日枝神社', '東京都', 'https://www.hiejinja.net/news/', 'official'),
  ('日枝神社', '東京都', 'https://x.com/sannouhiejinja', 'sns_link'),
  ('日枝神社', '東京都', 'https://www.instagram.com/hiejinja/', 'sns_link'),
  ('烏森神社', '東京都', 'https://karasumorijinja.or.jp/%E5%BE%A1%E6%9C%B1%E5%8D%B0', 'official'),
  ('烏森神社', '東京都', 'https://karasumorijinja.or.jp/%e6%96%b0%e7%9d%80%e6%83%85%e5%a0%b1', 'official'),
  ('烏森神社', '東京都', 'https://x.com/koikichi_k', 'sns_link'),
  ('増上寺', '東京都', 'https://www.zojoji.or.jp/news/', 'official'),
  ('増上寺', '東京都', 'https://x.com/zojoji_official', 'sns_link'),
  ('増上寺', '東京都', 'https://www.instagram.com/zojoji_enzan1393_official/', 'sns_link')
) AS v(spot_name, prefecture, url, source_type)
JOIN public.spots s ON s.name = v.spot_name AND s.prefecture = v.prefecture
ON CONFLICT (spot_id, url) DO NOTHING;

-- 投入結果の確認:
-- select s.name, src.source_type, src.url from spot_info_sources src join spots s on s.id = src.spot_id order by s.prefecture, s.name;
-- 29スポット・79行になるはず（JOIN で名前不一致があると行が減るので件数を必ず確認する）
