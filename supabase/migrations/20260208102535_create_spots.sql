
-- spot_type enum
CREATE TYPE public.spot_type AS ENUM ('shrine', 'temple');

-- spot_status enum
CREATE TYPE public.spot_status AS ENUM ('active', 'pending', 'merged');

-- spots テーブル
CREATE TABLE public.spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  type public.spot_type NOT NULL,
  address TEXT,
  status public.spot_status NOT NULL DEFAULT 'active',
  created_by_user_id UUID REFERENCES auth.users(id),
  merged_into_spot_id UUID REFERENCES public.spots(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 地図表示用インデックス
CREATE INDEX idx_spots_location ON public.spots (lat, lng);
CREATE INDEX idx_spots_status ON public.spots (status);

-- updated_at トリガー
CREATE TRIGGER on_spots_updated
  BEFORE UPDATE ON public.spots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active spots are viewable by everyone"
  ON public.spots FOR SELECT
  USING (status = 'active');

CREATE POLICY "Authenticated users can add pending spots"
  ON public.spots FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND status = 'pending');
