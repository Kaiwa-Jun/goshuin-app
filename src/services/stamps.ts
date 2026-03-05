import { supabase } from '@services/supabase';
import type { Stamp, StampWithSpot } from '@/types/supabase';

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
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  // React Native では fetch(localUri).blob() が空の Blob を返すため、
  // FormData を使ってアップロードする
  const formData = new FormData();
  formData.append('', {
    uri: imageUri,
    name: filePath.split('/').pop(),
    type: 'image/jpeg',
  } as unknown as Blob);

  const { data, error } = await supabase.storage
    .from('goshuin-images')
    .upload(filePath, formData, { contentType: 'multipart/form-data' });

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

export async function fetchAllStamps(userId: string): Promise<StampWithSpot[]> {
  const { data, error } = await supabase
    .from('stamps')
    .select('*, spots!inner(name, type)')
    .eq('user_id', userId)
    .order('visited_at', { ascending: false });

  if (error) {
    console.warn('fetchAllStamps error:', error.message);
    return [];
  }
  return data as StampWithSpot[];
}

export async function fetchStampById(stampId: string): Promise<StampWithSpot> {
  const { data, error } = await supabase
    .from('stamps')
    .select('*, spots!inner(name, type)')
    .eq('id', stampId)
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as StampWithSpot;
}

export function getStampImageUrl(imagePath: string): string {
  const { data } = supabase.storage.from('goshuin-images').getPublicUrl(imagePath);
  return data.publicUrl;
}

export async function updateStamp(
  stampId: string,
  params: { visited_at?: string; memo?: string | null }
): Promise<StampWithSpot> {
  const { data, error } = await supabase
    .from('stamps')
    .update(params)
    .eq('id', stampId)
    .select('*, spots!inner(name, type)')
    .single();
  if (error) throw new Error(error.message);
  return data as StampWithSpot;
}

export async function deleteStampImage(imagePath: string): Promise<void> {
  const { error } = await supabase.storage.from('goshuin-images').remove([imagePath]);
  if (error) throw new Error(error.message);
}

export async function deleteStamp(stampId: string, imagePath: string): Promise<void> {
  await deleteStampImage(imagePath);
  const { error } = await supabase.from('stamps').delete().eq('id', stampId);
  if (error) throw new Error(error.message);
}
