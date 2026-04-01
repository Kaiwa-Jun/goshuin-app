import { supabase } from '@services/supabase';
import type { SpotAggregatedInfo } from '@/types/supabase';

export async function fetchSpotAggregatedInfo(spotId: string): Promise<SpotAggregatedInfo[]> {
  const { data, error } = await supabase
    .from('spot_aggregated_info')
    .select('*')
    .eq('spot_id', spotId);

  if (error) {
    console.warn('Failed to fetch spot aggregated info:', error.message);
    return [];
  }

  return data ?? [];
}

export async function triggerExtraction(stampId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('extract-spot-info', {
    body: { stamp_id: stampId },
  });

  if (error) {
    console.warn('Failed to trigger extraction:', error.message);
  }
}
