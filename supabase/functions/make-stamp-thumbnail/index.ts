// 御朱印の写真から、見るための JPEG を焼く（Issue #194 / #196）
//
// 一覧は写真を原寸（1.24MB / 1576×2103）のまま読んでいて、57件で約70MBを
// 取りに行っていた。iOS の URL キャッシュに収まらないので、一度読んだ写真まで
// 追い出されて取り直しになり、一覧を開いた直後に押すと詳細の写真が
// 9秒経っても出ないことがあった。
//
// さらに、保存されている写真は iPhone の HEIC がそのまま上がっている
// （拡張子と Content-Type は jpg を名乗っているが中身は ftypheic）。
// HEIC は Safari でしか表示できないので、Web では出ない。
//
// Supabase の画像変換（/render/image）は有料アドオンで、このプロジェクトでは
// 無効（403 FeatureNotEnabled）。そのため自前で焼く。元は保管用として触らない。
//
// ⚠ config.toml で verify_jwt = false にしている（他の関数と同じゲートウェイの
//   都合）。そのぶん「呼び出し元が本人であること」の検証はこの関数の責務。
//   焼く対象は getUser() で得た id のフォルダ配下だけに限る
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode, Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';
// ImageScript は HEIC を読めないのでこれで開く。wasm-bundle 版は .wasm を
// 別途取りに行かないので、Deno でもそのまま動く
import libheif from 'https://esm.sh/libheif-js@1.18.2/wasm-bundle';

import {
  MAX_BAKES,
  MAX_PATHS,
  VARIANTS,
  extractBearerToken,
  isOwnedBy,
  isVariantPath,
  variantPathFor,
} from './thumbnail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'goshuin-images';
const CONTENT_TYPE = 'image/jpeg';

interface Raster {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * RGBA を目的の幅まで縮める。
 *
 * ImageScript の resize に渡すと、いったん原寸の Image を作ってから縮めることに
 * なる。3000×4000 なら RGBA だけで 48MB を確保したうえで補間を1周するので、
 * 大きい写真では Edge Function の CPU 上限に当たって途中で殺される。
 * ここでは元を1周して区画ごとの平均を取るだけにする。確保するのは小さい方だけ
 */
function downscale(src: Raster, dstWidth: number): Raster {
  const width = Math.min(dstWidth, src.width);
  const height = Math.max(1, Math.round((src.height * width) / src.width));
  const out = new Uint8ClampedArray(width * height * 4);
  const blockX = src.width / width;
  const blockY = src.height / height;

  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * blockY);
    const y1 = Math.max(y0 + 1, Math.min(src.height, Math.floor((y + 1) * blockY)));

    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * blockX);
      const x1 = Math.max(x0 + 1, Math.min(src.width, Math.floor((x + 1) * blockX)));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      for (let sy = y0; sy < y1; sy++) {
        let offset = (sy * src.width + x0) * 4;
        for (let sx = x0; sx < x1; sx++) {
          r += src.data[offset];
          g += src.data[offset + 1];
          b += src.data[offset + 2];
          a += src.data[offset + 3];
          offset += 4;
          count++;
        }
      }

      const d = (y * width + x) * 4;
      out[d] = r / count;
      out[d + 1] = g / count;
      out[d + 2] = b / count;
      out[d + 3] = a / count;
    }
  }

  return { data: out, width, height };
}

/** HEIC を RGBA に開く */
async function decodeHeic(bytes: Uint8Array): Promise<Raster> {
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(bytes);
  if (!images || images.length === 0) throw new Error('HEIC に画像が入っていない');

  const first = images[0];
  const width = first.get_width();
  const height = first.get_height();
  const data = new Uint8ClampedArray(width * height * 4);

  // ⚠ display は非同期。待たずに読むと中身が空のまま進み、真っ黒な画像ができる
  await new Promise<void>((resolve, reject) => {
    first.display({ data, width, height }, (result: unknown) => {
      if (result) resolve();
      else reject(new Error('HEIC を展開できなかった'));
    });
  });

  return { data, width, height };
}

/** まず素直に読む。読めなければ HEIC として開き直す */
async function decodeToRaster(bytes: Uint8Array): Promise<Raster> {
  try {
    const decoded = await decode(bytes);
    if (decoded instanceof Image) {
      return { data: decoded.bitmap, width: decoded.width, height: decoded.height };
    }
  } catch {
    // ImageScript が読めない形式。HEIC の可能性がある
  }
  return decodeHeic(bytes);
}

async function encodeJpeg(raster: Raster, quality: number): Promise<Uint8Array> {
  const image = new Image(raster.width, raster.height);
  image.bitmap.set(raster.data);
  return await image.encodeJPEG(quality);
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
    const force = body?.force === true;

    // 自分のものだけ、縮小版自身は除き、上限まで
    const paths = requested
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .filter(p => isOwnedBy(p, userId) && !isVariantPath(p))
      .slice(0, MAX_PATHS);

    const admin = createClient(supabaseUrl, serviceKey);
    const storage = admin.storage.from(BUCKET);

    // 既にあるものを大きさごとに1回の list でまとめて知る。1枚ずつ download で
    // 確かめると、焼く前に往復と転送で予算を使ってしまう
    const existing = new Map<string, Set<string>>();
    for (const variant of VARIANTS) {
      const names = new Set<string>();
      if (!force) {
        const listed = await storage.list(`${userId}/${variant.dir}`, { limit: 1000 });
        for (const entry of listed.data ?? []) names.add(entry.name);
      }
      existing.set(variant.dir, names);
    }

    let created = 0;
    let skipped = 0;
    let baked = 0;
    const failed: { path: string; reason: string }[] = [];

    for (const imagePath of paths) {
      const name = imagePath.slice(imagePath.lastIndexOf('/') + 1);
      const missing = VARIANTS.filter(v => !existing.get(v.dir)!.has(name));

      if (missing.length === 0) {
        skipped++;
        continue;
      }
      // 予算を使い切る前に切り上げる。残りは次の呼び出しで焼かれる
      if (baked >= MAX_BAKES) break;
      baked++;

      try {
        const original = await storage.download(imagePath);
        if (original.error || !original.data) {
          failed.push({
            path: imagePath,
            reason: `download: ${original.error?.message ?? 'no data'}`,
          });
          continue;
        }

        // 復号は一番重い。1回だけにして、そこから両方の大きさを作る
        const raster = await decodeToRaster(new Uint8Array(await original.data.arrayBuffer()));

        for (const variant of missing) {
          const jpeg = await encodeJpeg(downscale(raster, variant.width), variant.quality);
          const uploaded = await storage.upload(variantPathFor(imagePath, variant.dir), jpeg, {
            contentType: CONTENT_TYPE,
            upsert: true,
          });
          if (uploaded.error) {
            failed.push({
              path: imagePath,
              reason: `upload ${variant.dir}: ${uploaded.error.message}`,
            });
            continue;
          }
          created++;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[make-stamp-thumbnail] ${imagePath}: ${reason}`);
        failed.push({ path: imagePath, reason: `throw: ${reason.slice(0, 160)}` });
      }
    }

    console.log(
      `[make-stamp-thumbnail] created=${created} skipped=${skipped} failed=${failed.length}`
    );
    return json({ success: true, created, skipped, failed }, 200);
  } catch (error) {
    console.error('[make-stamp-thumbnail] unexpected:', error);
    return json({ success: false, error: '縮小版の作成に失敗しました' }, 500);
  }
});
