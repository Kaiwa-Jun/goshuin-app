import { supabase } from '@services/supabase';
import type { SpotAggregatedInfo, SpotSnsLink } from '@/types/supabase';

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

export async function fetchSpotSnsLinks(spotId: string): Promise<SpotSnsLink[]> {
  const { data, error } = await supabase
    .from('spot_info_sources')
    .select('id, url')
    .match({ spot_id: spotId, source_type: 'sns_link', enabled: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Failed to fetch spot sns links:', error.message);
    return [];
  }

  return data ?? [];
}

/**
 * 寺社ごとの受付の終わり（予定の「間に合わないかも」に使う / Issue #258 D-9）。
 * 1社ずつの useSpotInfo ではなく、予定の寺社をまとめて1回で取る。close の無い寺社は含めない。
 * 失敗は空（受付の行を出さないだけ）
 */
export async function fetchReceptionHours(spotIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (spotIds.length === 0) return result;

  const { data, error } = await supabase
    .from('spot_aggregated_info')
    .select('spot_id, info_data')
    .eq('info_type', 'reception_hours')
    .in('spot_id', spotIds);
  if (error) {
    console.warn('Failed to fetch reception hours:', error.message);
    return result;
  }

  for (const row of (data ?? []) as { spot_id: string; info_data: { close?: unknown } }[]) {
    const close = row.info_data?.close;
    if (typeof close === 'string' && close) result.set(row.spot_id, close);
  }
  return result;
}

export async function triggerExtraction(stampId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('extract-spot-info', {
    body: { stamp_id: stampId },
  });

  if (error) {
    console.warn('Failed to trigger extraction:', error.message);
  }
}
