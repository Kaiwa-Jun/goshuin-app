-- stamps: ギャラリー画面の「ユーザーの御朱印を日付順表示」用
CREATE INDEX idx_stamps_user_visited
  ON public.stamps (user_id, visited_at DESC);

-- goshuincho: 本人の御朱印帳を削除可能に（デフォルトは削除不可）
CREATE POLICY "Users can delete own non-default goshuincho"
  ON public.goshuincho FOR DELETE
  USING (auth.uid() = user_id AND is_default = false);
