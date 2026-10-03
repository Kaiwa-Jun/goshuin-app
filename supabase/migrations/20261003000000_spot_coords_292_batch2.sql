-- Issue #292 第2弾: 寺社のマスタ（created_by_user_id が NULL の spots）の座標を 46 件直す。
-- 生成物。手で直さない。台帳 supabase/data/spot-coords-292.json から次で作る:
--   deno run -A supabase/scripts/spot-coords/main.ts generate --batch 2 --version 20261003000000
-- 1件ずつ「名前・都道府県・作成者なし」でちょうど1行に絞り、座標で分ける。
-- 全件が旧座標なら全件を直す / 全件が新座標なら何もしない（2回目）/ それ以外は例外で全体を止める。
-- マスタの寺社が1件も無い DB（seed を入れる前）では何もしない。
DO $spot_coords_292$
DECLARE
  fixes CONSTANT jsonb := $fixes$[
{"name":"宮城縣護國神社","prefecture":"宮城県","old_lat":38.2543,"old_lng":140.8561,"new_lat":38.252500,"new_lng":140.855556},
{"name":"宝珠山立石寺","prefecture":"山形県","old_lat":38.3126,"old_lng":140.4374,"new_lat":38.311863,"new_lng":140.434791},
{"name":"秩父今宮神社","prefecture":"埼玉県","old_lat":35.9939,"old_lng":139.0831,"new_lat":35.994917,"new_lng":139.080194},
{"name":"菊田神社","prefecture":"千葉県","old_lat":35.6816,"old_lng":140.0255,"new_lat":35.684167,"new_lng":140.026944},
{"name":"柏神社","prefecture":"千葉県","old_lat":35.8619,"old_lng":139.9748,"new_lat":35.859806,"new_lng":139.973750},
{"name":"意富比神社（船橋大神宮）","prefecture":"千葉県","old_lat":35.6893,"old_lng":139.9838,"new_lat":35.696365,"new_lng":139.992880},
{"name":"銭洗弁財天宇賀福神社","prefecture":"神奈川県","old_lat":35.3247,"old_lng":139.5401,"new_lat":35.325800,"new_lng":139.542000},
{"name":"旗上弁財天社","prefecture":"神奈川県","old_lat":35.3258,"old_lng":139.5574,"new_lat":35.323902,"new_lng":139.555971},
{"name":"白山神社","prefecture":"新潟県","old_lat":37.9183,"old_lng":139.0349,"new_lat":37.915611,"new_lng":139.037333},
{"name":"八海山尊神社","prefecture":"新潟県","old_lat":37.0308,"old_lng":138.9419,"new_lat":37.120533,"new_lng":138.950394},
{"name":"石浦神社","prefecture":"石川県","old_lat":36.56,"old_lng":136.6571,"new_lat":36.561194,"new_lng":136.659833},
{"name":"神明宮","prefecture":"石川県","old_lat":36.5597,"old_lng":136.647,"new_lat":36.558040,"new_lng":136.648889},
{"name":"菟橋神社","prefecture":"石川県","old_lat":36.304,"old_lng":136.4507,"new_lat":36.406501,"new_lng":136.445567},
{"name":"總持寺祖院","prefecture":"石川県","old_lat":37.212,"old_lng":136.7893,"new_lat":37.286400,"new_lng":136.771000},
{"name":"平泉寺白山神社","prefecture":"福井県","old_lat":36.044,"old_lng":136.5389,"new_lat":36.043917,"new_lng":136.542131},
{"name":"新倉富士浅間神社","prefecture":"山梨県","old_lat":35.5018,"old_lng":138.7985,"new_lat":35.500389,"new_lng":138.800139},
{"name":"橿森神社","prefecture":"岐阜県","old_lat":35.4213,"old_lng":136.7623,"new_lat":35.419675,"new_lng":136.764303},
{"name":"岐阜護國神社","prefecture":"岐阜県","old_lat":35.4361,"old_lng":136.7654,"new_lat":35.437002,"new_lng":136.776352},
{"name":"岐阜信長神社","prefecture":"岐阜県","old_lat":35.4209,"old_lng":136.7621,"new_lat":35.419774,"new_lng":136.764084},
{"name":"八剣宮","prefecture":"愛知県","old_lat":35.1268,"old_lng":136.9079,"new_lat":35.123498,"new_lng":136.908269},
{"name":"三尾神社","prefecture":"滋賀県","old_lat":35.0138,"old_lng":135.8508,"new_lat":35.008823,"new_lng":135.854172},
{"name":"百済寺","prefecture":"滋賀県","old_lat":35.0556,"old_lng":136.3289,"new_lat":35.126827,"new_lng":136.291512},
{"name":"大阪天満宮","prefecture":"大阪府","old_lat":34.693,"old_lng":135.513,"new_lat":34.696025,"new_lng":135.512619},
{"name":"石上神宮","prefecture":"奈良県","old_lat":34.5954,"old_lng":135.8511,"new_lat":34.597875,"new_lng":135.851673},
{"name":"元興寺","prefecture":"奈良県","old_lat":34.6768,"old_lng":135.8331,"new_lat":34.678056,"new_lng":135.831111},
{"name":"青岸渡寺","prefecture":"和歌山県","old_lat":33.6672,"old_lng":135.8903,"new_lat":33.669640,"new_lng":135.889893},
{"name":"大神山神社奥宮","prefecture":"鳥取県","old_lat":35.37,"old_lng":133.5361,"new_lat":35.388734,"new_lng":133.538519},
{"name":"松江護國神社","prefecture":"島根県","old_lat":35.475,"old_lng":133.0489,"new_lat":35.476703,"new_lng":133.049619},
{"name":"由加神社本宮","prefecture":"岡山県","old_lat":34.5444,"old_lng":133.8756,"new_lat":34.505917,"new_lng":133.851056},
{"name":"縣主神社","prefecture":"岡山県","old_lat":34.6142,"old_lng":133.5211,"new_lat":34.584848,"new_lng":133.495611},
{"name":"廣島護國神社","prefecture":"広島県","old_lat":34.4031,"old_lng":132.4597,"new_lat":34.401167,"new_lng":132.458750},
{"name":"赤間神宮","prefecture":"山口県","old_lat":33.9581,"old_lng":130.9472,"new_lat":33.959722,"new_lng":130.948472},
{"name":"松陰神社","prefecture":"山口県","old_lat":34.4117,"old_lng":131.4206,"new_lat":34.412139,"new_lng":131.418222},
{"name":"金泉寺","prefecture":"徳島県","old_lat":34.1428,"old_lng":134.4758,"new_lat":34.147436,"new_lng":134.468544},
{"name":"最御崎寺","prefecture":"高知県","old_lat":33.2489,"old_lng":134.1786,"new_lat":33.249008,"new_lng":134.175739},
{"name":"住吉神社（福岡）","prefecture":"福岡県","old_lat":33.5833,"old_lng":130.4125,"new_lat":33.585750,"new_lng":130.413750},
{"name":"龍造寺八幡宮","prefecture":"佐賀県","old_lat":33.2536,"old_lng":130.3011,"new_lat":33.255425,"new_lng":130.298531},
{"name":"高橋稲荷神社","prefecture":"熊本県","old_lat":32.7853,"old_lng":130.6658,"new_lat":32.782900,"new_lng":130.659000},
{"name":"臼杵石仏","prefecture":"大分県","old_lat":33.1167,"old_lng":131.7886,"new_lat":33.090110,"new_lng":131.762480},
{"name":"護国寺（那覇）","prefecture":"沖縄県","old_lat":26.2192,"old_lng":127.6689,"new_lat":26.220068,"new_lng":127.671579},
{"name":"安里八幡宮","prefecture":"沖縄県","old_lat":26.2233,"old_lng":127.6944,"new_lat":26.221111,"new_lng":127.694944},
{"name":"金武観音寺","prefecture":"沖縄県","old_lat":26.4556,"old_lng":127.9244,"new_lat":26.455319,"new_lng":127.921450},
{"name":"安国寺","prefecture":"沖縄県","old_lat":26.2194,"old_lng":127.7156,"new_lat":26.218528,"new_lng":127.713417},
{"name":"平安神宮","prefecture":"京都府","old_lat":35.0153,"old_lng":135.7837,"new_lat":35.016667,"new_lng":135.782222},
{"name":"蓮華王院（三十三間堂）","prefecture":"京都府","old_lat":34.9897,"old_lng":135.7727,"new_lat":34.987885,"new_lng":135.771713},
{"name":"明治神宮","prefecture":"東京都","old_lat":35.6741,"old_lng":139.703,"new_lat":35.676111,"new_lng":139.699167}
]$fixes$;
  eps CONSTANT float8 := 1e-6;
  expected CONSTANT int := 46;
  f record;
  n int;
  n_old int;
  n_new int;
  at_old int := 0;
  at_new int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.spots WHERE created_by_user_id IS NULL) THEN
    RAISE NOTICE 'spot_coords_292 batch2: マスタの寺社が無いので何もしない';
    RETURN;
  END IF;

  FOR f IN SELECT * FROM jsonb_to_recordset(fixes) AS x(name text, prefecture text, old_lat float8, old_lng float8, new_lat float8, new_lng float8)
  LOOP
    SELECT count(*),
           count(*) FILTER (WHERE abs(s.lat - f.old_lat) < eps AND abs(s.lng - f.old_lng) < eps),
           count(*) FILTER (WHERE abs(s.lat - f.new_lat) < eps AND abs(s.lng - f.new_lng) < eps)
      INTO n, n_old, n_new
      FROM public.spots s
     WHERE s.name = f.name AND s.prefecture = f.prefecture AND s.created_by_user_id IS NULL;
    IF n <> 1 THEN
      RAISE EXCEPTION 'spot_coords_292 batch2: %（%）: 名前と都道府県で % 行（1 行のはず）', f.name, f.prefecture, n;
    END IF;
    IF n_old = 1 THEN
      at_old := at_old + 1;
    ELSIF n_new = 1 THEN
      at_new := at_new + 1;
    ELSE
      RAISE EXCEPTION 'spot_coords_292 batch2: %（%）: 旧座標でも新座標でもない', f.name, f.prefecture;
    END IF;
  END LOOP;

  IF at_new = expected THEN
    RAISE NOTICE 'spot_coords_292 batch2: もう直っている（% 件）。何もしない', at_new;
    RETURN;
  END IF;
  IF at_new > 0 THEN
    RAISE EXCEPTION 'spot_coords_292 batch2: 直っている % 件と直っていない % 件が混ざっている', at_new, at_old;
  END IF;

  FOR f IN SELECT * FROM jsonb_to_recordset(fixes) AS x(name text, prefecture text, old_lat float8, old_lng float8, new_lat float8, new_lng float8)
  LOOP
    UPDATE public.spots s SET lat = f.new_lat, lng = f.new_lng
     WHERE s.name = f.name AND s.prefecture = f.prefecture AND s.created_by_user_id IS NULL
       AND abs(s.lat - f.old_lat) < eps AND abs(s.lng - f.old_lng) < eps;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'spot_coords_292 batch2: %（%）: 変わったのが % 行（1 行のはず）', f.name, f.prefecture, n;
    END IF;
  END LOOP;
END
$spot_coords_292$;
