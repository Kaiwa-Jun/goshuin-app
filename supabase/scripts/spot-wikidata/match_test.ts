// Deno テスト（寺社と Wikidata を結びつける規則・公開の対応表の形。純関数）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-wikidata/
// 契約書: docs/issues/issue-301-spot-wikidata.md（S1 / AC-1〜AC-10）
import { assert, assertEquals, assertStringIncludes, assertThrows } from 'jsr:@std/assert@1';
import geojsonVt from 'npm:geojson-vt@4.0.2';
import vtpbf from 'npm:vt-pbf@3.1.3';

import {
  distanceMeters,
  type LatLng,
  type Ledger,
  mergeEntries,
  ownerItemToEntry,
  parseLedger,
  SEED_FILES,
} from '../spot-coords/coords.ts';
import {
  addressHitLevel,
  classifyCoord,
  type CoordPoint,
  dedupeLinks,
  type GsiFeature,
  gsiPointFor,
  isSpotLikeName,
  judgeLink,
  type Link,
  type LinkInput,
  type MappingEntry,
  nameMatch,
  normalizeAddress,
  normalizeName,
  parseEntity,
  parseGsiTile,
  parseImageInfo,
  parseMapping,
  parsePhotos,
  type PhotoEntry,
  readSeedRows,
  type SeedRow,
  serializeJson,
  validateExport,
  type WdItem,
} from './match.ts';

const ROOT = new URL('../../../', import.meta.url);
const read = (rel: string) => Deno.readTextFile(new URL(rel, ROOT));

async function realSeedRows(): Promise<SeedRow[]> {
  const files = await Promise.all(SEED_FILES.map(async path => ({ path, text: await read(path) })));
  return readSeedRows(files);
}

async function realLedger(): Promise<Ledger> {
  return parseLedger(await read('supabase/data/spot-coords-292.json'));
}

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(await Deno.readTextFile(new URL(`./fixtures/${name}`, import.meta.url)));
}

/** p から北へ m メートル（子午線の上なので distanceMeters とぴったり合う） */
function north(p: LatLng, m: number): LatLng {
  return { lat: p.lat + (m / 6_371_000) * (180 / Math.PI), lng: p.lng };
}

/** p から東へ m メートル（近い距離なら 0.1% 未満の差） */
function east(p: LatLng, m: number): LatLng {
  const dLng = (m / (6_371_000 * Math.cos((p.lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: p.lat, lng: p.lng + dLng };
}

function row(over: Partial<SeedRow> = {}): SeedRow {
  return {
    idx: 1,
    name: 'テスト寺',
    prefecture: '静岡県',
    type: 'temple',
    address: '静岡県袋井市豊沢2777',
    rank: 3,
    file: 'supabase/seeds/03_chubu.sql',
    line: 10,
    lat: 34.7,
    lng: 137.9,
    ...over,
  };
}

function item(over: Partial<WdItem> & { qid: string }): WdItem {
  return {
    label: null,
    aliases: [],
    p625: null,
    p18: [],
    p373: null,
    p131: [],
    p31: [],
    ...over,
  };
}

function input(over: Partial<LinkInput> & { row: SeedRow }): LinkInput {
  return {
    ledgerRef: null,
    candidates: [],
    lookup: () => undefined,
    addr: null,
    gsi: null,
    ...over,
  };
}

// --- AC-1: readSeedRows ---

Deno.test(
  'AC-1: 本物の seed は 1,109 行・idx は 1〜1109・台帳の 458 件と名前とファイルと行が合う',
  async () => {
    const rows = await realSeedRows();
    assertEquals(rows.length, 1109);
    assertEquals(
      rows.map(r => r.idx),
      Array.from({ length: 1109 }, (_, i) => i + 1)
    );
    const ledger = await realLedger();
    assertEquals(ledger.entries.length, 458);
    for (const e of ledger.entries) {
      const r = rows[e.idx - 1];
      assertEquals(
        [r.name, r.prefecture, r.file, r.line],
        [e.name, e.prefecture, e.seedFile, e.seedLine],
        `idx ${e.idx}`
      );
    }
    assertEquals([rows[277].name, rows[277].prefecture], ['姉倉比賣神社', '富山県']);
    assertEquals(rows[390], {
      idx: 391,
      name: '尊永寺',
      prefecture: '静岡県',
      type: 'temple',
      address: '静岡県袋井市豊沢2777',
      rank: 4,
      file: 'supabase/seeds/03_chubu.sql',
      line: 372,
      lat: 34.737787,
      lng: 137.97723,
    });
    assertEquals(rows[864].name, '護国寺（那覇）');
  }
);

Deno.test("AC-1: readSeedRows は '' を ' に戻し、寺社の行でない行を数えない", () => {
  const text = [
    '-- コメント',
    'INSERT INTO spots (name, lat, lng, type, address, prefecture, rank, status) VALUES',
    "('O''Brien 寺', 35.1, 135.2, 'temple', '京都府京都市', '京都府', 2, 'active'),",
    '-- 住所確認: ✓',
    "('次の社', 35.3, 135.4, 'shrine', '京都府京都市北区', '京都府', 1, 'active')",
    ';',
  ].join('\n');
  const rows = readSeedRows([
    { path: 'a.sql', text },
    { path: 'b.sql', text: text.replace('次の社', '三つ目の社') },
  ]);
  assertEquals(
    rows.map(r => [r.idx, r.name, r.file, r.line]),
    [
      [1, "O'Brien 寺", 'a.sql', 3],
      [2, '次の社', 'a.sql', 5],
      [3, "O'Brien 寺", 'b.sql', 3],
      [4, '三つ目の社', 'b.sql', 5],
    ]
  );
  assertEquals(rows[1].type, 'shrine');
  assertEquals(rows[1].rank, 1);
});

// --- AC-2: 名前 ---

Deno.test('AC-2: normalizeName は旧字体・空白・括弧をそろえる', () => {
  assertEquals(nameMatch('長崎縣護國神社', '長崎県護国神社'), 'exact');
  assertEquals(nameMatch('姉倉比賣神社', '姉倉比売神社'), 'exact');
  assertEquals(nameMatch('彌彦神社', '弥彦神社'), 'exact');
  assertEquals(nameMatch('定義如来 西方寺', '定義如来西方寺'), 'exact');
  assertEquals(normalizeName('姉倉比賣神社（富山市舟倉）'), {
    base: '姉倉比売神社',
    qualifier: '富山市舟倉',
  });
  assertEquals(normalizeName('川崎大師（平間寺）'), { base: '川崎大師', qualifier: '平間寺' });
  assertEquals(normalizeName('川崎大師(平間寺)'), { base: '川崎大師', qualifier: '平間寺' });
  assertEquals(normalizeName('尊永寺'), { base: '尊永寺', qualifier: null });
  // Nominatim の名前は半角の括弧で英語を足している
  assertEquals(normalizeName('法多山尊永寺 (Hattasan Soneiji)'), {
    base: '法多山尊永寺',
    qualifier: 'HattasanSoneiji',
  });
  assertEquals(nameMatch('法多山尊永寺 (Hattasan Soneiji)', '尊永寺'), 'partial');
  assertEquals(nameMatch('霧島ヶ丘神社', '霧島ケ丘神社'), 'exact');
});

Deno.test('AC-2: isSpotLikeName', () => {
  for (const s of ['平間寺', '宝光院', '鎌倉大仏', '身代不動尊', '石手寺', '豊川稲荷']) {
    assert(isSpotLikeName(s), s);
  }
  for (const s of ['沼田市', '八槻', '那覇', '有壁', '富山市舟倉']) {
    assert(!isSpotLikeName(s), s);
  }
});

Deno.test('AC-2: nameMatch の partial は短い方が3文字以上', () => {
  assertEquals(nameMatch('五十一番石手寺', '石手寺'), 'partial');
  assertEquals(nameMatch('八坂神社', '坂神社'), 'partial');
  assertEquals(nameMatch('八坂神社', '神社'), 'none');
  assertEquals(nameMatch('八坂神社', '平安神宮'), 'none');
  // 括弧は比べない（base だけ）
  assertEquals(nameMatch('都々古別神社（八槻）', '都々古別神社（馬場）'), 'exact');
});

// --- AC-3: judgeLink（台帳と姉倉比賣神社） ---

const ANEKURA_ROW = row({
  idx: 278,
  name: '姉倉比賣神社',
  prefecture: '富山県',
  type: 'shrine',
  address: '富山県富山市舟倉2334',
  rank: 4,
  line: 95,
  lat: 36.6615,
  lng: 137.1432,
});

async function anekuraItems(): Promise<WdItem[]> {
  const raw = (await fixture('wd-anekura.json')) as { entities: Record<string, unknown> };
  return Object.values(raw.entities).map(parseEntity);
}

Deno.test(
  'AC-3: parseEntity は D-6 のとおりに値を取る（P625 は最初の normal・小数6桁）',
  async () => {
    const [kureha, funakura] = await anekuraItems();
    assertEquals(kureha.qid, 'Q11447234');
    assertEquals(kureha.label, '姉倉比売神社');
    assertEquals(kureha.aliases, ['姉倉姫神社', '姉倉比賣神社', '姉倉比賣神社（富山市呉羽町）']);
    assertEquals(kureha.p625, { lat: 36.718083, lng: 137.166722 });
    assertEquals(kureha.p18, ['Kureha-Anekurahime-jinja haiden.jpeg']);
    assertEquals(kureha.p373, 'Kureha-Anekurahime-jinja');
    assertEquals(kureha.p131, ['Q204266', 'Q906899', 'Q6987940']);
    assertEquals(funakura.qid, 'Q135194979');
    assertEquals(funakura.label, '姉倉比賣神社（富山市舟倉）');
    assertEquals(funakura.aliases, []);
    assertEquals(funakura.p625, { lat: 36.564233, lng: 137.231602 });
    assertEquals(funakura.p18, []);
    assertEquals(funakura.p373, null);
    const seed = { lat: ANEKURA_ROW.lat, lng: ANEKURA_ROW.lng };
    assert(Math.abs(distanceMeters(seed, kureha.p625!) - 6600) < 100);
    assert(Math.abs(distanceMeters(seed, funakura.p625!) - 13400) < 100);
  }
);

Deno.test('AC-3: parseEntity は preferred を先に、deprecated を除く', () => {
  const st = (rank: string, value: unknown, type = 'string') => ({
    mainsnak: { snaktype: 'value', datavalue: { value, type } },
    rank,
  });
  const coord = (lat: number, lng: number) => ({ latitude: lat, longitude: lng });
  const e = parseEntity({
    id: 'Q5',
    labels: {},
    aliases: {},
    claims: {
      P625: [
        st('normal', coord(35.1, 135.1), 'globecoordinate'),
        st('preferred', coord(35.2, 135.2), 'globecoordinate'),
      ],
      P18: [st('normal', 'a.jpg'), st('deprecated', 'b.jpg'), st('preferred', 'c.jpg')],
      P373: [st('normal', 'Cat')],
      P31: [st('normal', { id: 'Q50337' }, 'wikibase-entityid')],
    },
  });
  assertEquals(e.label, null);
  assertEquals(e.p625, { lat: 35.2, lng: 135.2 });
  assertEquals(e.p18, ['c.jpg', 'a.jpg']);
  assertEquals(e.p31, ['Q50337']);
});

Deno.test('AC-3: 台帳の第1弾 wikidata の寺社は、seed に近い別の候補があっても台帳の Q-ID', () => {
  const r = row({ idx: 391, name: '尊永寺' });
  const link = judgeLink(
    input({
      row: r,
      ledgerRef: 'Q11555090',
      candidates: [item({ qid: 'Q999', label: '尊永寺', p625: north(r, 10) })],
      addr: north(r, 5),
    })
  );
  assertEquals(link.qid, 'Q11555090');
  assertEquals(link.confidence, 'high');
  assertEquals(link.method, 'ledger');
  assertEquals(link.candidates, []);
  assert(link.basis.length > 0);
});

Deno.test(
  'AC-3: 姉倉比賣神社は 舟倉 の Q135194979（括弧が住所に合う・地理院の住所から 40m）',
  async () => {
    const items = await anekuraItems();
    const funakura = items.find(i => i.qid === 'Q135194979')!;
    const link = judgeLink(
      input({ row: ANEKURA_ROW, candidates: items, addr: east(funakura.p625!, 40) })
    );
    assertEquals(link.qid, 'Q135194979');
    assertEquals(link.confidence, 'high');
    assertEquals(link.method, 'rule');
    assertEquals(link.candidates, ['Q11447234']);
    assertStringIncludes(link.basis, '舟倉');
    assertStringIncludes(link.basis, '40m');
  }
);

Deno.test('AC-3: 地理院の住所が無くても、括弧が合うので Q135194979・high', async () => {
  const link = judgeLink(input({ row: ANEKURA_ROW, candidates: await anekuraItems() }));
  assertEquals([link.qid, link.confidence], ['Q135194979', 'high']);
  assertEquals(link.candidates, ['Q11447234']);
  assertStringIncludes(link.basis, '舟倉');
});

// --- AC-4: judgeLink（ほかの場合） ---

const TOYAMA_ROW = row({
  idx: 300,
  name: '日枝神社',
  prefecture: '富山県',
  address: '富山県富山市山王町4-12',
  lat: 36.69,
  lng: 137.21,
});

Deno.test('AC-4: P131 をたどって別の県に着く候補は外れ、令制国で止まる候補は残る', () => {
  const seed = { lat: TOYAMA_ROW.lat, lng: TOYAMA_ROW.lng };
  const entities = new Map<string, WdItem>([
    ['Q901', item({ qid: 'Q901', label: '糸魚川市', p131: ['Q902'] })],
    ['Q902', item({ qid: 'Q902', label: '新潟県', p31: ['Q50337'] })],
    ['Q903', item({ qid: 'Q903', label: '越中国', p31: ['Q860290'] })],
  ]);
  const niigata = item({
    qid: 'Q101',
    label: '日枝神社',
    p625: north(seed, 30_000),
    p131: ['Q901'],
  });
  const ecchu = item({ qid: 'Q102', label: '日枝神社', p625: north(seed, 250), p131: ['Q903'] });
  const link = judgeLink(
    input({ row: TOYAMA_ROW, candidates: [niigata, ecchu], lookup: q => entities.get(q) })
  );
  assertEquals(link.qid, 'Q102');
  assertEquals(link.confidence, 'high');
  assertEquals(link.candidates, ['Q101']);
});

Deno.test('AC-4: P131 が同じ県に着く候補は残る（5段まで、値が複数でも）', () => {
  const seed = { lat: TOYAMA_ROW.lat, lng: TOYAMA_ROW.lng };
  const entities = new Map<string, WdItem>([
    ['Q911', item({ qid: 'Q911', label: '越中国', p31: ['Q860290'] })],
    ['Q912', item({ qid: 'Q912', label: '富山市', p131: ['Q913'] })],
    ['Q913', item({ qid: 'Q913', label: '富山県', p31: ['Q50337'] })],
  ]);
  const c = item({
    qid: 'Q110',
    label: '日枝神社',
    p625: north(seed, 250),
    p131: ['Q911', 'Q912'],
  });
  const link = judgeLink(input({ row: TOYAMA_ROW, candidates: [c], lookup: q => entities.get(q) }));
  assertEquals([link.qid, link.confidence], ['Q110', 'high']);
});

Deno.test('AC-4: どの基準点からも 100.1km の候補は外れ、99.9km なら残る', () => {
  const seed = { lat: TOYAMA_ROW.lat, lng: TOYAMA_ROW.lng };
  const far = judgeLink(
    input({
      row: TOYAMA_ROW,
      candidates: [item({ qid: 'Q120', label: '日枝神社', p625: north(seed, 100_100) })],
    })
  );
  assertEquals([far.qid, far.confidence, far.candidates], [null, 'none', ['Q120']]);
  const near = judgeLink(
    input({
      row: TOYAMA_ROW,
      candidates: [item({ qid: 'Q120', label: '日枝神社', p625: north(seed, 99_900) })],
    })
  );
  assertEquals([near.qid, near.confidence], ['Q120', 'medium']);
});

Deno.test('AC-4: 候補1つが seed だけから 250m → high、400m → medium', () => {
  const seed = { lat: TOYAMA_ROW.lat, lng: TOYAMA_ROW.lng };
  const at = (m: number) =>
    judgeLink(
      input({
        row: TOYAMA_ROW,
        candidates: [item({ qid: 'Q130', label: '日枝神社', p625: north(seed, m) })],
      })
    );
  assertEquals([at(250).qid, at(250).confidence], ['Q130', 'high']);
  assertEquals([at(400).qid, at(400).confidence], ['Q130', 'medium']);
});

Deno.test('AC-4: seed だけに支えられた候補が1つで、ほかにも候補があれば medium', () => {
  const seed = { lat: TOYAMA_ROW.lat, lng: TOYAMA_ROW.lng };
  const link = judgeLink(
    input({
      row: TOYAMA_ROW,
      candidates: [
        item({ qid: 'Q131', label: '日枝神社', p625: north(seed, 250) }),
        item({ qid: 'Q132', label: '日枝神社', p625: north(seed, 5_000) }),
      ],
    })
  );
  assertEquals([link.qid, link.confidence, link.candidates], ['Q131', 'medium', ['Q132']]);
});

Deno.test('AC-4: 候補2つがどちらも支えられない → 決めない・candidates に2つ', () => {
  const seed = { lat: TOYAMA_ROW.lat, lng: TOYAMA_ROW.lng };
  const link = judgeLink(
    input({
      row: TOYAMA_ROW,
      candidates: [
        item({ qid: 'Q142', label: '日枝神社', p625: north(seed, 5_000) }),
        item({ qid: 'Q141', label: '日枝神社', p625: north(seed, 8_000) }),
      ],
    })
  );
  assertEquals([link.qid, link.confidence, link.candidates], [null, 'none', ['Q141', 'Q142']]);
});

Deno.test('AC-4: 地理院の点に支えられた候補が2つで、括弧で決まらない → 決めない', () => {
  const seed = { lat: TOYAMA_ROW.lat, lng: TOYAMA_ROW.lng };
  const a = north(seed, 2_000);
  const link = judgeLink(
    input({
      row: TOYAMA_ROW,
      candidates: [
        item({ qid: 'Q151', label: '日枝神社', p625: a }),
        item({ qid: 'Q152', label: '日枝神社', p625: north(seed, 5_000) }),
      ],
      addr: north(a, 50),
      gsi: north(seed, 5_050),
    })
  );
  assertEquals([link.qid, link.confidence], [null, 'none']);
});

Deno.test('AC-4: partial の候補1つが地理院の注記から 100m → low', () => {
  const r = row({ name: '石手寺', prefecture: '愛媛県', address: '愛媛県松山市石手2-9-21' });
  const p = north(r, 3_000);
  const link = judgeLink(
    input({
      row: r,
      candidates: [item({ qid: 'Q160', label: '五十一番石手寺', p625: p })],
      gsi: north(p, 100),
    })
  );
  assertEquals([link.qid, link.confidence, link.method], ['Q160', 'low', 'rule']);
});

Deno.test('AC-4: partial の候補が支えられない → 決めない', () => {
  const r = row({ name: '石手寺', prefecture: '愛媛県', address: '愛媛県松山市石手2-9-21' });
  const link = judgeLink(
    input({
      row: r,
      candidates: [item({ qid: 'Q161', label: '五十一番石手寺', p625: north(r, 3_000) })],
    })
  );
  assertEquals([link.qid, link.confidence, link.candidates], [null, 'none', ['Q161']]);
});

Deno.test('AC-4: 候補 0 → 決めない・candidates は空', () => {
  const link = judgeLink(
    input({
      row: TOYAMA_ROW,
      candidates: [item({ qid: 'Q170', label: '平安神宮', p625: { lat: 36.69, lng: 137.21 } })],
    })
  );
  assertEquals([link.qid, link.confidence, link.candidates], [null, 'none', []]);
  assert(link.basis.length > 0);
});

Deno.test('AC-4: 川崎大師（平間寺）は括弧の 平間寺 でも探す（seed から 100m → high）', () => {
  const r = row({
    name: '川崎大師（平間寺）',
    prefecture: '神奈川県',
    address: '神奈川県川崎市川崎区大師町4-48',
    lat: 35.5347,
    lng: 139.7294,
  });
  const link = judgeLink(
    input({ row: r, candidates: [item({ qid: 'Q180', label: '平間寺', p625: north(r, 100) })] })
  );
  assertEquals([link.qid, link.confidence], ['Q180', 'high']);
});

// --- AC-5: 同じ県の同名 ---

const TSUTSUKOWAKE_YATSUKI = row({
  idx: 101,
  name: '都々古別神社（八槻）',
  prefecture: '福島県',
  address: '福島県東白川郡棚倉町八槻字大宮224',
  lat: 36.9945,
  lng: 140.3921,
});
const TSUTSUKOWAKE_BABA = row({
  idx: 102,
  name: '都々古別神社（馬場）',
  prefecture: '福島県',
  address: '福島県東白川郡棚倉町棚倉字馬場39',
  lat: 37.0321,
  lng: 140.3759,
});

Deno.test('AC-5: 都々古別神社（八槻）/（馬場）は、それぞれ住所の合う項目を選ぶ', () => {
  const candidates = [
    item({ qid: 'Q201', label: '都々古別神社（八槻）', p625: north(TSUTSUKOWAKE_YATSUKI, 80) }),
    item({ qid: 'Q202', label: '都々古別神社（馬場）', p625: north(TSUTSUKOWAKE_BABA, 80) }),
  ];
  const links = dedupeLinks([
    judgeLink(input({ row: TSUTSUKOWAKE_YATSUKI, candidates })),
    judgeLink(input({ row: TSUTSUKOWAKE_BABA, candidates })),
  ]);
  assertEquals(
    links.map(l => [l.idx, l.qid, l.confidence]),
    [
      [101, 'Q201', 'high'],
      [102, 'Q202', 'high'],
    ]
  );
  assertEquals(links[0].candidates, ['Q202']);
});

Deno.test('AC-5: 満願寺 と 満願寺（宝光院）に候補が1つなら 満願寺 に残る', () => {
  const base = {
    prefecture: '宮城県',
    address: '宮城県仙台市青葉区本町1-9-10',
    lat: 38.265588,
    lng: 140.877248,
  };
  const plain = row({ idx: 1001, name: '満願寺', ...base });
  const hokoin = row({ idx: 1002, name: '満願寺（宝光院）', ...base });
  const candidates = [item({ qid: 'Q301', label: '満願寺', p625: north(plain, 50) })];
  const links = dedupeLinks([
    judgeLink(input({ row: plain, candidates })),
    judgeLink(input({ row: hokoin, candidates })),
  ]);
  assertEquals([links[0].qid, links[0].confidence], ['Q301', 'high']);
  assertEquals([links[1].qid, links[1].confidence, links[1].candidates], [null, 'none', ['Q301']]);
  assertStringIncludes(links[1].basis, '満願寺');
});

function link(over: Partial<Link> & { idx: number; qid: string | null }): Link {
  return {
    name: `寺${over.idx}`,
    prefecture: '静岡県',
    confidence: 'high',
    method: 'rule',
    candidates: [],
    basis: 'テスト',
    qualifierMatch: false,
    hasQualifier: false,
    ...over,
  };
}

Deno.test(
  'AC-5: dedupeLinks は確かさ → 括弧が合う → seed に括弧が無い の順で1行に残し、並んだら全部決めない',
  () => {
    const byConfidence = dedupeLinks([
      link({ idx: 1, qid: 'Q1', confidence: 'medium' }),
      link({ idx: 2, qid: 'Q1', confidence: 'high', candidates: ['Q7'] }),
    ]);
    assertEquals(
      byConfidence.map(l => [l.qid, l.confidence, l.candidates]),
      [
        [null, 'none', ['Q1']],
        ['Q1', 'high', ['Q7']],
      ]
    );
    const byQualifier = dedupeLinks([
      link({ idx: 1, qid: 'Q1', hasQualifier: true, qualifierMatch: true }),
      link({ idx: 2, qid: 'Q1' }),
    ]);
    assertEquals(
      byQualifier.map(l => l.qid),
      ['Q1', null]
    );
    const tie = dedupeLinks([link({ idx: 1, qid: 'Q1' }), link({ idx: 2, qid: 'Q1' })]);
    assertEquals(
      tie.map(l => [l.qid, l.confidence, l.candidates]),
      [
        [null, 'none', ['Q1']],
        [null, 'none', ['Q1']],
      ]
    );
  }
);

Deno.test('AC-5: 台帳の行どうしが同じ Q-ID なら両方残し、規則の行は台帳の行に負ける', () => {
  const out = dedupeLinks([
    link({ idx: 323, qid: 'Q11557476', method: 'ledger' }),
    link({ idx: 340, qid: 'Q11557476', method: 'ledger', hasQualifier: true }),
    link({ idx: 500, qid: 'Q11557476', qualifierMatch: true, hasQualifier: true }),
  ]);
  assertEquals(
    out.map(l => [l.idx, l.qid, l.method, l.confidence]),
    [
      [323, 'Q11557476', 'ledger', 'high'],
      [340, 'Q11557476', 'ledger', 'high'],
      [500, null, 'rule', 'none'],
    ]
  );
  assertEquals(out[2].candidates, ['Q11557476']);
});

// --- AC-6: 地理院の住所 ---

Deno.test('AC-6: addressHitLevel', () => {
  assertEquals(addressHitLevel('静岡県袋井市豊沢2777', '静岡県袋井市豊沢２７７７'), 'banchi');
  assertEquals(addressHitLevel('静岡県袋井市豊沢2777', '静岡県袋井市豊沢'), 'town');
  assertEquals(addressHitLevel('富山県富山市舟倉2334', '富山県富山市舟倉２３３４'), 'banchi');
  assertEquals(addressHitLevel('東京都文京区大塚5-40-1', '東京都文京区大塚五丁目40番'), 'banchi');
  assertEquals(
    addressHitLevel('東京都文京区大塚5-40-1', '東京都文京区大塚五丁目４０番１号'),
    'banchi'
  );
  assertEquals(addressHitLevel('京都府京都市東山区祇園町北側625', '京都府京都市東山区'), 'none');
  // 丁目だけの点は番地ではない（町名と同じく数百 m ずれる）
  assertEquals(addressHitLevel('東京都文京区大塚5-40-1', '東京都文京区大塚五丁目'), 'town');
  // 番地の途中で切れている（2777 に対して 27）
  assertEquals(addressHitLevel('静岡県袋井市豊沢2777', '静岡県袋井市豊沢27'), 'town');
  assertEquals(addressHitLevel('静岡県袋井市豊沢2777', '静岡県磐田市'), 'none');
});

Deno.test('AC-6: normalizeAddress', () => {
  assertEquals(normalizeAddress('東京都文京区大塚 五丁目４０番地１号'), '東京都文京区大塚5-40-1');
  assertEquals(
    normalizeAddress('北海道札幌市東区北12条東1丁目1－10'),
    '北海道札幌市東区北12条東1-1-10'
  );
  assertEquals(normalizeAddress('京都府京都市十九丁目3番'), '京都府京都市19-3');
  assertEquals(normalizeAddress('大阪府大阪市十丁目'), '大阪府大阪市10');
  assertEquals(normalizeAddress('福岡県福岡市1ー2'), '福岡県福岡市1-2');
});

// --- AC-7: 地理院のベクトルタイル ---

const TILE = { z: 16, x: 57885, y: 26017 };

function tileCenter(): LatLng {
  const n = 2 ** TILE.z;
  const lng = ((TILE.x + 0.5) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (TILE.y + 0.5)) / n))) * 180) / Math.PI;
  return { lat, lng };
}

function pointFeature(p: LatLng, properties: Record<string, unknown>) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties,
  };
}

function makeTile(layers: Record<string, ReturnType<typeof pointFeature>[]>): Uint8Array {
  const tiles: Record<string, unknown> = {};
  for (const [name, features] of Object.entries(layers)) {
    const index = geojsonVt(
      { type: 'FeatureCollection', features },
      { maxZoom: TILE.z, indexMaxZoom: TILE.z, tolerance: 0, buffer: 0 }
    );
    tiles[name] = index.getTile(TILE.z, TILE.x, TILE.y);
  }
  return vtpbf.fromGeojsonVt(tiles, { version: 2 });
}

Deno.test(
  'AC-7: parseGsiTile は 661・662 の注記と 3231・3232 の記号だけを、緯度経度にして返す',
  () => {
    const c = tileCenter();
    const pts = {
      a: east(c, -100),
      b: east(c, 0),
      c: east(c, 100),
      d: north(c, 100),
      e: north(c, -100),
      f: north(east(c, 50), 50),
    };
    const bytes = makeTile({
      label: [
        pointFeature(pts.a, { annoCtg: 661, knj: '伊佐爾波神社', kana: 'いさにわじんじゃ' }),
        pointFeature(pts.b, { annoCtg: 662, knj: '尊永寺' }),
        pointFeature(pts.c, { annoCtg: 673, knj: '小笠山' }),
      ],
      symbol: [
        pointFeature(pts.d, { ftCode: 3231 }),
        pointFeature(pts.e, { ftCode: 3232 }),
        pointFeature(pts.f, { ftCode: 6322 }),
      ],
      road: [pointFeature(c, { ftCode: 2701 })],
    });
    const features = parseGsiTile(bytes, TILE.z, TILE.x, TILE.y);
    const sorted = [...features].sort((x, y) => x.code - y.code);
    assertEquals(
      sorted.map(f => [f.kind, f.code, f.name]),
      [
        ['label', 661, '伊佐爾波神社'],
        ['label', 662, '尊永寺'],
        ['symbol', 3231, null],
        ['symbol', 3232, null],
      ]
    );
    const expect = [pts.a, pts.b, pts.d, pts.e];
    sorted.forEach((f, i) => assert(distanceMeters(f, expect[i]) < 1, `${f.code}`));
  }
);

Deno.test('AC-7: parseGsiTile は層が無いタイル・空のタイルで空を返す', () => {
  assertEquals(
    parseGsiTile(
      makeTile({ road: [pointFeature(tileCenter(), { ftCode: 1 })] }),
      TILE.z,
      TILE.x,
      TILE.y
    ),
    []
  );
  assertEquals(parseGsiTile(new Uint8Array(0), TILE.z, TILE.x, TILE.y), []);
});

Deno.test(
  'AC-7: gsiPointFor は注記から 150m 以内の記号に寄せる（120m なら記号、160m なら注記）',
  () => {
    const c = tileCenter();
    const label: GsiFeature = { kind: 'label', code: 662, name: '石手寺', ...c };
    const snapped = gsiPointFor(
      ['石手寺'],
      [
        label,
        { kind: 'symbol', code: 3231, name: null, ...north(c, 120) },
        { kind: 'symbol', code: 3231, name: null, ...north(c, 140) },
      ],
      [c]
    );
    assert(snapped);
    assert(distanceMeters(snapped, north(c, 120)) < 0.5);
    assertEquals(snapped.label, '石手寺');
    const kept = gsiPointFor(
      ['石手寺'],
      [label, { kind: 'symbol', code: 3231, name: null, ...north(c, 160) }],
      [c]
    );
    assert(kept);
    assert(distanceMeters(kept, c) < 0.5);
  }
);

Deno.test('AC-7: gsiPointFor は名前の合う注記のうち near にいちばん近いものを選ぶ', () => {
  const c = tileCenter();
  const features: GsiFeature[] = [
    { kind: 'label', code: 662, name: '五十一番石手寺', ...north(c, 500) },
    { kind: 'label', code: 662, name: '石手寺', ...north(c, 2_000) },
    { kind: 'label', code: 661, name: '小笠山総合運動公園', ...north(c, 10) },
  ];
  const p = gsiPointFor(['石手寺'], features, [north(c, 2_600), c]);
  assert(p);
  assertEquals(p.label, '五十一番石手寺');
  assert(distanceMeters(p, north(c, 500)) < 0.5);
  // 小笠山総合運動公園 は c から 10m だが、名前が合わないので選ばれない
  assertEquals(gsiPointFor(['石手寺'], features, [c])?.label, '五十一番石手寺');
  assertEquals(gsiPointFor(['尊永寺'], features, [c]), null);
  assertEquals(gsiPointFor(['石手寺'], [], [c]), null);
});

// S4 の抜き取りで見つかった取り違え（湯殿山神社・黄金山神社）。同じ名前の注記が seed の近くと、
// 別の同名の項目の P625 の近くの両方にあるとき、seed・住所の近く（SUPPORT_M 以内）の注記を先に選ぶ
Deno.test(
  'gsiPointFor: seed・住所から 300m 以内に名前の合う注記があれば、候補の P625 により近い注記より先に選ぶ',
  () => {
    const seed = tileCenter();
    const wrong = north(seed, 16_700); // 別の同名の寺社の P625
    const features: GsiFeature[] = [
      { kind: 'label', code: 661, name: '湯殿山神社', ...east(seed, 17) },
      { kind: 'label', code: 661, name: '湯殿山神社', ...east(wrong, 9) },
    ];
    const p = gsiPointFor(['湯殿山神社'], features, [seed, wrong], [seed]);
    assert(p);
    assert(distanceMeters(p, east(seed, 17)) < 0.5, `${p.lat}, ${p.lng}`);
    // 住所の点も seed と同じ扱い
    const addr = north(seed, 2_000);
    const q = gsiPointFor(
      ['湯殿山神社'],
      [
        { kind: 'label', code: 661, name: '湯殿山神社', ...east(addr, 250) },
        { kind: 'label', code: 661, name: '湯殿山神社', ...east(wrong, 5) },
      ],
      [seed, addr, wrong],
      [seed, addr]
    );
    assert(q);
    assert(distanceMeters(q, east(addr, 250)) < 0.5);
  }
);

Deno.test(
  'gsiPointFor: seed・住所の 300m 以内に無ければ、今までどおり候補の P625 にいちばん近い注記（seed がずれている寺社）',
  () => {
    const seed = tileCenter();
    const cand = north(seed, 800);
    const features: GsiFeature[] = [
      { kind: 'label', code: 662, name: '離れた寺', ...east(cand, 50) },
      { kind: 'label', code: 662, name: '離れた寺', ...north(seed, 3_000) },
    ];
    const p = gsiPointFor(['離れた寺'], features, [seed, cand], [seed]);
    assert(p);
    assert(distanceMeters(p, east(cand, 50)) < 0.5);
    // 301m は 300m の外
    const r = gsiPointFor(
      ['離れた寺'],
      [
        { kind: 'label', code: 662, name: '離れた寺', ...east(seed, 301) },
        { kind: 'label', code: 662, name: '離れた寺', ...east(cand, 50) },
      ],
      [seed, cand],
      [seed]
    );
    assert(r);
    assert(distanceMeters(r, east(cand, 50)) < 0.5);
  }
);

// --- AC-8: classifyCoord ---

const SEED: LatLng = { lat: 35.0, lng: 135.0 };
const pt = (kind: CoordPoint['kind'], p: LatLng, ref: string | null = null): CoordPoint => ({
  kind,
  ...p,
  ref,
  label: null,
});

Deno.test('AC-8: wd が 800m・gsi が wd から 100m・seed のまわりに点なし → suggest（wd）', () => {
  const wd = north(SEED, 800);
  const r = classifyCoord(SEED, [pt('wd', wd, 'Q1'), pt('gsi', north(wd, 100))]);
  assertEquals(r.verdict, 'suggest');
  assertEquals(r.suggestion, { choice: 'wd', lat: wd.lat, lng: wd.lng, ref: 'Q1' });
  assertEquals(r.needsOsm, false);
});

Deno.test('AC-8: wd なし・osm が 600m・addr が osm から 120m → suggest（osm）', () => {
  const osm = north(SEED, 600);
  const r = classifyCoord(SEED, [pt('osm', osm, 'way/1'), pt('addr', east(osm, 120))]);
  assertEquals(r.verdict, 'suggest');
  assertEquals(r.suggestion, { choice: 'osm', lat: osm.lat, lng: osm.lng, ref: 'way/1' });
  assertEquals(r.needsOsm, true);
});

Deno.test('AC-8: wd が 1.2km・gsi と addr が seed から 80m → keep', () => {
  const r = classifyCoord(SEED, [
    pt('wd', north(SEED, 1_200), 'Q1'),
    pt('gsi', east(SEED, 80)),
    pt('addr', north(SEED, 80)),
  ]);
  assertEquals([r.verdict, r.suggestion, r.needsOsm], ['keep', null, false]);
});

Deno.test(
  'AC-8: wd が 900m で osm と 100m で合う・addr が seed から 50m → owner（食い違い）',
  () => {
    const wd = north(SEED, 900);
    const r = classifyCoord(SEED, [
      pt('wd', wd, 'Q1'),
      pt('osm', east(wd, 100), 'node/1'),
      pt('addr', north(SEED, 50)),
    ]);
    assertEquals([r.verdict, r.suggestion], ['owner', null]);
  }
);

Deno.test('AC-8: gsi と addr だけが seed から 500m で合う → owner', () => {
  const g = north(SEED, 500);
  const r = classifyCoord(SEED, [pt('gsi', g), pt('addr', east(g, 30))]);
  assertEquals([r.verdict, r.suggestion, r.needsOsm], ['owner', null, true]);
});

Deno.test('AC-8: 点が無い → investigate', () => {
  const r = classifyCoord(SEED, []);
  assertEquals([r.verdict, r.suggestion, r.needsOsm], ['investigate', null, true]);
});

Deno.test('AC-8: 同じ家族の点どうし（gsi と addr）は提案の裏付けにならない', () => {
  const osm = north(SEED, 600);
  // osm を wd が裏付ける（別の家族）
  assertEquals(
    classifyCoord(SEED, [pt('osm', osm, 'way/2'), pt('wd', east(osm, 100), 'Q2')]).verdict,
    'suggest'
  );
  // 150m より遠い裏付けは合わない
  assertEquals(
    classifyCoord(SEED, [pt('wd', osm, 'Q2'), pt('gsi', east(osm, 160))]).verdict,
    'owner'
  );
  // seed から 200m 未満の wd は提案にならない
  const near = north(SEED, 190);
  const r = classifyCoord(SEED, [pt('wd', near, 'Q3'), pt('gsi', east(near, 20))]);
  assertEquals(r.verdict, 'keep');
});

// --- AC-9: Commons と、公開の2ファイルの検査 ---

Deno.test('AC-9: parseImageInfo は HTML を外し、真偽にし、missing を数える', async () => {
  const res = await fixture('commons-imageinfo.json');
  const out = parseImageInfo(res, [
    'Kureha-Anekurahime-jinja haiden.jpeg',
    'Example shrine haiden.jpg',
    'Example_temple_gate.png',
    'Example missing photo.jpg',
  ]);
  assertEquals(out.missing, ['Example missing photo.jpg']);
  const kureha = out.files['Kureha-Anekurahime-jinja haiden.jpeg'];
  assertEquals(kureha.file, 'Kureha-Anekurahime-jinja haiden.jpeg');
  assertEquals(kureha.artist, 'nnh');
  assertEquals(kureha.credit, 'photo by nnh');
  assertEquals(kureha.attributionRequired, false);
  assertEquals(kureha.copyrighted, false);
  assertEquals(kureha.license, 'Public domain');
  assertEquals([kureha.width, kureha.height, kureha.mime], [3072, 2304, 'image/jpeg']);
  assertEquals(
    kureha.url,
    'https://upload.wikimedia.org/wikipedia/commons/2/2c/Kureha-Anekurahime-jinja_haiden.jpeg'
  );
  assertEquals(
    kureha.descriptionUrl,
    'https://commons.wikimedia.org/wiki/File:Kureha-Anekurahime-jinja_haiden.jpeg'
  );
  const foo = out.files['Example shrine haiden.jpg'];
  assertEquals(foo.artist, 'Foo');
  assertEquals(
    foo.artistHtml,
    '<a href="//commons.wikimedia.org/wiki/User:Foo" title="User:Foo">Foo</a>'
  );
  assertEquals(foo.credit, 'Own work');
  assertEquals(foo.attributionRequired, true);
  assertEquals(foo.copyrighted, true);
  assertEquals(foo.restrictions, 'personality');
  assertEquals(foo.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0');
  // underscore の名前は normalized で引く。無いキーは null・restrictions は空
  const bare = out.files['Example_temple_gate.png'];
  assertEquals(bare.file, 'Example_temple_gate.png');
  assertEquals(
    [bare.artist, bare.artistHtml, bare.credit, bare.creditHtml, bare.licenseUrl, bare.usageTerms],
    [null, null, null, null, null, null]
  );
  assertEquals([bare.attributionRequired, bare.copyrighted, bare.restrictions], [null, null, '']);
  assertEquals(Object.keys(out.files).length, 3);
});

function mappingEntry(over: Partial<MappingEntry> & { idx: number }): MappingEntry {
  return {
    name: `寺${over.idx}`,
    prefecture: '静岡県',
    qid: `Q${over.idx}00`,
    label: `寺${over.idx}`,
    p625: { lat: 34.7, lng: 137.9 },
    p18: [],
    p373: null,
    confidence: 'high',
    method: 'rule',
    candidates: [],
    basis: '名前が一致。seed から 40m',
    ...over,
  };
}

function mapping(entries: unknown[]) {
  return {
    schemaVersion: 1,
    issue: 301,
    note: 'テスト',
    attribution: { wikidata: 'Wikidata（CC0 1.0）https://www.wikidata.org/' },
    entries,
  };
}

const VALID_MAPPING = [
  mappingEntry({ idx: 1, method: 'ledger', basis: '#292 の台帳（第1弾）' }),
  mappingEntry({ idx: 2, qid: 'Q100', method: 'ledger', basis: '#292 の台帳（第1弾）' }),
  mappingEntry({ idx: 3, qid: 'Q100', method: 'ledger', basis: '#292 の台帳（第1弾）' }),
  mappingEntry({ idx: 4, confidence: 'medium', candidates: ['Q5', 'Q40'], p18: ['A b.jpg'] }),
  mappingEntry({ idx: 5, confidence: 'low', p625: null }),
  mappingEntry({
    idx: 6,
    qid: null,
    label: null,
    p625: null,
    confidence: 'none',
    candidates: ['Q9'],
    basis: '同名 2 件で決められない',
  }),
];

Deno.test('AC-9: parseMapping は正しい対応表を通す（台帳の行どうしの同じ Q-ID は許す）', () => {
  const m = parseMapping(mapping(VALID_MAPPING));
  assertEquals(m.entries.length, 6);
  assertEquals(parseMapping(JSON.stringify(mapping(VALID_MAPPING))).entries[3].candidates, [
    'Q5',
    'Q40',
  ]);
});

Deno.test(
  'AC-9: parseMapping は決めたキー以外・確かさと qid の食い違い・重なり・順・座標・basis で止まる',
  () => {
    const bad = (entries: unknown[], what: string) =>
      assertThrows(() => parseMapping(mapping(entries)), Error, undefined, what);
    const ok = VALID_MAPPING;
    for (const key of ['osm', 'gsi', 'addr', 'lat']) {
      bad([{ ...ok[0], [key]: 1 }, ...ok.slice(1)], `キー ${key}`);
    }
    bad([mappingEntry({ idx: 1, qid: null, label: null, confidence: 'high' })], 'qid null で high');
    bad([mappingEntry({ idx: 1, qid: 'Q1', confidence: 'none' })], 'Q1 で none');
    bad(
      [mappingEntry({ idx: 1, qid: 'Q7' }), mappingEntry({ idx: 2, qid: 'Q7' })],
      '規則の行の同じ qid'
    );
    bad(
      [mappingEntry({ idx: 1, qid: 'Q7', method: 'ledger' }), mappingEntry({ idx: 2, qid: 'Q7' })],
      '台帳の行と規則の行の同じ qid'
    );
    bad([mappingEntry({ idx: 1, p625: { lat: 34.1234567, lng: 137.9 } })], '小数7桁');
    bad([mappingEntry({ idx: 1, p625: { lat: 10, lng: 137.9 } })], '日本の外');
    bad(
      [mappingEntry({ idx: 1 }), mappingEntry({ idx: 2, name: '寺1' })],
      '名前と都道府県の重なり'
    );
    bad([mappingEntry({ idx: 1 }), mappingEntry({ idx: 1, name: '別' })], 'idx の重なり');
    bad([mappingEntry({ idx: 2 }), mappingEntry({ idx: 1 })], 'idx の順');
    bad([mappingEntry({ idx: 1, basis: '' })], 'basis が空');
    bad([mappingEntry({ idx: 1, basis: 'https://example.org を見た' })], 'basis に http');
    bad([mappingEntry({ idx: 1, basis: '36.564233 で合う' })], 'basis に座標');
    bad([mappingEntry({ idx: 1, candidates: ['Q40', 'Q5'] })], 'candidates の順');
    bad([mappingEntry({ idx: 1, candidates: ['Q100'] })], 'candidates に qid');
    bad([mappingEntry({ idx: 1, method: 'ledger', candidates: ['Q5'] })], '台帳の行の candidates');
    bad([mappingEntry({ idx: 1, p18: ['File:A.jpg'] })], 'p18 に File:');
    bad([mappingEntry({ idx: 1, confidence: 'sure' as never })], '知らない確かさ');
    assertThrows(() => parseMapping({ ...mapping(ok), extra: 1 }));
    assertThrows(() => parseMapping({ ...mapping(ok), issue: 292 }));
  }
);

const PHOTO_FILE = {
  file: 'A b.jpg',
  width: 4000,
  height: 3000,
  mime: 'image/jpeg',
  sha1: '0123456789abcdef0123456789abcdef01234567',
  url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/A_b.jpg',
  descriptionUrl: 'https://commons.wikimedia.org/wiki/File:A_b.jpg',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  artist: 'Foo',
  artistHtml: '<a href="//commons.wikimedia.org/wiki/User:Foo">Foo</a>',
  credit: 'Own work',
  creditHtml: 'Own work',
  attributionRequired: true,
  copyrighted: true,
  restrictions: '',
  usageTerms: 'Creative Commons Attribution-Share Alike 4.0',
};

function photoEntry(over: Partial<PhotoEntry> & { idx: number }): PhotoEntry {
  return {
    name: `寺${over.idx}`,
    prefecture: '静岡県',
    qid: `Q${over.idx}00`,
    linkConfidence: 'high',
    files: [PHOTO_FILE],
    ...over,
  };
}

function photos(entries: unknown[]) {
  return {
    schemaVersion: 1,
    issue: 301,
    note: 'テスト',
    attribution: { commons: 'Wikimedia Commons' },
    entries,
  };
}

Deno.test('AC-9: parsePhotos は正しい写真の候補を通し、対応表と食い違えば止まる', () => {
  const m = parseMapping(mapping(VALID_MAPPING));
  const good = photos([photoEntry({ idx: 4, qid: 'Q400', linkConfidence: 'medium' })]);
  assertEquals(parsePhotos(good, m).entries.length, 1);
  // 台帳の2行が同じ Q-ID（対応表が許す）なら、写真の候補でも許す
  const both = photos([
    photoEntry({ idx: 2, qid: 'Q100', files: [{ ...PHOTO_FILE }] }),
    photoEntry({ idx: 3, qid: 'Q100' }),
  ]);
  const m2 = parseMapping(
    mapping([
      mappingEntry({ idx: 2, qid: 'Q100', method: 'ledger', p18: ['A b.jpg'] }),
      mappingEntry({ idx: 3, qid: 'Q100', method: 'ledger', p18: ['A b.jpg'] }),
    ])
  );
  assertEquals(parsePhotos(both, m2).entries.length, 2);
  // 対応表で low の行・p18 に無いファイル・qid の違い
  assertThrows(() => parsePhotos(photos([photoEntry({ idx: 5, qid: 'Q500' })]), m));
  assertThrows(() =>
    parsePhotos(
      photos([
        photoEntry({
          idx: 4,
          qid: 'Q400',
          linkConfidence: 'medium',
          files: [{ ...PHOTO_FILE, file: 'C.jpg' }],
        }),
      ]),
      m
    )
  );
  assertThrows(() =>
    parsePhotos(photos([photoEntry({ idx: 4, qid: 'Q9', linkConfidence: 'medium' })]), m)
  );
});

Deno.test('AC-9: parsePhotos は決めたキー以外・重なり・順・空のファイルで止まる', () => {
  const bad = (entries: unknown[], what: string) =>
    assertThrows(() => parsePhotos(photos(entries)), Error, undefined, what);
  assertEquals(
    parsePhotos(photos([photoEntry({ idx: 1 }), photoEntry({ idx: 2 })])).entries.length,
    2
  );
  for (const key of ['osm', 'gsi', 'addr', 'lat']) {
    bad([{ ...photoEntry({ idx: 1 }), [key]: 1 }], `行のキー ${key}`);
    bad(
      [photoEntry({ idx: 1, files: [{ ...PHOTO_FILE, [key]: 1 } as never] })],
      `ファイルのキー ${key}`
    );
  }
  bad([photoEntry({ idx: 1, qid: 'Q7' }), photoEntry({ idx: 2, qid: 'Q7' })], '同じ qid');
  bad([photoEntry({ idx: 1 }), photoEntry({ idx: 2, name: '寺1' })], '名前と都道府県の重なり');
  bad([photoEntry({ idx: 2 }), photoEntry({ idx: 1 })], 'idx の順');
  bad([photoEntry({ idx: 1, files: [] })], 'ファイルが空');
  bad([photoEntry({ idx: 1, linkConfidence: 'low' as never })], 'low');
  bad([photoEntry({ idx: 1, qid: null as never })], 'qid null');
  bad(
    [photoEntry({ idx: 1, files: [{ ...PHOTO_FILE, url: 'https://example.org/a.jpg' }] })],
    'url'
  );
  bad(
    [photoEntry({ idx: 1, files: [{ ...PHOTO_FILE, attributionRequired: 'true' as never }] })],
    '真偽'
  );
});

Deno.test('serializeJson は2字下げと改行1つ', () => {
  assertEquals(serializeJson({ a: [1] }), '{\n  "a": [\n    1\n  ]\n}\n');
});

// --- AC-10: validateExport ---

interface ExportItemInput {
  idx: number;
  choice: string;
  to?: LatLng;
  ref?: string | null;
  note?: string;
  over?: Record<string, unknown>;
}

function exportOf(rows: SeedRow[], inputs: ExportItemInput[]) {
  const items = inputs.map(i => {
    const r = rows[i.idx - 1];
    const to = i.to ?? { lat: r.lat, lng: r.lng };
    return {
      idx: r.idx,
      name: r.name,
      prefecture: r.prefecture,
      file: r.file,
      line: r.line,
      verdict: 'owner',
      seed: { lat: r.lat, lng: r.lng },
      choice: i.choice,
      lat: to.lat,
      lng: to.lng,
      ref: i.ref ?? null,
      note: i.note ?? '',
      chosen_at: '2026-10-03T00:00:00.000Z',
      ...i.over,
    };
  });
  return {
    issue: 292,
    from: 'spot-wikidata review (#301)',
    exported_at: '2026-10-03T00:00:00.000Z',
    count: items.length,
    items,
  };
}

async function exportFixtures() {
  const rows = await realSeedRows();
  const ledger = await realLedger();
  const inLedger = new Set(ledger.entries.map(e => e.idx));
  const free = rows.filter(r => !inLedger.has(r.idx));
  return { rows, ledger, free };
}

Deno.test(
  'AC-10: 正しい書き出しは通り、spot-coords の ownerItemToEntry と mergeEntries も通る',
  async () => {
    const { rows, ledger, free } = await exportFixtures();
    const [a, b, c, d] = free;
    const json = exportOf(rows, [
      { idx: a.idx, choice: 'wd', to: north(a, 500), ref: 'Q123' },
      { idx: b.idx, choice: 'osm', to: north(b, 800), ref: 'way/456' },
      { idx: c.idx, choice: 'custom', to: east(c, 30), note: '鳥居の前' },
      { idx: d.idx, choice: 'seed' },
    ]);
    const out = validateExport(json, rows, ledger);
    assertEquals(out.items.length, 4);
    assertEquals(out.entries.length, 3);
    const entries = json.items
      .map(i => ownerItemToEntry(i, 2))
      .filter((e): e is NonNullable<typeof e> => e !== null);
    assertEquals(mergeEntries(ledger, entries).entries.length, 461);
    // JSON の文字でもよい
    assertEquals(validateExport(JSON.stringify(json), rows, ledger).items.length, 4);
  }
);

Deno.test('AC-10: 書き出しの検査は、その寺社の名前を含む文で止まる', async () => {
  const { rows, ledger, free } = await exportFixtures();
  const a = free[0];
  const who = a.name;
  const bad = (inputs: ExportItemInput[], what: string, name = who) => {
    const e = assertThrows(
      () => validateExport(exportOf(rows, inputs), rows, ledger),
      Error,
      undefined,
      what
    );
    assertStringIncludes(e.message, name, what);
  };
  bad([{ idx: a.idx, choice: 'gsi', to: north(a, 500) }], 'gsi');
  bad([{ idx: a.idx, choice: 'nope', to: north(a, 500) }], '知らない choice');
  bad([{ idx: a.idx, choice: 'custom', to: north(a, 9) }], '9m');
  bad([{ idx: a.idx, choice: 'custom', to: north(a, 100_100) }], '100.1km');
  bad([{ idx: a.idx, choice: 'custom', to: { lat: 10, lng: 137 } }], '日本の外');
  bad([{ idx: 391, choice: 'custom', to: north(rows[390], 500) }], '台帳にある', '尊永寺');
  bad(
    [{ idx: a.idx, choice: 'custom', to: north(a, 500), over: { name: '別の寺' } }],
    '名前が合わない',
    '別の寺'
  );
  bad(
    [
      {
        idx: a.idx,
        choice: 'custom',
        to: north(a, 500),
        over: { seed: { lat: a.lat + 0.001, lng: a.lng } },
      },
    ],
    'seed の座標'
  );
  bad([{ idx: a.idx, choice: 'custom', to: north(a, 500), over: { line: a.line + 1 } }], '行');
  bad([{ idx: a.idx, choice: 'wd', to: north(a, 500), ref: 'node/1' }], 'wd の ref');
  bad([{ idx: a.idx, choice: 'osm', to: north(a, 500), ref: 'Q1' }], 'osm の ref');
  bad([{ idx: a.idx, choice: 'custom', to: north(a, 500), ref: 'Q1' }], 'custom の ref');
  bad(
    [{ idx: a.idx, choice: 'custom', to: north(a, 500), note: '連絡は a@example.com まで' }],
    'メール'
  );
  bad([{ idx: a.idx, choice: 'custom', to: north(a, 500), note: 'あ'.repeat(201) }], '201 文字');
  bad(
    [
      { idx: a.idx, choice: 'custom', to: north(a, 500) },
      { idx: a.idx, choice: 'seed' },
    ],
    'idx の重なり'
  );
  validateExport(
    exportOf(rows, [{ idx: a.idx, choice: 'custom', to: north(a, 500), note: 'あ'.repeat(200) }]),
    rows,
    ledger
  );
});

Deno.test('AC-10: 台帳の OSM 由来 55 件に osm を 45 件足すと止まり、44 件なら通る', async () => {
  const { rows, ledger, free } = await exportFixtures();
  const osm = (n: number) =>
    exportOf(
      rows,
      free
        .slice(0, n)
        .map((r, i) => ({ idx: r.idx, choice: 'osm', to: north(r, 500), ref: `node/${i + 1}` }))
    );
  assertEquals(validateExport(osm(44), rows, ledger).entries.length, 44);
  const e = assertThrows(() => validateExport(osm(45), rows, ledger), Error);
  assertStringIncludes(e.message, '99');
  assertStringIncludes(e.message, free[44].name);
});
