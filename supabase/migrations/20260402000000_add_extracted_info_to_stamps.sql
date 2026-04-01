-- stamps に AI 抽出結果カラム追加
ALTER TABLE public.stamps ADD COLUMN extracted_info JSONB;

CREATE INDEX idx_stamps_extracted_info ON public.stamps
  USING GIN (extracted_info) WHERE extracted_info IS NOT NULL;
