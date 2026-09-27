-- Issue #285: グロースの数字を数える（読み取りだけ・service role だけ）。
-- 返すのは件数だけ。user_id・メール・寺社名・座標・画像のパスは返さない。
-- 境目（日本時間の 0 時など）は Edge Function の純関数（growth-metrics/metrics.ts）が決めて渡す（D-3）。
--
-- STABLE なので、表を書き換える文をここに書くと Postgres がエラーにする（読み取りだけであることを DB が守る）。
-- auth.users を読むので SECURITY DEFINER。そのぶん service_role 以外からは呼べないようにし、
-- search_path を空にして、名前はすべて auth. / public. を付けて書く。
-- 日本時間の週（月曜はじまり）・月は AT TIME ZONE 'Asia/Tokyo' で切り、7日は interval '168 hours' で書く
-- （どちらもセッションのタイムゾーンに左右されない）。
CREATE FUNCTION public.growth_metrics_counts(
  p_period_start TIMESTAMPTZ,  -- この7日の始まり（含む）
  p_period_end   TIMESTAMPTZ,  -- この7日の終わり（含まない）= 今日の 0 時（日本時間）
  p_weeks_start  TIMESTAMPTZ,  -- 活性化: いちばん古い週の月曜 0 時
  p_weeks_end    TIMESTAMPTZ,  -- 今週の月曜 0 時（含まない）
  p_months_start TIMESTAMPTZ,  -- 継続: いちばん古い月の1日 0 時
  p_months_end   TIMESTAMPTZ   -- 今月の1日 0 時（含まない）
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH signups AS (
    SELECT u.id, u.created_at,
           to_char(date_trunc('week', u.created_at AT TIME ZONE 'Asia/Tokyo'), 'YYYY-MM-DD') AS week
    FROM auth.users u
    WHERE u.created_at >= p_weeks_start AND u.created_at < p_weeks_end
  ),
  activation AS (
    SELECT s.week, count(*) AS signups,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM public.stamps st
             WHERE st.user_id = s.id AND st.created_at < s.created_at + interval '168 hours'
           )) AS activated
    FROM signups s GROUP BY s.week
  ),
  monthly AS (  -- 最後の集団の「翌月」（今月）まで要るので、上の端は切らない
    SELECT DISTINCT st.user_id, date_trunc('month', st.created_at AT TIME ZONE 'Asia/Tokyo') AS month
    FROM public.stamps st
    WHERE st.created_at >= p_months_start
  ),
  retention AS (
    SELECT to_char(a.month, 'YYYY-MM') AS month, count(*) AS recorders, count(b.user_id) AS retained
    FROM monthly a
    LEFT JOIN monthly b ON b.user_id = a.user_id AND b.month = a.month + interval '1 month'
    WHERE a.month < (p_months_end AT TIME ZONE 'Asia/Tokyo')
    GROUP BY a.month
  )
  SELECT jsonb_build_object(
    'users_total',                (SELECT count(*) FROM auth.users),
    'users_period',               (SELECT count(*) FROM auth.users WHERE created_at >= p_period_start AND created_at < p_period_end),
    'stamps_total',               (SELECT count(*) FROM public.stamps),
    'stamps_period',              (SELECT count(*) FROM public.stamps WHERE created_at >= p_period_start AND created_at < p_period_end),
    'recorders_period',           (SELECT count(DISTINCT user_id) FROM public.stamps WHERE created_at >= p_period_start AND created_at < p_period_end),
    'research_period',            (SELECT count(*) FROM public.spot_research_requests WHERE created_at >= p_period_start AND created_at < p_period_end),
    'added_spots_total_active',   (SELECT count(*) FROM public.spots WHERE created_by_user_id IS NOT NULL AND status = 'active'),
    'added_spots_total_pending',  (SELECT count(*) FROM public.spots WHERE created_by_user_id IS NOT NULL AND status = 'pending'),
    'added_spots_period_active',  (SELECT count(*) FROM public.spots WHERE created_by_user_id IS NOT NULL AND status = 'active'  AND created_at >= p_period_start AND created_at < p_period_end),
    'added_spots_period_pending', (SELECT count(*) FROM public.spots WHERE created_by_user_id IS NOT NULL AND status = 'pending' AND created_at >= p_period_start AND created_at < p_period_end),
    'activation', COALESCE((SELECT jsonb_agg(jsonb_build_object('week', week, 'signups', signups, 'activated', activated) ORDER BY week) FROM activation), '[]'::jsonb),
    'retention',  COALESCE((SELECT jsonb_agg(jsonb_build_object('month', month, 'recorders', recorders, 'retained', retained) ORDER BY month) FROM retention), '[]'::jsonb)
  );
$$;

-- claim_spot_research と同じ形。呼べるのは service_role（Edge Function の中）だけ
REVOKE EXECUTE ON FUNCTION public.growth_metrics_counts(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.growth_metrics_counts(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
