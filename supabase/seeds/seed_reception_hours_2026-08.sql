-- 受付時間の seed（D-6 段階1・2026-08-11 収集）
--
-- ⚠️ このファイルはまだ本番に流していない。実行の可否はユーザー判断。
--    測定結果と3つの案は docs/project/reception-hours-yield-2026-08.md を参照。
--
-- 実行方法: Supabase ダッシュボードの SQL Editor に貼って実行する。
--   ⚠️ `supabase db push` は使わないこと（migration 履歴がローカルと本番で乖離している。
--      経緯は .claude/harness/handoff.md の「supabase db push を使ってはいけない」を参照）
--
-- 前提:
--   - `spot_aggregated_info` は (spot_id, info_type) の UPSERT で運用される。
--     `extract-spot-info` は delete を一切しないので、この seed 行はメモが来るまで残る
--   - `reception_hours` の集約は "Latest wins"（extract-spot-info/index.ts:220-223）なので、
--     誰かがメモに受付時間を書けばその時点で自動的に上書きされる。優先順位のコードは不要
--   - `info_data.notes` は SpotInfoSection が「受付 9:00〜17:00（notes）」の形で描画する
--     （SpotInfoSection.tsx:26-33）。取得日の併記に追加実装は要らない
--
-- ⚠️ spot_id は UUID 直書き。スポット名は一意ではない（八坂神社が2件・日枝神社が3件ある）ため、
--    名前で引く SQL に書き換えないこと。
--
-- source_stamp_ids は空配列（NOT NULL 制約があるため必須）。ユーザーのメモ由来ではないことを表す。
-- confidence_score は 0.7 固定: 公式サイトという出所は堅いが、単一観測で古くなりうるため、
-- メモ3件以上の 0.8 より低く、単発メモの 0.3 より高い位置に置く。

begin;

insert into spot_aggregated_info
  (spot_id, info_type, info_data, source_stamp_ids, confidence_score, last_reported_at)
values
  -- ============================================================
  -- explicit: 御朱印・朱印所・納経所と明記されているもの（8件）
  -- ============================================================

  -- 平等院（京都）https://www.byodoin.or.jp/guide/goshuin/
  ('0f1eb055-5ed5-4be7-b504-ff83245d67e1', 'reception_hours',
   '{"open":"09:10","close":"17:00","notes":"受付終了16:45・2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- 宮城縣護國神社（宮城）https://gokokujinja.org/kitou/goshuin.html
  ('0f9358fc-8744-4ec0-a05e-ee00790616ff', 'reception_hours',
   '{"open":"09:00","close":"16:00","notes":"2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- 竹駒神社（宮城）https://takekomajinja.jp/s/jyuyo.html
  ('be768334-ce39-4ae5-be94-0acc1021db7e', 'reception_hours',
   '{"open":"09:00","close":"16:00","notes":"社務所祈祷受付にて頒布・2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- 浅草寺（東京）https://www.senso-ji.jp/visit/jumotsu3.html
  ('c8224a0d-f5d6-4f9b-a4df-ec3d04406cb3', 'reception_hours',
   '{"open":"08:00","close":"16:30","notes":"2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- 日枝神社（東京）https://www.hiejinja.net/ 「授与所・朱印所」
  ('dd3a6aa8-c152-490c-9135-3be2a82bdf80', 'reception_hours',
   '{"open":"08:00","close":"16:00","notes":"2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- 東京大神宮（東京）https://www.tokyodaijingu.or.jp/ 「朱印所」
  ('a4b06cbb-ee41-41aa-8cd7-b9df1e028a77', 'reception_hours',
   '{"open":"09:00","close":"17:00","notes":"2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- 明治神宮（東京）https://www.meijijingu.or.jp/sanpai/2.php
  -- ⚠️ 終了が「閉門まで」で月ごとに変わるため close を置けない。open のみ + notes
  ('7f86dda5-6f76-4e17-9599-e58687531b2c', 'reception_hours',
   '{"open":"09:00","notes":"長殿にて9:00〜閉門まで（閉門時刻は月により変動）・2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- 瑞巌寺（宮城）https://www.zuiganji.or.jp/guide/
  -- ⚠️ 最終受付が季節で4段階のため close を置けない。open のみ + notes
  ('56c63b46-4b26-49ac-8d58-ee9403950c35', 'reception_hours',
   '{"open":"08:30","notes":"最終受付 4-9月16:30／10・3月16:00／11・2月15:30／12-1月15:00・2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- ============================================================
  -- proxy: 授与所・社務所など、御朱印専用ではない時間（5件）
  -- ⚠️ 実際の御朱印受付はこれより短いことがある。notes に出典を必ず書く
  --    案A（explicit のみ）を採る場合はここから下を削除して実行する
  -- ============================================================

  -- 湯島天満宮（東京）https://www.yushimatenjin.or.jp/pc/page/syuin.htm
  -- ⚠️ 社務所は19:00までだが授与は17:00終了。短い方を close に置く
  ('b58877c7-81eb-4d2e-9f6b-db126e9023fc', 'reception_hours',
   '{"open":"09:00","close":"17:00","notes":"社務所は19:00まで／授与は17:00終了・2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- ⚠️ 金蛇水神社（宮城）https://kanahebi.cdx.jp/ は【意図的に除外】
  --    ページが文字化けしており、2回抽出して結果が食い違った:
  --      1回目「祈祷受付時間 8:00-16:00」/ 2回目「御問い合わせは就業時間帯 8:00-16:00」
  --    後者なら事務所の営業時間であって御朱印の受付時間の根拠にならない。
  --    現地または電話で確認が取れたら下記を有効化する。
  -- ('7c2a43f5-826a-4586-a852-d69790e8d859', 'reception_hours',
  --  '{"open":"08:00","close":"16:00","notes":"要確認・2026年8月時点／公式サイト"}'::jsonb,
  --  '{}', 0.5, '2026-08-11T00:00:00Z'),

  -- 八坂神社（京都）https://www.yasaka-jinja.or.jp/
  ('e6973325-92d8-4766-9482-4116a52011c4', 'reception_hours',
   '{"open":"09:00","close":"17:00","notes":"社務所受付時間・2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- 北野天満宮（京都）https://kitanotenmangu.or.jp/
  ('62ba42a3-88ef-443e-b722-83d725e224d7', 'reception_hours',
   '{"open":"09:00","close":"19:30","notes":"授与所の時間・2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z'),

  -- 浅草神社（東京）https://asakusajinja.jp/
  -- ⚠️ 平日と土日祝で異なるため、短い方（平日）を close に置き notes で補う
  ('86e8a5f8-582e-462a-9a49-593866121d9e', 'reception_hours',
   '{"open":"09:00","close":"16:00","notes":"社務時間 平日〜16:00／土日祝〜16:30・2026年8月時点／公式サイト"}'::jsonb,
   '{}', 0.7, '2026-08-11T00:00:00Z')

-- ⚠️ 既にユーザーのメモから作られた行がある場合は上書きしない（D-6「メモが勝つ」）。
--    where 節で「source_stamp_ids が空 = seed 由来の行」だけを更新対象にしている。
--    これがないと、宮城縣護國神社の既存行（メモ由来・9:00〜17:00・2026-04-01）を
--    公式サイトの値（9:00〜16:00）で潰してしまう。
--    この形なら seed の再実行で seed 行だけを更新できる。
on conflict (spot_id, info_type) do update
  set info_data        = excluded.info_data,
      confidence_score = excluded.confidence_score,
      last_reported_at = excluded.last_reported_at,
      updated_at       = now()
  where spot_aggregated_info.source_stamp_ids = '{}';

-- 確認用（実行後に目視すること）
select s.name, a.info_data, a.confidence_score
from spot_aggregated_info a
join spots s on s.id = a.spot_id
where a.info_type = 'reception_hours'
order by s.name;

commit;
