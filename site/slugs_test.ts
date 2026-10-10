// Deno テスト（slug の台帳。契約書 docs/issues/issue-324-homepage.md AC-2・AC-3）
import { assert, assertEquals } from 'jsr:@std/assert@1';

import type { SeedRow } from '../supabase/scripts/spot-wikidata/match.ts';
import { captureIo, makeRoot, readRepo, realInputs, snapshot, errorOf } from './fixtures/load.ts';
import { runCli } from './main.ts';
import { prefectureByName } from './prefectures.ts';
import {
  appendSlugEntries,
  matchSlugs,
  missingSlugEntries,
  parseSlugLedger,
  serializeSlugLedger,
  SLUGS_PATH,
} from './slugs.ts';

const TOKYO_SEED = 'supabase/seeds/seed_tokyo_spots.sql';
const EXTRA_ROW =
  "('テスト神社', 35.0, 139.0, 'shrine', '東京都テスト区1-1', '東京都', 3, 'active'),\n";

function extraRow(rows: SeedRow[]): SeedRow {
  return {
    idx: rows.length + 1,
    name: 'テスト神社',
    prefecture: '東京都',
    type: 'shrine',
    address: '東京都テスト区1-1',
    rank: 3,
    file: TOKYO_SEED,
    line: 9999,
    lat: 35,
    lng: 139,
  };
}

Deno.test(
  'AC-2: 本物の台帳は seed の 1,109 寺社と1対1・slug の形と番号が決まりどおり',
  async () => {
    const { rows, slugs } = await realInputs();
    assertEquals(slugs.entries.length, 1109);
    assertEquals(slugs.entries.length, rows.length);
    const bySlug = matchSlugs(slugs, rows);
    assertEquals(bySlug.size, rows.length);
    assertEquals(new Set(slugs.entries.map(e => e.slug)).size, slugs.entries.length);
    // 都道府県ごとに seed の順で 001 から続く
    const counter = new Map<string, number>();
    for (const r of rows) {
      const n = (counter.get(r.prefecture) ?? 0) + 1;
      counter.set(r.prefecture, n);
      const want = `${prefectureByName(r.prefecture)!.slug}-${String(n).padStart(3, '0')}`;
      assertEquals(bySlug.get(r.idx), want, `${r.name}（${r.prefecture}）`);
    }
    for (const e of slugs.entries) {
      assert(/^[a-z]+-\d{3}$/.test(e.slug));
      assertEquals(e.slug.split('-')[0], prefectureByName(e.prefecture)!.slug);
    }
    const slugOf = (name: string, pref: string) =>
      slugs.entries.find(e => e.name === name && e.prefecture === pref)?.slug;
    assertEquals(slugOf('浅草寺', '東京都'), 'tokyo-001');
    assertEquals(slugOf('明治神宮', '東京都'), 'tokyo-002');
    assertEquals(slugOf('日枝神社', '東京都'), 'tokyo-008');
    assertEquals(slugOf('平等院', '京都府'), 'kyoto-008');
    assertEquals(slugOf('武田神社', '山梨県'), 'yamanashi-001');
    assertEquals(slugOf('帯廣神社', '北海道'), 'hokkaido-011');
  }
);

Deno.test('AC-2: 本物の台帳は書き方の決まり（serializeSlugLedger）のまま', async () => {
  const text = await readRepo(SLUGS_PATH);
  assertEquals(serializeSlugLedger(parseSlugLedger(text)), text);
});

Deno.test('AC-3: 台帳に無い seed の寺社・台帳だけの行・重なる slug で止まる', async () => {
  const { rows, slugs } = await realInputs();
  const more = [...rows, extraRow(rows)];
  const e1 = errorOf(() => matchSlugs(slugs, more));
  assert(e1.includes('テスト神社（東京都）'), e1);

  const fewer = rows.filter(r => !(r.name === '浅草寺' && r.prefecture === '東京都'));
  const e2 = errorOf(() => matchSlugs(slugs, fewer));
  assert(e2.includes('浅草寺（東京都）'), e2);

  const dup = structuredClone(slugs);
  dup.entries[1].slug = dup.entries[0].slug;
  const e3 = errorOf(() => parseSlugLedger(serializeSlugLedger(dup)));
  assert(e3.includes(dup.entries[0].slug), e3);
});

Deno.test(
  'AC-3: 台帳の形が違えば止まる（slug の形・県のローマ字・(name, prefecture) の重なり）',
  async () => {
    const { slugs } = await realInputs();
    const bad = (f: (x: typeof slugs) => void) => {
      const x = structuredClone(slugs);
      f(x);
      return errorOf(() => parseSlugLedger(serializeSlugLedger(x)));
    };
    assert(bad(x => (x.entries[0].slug = 'Hokkaido-1')).includes('北海道神宮（北海道）'));
    assert(bad(x => (x.entries[0].slug = 'tokyo-999')).includes('北海道神宮（北海道）'));
    assert(
      bad(x => {
        x.entries[1].name = x.entries[0].name;
        x.entries[1].prefecture = x.entries[0].prefecture;
      }).includes('北海道神宮（北海道）')
    );
  }
);

Deno.test(
  'AC-3: slugs は足りない寺社にその県の次の番号を振り、末尾に足す（東京都 → tokyo-120）',
  async () => {
    const { rows, slugs } = await realInputs();
    const more = [...rows, extraRow(rows)];
    const added = missingSlugEntries(slugs, more);
    assertEquals(added, [{ name: 'テスト神社', prefecture: '東京都', slug: 'tokyo-120' }]);
    // 番号の抜けは埋めない。いちばん大きい番号の次から（使い回さない）。足すのは seed の順
    const holed = structuredClone(slugs);
    holed.entries = holed.entries.filter(e => e.slug !== 'tokyo-050');
    assertEquals(
      missingSlugEntries(holed, more).map(e => e.slug),
      ['tokyo-120', 'tokyo-121']
    );
  }
);

Deno.test('AC-3: 台帳が無ければ seed の順に都道府県ごと 001 から振る', async () => {
  const { rows, slugs } = await realInputs();
  assertEquals(missingSlugEntries(null, rows), slugs.entries);
});

Deno.test('AC-3: 足すときは既存の行の中身を1バイトも変えない（末尾に足すだけ）', async () => {
  const text = await readRepo(SLUGS_PATH);
  const next = appendSlugEntries(text, [
    { name: 'テスト神社', prefecture: '東京都', slug: 'tokyo-120' },
  ]);
  const head = text.slice(0, text.lastIndexOf(']')).trimEnd();
  assert(next.startsWith(head), '既存の行が先頭にそのまま残る');
  const parsed = parseSlugLedger(next);
  assertEquals(parsed.entries.length, 1110);
  assertEquals(parsed.entries.at(-1), {
    name: 'テスト神社',
    prefecture: '東京都',
    slug: 'tokyo-120',
  });
  assertEquals(next, serializeSlugLedger(parsed));
  assertEquals(appendSlugEntries(text, []), text);
});

Deno.test(
  'AC-3（CLI）: slugs --check は足りない寺社の名前を出して 1・書かない。slugs は足して 0',
  async () => {
    const root = await makeRoot({ seedAppend: { [TOKYO_SEED]: EXTRA_ROW }, statics: false });
    try {
      const before = await snapshot(root);
      const c = captureIo();
      assertEquals(await runCli(['slugs', '--check', '--root', root], c.io), 1);
      assert(c.err().includes('テスト神社（東京都）'), c.err());
      assertEquals(await snapshot(root), before);

      const s = captureIo();
      assertEquals(await runCli(['slugs', '--root', root], s.io), 0);
      const after = await Deno.readTextFile(`${root}/${SLUGS_PATH}`);
      const old = await readRepo(SLUGS_PATH);
      assert(after.startsWith(old.slice(0, old.lastIndexOf(']')).trimEnd()));
      assertEquals(parseSlugLedger(after).entries.at(-1)?.slug, 'tokyo-120');

      const c2 = captureIo();
      assertEquals(await runCli(['slugs', '--check', '--root', root], c2.io), 0);
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  }
);

Deno.test('AC-3（CLI）: 台帳が無いとき slugs は 1,109 行の台帳を作り、本物と同じ', async () => {
  const root = await makeRoot({ slugsText: null, statics: false });
  try {
    const c = captureIo();
    assertEquals(await runCli(['slugs', '--check', '--root', root], c.io), 1);
    assertEquals(await runCli(['slugs', '--root', root], captureIo().io), 0);
    assertEquals(await Deno.readTextFile(`${root}/${SLUGS_PATH}`), await readRepo(SLUGS_PATH));
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
