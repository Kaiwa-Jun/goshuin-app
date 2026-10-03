-- Issue #302: 地図のピンのシートの帯に出す寺社の写真（Wikimedia Commons の写真を R2 に置いたもの）。
-- 1 寺社 1 枚（spot_id）・1 ファイル 1 寺社（r2_key）。中身は台帳 supabase/data/spot-photos-302.json から
-- 作る migration（20261004010000_spot_photos_302_batch1.sql）で入れる。
-- 読むのは承認済みだけ（誰でも）・書くのは service_role だけ（spot_info_sources と同じ形）。
-- withdrawn は、撮影者から外してほしいと言われた・別の寺社と分かったときに、行を消さずに出さなくするため
CREATE TABLE public.spot_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL UNIQUE REFERENCES public.spots(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE CHECK (r2_key ~ '^spot-photos/[0-9a-f]{40}\.(jpg|png)$'),
  -- Commons の元の写真の縦横（縦横比にだけ使う）
  width INT NOT NULL CHECK (width > 0),
  height INT NOT NULL CHECK (height > 0),
  -- 見せたい所の縦の位置（0 = 上の端・1 = 下の端）
  focus_y REAL NOT NULL CHECK (focus_y BETWEEN 0 AND 1),
  -- 撮影者・ライセンスは Commons の表示のまま。author が null は Public domain・CC0 だけ
  author TEXT,
  license TEXT NOT NULL,
  license_url TEXT,
  source_url TEXT NOT NULL CHECK (source_url LIKE 'https://commons.wikimedia.org/wiki/File:%'),
  is_cropped BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER on_spot_photos_updated
  BEFORE UPDATE ON public.spot_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS: 閲覧は承認済みだけ（誰でも）・書き込みは service_role のみ
ALTER TABLE public.spot_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved spot photos"
  ON public.spot_photos FOR SELECT USING (status = 'approved');

CREATE POLICY "Service role can manage spot photos"
  ON public.spot_photos FOR ALL USING (auth.role() = 'service_role');
