import { File } from 'expo-file-system';

import { supabase } from '@services/supabase';
import { describeSupabaseError } from '@/utils/supabaseError';
import type { Stamp, StampWithSpot, PublicStampWithUser } from '@/types/supabase';

/**
 * goshuin-images バケットは allowed_mime_types が
 * {image/jpeg, image/png, image/webp} に制限されている。
 * contentType を渡さないと supabase-js の既定値 text/plain で送られて弾かれる
 */
const STAMP_IMAGE_CONTENT_TYPE = 'image/jpeg';

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

  // ⚠ ここに FormData を渡してはいけない。
  // supabase-js の Storage クライアントは FormData を受け取ると内部で
  // `body.has('cacheControl')` を呼ぶが、React Native の FormData ポリフィルは
  // append / getAll / getParts しか持たず has() が無いため、
  // 送信前に `TypeError: body.has is not a function` で落ちる。
  // jest の実行環境は Node の FormData（has() あり）なので、この経路の回帰は
  // 通常のユニットテストでは検出できない（stamps-upload-native.test.ts で再現している）。
  //
  // バイト列を直接渡す経路なら RN でも Node でも同じように通る。
  const bytes = await new File(imageUri).bytes();

  const { data, error } = await supabase.storage
    .from('goshuin-images')
    .upload(filePath, bytes, { contentType: STAMP_IMAGE_CONTENT_TYPE });

  if (error) {
    throw new Error(describeSupabaseError(error, '画像のアップロードに失敗しました'));
  }

  return data.path;
}

export async function createStamp(params: {
  userId: string;
  spotId: string;
  imagePath: string;
  visitedAt: string;
  memo?: string;
  isPublic?: boolean;
}): Promise<Stamp> {
  const { data, error } = await supabase
    .from('stamps')
    .insert({
      user_id: params.userId,
      spot_id: params.spotId,
      image_path: params.imagePath,
      visited_at: params.visitedAt,
      memo: params.memo ?? null,
      is_public: params.isPublic ?? false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(describeSupabaseError(error, '記録の保存に失敗しました'));
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
  params: { visited_at?: string; memo?: string | null; is_public?: boolean; image_path?: string }
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

export async function fetchPublicStampsBySpotId(spotId: string): Promise<PublicStampWithUser[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from('stamps')
    .select('*, profiles!stamps_user_id_profiles_fkey(display_name, avatar_url)')
    .eq('spot_id', spotId)
    .eq('is_public', true)
    .order('visited_at', { ascending: false })
    .limit(20);

  if (user) {
    query = query.neq('user_id', user.id);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('fetchPublicStampsBySpotId error:', error.message);
    return [];
  }
  return data as PublicStampWithUser[];
}

export async function deleteStampImage(imagePath: string): Promise<void> {
  const { error } = await supabase.storage.from('goshuin-images').remove([imagePath]);
  if (error) throw new Error(error.message);
}

/**
 * 行を先に消してから画像を消す。逆順だと、行の削除に失敗したときに
 * 画像だけ消えて「画像の出ない御朱印」がギャラリーに残る。
 * この順なら失敗時に残るのは孤児画像だけで、ユーザーから見た表示は壊れない
 */
export async function deleteStamp(stampId: string, imagePath: string): Promise<void> {
  const { error } = await supabase.from('stamps').delete().eq('id', stampId);
  if (error) throw new Error(error.message);
  await deleteStampImage(imagePath);
}
