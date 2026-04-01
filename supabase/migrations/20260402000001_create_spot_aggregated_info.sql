-- スポット集約情報テーブル作成
CREATE TABLE public.spot_aggregated_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,
  info_type TEXT NOT NULL,
  info_data JSONB NOT NULL,
  source_stamp_ids UUID[] NOT NULL DEFAULT '{}',
  confidence_score REAL NOT NULL DEFAULT 0,
  last_reported_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_spot_aggregated_info_spot_type
  ON public.spot_aggregated_info (spot_id, info_type);

-- RLS: 全ユーザー閲覧可能
ALTER TABLE public.spot_aggregated_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spot aggregated info"
  ON public.spot_aggregated_info FOR SELECT USING (true);

CREATE POLICY "Service role can manage spot aggregated info"
  ON public.spot_aggregated_info FOR ALL USING (auth.role() = 'service_role');
