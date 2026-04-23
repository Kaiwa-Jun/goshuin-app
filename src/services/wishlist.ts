import { supabase } from '@services/supabase';
import type { WishlistWithSpot } from '@/types/supabase';

/**
 * ユーザーのwishlistに登録されたspot IDをSet<string>で取得（MapScreen用）
 */
export async function fetchWishlistSpotIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('wishlists').select('spot_id').eq('user_id', userId);

  if (error) {
    console.warn('fetchWishlistSpotIds error:', error.message);
    return new Set();
  }

  return new Set((data as { spot_id: string }[]).map(row => row.spot_id));
}

/**
 * wishlistにスポットを追加する（upsertで冪等）
 */
export async function addToWishlist(userId: string, spotId: string): Promise<void> {
  const { error } = await supabase
    .from('wishlists')
    .upsert({ user_id: userId, spot_id: spotId }, { onConflict: 'user_id,spot_id' });

  if (error) {
    console.warn('addToWishlist error:', error.message);
  }
}

/**
 * wishlistからスポットを削除する
 */
export async function removeFromWishlist(userId: string, spotId: string): Promise<void> {
  const { error } = await supabase
    .from('wishlists')
    .delete()
    .eq('user_id', userId)
    .eq('spot_id', spotId);

  if (error) {
    console.warn('removeFromWishlist error:', error.message);
  }
}

/**
 * wishlistのスポット一覧をspot情報込みで取得（CollectionScreen用）
 */
export async function fetchWishlistSpots(userId: string): Promise<WishlistWithSpot[]> {
  const { data, error } = await supabase
    .from('wishlists')
    .select('*, spots!inner(name, type, address)')
    .eq('user_id', userId);

  if (error) {
    console.warn('fetchWishlistSpots error:', error.message);
    return [];
  }

  return data as WishlistWithSpot[];
}
