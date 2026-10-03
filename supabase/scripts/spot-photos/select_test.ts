// Deno テスト（候補の規則・台帳の形の純関数。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-302-spot-photo-band.md（S2 / AC-7〜AC-10）
import { assert, assertEquals, assertStringIncludes, assertThrows } from 'jsr:@std/assert@1';

import {
  type PhotoFile,
  type Photos,
  parsePhotos,
  type SeedRow,
  serializeJson,
} from '../spot-wikidata/match.ts';
import {
  fixtureLedgerJson,
  fixturePhotos,
  readFixture,
  readRepo,
  realMapping,
  realSeedRows,
} from './fixtures/load.ts';
import {
  buildCandidates,
  CHECK_SQL_PATH,
  COMMONS_INTERVAL_MS,
  commonsThumbUrl,
  LEDGER_PATH,
  MIGRATION_PATH,
  parseLedger302,
  PHOTO_MIN_WIDTH,
  PHOTO_STORE_WIDTH,
  R2_PREFIX,
  r2KeyOf,
  screenFile,
} from './select.ts';

/** フィクスチャの寺社の1つ目（またはファイル名の）ファイル */
function fileOf(photos: Photos, name: string, file?: string): PhotoFile {
  const e = photos.entries.find(x => x.name === name);
  if (!e) throw new Error(`フィクスチャに ${name} が無い`);
  return file ? e.files.find(f => f.file === file)! : e.files[0];
}

/** ホームのパスの頭（文字のまま書くと、Q-14 の grep に当たる） */
const HOME_DIRS = ['', 'Users', ''].join('/');

// --- 定数 ---

Deno.test('定数は契約書の表の値', () => {
  assertEquals(PHOTO_MIN_WIDTH, 1280);
  assertEquals(PHOTO_STORE_WIDTH, 1280);
  assertEquals(R2_PREFIX, 'spot-photos/');
  assertEquals(COMMONS_INTERVAL_MS, 1000);
  assertEquals(LEDGER_PATH, 'supabase/data/spot-photos-302.json');
  assertEquals(MIGRATION_PATH, 'supabase/migrations/20261004010000_spot_photos_302_batch1.sql');
  assertEquals(CHECK_SQL_PATH, 'supabase/validation/spot_photos_302_check.sql');
});

// --- AC-7: 候補の規則 ---

Deno.test(
  'AC-7: screenFile は 縦長・正方形・幅 1279・GFDL・personality・SVG・撮影者なしの CC を外す',
  async () => {
    const p = await fixturePhotos();
    const portrait = fileOf(p, '戸越八幡神社');
    assertEquals([portrait.width, portrait.height], [1555, 2074]);
    const square = fileOf(p, '崇福寺');
    assertEquals(square.width, square.height);
    const narrow = { ...fileOf(p, '井戸寺'), width: 1279 };
    const gfdl = fileOf(p, '大山阿夫利神社', 'Ooyama afurijinjya.jpg');
    assertEquals(gfdl.license, 'GFDL');
    const personality = fileOf(p, '事任八幡宮');
    assertEquals(personality.restrictions, 'personality');
    const svg = fileOf(p, '亀岡八幡宮');
    assertEquals(svg.mime, 'image/svg+xml');
    const noArtist = fileOf(p, '愛宕神社');
    assertEquals(
      [noArtist.artist, noArtist.attributionRequired, noArtist.license],
      [null, true, 'CC BY-SA 3.0']
    );
    for (const f of [portrait, square, narrow, gfdl, personality, svg, noArtist]) {
      assertEquals(screenFile(f), false, f.file);
    }
    // 撮影者が空の文字でも同じ。ライセンスの無いファイルも外す（表の license は NOT NULL）
    assertEquals(
      screenFile({ ...fileOf(p, '金蛇水神社'), artist: '', attributionRequired: true }),
      false
    );
    assertEquals(screenFile({ ...fileOf(p, '金蛇水神社'), license: null }), false);
  }
);

Deno.test(
  'AC-7: 幅 1280 の横長の CC BY-SA 4.0・撮影者なしの PD・PNG・高さ ÷ 幅 0.45 を通す',
  async () => {
    const p = await fixturePhotos();
    const wide1280 = {
      ...fileOf(p, '井戸寺'),
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    };
    assertEquals(wide1280.width, 1280);
    const pd = fileOf(p, '輪王寺');
    assertEquals([pd.artist, pd.attributionRequired, pd.license], [null, false, 'Public domain']);
    const png = fileOf(p, '新潟縣護國神社');
    assertEquals(png.mime, 'image/png');
    const veryWide = fileOf(p, '中禅寺（立木観音）');
    assertEquals(Math.round((veryWide.height / veryWide.width) * 100) / 100, 0.45);
    for (const f of [wide1280, pd, png, veryWide, fileOf(p, '金蛇水神社')]) {
      assertEquals(screenFile(f), true, f.file);
    }
  }
);

// --- AC-8: 本物のデータの候補 ---

Deno.test('AC-8: 本物の #301 から 733 寺社・755 ファイル（high 707・medium 26）', async () => {
  const photos = parsePhotos(
    await readRepo('supabase/data/spot-photos-301.json'),
    await realMapping()
  );
  const c = buildCandidates(photos, await realMapping(), await realSeedRows());
  assertEquals(c.entries.length, 733);
  assertEquals(
    c.entries.reduce((n, e) => n + e.files.length, 0),
    755
  );
  assertEquals(c.counts, { spots: 733, files: 755, high: 707, medium: 26 });
  assertEquals(c.entries.filter(e => e.linkConfidence === 'high').length, 707);
  assertEquals(c.entries.filter(e => e.linkConfidence === 'medium').length, 26);
  assertEquals(c.entries.filter(e => e.files.length === 2).length, 16);
  assertEquals(c.entries.filter(e => e.files.length === 3).length, 3);

  const rinnoji = c.entries.find(e => e.name === '輪王寺' && e.prefecture === '栃木県')!;
  assert(
    rinnoji.files.some(
      f => f.author === null && f.license === 'Public domain' && f.licenseUrl === null
    )
  );
  assertEquals(
    c.entries.find(e => e.name === '戸越八幡神社' && e.prefecture === '東京都'),
    undefined
  );
  for (const e of c.entries) {
    assert(e.address.length > 0, `${e.name} の住所`);
    assert(/^Q\d+$/.test(e.qid), `${e.name} の qid`);
    assert(e.label === null || e.label.length > 0, `${e.name} のラベル`);
  }
  // 寺社は idx の順
  assertEquals(
    c.entries.map(e => e.idx),
    [...c.entries.map(e => e.idx)].sort((a, b) => a - b)
  );
});

Deno.test('AC-8: フィクスチャの候補は 15 寺社・18 ファイル。カードに要る値を持つ', async () => {
  const c = buildCandidates(await fixturePhotos(), await realMapping(), await realSeedRows());
  assertEquals(c.counts, { spots: 15, files: 18, high: 14, medium: 1 });
  const k = c.entries.find(e => e.name === '金蛇水神社')!;
  assertEquals(k, {
    idx: 1028,
    name: '金蛇水神社',
    prefecture: '宮城県',
    address: k.address,
    qid: k.qid,
    label: k.label,
    linkConfidence: 'high',
    files: [
      {
        file: 'Haiden of Kanahebi-Suijinja shrine 1.JPG',
        sha1: 'ecabf0cb9c1192910b283e495515489c8343d403',
        mime: 'image/jpeg',
        width: 4032,
        height: 3024,
        thumbUrl:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Haiden_of_Kanahebi-Suijinja_shrine_1.JPG/1280px-Haiden_of_Kanahebi-Suijinja_shrine_1.JPG',
        author: 'Bachstelze',
        license: 'CC BY-SA 3.0',
        licenseUrl: k.files[0].licenseUrl,
        sourceUrl:
          'https://commons.wikimedia.org/wiki/File:Haiden_of_Kanahebi-Suijinja_shrine_1.JPG',
      },
    ],
  });
  assertStringIncludes(k.address, '宮城県');
  // 大山阿夫利神社は GFDL のファイルだけが外れる
  assertEquals(
    c.entries.find(e => e.name === '大山阿夫利神社')!.files.map(f => f.license),
    ['CC BY-SA 3.0']
  );
  // 幅がちょうど 1280 の写真は縮小版を作れないので元のファイル
  const hokkaido = c.entries.find(e => e.name === '北海道神宮')!.files[0];
  assertEquals(hokkaido.width, 1280);
  assertEquals(
    hokkaido.thumbUrl,
    'https://upload.wikimedia.org/wikipedia/commons/a/a9/Hokkaido_Jingu.JPG'
  );
});

Deno.test('AC-8: seed に無い idx・名前の違う行があると、寺社の名前で止める', async () => {
  const photos = await fixturePhotos();
  const rows = await realSeedRows();
  const mapping = await realMapping();
  const renamed = rows.map(r => (r.idx === 1028 ? { ...r, name: '別の神社' } : r));
  assertThrows(() => buildCandidates(photos, mapping, renamed), Error, '金蛇水神社');
  assertThrows(
    () =>
      buildCandidates(
        photos,
        mapping,
        rows.filter(r => r.idx !== 1028)
      ),
    Error,
    '金蛇水神社'
  );
});

// --- AC-9: 縮小版の URL・R2 のキー ---

Deno.test(
  'AC-9: commonsThumbUrl は thumb/ を挟み、名前の前に 1280px- を付ける（%2C はそのまま）',
  () => {
    assertEquals(
      commonsThumbUrl(
        'https://upload.wikimedia.org/wikipedia/commons/f/f3/Haiden_of_Kanahebi-Suijinja_shrine_1.JPG',
        1280
      ),
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Haiden_of_Kanahebi-Suijinja_shrine_1.JPG/1280px-Haiden_of_Kanahebi-Suijinja_shrine_1.JPG'
    );
    const name = 'Phoenix_Hall%2C_Byodo-in%2C_November_2016_-01.jpg';
    const thumb = commonsThumbUrl(
      `https://upload.wikimedia.org/wikipedia/commons/6/69/${name}`,
      1280
    );
    assertEquals(
      thumb,
      `https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/${name}/1280px-${name}`
    );
    assertEquals(thumb.split('%2C').length - 1, 4);
    assertThrows(() => commonsThumbUrl('https://example.com/a.jpg', 1280));
  }
);

Deno.test('AC-9: r2KeyOf は spot-photos/<sha1>.jpg、PNG は .png', () => {
  const sha1 = 'ecabf0cb9c1192910b283e495515489c8343d403';
  assertEquals(r2KeyOf({ sha1, mime: 'image/jpeg' }), `spot-photos/${sha1}.jpg`);
  assertEquals(r2KeyOf({ sha1, mime: 'image/png' }), `spot-photos/${sha1}.png`);
});

// --- AC-10: 台帳の検査 ---

const fixtureLedger = fixtureLedgerJson;

Deno.test('AC-10: 正しい台帳は通り、3 行を (batch, idx) の順に返す', async () => {
  const ledger = parseLedger302(await fixtureLedger(), await fixturePhotos(), await realSeedRows());
  assertEquals(
    ledger.entries.map(e => [e.idx, e.name, e.focusY]),
    [
      [4, '北海道神宮頓宮', 0.4],
      [144, '輪王寺', 0.55],
      [1028, '金蛇水神社', 0.5],
    ]
  );
  // 文字でも読める
  const again = parseLedger302(
    await readFixture('ledger-302.json'),
    await fixturePhotos(),
    await realSeedRows()
  );
  assertEquals(again, ledger);
  const text = serializeJson(ledger);
  assertEquals(text.match(/\d{4}-\d{2}-\d{2}T/), null);
  assertEquals(text.includes(HOME_DIRS), false);
  assertEquals(text.includes('goshuin-work'), false);
});

type Ledger = Awaited<ReturnType<typeof fixtureLedger>>;

/** フィクスチャの #301 の寺社の1つ目のファイルから、台帳の1行を作る（値は #301 のまま） */
function ledgerEntry(name: string, focusY = 0.5): Record<string, unknown> {
  const e = fixtures.photos!.entries.find(x => x.name === name)!;
  const f = e.files[0];
  return {
    batch: 1,
    idx: e.idx,
    name: e.name,
    prefecture: e.prefecture,
    qid: e.qid,
    linkConfidence: e.linkConfidence,
    linkChecked: e.linkConfidence === 'medium',
    file: f.file,
    sha1: f.sha1,
    r2Key: r2KeyOf(f),
    width: f.width,
    height: f.height,
    focusY,
    author: f.artist,
    license: f.license,
    licenseUrl: f.licenseUrl,
    sourceUrl: f.descriptionUrl,
    isCropped: true,
    status: 'approved',
  };
}

const BAD: [string, string, (l: Ledger) => void][] = [
  ['reviewer のキーがある', '金蛇水神社', l => (l.entries[2].reviewer = 'someone')],
  ['decided_at のキーがある', '輪王寺', l => (l.entries[1].decided_at = '2026-10-04T00:00:00Z')],
  ['author が #301 と1字違う', '金蛇水神社', l => (l.entries[2].author = 'Bachstelzf')],
  ['sha1 が #301 と違う', '金蛇水神社', l => (l.entries[2].sha1 = 'f'.repeat(40))],
  [
    'r2Key の拡張子が mime と合わない',
    '金蛇水神社',
    l => (l.entries[2].r2Key = String(l.entries[2].r2Key).replace('.jpg', '.png')),
  ],
  ['focusY が 0.123', '輪王寺', l => (l.entries[1].focusY = 0.123)],
  ['focusY が 1.2', '輪王寺', l => (l.entries[1].focusY = 1.2)],
  ['medium で linkChecked が false', '北海道神宮頓宮', l => (l.entries[0].linkChecked = false)],
  [
    '同じ sha1 の2行（中尊寺と中尊寺金色堂）',
    '中尊寺金色堂',
    l => l.entries.splice(1, 0, ledgerEntry('中尊寺'), ledgerEntry('中尊寺金色堂')),
  ],
  ['同じ idx の2行', '金蛇水神社', l => l.entries.push({ ...l.entries[2] })],
  ['idx の seed の名前が違う', '金蛇水神社', l => (l.entries[2].idx = 1027)],
  ['(batch, idx) の順でない', '輪王寺', l => l.entries.reverse()],
  ['width が #301 と違う', '金蛇水神社', l => (l.entries[2].width = 4000)],
  ['licenseUrl が #301 と違う', '金蛇水神社', l => (l.entries[2].licenseUrl = null)],
  [
    'sourceUrl が #301 と違う',
    '金蛇水神社',
    l => (l.entries[2].sourceUrl = 'https://commons.wikimedia.org/wiki/File:X.jpg'),
  ],
  ['status が知らない値', '金蛇水神社', l => (l.entries[2].status = 'hidden')],
];

for (const [why, who, mutate] of BAD) {
  Deno.test(`AC-10: ${why} なら、寺社の名前で止める`, async () => {
    const l = await fixtureLedger();
    mutate(l);
    assertThrows(() => parseLedger302(l, fixtures.photos!, fixtures.rows!), Error, who);
  });
}

Deno.test('AC-10: screenFile を通らないファイル（縦長）なら、寺社の名前で止める', async () => {
  const l = await fixtureLedger();
  l.entries.push(ledgerEntry('戸越八幡神社'));
  l.entries.sort((a, b) => Number(a.idx) - Number(b.idx));
  assertThrows(() => parseLedger302(l, fixtures.photos!, fixtures.rows!), Error, '戸越八幡神社');
});

Deno.test('AC-10: 台帳の上のキーが違う・entries が無いと止める', async () => {
  const l = await fixtureLedger();
  assertThrows(() => parseLedger302({ ...l, extra: 1 }, fixtures.photos!, fixtures.rows!));
  assertThrows(() => parseLedger302({ ...l, issue: 301 }, fixtures.photos!, fixtures.rows!));
  assertThrows(() => parseLedger302({ ...l, entries: null }, fixtures.photos!, fixtures.rows!));
});

/** 何度も読むので1回だけ読む */
const fixtures: { photos?: Photos; rows?: SeedRow[] } = {};
fixtures.photos = await fixturePhotos();
fixtures.rows = await realSeedRows();
