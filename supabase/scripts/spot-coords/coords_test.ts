// Deno ユニットテスト（寺社の座標の台帳と、そこから作る SQL・seed の書き換え）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-coords/
// 契約書: docs/issues/issue-292-spot-coords.md（S1 / AC-1〜AC-6、S2 / AC-11・AC-13）
import {
  assert,
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertThrows,
} from 'jsr:@std/assert@1';

import {
  buildCheckSql,
  buildMigrationSql,
  coordText,
  countSeedRows,
  distanceMeters,
  type DraftItem,
  draftItemToEntry,
  emptyLedger,
  type Ledger,
  type LedgerEntry,
  MAX_OSM_FEATURES,
  mergeEntries,
  type OwnerItem,
  ownerItemToEntry,
  parseLedger,
  resolveSeedPath,
  rewriteSeed,
  selectFirstBatch,
  serializeLedger,
} from './coords.ts';

// --- フィクスチャ ---

const CHUBU = 'supabase/seeds/03_chubu.sql';
const MIYAGI = 'supabase/seed_miyagi_spots_and_pilgrimages.sql';

function draft(over: Partial<DraftItem>): DraftItem {
  return {
    idx: 391,
    name: '尊永寺',
    prefecture: '静岡県',
    file: CHUBU,
    line: 3,
    prod_match: { name: '尊永寺', prefecture: '静岡県', lat: 34.7669, lng: 137.8116 },
    seed: { lat: 34.7669, lng: 137.8116 },
    decision: 'fix',
    lat: 34.7377871,
    lng: 137.9772304,
    source: 'wikidata',
    confidence: null,
    reason: '前の作業者の直す提案（wikidata+osm+gsi）',
    source_ref: 'Q11555090',
    ...over,
  };
}

function entry(over: Partial<LedgerEntry>): LedgerEntry {
  return {
    batch: 1,
    idx: 391,
    name: '尊永寺',
    prefecture: '静岡県',
    seedFile: CHUBU,
    seedLine: 3,
    old: { lat: 34.7669, lng: 137.8116 },
    new: { lat: 34.737787, lng: 137.97723 },
    source: 'wikidata',
    ref: 'Q11555090',
    confidence: 'high',
    basis: 'テスト',
    ...over,
  };
}

function ledgerOf(entries: LedgerEntry[]): Ledger {
  return { ...emptyLedger(), entries };
}

/** 別々の寺社を n 件（名前・idx・座標が重ならない）。source を変えて使う */
function many(n: number, source: 'wikidata' | 'osm'): LedgerEntry[] {
  return Array.from({ length: n }, (_, i) =>
    entry({
      idx: 1000 + i,
      name: `寺${i}`,
      seedLine: 10 + i * 2,
      source,
      ref: source === 'osm' ? `node/${i + 1}` : `Q${i + 1}`,
    })
  );
}

// 4桁の行（コメントあり）・宮城の6桁の行（コメントなし）・VALUES の最後の行（`)` → コメント → `;`）
const SEED_TEXT = [
  '-- 中部',
  'INSERT INTO spots (name, lat, lng, type, address, prefecture, rank, status) VALUES',
  "('尊永寺', 34.7669, 137.8116, 'temple', '静岡県袋井市豊沢2777', '静岡県', 4, 'active'),",
  '-- 住所確認: ホトカミ ✓, Wikipedia ✓ | 座標: Wikipedia推定 ✓',
  "('秋保神社', 38.218600, 140.710400, 'shrine', '宮城県仙台市太白区秋保町長袋清水久保1', '宮城県', 3, 'active'),",
  "('若狭姫神社', 35.4731, 135.7927, 'shrine', '福井県小浜市遠敷65-41', '福井県', 4, 'active')",
  '-- 住所確認: ホトカミ ✓ | 座標: NAVITIME推定(境内) ✓',
  ';',
  '',
].join('\n');

const SEED_ENTRIES: LedgerEntry[] = [
  entry({}),
  entry({
    idx: 2,
    name: '秋保神社',
    prefecture: '宮城県',
    seedLine: 5,
    old: { lat: 38.2186, lng: 140.7104 },
    new: { lat: 38.263611, lng: 140.659611 },
    ref: 'Q79733806',
  }),
  entry({
    idx: 306,
    name: '若狭姫神社',
    prefecture: '福井県',
    seedLine: 6,
    old: { lat: 35.4731, lng: 135.7927 },
    new: { lat: 35.479058, lng: 135.780525 },
    source: 'osm',
    ref: 'way/799099092',
  }),
];

// --- AC-1: selectFirstBatch ---

Deno.test(
  'AC-1: 第1弾に選ばれるのは fix の wikidata/osm と、check_decided の 高 の wd/osm/wdc/osmc だけ',
  () => {
    const pick = (decision: string, confidence: string | null, source: string | null) =>
      selectFirstBatch({ decision, confidence, source });
    // 選ばれる
    assert(pick('fix', null, 'wikidata'));
    assert(pick('fix', null, 'osm'));
    assert(pick('check_decided', '高', 'wd'));
    assert(pick('check_decided', '高', 'osm'));
    assert(pick('check_decided', '高', 'wdc6'));
    assert(pick('check_decided', '高', 'osmc0'));
    // 選ばれない
    assert(!pick('fix', null, 'gsi'));
    assert(!pick('check_decided', '高', 'gsi_label'));
    assert(!pick('check_decided', '高', 'seed'));
    assert(!pick('check_decided', '中', 'wd'));
    assert(!pick('check_decided', '中', 'osm'));
    assert(!pick('fix_corrected', '中', 'wikidata:Q135194979'));
    assert(!pick('check_owner', null, null));
    assert(!pick('check_seed_investigate', null, 'seed'));
    assert(!pick('keep', null, 'seed'));
  }
);

// --- AC-2: draftItemToEntry ---

Deno.test('AC-2: 下書きの1行を台帳の1行にする（old は prod_match、new は小数6桁）', () => {
  const e = draftItemToEntry(draft({ lat: 38.2208931, lng: 140.1234564 }), 1);
  assertEquals(e, {
    batch: 1,
    idx: 391,
    name: '尊永寺',
    prefecture: '静岡県',
    seedFile: CHUBU,
    seedLine: 3,
    old: { lat: 34.7669, lng: 137.8116 },
    new: { lat: 38.220893, lng: 140.123456 },
    source: 'wikidata',
    ref: 'Q11555090',
    confidence: 'high',
    basis: '前の作業者の直す提案（wikidata+osm+gsi）',
  });
});

Deno.test('AC-2: wd と wdc6 は wikidata、osmc0 は osm にそろえる', () => {
  assertEquals(draftItemToEntry(draft({ source: 'wd' }), 1).source, 'wikidata');
  assertEquals(draftItemToEntry(draft({ source: 'wdc6' }), 1).source, 'wikidata');
  const o = draftItemToEntry(draft({ source: 'osmc0', source_ref: 'way/799099092' }), 1);
  assertEquals(o.source, 'osm');
  assertEquals(o.ref, 'way/799099092');
});

Deno.test('AC-2: source_ref が無い行は、その寺社の名前を含めて止める', () => {
  const err = assertThrows(() => draftItemToEntry(draft({ source_ref: undefined }), 1));
  assertMatch((err as Error).message, /尊永寺/);
});

// --- AC-3: ownerItemToEntry / resolveSeedPath ---

function owner(over: Partial<OwnerItem>): OwnerItem {
  return {
    idx: 278,
    name: '姉倉比賣神社',
    prefecture: '富山県',
    file: '03_chubu.sql',
    line: 40,
    verdict: 'check',
    priority: 'high',
    seed: { lat: 36.6505, lng: 137.2183 },
    choice: 'wd',
    lat: 36.6612347,
    lng: 137.2298767,
    note: '',
    chosen_at: '2026-09-28T00:00:00.000Z',
    ...over,
  };
}

Deno.test('AC-3: オーナーが seed を選んだ行は取り込まない（null）', () => {
  assertEquals(ownerItemToEntry(owner({ choice: 'seed', lat: null, lng: null }), 2), null);
});

Deno.test('AC-3: 国土地理院（gsi）と知らない choice は止める', () => {
  const gsi = assertThrows(() => ownerItemToEntry(owner({ choice: 'gsi' }), 2));
  assertMatch((gsi as Error).message, /地理院/);
  assertThrows(() => ownerItemToEntry(owner({ choice: 'google' }), 2));
});

Deno.test(
  'AC-3: wd → wikidata、osm → osm、custom → owner（ref は null）。old は書き出しの seed',
  () => {
    const wd = ownerItemToEntry(owner({ choice: 'wd' }), 2)!;
    assertEquals(wd.source, 'wikidata');
    assertEquals(wd.ref, null);
    assertEquals(wd.old, { lat: 36.6505, lng: 137.2183 });
    assertEquals(wd.new, { lat: 36.661235, lng: 137.229877 });
    assertEquals(wd.seedFile, CHUBU);
    assertEquals(wd.seedLine, 40);
    assertEquals(wd.batch, 2);
    assertEquals(wd.confidence, 'high');
    assertEquals(wd.basis, 'オーナーが選んだ（wd）');
    assertEquals(ownerItemToEntry(owner({ choice: 'osm' }), 2)!.source, 'osm');
    const custom = ownerItemToEntry(owner({ choice: 'custom', note: '本殿の前' }), 2)!;
    assertEquals(custom.source, 'owner');
    assertEquals(custom.ref, null);
    assertMatch(custom.basis, /^オーナーが選んだ（custom）.*本殿の前/);
  }
);

Deno.test(
  '第2弾: 書き出しに ref（Q-ID・OSM の要素）があれば台帳に残す（#301 の画面の書き出し）',
  () => {
    const wd = ownerItemToEntry(owner({ choice: 'wd', ref: 'Q135194979' }), 2)!;
    assertEquals(wd.ref, 'Q135194979');
    const osm = ownerItemToEntry(owner({ choice: 'osm', ref: 'way/123456' }), 2)!;
    assertEquals(osm.ref, 'way/123456');
    // ref が無い書き出し（review-owner.html の形）は今までどおり null
    assertEquals(ownerItemToEntry(owner({ choice: 'wd', ref: null }), 2)!.ref, null);
    assertEquals(ownerItemToEntry(owner({ choice: 'wd' }), 2)!.ref, null);
    // 地図で置いた点は出どころの ID を持たない
    assertEquals(ownerItemToEntry(owner({ choice: 'custom', ref: null }), 2)!.ref, null);
  }
);

Deno.test('第2弾: ref の形が出どころに合わなければ止める', () => {
  const bad = assertThrows(() => ownerItemToEntry(owner({ choice: 'wd', ref: 'node/1' }), 2));
  assertMatch((bad as Error).message, /姉倉比賣神社.*ref/);
  assertThrows(() => ownerItemToEntry(owner({ choice: 'osm', ref: 'Q1' }), 2));
  assertThrows(() => ownerItemToEntry(owner({ choice: 'custom', ref: 'Q1' }), 2));
});

Deno.test('AC-3: resolveSeedPath はファイル名を seed のパスに直し、知らない名前は止める', () => {
  assertEquals(resolveSeedPath('03_chubu.sql'), CHUBU);
  assertEquals(resolveSeedPath('seed_miyagi_spots_and_pilgrimages.sql'), MIYAGI);
  assertThrows(() => resolveSeedPath('../x.sql'));
  assertThrows(() => resolveSeedPath('seed_pilgrimages_and_spots.sql'));
  assertThrows(() => resolveSeedPath('seed_reception_hours_2026-08.sql'));
});

// --- AC-4: parseLedger / mergeEntries ---

Deno.test('AC-4: 正しい台帳は通り、JSON の文字からも読める', () => {
  const ok = ledgerOf(SEED_ENTRIES);
  assertEquals(parseLedger(ok).entries.length, 3);
  assertEquals(parseLedger(serializeLedger(ok)).entries.length, 3);
});

Deno.test('AC-4: (name, prefecture) と idx の重なりで止める', () => {
  assertThrows(
    () => parseLedger(ledgerOf([entry({}), entry({ idx: 9, seedLine: 9 })])),
    Error,
    '尊永寺'
  );
  assertThrows(
    () => parseLedger(ledgerOf([entry({}), entry({ name: '別の寺', seedLine: 9 })])),
    Error,
    '391'
  );
  assertThrows(
    () => mergeEntries(ledgerOf([entry({})]), [entry({ idx: 9, seedLine: 9 })]),
    Error,
    '尊永寺'
  );
  assertThrows(() => mergeEntries(ledgerOf([entry({})]), [entry({ name: '別の寺', seedLine: 9 })]));
});

Deno.test('AC-4: 出どころと ref の決まりを守らない行で止める', () => {
  const bad = (e: LedgerEntry) => assertThrows(() => parseLedger(ledgerOf([e])));
  bad(entry({ source: 'gsi' as never }));
  bad(entry({ source: 'wikidata', ref: 'node/1' }));
  bad(entry({ source: 'osm', ref: 'Q1' }));
  bad(entry({ ref: null })); // batch 1 は ref が要る
  bad(entry({ source: 'owner', ref: 'Q1', batch: 2 }));
  // batch 2 の wikidata / osm は ref が無くてよい。owner は null
  parseLedger(ledgerOf([entry({ batch: 2, ref: null })]));
  parseLedger(ledgerOf([entry({ batch: 2, source: 'owner', ref: null })]));
});

Deno.test('AC-4: 座標の決まり（小数6桁・10m〜100km・日本の範囲）と名前の $ で止める', () => {
  const bad = (e: LedgerEntry) => assertThrows(() => parseLedger(ledgerOf([e])));
  bad(entry({ new: { lat: 34.7377871, lng: 137.97723 } })); // 小数7桁
  // 9m だけ動く（緯度 0.000081 度 ≒ 9.0m）
  const near = { lat: 34.7669 + 0.000081, lng: 137.8116 };
  assert(distanceMeters(entry({}).old, near) < 10);
  bad(entry({ new: near }));
  // 100.1km 動く（緯度 0.9002 度 ≒ 100.1km）
  const far = { lat: 34.7669 + 0.9002, lng: 137.8116 };
  assert(distanceMeters(entry({}).old, far) > 100_000);
  bad(entry({ new: far }));
  bad(entry({ old: { lat: 19.9, lng: 137.8116 }, new: { lat: 20.0, lng: 137.8116 } }));
  bad(entry({ name: '尊永寺$' }));
  bad(entry({ prefecture: '静岡' }));
  bad(entry({ seedFile: 'supabase/seed_pilgrimages_and_spots.sql' }));
  bad(entry({ seedLine: 0 }));
  bad(entry({ confidence: 'low' as never }));
  bad(entry({ basis: '' }));
});

Deno.test(`AC-4: OSM 由来は ${MAX_OSM_FEATURES} 件まで（100 件で止める）`, () => {
  parseLedger(ledgerOf(many(99, 'osm')));
  assertThrows(() => parseLedger(ledgerOf(many(100, 'osm'))), Error, '99');
  // 足して 100 件になるときも止める
  const base = ledgerOf(many(99, 'osm'));
  const more = entry({ idx: 5000, name: '足す寺', seedLine: 9999, source: 'osm', ref: 'way/5' });
  assertThrows(() => mergeEntries(base, [more]), Error, '99');
});

Deno.test('台帳を書き出すと (batch, seedFile, seedLine) の順で、末尾に改行が1つ', () => {
  const l = ledgerOf([
    entry({ batch: 2, idx: 1, name: 'b', seedLine: 1, ref: null }),
    entry({ idx: 2, name: 'c', seedFile: MIYAGI, seedLine: 1 }),
    entry({ idx: 3, name: 'a', seedLine: 7 }),
    entry({ idx: 4, name: 'd', seedLine: 5 }),
  ]);
  const text = serializeLedger(l);
  assert(text.endsWith('}\n') && !text.endsWith('\n\n'));
  const names = (JSON.parse(text) as Ledger).entries.map(e => e.name);
  // seedFile は文字の順（supabase/seed_miyagi… は supabase/seeds/… より前）
  assertEquals(names, ['c', 'd', 'a', 'b']);
  assertEquals(serializeLedger(parseLedger(text)), text);
});

// --- AC-5: rewriteSeed ---

Deno.test('AC-5: 旧座標の行は2・3番目の数だけが新座標（小数6桁）になり、ほかの文字は同じ', () => {
  const out = rewriteSeed(SEED_TEXT, CHUBU, SEED_ENTRIES);
  const lines = out.text.split('\n');
  assertEquals(
    lines[2],
    "('尊永寺', 34.737787, 137.977230, 'temple', '静岡県袋井市豊沢2777', '静岡県', 4, 'active'),"
  );
  assertEquals(
    lines[5],
    "('若狭姫神社', 35.479058, 135.780525, 'shrine', '福井県小浜市遠敷65-41', '福井県', 4, 'active')"
  );
  assertEquals(out.changed, 3);
  assertEquals(out.already, 0);
});

Deno.test('AC-5: すぐ次の行の「座標: 」から行末を出典の文にする（wikidata / osm / owner）', () => {
  const lines = rewriteSeed(SEED_TEXT, CHUBU, SEED_ENTRIES).text.split('\n');
  assertEquals(
    lines[3],
    '-- 住所確認: ホトカミ ✓, Wikipedia ✓ | 座標: Wikidata Q11555090（#292 で直した）'
  );
  assertEquals(
    lines[6],
    '-- 住所確認: ホトカミ ✓ | 座標: OpenStreetMap way/799099092（© OpenStreetMap contributors, ODbL・#292 で直した）'
  );
  const own = rewriteSeed(SEED_TEXT, CHUBU, [
    entry({ batch: 2, source: 'owner', ref: null }),
  ]).text.split('\n');
  assertEquals(
    own[3],
    '-- 住所確認: ホトカミ ✓, Wikipedia ✓ | 座標: オーナーが地図で決めた（#292 で直した）'
  );
});

Deno.test('AC-5: コメントの無い行（宮城の形）は、その1行だけが替わる', () => {
  const before = SEED_TEXT.split('\n');
  const after = rewriteSeed(SEED_TEXT, CHUBU, [SEED_ENTRIES[1]]).text.split('\n');
  assertEquals(
    after[4],
    "('秋保神社', 38.263611, 140.659611, 'shrine', '宮城県仙台市太白区秋保町長袋清水久保1', '宮城県', 3, 'active'),"
  );
  const diff = before.map((l, i) => (l === after[i] ? null : i)).filter(i => i !== null);
  assertEquals(diff, [4]);
});

Deno.test('AC-5: 2回かけても同じ（2回目は changed 0・already に数える）', () => {
  const once = rewriteSeed(SEED_TEXT, CHUBU, SEED_ENTRIES);
  const twice = rewriteSeed(once.text, CHUBU, SEED_ENTRIES);
  assertEquals(twice.text, once.text);
  assertEquals(twice.changed, 0);
  assertEquals(twice.already, 3);
});

Deno.test('AC-5: ほかのファイルの行は見ない', () => {
  const out = rewriteSeed(SEED_TEXT, MIYAGI, SEED_ENTRIES);
  assertEquals(out, { text: SEED_TEXT, changed: 0, already: 0 });
});

Deno.test('AC-5: 名前・都道府県・座標が合わない行は <ファイル>:<行> <名前> を出して止める', () => {
  assertThrows(
    () => rewriteSeed(SEED_TEXT, CHUBU, [entry({ name: '修禅寺' })]),
    Error,
    `${CHUBU}:3 修禅寺`
  );
  assertThrows(
    () => rewriteSeed(SEED_TEXT, CHUBU, [entry({ prefecture: '愛知県' })]),
    Error,
    `${CHUBU}:3 尊永寺`
  );
  assertThrows(
    () => rewriteSeed(SEED_TEXT, CHUBU, [entry({ old: { lat: 34.767, lng: 137.8116 } })]),
    Error,
    `${CHUBU}:3 尊永寺`
  );
  assertThrows(
    () => rewriteSeed(SEED_TEXT, CHUBU, [entry({ seedLine: 4 })]),
    Error,
    `${CHUBU}:4 尊永寺`
  );
  assertThrows(
    () => rewriteSeed(SEED_TEXT, CHUBU, [entry({ seedLine: 99 })]),
    Error,
    `${CHUBU}:99 尊永寺`
  );
});

Deno.test('AC-5: どの場合も、出力の行数が入力と同じ', () => {
  const n = SEED_TEXT.split('\n').length;
  for (const es of [SEED_ENTRIES, [SEED_ENTRIES[0]], [SEED_ENTRIES[1]], []]) {
    const once = rewriteSeed(SEED_TEXT, CHUBU, es).text;
    assertEquals(once.split('\n').length, n);
    assertEquals(rewriteSeed(once, CHUBU, es).text.split('\n').length, n);
  }
});

Deno.test('countSeedRows は寺社の行だけを数える', () => {
  assertEquals(countSeedRows(SEED_TEXT), 3);
  assertEquals(countSeedRows("-- ('x', 1, 2,\nINSERT INTO spots VALUES\n;"), 0);
});

Deno.test('coordText は小数6桁、distanceMeters はハバーサイン', () => {
  assertEquals(coordText(137.97723), '137.977230');
  assertEquals(coordText(38.2186), '38.218600');
  // 緯度 1 度 ≒ 111.195km（半径 6,371km）
  const d = distanceMeters({ lat: 35, lng: 135 }, { lat: 36, lng: 135 });
  assert(Math.abs(d - 111_195) < 1);
});

// --- AC-6: buildMigrationSql ---

Deno.test('AC-6: migration は DO ブロック1つで、台帳の1件が1行', () => {
  const sql = buildMigrationSql(SEED_ENTRIES, {
    batch: 1,
    direction: 'apply',
    version: '20260928000000',
  });
  assertEquals(sql.split('DO $spot_coords_292$').length - 1, 1);
  assertEquals(sql.split('"name":').length - 1, 3);
  assert(sql.includes('created_by_user_id IS NULL'));
  assert(sql.includes('GET DIAGNOSTICS'));
  assert(!sql.includes('BEGIN;'));
  assert(!sql.includes('COMMIT;'));
  assert(!sql.toUpperCase().includes('DISABLE TRIGGER'));
  assert(sql.includes('main.ts generate --batch 1 --version 20260928000000'));
  assert(sql.includes('生成物'));
  assertEquals(sql.match(/\b(insert|delete|truncate|drop|alter|disable)\b/gi), null);
  // 旧は最短の表し方、新は小数6桁
  assert(
    sql.includes(
      '{"name":"尊永寺","prefecture":"静岡県","old_lat":34.7669,"old_lng":137.8116,"new_lat":34.737787,"new_lng":137.977230}'
    )
  );
});

Deno.test('AC-6: revert は各行の old と new が入れ替わる', () => {
  const opts = { batch: 1, version: '20260928000000' } as const;
  const apply = buildMigrationSql(SEED_ENTRIES, { ...opts, direction: 'apply' });
  const revert = buildMigrationSql(SEED_ENTRIES, { ...opts, direction: 'revert' });
  const rows = (sql: string) =>
    sql
      .split('\n')
      .filter(l => l.startsWith('{"name":'))
      .map(l => JSON.parse(l.replace(/,$/, '')));
  const a = rows(apply);
  const r = rows(revert);
  assertEquals(a.length, 3);
  for (let i = 0; i < a.length; i++) {
    assertEquals(r[i].old_lat, a[i].new_lat);
    assertEquals(r[i].old_lng, a[i].new_lng);
    assertEquals(r[i].new_lat, a[i].old_lat);
    assertEquals(r[i].new_lng, a[i].old_lng);
  }
  assert(revert.includes('batch1 revert'));
  assertNotEquals(apply, revert);
});

Deno.test('buildCheckSql は読むだけで、先頭のコメントに弾ごとの前・後の期待値がある', () => {
  const l = ledgerOf([
    ...SEED_ENTRIES,
    entry({ batch: 2, idx: 7, name: '二の寺', seedLine: 7, ref: null }),
  ]);
  const sql = buildCheckSql(l, 1109);
  assertEquals(sql.match(/\b(update|insert|delete|truncate|drop|alter)\b/gi), null);
  assert(!sql.includes('npx'));
  assert(
    sql.includes('supabase db query --linked -f supabase/validation/spot_coords_292_check.sql')
  );
  assertEquals(sql.split('"name":').length - 1, 4);
  const expect = [
    'RESULT total=1109 listed=4 rest=1105 at_new=0 at_old=4 neither=0 not_one=0 inactive=0',
    'RESULT total=1109 listed=4 rest=1105 at_new=3 at_old=1 neither=0 not_one=0 inactive=0',
    'RESULT total=1109 listed=4 rest=1105 at_new=4 at_old=0 neither=0 not_one=0 inactive=0',
  ];
  const head = sql.split('\n').filter(s => s.startsWith('--'));
  assertEquals(head.filter(s => s.includes(expect[0])).length, 1); // 第1弾の前
  assertEquals(head.filter(s => s.includes(expect[1])).length, 2); // 第1弾の後 = 第2弾の前
  assertEquals(head.filter(s => s.includes(expect[2])).length, 1); // 第2弾の後
});

// --- 第1弾のデータ（S2）: リポジトリの台帳を読む ---

const LEDGER_URL = new URL('../../data/spot-coords-292.json', import.meta.url);

async function realLedger(): Promise<Ledger> {
  return parseLedger(await Deno.readTextFile(LEDGER_URL));
}

Deno.test(
  'AC-11: 台帳は検査を通り、第1弾 458 件（wikidata 403・osm 55）、全件 high で ref がある',
  async () => {
    const l = await realLedger();
    const first = l.entries.filter(e => e.batch === 1);
    assertEquals(first.length, 458);
    assert(first.every(e => e.confidence === 'high'));
    assert(first.every(e => e.ref !== null));
    assertEquals(first.filter(e => e.source === 'wikidata').length, 403);
    assertEquals(first.filter(e => e.source === 'osm').length, 55);
    assertEquals(first.filter(e => e.source === 'owner').length, 0);
  }
);

Deno.test(
  '第2弾: 台帳に 46 件（wikidata 38・osm 8）。全件 ref があり、OSM 由来は全部の弾で 99 件まで',
  async () => {
    const l = await realLedger();
    assertEquals(
      l.entries.every(e => e.batch === 1 || e.batch === 2),
      true
    );
    const second = l.entries.filter(e => e.batch === 2);
    assertEquals(second.length, 46);
    assert(second.every(e => e.confidence === 'high'));
    assert(second.every(e => e.ref !== null));
    assertEquals(second.filter(e => e.source === 'wikidata').length, 38);
    assertEquals(second.filter(e => e.source === 'osm').length, 8);
    assertEquals(second.filter(e => e.source === 'owner').length, 0);
    assertEquals(l.entries.filter(e => e.source === 'osm').length, 63);
    // 既知の誤りの提案と、住所と食い違う提案は入れていない（#301 の申し送り）
    for (const [name, pref] of [
      ['龍泉寺（埼玉厄除け開運大師）', '埼玉県'],
      ['八坂神社（長崎）', '長崎県'],
      ['大御神社', '宮崎県'],
    ]) {
      assertEquals(
        l.entries.find(e => e.name === name && e.prefecture === pref),
        undefined,
        name
      );
    }
  }
);

Deno.test('AC-13: Issue の標本が入り、第2弾に回すものは入っていない', async () => {
  const l = await realLedger();
  const find = (name: string, prefecture: string) =>
    l.entries.find(e => e.name === name && e.prefecture === prefecture);
  const at = (name: string, prefecture: string, lat: number, lng: number) => {
    const e = find(name, prefecture);
    assert(e, `${name}（${prefecture}）が台帳に無い`);
    assert(
      distanceMeters(e.new, { lat, lng }) < 1,
      `${name} の新座標が ${e.new.lat}, ${e.new.lng}`
    );
    return e;
  };
  assertEquals(at('尊永寺', '静岡県', 34.737787, 137.97723).ref, 'Q11555090');
  at('志賀海神社', '福岡県', 33.667891, 130.313194);
  at('金倉寺', '香川県', 34.250097, 133.781014);
  at('長崎縣護國神社', '長崎県', 32.777222, 129.855556);
  at('倭姫宮', '三重県', 34.48583, 136.72306);
  at('秋田諏訪宮', '秋田県', 39.423611, 140.542778);
  at('伊佐爾波神社', '愛媛県', 33.850726, 132.788679);
  assertEquals(find('久伊豆神社', '埼玉県')?.ref, 'Q11368930');
  const wakasa = find('若狭姫神社', '福井県');
  assertEquals([wakasa?.source, wakasa?.ref], ['osm', 'way/799099092']);

  for (const [name, prefecture] of [
    ['護国寺', '沖縄県'],
    ['姉倉比賣神社', '富山県'],
    ['讃岐宮香川縣護國神社', '香川県'],
    ['蠶養國神社', '福島県'],
    ['雲昌寺', '秋田県'],
  ]) {
    assertEquals(find(name, prefecture), undefined, `${name}（${prefecture}）は入らないはず`);
  }
});
