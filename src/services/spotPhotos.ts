import { supabase } from '@services/supabase';
import type { SpotPhoto, SpotPhotoRow } from '@/types/supabase';

/**
 * 地図のピンのシートの帯に出す寺社の写真（Issue #302）。
 * 写真は R2 の独自ドメインに置き、Cloudflare の変換 URL で読む（幅は #227 の見る用と同じ 1200）
 */

/** 写真の原本の置き場所（R2 の独自ドメイン） */
export const SPOT_PHOTO_ORIGIN = 'https://img.goshuinsanpo.com';

/** 変換（#227 D-6 の見る用と同じ幅・品質。新しい幅を足さない） */
const SPOT_PHOTO_TRANSFORM = 'width=1200,quality=78,format=webp';

/** 帯で読む写真の URL */
export function spotPhotoUrl(r2Key: string): string {
  return `${SPOT_PHOTO_ORIGIN}/cdn-cgi/image/${SPOT_PHOTO_TRANSFORM}/${r2Key}`;
}

const COLUMNS =
  'r2_key, width, height, focus_y, author, license, license_url, source_url, is_cropped';

type SpotPhotoColumns = Pick<
  SpotPhotoRow,
  | 'r2_key'
  | 'width'
  | 'height'
  | 'focus_y'
  | 'author'
  | 'license'
  | 'license_url'
  | 'source_url'
  | 'is_cropped'
>;

/**
 * 寺社の承認済みの写真。無い・読めないときは null（帯は写真なしのまま）
 */
export async function fetchSpotPhoto(spotId: string): Promise<SpotPhoto | null> {
  const { data, error } = await supabase
    .from('spot_photos')
    .select(COLUMNS)
    .eq('spot_id', spotId)
    .eq('status', 'approved')
    .maybeSingle();

  if (error) {
    console.warn('fetchSpotPhoto error:', error.message);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as SpotPhotoColumns;
  return {
    uri: spotPhotoUrl(row.r2_key),
    width: row.width,
    height: row.height,
    focusY: row.focus_y,
    author: row.author,
    license: row.license,
    licenseUrl: row.license_url,
    sourceUrl: row.source_url,
    isCropped: row.is_cropped,
  };
}
