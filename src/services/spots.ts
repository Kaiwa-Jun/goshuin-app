import { supabase } from '@services/supabase';
import type { Spot } from '@/types/supabase';
import type { BoundingBox } from '@utils/geo';

// PostgREST の既定 max-rows(1,000)と一致させる。1リクエストで返る最大行数
const SPOTS_PAGE_SIZE = 1000;

export async function fetchAllActiveSpots(): Promise<Spot[]> {
  const allSpots: Spot[] = [];

  for (let page = 0; ; page++) {
    const from = page * SPOTS_PAGE_SIZE;
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .eq('status', 'active')
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
    .eq('status', 'active')
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

export async function createSpot(params: {
  name: string;
  type: 'shrine' | 'temple';
  lat: number;
  lng: number;
  createdByUserId: string;
}): Promise<Spot> {
  const { data, error } = await supabase
    .from('spots')
    .insert({
      name: params.name,
      type: params.type,
      lat: params.lat,
      lng: params.lng,
      status: 'pending' as const,
      created_by_user_id: params.createdByUserId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Spot;
}

export async function fetchSpotsByPrefecture(prefecture: string): Promise<Spot[]> {
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .eq('status', 'active')
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
    .eq('status', 'active')
    .ilike('name', `%${query}%`)
    .limit(10);

  if (error) {
    console.warn('searchSpotsByName error:', error.message);
    return [];
  }

  return data as Spot[];
}
