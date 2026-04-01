ALTER TABLE public.stamps ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_stamps_public_spot ON public.stamps (spot_id) WHERE is_public = true;

CREATE POLICY "Anyone can view public stamps"
  ON public.stamps FOR SELECT
  USING (is_public = true);

ALTER TABLE public.profiles ADD COLUMN default_stamp_public BOOLEAN NOT NULL DEFAULT false;

-- stamps.user_id → profiles.id の外部キー（PostgREST の join に必要）
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);
