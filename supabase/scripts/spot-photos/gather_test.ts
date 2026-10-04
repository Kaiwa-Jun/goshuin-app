// Deno テスト（#320 の手で結ぶ・集める。fetch と時計は偽物。ネットに出ない。ファイルは一時フォルダ）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-320-spot-photos-batch2.md（S1 / AC-4）
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { serializeJson } from '../spot-wikidata/match.ts';
import { MANUAL_PATH } from './batch2.ts';
import { fixtureWdEntity, makeRoot, readFixture, snapshot } from './fixtures/load.ts';
import { trimEntity } from './gather.ts';
import { type CliIo, denoIo, runCli } from './main.ts';

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
