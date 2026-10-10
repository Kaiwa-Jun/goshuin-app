// Deno テスト（選ぶ画面のサーバー。Deno.serve を一時のポートで立て、fetch で API を叩く。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-302-spot-photo-band.md（S3 / AC-15・AC-16）
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { serializeJson } from '../spot-wikidata/match.ts';
import { fixtureCandidates, fixtureCandidates320 } from './fixtures/load.ts';
import { CANDIDATES_FILE, CHOICES_FILE, DEFAULT_PORT, startServer } from './server.ts';

async function setup() {
  const work = await Deno.makeTempDir({ prefix: 'spot-photos-server-' });
  await Deno.mkdir(`${work}/review`, { recursive: true });
  const candidates = await fixtureCandidates();
  await Deno.writeTextFile(`${work}/review/${CANDIDATES_FILE}`, serializeJson(candidates));
  let port = 0;
  const server = await startServer({
    work,
    port: 0,
    onListen: p => (port = p),
  });
  const base = () => `http://127.0.0.1:${port}`;
  const put = (body: unknown) =>
    fetch(`${base()}/api/choices`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const saved = async (): Promise<string | null> => {
    try {
      return await Deno.readTextFile(`${work}/review/${CHOICES_FILE}`);
    } catch {
      return null;
    }
  };
  const close = async () => {
    await server.shutdown();
    await Deno.remove(work, { recursive: true });
  };
  return { work, server, base, put, saved, close, candidates };
}

Deno.test('既定のポートは 8302', () => {
  assertEquals(DEFAULT_PORT, 8302);
});

Deno.test('AC-15: 127.0.0.1 だけで待ち、画面と API のほかは 404', async () => {
  const t = await setup();
  try {
    assertEquals(t.server.addr.hostname, '127.0.0.1');
    for (const path of [
      '/',
      '/review.js',
      '/review.css',
      '/geometry.js',
      '/api/data',
      '/api/choices',
    ]) {
      const res = await fetch(`${t.base()}${path}`);
      await res.body?.cancel();
      assertEquals(res.status, 200, path);
    }
    const html = await (await fetch(`${t.base()}/`)).text();
    assertStringIncludes(html, '帯の写真を選ぶ（#302）');
    const js = await fetch(`${t.base()}/geometry.js`);
    assertStringIncludes(js.headers.get('content-type') ?? '', 'javascript');
    assertStringIncludes(await js.text(), 'export function photoGeometry');
    const data = await (await fetch(`${t.base()}/api/data`)).json();
    assertEquals(data.entries.length, t.candidates.entries.length);
    assertEquals(await (await fetch(`${t.base()}/api/choices`)).json(), { choices: [] });

    for (const path of [
      '/../main.ts',
      '/%2e%2e/main.ts',
      '/main.ts',
      '/api/nope',
      '/server.ts',
      '/review/review.js',
    ]) {
      const res = await fetch(`${t.base()}${path}`);
      await res.body?.cancel();
      assertEquals(res.status, 404, path);
    }
    const post = await fetch(`${t.base()}/api/data`, { method: 'POST', body: '{}' });
    await post.body?.cancel();
    assertEquals(post.status, 404);
  } finally {
    await t.close();
  }
});

const KANAHEBI = 1028;
const KANAHEBI_FILE = 'Haiden of Kanahebi-Suijinja shrine 1.JPG';

Deno.test('AC-16: 決まりに合わない1件は 400 と寺社の名前を返し、保存しない', async () => {
  const t = await setup();
  try {
    const tongu = t.candidates.entries.find(e => e.name === '北海道神宮頓宮')!;
    assertEquals(tongu.linkConfidence, 'medium');
    const chuson = t.candidates.entries.find(e => e.name === '中尊寺')!;
    const konjiki = t.candidates.entries.find(e => e.name === '中尊寺金色堂')!;
    assertEquals(chuson.files[0].sha1, konjiki.files[0].sha1);

    // 先に中尊寺で採っておく（このファイルを中尊寺金色堂では採れない）
    const first = await t.put({
      idx: chuson.idx,
      decision: 'approve',
      file: chuson.files[0].file,
      focusY: 0.5,
    });
    assertEquals(first.status, 200, await first.text());
    const before = await t.saved();
    assert(before !== null);

    const bad: [string, string, unknown][] = [
      [
        '候補に無い file',
        '金蛇水神社',
        { idx: KANAHEBI, decision: 'approve', file: 'Nope.jpg', focusY: 0.5 },
      ],
      [
        'focusY 1.5',
        '金蛇水神社',
        { idx: KANAHEBI, decision: 'approve', file: KANAHEBI_FILE, focusY: 1.5 },
      ],
      [
        'focusY 0.505',
        '金蛇水神社',
        { idx: KANAHEBI, decision: 'approve', file: KANAHEBI_FILE, focusY: 0.505 },
      ],
      ['focusY が無い', '金蛇水神社', { idx: KANAHEBI, decision: 'approve', file: KANAHEBI_FILE }],
      [
        'medium を確かめずに採る',
        '北海道神宮頓宮',
        { idx: tongu.idx, decision: 'approve', file: tongu.files[0].file, focusY: 0.5 },
      ],
      [
        '別の寺社で採ったファイル',
        '中尊寺金色堂',
        { idx: konjiki.idx, decision: 'approve', file: konjiki.files[0].file, focusY: 0.5 },
      ],
      ['知らない decision', '金蛇水神社', { idx: KANAHEBI, decision: 'maybe' }],
      ['知らない reason', '金蛇水神社', { idx: KANAHEBI, decision: 'reject', reason: 'ugly' }],
      ['reason が無い', '金蛇水神社', { idx: KANAHEBI, decision: 'reject' }],
      [
        '知らないキー',
        '金蛇水神社',
        { idx: KANAHEBI, decision: 'reject', reason: 'other', note: 'x' },
      ],
      ['候補に無い idx', 'idx 3', { idx: 3, decision: 'reject', reason: 'other' }],
    ];
    for (const [why, who, body] of bad) {
      const res = await t.put(body);
      assertEquals(res.status, 400, why);
      const { error } = await res.json();
      assertStringIncludes(error, who, why);
      assertEquals(await t.saved(), before, `${why} で保存した`);
    }
    const notJson = await fetch(`${t.base()}/api/choices`, { method: 'PUT', body: '{' });
    assertEquals(notJson.status, 400);
    await notJson.body?.cancel();
    assertEquals(await t.saved(), before);
  } finally {
    await t.close();
  }
});

Deno.test(
  'AC-16: 正しい1件は choices.json に残り、GET で同じものが返る。同じ idx は置き換える',
  async () => {
    const t = await setup();
    try {
      const tongu = t.candidates.entries.find(e => e.name === '北海道神宮頓宮')!;
      const ok1 = await t.put({
        idx: KANAHEBI,
        decision: 'approve',
        file: KANAHEBI_FILE,
        focusY: 0.42,
      });
      assertEquals(ok1.status, 200, await ok1.text());
      const ok2 = await t.put({
        idx: tongu.idx,
        decision: 'approve',
        file: tongu.files[0].file,
        focusY: 0.6,
        linkChecked: true,
      });
      assertEquals(ok2.status, 200, await ok2.text());

      const expected = [
        {
          idx: tongu.idx,
          decision: 'approve',
          file: tongu.files[0].file,
          focusY: 0.6,
          linkChecked: true,
        },
        {
          idx: KANAHEBI,
          decision: 'approve',
          file: KANAHEBI_FILE,
          focusY: 0.42,
          linkChecked: false,
        },
      ];
      const got = await (await fetch(`${t.base()}/api/choices`)).json();
      assertEquals(got.choices, expected);
      assertEquals(JSON.parse((await t.saved())!).choices, expected);

      const replaced = await t.put({ idx: KANAHEBI, decision: 'reject', reason: 'person' });
      assertEquals(replaced.status, 200, await replaced.text());
      const after = await (await fetch(`${t.base()}/api/choices`)).json();
      assertEquals(after.choices, [
        expected[0],
        { idx: KANAHEBI, decision: 'reject', reason: 'person' },
      ]);

      // 外したファイルは、別の寺社で採れる（中尊寺を外す → 中尊寺金色堂で採る）
      const chuson = t.candidates.entries.find(e => e.name === '中尊寺')!;
      const konjiki = t.candidates.entries.find(e => e.name === '中尊寺金色堂')!;
      await (
        await t.put({
          idx: chuson.idx,
          decision: 'approve',
          file: chuson.files[0].file,
          focusY: 0.5,
        })
      ).body?.cancel();
      await (
        await t.put({ idx: chuson.idx, decision: 'reject', reason: 'other-place' })
      ).body?.cancel();
      const moved = await t.put({
        idx: konjiki.idx,
        decision: 'approve',
        file: konjiki.files[0].file,
        focusY: 0.5,
      });
      assertEquals(moved.status, 200, await moved.text());
    } finally {
      await t.close();
    }
  }
);

// --- #320 AC-10: 第2弾の候補（serve --batch 2 は作業フォルダの b2/ を渡すだけ） ---

async function setup320() {
  const work = await Deno.makeTempDir({ prefix: 'spot-photos-server-' });
  await Deno.mkdir(`${work}/review`, { recursive: true });
  const candidates = await fixtureCandidates320();
  await Deno.writeTextFile(`${work}/review/${CANDIDATES_FILE}`, serializeJson(candidates));
  let port = 0;
  const server = await startServer({ work, port: 0, onListen: p => (port = p) });
  const put = (body: unknown) =>
    fetch(`http://127.0.0.1:${port}/api/choices`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const close = async () => {
    await server.shutdown();
    await Deno.remove(work, { recursive: true });
  };
  const of = (name: string) => candidates.entries.find(e => e.name === name)!;
  return { work, put, close, of, base: () => `http://127.0.0.1:${port}` };
}

Deno.test(
  'AC-10: 第2弾で manual の寺社は linkChecked なしで採れ、残った1件の linkChecked が true',
  async () => {
    const t = await setup320();
    try {
      const naiku = t.of('伊勢神宮内宮（皇大神宮）');
      const res = await t.put({
        idx: naiku.idx,
        decision: 'approve',
        file: naiku.files[1].file,
        focusY: 0.45,
      });
      assertEquals(res.status, 200, await res.text());
      const saved = await (await fetch(`${t.base()}/api/choices`)).json();
      assertEquals(saved.choices, [
        {
          idx: naiku.idx,
          decision: 'approve',
          file: naiku.files[1].file,
          focusY: 0.45,
          linkChecked: true,
        },
      ]);
      const data = await (await fetch(`${t.base()}/api/data`)).json();
      assertEquals(data.batch, 2);
    } finally {
      await t.close();
    }
  }
);

Deno.test(
  'AC-10: 第2弾でも medium は確かめないと 400。同じファイルを2つの寺社で採ると、後の方が 400 で先の寺社の名前',
  async () => {
    const t = await setup320();
    try {
      const kamochi = t.of('金持神社');
      const bad = await t.put({
        idx: kamochi.idx,
        decision: 'approve',
        file: kamochi.files[0].file,
        focusY: 0.5,
      });
      assertEquals(bad.status, 400);
      assertStringIncludes((await bad.json()).error, '金持神社');

      const naka = t.of('戸隠神社中社');
      const oku = t.of('戸隠神社奥社');
      const first = await t.put({
        idx: naka.idx,
        decision: 'approve',
        file: naka.files[0].file,
        focusY: 0.5,
      });
      assertEquals(first.status, 200, await first.text());
      const second = await t.put({
        idx: oku.idx,
        decision: 'approve',
        file: oku.files[0].file,
        focusY: 0.5,
      });
      assertEquals(second.status, 400);
      assertStringIncludes((await second.json()).error, '戸隠神社中社');
      // 別のファイルなら採れる
      const other = await t.put({
        idx: oku.idx,
        decision: 'approve',
        file: oku.files[1].file,
        focusY: 0.5,
      });
      assertEquals(other.status, 200, await other.text());
    } finally {
      await t.close();
    }
  }
);
