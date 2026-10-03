// Deno テスト（CLI の runCli。一時フォルダの --root と --work、偽の fetch と偽の時計。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-wikidata/
// 契約書: docs/issues/issue-301-spot-wikidata.md（S2 / AC-11〜AC-17）
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { type FakeWorld, FakeNet, SPOTS, standardWorld, writeRoot } from './fake_world.ts';
import { MAPPING_PATH, parseMapping, parsePhotos, PHOTOS_PATH } from './match.ts';
import { type CliIo, denoIo, runCli } from './main.ts';

const CONTACT = 'https://example.org/contact';
const UA = `goshuin-spot-wikidata/1 (${CONTACT})`;

async function setup(world: FakeWorld = standardWorld(), contact: string | null = CONTACT) {
  const dir = await Deno.makeTempDir({ prefix: 'spot-wikidata-test-' });
  const root = `${dir}/root`;
  const work = `${dir}/goshuin-work/spot-wikidata`;
  await writeRoot(root, world);
  const clock = { t: 1_700_000_000_000 };
  const net = new FakeNet(world, clock);
  const out = { stdout: '', stderr: '' };
  const io: CliIo = {
    ...denoIo(),
    fetch: net.fetch,
    now: () => clock.t,
    sleep: async ms => {
      clock.t += ms;
    },
    env: name => (name === 'SPOT_WIKIDATA_CONTACT' ? (contact ?? undefined) : undefined),
    stdout: s => {
      out.stdout += s;
    },
    stderr: s => {
      out.stderr += s;
    },
  };
  const run = (...args: string[]) => runCli([...args, '--root', root, '--work', work], io);
  const reset = () => {
    net.calls = [];
    out.stdout = '';
    out.stderr = '';
  };
  return {
    dir,
    root,
    work,
    net,
    clock,
    out,
    run,
    reset,
    [Symbol.asyncDispose]: () => Deno.remove(dir, { recursive: true }),
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const walk = async (d: string) => {
    for await (const e of Deno.readDir(d)) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory) await walk(p);
      else out.set(p, await Deno.readTextFile(p));
    }
  };
  await walk(dir);
  return out;
}

const searchUrl = (name: string) =>
  `srsearch=${encodeURIComponent(`${name} haswbstatement:P17=Q17`).replaceAll('%20', '+')}`;

// --- AC-11: キャッシュと再開 ---

Deno.test('AC-11: fetch wikidata を2回走らせると、2回目の fetch の呼び出しは 0 回', async () => {
  await using s = await setup(standardWorld(['keepWd', 'suggest', 'investigate']));
  assertEquals(await s.run('fetch', 'wikidata'), 0, s.out.stderr);
  assert(s.net.calls.length > 0);
  assert(await exists(`${s.work}/cache/wd-entity/Q101.json`));
  s.reset();
  assertEquals(await s.run('fetch', 'wikidata'), 0, s.out.stderr);
  assertEquals(s.net.calls.length, 0);
});

Deno.test('AC-11: 503 の応答はキャッシュされず、次の回で取り直す', async () => {
  await using s = await setup(standardWorld(['keepWd', 'suggest', 'investigate']));
  s.net.override = url =>
    url.includes(searchUrl('離れた寺')) ? new Response('', { status: 503 }) : undefined;
  assertEquals(await s.run('fetch', 'wikidata'), 1);
  assertStringIncludes(s.out.stderr, '続きから再開できます');
  const files = [...(await listFiles(`${s.work}/cache`)).keys()];
  assert(
    files.some(f => f.includes('/wd-search/')),
    'それまでの分は残す'
  );
  assert(
    [...(await listFiles(`${s.work}/cache/wd-search`)).values()].every(
      t => JSON.parse(t).status !== 503
    ),
    '503 はキャッシュしない'
  );
  s.reset();
  s.net.override = null;
  assertEquals(await s.run('fetch', 'wikidata'), 0, s.out.stderr);
  assertEquals(s.net.calls.filter(c => c.url.includes(searchUrl('離れた寺'))).length, 1);
  assertEquals(s.net.calls.filter(c => c.url.includes(searchUrl('近い寺'))).length, 0);
});

Deno.test(
  'AC-11: --limit で止めても、打ち直せば続きから取って、同じものを2度取らない',
  async () => {
    await using s = await setup();
    assertEquals(await s.run('fetch', 'all', '--limit', '4'), 0, s.out.stderr);
    assertEquals(s.net.calls.length, 4);
    assertStringIncludes(s.out.stderr, '続きから再開できます');
    const first = s.net.calls.map(c => `${c.method} ${c.url} ${c.body ?? ''}`);
    s.reset();
    assertEquals(await s.run('fetch', 'all'), 0, s.out.stderr);
    const second = s.net.calls.map(c => `${c.method} ${c.url} ${c.body ?? ''}`);
    assertEquals(
      second.filter(c => first.includes(c)),
      []
    );
    s.reset();
    assertEquals(await s.run('status'), 0);
    assertStringIncludes(s.out.stdout, '残り 0');
    assert(!/残り [1-9]/.test(s.out.stdout), s.out.stdout);
  }
);

// --- AC-12: 待ちと取り直し（CLI で） ---

Deno.test(
  'AC-12: fetch all の間隔（Nominatim 1,100ms・住所 1,000ms・タイル 200ms）と、Wikimedia は1つずつ・maxlag=5',
  async () => {
    await using s = await setup();
    assertEquals(await s.run('fetch', 'all'), 0, s.out.stderr);
    const gaps = (host: string) => {
      const at = s.net.callsTo(host).map(c => c.at);
      return at.slice(1).map((t, i) => t - at[i]);
    };
    assert(gaps('nominatim.openstreetmap.org').length >= 1);
    assert(gaps('nominatim.openstreetmap.org').every(g => g >= 1_100));
    assert(gaps('msearch.gsi.go.jp').length >= 4);
    assert(gaps('msearch.gsi.go.jp').every(g => g >= 1_000));
    assert(gaps('cyberjapandata.gsi.go.jp').length >= 9);
    assert(gaps('cyberjapandata.gsi.go.jp').every(g => g >= 200));
    assert(gaps('query.wikidata.org').every(g => g >= 1_000));
    assertEquals(s.net.maxInFlight, 1);
    const wikimedia = [
      ...s.net.callsTo('www.wikidata.org'),
      ...s.net.callsTo('commons.wikimedia.org'),
    ];
    assert(wikimedia.length >= 5);
    assert(wikimedia.every(c => new URL(c.url).searchParams.get('maxlag') === '5'));
  }
);

Deno.test('AC-12: 429 Retry-After: 7 のあとは 7 秒待って取り直す（CLI）', async () => {
  await using s = await setup(standardWorld(['keepWd']));
  let first = true;
  s.net.override = url => {
    if (url.includes('list=search') && first) {
      first = false;
      return new Response('', { status: 429, headers: { 'Retry-After': '7' } });
    }
    return undefined;
  };
  assertEquals(await s.run('fetch', 'wikidata'), 0, s.out.stderr);
  const search = s.net.calls.filter(c => c.url.includes('list=search'));
  assertEquals(search.length, 2);
  assert(search[1].at - search[0].at >= 7_000);
});

Deno.test(
  'AC-12: 3回続けて 503 なら終了コード 1 で、標準エラーに 続きから再開できます',
  async () => {
    await using s = await setup(standardWorld(['keepWd']));
    s.net.override = url =>
      url.includes('list=search') ? new Response('', { status: 503 }) : undefined;
    assertEquals(await s.run('fetch', 'all'), 1);
    assertStringIncludes(s.out.stderr, '続きから再開できます');
    assertEquals(s.net.calls.filter(c => c.url.includes('list=search')).length, 3);
  }
);

// --- AC-13: User-Agent ---

Deno.test('AC-13: どの呼び出しも User-Agent が goshuin-spot-wikidata/1 (<連絡先>)', async () => {
  await using s = await setup();
  assertEquals(await s.run('fetch', 'all'), 0, s.out.stderr);
  const hosts = new Set(s.net.calls.map(c => new URL(c.url).host));
  assertEquals(hosts.size, 6, [...hosts].join(','));
  assert(s.net.calls.every(c => c.userAgent === UA));
});

Deno.test('AC-13: SPOT_WIKIDATA_CONTACT が無いと、fetch を1回も呼ばずに終了コード 1', async () => {
  await using s = await setup(standardWorld(), null);
  assertEquals(await s.run('fetch', 'all'), 1);
  assertEquals(s.net.calls.length, 0);
  assertStringIncludes(s.out.stderr, 'SPOT_WIKIDATA_CONTACT');
});

// --- AC-14: WDQS が使えないとき ---

async function buildOnce(world: FakeWorld, override: FakeNet['override']) {
  await using s = await setup(world);
  s.net.override = override;
  assertEquals(await s.run('fetch', 'all'), 0, s.out.stderr);
  assertEquals(await s.run('build'), 0, s.out.stderr);
  return {
    mapping: await Deno.readTextFile(`${s.root}/${MAPPING_PATH}`),
    photos: await Deno.readTextFile(`${s.root}/${PHOTOS_PATH}`),
    calls: s.net.calls,
  };
}

Deno.test(
  'AC-14: WDQS が 503 か時間切れでも fetch wikidata は検索で続け、build は WDQS を使わないときと同じ',
  async () => {
    const world = standardWorld();
    world.wdqs = { 近い寺: ['Q101'], 離れた寺: ['Q103'] };
    const wdqs503 = await buildOnce(world, url =>
      url.startsWith('https://query.wikidata.org/') ? new Response('', { status: 503 }) : undefined
    );
    const wdqsTimeout = await buildOnce(world, url =>
      url.startsWith('https://query.wikidata.org/') ? 'timeout' : undefined
    );
    const wdqsOk = await buildOnce(world, null);
    assertEquals(wdqs503.mapping, wdqsOk.mapping);
    assertEquals(wdqsTimeout.mapping, wdqsOk.mapping);
    assertEquals(wdqs503.photos, wdqsOk.photos);
    assert(wdqs503.calls.some(c => c.url.includes('list=search')));
    assertEquals(
      wdqs503.calls.filter(c => c.url.startsWith('https://query.wikidata.org/')).length,
      1
    );
    const ok = wdqsOk.calls.filter(c => c.url.startsWith('https://query.wikidata.org/'));
    assertEquals(ok.length, 1);
    assertEquals(ok[0].method, 'POST');
    assertStringIncludes(decodeURIComponent(ok[0].body!.replaceAll('+', ' ')), '"近い寺"@ja');
  }
);

Deno.test('AC-14: 台帳の第1弾 wikidata の寺社には検索を呼ばない（WDQS にも入れない）', async () => {
  await using s = await setup();
  assertEquals(await s.run('fetch', 'wikidata'), 0, s.out.stderr);
  assertEquals(s.net.calls.filter(c => c.url.includes(searchUrl('台帳の寺'))).length, 0);
  assert(s.net.calls.filter(c => c.url.includes('list=search')).length >= 5);
  assert(
    s.net.calls
      .filter(c => c.url.startsWith('https://query.wikidata.org/'))
      .every(c => !decodeURIComponent((c.body ?? '').replaceAll('+', ' ')).includes('台帳の寺'))
  );
  // 台帳の Q-ID の項目は取る
  assert(await exists(`${s.work}/cache/wd-entity/Q9001.json`));
});

// --- AC-15: OSM は絞って聞く ---

Deno.test(
  'AC-15: keep 2・suggest 1・owner 1・investigate 1 の5寺社で、Nominatim は owner と investigate の2回',
  async () => {
    await using s = await setup();
    assertEquals(await s.run('fetch', 'all'), 0, s.out.stderr);
    const nominatim = s.net.callsTo('nominatim.openstreetmap.org');
    assertEquals(nominatim.length, 2);
    assertEquals(
      nominatim.map(c => new URL(c.url).searchParams.get('q')).sort(),
      [`${SPOTS.owner.name} 静岡県`, `${SPOTS.investigate.name} 静岡県`].sort()
    );
    for (const c of nominatim) {
      const p = new URL(c.url).searchParams;
      assertEquals(
        [p.get('format'), p.get('countrycodes'), p.get('limit'), p.get('namedetails')],
        ['jsonv2', 'jp', '5', '1']
      );
    }
  }
);

// --- AC-16: build ---

Deno.test(
  'AC-16: build はキャッシュから2つのファイルを作り、2回目は変わるものは無い・--check は同じなら 0',
  async () => {
    await using s = await setup();
    assertEquals(await s.run('fetch', 'all'), 0, s.out.stderr);
    s.reset();
    assertEquals(await s.run('build'), 0, s.out.stderr);
    assertEquals(s.net.calls.length, 0, 'build はネットに出ない');
    const mappingText = await Deno.readTextFile(`${s.root}/${MAPPING_PATH}`);
    const photosText = await Deno.readTextFile(`${s.root}/${PHOTOS_PATH}`);
    const mapping = parseMapping(mappingText);
    const photos = parsePhotos(photosText, mapping);
    assertEquals(mapping.entries.length, 7);
    const by = (name: string) => mapping.entries.find(e => e.name === name)!;
    assertEquals(
      [by('台帳の寺').qid, by('台帳の寺').method, by('台帳の寺').confidence],
      ['Q9001', 'ledger', 'high']
    );
    assertEquals(
      [by('近い寺').qid, by('近い寺').confidence, by('近い寺').method],
      ['Q101', 'high', 'rule']
    );
    assertStringIncludes(by('近い寺').basis, '地理院の住所（番地）から');
    assertEquals([by('離れた寺').qid, by('離れた寺').confidence], ['Q103', 'high']);
    assertStringIncludes(by('離れた寺').basis, '地理院の注記・記号から');
    assertEquals([by('地図の社').qid, by('地図の社').confidence], [null, 'none']);
    assertEquals(by('近い寺').p18, ['Near temple haiden.jpg']);
    assertEquals(
      photos.entries.map(e => [e.name, e.qid, e.linkConfidence, e.files.map(f => f.file)]),
      [['近い寺', 'Q101', 'high', ['Near temple haiden.jpg']]]
    );
    assertEquals(
      photos.entries[0].files[0].url,
      'https://upload.wikimedia.org/wikipedia/commons/0/00/Near_temple_haiden.jpg'
    );
    assertStringIncludes(s.out.stdout, 'Commons に無いファイル 1');
    for (const text of [mappingText, photosText, s.out.stdout]) {
      assert(!/\d{4}-\d{2}-\d{2}T/.test(text));
      assert(!text.includes(s.work));
      assert(!text.includes(s.dir));
      assert(!text.includes('goshuin-work'));
    }

    s.reset();
    assertEquals(await s.run('build'), 0);
    assertStringIncludes(s.out.stdout, '変わるものは無い');
    assertEquals(await s.run('build', '--check'), 0);

    // prettier で整形しても（JSON として同じなら）同じとみなし、書き直さない
    const pretty = JSON.stringify(JSON.parse(mappingText));
    await Deno.writeTextFile(`${s.root}/${MAPPING_PATH}`, pretty);
    assertEquals(await s.run('build', '--check'), 0);
    assertEquals(await s.run('build'), 0);
    assertEquals(await Deno.readTextFile(`${s.root}/${MAPPING_PATH}`), pretty);

    // 1つの値を変えると --check は 1 で、ファイルの名前を出し、書かない
    const changed = mappingText.replace('"Q101"', '"Q102"');
    await Deno.writeTextFile(`${s.root}/${MAPPING_PATH}`, changed);
    s.reset();
    assertEquals(await s.run('build', '--check'), 1);
    assertStringIncludes(s.out.stderr, 'spot-wikidata-301.json');
    assert(!s.out.stderr.includes('spot-photos-301.json'));
    assertEquals(await Deno.readTextFile(`${s.root}/${MAPPING_PATH}`), changed);
  }
);

Deno.test(
  'AC-16: キャッシュに残りがあると、残りの数を出して終了コード 1（何も書かない）',
  async () => {
    await using s = await setup();
    assertEquals(await s.run('fetch', 'wikidata'), 0, s.out.stderr);
    s.reset();
    assertEquals(await s.run('build'), 1);
    assertStringIncludes(s.out.stderr, '残り');
    assert(/残り [1-9]/.test(s.out.stderr), s.out.stderr);
    assert(!(await exists(`${s.root}/${MAPPING_PATH}`)));
    assertEquals(s.net.calls.length, 0);
  }
);

Deno.test(
  'status: 段ごとに 要る数・取った数・残りを出す（取る前は、後の段は前の段のあと）',
  async () => {
    await using s = await setup();
    assertEquals(await s.run('status'), 0);
    assertStringIncludes(s.out.stdout, 'wikidata');
    assertStringIncludes(s.out.stdout, '前の段');
    assertEquals(s.net.calls.length, 0);
  }
);

// --- AC-17: review-data ---

Deno.test(
  'AC-17: review-data は --work の review/review-data.json だけを書き、--root に何も書かない',
  async () => {
    await using s = await setup();
    assertEquals(await s.run('fetch', 'all'), 0, s.out.stderr);
    const rootBefore = await listFiles(s.root);
    const workBefore = await listFiles(s.work);
    s.reset();
    assertEquals(await s.run('review-data'), 0, s.out.stderr);
    assertEquals(await listFiles(s.root), rootBefore);
    const workAfter = await listFiles(s.work);
    const added = [...workAfter.keys()].filter(k => !workBefore.has(k));
    assertEquals(added, [`${s.work}/review/review-data.json`]);
    const data = JSON.parse(workAfter.get(`${s.work}/review/review-data.json`)!);
    assertEquals(data.schemaVersion, 1);
    assertEquals(data.ledgerOsmCount, 1);
    assertEquals(data.maxOsm, 99);
    assertEquals(data.counts, { suggest: 1, owner: 1, investigate: 1, keep: 2 });
    assertEquals(
      Object.values(data.counts as Record<string, number>).reduce((a, b) => a + b, 0),
      5 // 台帳に無い件数
    );
    assertEquals(
      data.items.map((i: { name: string; verdict: string }) => [i.name, i.verdict]),
      [
        ['離れた寺', 'suggest'],
        ['住所だけの寺', 'owner'],
        ['手がかりの無い寺', 'investigate'],
      ]
    );
    const suggest = data.items[0];
    assertEquals(suggest.suggestion.choice, 'wd');
    assertEquals(suggest.suggestion.ref, 'Q103');
    assertEquals(suggest.link, { qid: 'Q103', confidence: 'high', label: '離れた寺' });
    assertEquals(suggest.points.map((p: { kind: string }) => p.kind).sort(), ['gsi', 'wd']);
    assert(suggest.points.every((p: { distanceM: number }) => typeof p.distanceM === 'number'));
    assertEquals(Object.keys(suggest).sort(), [
      'address',
      'file',
      'idx',
      'line',
      'link',
      'name',
      'points',
      'prefecture',
      'rank',
      'seed',
      'suggestion',
      'type',
      'verdict',
    ]);
    const owner = data.items[1];
    assertEquals(
      owner.points.map((p: { kind: string }) => p.kind),
      ['addr']
    );
    assertStringIncludes(s.out.stdout, 'review-data.json');
  }
);
