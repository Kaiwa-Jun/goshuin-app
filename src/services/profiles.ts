import { supabase } from '@services/supabase';
import type { Profile } from '@/types/supabase';

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) {
    console.warn('fetchProfile error:', error.message);
    return null;
  }
  return data as Profile;
}

export async function updateDefaultPublicSetting(userId: string, value: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ default_stamp_public: value })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}
