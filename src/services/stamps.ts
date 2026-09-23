import { File } from 'expo-file-system';

import { supabase } from '@services/supabase';
import { describeSupabaseError } from '@/utils/supabaseError';
import { stampTransformUrl, stampVariantPath, THUMB_DIR, VIEW_DIR } from '@/utils/stampThumb';
import { toUploadableJpeg } from '@/utils/toUploadableJpeg';
import type { Stamp, StampWithSpot, PublicStampWithUser } from '@/types/supabase';

/**
 * goshuin-images バケットは allowed_mime_types が
 * {image/jpeg, image/png, image/webp} に制限されている。
 * contentType を渡さないと supabase-js の既定値 text/plain で送られて弾かれる
 */
const STAMP_IMAGE_CONTENT_TYPE = 'image/jpeg';

export async function fetchVisitedSpotIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('stamps').select('spot_id');

  // 空 Set を返すと呼び出し元が「まだ0件」と区別できない。
  // 記録完了画面はこの件数でバッジを判定するため、握り潰すと嘘の数字を祝うことになる（Issue #133）
  if (error) {
    throw new Error(describeSupabaseError(error, '訪問済みスポットの取得に失敗しました'));
  }

  return new Set((data as { spot_id: string }[]).map(row => row.spot_id));
}

export async function fetchStampsBySpotId(spotId: string): Promise<Stamp[]> {
  const { data, error } = await supabase
    .from('stamps')
    .select('*')
    .eq('spot_id', spotId)
    .order('visited_at', { ascending: false })
    // 同じ日に同じ場所で複数枚いただくのは普通のこと（大崎八幡宮など）。
    // visited_at だけだと同日分の順序は Postgres 任せになり、開くたびに並びが変わる
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchStampsBySpotId error:', error.message);
    return [];
  }

  return data as Stamp[];
}

/**
 * R2 に置くためのキーと署名付き URL（Issue #227 S3）。取れなければ null。
 *
 * S3 のあいだ R2 は写しで、正は Supabase。ここが落ちても記録は止めない
 */
async function signR2Upload(
  userId: string,
  size: number
): Promise<{ path: string; url: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('sign-stamp-upload', {
      body: { action: 'upload', size },
    });
    // キーは関数が本人のフォルダの下に決めるが、念のため食い違ったら使わない
    if (error || typeof data?.path !== 'string' || !data.path.startsWith(`${userId}/`)) {
      if (error) console.warn('R2 の署名を取得できませんでした:', error.message);
      return null;
    }
    return { path: data.path, url: data.url };
  } catch (error) {
    console.warn('R2 の署名を取得できませんでした:', error);
    return null;
  }
}

async function putToR2(url: string, bytes: Uint8Array): Promise<void> {
  try {
    // Content-Type と大きさは署名に含まれている。違うと R2 が 403 を返す
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': STAMP_IMAGE_CONTENT_TYPE },
      // RN の fetch の型には Uint8Array が無いが、実行時は通る。supabase-js の upload も
      // 同じバイト列をそのまま fetch に渡しており、実機で動いている（Issue #118）
      body: bytes as unknown as BodyInit,
    });
    if (!res.ok) console.warn(`R2 へのアップロードに失敗しました (status=${res.status})`);
  } catch (error) {
    console.warn('R2 へのアップロードに失敗しました:', error);
  }
}

async function deleteFromR2(paths: string[]): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('sign-stamp-upload', {
      body: { action: 'delete', paths },
    });
    if (error) console.warn('R2 から削除できませんでした:', error.message);
  } catch (error) {
    console.warn('R2 から削除できませんでした:', error);
  }
}

export async function uploadStampImage(userId: string, imageUri: string): Promise<string> {
  // ⚠ ここに FormData を渡してはいけない。
  // supabase-js の Storage クライアントは FormData を受け取ると内部で
  // `body.has('cacheControl')` を呼ぶが、React Native の FormData ポリフィルは
  // append / getAll / getParts しか持たず has() が無いため、
  // 送信前に `TypeError: body.has is not a function` で落ちる。
  // jest の実行環境は Node の FormData（has() あり）なので、この経路の回帰は
  // 通常のユニットテストでは検出できない（stamps-upload-native.test.ts で再現している）。
  //
  // バイト列を直接渡す経路なら RN でも Node でも同じように通る。
  //
  // ⚠ 先に JPEG にしておくこと。iPhone の写真は HEIC で、picker の複数選択は
  //   それをそのまま返す。HEIC のまま上げると Web で表示できず、サーバ側で
  //   触るにも毎回復号が要る（Issue #196）
  const bytes = await new File(await toUploadableJpeg(imageUri)).bytes();

  // R2 にも同じキーで置くため、キーは署名と一緒にもらう（Issue #227 S3）。
  // もらえなければ今までどおり自分で作り、Supabase にだけ上げる
  const signed = await signR2Upload(userId, bytes.length);
  const filePath =
    signed?.path ?? `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { data, error } = await supabase.storage
    .from('goshuin-images')
    .upload(filePath, bytes, { contentType: STAMP_IMAGE_CONTENT_TYPE });

  if (error) {
    throw new Error(describeSupabaseError(error, '画像のアップロードに失敗しました'));
  }

  // Supabase に入ってから写す。先に写すと、Supabase の失敗時に R2 にだけ孤児が残る
  if (signed) await putToR2(signed.url, bytes);

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

export async function fetchAllStamps(userId: string, limit?: number): Promise<StampWithSpot[]> {
  const query = supabase
    .from('stamps')
    .select('*, spots!inner(name, type)')
    .eq('user_id', userId)
    .order('visited_at', { ascending: false })
    // まとめて登録した1組が、御朱印帳を開くたびに並び替わらないようにする
    .order('created_at', { ascending: false });

  // limit を渡さない呼び出しは今までと1文字も変わらないクエリを投げる（御朱印帳が全件を要る）
  const { data, error } = await (limit === undefined ? query : query.limit(limit));

  if (error) {
    console.warn('fetchAllStamps error:', error.message);
    return [];
  }
  return data as StampWithSpot[];
}

/**
 * 県別シート用。その県で授かった御朱印だけを新しい順に。
 *
 * 並びは御朱印帳（fetchAllStamps）と同じ visited_at → created_at にする。
 * 同じ御朱印が画面ごとに違う順で出ると、探しているものを見失う。
 */
export async function fetchStampsByPrefecture(
  userId: string,
  prefecture: string
): Promise<StampWithSpot[]> {
  const { data, error } = await supabase
    .from('stamps')
    .select('*, spots!inner(name, type, prefecture)')
    .eq('user_id', userId)
    .eq('spots.prefecture', prefecture)
    .order('visited_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchStampsByPrefecture error:', error.message);
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

/**
 * 一覧で使う小さい方の URL（Issue #194 → #227 S4a で R2 の変換に切り替え）。
 *
 * R2 に原本が無い（旧バージョンのアプリが Supabase にだけ上げた）ときは 404 になる。
 * 呼び出し側は onError で getStampImageUrl（Supabase の原本）に落として表示を続けること
 */
export function getStampThumbUrl(imagePath: string): string {
  return stampTransformUrl(imagePath, 400, 70);
}

/**
 * 詳細・Web で使う方の URL（Issue #196 → #227 S4a で R2 の変換に切り替え）。
 *
 * 原本が HEIC でも変換を通せば表示できる形式で返る。R2 に無ければ 404 になるので、
 * 呼び出し側は元の写真に落として表示を続けること
 */
export function getStampViewUrl(imagePath: string): string {
  return stampTransformUrl(imagePath, 1200, 78);
}

export async function deleteStampImage(imagePath: string): Promise<void> {
  // 縮小版も一緒に片付ける。残すと持ち主のいないファイルが溜まる。
  // まだ焼かれていない場合も remove はエラーにならない
  const { error } = await supabase.storage
    .from('goshuin-images')
    .remove([
      imagePath,
      stampVariantPath(imagePath, THUMB_DIR),
      stampVariantPath(imagePath, VIEW_DIR),
    ]);
  if (error) throw new Error(error.message);

  // R2 の写しも消す（Issue #227 S3）。失敗しても Supabase からは消えているので止めない
  await deleteFromR2([imagePath]);
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
