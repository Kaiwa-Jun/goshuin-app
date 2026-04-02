-- 巡礼コース定義テーブル
CREATE TABLE public.pilgrimages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  region text,
  category text,
  total_spots integer NOT NULL,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pilgrimages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pilgrimages are viewable by everyone"
  ON public.pilgrimages FOR SELECT
  USING (is_active = true);

-- 巡礼×スポット中間テーブル
CREATE TABLE public.pilgrimage_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilgrimage_id uuid NOT NULL REFERENCES public.pilgrimages(id) ON DELETE CASCADE,
  spot_id uuid NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,
  sort_order integer,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pilgrimage_id, spot_id)
);

ALTER TABLE public.pilgrimage_spots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pilgrimage spots are viewable by everyone"
  ON public.pilgrimage_spots FOR SELECT
  USING (true);
