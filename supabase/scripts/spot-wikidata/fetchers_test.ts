// Deno テスト（取得の決まり: 間隔・取り直し・User-Agent。偽の fetch と偽の時計。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-wikidata/
// 契約書: docs/issues/issue-301-spot-wikidata.md（S2 / AC-12・AC-13）
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { Client, LimitError, StopError, userAgent } from './fetchers.ts';

interface Rec {
  url: string;
  at: number;
  ua: string | null;
  method: string;
}

function harness(respond: (url: string, n: number) => Response | 'timeout') {
  const clock = { t: 1_000_000 };
  const calls: Rec[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      at: clock.t,
      ua: new Headers(init?.headers).get('User-Agent'),
      method: init?.method ?? 'GET',
    });
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await Promise.resolve();
      const r = respond(url, calls.filter(c => c.url === url).length);
      if (r === 'timeout') throw new DOMException('timed out', 'TimeoutError');
      return r;
    } finally {
      inFlight--;
    }
  };
  const client = new Client({
    fetch,
    now: () => clock.t,
    sleep: async ms => {
      clock.t += ms;
    },
    contact: 'https://example.org/contact',
  });
  return { client, calls, clock, maxInFlight: () => maxInFlight };
}

const ok = () => new Response('[]', { status: 200 });

Deno.test(
  'AC-12: Nominatim は 1,100ms・地理院の住所は 1,000ms・タイルは 200ms 以上あける',
  async () => {
    const h = harness(ok);
    for (let i = 0; i < 3; i++)
      await h.client.get('nominatim', `https://nominatim.openstreetmap.org/search?q=${i}`);
    for (let i = 0; i < 3; i++)
      await h.client.get(
        'gsiAddr',
        `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${i}`
      );
    for (let i = 0; i < 3; i++)
      await h.client.get(
        'gsiTile',
        `https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/16/${i}/0.pbf`
      );
    const gaps = (host: string) => {
      const at = h.calls.filter(c => new URL(c.url).host === host).map(c => c.at);
      return at.slice(1).map((t, i) => t - at[i]);
    };
    assert(
      gaps('nominatim.openstreetmap.org').every(g => g >= 1_100),
      `${gaps('nominatim.openstreetmap.org')}`
    );
    assert(gaps('msearch.gsi.go.jp').every(g => g >= 1_000));
    assert(gaps('cyberjapandata.gsi.go.jp').every(g => g >= 200));
    assertEquals(gaps('cyberjapandata.gsi.go.jp').length, 2);
  }
);

Deno.test('AC-12: 429 の Retry-After: 7 のあとは 7 秒待って取り直す', async () => {
  const h = harness((_, n) =>
    n === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '7' } }) : ok()
  );
  const res = await h.client.get(
    'wikimedia',
    'https://www.wikidata.org/w/api.php?action=query&maxlag=5'
  );
  assertEquals(res?.status, 200);
  assertEquals(h.calls.length, 2);
  assert(h.calls[1].at - h.calls[0].at >= 7_000);
});

Deno.test('AC-12: Retry-After が無い 503 は 60 秒、長くても 300 秒待つ', async () => {
  const h = harness((_, n) =>
    n === 1
      ? new Response('', { status: 503 })
      : n === 2
        ? new Response('', { status: 503, headers: { 'Retry-After': '9999' } })
        : ok()
  );
  await h.client.get('wikimedia', 'https://www.wikidata.org/w/api.php?maxlag=5');
  assertEquals(h.calls[1].at - h.calls[0].at, 60_000);
  assertEquals(h.calls[2].at - h.calls[1].at, 300_000);
});

Deno.test('AC-12: 3回続けて 503 なら止める（続きから再開できる）', async () => {
  const h = harness(() => new Response('', { status: 503 }));
  const e = await assertRejects(
    () => h.client.get('wikimedia', 'https://www.wikidata.org/w/api.php?maxlag=5'),
    StopError
  );
  assertEquals(h.calls.length, 3);
  assert(e.message.includes('503'));
});

Deno.test('AC-12: maxlag の応答（200 の error）は待って取り直す', async () => {
  const h = harness((_, n) =>
    n === 1
      ? new Response(JSON.stringify({ error: { code: 'maxlag', info: 'lagged' } }), {
          status: 200,
          headers: { 'Retry-After': '5' },
        })
      : new Response('{"entities":{}}', { status: 200 })
  );
  const res = await h.client.get('wikimedia', 'https://www.wikidata.org/w/api.php?maxlag=5');
  assertEquals(new TextDecoder().decode(res!.bytes), '{"entities":{}}');
  assertEquals(h.calls.length, 2);
  assert(h.calls[1].at - h.calls[0].at >= 5_000);
});

Deno.test('AC-12: 403 など、取り直しても変わらない応答はすぐ止める', async () => {
  const h = harness(() => new Response('', { status: 403 }));
  await assertRejects(
    () => h.client.get('nominatim', 'https://nominatim.openstreetmap.org/search?q=a'),
    StopError
  );
  assertEquals(h.calls.length, 1);
});

Deno.test('AC-12: 404 は返す（キャッシュしてよい応答）', async () => {
  const h = harness(() => new Response('', { status: 404 }));
  const res = await h.client.get(
    'gsiTile',
    'https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/16/1/1.pbf'
  );
  assertEquals(res?.status, 404);
});

Deno.test(
  'AC-14: WDQS は 503・429・時間切れなら、待たずに null を返す（その回は使わない）',
  async () => {
    for (const r of [
      new Response('', { status: 503 }),
      new Response('', { status: 429 }),
      'timeout' as const,
    ]) {
      const h = harness(() => r);
      const res = await h.client.get('wdqs', 'https://query.wikidata.org/sparql', {
        method: 'POST',
        body: 'query=x',
      });
      assertEquals(res, null);
      assertEquals(h.calls.length, 1);
      assertEquals(h.calls[0].method, 'POST');
    }
  }
);

Deno.test('AC-12: 時間切れ（WDQS 以外）は取り直し、3回続けば止める', async () => {
  const h = harness(() => 'timeout');
  await assertRejects(
    () => h.client.get('gsiAddr', 'https://msearch.gsi.go.jp/address-search/AddressSearch?q=a'),
    StopError
  );
  assertEquals(h.calls.length, 3);
});

Deno.test('AC-13: どの呼び出しにも User-Agent に連絡先が入る', async () => {
  const h = harness(ok);
  await h.client.get('wikimedia', 'https://www.wikidata.org/w/api.php?maxlag=5');
  await h.client.get('wdqs', 'https://query.wikidata.org/sparql', {
    method: 'POST',
    body: 'query=x',
  });
  await h.client.get('nominatim', 'https://nominatim.openstreetmap.org/search?q=a');
  await h.client.get('gsiAddr', 'https://msearch.gsi.go.jp/address-search/AddressSearch?q=a');
  await h.client.get(
    'gsiTile',
    'https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/16/1/1.pbf'
  );
  assertEquals(
    userAgent('https://example.org/contact'),
    'goshuin-spot-wikidata/1 (https://example.org/contact)'
  );
  assert(h.calls.every(c => c.ua === 'goshuin-spot-wikidata/1 (https://example.org/contact)'));
  assertEquals(h.calls.length, 5);
});

Deno.test('AC-13: 連絡先が空なら Client を作れない', () => {
  let threw = false;
  try {
    new Client({
      fetch: () => Promise.resolve(ok()),
      now: () => 0,
      sleep: async () => {},
      contact: ' ',
    });
  } catch {
    threw = true;
  }
  assert(threw);
});

Deno.test('--limit: 決めた数だけ呼んだら LimitError', async () => {
  const clock = { t: 0 };
  let n = 0;
  const client = new Client({
    fetch: () => {
      n++;
      return Promise.resolve(ok());
    },
    now: () => clock.t,
    sleep: async ms => {
      clock.t += ms;
    },
    contact: 'https://example.org/contact',
    limit: 2,
  });
  await client.get('gsiTile', 'https://cyberjapandata.gsi.go.jp/a');
  await client.get('gsiTile', 'https://cyberjapandata.gsi.go.jp/b');
  await assertRejects(
    () => client.get('gsiTile', 'https://cyberjapandata.gsi.go.jp/c'),
    LimitError
  );
  assertEquals(n, 2);
});
