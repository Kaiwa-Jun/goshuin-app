// Deno テスト（本物の入力から作る寺社の一覧。契約書 docs/issues/issue-324-homepage.md AC-1・AC-8〜11）
// 数は入力から数えた値と比べる。いまの値（777・332・410・27）は契約書に書いた値
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { distanceMeters } from '../supabase/scripts/spot-coords/coords.ts';
import { NEARBY_LIMIT, NEARBY_RADIUS_M } from './config.ts';
import { buildSiteData, type SiteData, type Spot } from './data.ts';
import { realInputs, errorOf } from './fixtures/load.ts';
import { parseReceptionHours } from './hours.ts';

let data: Promise<SiteData> | null = null;
function realData(): Promise<SiteData> {
  data ??= realInputs().then(buildSiteData);
  return data;
}

function find(d: SiteData, name: string, pref: string): Spot {
  const s = d.spots.find(x => x.name === name && x.prefecture === pref);
  if (!s) throw new Error(`${name}（${pref}）が無い`);
  return s;
}

Deno.test(
  'AC-1: 寺社は 1,109・47 都道府県。ページ = 写真の承認 ∪ explicit の受付時間（入力から数える）',
  async () => {
    const inputs = await realInputs();
    const d = await realData();
    assertEquals(d.spots.length, inputs.rows.length);
    assertEquals(d.spots.length, 1109);
    assertEquals(new Set(d.spots.map(s => s.prefecture)).size, 47);

    const photoIdx = new Set(
      (inputs.photos.entries as { idx: number; status: string }[])
        .filter(e => e.status === 'approved')
        .map(e => e.idx)
    );
    const hoursIdx = parseReceptionHours(inputs.hoursText, inputs.rows)
      .filter(h => h.kind === 'explicit')
      .map(h => h.idx);
    const want = new Set([...photoIdx, ...hoursIdx]);
    const pages = d.spots.filter(s => s.hasPage);
    assertEquals(new Set(pages.map(s => s.idx)), want);
    assertEquals(pages.length, 777);
    assertEquals(d.spots.length - pages.length, 332);

    const count = (pref: string) => [
      d.spots.filter(s => s.prefecture === pref).length,
      d.spots.filter(s => s.prefecture === pref && s.hasPage).length,
    ];
    assertEquals(count('東京都'), [119, 76]);
    assertEquals(count('宮城県'), [90, 27]);
    assertEquals(count('長野県'), [20, 7]);
    // ページの無い寺社は写真も受付時間も近くの寺社も持たない
    for (const s of d.spots.filter(x => !x.hasPage)) {
      assertEquals([s.photo, s.hours, s.nearby.length], [null, null, 0]);
    }
  }
);

Deno.test(
  'AC-1: 表示する受付時間は explicit の 8 だけ。proxy の寺社は受付時間を持たない',
  async () => {
    const d = await realData();
    const withHours = d.spots.filter(s => s.hours !== null);
    assertEquals(withHours.length, 8);
    for (const [n, p] of [
      ['湯島天満宮', '東京都'],
      ['八坂神社', '京都府'],
      ['北野天満宮', '京都府'],
      ['浅草神社', '東京都'],
    ]) {
      assertEquals(find(d, n, p).hours, null);
    }
  }
);

Deno.test('AC-8: 写真の URL と表示の高さ（明治神宮 4496×3000 → 801）', async () => {
  const d = await realData();
  const m = find(d, '明治神宮', '東京都');
  assertEquals(
    m.photo?.url,
    'https://img.goshuinsanpo.com/cdn-cgi/image/width=1200,quality=78,format=webp/spot-photos/b11f026972f611335ea0ef5857ebaf7fef3960a3.jpg'
  );
  assertEquals([m.photo?.width, m.photo?.height], [1200, 801]);
  assertEquals(m.photo?.author, 'Tokuzo in Edomura');
  assertEquals(m.photo?.license, 'CC BY-SA 4.0');
  assertEquals(m.photo?.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0');
  assertEquals(
    m.photo?.sourceUrl,
    'https://commons.wikimedia.org/wiki/File:Courtyard_of_Meiji_Shrine_20190717.jpg'
  );
  const inputs = await realInputs();
  for (const e of inputs.photos.entries as {
    idx: number;
    width: number;
    height: number;
    r2Key: string;
    status: string;
  }[]) {
    if (e.status !== 'approved') continue;
    const s = d.spots.find(x => x.idx === e.idx)!;
    assertEquals(s.photo?.height, Math.round((1200 * e.height) / e.width));
    assertEquals(
      s.photo?.url,
      'https://img.goshuinsanpo.com/cdn-cgi/image/width=1200,quality=78,format=webp/' + e.r2Key
    );
  }
  const takeda = find(d, '武田神社', '山梨県');
  assertEquals([takeda.photo?.author, takeda.photo?.licenseUrl], [null, null]);
});

Deno.test(
  'AC-9: 座標を確かめた寺社（ページあり）は入力から数えて 410。明治神宮は確かめた・平等院と浅草寺は確かめていない',
  async () => {
    const inputs = await realInputs();
    const d = await realData();
    const ledger = new Set(
      (inputs.coords.entries as { name: string; prefecture: string }[]).map(
        e => `${e.name}\t${e.prefecture}`
      )
    );
    const want = d.spots.filter(s => s.hasPage && ledger.has(`${s.name}\t${s.prefecture}`)).length;
    const got = d.spots.filter(s => s.hasPage && s.coordsVerified).length;
    assertEquals(got, want);
    assertEquals(got, 410);
    assert(find(d, '明治神宮', '東京都').coordsVerified);
    assert(!find(d, '平等院', '京都府').coordsVerified);
    assert(!find(d, '浅草寺', '東京都').coordsVerified);
  }
);

Deno.test(
  '座標の文字は seed の値の文字のまま（確かめた寺社の全部で seed の行と同じ）',
  async () => {
    const inputs = await realInputs();
    const d = await realData();
    for (const s of d.spots.filter(x => x.coordsVerified)) {
      const line = inputs.seedTexts.get(s.file)!.split('\n')[s.line - 1];
      assert(
        line.includes(`, ${s.latText}, ${s.lngText},`),
        `${s.name}（${s.prefecture}）: ${line}`
      );
      assertEquals([Number(s.latText), Number(s.lngText)], [s.lat, s.lng]);
    }
    const hokkaido = find(d, '札幌諏訪神社', '北海道');
    assertEquals(hokkaido.latText, '43.0760');
  }
);

Deno.test(
  'AC-10: 近くの寺社（明治神宮 → 5 つ・帯廣神社 → 空・0 件の寺社の数は入力から）',
  async () => {
    const d = await realData();
    const byIdx = new Map(d.spots.map(s => [s.idx, s]));
    const names = (s: Spot) =>
      s.nearby.map(i => `${byIdx.get(i)!.name}（${byIdx.get(i)!.prefecture}）`);
    assertEquals(names(find(d, '明治神宮', '東京都')), [
      '代々木八幡宮（東京都）',
      '花園神社（東京都）',
      '赤坂氷川神社（東京都）',
      '日枝神社（東京都）',
      '麻布氷川神社（東京都）',
    ]);
    assertEquals(find(d, '帯廣神社', '北海道').nearby, []);
    const pages = d.spots.filter(s => s.hasPage);
    let zero = 0;
    for (const s of pages) {
      assert(s.nearby.length <= NEARBY_LIMIT);
      for (const i of s.nearby) {
        const n = byIdx.get(i)!;
        assert(n.idx !== s.idx && n.hasPage, `${s.name}: ${n.name}`);
        assert(distanceMeters(s, n) <= NEARBY_RADIUS_M);
      }
      // 近い順（同じ距離は idx の小さい順）で、範囲の中に入る寺社の先頭 5 つ
      const want = pages
        .filter(p => p.idx !== s.idx)
        .map(p => ({ idx: p.idx, d: distanceMeters(s, p) }))
        .filter(x => x.d <= NEARBY_RADIUS_M)
        .sort((a, b) => a.d - b.d || a.idx - b.idx)
        .slice(0, NEARBY_LIMIT)
        .map(x => x.idx);
      assertEquals(s.nearby, want);
      if (s.nearby.length === 0) zero++;
    }
    assertEquals(zero, 27);
  }
);

Deno.test(
  'AC-11: 地図のリンク（明治神宮の Google マップと OSM・平等院の OSM は null）',
  async () => {
    const d = await realData();
    const m = find(d, '明治神宮', '東京都');
    assertEquals(
      m.googleMapsUrl,
      'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent('明治神宮 東京都渋谷区代々木神園町1-1')
    );
    assertEquals(
      m.osmUrl,
      'https://www.openstreetmap.org/?mlat=35.676111&mlon=139.699167#map=17/35.676111/139.699167'
    );
    assertEquals(find(d, '平等院', '京都府').osmUrl, null);
    // ページの無い寺社にも Google マップはある
    assert(d.spots.every(s => s.googleMapsUrl.startsWith('https://www.google.com/maps/search/')));
  }
);

Deno.test('写真の台帳の行が seed と合わなければ名前を出して止まる', async () => {
  const inputs = await realInputs();
  const photos = structuredClone(inputs.photos) as { entries: { name: string }[] };
  photos.entries[0].name = '違う名前';
  const e = errorOf(() => buildSiteData({ ...inputs, photos }));
  assert(e.includes('違う名前（北海道）'), e);
});
