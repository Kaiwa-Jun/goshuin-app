import { supabase } from '@services/supabase';
import type { Spot } from '@/types/supabase';
import type { BoundingBox } from '@utils/geo';

// PostgREST の既定 max-rows(1,000)と一致させる。1リクエストで返る最大行数
const SPOTS_PAGE_SIZE = 1000;

// 本人の pending も出す（追加した寺社を自分用にはすぐ使える）。他人の pending は RLS で落ちる（#248 D-8）。
// 寺社の追加は Edge Function add-spot だけが行う（src/services/spotAdd.ts）
const VISIBLE_STATUSES = ['active', 'pending'];

export async function fetchAllActiveSpots(): Promise<Spot[]> {
  const allSpots: Spot[] = [];

  for (let page = 0; ; page++) {
    const from = page * SPOTS_PAGE_SIZE;
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .in('status', VISIBLE_STATUSES)
      .order('id', { ascending: true })
      .range(from, from + SPOTS_PAGE_SIZE - 1);

    if (error) {
      console.warn('fetchAllActiveSpots error:', error.message);
      return [];
    }

    const batch = (data ?? []) as Spot[];
    allSpots.push(...batch);

    if (batch.length < SPOTS_PAGE_SIZE) break;
  }

  return allSpots;
}

export async function fetchSpotsByBounds(bounds: BoundingBox): Promise<Spot[]> {
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .in('status', VISIBLE_STATUSES)
    .gte('lat', bounds.minLat)
    .lte('lat', bounds.maxLat)
    .gte('lng', bounds.minLng)
    .lte('lng', bounds.maxLng);

  if (error) {
    console.warn('fetchSpotsByBounds error:', error.message);
    return [];
  }

  return data as Spot[];
}

export async function fetchSpotById(id: string): Promise<Spot | null> {
  const { data, error } = await supabase.from('spots').select('*').eq('id', id).single();

  if (error) {
    console.warn('fetchSpotById error:', error.message);
    return null;
  }

  return data as Spot;
}

export async function fetchSpotsByPrefecture(prefecture: string): Promise<Spot[]> {
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .in('status', VISIBLE_STATUSES)
    .eq('prefecture', prefecture);

  if (error) {
    console.warn('fetchSpotsByPrefecture error:', error.message);
    return [];
  }
  return data as Spot[];
}

export async function searchSpotsByName(query: string): Promise<Spot[]> {
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .in('status', VISIBLE_STATUSES)
    .ilike('name', `%${query}%`)
    .limit(10);

  if (error) {
    console.warn('searchSpotsByName error:', error.message);
    return [];
  }

  return data as Spot[];
}
