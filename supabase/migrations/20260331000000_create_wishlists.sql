
-- wishlists テーブル（行きたいリスト）
CREATE TABLE public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id UUID NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, spot_id)
);

-- インデックス
CREATE INDEX idx_wishlists_user_id ON public.wishlists (user_id);
CREATE INDEX idx_wishlists_spot_id ON public.wishlists (spot_id);

-- RLS（SELECT/INSERT/DELETE のみ。UPDATE不要、toggle は DELETE + INSERT で実現）
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wishlists"
  ON public.wishlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wishlists"
  ON public.wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wishlists"
  ON public.wishlists FOR DELETE
  USING (auth.uid() = user_id);
