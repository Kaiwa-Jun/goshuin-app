// Deno テスト（画面のサーバー。Deno.serve を一時のポートで立て、fetch で API を叩く。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-wikidata/
// 契約書: docs/issues/issue-301-spot-wikidata.md（S3 / AC-18・AC-19）
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { parseLedger, SEED_FILES } from '../spot-coords/coords.ts';
import { runCli as runSpotCoords } from '../spot-coords/main.ts';
import { east, type FakeSpot, type FakeWorld, north, writeRoot } from './fake_world.ts';
import { denoIo, runCli } from './main.ts';
import { readSeedRows, serializeJson, validateExport } from './match.ts';
import { startServer } from './server.ts';

interface Item {
  idx: number;
  name: string;
  verdict: string;
  points: { kind: string; lat: number; lng: number; ref: string | null }[];
  seed: { lat: number; lng: number };
}

/** 寺社 100 件・台帳は OSM 由来 55 件・画面の行は残りの 45 件（どれも osm と wd の点を持つ） */
function osmWorld(): FakeWorld {
  const spots: FakeSpot[] = Array.from({ length: 100 }, (_, i) => ({
    name: `テスト寺${i + 1}`,
    prefecture: '静岡県',
    address: `静岡県袋井市テスト町${i + 1}`,
    ...east({ lat: 34.7, lng: 137.9 }, i * 2_000),
  }));
  return {
    spots,
    ledger: spots.slice(0, 55).map((s, i) => ({
      idx: i + 1,
      source: 'osm' as const,
      ref: `way/${i + 1}`,
      to: north(s, 300),
    })),
    entities: [],
    search: {},
    wdqs: {},
    addr: {},
    gsi: [],
    nominatim: {},
    commons: [],
  };
}

async function setup() {
  const dir = await Deno.makeTempDir({ prefix: 'spot-wikidata-server-' });
  const root = `${dir}/root`;
  const work = `${dir}/work`;
  const world = osmWorld();
  await writeRoot(root, world);
  const rows = readSeedRows(
    await Promise.all(
      SEED_FILES.map(async path => ({ path, text: await Deno.readTextFile(`${root}/${path}`) }))
    )
  );
  const ledger = parseLedger(await Deno.readTextFile(`${root}/supabase/data/spot-coords-292.json`));
  const items = rows.slice(55).map((r, i) => ({
    idx: r.idx,
    name: r.name,
    prefecture: r.prefecture,
    address: r.address,
    type: r.type,
    rank: r.rank,
    file: r.file,
    line: r.line,
    seed: { lat: r.lat, lng: r.lng },
    verdict: i === 0 ? 'suggest' : 'owner',
    suggestion: null,
    points: [
      { kind: 'wd', ...north(r, 800), ref: `Q${i + 1}`, label: r.name, distanceM: 800 },
      { kind: 'osm', ...east(r, 600), ref: `node/${i + 1}`, label: r.name, distanceM: 600 },
      { kind: 'gsi', ...north(r, 820), ref: null, label: r.name, distanceM: 820 },
    ],
    link: { qid: `Q${i + 1}`, confidence: 'high', label: r.name },
  }));
  const data = {
    schemaVersion: 1,
    ledgerOsmCount: 55,
    maxOsm: 99,
    counts: { suggest: 1, owner: 44, investigate: 0, keep: 0 },
    items,
  };
  await Deno.mkdir(`${work}/review`, { recursive: true });
  await Deno.writeTextFile(`${work}/review/review-data.json`, serializeJson(data));
  const server = await startServer({
    port: 0,
    root,
    work,
    now: () => Date.parse('2026-10-03T00:00:00Z'),
  });
  const base = `http://127.0.0.1:${server.addr.port}`;
  const put = (body: unknown) =>
    fetch(`${base}/api/choices`, { method: 'PUT', body: JSON.stringify(body) });
  return {
    dir,
    root,
    work,
    rows,
    ledger,
    items: items as Item[],
    server,
    base,
    put,
    async [Symbol.asyncDispose]() {
      await server.shutdown();
      await Deno.remove(dir, { recursive: true });
    },
  };
}

async function rawGet(port: number, path: string): Promise<string> {
  const conn = await Deno.connect({ hostname: '127.0.0.1', port });
  await conn.write(
    new TextEncoder().encode(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`)
  );
  const chunks: Uint8Array[] = [];
  const buf = new Uint8Array(4096);
  for (;;) {
    const n = await conn.read(buf);
    if (n === null) break;
    chunks.push(buf.slice(0, n));
  }
  conn.close();
  return new TextDecoder().decode(new Uint8Array(chunks.flatMap(c => [...c])));
}

Deno.test('AC-18: serve は 127.0.0.1 で待ち、画面の3つと API は 200、ほかは 404', async () => {
  await using s = await setup();
  assertEquals(s.server.addr.hostname, '127.0.0.1');
  for (const path of ['/', '/review.js', '/review.css', '/api/data', '/api/choices']) {
    const res = await fetch(`${s.base}${path}`);
    assertEquals(res.status, 200, path);
    await res.body?.cancel();
  }
  const html = await (await fetch(`${s.base}/`)).text();
  assertStringIncludes(html, '寺社の座標を選ぶ（#292 第2弾）');
  assertEquals(
    (await fetch(`${s.base}/review.js`)).headers.get('content-type'),
    'text/javascript; charset=utf-8'
  );
  const data = await (await fetch(`${s.base}/api/data`)).json();
  assertEquals(data.items.length, 45);
  assertEquals(await (await fetch(`${s.base}/api/choices`)).json(), { items: [] });
  for (const path of ['/main.ts', '/api/nope', '/review/index.html', '/server.ts']) {
    const res = await fetch(`${s.base}${path}`);
    assertEquals(res.status, 404, path);
    await res.body?.cancel();
  }
  for (const path of ['/../main.ts', '/%2e%2e/main.ts', '/review/../main.ts']) {
    const raw = await rawGet(s.server.addr.port, path);
    assert(raw.startsWith('HTTP/1.1 404'), `${path}: ${raw.slice(0, 40)}`);
  }
  // API は決めたメソッドだけ
  const del = await fetch(`${s.base}/api/choices`, { method: 'DELETE' });
  assertEquals(del.status, 404);
  await del.body?.cancel();
});

Deno.test(
  'AC-18: 画面は MapLibre GL JS を版の固定と integrity 付きで読み、データを持たない',
  async () => {
    const html = await Deno.readTextFile(new URL('./review/index.html', import.meta.url));
    const tags = html.match(/<(script|link)[^>]*maplibre-gl[^>]*>/g) ?? [];
    assertEquals(tags.length, 2);
    for (const t of tags) {
      assert(/maplibre-gl@\d+\.\d+\.\d+\//.test(t), t);
      assert(/integrity="sha384-[A-Za-z0-9+/=]+"/.test(t), t);
      assertStringIncludes(t, 'crossorigin="anonymous"');
      assertStringIncludes(t, 'https://cdn.jsdelivr.net/npm/');
    }
    for (const name of ['index.html', 'review.js', 'review.css']) {
      const text = await Deno.readTextFile(new URL(`./review/${name}`, import.meta.url));
      assert(!/"idx":\s*\d/.test(text), `${name} にデータがある`);
      assert(
        !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(
          text.replace(/maplibre-gl@\d+\.\d+\.\d+/g, '')
        ),
        name
      );
    }
    const js = await Deno.readTextFile(new URL('./review/review.js', import.meta.url));
    for (const s of [
      'cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
      'cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
      '出典: 国土地理院',
      'https://maps.gsi.go.jp/#17/',
      '#6B7280',
      '#2563EB',
      '#16A34A',
      '#F59E0B',
      '#9333EA',
      '#DC2626',
    ]) {
      assertStringIncludes(js, s);
    }
    assert(!/choice-(gsi|addr)/.test(js), '地理院の点を選ぶボタンは無い');
    assertStringIncludes(html, 'メモは公開の台帳（根拠）に入ります。人の名前・メールは書かない');
  }
);

Deno.test(
  'AC-19: PUT /api/choices は保存し、GET で同じものが返る（サーバーが座標と ref を埋める）',
  async () => {
    await using s = await setup();
    const [a, b] = s.items;
    const res = await s.put({ idx: a.idx, choice: 'wd', note: '本堂の前' });
    assertEquals(res.status, 200, await res.clone().text());
    const body = await res.json();
    assertEquals(body.count, 1);
    const wd = a.points.find(p => p.kind === 'wd')!;
    assertEquals([body.item.lat, body.item.lng, body.item.ref], [wd.lat, wd.lng, wd.ref]);
    assertEquals(body.item.chosen_at, '2026-10-03T00:00:00.000Z');
    assertEquals((await s.put({ idx: b.idx, choice: 'seed' })).status, 200);
    const custom = north(b.seed, 40);
    // 同じ行を選び直すと置き換わる
    assertEquals(
      (await s.put({ idx: b.idx, choice: 'custom', lat: custom.lat, lng: custom.lng })).status,
      200
    );
    const saved = JSON.parse(await Deno.readTextFile(`${s.work}/review/choices.json`));
    const got = await (await fetch(`${s.base}/api/choices`)).json();
    assertEquals(got, saved);
    assertEquals(
      got.items.map((i: { idx: number; choice: string }) => [i.idx, i.choice]),
      [
        [a.idx, 'wd'],
        [b.idx, 'custom'],
      ]
    );
    assertEquals(got.items[1].ref, null);
    assertEquals(got.items[0].note, '本堂の前');
    assertEquals(got.items[0].file, SEED_FILES[0]);
    assertEquals(got.items[0].verdict, 'suggest');
  }
);

Deno.test(
  'AC-19: 保存済みの osm が 44 件で台帳 55 件のとき、45 件目の osm は 400（名前を返し、保存しない）',
  async () => {
    await using s = await setup();
    for (const item of s.items.slice(0, 44)) {
      const res = await s.put({ idx: item.idx, choice: 'osm' });
      assertEquals(res.status, 200, await res.clone().text());
      await res.body?.cancel();
    }
    const before = await Deno.readTextFile(`${s.work}/review/choices.json`);
    const last = s.items[44];
    const res = await s.put({ idx: last.idx, choice: 'osm' });
    assertEquals(res.status, 400);
    const { error } = await res.json();
    assertStringIncludes(error, last.name);
    assertStringIncludes(error, '99');
    assertEquals(await Deno.readTextFile(`${s.work}/review/choices.json`), before);
    // osm 以外なら選べる
    const ok = await s.put({ idx: last.idx, choice: 'wd' });
    assertEquals(ok.status, 200);
    await ok.body?.cancel();
  }
);

Deno.test(
  'AC-19: だめな選択は 400 と寺社の名前（地理院の点・10m 未満・メール・画面に無い行）',
  async () => {
    await using s = await setup();
    const a = s.items[0];
    const cases: [unknown, string][] = [
      [{ idx: a.idx, choice: 'gsi' }, a.name],
      [{ idx: a.idx, choice: 'addr' }, a.name],
      [{ idx: a.idx, choice: 'custom', ...north(a.seed, 5) }, a.name],
      [
        { idx: a.idx, choice: 'custom', ...north(a.seed, 500), note: '連絡は a@example.com' },
        a.name,
      ],
      [{ idx: 3, choice: 'seed' }, '3'],
      [{ idx: a.idx, choice: 'custom' }, a.name],
    ];
    for (const [body, name] of cases) {
      const res = await s.put(body);
      assertEquals(res.status, 400, JSON.stringify(body));
      const { error } = await res.json();
      assertStringIncludes(error, name, JSON.stringify(body));
    }
    const bad = await fetch(`${s.base}/api/choices`, { method: 'PUT', body: '{' });
    assertEquals(bad.status, 400);
    await bad.body?.cancel();
    assertEquals(await (await fetch(`${s.base}/api/choices`)).json(), { items: [] });
  }
);

Deno.test(
  'AC-19: POST /api/export は書き出し、2回目は前のものを .prev に残す。check-export と import-owner --dry-run が通る',
  async () => {
    await using s = await setup();
    const [a, b, c] = s.items;
    for (const body of [
      { idx: a.idx, choice: 'wd' },
      { idx: b.idx, choice: 'osm' },
      { idx: c.idx, choice: 'custom', ...east(c.seed, 300), note: '山門' },
    ]) {
      const res = await s.put(body);
      assertEquals(res.status, 200);
      await res.body?.cancel();
    }
    const empty = await fetch(`${s.base}/api/export`, { method: 'GET' });
    assertEquals(empty.status, 404);
    await empty.body?.cancel();
    const res = await fetch(`${s.base}/api/export`, { method: 'POST' });
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { count: 3, file: 'coords-292-review.json' });
    const path = `${s.work}/review/coords-292-review.json`;
    const first = JSON.parse(await Deno.readTextFile(path));
    assertEquals(first.issue, 292);
    assertEquals(first.from, 'spot-wikidata review (#301)');
    assertEquals(first.count, 3);
    assertEquals(first.exported_at, '2026-10-03T00:00:00.000Z');
    assertEquals(
      Object.keys(first.items[0]).sort(),
      [
        'choice',
        'chosen_at',
        'file',
        'idx',
        'lat',
        'line',
        'lng',
        'name',
        'note',
        'prefecture',
        'ref',
        'seed',
        'verdict',
      ].sort()
    );
    validateExport(first, s.rows, s.ledger);

    // 2回目は前のものを .prev に
    const more = await s.put({ idx: s.items[3].idx, choice: 'seed' });
    assertEquals(more.status, 200);
    await more.body?.cancel();
    const res2 = await fetch(`${s.base}/api/export`, { method: 'POST' });
    assertEquals((await res2.json()).count, 4);
    assertEquals(
      JSON.parse(await Deno.readTextFile(`${s.work}/review/coords-292-review.prev.json`)),
      first
    );
    assertEquals(JSON.parse(await Deno.readTextFile(path)).count, 4);

    // check-export（終了コード 0）
    const out = { stdout: '', stderr: '' };
    const io = {
      ...denoIo(),
      stdout: (t: string) => {
        out.stdout += t;
      },
      stderr: (t: string) => {
        out.stderr += t;
      },
    };
    assertEquals(await runCli(['check-export', path, '--root', s.root], io), 0, out.stderr);
    assertStringIncludes(out.stdout, '4 件');
    // import-owner --dry-run（spot-coords。終了コード 0）
    const out2 = { stdout: '', stderr: '' };
    const code = await runSpotCoords(
      ['import-owner', path, '--batch', '2', '--dry-run', '--root', s.root],
      {
        readTextFile: io.readTextFile,
        writeTextFile: () => Promise.reject(new Error('書かないはず')),
        stdout: t => {
          out2.stdout += t;
        },
        stderr: t => {
          out2.stderr += t;
        },
      }
    );
    assertEquals(code, 0, out2.stderr);
    assertStringIncludes(out2.stderr, '台帳に 3 件足すと 58 件');
  }
);

Deno.test('check-export: だめな書き出しは名前を出して終了コード 1', async () => {
  await using s = await setup();
  const a = s.items[0];
  const path = `${s.dir}/bad.json`;
  await Deno.writeTextFile(
    path,
    JSON.stringify({
      issue: 292,
      items: [
        {
          idx: a.idx,
          name: a.name,
          prefecture: '静岡県',
          file: SEED_FILES[0],
          line: s.rows[a.idx - 1].line,
          verdict: 'owner',
          seed: a.seed,
          choice: 'gsi',
          lat: north(a.seed, 500).lat,
          lng: a.seed.lng,
          ref: null,
          note: '',
          chosen_at: '',
        },
      ],
    })
  );
  const out = { stdout: '', stderr: '' };
  const io = {
    ...denoIo(),
    stdout: (t: string) => {
      out.stdout += t;
    },
    stderr: (t: string) => {
      out.stderr += t;
    },
  };
  assertEquals(await runCli(['check-export', path, '--root', s.root], io), 1);
  assertStringIncludes(out.stderr, a.name);
});

Deno.test(
  'fixtures/work の画面のデータは、本物の seed と台帳に合う（作り物の点で選んで書き出せる）',
  async () => {
    const ROOT = new URL('../../../', import.meta.url);
    const current = parseLedger(
      await Deno.readTextFile(new URL('supabase/data/spot-coords-292.json', ROOT))
    );
    // 作り物の画面のデータは、第1弾だけが台帳にあったとき（#301）に作った。
    // 第2弾以降の行は台帳から外し、その寺社の seed の座標も直す前（old）に戻して照らす
    const later = new Map(current.entries.filter(e => e.batch > 1).map(e => [e.idx, e]));
    const ledger = { ...current, entries: current.entries.filter(e => e.batch === 1) };
    const rows = readSeedRows(
      await Promise.all(
        SEED_FILES.map(async path => ({ path, text: await Deno.readTextFile(new URL(path, ROOT)) }))
      )
    ).map(r => {
      const e = later.get(r.idx);
      return e ? { ...r, lat: e.old.lat, lng: e.old.lng } : r;
    });
    const data = JSON.parse(
      await Deno.readTextFile(new URL('./fixtures/work/review/review-data.json', import.meta.url))
    );
    assertEquals(data.ledgerOsmCount, 55);
    assertEquals(data.items[0].verdict, 'suggest');
    const items = data.items.map((i: Item & { prefecture: string; file: string; line: number }) => {
      const p = i.points.find(x => x.kind === 'wd' || x.kind === 'osm');
      return {
        ...i,
        choice: p ? p.kind : 'seed',
        lat: p ? p.lat : i.seed.lat,
        lng: p ? p.lng : i.seed.lng,
        ref: p ? p.ref : null,
        note: '',
        chosen_at: '',
      };
    });
    assertEquals(validateExport({ items }, rows, ledger).items.length, data.items.length);
    assert(data.items.some((i: Item) => i.points.some(p => p.kind === 'osm')));
    assert(data.items.some((i: Item) => i.points.length === 0));
  }
);
