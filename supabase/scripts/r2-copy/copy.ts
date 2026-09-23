// 既存の御朱印の原本を Supabase Storage → R2 にコピーする（Issue #227 S3 / AC-6・AC-7）
//
// 何度流しても同じ結果になる（R2 に既にあるキーは触らない）。縮小版はコピーしない。
// 正は DB の stamps.image_path（Storage の一覧は消し残りを含みうるので使わない）。
//
// 使い方（R2 の鍵を会話に残さないため、オーナーが自分のターミナルで実行する）:
//   npx supabase@latest db query --linked -o csv "select image_path from stamps" | tail -n +2 > /tmp/image_paths.txt
//   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
//     deno run --allow-net --allow-env --allow-read supabase/scripts/r2-copy/copy.ts /tmp/image_paths.txt [--dry-run]
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

import { planCopy } from './plan.ts';

const SUPABASE_PUBLIC =
  'https://tvnozkpxncmnehyomoff.supabase.co/storage/v1/object/public/goshuin-images';
const BUCKET = 'goshuin-images';

const [listFile, ...flags] = Deno.args;
const dryRun = flags.includes('--dry-run');
if (!listFile) {
  console.error('usage: copy.ts <image_paths.txt> [--dry-run]');
  Deno.exit(2);
}

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`${k} が未設定`);
  return v;
};
const endpoint = `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${BUCKET}`;
const r2 = new AwsClient({
  accessKeyId: env('R2_ACCESS_KEY_ID'),
  secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  service: 's3',
  region: 'auto',
});

async function listR2Keys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | null = null;
  do {
    const q = new URLSearchParams({ 'list-type': '2' });
    if (token) q.set('continuation-token', token);
    const res = await r2.fetch(`${endpoint}?${q}`);
    if (!res.ok) throw new Error(`R2 の一覧に失敗: HTTP ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.add(m[1]);
    token = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1] ?? null;
  } while (token);
  return keys;
}

const paths = (await Deno.readTextFile(listFile)).split('\n').filter(l => l.trim());
const plan = planCopy(paths, await listR2Keys());
console.log(
  `DB の原本 ${new Set(paths.map(p => p.trim())).size} 件 / R2 に既にある ${plan.present} 件 / ` +
    `コピー対象 ${plan.copy.length} 件 / 形が違うので対象外 ${plan.invalid.length} 件`
);
for (const p of plan.invalid) console.log(`  対象外: ${JSON.stringify(p)}`);
if (dryRun) Deno.exit(0);

let copied = 0;
const failed: string[] = [];
for (const key of plan.copy) {
  try {
    const src = await fetch(`${SUPABASE_PUBLIC}/${key}`);
    if (!src.ok) throw new Error(`Supabase から取得できない: HTTP ${src.status}`);
    const body = new Uint8Array(await src.arrayBuffer());
    const put = await r2.fetch(`${endpoint}/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body,
    });
    if (!put.ok) throw new Error(`R2 に置けない: HTTP ${put.status}`);
    copied++;
  } catch (e) {
    failed.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// 流し終わったら数え直す。ここで 0 にならなければ AC-6 は満たせていない
const remaining = planCopy(paths, await listR2Keys()).copy.length;
console.log(`コピー ${copied} 件 / 失敗 ${failed.length} 件 / R2 にまだ無い原本 ${remaining} 件`);
for (const f of failed) console.log(`  失敗: ${f}`);
Deno.exit(remaining === 0 ? 0 : 1);
