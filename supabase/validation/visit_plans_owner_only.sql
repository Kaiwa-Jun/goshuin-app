-- ============================================================
-- visit_plans / visit_plan_stops: 本人だけが読み書きでき、保存の RPC が順番を保つか（Issue #258）
--
-- 実行: npx supabase@latest db query --linked -f supabase/validation/visit_plans_owner_only.sql
--
-- ⚠ 必ずエラーで終わる。それで正しい。最後に RAISE EXCEPTION して、試しに入れた行をすべて巻き戻す。
--   期待値:
--     RESULT own_plan=visible other_plan=hidden other_stops=hidden update_other=0rows delete_other=0rows rpc_own=ok rpc_other=denied same_day=denied order=kept
--
-- SELECT・UPDATE・DELETE の拒否は例外にならず 0 行になるので件数で測る。
-- 既存のユーザーを2人と、active の寺社を3件使う
-- ============================================================

DO $$
DECLARE
  me    uuid;
  other uuid;
  s1 uuid; s2 uuid; s3 uuid;
  own_id   uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  rpc_id uuid;
  n int;
  own_plan text; other_plan text; other_stops text; update_other text; delete_other text;
  rpc_own text; rpc_other text; same_day text; order_v text;
BEGIN
  SELECT id INTO me FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO other FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO s1 FROM public.spots WHERE status = 'active' ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.spots WHERE status = 'active' ORDER BY id OFFSET 1 LIMIT 1;
  SELECT id INTO s3 FROM public.spots WHERE status = 'active' ORDER BY id OFFSET 2 LIMIT 1;

  -- postgres のまま、本人と他人の予定を1つずつ（遠い未来の日付で既存の予定と重ねない）
  INSERT INTO public.visit_plans (id, user_id, planned_on, name)
  VALUES (own_id, me, DATE '2099-01-01', '検証用・本人'),
         (other_id, other, DATE '2099-01-01', '検証用・他人');
  INSERT INTO public.visit_plan_stops (plan_id, spot_id, position)
  VALUES (own_id, s1, 0), (other_id, s1, 0), (other_id, s2, 1);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', me, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM public.visit_plans WHERE id = own_id;
  own_plan := CASE WHEN n = 1 THEN 'visible' ELSE 'hidden' END;
  SELECT count(*) INTO n FROM public.visit_plans WHERE id = other_id;
  other_plan := CASE WHEN n = 1 THEN 'visible' ELSE 'hidden' END;
  SELECT count(*) INTO n FROM public.visit_plan_stops WHERE plan_id = other_id;
  other_stops := CASE WHEN n = 0 THEN 'hidden' ELSE 'visible' END;

  UPDATE public.visit_plans SET name = '書き換え' WHERE id = other_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  update_other := n || 'rows';
  DELETE FROM public.visit_plans WHERE id = other_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  delete_other := n || 'rows';

  -- 本人の新しい予定を RPC で。渡した順（s3, s1, s2）が position 0..2 になるか
  BEGIN
    rpc_id := public.save_visit_plan(NULL, DATE '2099-01-02', '検証用・RPC', ARRAY[s3, s1, s2]);
    rpc_own := 'ok';
  EXCEPTION WHEN OTHERS THEN
    rpc_own := 'error';
  END;
  SELECT CASE WHEN array_agg(spot_id ORDER BY position) = ARRAY[s3, s1, s2]
              AND array_agg(position ORDER BY position) = ARRAY[0, 1, 2]
         THEN 'kept' ELSE 'broken' END
  INTO order_v FROM public.visit_plan_stops WHERE plan_id = rpc_id;

  -- 他人の予定の id を渡しても書き換えられない
  BEGIN
    PERFORM public.save_visit_plan(other_id, DATE '2099-01-03', '乗っ取り', ARRAY[s1, s2]);
    rpc_other := 'allowed';
  EXCEPTION WHEN OTHERS THEN
    rpc_other := 'denied';
  END;

  -- 同じ日（本人の 2099-01-01）に2つ目は入らない
  BEGIN
    PERFORM public.save_visit_plan(NULL, DATE '2099-01-01', '検証用・同じ日', ARRAY[s1, s2]);
    same_day := 'allowed';
  EXCEPTION WHEN unique_violation THEN
    same_day := 'denied';
  END;

  RAISE EXCEPTION 'RESULT own_plan=% other_plan=% other_stops=% update_other=% delete_other=% rpc_own=% rpc_other=% same_day=% order=%',
    own_plan, other_plan, other_stops, update_other, delete_other, rpc_own, rpc_other, same_day, order_v;
END $$;
