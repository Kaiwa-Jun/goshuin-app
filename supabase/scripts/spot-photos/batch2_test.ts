// Deno テスト（帯の写真の第2弾 #320 の純関数。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-320-spot-photos-batch2.md（S1 / AC-1〜AC-3、S2 / AC-6・AC-7）
import { assert, assertEquals, assertStringIncludes, assertThrows } from 'jsr:@std/assert@1';

import { distanceMeters } from '../spot-coords/coords.ts';
import {
  type Mapping,
  parseEntity,
  type PhotoFile,
  type SeedRow,
  serializeJson,
  type WdItem,
} from '../spot-wikidata/match.ts';
import {
  basisText,
  BATCH2_DIR,
  buildPool320,
  checkPoolTargets,
  type Gathered320,
  GRID_THUMB_WIDTH,
  LIST_LIMIT,
  MANUAL_MAX_DISTANCE_M,
  MANUAL_PATH,
  manualLinkOf,
  parseManual320,
  parsePool320,
  POOL_MAX_FILES,
  POOL_PATH,
  TARGET_RANK,
  targets320,
} from './batch2.ts';
import {
  fixtureGathered,
  fixtureManualJson,
  fixturePhotos,
  fixturePoolCtx,
  fixturePoolJson,
  fixtureSpots,
  fixtureWdEntity,
  readFixture,
  readRepo,
  realMapping,
  realSeedRows,
} from './fixtures/load.ts';
import { LEDGER_PATH, screenFile } from './select.ts';

/** ホームのパスの頭（文字のまま書くと、Q-8 の grep に当たる） */
const HOME_DIRS = ['', 'Users', ''].join('/');

/** 何度も読むので1回だけ読む */
const real: {
  rows: SeedRow[];
  mapping: Mapping;
  ledger: { entries: { batch: number; idx: number }[] };
} = {
  rows: await realSeedRows(),
  mapping: await realMapping(),
  // 台帳は batch と idx だけを見る（第2弾の行があっても読める）
  ledger: JSON.parse(await readRepo(LEDGER_PATH)),
};
const targets = targets320(real.rows, real.ledger);
const ctx = { targets, mapping: real.mapping };

function rowOf(name: string, prefecture: string): SeedRow {
  const r = real.rows.find(x => x.name === name && x.prefecture === prefecture);
  if (!r) throw new Error(`seed に ${name}（${prefecture}）が無い`);
  return r;
}

async function wdItem(qid: string): Promise<WdItem> {
  return parseEntity(await fixtureWdEntity(qid));
}

// --- 定数 ---

Deno.test('定数は契約書の表の値', () => {
  assertEquals(TARGET_RANK, 5);
  assertEquals(MANUAL_MAX_DISTANCE_M, 3000);
  assertEquals(POOL_MAX_FILES, 30);
  assertEquals(LIST_LIMIT, 500);
  assertEquals(GRID_THUMB_WIDTH, 250);
  assertEquals(BATCH2_DIR, 'b2');
  assertEquals(MANUAL_PATH, 'supabase/data/spot-wikidata-manual-320.json');
  assertEquals(POOL_PATH, 'supabase/data/spot-photos-320.json');
});

// --- AC-1: 対象 ---

Deno.test(
  'AC-1: targets320 は rank 5 で台帳に第1弾の行が無い 150 寺社を idx の順で返す（本物のデータ）',
  () => {
    assertEquals(targets.length, 150);
    assertEquals(
      targets.map(t => t.idx),
      [...targets.map(t => t.idx)].sort((a, b) => a - b)
    );
    const batch1 = new Set(real.ledger.entries.filter(e => e.batch === 1).map(e => e.idx));
    assert(targets.every(t => t.rank === 5 && !batch1.has(t.idx)));
    const conf = new Map(real.mapping.entries.map(m => [m.idx, m.confidence]));
    const count = (c: string) => targets.filter(t => conf.get(t.idx) === c).length;
    assertEquals([count('high'), count('medium'), count('none'), count('low')], [92, 8, 46, 4]);
    const has = (name: string, prefecture: string) =>
      targets.some(t => t.name === name && t.prefecture === prefecture);
    assert(has('増上寺', '東京都'));
    assert(has('浅草寺', '東京都'));
    assert(has('伊勢神宮内宮（皇大神宮）', '三重県'));
    assertEquals(has('金蛇水神社', '宮城県'), false);
  }
);

Deno.test('AC-1: 台帳に第2弾の行を足しても、返す 150 は同じ（第1弾の行だけを見る）', () => {
  const zojoji = rowOf('増上寺', '東京都');
  const more = { entries: [...real.ledger.entries, { batch: 2, idx: zojoji.idx }] };
  assertEquals(targets320(real.rows, more), targets);
});

// --- AC-2: 手で結ぶ規則 ---

/** seed の真北に meters だけ離した P625（偽の項目を作るとき） */
function northOf(row: SeedRow, meters: number): { lat: number; lng: number } {
  return { lat: row.lat + meters / ((6_371_000 * Math.PI) / 180), lng: row.lng };
}

function item(over: Partial<WdItem>): WdItem {
  return {
    qid: 'Q999999999',
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

Deno.test('AC-2: 伊勢神宮内宮（皇大神宮）× ラベル「皇大神宮」の項目は exact で結べる', async () => {
  const row = rowOf('伊勢神宮内宮（皇大神宮）', '三重県');
  const it = await wdItem('Q11581011');
  const r = manualLinkOf(row, it, ctx);
  assert(r.ok, r.ok ? '' : r.reason);
  const d = distanceMeters({ lat: row.lat, lng: row.lng }, it.p625!);
  assertEquals(r.entry, {
    idx: row.idx,
    name: '伊勢神宮内宮（皇大神宮）',
    prefecture: '三重県',
    qid: 'Q11581011',
    label: '皇大神宮',
    matchedName: '皇大神宮',
    nameLevel: 'exact',
    p625: it.p625!,
    distanceKm: Math.round(d / 100) / 10,
    p18: it.p18,
    p373: 'Naiku',
    basis: 'ラベル「皇大神宮」が seed の名前と同じ。P625 は seed から 0.5 km',
  });
});

Deno.test(
  'AC-2: 戸隠神社中社 × ラベル「戸隠神社」は partial で結べる（奥社も同じ項目で）',
  async () => {
    const it = await wdItem('Q135464157');
    for (const name of ['戸隠神社中社', '戸隠神社奥社']) {
      const row = rowOf(name, '長野県');
      const r = manualLinkOf(row, it, ctx);
      assert(r.ok, r.ok ? '' : r.reason);
      assertEquals([r.entry.matchedName, r.entry.nameLevel], ['戸隠神社', 'partial']);
      const km = Math.round(distanceMeters({ lat: row.lat, lng: row.lng }, it.p625!) / 100) / 10;
      assertEquals(r.entry.distanceKm, km);
      assertEquals(
        r.entry.basis,
        `ラベル「戸隠神社」が seed の名前と一部が同じ。P625 は seed から ${km.toFixed(1)} km`
      );
    }
  }
);

Deno.test('AC-2: P625 が seed から 2,999m なら結べ、3,001m なら 3 km を理由に結べない', () => {
  const row = rowOf('戸隠神社中社', '長野県');
  const near = northOf(row, 2999);
  const far = northOf(row, 3001);
  assert(Math.abs(distanceMeters({ lat: row.lat, lng: row.lng }, near) - 2999) < 0.01);
  assert(Math.abs(distanceMeters({ lat: row.lat, lng: row.lng }, far) - 3001) < 0.01);
  const ok = manualLinkOf(row, item({ label: '戸隠神社', p625: near }), ctx);
  assert(ok.ok);
  assertEquals(ok.entry.distanceKm, 3);
  assertEquals(
    ok.entry.basis,
    'ラベル「戸隠神社」が seed の名前と一部が同じ。P625 は seed から 3.0 km'
  );
  const ng = manualLinkOf(row, item({ label: '戸隠神社', p625: far }), ctx);
  assert(!ng.ok);
  assertStringIncludes(ng.reason, '3 km');
});

Deno.test('AC-2: 結べない理由（P625・名前・ほかの寺社の項目・対象・対応表）', () => {
  const togakushi = rowOf('戸隠神社中社', '長野県');
  const at = northOf(togakushi, 100);
  const reason = (row: SeedRow, it: WdItem | null) => {
    const r = manualLinkOf(row, it, ctx);
    assert(!r.ok, `${row.name} が結べてしまう`);
    return r.reason;
  };
  assertEquals(reason(togakushi, item({ label: '戸隠神社' })), 'P625 が無い');
  assertEquals(
    reason(togakushi, item({ label: '別の神社', aliases: ['ほかの寺'], p625: at })),
    '名前が合わない'
  );
  assertEquals(reason(togakushi, null), 'Wikidata に項目が無い');
  // 対応表で high の別の寺社（増上寺）の項目
  const zojojiQid = real.mapping.entries.find(m => m.name === '増上寺')!.qid!;
  const same = reason(togakushi, item({ qid: zojojiQid, label: '戸隠神社', p625: at }));
  assertStringIncludes(same, 'の対応表の項目と同じ');
  assertStringIncludes(same, '増上寺（東京都）');
  // rank 4 の寺社・台帳に第1弾の行のある寺社
  const konjikido = rowOf('中尊寺金色堂', '岩手県');
  assertEquals(konjikido.rank, 4);
  assertEquals(reason(konjikido, item({ label: '中尊寺金色堂', p625: konjikido })), '対象でない');
  const kanahebi = rowOf('金蛇水神社', '宮城県');
  assertEquals(reason(kanahebi, item({ label: '金蛇水神社', p625: kanahebi })), '対象でない');
  // 対応表で high の寺社
  const zojoji = rowOf('増上寺', '東京都');
  assertStringIncludes(
    reason(zojoji, item({ label: '増上寺', p625: zojoji })),
    '対応表で結べている'
  );
});

Deno.test('AC-2: ラベルが合わず別名が合えば、別名で結ぶ（ラベルを先に・別名は項目の順）', () => {
  const row = rowOf('伊勢神宮内宮（皇大神宮）', '三重県');
  const it = item({
    label: '内宮',
    aliases: ['皇大神宮の森', '伊勢神宮内宮', '皇大神宮'],
    p625: northOf(row, 1234),
  });
  const r = manualLinkOf(row, it, ctx);
  assert(r.ok);
  assertEquals([r.entry.matchedName, r.entry.nameLevel], ['伊勢神宮内宮', 'exact']);
  assertEquals(r.entry.basis, '別名「伊勢神宮内宮」が seed の名前と同じ。P625 は seed から 1.2 km');
  assertEquals(basisText(r.entry), r.entry.basis);
});

// --- AC-3: 手で結ぶ台帳の検査 ---

type ManualJson = Awaited<ReturnType<typeof fixtureManualJson>>;

Deno.test('AC-3: フィクスチャの手で結ぶ台帳は通る（同じ Q-ID の2寺社を含む）', async () => {
  const m = parseManual320(await fixtureManualJson(), real.rows, real.mapping, targets);
  assertEquals(
    m.entries.map(e => [e.name, e.qid, e.nameLevel]),
    [
      ['戸隠神社中社', 'Q135464157', 'partial'],
      ['戸隠神社奥社', 'Q135464157', 'partial'],
      ['伊勢神宮内宮（皇大神宮）', 'Q11581011', 'exact'],
    ]
  );
  const text = serializeJson(m);
  assertEquals(text.match(/\d{4}-\d{2}-\d{2}T/), null);
  assertEquals(text.includes(HOME_DIRS), false);
  assertEquals(text.includes('goshuin-work'), false);
});

Deno.test(
  'AC-3: フィクスチャの手で結ぶ台帳は、wd/ の項目から manualLinkOf で作るものと同じ',
  async () => {
    const m = await fixtureManualJson();
    const items = new Map([
      ['Q11581011', await wdItem('Q11581011')],
      ['Q135464157', await wdItem('Q135464157')],
    ]);
    for (const e of m.entries) {
      const r = manualLinkOf(real.rows.find(x => x.idx === e.idx)!, items.get(String(e.qid))!, ctx);
      assert(r.ok);
      assertEquals(r.entry as unknown, e);
    }
  }
);

const zojojiRow = () => rowOf('増上寺', '東京都');

const BAD: [string, string, (m: ManualJson) => void][] = [
  [
    '決めたキーのほか（checkedBy）がある',
    '戸隠神社奥社',
    m => (m.entries[1].checkedBy = 'someone'),
  ],
  [
    'distanceKm を 0.1 ずらす',
    '伊勢神宮内宮（皇大神宮）',
    m => (m.entries[2].distanceKm = Number(m.entries[2].distanceKm) + 0.1),
  ],
  [
    'p625 を 3km より遠くに変える',
    '戸隠神社中社',
    m => (m.entries[0].p625 = { lat: 36.78, lng: 138.085 }),
  ],
  ['nameLevel を変える', '戸隠神社中社', m => (m.entries[0].nameLevel = 'exact')],
  [
    'basis を1字変える',
    '伊勢神宮内宮（皇大神宮）',
    m => (m.entries[2].basis = String(m.entries[2].basis).replace('同じ', '同し')),
  ],
  [
    'basis に https:// を入れる',
    '伊勢神宮内宮（皇大神宮）',
    m => (m.entries[2].basis = `${m.entries[2].basis} https://example.com/`),
  ],
  ['同じ idx の2行', '戸隠神社奥社', m => m.entries.splice(2, 0, { ...m.entries[1] })],
  ['idx の順でない', '戸隠神社奥社', m => m.entries.reverse()],
  ['idx の seed の名前が違う', '戸隠神社中社', m => (m.entries[0].idx = 346)],
  [
    '対応表で high の寺社の行',
    '増上寺（東京都）',
    m =>
      m.entries.push({
        ...m.entries[2],
        idx: zojojiRow().idx,
        name: '増上寺',
        prefecture: '東京都',
      }),
  ],
  [
    'Q-ID が high の行と同じ',
    '伊勢神宮内宮（皇大神宮）',
    m => (m.entries[2].qid = real.mapping.entries.find(x => x.name === '増上寺')!.qid),
  ],
  [
    'matchedName が seed の名前と合わない',
    '戸隠神社中社',
    m => (m.entries[0].matchedName = '善光寺'),
  ],
];

for (const [why, who, mutate] of BAD) {
  Deno.test(`AC-3: ${why} なら、寺社の名前で止める`, async () => {
    const m = await fixtureManualJson();
    mutate(m);
    assertThrows(() => parseManual320(m, real.rows, real.mapping, targets), Error, who);
  });
}

Deno.test('AC-3: 上のキーが違う・entries が無いと止める', async () => {
  const m = await fixtureManualJson();
  const parse = (x: unknown) => parseManual320(x, real.rows, real.mapping, targets);
  assertThrows(() => parse({ ...m, extra: 1 }));
  assertThrows(() => parse({ ...m, issue: 301 }));
  assertThrows(() => parse({ ...m, entries: null }));
  // 文字でも読める
  assertEquals(parse(JSON.stringify(m)), parse(m));
});

// --- AC-6: 候補の絞り方 ---

/** 何度も読むので1回だけ読む */
const pf = {
  spots: await fixtureSpots(),
  gathered: await fixtureGathered(),
  ctx: await fixturePoolCtx(),
  photos: await fixturePhotos(),
};

function gatheredOf(name: string): Gathered320 {
  const s = pf.spots.find(x => x.name === name)!;
  return structuredClone(pf.gathered.get(s.idx)!);
}

function poolEntry(pool: ReturnType<typeof buildPool320>, name: string) {
  return pool.entries.find(e => e.name === name)!;
}

/** フィクスチャの #301 の寺社のファイル（screenFile の確かめに使う） */
function photo301(name: string, file?: string): PhotoFile {
  const e = pf.photos.entries.find(x => x.name === name)!;
  return structuredClone(file ? e.files.find(f => f.file === file)! : e.files[0]);
}

Deno.test(
  'AC-6: buildPool320 はフィクスチャの集めた値から pool-320.json と同じものを作る',
  async () => {
    const pool = buildPool320(pf.spots, pf.gathered, pf.ctx);
    assertEquals(pool as unknown, JSON.parse(await readFixture('pool-320.json')));
    assertEquals(
      pool.entries.map(e => e.idx),
      [9, 41, 347, 348, 421, 544, 890]
    );
  }
);

Deno.test(
  'AC-6: screenFile を通らないファイル・第1弾の行の sha1・その寺社の第1弾の候補だったファイルを外す',
  () => {
    const g = gatheredOf('中尊寺');
    const names = g.files.map(f => f.file);
    // 集めた値には、外すはずのファイルがある
    for (const f of [
      'Togoshi hachiman.JPG', // 縦長
      'Ooyama afurijinjya.jpg', // GFDL
      'Haiden of Kanahebi-Suijinja shrine 1.JPG', // 台帳の第1弾の行（金蛇水神社）の sha1
      '230728 Chusonji Hiraizumi Iwate pref Japan01s3.jpg', // 中尊寺の第1弾の候補
    ]) {
      assert(names.includes(f), f);
    }
    // 幅 1279・personality・SVG・撮影者なしで帰属の要る CC を足す
    const extra = [
      { ...photo301('井戸寺'), file: 'Narrow 1279.jpg', width: 1279, sha1: 'a'.repeat(40) },
      photo301('事任八幡宮'),
      photo301('亀岡八幡宮'),
      photo301('愛宕神社'),
    ];
    for (const f of extra) assertEquals(screenFile(f), false, f.file);
    g.files.push(...extra);
    g.lists.p373.push(...extra.map(f => f.file));
    const gathered = new Map(pf.gathered);
    gathered.set(g.idx, g);
    const pool = buildPool320(pf.spots, gathered, pf.ctx);
    assertEquals(
      poolEntry(pool, '中尊寺').files.map(f => f.file),
      ['Miyajima, daisho-in, 05.jpg', 'Yakushiji Nara06s3s4440.jpg', 'Chuson-ji Noh Stage 03.jpg']
    );
  }
);

Deno.test(
  'AC-6: P373 と P180 の両方で出たファイルは1つで sources が [p373, p180]、手で結んだ寺社の P18 が先頭',
  () => {
    const pool = buildPool320(pf.spots, pf.gathered, pf.ctx);
    const chuson = poolEntry(pool, '中尊寺').files;
    assertEquals(chuson.filter(f => f.file === 'Chuson-ji Noh Stage 03.jpg').length, 1);
    assertEquals(chuson.find(f => f.file === 'Chuson-ji Noh Stage 03.jpg')!.sources, [
      'p373',
      'p180',
    ]);
    assertEquals(chuson.find(f => f.file === 'Miyajima, daisho-in, 05.jpg')!.sources, ['p180']);
    const naiku = poolEntry(pool, '伊勢神宮内宮（皇大神宮）');
    assertEquals(naiku.linkConfidence, 'manual');
    assertEquals(
      naiku.files.map(f => [f.file, f.sources]),
      [
        ['Masumida Shrine Haiden.jpg', ['p373']],
        ['Tsurugaoka Hachimangu 001.jpg', ['p18', 'p373']],
        ['Oarai Isosaki Shrine 04.jpg', ['p180']],
      ]
    );
    // 写すのは決めた値だけ（HTML・クレジットは持たない）
    assertEquals(Object.keys(naiku.files[0]), [
      'file',
      'sources',
      'width',
      'height',
      'mime',
      'sha1',
      'url',
      'descriptionUrl',
      'license',
      'licenseUrl',
      'artist',
      'attributionRequired',
      'restrictions',
    ]);
    // 同じカテゴリを持つ手で結んだ 2 寺社は、同じファイルを持つ
    assertEquals(poolEntry(pool, '戸隠神社中社').files, poolEntry(pool, '戸隠神社奥社').files);
  }
);

Deno.test(
  'AC-6: 通るファイルが 31 ある寺社は width × height の大きい順に 30 で、いちばん小さいものが無い',
  () => {
    const g = gatheredOf('戸隠神社中社');
    const base = g.files[0];
    const many = Array.from({ length: 31 }, (_, i) => ({
      ...base,
      file: `Many ${String(i).padStart(2, '0')}.jpg`,
      sha1: (i + 10).toString(16).padStart(40, 'b'),
      width: 2000 + i * 10,
      height: 1500,
    }));
    // 同じ大きさの2つは、ファイル名の昇順
    many[5] = { ...many[5], file: 'Same B.jpg', width: 3000 };
    many[6] = { ...many[6], file: 'Same A.jpg', width: 3000 };
    g.files = many;
    g.lists = { p373: many.map(f => f.file), p180: [] };
    const gathered = new Map(pf.gathered);
    gathered.set(g.idx, g);
    const files = poolEntry(buildPool320(pf.spots, gathered, pf.ctx), '戸隠神社中社').files;
    assertEquals(files.length, POOL_MAX_FILES);
    assertEquals(
      files.some(f => f.file === 'Many 00.jpg'),
      false
    );
    for (let i = 1; i < files.length; i++) {
      assert(files[i - 1].width * files[i - 1].height >= files[i].width * files[i].height);
    }
    const a = files.findIndex(f => f.file === 'Same A.jpg');
    assertEquals(files[a + 1].file, 'Same B.jpg');
    // フィクスチャでも同じ大きさの2つ（金持神社）はファイル名の昇順
    const kamochi = poolEntry(buildPool320(pf.spots, pf.gathered, pf.ctx), '金持神社').files;
    assertEquals(
      kamochi.map(f => [f.file, f.width * f.height]),
      [
        ['Sakae-no-yashiro.jpeg', 3072 * 2304],
        ['Shibata jinja.jpeg', 3072 * 2304],
      ]
    );
  }
);

Deno.test(
  'AC-6: Q-ID の無い寺社は no-qid、通るファイルが 0 の寺社は no-files。counts は entries から数える',
  () => {
    const pool = buildPool320(pf.spots, pf.gathered, pf.ctx);
    assertEquals(poolEntry(pool, '星置神社'), {
      idx: 9,
      name: '星置神社',
      prefecture: '北海道',
      qid: null,
      linkConfidence: null,
      p373: null,
      gap: 'no-qid',
      truncated: [],
      files: [],
    });
    const zojoji = poolEntry(pool, '増上寺');
    assertEquals([zojoji.gap, zojoji.files, zojoji.truncated], ['no-files', [], ['p373']]);
    assertEquals(pool.counts, {
      targets: 7,
      withFiles: 5,
      noQid: 1,
      noFiles: 1,
      manual: 3,
      files: 14,
      truncated: 1,
    });
  }
);

Deno.test(
  'AC-6: 集めた値が無い・qid / p373 / p18 が今の対応表・手で結ぶ台帳と違うと、寺社の名前と gather を出して止める',
  () => {
    const naiku = pf.spots.find(s => s.name === '伊勢神宮内宮（皇大神宮）')!;
    const none = new Map(pf.gathered);
    none.delete(naiku.idx);
    assertThrows(
      () => buildPool320(pf.spots, none, pf.ctx),
      Error,
      '伊勢神宮内宮（皇大神宮）（三重県）'
    );
    for (const change of [
      (g: Gathered320) => (g.qid = 'Q1'),
      (g: Gathered320) => (g.p373 = 'Ise Grand Shrine'),
      (g: Gathered320) => (g.p18 = []),
    ]) {
      const g = gatheredOf('伊勢神宮内宮（皇大神宮）');
      change(g);
      const gathered = new Map(pf.gathered);
      gathered.set(g.idx, g);
      const e = assertThrows(() => buildPool320(pf.spots, gathered, pf.ctx), Error);
      assertStringIncludes(e.message, '伊勢神宮内宮（皇大神宮）（三重県）');
      assertStringIncludes(e.message, 'gather');
    }
  }
);

// --- AC-7: 候補の検査 ---

type PoolJson = Awaited<ReturnType<typeof fixturePoolJson>>;
type FileJson = Record<string, unknown>;

const filesOf = (p: PoolJson, i: number) => p.entries[i].files as FileJson[];

Deno.test('AC-7: フィクスチャの候補は parsePool320 を通る', async () => {
  const pool = parsePool320(await fixturePoolJson(), pf.ctx);
  assertEquals(pool.entries.length, 7);
  // 文字でも読める
  assertEquals(parsePool320(await readFixture('pool-320.json'), pf.ctx), pool);
  const text = serializeJson(pool);
  assertEquals(text.match(/\d{4}-\d{2}-\d{2}T/), null);
  assertEquals(text.includes(HOME_DIRS), false);
  assertEquals(text.includes('goshuin-work'), false);
  // 座標を持たない（Q-9）
  for (const k of ['lat', 'lng', 'p625']) assertEquals(text.includes(`"${k}"`), false, k);
});

/** 中尊寺（entries[1]）のファイル数を 31 にする（大きい順・名前と sha1 は別々） */
function thirtyOne(p: PoolJson): void {
  const base = filesOf(p, 1)[0];
  p.entries[1].files = Array.from({ length: 31 }, (_, i) => ({
    ...base,
    file: `Many ${String(i).padStart(2, '0')}.jpg`,
    sha1: (i + 10).toString(16).padStart(40, 'c'),
    width: 9000 - i * 10,
  }));
  p.counts.files += 28;
}

const BAD_POOL: [string, string, (p: PoolJson) => void][] = [
  [
    '決めたキーのほか（artistHtml）がある',
    '中尊寺',
    p => (filesOf(p, 1)[0].artistHtml = '<a>x</a>'),
  ],
  ['screenFile を通らないファイル', '中尊寺', p => (filesOf(p, 1)[0].license = 'GFDL')],
  ['31 ファイル', '中尊寺', thirtyOne],
  ['並びが大きい順でない', '中尊寺', p => filesOf(p, 1).reverse()],
  [
    '台帳の第1弾の行の sha1',
    '中尊寺',
    p => (filesOf(p, 1)[2].sha1 = 'ecabf0cb9c1192910b283e495515489c8343d403'),
  ],
  [
    'その寺社の第1弾の候補だったファイル',
    '中尊寺',
    p => (filesOf(p, 1)[2].file = '230728 Chusonji Hiraizumi Iwate pref Japan01s3.jpg'),
  ],
  ['qid が対応表と違う（high の寺社）', '中尊寺', p => (p.entries[1].qid = 'Q1')],
  [
    'linkConfidence が manual で手で結ぶ台帳に行が無い',
    '中尊寺',
    p => (p.entries[1].linkConfidence = 'manual'),
  ],
  [
    '対象でない idx',
    '金蛇水神社',
    p =>
      p.entries.push({
        ...p.entries[6],
        idx: 1028,
        name: '金蛇水神社',
        prefecture: '宮城県',
      }),
  ],
  ["gap: 'no-files' で files がある", '増上寺', p => (p.entries[6].files = [filesOf(p, 1)[0]])],
  ['gap が null で files が空', '金持神社', p => (p.entries[5].files = [])],
  ['idx の順でない', '金持神社', p => p.entries.reverse()],
  ['p373 が対応表と違う', '中尊寺', p => (p.entries[1].p373 = 'Chuson-ji')],
];

for (const [why, who, mutate] of BAD_POOL) {
  Deno.test(`AC-7: ${why} なら、寺社の名前で止める`, async () => {
    const p = await fixturePoolJson();
    mutate(p);
    assertThrows(() => parsePool320(p, pf.ctx), Error, who);
  });
}

Deno.test('AC-7: counts が数え直しと違う・上のキーが違うと止める', async () => {
  const p = await fixturePoolJson();
  p.counts.files += 1;
  assertThrows(() => parsePool320(p, pf.ctx), Error, 'counts');
  const q = await fixturePoolJson();
  assertThrows(() => parsePool320({ ...q, extra: 1 }, pf.ctx));
  assertThrows(() => parsePool320({ ...q, issue: 302 }, pf.ctx));
});

Deno.test(
  'AC-7: checkPoolTargets は、対象が1寺社足りない候補を、足りない寺社の名前で止める',
  async () => {
    const pool = parsePool320(await fixturePoolJson(), pf.ctx);
    const targets = pf.ctx.targets.filter(t => pool.entries.some(e => e.idx === t.idx));
    checkPoolTargets(pool, targets);
    const less = { ...pool, entries: pool.entries.filter(e => e.name !== '金持神社') };
    assertThrows(() => checkPoolTargets(less, targets), Error, '金持神社（鳥取県）');
  }
);
