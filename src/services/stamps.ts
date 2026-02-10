import { supabase } from '@services/supabase';
import type { Stamp } from '@/types/supabase';

export async function fetchVisitedSpotIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('stamps').select('spot_id');

  if (error) {
    console.warn('fetchVisitedSpotIds error:', error.message);
    return new Set();
  }

  return new Set((data as { spot_id: string }[]).map(row => row.spot_id));
}

export async function fetchStampsBySpotId(spotId: string): Promise<Stamp[]> {
  const { data, error } = await supabase
    .from('stamps')
    .select('*')
    .eq('spot_id', spotId)
    .order('visited_at', { ascending: false });

  if (error) {
    console.warn('fetchStampsBySpotId error:', error.message);
    return [];
  }

  return data as Stamp[];
}

export function getStampImageUrl(imagePath: string): string {
  const { data } = supabase.storage.from('stamps').getPublicUrl(imagePath);
  return data.publicUrl;
}
