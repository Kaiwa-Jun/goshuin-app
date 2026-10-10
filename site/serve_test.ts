// Deno テスト（ローカルの配信。契約書 docs/issues/issue-324-homepage.md D-25・UI-8）
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { createHandler } from './serve.ts';

async function fixtureDist(): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: 'site-serve-' });
  await Deno.mkdir(`${dir}/spots/tokyo-002`, { recursive: true });
  await Deno.mkdir(`${dir}/img`, { recursive: true });
  await Deno.writeTextFile(`${dir}/index.html`, '<h1>トップ</h1>');
  await Deno.writeTextFile(`${dir}/404.html`, '<a href="/">トップへ</a>');
  await Deno.writeTextFile(`${dir}/spots/tokyo-002/index.html`, '<h1>明治神宮</h1>');
  await Deno.writeTextFile(`${dir}/sitemap.xml`, '<urlset></urlset>');
  await Deno.writeFile(`${dir}/img/a.webp`, new Uint8Array([1, 2, 3]));
  return dir;
}

async function get(handler: (r: Request) => Promise<Response>, path: string) {
  const res = await handler(new Request(`http://127.0.0.1:8324${path}`));
  return {
    status: res.status,
    type: res.headers.get('content-type'),
    location: res.headers.get('location'),
    body: await res.text(),
  };
}

Deno.test(
  'D-25: /<dir>/ は index.html・/<dir> は 301・無いパスは 404.html を 404 で返す',
  async () => {
    const dir = await fixtureDist();
    try {
      const h = createHandler(dir);
      const top = await get(h, '/');
      assertEquals([top.status, top.body], [200, '<h1>トップ</h1>']);
      assert(top.type?.startsWith('text/html'));
      const spot = await get(h, '/spots/tokyo-002/');
      assertEquals([spot.status, spot.body], [200, '<h1>明治神宮</h1>']);
      const noSlash = await get(h, '/spots/tokyo-002');
      assertEquals([noSlash.status, noSlash.location], [301, '/spots/tokyo-002/']);
      const missing = await get(h, '/spots/no-such-spot/');
      assertEquals([missing.status, missing.body], [404, '<a href="/">トップへ</a>']);
      assert(missing.type?.startsWith('text/html'));
      assertEquals((await get(h, '/img/a.webp')).type, 'image/webp');
      assertEquals((await get(h, '/sitemap.xml')).type, 'application/xml; charset=utf-8');
      // フォルダの外は読まない
      assertEquals((await get(h, '/../../etc/passwd')).status, 404);
      assertEquals((await get(h, '/%2e%2e/%2e%2e/etc/passwd')).status, 404);
      // ファイルの末尾に / を付けたら無い
      assertEquals((await get(h, '/sitemap.xml/')).status, 404);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  }
);
