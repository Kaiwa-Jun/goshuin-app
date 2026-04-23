-- handle_new_user() を上書きして、デフォルト御朱印帳の自動作成を追加
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);

  INSERT INTO public.goshuincho (user_id, name, is_default, started_at)
  VALUES (NEW.id, 'デフォルト御朱印帳', true, CURRENT_DATE);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
