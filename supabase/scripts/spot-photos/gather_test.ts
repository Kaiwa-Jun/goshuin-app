// Deno テスト（#320 の手で結ぶ・集める。fetch と時計は偽物。ネットに出ない。ファイルは一時フォルダ）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-320-spot-photos-batch2.md（S1 / AC-4、S2 / AC-5）
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { serializeJson } from '../spot-wikidata/match.ts';
import { MANUAL_PATH, type Spot320 } from './batch2.ts';
import {
  fixtureSpots,
  fixtureWdEntity,
  makeRoot,
  readFixture,
  readRepo,
  snapshot,
} from './fixtures/load.ts';
import { gatherSpots, trimEntity } from './gather.ts';
import { type CliIo, denoIo, runCli } from './main.ts';
import { LEDGER_PATH } from './select.ts';

const CONTACT = 'https://example.com/contact';
const UA = `goshuin-spot-photos/1 (${CONTACT})`;
const DATE = /\d{4}-\d{2}-\d{2}T/;

interface Call {
  url: URL;
  ua: string | null;
  redirect: RequestRedirect;
  start: number;
  end: number;
}

/** 時計は偽物。sleep で進み、1回の呼び出しは 50ms かかる */
export function fakeClock() {
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

type Answer = (url: URL, n: number) => Response | Promise<Response>;

/** 偽の fetch。呼ばれた URL・User-Agent・時刻を記録し、answer の応答を返す */
export function fakeNet(answer: Answer, clock = fakeClock()) {
  const calls: Call[] = [];
  const fetch = async (input: Request | string, init?: RequestInit): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(input, init);
    const start = clock.now();
    clock.tick(50);
    const url = new URL(req.url);
    calls.push({
      url,
      ua: req.headers.get('user-agent'),
      redirect: req.redirect,
      start,
      end: clock.now(),
    });
    return await answer(url, calls.length);
  };
  return { fetch, calls, clock };
}

/** 呼び出しの間が、前の呼び出しの終わりから 1,000ms 以上あいている */
export function assertPaced(calls: Call[]): void {
  for (let i = 1; i < calls.length; i++) {
    assert(
      calls[i].start - calls[i - 1].end >= 1000,
      `${i} 回目の呼び出しの間が ${calls[i].start - calls[i - 1].end}ms`
    );
  }
}

export function ioWith(net: ReturnType<typeof fakeNet>, env: Record<string, string> = {}) {
  let out = '';
  let err = '';
  const io: CliIo = {
    ...denoIo(),
    fetch: net.fetch,
    now: net.clock.now,
    sleep: net.clock.sleep,
    env: name => env[name],
    stdout: t => void (out += t),
    stderr: t => void (err += t),
  };
  return { io, out: () => out, err: () => err };
}

/** 取った日付（本物の応答の references にある）を入れた項目。キャッシュに残らないことを確かめる */
function withDates(entity: Record<string, unknown>): Record<string, unknown> {
  const claims = structuredClone(entity.claims) as Record<string, Record<string, unknown>[]>;
  for (const list of Object.values(claims)) {
    for (const s of list) {
      s.references = [
        { snaks: { P813: [{ datavalue: { value: { time: '+2026-10-04T00:00:00Z' } } }] } },
      ];
      s.id = `${entity.id}$abc`;
    }
  }
  return { ...entity, claims, lastrevid: 1, modified: '2026-10-04T01:02:03Z' };
}

/** 偽の Wikidata（wbgetentities）。fixtures/wd/ の項目と、名前だけの偽の項目（Q9000…）を返す */
async function fakeWikidata(opts: { failAt?: number; status?: number } = {}) {
  const known: Record<string, Record<string, unknown>> = {
    Q11581011: await fixtureWdEntity('Q11581011'),
    Q135464157: await fixtureWdEntity('Q135464157'),
  };
  return fakeNet((url, n) => {
    if (opts.failAt === n) return new Response('slow down', { status: opts.status ?? 429 });
    if (url.host !== 'www.wikidata.org' || url.pathname !== '/w/api.php') {
      return new Response('unexpected', { status: 500 });
    }
    const entities: Record<string, unknown> = {};
    for (const id of (url.searchParams.get('ids') ?? '').split('|')) {
      if (known[id]) entities[id] = withDates(known[id]);
      else if (id.startsWith('Q9000')) {
        entities[id] = { type: 'item', id, labels: {}, aliases: {}, claims: {} };
      } else entities[id] = { id, missing: '' };
    }
    return Response.json({ entities, success: 1 });
  });
}

const DRAFT = {
  links: [
    { idx: 347, qid: 'Q135464157' },
    { idx: 348, qid: 'Q135464157' },
    { idx: 421, qid: 'Q11581011' },
  ],
};

async function writeDraft(work: string, draft: unknown): Promise<void> {
  await Deno.mkdir(`${work}/b2`, { recursive: true });
  await Deno.writeTextFile(`${work}/b2/manual-draft.json`, JSON.stringify(draft));
}

async function setup(draft: unknown = DRAFT) {
  const root = await makeRoot({ ledger: true });
  const work = await Deno.makeTempDir({ prefix: 'spot-photos-work-' });
  await writeDraft(work, draft);
  const close = async () => {
    await Deno.remove(root, { recursive: true });
    await Deno.remove(work, { recursive: true });
  };
  return { root, work, close };
}

// --- AC-4: manual-link ---

Deno.test(
  'trimEntity は parseEntity が読む値だけを残す（fixtures/wd/ はもう trim してある）',
  async () => {
    for (const qid of ['Q11581011', 'Q135464157']) {
      const e = await fixtureWdEntity(qid);
      assertEquals(trimEntity(e), e);
      assertEquals(trimEntity(withDates(e)), e);
    }
  }
);

Deno.test(
  'AC-4: manual-link は下書きの Q-ID を wbgetentities で聞き、台帳と wd-entity だけを書く。2回目は呼ばない',
  async () => {
    const t = await setup();
    try {
      const net = await fakeWikidata();
      const before = await snapshot(t.root);
      const c = ioWith(net, { SPOT_WIKIDATA_CONTACT: CONTACT });
      const code = await runCli(['manual-link', '--root', t.root, '--work', t.work], c.io);
      assertEquals(code, 0, c.err());
      assertEquals(net.calls.length, 1);
      const call = net.calls[0];
      assertEquals(`${call.url.origin}${call.url.pathname}`, 'https://www.wikidata.org/w/api.php');
      const q = call.url.searchParams;
      assertEquals(q.get('action'), 'wbgetentities');
      assertEquals(q.get('props'), 'labels|aliases|claims');
      assertEquals(q.get('languages'), 'ja');
      assertEquals(q.get('maxlag'), '5');
      assertEquals(q.get('ids')!.split('|').sort(), ['Q11581011', 'Q135464157']);
      assertEquals(call.ua, UA);
      assertEquals(call.redirect, 'manual');

      // --root には台帳だけが増える
      const after = await snapshot(t.root);
      assertEquals(
        Object.keys(after).filter(k => !(k in before)),
        [MANUAL_PATH]
      );
      for (const k of Object.keys(before)) assertEquals(after[k], before[k], k);
      const text = after[MANUAL_PATH];
      // フィクスチャはコミットのときに prettier が整形するので、JSON として比べる
      assertEquals(JSON.parse(text), JSON.parse(await readFixture('manual-320.json')));
      // --work には下書きと項目だけ
      const work = await snapshot(t.work);
      assertEquals(Object.keys(work).sort(), [
        'b2/manual-draft.json',
        'b2/wd-entity/Q11581011.json',
        'b2/wd-entity/Q135464157.json',
      ]);
      for (const k of ['b2/wd-entity/Q11581011.json', 'b2/wd-entity/Q135464157.json']) {
        assertEquals(work[k].includes(CONTACT), false, k);
        assertEquals(work[k].match(DATE), null, k);
      }
      assertEquals(text.includes(CONTACT), false);
      assertEquals(text.match(DATE), null);

      // 2回目は呼び出し 0 回で同じ中身
      const net2 = await fakeWikidata();
      const c2 = ioWith(net2, { SPOT_WIKIDATA_CONTACT: CONTACT });
      assertEquals(
        await runCli(['manual-link', '--root', t.root, '--work', t.work], c2.io),
        0,
        c2.err()
      );
      assertEquals(net2.calls.length, 0);
      assertEquals(await Deno.readTextFile(`${t.root}/${MANUAL_PATH}`), text);
    } finally {
      await t.close();
    }
  }
);

Deno.test('AC-4: SPOT_WIKIDATA_CONTACT が無いと、1回も呼ばずに 1', async () => {
  const t = await setup();
  try {
    const net = await fakeWikidata();
    const c = ioWith(net);
    assertEquals(await runCli(['manual-link', '--root', t.root, '--work', t.work], c.io), 1);
    assertEquals(net.calls.length, 0);
    assertStringIncludes(c.err(), 'SPOT_WIKIDATA_CONTACT');
  } finally {
    await t.close();
  }
});

Deno.test(
  'AC-4: 下書きに規則を通らない行があると、台帳を書かず（前の台帳も変えず）、寺社の名前と理由を出して 1',
  async () => {
    const t = await setup({
      links: [
        ...DRAFT.links,
        { idx: 890, qid: 'Q11581011' },
        { idx: 421, qid: 'Q11581011' },
        { idx: 9, qid: 'Q9000001' },
        { idx: 10, qid: 'Q1' },
      ],
    });
    try {
      const old = serializeJson({ old: true });
      await Deno.writeTextFile(`${t.root}/${MANUAL_PATH}`, old);
      const net = await fakeWikidata();
      const c = ioWith(net, { SPOT_WIKIDATA_CONTACT: CONTACT });
      assertEquals(await runCli(['manual-link', '--root', t.root, '--work', t.work], c.io), 1);
      assertStringIncludes(
        c.err(),
        '増上寺（東京都）: Q11581011: 対応表で結べている（high / medium）'
      );
      assertStringIncludes(c.err(), '伊勢神宮内宮（皇大神宮）（三重県）: Q11581011: idx が2行ある');
      assertStringIncludes(c.err(), '星置神社（北海道）: Q9000001: P625 が無い');
      assertStringIncludes(c.err(), '多賀神社（北海道）: Q1: Wikidata に項目が無い');
      assertEquals(c.err().includes('戸隠神社中社'), false);
      assertEquals(await Deno.readTextFile(`${t.root}/${MANUAL_PATH}`), old);
    } finally {
      await t.close();
    }
  }
);

Deno.test(
  'AC-4: 1回 50 件までで呼び、間は 1,000ms。HTTP 429 で止まると 1 で、取れた項目はキャッシュに残る',
  async () => {
    const links = Array.from({ length: 51 }, (_, i) => ({
      idx: i + 1,
      qid: `Q9000${String(i).padStart(3, '0')}`,
    }));
    const t = await setup({ links });
    try {
      const net = await fakeWikidata({ failAt: 2 });
      const c = ioWith(net, { SPOT_WIKIDATA_CONTACT: CONTACT });
      assertEquals(await runCli(['manual-link', '--root', t.root, '--work', t.work], c.io), 1);
      assertEquals(net.calls.length, 2);
      assertEquals(net.calls[0].url.searchParams.get('ids')!.split('|').length, 50);
      assertEquals(net.calls[1].url.searchParams.get('ids')!.split('|').length, 1);
      assertPaced(net.calls);
      assert(net.calls.every(x => x.ua === UA));
      assertStringIncludes(c.err(), '429');
      const work = await snapshot(t.work);
      assertEquals(Object.keys(work).filter(k => k.startsWith('b2/wd-entity/')).length, 50);
      assertEquals(MANUAL_PATH in (await snapshot(t.root)), false);

      // 打ち直すと、残りの 1 件だけを聞く（規則は通らないので 1）
      const net2 = await fakeWikidata();
      const c2 = ioWith(net2, { SPOT_WIKIDATA_CONTACT: CONTACT });
      assertEquals(await runCli(['manual-link', '--root', t.root, '--work', t.work], c2.io), 1);
      assertEquals(net2.calls.length, 1);
      assertEquals(net2.calls[0].url.searchParams.get('ids'), 'Q9000050');
    } finally {
      await t.close();
    }
  }
);

Deno.test('AC-4: 応答の error（maxlag）と 5xx でも止まり 1', async () => {
  for (const status of [503, 200]) {
    const t = await setup();
    try {
      const net = fakeNet(() =>
        status === 200
          ? Response.json({ error: { code: 'maxlag', info: 'Waiting for a database server' } })
          : new Response('busy', { status })
      );
      const c = ioWith(net, { SPOT_WIKIDATA_CONTACT: CONTACT });
      assertEquals(await runCli(['manual-link', '--root', t.root, '--work', t.work], c.io), 1);
      assertEquals(net.calls.length, 1);
      assertStringIncludes(c.err(), status === 200 ? 'maxlag' : '503');
      assertEquals(MANUAL_PATH in (await snapshot(t.root)), false);
    } finally {
      await t.close();
    }
  }
});

// --- AC-5: gather（Commons の一覧と imageinfo） ---

interface ListFixture {
  files: string[];
  continue?: boolean;
}

/** 偽の Commons（categorymembers・search・imageinfo）。応答は fixtures/commons-b2/ */
async function fakeCommons(
  opts: {
    failAt?: number;
    status?: number;
    maxlagAt?: number;
    categories?: Record<string, ListFixture>;
  } = {}
) {
  const pages = JSON.parse(await readFixture('commons-b2/pages.json'));
  const lists = JSON.parse(await readFixture('commons-b2/lists.json')) as {
    categorymembers: Record<string, ListFixture>;
    search: Record<string, ListFixture>;
  };
  const categories = { ...lists.categorymembers, ...opts.categories };
  const titles = (l: ListFixture) => l.files.map(f => ({ ns: 6, title: `File:${f}` }));
  return fakeNet((url, n) => {
    if (opts.failAt === n) return new Response('busy', { status: opts.status ?? 429 });
    if (opts.maxlagAt === n) {
      return Response.json({ error: { code: 'maxlag', info: 'Waiting for a database server' } });
    }
    if (`${url.origin}${url.pathname}` !== 'https://commons.wikimedia.org/w/api.php') {
      return new Response('unexpected', { status: 500 });
    }
    const q = url.searchParams;
    if (q.get('list') === 'categorymembers') {
      const l = categories[q.get('cmtitle')!.replace(/^Category:/, '')] ?? { files: [] };
      return Response.json({
        batchcomplete: !l.continue,
        ...(l.continue ? { continue: { cmcontinue: 'file|5A4F4A4F|1', continue: '-||' } } : {}),
        query: { categorymembers: titles(l) },
      });
    }
    if (q.get('list') === 'search') {
      const qid = /^haswbstatement:P180=(Q\d+)$/.exec(q.get('srsearch') ?? '')?.[1] ?? '';
      const l = lists.search[qid] ?? { files: [] };
      return Response.json({
        batchcomplete: !l.continue,
        ...(l.continue ? { continue: { sroffset: 500, continue: '-||' } } : {}),
        query: { searchinfo: { totalhits: l.files.length }, search: titles(l) },
      });
    }
    if (q.get('prop') === 'imageinfo') {
      const asked = (q.get('titles') ?? '').split('|');
      return Response.json({
        batchcomplete: true,
        query: {
          pages: asked.map(
            t => pages[t.replace(/^File:/, '')] ?? { ns: 6, title: t, missing: true }
          ),
        },
      });
    }
    return new Response('unexpected', { status: 500 });
  });
}

const kindOf = (c: Call) =>
  c.url.searchParams.get('list') ??
  (c.url.searchParams.get('prop') === 'imageinfo' ? 'imageinfo' : '?');

async function tempWork(): Promise<string> {
  return await Deno.makeTempDir({ prefix: 'spot-photos-work-' });
}

Deno.test(
  'AC-5: gather は寺社ごとに categorymembers と search を1回ずつ呼び、名前を重ねずに imageinfo で聞く',
  async () => {
    const spots = await fixtureSpots();
    const work = await tempWork();
    try {
      const net = await fakeCommons();
      const c = ioWith(net);
      const r = await gatherSpots(spots, { io: c.io, work, contact: CONTACT });
      assertEquals(r, { gathered: 6, cached: 0, calls: 18, stopped: null });
      assertEquals(net.calls.length, 18);
      assert(net.calls.every(x => x.ua === UA && x.redirect === 'manual'));
      assertPaced(net.calls);
      // continue を追わない
      for (const x of net.calls) {
        for (const k of ['cmcontinue', 'sroffset', 'continue']) {
          assertEquals(x.url.searchParams.has(k), false, `${x.url}`);
        }
      }
      // 寺社ごとに: カテゴリ（P373 があれば）→ P180 → imageinfo
      const params = (x: Call) => Object.fromEntries(x.url.searchParams);
      const cats = net.calls.filter(x => kindOf(x) === 'categorymembers').map(params);
      assertEquals(
        cats.map(p => p.cmtitle),
        [
          'Category:Chusonji',
          'Category:Togakushi Shrine',
          'Category:Togakushi Shrine',
          'Category:Naiku',
          'Category:Kamochi-jinja',
          'Category:Zōjō-ji',
        ]
      );
      assertEquals(cats[0], {
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:Chusonji',
        cmtype: 'file',
        cmlimit: '500',
        cmprop: 'title',
        format: 'json',
        formatversion: '2',
        maxlag: '5',
      });
      const searches = net.calls.filter(x => kindOf(x) === 'search').map(params);
      assertEquals(
        searches.map(p => p.srsearch),
        [
          'haswbstatement:P180=Q2660144',
          'haswbstatement:P180=Q135464157',
          'haswbstatement:P180=Q135464157',
          'haswbstatement:P180=Q11581011',
          'haswbstatement:P180=Q246463',
          'haswbstatement:P180=Q249139',
        ]
      );
      assertEquals(searches[0], {
        action: 'query',
        list: 'search',
        srsearch: 'haswbstatement:P180=Q2660144',
        srnamespace: '6',
        srlimit: '500',
        srprop: '',
        format: 'json',
        formatversion: '2',
        maxlag: '5',
      });
      const infos = net.calls.filter(x => kindOf(x) === 'imageinfo');
      assertEquals(infos[0].url.searchParams.get('iiprop'), 'url|size|mime|sha1|extmetadata');
      assertEquals(infos[0].url.searchParams.get('maxlag'), '5');
      // 中尊寺: カテゴリ 6 と P180 2（1つは重なる）→ 7。手で結んだ皇大神宮は P18 も（カテゴリと重なる）
      const titlesOf = (x: Call) => x.url.searchParams.get('titles')!.split('|');
      assertEquals(titlesOf(infos[0]).length, 7);
      assertEquals(new Set(titlesOf(infos[0])).size, 7);
      assertEquals(titlesOf(infos[3]), [
        'File:Tsurugaoka Hachimangu 001.jpg',
        'File:Masumida Shrine Haiden.jpg',
        'File:Oarai Isosaki Shrine 04.jpg',
        'File:Gone file.jpg',
      ]);

      // 集めた値は commons-b2/gather/ と同じ。Q-ID の無い寺社（星置神社）は書かない
      const written = await snapshot(work);
      assertEquals(Object.keys(written).sort(), [
        'gather/347.json',
        'gather/348.json',
        'gather/41.json',
        'gather/421.json',
        'gather/544.json',
        'gather/890.json',
      ]);
      for (const [path, text] of Object.entries(written)) {
        assertEquals(JSON.parse(text), JSON.parse(await readFixture(`commons-b2/${path}`)), path);
        assertEquals(text.includes(CONTACT), false, path);
        assertEquals(text.match(DATE), null, path);
      }

      // 2回目は呼び出し 0 回
      const net2 = await fakeCommons();
      const r2 = await gatherSpots(spots, { io: ioWith(net2).io, work, contact: CONTACT });
      assertEquals(r2, { gathered: 0, cached: 6, calls: 0, stopped: null });
      assertEquals(net2.calls.length, 0);
    } finally {
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'AC-5: P373 の無い寺社は categorymembers を呼ばず、Q-ID の無い寺社は1回も呼ばない',
  async () => {
    const spots = await fixtureSpots();
    const zojoji: Spot320 = { ...spots.find(s => s.name === '増上寺')!, p373: null };
    const hoshioki = spots.find(s => s.name === '星置神社')!;
    assertEquals(hoshioki.qid, null);
    const work = await tempWork();
    try {
      const net = await fakeCommons();
      const r = await gatherSpots([hoshioki, zojoji], {
        io: ioWith(net).io,
        work,
        contact: CONTACT,
      });
      assertEquals(r, { gathered: 1, cached: 0, calls: 1, stopped: null });
      assertEquals(net.calls.map(kindOf), ['search']);
      const g = JSON.parse(await Deno.readTextFile(`${work}/gather/890.json`));
      assertEquals([g.p373, g.lists, g.files, g.truncated], [null, { p373: [], p180: [] }, [], []]);
    } finally {
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test('AC-5: imageinfo は 1 回 50 件まで', async () => {
  const spots = await fixtureSpots();
  const chuson: Spot320 = { ...spots.find(s => s.name === '中尊寺')!, p373: 'Many files' };
  const many = Array.from({ length: 60 }, (_, i) => `Many ${i}.jpg`);
  const work = await tempWork();
  try {
    const net = await fakeCommons({ categories: { 'Many files': { files: many } } });
    const r = await gatherSpots([chuson], { io: ioWith(net).io, work, contact: CONTACT });
    assertEquals(r.calls, 4);
    const infos = net.calls.filter(x => kindOf(x) === 'imageinfo');
    assertEquals(
      infos.map(x => x.url.searchParams.get('titles')!.split('|').length),
      [50, 12]
    );
    assertPaced(net.calls);
    const g = JSON.parse(await Deno.readTextFile(`${work}/gather/41.json`));
    assertEquals(g.missing.length, 60);
    assertEquals(
      g.files.map((f: { file: string }) => f.file),
      ['Chuson-ji Noh Stage 03.jpg', 'Miyajima, daisho-in, 05.jpg']
    );
  } finally {
    await Deno.remove(work, { recursive: true });
  }
});

for (const [why, opts, word] of [
  ['HTTP 429', { failAt: 5, status: 429 }, '429'],
  ['HTTP 503', { failAt: 5, status: 503 }, '503'],
  ['本文の error.code: maxlag', { maxlagAt: 5 }, 'maxlag'],
] as const) {
  Deno.test(
    `AC-5: ${why} で止まると、それまでに終わった寺社は残り、打ち直すと残りの寺社だけを呼ぶ`,
    async () => {
      const spots = await fixtureSpots();
      const work = await tempWork();
      try {
        const net = await fakeCommons(opts);
        const r = await gatherSpots(spots, { io: ioWith(net).io, work, contact: CONTACT });
        assertEquals(net.calls.length, 5);
        assert(r.stopped !== null);
        assertStringIncludes(r.stopped, word);
        assertEquals([r.gathered, r.cached], [1, 0]);
        assertEquals(Object.keys(await snapshot(work)), ['gather/41.json']);

        const net2 = await fakeCommons();
        const r2 = await gatherSpots(spots, { io: ioWith(net2).io, work, contact: CONTACT });
        assertEquals(r2, { gathered: 5, cached: 1, calls: 15, stopped: null });
        assertEquals(net2.calls[0].url.searchParams.get('cmtitle'), 'Category:Togakushi Shrine');
      } finally {
        await Deno.remove(work, { recursive: true });
      }
    }
  );
}

/** 本物の台帳の第1弾の行だけ（第2弾の対象は 150）と、本物の #301・手で結ぶ台帳のフィクスチャを持つ root */
async function realBatch1Root(): Promise<string> {
  const ledger = JSON.parse(await readRepo(LEDGER_PATH));
  ledger.entries = ledger.entries.filter((e: { batch: number }) => e.batch === 1);
  return await makeRoot({ photos: 'real', ledgerText: serializeJson(ledger), manual: true });
}

Deno.test(
  'AC-5: CLI の gather は対象の Q-ID のある寺社を集め、終わりに数を出す。2回目は 0 回。連絡先が無いと 0 回で 1',
  async () => {
    const root = await realBatch1Root();
    const work = await tempWork();
    try {
      const none = await fakeCommons();
      const n = ioWith(none);
      assertEquals(await runCli(['gather', '--root', root, '--work', work], n.io), 1);
      assertEquals(none.calls.length, 0);
      assertStringIncludes(n.err(), 'SPOT_WIKIDATA_CONTACT');

      const net = await fakeCommons();
      const c = ioWith(net, { SPOT_WIKIDATA_CONTACT: CONTACT });
      assertEquals(await runCli(['gather', '--root', root, '--work', work], c.io), 0, c.err());
      // 対象 150 のうち Q-ID があるのは high 92・medium 8・手で結んだ 3
      const written = Object.keys(await snapshot(work));
      assertEquals(written.length, 103);
      assert(written.every(k => /^b2\/gather\/\d+\.json$/.test(k)));
      assert(net.calls.every(x => x.ua === UA));
      assertPaced(net.calls);
      assertStringIncludes(
        c.out(),
        `集めた 103 寺社 / キャッシュにあった 0 寺社 / 呼び出し ${net.calls.length} 回（`
      );

      const net2 = await fakeCommons();
      const c2 = ioWith(net2, { SPOT_WIKIDATA_CONTACT: CONTACT });
      assertEquals(await runCli(['gather', '--root', root, '--work', work], c2.io), 0, c2.err());
      assertEquals(net2.calls.length, 0);
      assertStringIncludes(c2.out(), '集めた 0 寺社 / キャッシュにあった 103 寺社 / 呼び出し 0 回');

      // 429 で止まると 1
      await Deno.remove(`${work}/b2/gather/41.json`);
      const net3 = await fakeCommons({ failAt: 1 });
      const c3 = ioWith(net3, { SPOT_WIKIDATA_CONTACT: CONTACT });
      assertEquals(await runCli(['gather', '--root', root, '--work', work], c3.io), 1);
      assertStringIncludes(c3.err(), '429');
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);
