
-- goshuincho テーブル
CREATE TABLE public.goshuincho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cover_image_path TEXT,
  started_at DATE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_goshuincho_user_id ON public.goshuincho (user_id);

-- updated_at トリガー
CREATE TRIGGER on_goshuincho_updated
  BEFORE UPDATE ON public.goshuincho
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- stamps テーブルに goshuincho_id の FK を追加
ALTER TABLE public.stamps
  ADD CONSTRAINT fk_stamps_goshuincho
  FOREIGN KEY (goshuincho_id) REFERENCES public.goshuincho(id);

-- RLS
ALTER TABLE public.goshuincho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goshuincho"
  ON public.goshuincho FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goshuincho"
  ON public.goshuincho FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goshuincho"
  ON public.goshuincho FOR UPDATE
  USING (auth.uid() = user_id);
