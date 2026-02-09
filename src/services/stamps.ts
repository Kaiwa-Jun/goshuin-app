import { supabase } from '@services/supabase';

export async function fetchVisitedSpotIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('stamps').select('spot_id');

  if (error) {
    console.warn('fetchVisitedSpotIds error:', error.message);
    return new Set();
  }

  return new Set((data as { spot_id: string }[]).map(row => row.spot_id));
}
