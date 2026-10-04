// Deno テスト（公開の2ファイル。キャッシュが無くても確かめられる: 形・件数・台帳との一致・標本）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-wikidata/
// 契約書: docs/issues/issue-301-spot-wikidata.md（S4 / AC-20〜AC-25）
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1';

import { parseLedger, SEED_FILES } from '../spot-coords/coords.ts';
import { MAPPING_PATH, parseMapping, parsePhotos, PHOTOS_PATH, readSeedRows } from './match.ts';

const ROOT = new URL('../../../', import.meta.url);
const read = (rel: string) => Deno.readTextFile(new URL(rel, ROOT));

async function load() {
  const mappingText = await read(MAPPING_PATH);
  const photosText = await read(PHOTOS_PATH);
  const mapping = parseMapping(mappingText);
  const photos = parsePhotos(photosText, mapping);
  const rows = readSeedRows(
    await Promise.all(SEED_FILES.map(async path => ({ path, text: await read(path) })))
  );
  const ledger = parseLedger(await read('supabase/data/spot-coords-292.json'));
  return { mappingText, photosText, mapping, photos, rows, ledger };
}

function find<T extends { name: string; prefecture: string }>(
  entries: T[],
  name: string,
  prefecture: string
): T | undefined {
  return entries.find(e => e.name === name && e.prefecture === prefecture);
}

Deno.test(
  'AC-20: 対応表は parseMapping を通り 1,109 件。名前と都道府県の組が seed の 1,109 行と同じ',
  async () => {
    const { mapping, rows } = await load();
    assertEquals(mapping.entries.length, 1109);
    assertEquals(
      mapping.entries.map(e => [e.idx, e.name, e.prefecture]),
      rows.map(r => [r.idx, r.name, r.prefecture])
    );
  }
);

Deno.test(
  'AC-21: 台帳の第1弾の wikidata 403 件すべてで、qid が台帳の ref・high・ledger',
  async () => {
    const { mapping, ledger } = await load();
    // 対応表は第1弾の台帳から作った（第2弾以降の行は見ない）
    const wd = ledger.entries.filter(e => e.batch === 1 && e.source === 'wikidata');
    assertEquals(wd.length, 403);
    let ok = 0;
    for (const e of wd) {
      const m = mapping.entries[e.idx - 1];
      assertEquals([m.name, m.prefecture], [e.name, e.prefecture]);
      assertEquals(
        [m.qid, m.confidence, m.method],
        [e.ref, 'high', 'ledger'],
        `${e.name}（${e.prefecture}）`
      );
      ok++;
    }
    assertEquals(ok, 403);
    assertEquals(mapping.entries.filter(m => m.method === 'ledger').length, 403);
  }
);

Deno.test(
  'AC-22: 標本（尊永寺ほか・姉倉比賣神社は 舟倉 の Q135194979・同じ県の同名 6 組は同じ qid にならない）',
  async () => {
    const { mapping } = await load();
    const qid = (name: string, prefecture: string) => find(mapping.entries, name, prefecture)?.qid;
    assertEquals(qid('尊永寺', '静岡県'), 'Q11555090');
    assertEquals(qid('志賀海神社', '福岡県'), 'Q11491171');
    assertEquals(qid('伊佐爾波神社', '愛媛県'), 'Q3155126');
    assertEquals(qid('長崎縣護國神社', '長崎県'), 'Q11652880');
    assertEquals(qid('久伊豆神社', '埼玉県'), 'Q11368930');
    const anekura = find(mapping.entries, '姉倉比賣神社', '富山県')!;
    assertEquals(anekura.qid, 'Q135194979');
    assertNotEquals(anekura.qid, 'Q11447234');
    assertEquals(anekura.method, 'rule');
    for (const [a, b, prefecture] of [
      ['都々古別神社（八槻）', '都々古別神社（馬場）', '福島県'],
      ['榛名神社', '榛名神社（沼田市）', '群馬県'],
      ['艮神社（尾道）', '艮神社（福山）', '広島県'],
      ['大日寺（板野）', '大日寺（徳島市）', '徳島県'],
      ['観音寺（有壁）', '観音寺（身代不動尊）', '宮城県'],
      ['満願寺', '満願寺（宝光院）', '宮城県'],
    ]) {
      const x = find(mapping.entries, a, prefecture);
      const y = find(mapping.entries, b, prefecture);
      assert(x && y, `${a} / ${b}（${prefecture}）が対応表に無い`);
      assert(x.qid === null || x.qid !== y.qid, `${a} と ${b} が同じ ${x.qid}`);
    }
  }
);

Deno.test(
  'AC-23: 写真の候補は parsePhotos を通り、high / medium の行の p18 だけ。姉倉比賣神社（呉羽の写真）は入らない',
  async () => {
    const { mapping, photos, photosText } = await load();
    assert(photos.entries.length > 0);
    for (const p of photos.entries) {
      const m = mapping.entries[p.idx - 1];
      assert(m.confidence === 'high' || m.confidence === 'medium');
      assertEquals(p.qid, m.qid);
      for (const f of p.files) assert(m.p18.includes(f.file), `${p.name}: ${f.file}`);
    }
    assertEquals(find(photos.entries, '姉倉比賣神社', '富山県'), undefined);
    assert(!photosText.includes('Kureha-Anekurahime-jinja'));
  }
);

Deno.test('AC-24: 公開のファイルに OSM と地理院の値が無い', async () => {
  const { mappingText, photosText } = await load();
  for (const text of [mappingText, photosText]) {
    assertEquals(text.match(/"(osm|gsi|addr|nominatim)"/g), null);
  }
  assertEquals(mappingText.match(/openstreetmap|gsi\.go\.jp/gi), null);
});

Deno.test('AC-25: 公開のファイルにホームのパス・作業フォルダ・日付が無い', async () => {
  const { mappingText, photosText, photos } = await load();
  for (const text of [mappingText, photosText]) {
    // 文字のクラスで書く（この行そのものが AC-25 の grep に当たらないように）
    assertEquals(text.match(/\/U[s]ers\/|k[a]iwajun|K[a]iwa|goshuin-work/g), null);
  }
  // 作った日時を入れない。Commons の表示の文（撮影者・クレジット・利用条件）は Commons のままなので除いて見る
  const withoutCommonsText = JSON.stringify({
    ...photos,
    entries: photos.entries.map(e => ({
      ...e,
      files: e.files.map(f => ({
        ...f,
        artist: null,
        artistHtml: null,
        credit: null,
        creditHtml: null,
        usageTerms: null,
        restrictions: '',
      })),
    })),
  });
  for (const text of [mappingText, withoutCommonsText]) {
    assertEquals(text.match(/\d{4}-\d{2}-\d{2}T\d{2}:/g), null);
  }
  // 対応表にはメールの形が無い（写真の候補の撮影者・クレジットは Commons の公開の表示）
  assertEquals(mappingText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g), null);
});
