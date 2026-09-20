// 御朱印のサムネイルを焼く（Issue #194）
//
// 一覧は写真を原寸（1.24MB / 1576×2103）のまま読んでいて、57件で約70MBを
// 取りに行っていた。iOS の URL キャッシュに収まらないので、一度読んだ写真まで
// 追い出されて取り直しになり、一覧を開いた直後に押すと詳細の写真が
// 9秒経っても出ないことがあった。
//
// Supabase の画像変換（/render/image）は有料アドオンで、このプロジェクトでは
// 無効（403 FeatureNotEnabled）。そのため自前で焼く。
//
// ⚠ config.toml で verify_jwt = false にしている（他の関数と同じゲートウェイの
//   都合）。そのぶん「呼び出し元が本人であること」の検証はこの関数の責務。
//   焼く対象は getUser() で得た id のフォルダ配下だけに限る
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode, Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';
// iPhone で撮った写真は HEIC のまま保存されている（拡張子も Content-Type も jpg を
// 名乗っているが中身は ftypheic）。ImageScript は HEIC を読めないのでこれで開く。
// wasm-bundle 版は .wasm を別途取りに行かないので、Deno でもそのまま動く
import libheif from 'https://esm.sh/libheif-js@1.18.2/wasm-bundle';

import {
  MAX_PATHS,
  THUMB_WIDTH,
  extractBearerToken,
  isOwnedBy,
  isThumbPath,
  thumbPathFor,
} from './thumbnail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'goshuin-images';
const CONTENT_TYPE = 'image/jpeg';
const QUALITY = 70;

/**
 * HEIC を RGBA に開いて ImageScript に渡す。
 *
 * expo-image-picker の複数選択は元のファイルをそのまま返すので、iPhone の
 * 写真は HEIC のまま上がってくる。iOS は表示できるので今まで表に出ていなかった
 */
async function decodeHeic(bytes: Uint8Array): Promise<Image> {
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(bytes);
  if (!images || images.length === 0) throw new Error('HEIC に画像が入っていない');

  const first = images[0];
  const width = first.get_width();
  const height = first.get_height();
  const rgba = new Uint8ClampedArray(width * height * 4);

  // ⚠ display は非同期。待たずに読むと中身が空のまま進み、真っ黒なサムネができる
  await new Promise<void>((resolve, reject) => {
    first.display({ data: rgba, width, height }, (result: unknown) => {
      if (result) resolve();
      else reject(new Error('HEIC を展開できなかった'));
    });
  });

  const image = new Image(width, height);
  image.bitmap.set(rgba);
  return image;
}

/** まず素直に読む。読めなければ HEIC として開き直す */
async function decodeToImage(bytes: Uint8Array): Promise<Image> {
  try {
    const decoded = await decode(bytes);
    if (decoded instanceof Image) return decoded;
  } catch {
    // ImageScript が読めない形式。HEIC の可能性がある
  }
  return decodeHeic(bytes);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const token = extractBearerToken(req.headers.get('Authorization'));
    if (!token) return json({ success: false, error: 'ログインが必要です' }, 401);

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      console.warn('[make-stamp-thumbnail] getUser failed:', userError?.message);
      return json({ success: false, error: 'ログインが必要です' }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const requested: unknown = body?.image_paths;
    if (!Array.isArray(requested) || requested.length === 0) {
      return json({ success: false, error: 'image_paths が必要です' }, 400);
    }

    // 自分のものだけ、サムネ自身は除き、上限まで
    const force = body?.force === true;

    const paths = requested
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .filter(p => isOwnedBy(p, userId) && !isThumbPath(p))
      .slice(0, MAX_PATHS);

    const admin = createClient(supabaseUrl, serviceKey);
    const storage = admin.storage.from(BUCKET);

    let created = 0;
    let skipped = 0;
    /** 失敗は理由つきで返す。関数のログは CLI から読めないので、呼び出し側で追えるようにする */
    const failed: { path: string; reason: string }[] = [];
    const fail = (path: string, reason: string) => {
      console.warn(`[make-stamp-thumbnail] ${reason}: ${path}`);
      failed.push({ path, reason: reason.slice(0, 200) });
    };

    for (const imagePath of paths) {
      const thumbPath = thumbPathFor(imagePath);
      try {
        // 既にあるなら焼き直さない。force のときだけ上書きする
        // （壊れたサムネを作ってしまったときの焼き直し用）
        if (!force) {
          const existing = await storage.download(thumbPath);
          if (!existing.error && existing.data) {
            skipped++;
            continue;
          }
        }

        const original = await storage.download(imagePath);
        if (original.error || !original.data) {
          fail(imagePath, `download: ${original.error?.message ?? 'no data'}`);
          continue;
        }

        const bytes = new Uint8Array(await original.data.arrayBuffer());
        const decoded = await decodeToImage(bytes);

        // 元が既に小さいなら拡大しない
        const width = Math.min(THUMB_WIDTH, decoded.width);
        const resized = decoded.resize(width, Image.RESIZE_AUTO);
        const jpeg = await resized.encodeJPEG(QUALITY);

        const uploaded = await storage.upload(thumbPath, jpeg, {
          contentType: CONTENT_TYPE,
          upsert: true,
        });
        if (uploaded.error) {
          fail(imagePath, `upload: ${uploaded.error.message}`);
          continue;
        }
        created++;
      } catch (error) {
        fail(imagePath, `throw: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(
      `[make-stamp-thumbnail] created=${created} skipped=${skipped} failed=${failed.length}`
    );
    return json({ success: true, created, skipped, failed }, 200);
  } catch (error) {
    console.error('[make-stamp-thumbnail] unexpected:', error);
    return json({ success: false, error: 'サムネイルの作成に失敗しました' }, 500);
  }
});
