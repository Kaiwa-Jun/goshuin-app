-- Issue #258: 参拝の予定（ある日に回る寺社と、その順番）
--
-- - 予定1つ = visit_plans 1行 + visit_plan_stops N行（position が回る順 0..N-1）
-- - 同じ日に予定は1つまで（カレンダーが「日 → 予定」で引く / D-2）
-- - 本人だけが読み書きする（RLS）
-- - 保存は save_visit_plan の1回で（予定の行と寺社の並びを1トランザクションで入れ替える / D-1）
CREATE TABLE public.visit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  planned_on DATE NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, planned_on)
);

CREATE TRIGGER on_visit_plans_updated
  BEFORE UPDATE ON public.visit_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.visit_plan_stops (
  plan_id UUID NOT NULL REFERENCES public.visit_plans(id) ON DELETE CASCADE,
  -- 寺社が消えたら予定からも落とす（merged は行が残るので、表示のときに落とす / D-4）
  spot_id UUID NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,
  position INT NOT NULL CHECK (position >= 0),
  PRIMARY KEY (plan_id, position),
  UNIQUE (plan_id, spot_id)
);

CREATE INDEX idx_visit_plan_stops_spot_id ON public.visit_plan_stops (spot_id);

-- RLS: 本人だけ
ALTER TABLE public.visit_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own visit plans"
  ON public.visit_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own visit plans"
  ON public.visit_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own visit plans"
  ON public.visit_plans FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own visit plans"
  ON public.visit_plans FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE public.visit_plan_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own visit plan stops"
  ON public.visit_plan_stops FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.visit_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));

CREATE POLICY "Users can insert own visit plan stops"
  ON public.visit_plan_stops FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.visit_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));

CREATE POLICY "Users can update own visit plan stops"
  ON public.visit_plan_stops FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.visit_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.visit_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));

CREATE POLICY "Users can delete own visit plan stops"
  ON public.visit_plan_stops FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.visit_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));

-- 保存（新規は p_plan_id = NULL）。SECURITY INVOKER なので RLS がそのまま効く
-- （他人の予定の id を渡しても UPDATE は 0 行になり、例外で止まる）
CREATE FUNCTION public.save_visit_plan(
  p_plan_id UUID,
  p_planned_on DATE,
  p_name TEXT,
  p_spot_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_plan_id IS NULL THEN
    INSERT INTO visit_plans (planned_on, name)
    VALUES (p_planned_on, p_name)
    RETURNING id INTO v_id;
  ELSE
    UPDATE visit_plans
    SET planned_on = p_planned_on, name = p_name
    WHERE id = p_plan_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'visit plan not found';
    END IF;
  END IF;

  DELETE FROM visit_plan_stops WHERE plan_id = v_id;
  INSERT INTO visit_plan_stops (plan_id, spot_id, position)
  SELECT v_id, t.s, (t.ord - 1)::INT
  FROM unnest(p_spot_ids) WITH ORDINALITY AS t(s, ord);

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_visit_plan(UUID, DATE, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_visit_plan(UUID, DATE, TEXT, UUID[]) TO authenticated;
