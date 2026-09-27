-- ============================================================
-- growth_metrics_counts: 本番で数が合うか・service_role のほかは呼べないか（Issue #285 / H-3）
--
-- 実行: supabase db query --linked -f supabase/validation/growth_metrics_check.sql
--
-- ⚠ 必ずエラーで終わる。それで正しい。最後に RAISE EXCEPTION して、何も残さない。
--   期待値:
--     RESULT definer=yes stable=yes users=match stamps=match signups=match authenticated=denied anon=denied
--
-- 数そのものは出さない（一致したか・拒まれたかだけ）。
-- 関数は Edge Function と同じ service_role で呼び、同じ境目で直接数えた数と比べる。
-- users=match にならずに auth.users の権限エラーで止まったら、関数の持ち主（postgres）が auth.users を読めていない。
-- 境目は metricWindows と同じ考え方（日本時間の今日 0 時の前のまる7日・今週の前の4週・今月の前の6か月）
-- ============================================================

DO $$
DECLARE
  today_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo';
  week_start  timestamptz := date_trunc('week', now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo';
  month_start timestamptz := date_trunc('month', now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo';
  period_start timestamptz := today_start - interval '168 hours';
  weeks_start  timestamptz := week_start - interval '672 hours';
  months_start timestamptz := (date_trunc('month', now() AT TIME ZONE 'Asia/Tokyo') - interval '6 months') AT TIME ZONE 'Asia/Tokyo';
  counts jsonb;
  definer_v text; stable_v text; users_v text; stamps_v text; signups_v text; authenticated_v text; anon_v text;
BEGIN
  SELECT CASE WHEN p.prosecdef THEN 'yes' ELSE 'no' END,
         CASE WHEN p.provolatile = 's' THEN 'yes' ELSE 'no' END
  INTO definer_v, stable_v
  FROM pg_proc p
  WHERE p.oid = 'public.growth_metrics_counts(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz)'::regprocedure;

  -- Edge Function と同じ service_role で呼ぶ
  SET LOCAL ROLE service_role;
  counts := public.growth_metrics_counts(
    p_period_start => period_start, p_period_end => today_start,
    p_weeks_start => weeks_start, p_weeks_end => week_start,
    p_months_start => months_start, p_months_end => month_start
  );
  RESET ROLE;

  users_v := CASE
    WHEN (counts ->> 'users_total')::bigint = (SELECT count(*) FROM auth.users)
     AND (counts ->> 'users_period')::bigint =
         (SELECT count(*) FROM auth.users WHERE created_at >= period_start AND created_at < today_start)
    THEN 'match' ELSE 'mismatch' END;

  stamps_v := CASE
    WHEN (counts ->> 'stamps_total')::bigint = (SELECT count(*) FROM public.stamps)
     AND (counts ->> 'stamps_period')::bigint =
         (SELECT count(*) FROM public.stamps WHERE created_at >= period_start AND created_at < today_start)
     AND (counts ->> 'recorders_period')::bigint =
         (SELECT count(DISTINCT user_id) FROM public.stamps WHERE created_at >= period_start AND created_at < today_start)
    THEN 'match' ELSE 'mismatch' END;

  -- 週ごとの登録の合計が、4週ぶんを直接数えた数と同じ
  signups_v := CASE
    WHEN (SELECT COALESCE(sum((w ->> 'signups')::bigint), 0) FROM jsonb_array_elements(counts -> 'activation') w) =
         (SELECT count(*) FROM auth.users WHERE created_at >= weeks_start AND created_at < week_start)
    THEN 'match' ELSE 'mismatch' END;

  -- ログインした人（authenticated）と anon からは呼べない。拒まれた例外で SET LOCAL ROLE も巻き戻る
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.growth_metrics_counts(period_start, today_start, weeks_start, week_start, months_start, month_start);
    authenticated_v := 'allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    authenticated_v := 'denied';
  END;
  RESET ROLE;

  BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.growth_metrics_counts(period_start, today_start, weeks_start, week_start, months_start, month_start);
    anon_v := 'allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    anon_v := 'denied';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'RESULT definer=% stable=% users=% stamps=% signups=% authenticated=% anon=%',
    definer_v, stable_v, users_v, stamps_v, signups_v, authenticated_v, anon_v;
END $$;
