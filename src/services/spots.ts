import { supabase } from '@services/supabase';
import type { Spot } from '@/types/supabase';
import type { BoundingBox } from '@utils/geo';

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
