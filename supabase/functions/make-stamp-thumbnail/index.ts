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
    const paths = requested
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .filter(p => isOwnedBy(p, userId) && !isThumbPath(p))
      .slice(0, MAX_PATHS);

    const admin = createClient(supabaseUrl, serviceKey);
    const storage = admin.storage.from(BUCKET);

    let created = 0;
    let skipped = 0;
    const failed: string[] = [];

    for (const imagePath of paths) {
      const thumbPath = thumbPathFor(imagePath);
      try {
        // 既にあるなら焼き直さない
        const existing = await storage.download(thumbPath);
        if (!existing.error && existing.data) {
          skipped++;
          continue;
        }

        const original = await storage.download(imagePath);
        if (original.error || !original.data) {
          console.warn(`[make-stamp-thumbnail] download failed: ${imagePath}`);
          failed.push(imagePath);
          continue;
        }

        const decoded = await decode(new Uint8Array(await original.data.arrayBuffer()));
        if (!(decoded instanceof Image)) {
          console.warn(`[make-stamp-thumbnail] not a still image: ${imagePath}`);
          failed.push(imagePath);
          continue;
        }

        // 元が既に小さいなら拡大しない
        const width = Math.min(THUMB_WIDTH, decoded.width);
        const resized = decoded.resize(width, Image.RESIZE_AUTO);
        const jpeg = await resized.encodeJPEG(QUALITY);

        const uploaded = await storage.upload(thumbPath, jpeg, {
          contentType: CONTENT_TYPE,
          upsert: true,
        });
        if (uploaded.error) {
          console.warn(`[make-stamp-thumbnail] upload failed: ${thumbPath}`);
          failed.push(imagePath);
          continue;
        }
        created++;
      } catch (error) {
        console.warn(`[make-stamp-thumbnail] error on ${imagePath}:`, error);
        failed.push(imagePath);
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
