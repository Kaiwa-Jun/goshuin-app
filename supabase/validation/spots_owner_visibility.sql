-- ============================================================
-- spots: 本人には pending が見え、他人の pending は見えず、クライアントから INSERT できないか（Issue #248）
--
-- 実行: npx supabase@latest db query --linked -f supabase/validation/spots_owner_visibility.sql
--
-- ⚠ 必ずエラーで終わる。それで正しい。最後に RAISE EXCEPTION して、試しに入れた行をすべて巻き戻す。
--   期待値:
--     RESULT own_pending=visible other_pending=hidden active=visible own_pending_stamp_join=visible insert=denied research_select=denied
--
-- SELECT の拒否は例外にならず 0 行になるので、見える・見えないは件数で測る（例外で測るのは INSERT だけ）。
-- created_by_user_id は auth.users への FK なので、既存のユーザーを2人使う
-- ============================================================

DO $$
DECLARE
  me    uuid;
  other uuid;
  own_spot   uuid := gen_random_uuid();
  other_spot uuid := gen_random_uuid();
  active_spot uuid;
  n int;
  own_pending text; other_pending text; active_v text; stamp_join text; insert_v text; research_v text;
BEGIN
  SELECT id INTO me FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO other FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO active_spot FROM public.spots WHERE status = 'active' LIMIT 1;

  INSERT INTO public.spots (id, name, lat, lng, type, status, created_by_user_id)
  VALUES (own_spot, '検証用・本人', 38.0, 141.0, 'shrine', 'pending', me),
         (other_spot, '検証用・他人', 38.0, 141.0, 'shrine', 'pending', other);
  INSERT INTO public.stamps (user_id, spot_id, image_path) VALUES (me, own_spot, 'validation/check.jpg');
  INSERT INTO public.spot_research_requests (user_id) VALUES (me);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', me, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM public.spots WHERE id = own_spot;
  own_pending := CASE WHEN n = 1 THEN 'visible' ELSE 'hidden' END;
  SELECT count(*) INTO n FROM public.spots WHERE id = other_spot;
  other_pending := CASE WHEN n = 1 THEN 'visible' ELSE 'hidden' END;
  SELECT count(*) INTO n FROM public.spots WHERE id = active_spot;
  active_v := CASE WHEN n = 1 THEN 'visible' ELSE 'hidden' END;
  SELECT count(*) INTO n FROM public.stamps s JOIN public.spots p ON p.id = s.spot_id WHERE p.id = own_spot;
  stamp_join := CASE WHEN n = 1 THEN 'visible' ELSE 'hidden' END;
  SELECT count(*) INTO n FROM public.spot_research_requests;
  research_v := CASE WHEN n = 0 THEN 'denied' ELSE 'allowed' END;

  BEGIN
    INSERT INTO public.spots (name, lat, lng, type, status, created_by_user_id)
    VALUES ('検証用・INSERT', 38.0, 141.0, 'shrine', 'pending', me);
    insert_v := 'allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    insert_v := 'denied';
  END;

  RAISE EXCEPTION 'RESULT own_pending=% other_pending=% active=% own_pending_stamp_join=% insert=% research_select=%',
    own_pending, other_pending, active_v, stamp_join, insert_v, research_v;
END $$;
