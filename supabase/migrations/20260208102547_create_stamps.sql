
-- stamps テーブル
CREATE TABLE public.stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id UUID NOT NULL REFERENCES public.spots(id),
  goshuincho_id UUID,
  visited_at DATE NOT NULL DEFAULT CURRENT_DATE,
  image_path TEXT NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_stamps_user_id ON public.stamps (user_id);
CREATE INDEX idx_stamps_spot_id ON public.stamps (spot_id);
CREATE INDEX idx_stamps_visited_at ON public.stamps (visited_at);

-- updated_at トリガー
CREATE TRIGGER on_stamps_updated
  BEFORE UPDATE ON public.stamps
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stamps"
  ON public.stamps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stamps"
  ON public.stamps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stamps"
  ON public.stamps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stamps"
  ON public.stamps FOR DELETE
  USING (auth.uid() = user_id);
