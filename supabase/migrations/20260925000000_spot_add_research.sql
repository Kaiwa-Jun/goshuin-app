-- Issue #248: 見つからない寺社を AI で調べて追加する
--
-- 1. spots: 本人には pending も見せる（#184 の「追加した本人にも見えない」を解く。
--    stamps は spots!inner で結合しているので、pending に付けた記録も御朱印帳に戻る）
-- 2. spots への INSERT はクライアントからやめる。Edge Function add-spot が service role で入れる
--    （クライアントに入れさせると、公開の基準を通さずに行を作れる）
-- 3. spot_research_requests: research-spot の候補の置き場 + 1日の回数の台帳。
--    ポリシーを作らない = anon / authenticated からは読めず書けない（service role だけ）。
--    調べる手がかり（都道府県・市区町村）は保存しない
DROP POLICY "Active spots are viewable by everyone" ON public.spots;
CREATE POLICY "Active spots and own spots are viewable"
  ON public.spots FOR SELECT
  USING (status = 'active' OR created_by_user_id = auth.uid());

DROP POLICY "Authenticated users can add pending spots" ON public.spots;

CREATE TABLE public.spot_research_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spot_research_requests_user_created
  ON public.spot_research_requests (user_id, created_at DESC);

ALTER TABLE public.spot_research_requests ENABLE ROW LEVEL SECURITY;
