-- 限定御朱印ウォッチャー: 巡回対象の情報ソース（運営が登録する公式サイト/RSS/SNSリンク）
CREATE TABLE public.spot_info_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('official', 'rss', 'sns_link')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  content_hash TEXT,
  last_crawled_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 同一スポットに同一 URL を重複登録させない
CREATE UNIQUE INDEX idx_spot_info_sources_spot_url
  ON public.spot_info_sources (spot_id, url);

-- 巡回キュー用（未クロール優先 → 最終クロールが古い順）
CREATE INDEX idx_spot_info_sources_crawl_queue
  ON public.spot_info_sources (last_crawled_at NULLS FIRST)
  WHERE enabled = true AND source_type <> 'sns_link';

-- SNS リンク表示用
CREATE INDEX idx_spot_info_sources_sns
  ON public.spot_info_sources (spot_id)
  WHERE enabled = true AND source_type = 'sns_link';

-- RLS: 閲覧は全員可・書き込みは service_role のみ（spot_aggregated_info と同型）
ALTER TABLE public.spot_info_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spot info sources"
  ON public.spot_info_sources FOR SELECT USING (true);

CREATE POLICY "Service role can manage spot info sources"
  ON public.spot_info_sources FOR ALL USING (auth.role() = 'service_role');
