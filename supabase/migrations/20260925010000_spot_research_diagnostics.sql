-- Issue #248: research-spot の候補が0件だったとき、理由を追えるようにする。
-- 残すのは応答の形（stop_reason・ブロックの種類と数・検索結果の数・検索のエラーコード・捨てた数）だけ。
-- モデルの本文・手がかり（市区町村）は残さない
ALTER TABLE public.spot_research_requests ADD COLUMN diagnostics JSONB;
