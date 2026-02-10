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

export async function uploadStampImage(userId: string, imageUri: string): Promise<string> {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { data, error } = await supabase.storage
    .from('goshuin-images')
    .upload(filePath, blob, { contentType: 'image/jpeg' });

  if (error) {
    throw new Error(error.message);
  }

  return data.path;
}

export async function createStamp(params: {
  userId: string;
  spotId: string;
  imagePath: string;
  visitedAt: string;
  memo?: string;
}): Promise<Stamp> {
  const { data, error } = await supabase
    .from('stamps')
    .insert({
      user_id: params.userId,
      spot_id: params.spotId,
      image_path: params.imagePath,
      visited_at: params.visitedAt,
      memo: params.memo ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Stamp;
}

export function getStampImageUrl(imagePath: string): string {
  const { data } = supabase.storage.from('goshuin-images').getPublicUrl(imagePath);
  return data.publicUrl;
}
