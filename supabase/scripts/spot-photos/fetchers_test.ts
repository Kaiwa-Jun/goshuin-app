// Deno テスト（Commons から取る・R2 に置く・独自ドメインで確かめる。fetch と時計は偽物。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-302-spot-photo-band.md（S4 / AC-19〜AC-22）
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { fixtureLedgerJson, fixturePhotos, makeRoot, realSeedRows } from './fixtures/load.ts';
import { cachePaths, fetchPhotos, R2_BUCKET, uploadPhotos, verifyPhotos } from './fetchers.ts';
import { type CliIo, denoIo, runCli } from './main.ts';
import { type LedgerEntry302, parseLedger302, PHOTO_STORE_WIDTH } from './select.ts';

const CONTACT = 'https://example.com/contact';
const UA = `goshuin-spot-photos/1 (${CONTACT})`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);

interface Call {
  method: string;
  url: string;
  ua: string | null;
  start: number;
  end: number;
  headers: Headers;
}

/** 時計は偽物。sleep で進み、1回の呼び出しは 50ms かかる */
function fakeClock() {
  let t = 1_000_000;
  return {
    now: () => t,
    sleep: (ms: number) => {
      t += Math.max(0, ms);
      return Promise.resolve();
    },
    tick: (ms: number) => void (t += ms),
  };
}

interface CommonsFile {
  sha1: string;
  mime: string;
  width: number;
  height: number;
  /** 縮小版の幅（既定 1280） */
  thumbwidth?: number;
  /** 縮小版の URL（既定は upload.wikimedia.org） */
  thumburl?: string;
  /** 縮小版の中身（既定は mime の頭） */
  body?: Uint8Array<ArrayBuffer>;
}

/** 偽の Commons（api.php と upload.wikimedia.org の縮小版） */
function fakeCommons(files: Record<string, CommonsFile>, clock = fakeClock()) {
  const calls: Call[] = [];
  const fetch = async (input: Request | string, init?: RequestInit): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(input, init);
    const start = clock.now();
    clock.tick(50);
    const call: Call = {
      method: req.method,
      url: req.url,
      ua: req.headers.get('user-agent'),
      start,
      end: clock.now(),
      headers: req.headers,
    };
    calls.push(call);
    const url = new URL(req.url);
    if (url.host === 'commons.wikimedia.org' && url.pathname === '/w/api.php') {
      const titles = (url.searchParams.get('titles') ?? '').split('|');
      const pages = titles.map(title => {
        const name = title.replace(/^File:/, '');
        const f = files[name];
        if (!f) return { title, missing: true };
        const key = encodeURIComponent(name.replaceAll(' ', '_'));
        return {
          title,
          imageinfo: [
            {
              url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${key}`,
              descriptionurl: `https://commons.wikimedia.org/wiki/File:${key}`,
              width: f.width,
              height: f.height,
              sha1: f.sha1,
              mime: f.mime,
              thumburl:
                f.thumburl ??
                // 本物の応答と同じく、縮小版は thumb.wikimedia.org（utm の問い合わせ付き）
                `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${key}/1280px-${key}?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail`,
              thumbwidth: f.thumbwidth ?? 1280,
              thumbheight: Math.round(((f.thumbwidth ?? 1280) * f.height) / f.width),
            },
          ],
        };
      });
      return Response.json({ batchcomplete: true, query: { pages } });
    }
    if (url.host === 'upload.wikimedia.org' || url.host === 'thumb.wikimedia.org') {
      const key = decodeURIComponent(
        url.pathname
          .split('/')
          .at(-1)!
          .replace(/^1280px-/, '')
      );
      const f = files[key.replaceAll('_', ' ')];
      if (!f) return new Response('nope', { status: 404 });
      return new Response(f.body ?? (f.mime === 'image/png' ? PNG : JPEG));
    }
    return new Response('unexpected', { status: 500 });
  };
  return { fetch, calls, clock };
}

function commonsFilesOf(entries: LedgerEntry302[]): Record<string, CommonsFile> {
  return Object.fromEntries(
    entries.map(e => [
      e.file,
      {
        sha1: e.sha1,
        mime: e.r2Key.endsWith('.png') ? 'image/png' : 'image/jpeg',
        width: e.width,
        height: e.height,
      },
    ])
  );
}

async function fixtureEntries(): Promise<LedgerEntry302[]> {
  return parseLedger302(await fixtureLedgerJson(), await fixturePhotos(), await realSeedRows())
    .entries;
}

/** API の 50 件ずつを確かめるための、作り物の 120 行 */
function manyEntries(n: number): LedgerEntry302[] {
  return Array.from({ length: n }, (_, i) => {
    const sha1 = i.toString(16).padStart(40, '0');
    return {
      batch: 1,
      idx: i + 1,
      name: `テスト寺${i + 1}`,
      prefecture: '静岡県',
      qid: `Q${i + 1}`,
      linkConfidence: 'high' as const,
      linkChecked: false,
      file: `Test ${i + 1}.jpg`,
      sha1,
      r2Key: `spot-photos/${sha1}.jpg`,
      width: 4000,
      height: 3000,
      focusY: 0.5,
      author: 'Someone',
      license: 'CC BY-SA 4.0',
      licenseUrl: null,
      sourceUrl: `https://commons.wikimedia.org/wiki/File:Test_${i + 1}.jpg`,
      isCropped: true,
      status: 'approved' as const,
    };
  });
}

function captured(over: Partial<CliIo> = {}) {
  let out = '';
  let err = '';
  const io: CliIo = {
    ...denoIo(),
    stdout: t => void (out += t),
    stderr: t => void (err += t),
    ...over,
  };
  return { io, out: () => out, err: () => err };
}

// --- AC-19: Commons から取る ---

Deno.test(
  'AC-19: imageinfo を 50 件ずつ・縮小版は1つずつ 1,000ms あけて取り、どれも User-Agent を付ける',
  async () => {
    const work = await Deno.makeTempDir({ prefix: 'spot-photos-fetch-' });
    try {
      const entries = manyEntries(120);
      const c = fakeCommons(commonsFilesOf(entries));
      const { io, err } = captured({ fetch: c.fetch, now: c.clock.now, sleep: c.clock.sleep });
      const result = await fetchPhotos(entries, { io, work, contact: CONTACT });
      assertEquals(result.failed, [], err());
      assertEquals(result.saved, 120);

      const api = c.calls.filter(x => x.url.includes('/w/api.php'));
      assertEquals(api.length, 3);
      const sizes = api.map(x => new URL(x.url).searchParams.get('titles')!.split('|').length);
      assertEquals(sizes, [50, 50, 20]);
      for (const x of api) {
        const q = new URL(x.url).searchParams;
        assertEquals(
          new URL(x.url).origin + new URL(x.url).pathname,
          'https://commons.wikimedia.org/w/api.php'
        );
        assertEquals(q.get('action'), 'query');
        assertEquals(q.get('prop'), 'imageinfo');
        assertEquals(q.get('iiprop'), 'url|size|sha1|mime');
        assertEquals(q.get('iiurlwidth'), String(PHOTO_STORE_WIDTH));
        assertEquals(q.get('maxlag'), '5');
        assert(
          q
            .get('titles')!
            .split('|')
            .every(t => t.startsWith('File:'))
        );
      }
      const thumbs = c.calls.filter(x => !x.url.includes('/w/api.php'));
      assertEquals(thumbs.length, 120);
      for (const x of c.calls) assertEquals(x.ua, UA, x.url);
      for (let i = 1; i < c.calls.length; i++) {
        assert(
          c.calls[i].start - c.calls[i - 1].end >= 1000,
          `${i} 回目が前の終わりから ${c.calls[i].start - c.calls[i - 1].end}ms`
        );
      }
      // 2回目は呼ばない
      const before = c.calls.length;
      const again = await fetchPhotos(entries, { io, work, contact: CONTACT });
      assertEquals(again.saved, 0);
      assertEquals(again.cached, 120);
      assertEquals(c.calls.length, before);
    } finally {
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test('AC-19: 取り下げ（withdrawn）の行とキャッシュにある行は取らない', async () => {
  const work = await Deno.makeTempDir({ prefix: 'spot-photos-fetch-' });
  try {
    const entries = manyEntries(4);
    entries[1] = { ...entries[1], status: 'withdrawn' };
    const paths = cachePaths(work, entries[2]);
    await Deno.mkdir(`${work}/cache`, { recursive: true });
    await Deno.writeFile(paths.image, JPEG);
    await Deno.writeTextFile(paths.meta, '{}');
    const c = fakeCommons(commonsFilesOf(entries));
    const { io } = captured({ fetch: c.fetch, now: c.clock.now, sleep: c.clock.sleep });
    const result = await fetchPhotos(entries, { io, work, contact: CONTACT });
    assertEquals([result.saved, result.cached], [2, 1]);
    const titles = new URL(c.calls[0].url).searchParams.get('titles');
    assertEquals(titles, 'File:Test 1.jpg|File:Test 4.jpg');
  } finally {
    await Deno.remove(work, { recursive: true });
  }
});

Deno.test(
  'AC-19: CLI の fetch は SPOT_WIKIDATA_CONTACT が無いと1回も呼ばずに 1。あれば台帳の3件を取る',
  async () => {
    const root = await makeRoot({ ledger: true });
    const work = await Deno.makeTempDir({ prefix: 'spot-photos-fetch-' });
    try {
      const entries = await fixtureEntries();
      const c = fakeCommons(commonsFilesOf(entries));
      const env = (contact?: string) => (name: string) =>
        name === 'SPOT_WIKIDATA_CONTACT' ? contact : undefined;
      const none = captured({ fetch: c.fetch, now: c.clock.now, sleep: c.clock.sleep, env: env() });
      assertEquals(await runCli(['fetch', '--root', root, '--work', work], none.io), 1);
      assertStringIncludes(none.err(), 'SPOT_WIKIDATA_CONTACT');
      assertEquals(c.calls.length, 0);
      const blank = captured({
        fetch: c.fetch,
        now: c.clock.now,
        sleep: c.clock.sleep,
        env: env('  '),
      });
      assertEquals(await runCli(['fetch', '--root', root, '--work', work], blank.io), 1);
      assertEquals(c.calls.length, 0);

      const ok = captured({
        fetch: c.fetch,
        now: c.clock.now,
        sleep: c.clock.sleep,
        env: env(CONTACT),
      });
      assertEquals(await runCli(['fetch', '--root', root, '--work', work], ok.io), 0, ok.err());
      assertEquals(c.calls.length, 4);
      for (const e of entries) {
        const p = cachePaths(work, e);
        assertEquals((await Deno.readFile(p.image)).slice(0, 3), JPEG.slice(0, 3));
        const meta = await Deno.readTextFile(p.meta);
        assertEquals(meta.includes(CONTACT), false);
        assertEquals(meta.match(/\d{4}-\d{2}-\d{2}T/), null);
        assertEquals(JSON.parse(meta).sha1, e.sha1);
      }
      const again = captured({
        fetch: c.fetch,
        now: c.clock.now,
        sleep: c.clock.sleep,
        env: env(CONTACT),
      });
      assertEquals(await runCli(['fetch', '--root', root, '--work', work], again.io), 0);
      assertEquals(c.calls.length, 4);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

// --- AC-20: 取ったものを確かめる ---

Deno.test(
  'AC-20: sha1 が違う・中身が JPEG でも PNG でもない・縮小版の幅が 1280 でないものは保存せず、名前を出して 1',
  async () => {
    const work = await Deno.makeTempDir({ prefix: 'spot-photos-fetch-' });
    try {
      const entries = manyEntries(5);
      const files = commonsFilesOf(entries);
      files['Test 2.jpg'] = { ...files['Test 2.jpg'], sha1: 'f'.repeat(40) };
      files['Test 3.jpg'] = { ...files['Test 3.jpg'], body: new TextEncoder().encode('<html>') };
      files['Test 4.jpg'] = { ...files['Test 4.jpg'], thumbwidth: 1024 };
      const c = fakeCommons(files);
      const { io, err } = captured({ fetch: c.fetch, now: c.clock.now, sleep: c.clock.sleep });
      const result = await fetchPhotos(entries, { io, work, contact: CONTACT });
      assertEquals(result.saved, 2);
      assertEquals(result.failed.length, 3);
      for (const name of ['テスト寺2', 'テスト寺3', 'テスト寺4']) assertStringIncludes(err(), name);
      assertStringIncludes(err(), 'sha1');
      const exists = async (p: string) =>
        await Deno.stat(p).then(
          () => true,
          () => false
        );
      for (const [i, saved] of [
        [0, true],
        [1, false],
        [2, false],
        [3, false],
        [4, true],
      ] as const) {
        assertEquals(await exists(cachePaths(work, entries[i]).image), saved, entries[i].name);
        assertEquals(await exists(cachePaths(work, entries[i]).meta), saved, entries[i].name);
      }
      // PNG の台帳の行に JPEG が返っても保存しない
      const png = { ...manyEntries(6)[5], r2Key: `spot-photos/${'5'.padStart(40, '0')}.png` };
      const pngFiles = commonsFilesOf([png]);
      pngFiles[png.file] = { ...pngFiles[png.file], body: JPEG };
      const c2 = fakeCommons(pngFiles);
      const r2 = await fetchPhotos([png], {
        io: captured({ fetch: c2.fetch, now: c2.clock.now, sleep: c2.clock.sleep }).io,
        work,
        contact: CONTACT,
      });
      assertEquals(r2.failed.length, 1);
    } finally {
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test('AC-20: CLI の fetch は失敗があれば 1（ほかは保存する）', async () => {
  const root = await makeRoot({ ledger: true });
  const work = await Deno.makeTempDir({ prefix: 'spot-photos-fetch-' });
  try {
    const entries = await fixtureEntries();
    const files = commonsFilesOf(entries);
    files[entries[1].file] = { ...files[entries[1].file], sha1: '0'.repeat(40) };
    const c = fakeCommons(files);
    const r = captured({
      fetch: c.fetch,
      now: c.clock.now,
      sleep: c.clock.sleep,
      env: name => (name === 'SPOT_WIKIDATA_CONTACT' ? CONTACT : undefined),
    });
    assertEquals(await runCli(['fetch', '--root', root, '--work', work], r.io), 1);
    assertStringIncludes(r.err(), '輪王寺（栃木県）');
    const saved = [];
    for await (const e of Deno.readDir(`${work}/cache`)) saved.push(e.name);
    assertEquals(saved.length, 4);
  } finally {
    await Deno.remove(root, { recursive: true });
    await Deno.remove(work, { recursive: true });
  }
});

// --- AC-21: R2 に置く ---

const R2_ENV: Record<string, string> = {
  R2_ACCOUNT_ID: 'acc0123',
  R2_ACCESS_KEY_ID: 'AKIDTEST',
  R2_SECRET_ACCESS_KEY: 'secret-test',
};

/** 偽の R2（S3 の ListObjectsV2・PutObject）。DELETE が来たら記録する */
function fakeR2(initial: string[] = [], opts: { pageSize?: number; failPut?: string } = {}) {
  const objects = new Map<string, { type: string | null; cache: string | null; body: Uint8Array }>(
    initial.map(k => [k, { type: 'image/jpeg', cache: null, body: JPEG }])
  );
  const calls: { method: string; url: string; auth: boolean }[] = [];
  const fetch = async (input: Request | string, init?: RequestInit): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    calls.push({
      method: req.method,
      url: req.url,
      auth: (req.headers.get('authorization') ?? '').startsWith('AWS4-HMAC-SHA256'),
    });
    assertEquals(url.host, `${R2_ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    const prefix = `/${R2_BUCKET}`;
    if (req.method === 'GET' && url.pathname === prefix) {
      const p = url.searchParams.get('prefix') ?? '';
      const keys = [...objects.keys()].filter(k => k.startsWith(p)).sort();
      const after = url.searchParams.get('continuation-token');
      const from = after ? keys.indexOf(after) : 0;
      const size = opts.pageSize ?? 1000;
      const page = keys.slice(from, from + size);
      const next = keys[from + size];
      const xml = `<?xml version="1.0"?><ListBucketResult>${page
        .map(k => `<Contents><Key>${k}</Key></Contents>`)
        .join(
          ''
        )}${next ? `<IsTruncated>true</IsTruncated><NextContinuationToken>${next}</NextContinuationToken>` : '<IsTruncated>false</IsTruncated>'}</ListBucketResult>`;
      return new Response(xml);
    }
    if (req.method === 'PUT' && url.pathname.startsWith(`${prefix}/`)) {
      const key = decodeURIComponent(url.pathname.slice(prefix.length + 1));
      if (key === opts.failPut) return new Response('no', { status: 500 });
      objects.set(key, {
        type: req.headers.get('content-type'),
        cache: req.headers.get('cache-control'),
        body: new Uint8Array(await req.arrayBuffer()),
      });
      return new Response('', { status: 200 });
    }
    return new Response('unexpected', { status: 400 });
  };
  return { fetch, calls, objects };
}

async function cacheAll(work: string, entries: LedgerEntry302[]): Promise<void> {
  await Deno.mkdir(`${work}/cache`, { recursive: true });
  for (const e of entries) {
    const p = cachePaths(work, e);
    await Deno.writeFile(p.image, e.r2Key.endsWith('.png') ? PNG : JPEG);
    await Deno.writeTextFile(p.meta, '{}');
  }
}

Deno.test(
  'AC-21: upload --dry-run は PUT せずに数を出し、upload は無いキーだけを置いて数え直す',
  async () => {
    const work = await Deno.makeTempDir({ prefix: 'spot-photos-upload-' });
    try {
      const entries = manyEntries(5);
      entries[4] = { ...entries[4], r2Key: entries[4].r2Key.replace('.jpg', '.png') };
      await cacheAll(work, entries);
      const r2 = fakeR2([entries[0].r2Key, 'spot-photos/zzz-other.jpg'], { pageSize: 2 });
      const dry = captured({ fetch: r2.fetch });
      assertEquals(await uploadPhotos(entries, { io: dry.io, work, env: R2_ENV, dryRun: true }), 0);
      assertStringIncludes(
        dry.out(),
        '台帳 5 件 / R2 に既にある 1 件 / 置く 4 件 / キャッシュに無い 0 件'
      );
      assertEquals(
        r2.calls.filter(x => x.method !== 'GET'),
        []
      );
      assert(r2.calls.every(x => x.auth));
      assert(r2.calls.every(x => new URL(x.url).searchParams.get('prefix') === 'spot-photos/'));

      const real = captured({ fetch: r2.fetch });
      assertEquals(
        await uploadPhotos(entries, { io: real.io, work, env: R2_ENV, dryRun: false }),
        0
      );
      const puts = r2.calls.filter(x => x.method === 'PUT');
      assertEquals(puts.length, 4);
      assertStringIncludes(real.out(), '置いた 4 件 / 失敗 0 件 / R2 にある台帳の写真 5 / 5');
      for (const e of entries.slice(1)) {
        const o = r2.objects.get(e.r2Key)!;
        assertEquals(o.type, e.r2Key.endsWith('.png') ? 'image/png' : 'image/jpeg');
        assertEquals(o.cache, 'public, max-age=31536000, immutable');
        assertEquals(o.body, e.r2Key.endsWith('.png') ? PNG : JPEG);
      }
      // 2回目は PUT 0 回
      const again = captured({ fetch: r2.fetch });
      assertEquals(
        await uploadPhotos(entries, { io: again.io, work, env: R2_ENV, dryRun: false }),
        0
      );
      assertEquals(r2.calls.filter(x => x.method === 'PUT').length, 4);
      assertEquals(
        r2.calls.filter(x => x.method === 'DELETE'),
        []
      );
    } finally {
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'AC-21: キャッシュに無いものが1つでも・鍵が無い・spot-photos/ の外のキー なら PUT せずに 1',
  async () => {
    const work = await Deno.makeTempDir({ prefix: 'spot-photos-upload-' });
    try {
      const entries = manyEntries(3);
      await cacheAll(work, entries.slice(0, 2));
      const r2 = fakeR2();
      const miss = captured({ fetch: r2.fetch });
      assertEquals(
        await uploadPhotos(entries, { io: miss.io, work, env: R2_ENV, dryRun: false }),
        1
      );
      assertStringIncludes(miss.out(), 'キャッシュに無い 1 件');
      assertStringIncludes(miss.err(), 'テスト寺3');
      assertEquals(
        r2.calls.filter(x => x.method === 'PUT'),
        []
      );

      await cacheAll(work, entries);
      for (const k of Object.keys(R2_ENV)) {
        const env = { ...R2_ENV };
        delete env[k];
        const before = r2.calls.length;
        const r = captured({ fetch: r2.fetch });
        assertEquals(await uploadPhotos(entries, { io: r.io, work, env, dryRun: true }), 1, k);
        assertStringIncludes(r.err(), `${k} が未設定`);
        assertEquals(r2.calls.length, before, k);
      }

      const outside = entries.map((e, i) => (i === 1 ? { ...e, r2Key: 'abc/x.jpg' } : e));
      const before = r2.calls.length;
      const o = captured({ fetch: r2.fetch });
      assertEquals(await uploadPhotos(outside, { io: o.io, work, env: R2_ENV, dryRun: false }), 1);
      assertStringIncludes(o.err(), 'テスト寺2');
      assertEquals(r2.calls.length, before);
      assertEquals(
        r2.calls.filter(x => x.method === 'DELETE'),
        []
      );
    } finally {
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test('AC-21: PUT に失敗した写真があると、数え直して足りないので 1', async () => {
  const work = await Deno.makeTempDir({ prefix: 'spot-photos-upload-' });
  try {
    const entries = manyEntries(3);
    await cacheAll(work, entries);
    const r2 = fakeR2([], { failPut: entries[1].r2Key });
    const r = captured({ fetch: r2.fetch });
    assertEquals(await uploadPhotos(entries, { io: r.io, work, env: R2_ENV, dryRun: false }), 1);
    assertStringIncludes(r.out(), '置いた 2 件 / 失敗 1 件 / R2 にある台帳の写真 2 / 3');
    assertStringIncludes(r.err(), 'テスト寺2');
  } finally {
    await Deno.remove(work, { recursive: true });
  }
});

Deno.test(
  'AC-21: CLI の upload --dry-run（鍵は偽物・偽の R2）で キャッシュに無い 0 件',
  async () => {
    const root = await makeRoot({ ledger: true });
    const work = await Deno.makeTempDir({ prefix: 'spot-photos-upload-' });
    try {
      await cacheAll(work, await fixtureEntries());
      const r2 = fakeR2();
      const r = captured({ fetch: r2.fetch, env: name => R2_ENV[name] });
      assertEquals(
        await runCli(['upload', '--dry-run', '--root', root, '--work', work], r.io),
        0,
        r.err()
      );
      assertStringIncludes(
        r.out(),
        '台帳 3 件 / R2 に既にある 0 件 / 置く 3 件 / キャッシュに無い 0 件'
      );
      assertEquals(
        r2.calls.filter(x => x.method !== 'GET'),
        []
      );
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

// --- AC-22: 独自ドメインで読めるか ---

Deno.test(
  'AC-22: verify は台帳の各行に HEAD（変換を使わない）を送り、全部 200 なら 0、違えば名前を出して 1',
  async () => {
    const entries = manyEntries(3);
    const calls: { method: string; url: string }[] = [];
    const fetchWith = (missing: Set<string>) => (input: Request | string, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      calls.push({ method: req.method, url: req.url });
      const key = new URL(req.url).pathname.slice(1);
      return Promise.resolve(new Response(null, { status: missing.has(key) ? 404 : 200 }));
    };
    const ok = captured({ fetch: fetchWith(new Set()) });
    assertEquals(await verifyPhotos(entries, { io: ok.io }), 0);
    assertStringIncludes(ok.out(), '3/3 件 200');
    assertEquals(calls.length, 3);
    for (const [i, c] of calls.entries()) {
      assertEquals(c.method, 'HEAD');
      assertEquals(c.url, `https://img.goshuinsanpo.com/${entries[i].r2Key}`);
      assertEquals(c.url.includes('/cdn-cgi/image/'), false);
    }
    const bad = captured({ fetch: fetchWith(new Set([entries[2].r2Key])) });
    assertEquals(await verifyPhotos(entries, { io: bad.io }), 1);
    assertStringIncludes(bad.out(), '2/3 件 200');
    assertStringIncludes(bad.err(), 'テスト寺3');
  }
);

Deno.test('AC-22: CLI の verify は台帳から読む（鍵は要らない）', async () => {
  const root = await makeRoot({ ledger: true });
  try {
    const r = captured({
      fetch: () => Promise.resolve(new Response(null, { status: 200 })),
      env: () => undefined,
    });
    assertEquals(await runCli(['verify', '--root', root], r.io), 0, r.err());
    assertStringIncludes(r.out(), '3/3 件 200');
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test(
  'AC-20: 縮小版の URL が Commons の置き場所（upload・thumb.wikimedia.org）でなければ、取りに行かずに名前を出す',
  async () => {
    const work = await Deno.makeTempDir({ prefix: 'spot-photos-fetch-' });
    try {
      const entries = manyEntries(2);
      const files = commonsFilesOf(entries);
      files['Test 2.jpg'] = { ...files['Test 2.jpg'], thumburl: 'https://example.com/x.jpg' };
      const c = fakeCommons(files);
      const { io, err } = captured({ fetch: c.fetch, now: c.clock.now, sleep: c.clock.sleep });
      const result = await fetchPhotos(entries, { io, work, contact: CONTACT });
      assertEquals(result.saved, 1);
      assertEquals(result.failed, ['テスト寺2（静岡県）']);
      assertStringIncludes(err(), 'wikimedia.org');
      assertEquals(
        c.calls.filter(x => x.url.startsWith('https://example.com/')),
        []
      );
    } finally {
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'AC-19: 縮小版が thumb.wikimedia.org（utm 付き）でも、幅がちょうど 1280 の元のファイル（upload.wikimedia.org）でも取る',
  async () => {
    const work = await Deno.makeTempDir({ prefix: 'spot-photos-fetch-' });
    try {
      const entries = manyEntries(2);
      const files = commonsFilesOf(entries);
      files['Test 2.jpg'] = {
        ...files['Test 2.jpg'],
        width: 1280,
        height: 960,
        thumburl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Test_2.jpg',
      };
      const c = fakeCommons(files);
      const { io, err } = captured({ fetch: c.fetch, now: c.clock.now, sleep: c.clock.sleep });
      const result = await fetchPhotos(entries, { io, work, contact: CONTACT });
      assertEquals(result.failed, [], err());
      assertEquals(result.saved, 2);
      const hosts = c.calls.slice(1).map(x => new URL(x.url).host);
      assertEquals(hosts, ['thumb.wikimedia.org', 'upload.wikimedia.org']);
    } finally {
      await Deno.remove(work, { recursive: true });
    }
  }
);
