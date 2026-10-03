// Deno ユニットテスト。実行: deno test supabase/functions/add-spot/
// 契約書: docs/issues/issue-248-spot-add-research.md（S2 / AC-11〜AC-17）
import { assertEquals } from 'jsr:@std/assert@1';
import { handleAddSpot, type AddSpotDeps, type NearbySpotRow } from './addSpot.ts';
import type { StoredCandidate } from '../_shared/spotResearch.ts';

const ME = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-8888-7777-6666-555555555555';
const TOKEN = 'valid-token';
const NOW = Date.parse('2026-09-25T03:00:00Z');

const good: StoredCandidate = {
  name: '鹿島台神社',
  type: 'shrine',
  address: '宮城県大崎市鹿島台平渡',
  prefecture: '宮城県',
  lat: 38.4803,
  lng: 141.0894,
  sources: [
    { url: 'https://jinja.or.jp/a', title: '宮城県神社庁' },
    { url: 'https://kashimadai-jinja.jp/', title: '公式' },
  ],
  officialUrl: 'https://kashimadai-jinja.jp/',
};

function makeDeps(
  opts: {
    research?: { user_id: string; candidates: StoredCandidate[]; created_at: string } | null;
    nearby?: NearbySpotRow[];
  } = {}
) {
  const inserted: Record<string, unknown>[] = [];
  const sources: { spotId: string; url: string }[] = [];
  const deps: AddSpotDeps = {
    getUserId: async t => (t === TOKEN ? ME : null),
    getResearch: async () =>
      opts.research === undefined
        ? { user_id: ME, candidates: [good], created_at: new Date(NOW - 5 * 60000).toISOString() }
        : opts.research,
    nearbySpots: async () => opts.nearby ?? [],
    insertSpot: async row => {
      inserted.push(row);
      return { id: 'new-spot', ...row };
    },
    insertOfficialSource: async (spotId, url) => {
      sources.push({ spotId, url });
    },
    now: () => NOW,
    log: () => {},
  };
  return { deps, inserted, sources };
}

const researched = { researchId: 'r1', candidateIndex: 0 };

Deno.test('AC-11: トークンが無い・無効なら 401 で何も書かない', async () => {
  const { deps, inserted } = makeDeps();
  assertEquals((await handleAddSpot(deps, null, researched)).status, 401);
  assertEquals((await handleAddSpot(deps, 'bad', researched)).status, 401);
  assertEquals(inserted.length, 0);
});

Deno.test('AC-12: 他人の・60分より前の・範囲外の候補は 404', async () => {
  const old = new Date(NOW - 61 * 60000).toISOString();
  for (const [research, body] of [
    [{ user_id: OTHER, candidates: [good], created_at: new Date(NOW).toISOString() }, researched],
    [{ user_id: ME, candidates: [good], created_at: old }, researched],
    [undefined, { researchId: 'r1', candidateIndex: 1 }],
    [null, researched],
  ] as const) {
    const { deps, inserted } = makeDeps({ research: research as never });
    assertEquals((await handleAddSpot(deps, TOKEN, body)).status, 404);
    assertEquals(inserted.length, 0);
  }
});

Deno.test('AC-13: 本文の住所・座標・情報源は使わず、保存した候補の値で入れる', async () => {
  const { deps, inserted } = makeDeps();
  await handleAddSpot(deps, TOKEN, {
    ...researched,
    sourceUrls: ['https://a.example.com', 'https://b.example.org'],
    lat: 35,
    lng: 139,
    address: '東京都千代田区',
  });
  assertEquals(inserted[0].lat, good.lat);
  assertEquals(inserted[0].lng, good.lng);
  assertEquals(inserted[0].address, good.address);
});

Deno.test(
  'AC-14: 基準を満たせば active・rank 1・本人、公式サイトを official で入れる',
  async () => {
    const { deps, inserted, sources } = makeDeps();
    const res = await handleAddSpot(deps, TOKEN, researched);
    assertEquals(res.status, 200);
    assertEquals(inserted[0], {
      name: good.name,
      type: good.type,
      address: good.address,
      prefecture: good.prefecture,
      lat: good.lat,
      lng: good.lng,
      status: 'active',
      rank: 1,
      created_by_user_id: ME,
    });
    assertEquals(sources, [{ spotId: 'new-spot', url: good.officialUrl! }]);
  }
);

Deno.test('AC-14: 1つ欠ければ pending で、official は入れない', async () => {
  const one = { ...good, sources: [good.sources[0]] };
  const { deps, inserted, sources } = makeDeps({
    research: { user_id: ME, candidates: [one], created_at: new Date(NOW).toISOString() },
  });
  await handleAddSpot(deps, TOKEN, researched);
  assertEquals(inserted[0].status, 'pending');
  assertEquals(sources.length, 0);
});

Deno.test('AC-15: 手入力は pending・住所なし。範囲外の座標や名前は 400', async () => {
  const { deps, inserted } = makeDeps();
  const manual = { name: '鹿島台神社', type: 'shrine', lat: 38.48, lng: 141.09 };
  assertEquals((await handleAddSpot(deps, TOKEN, { manual })).status, 200);
  assertEquals(inserted[0].status, 'pending');
  assertEquals(inserted[0].address, null);
  assertEquals(inserted[0].prefecture, null);
  for (const bad of [
    { ...manual, lat: 19.9 },
    { ...manual, lng: 154.1 },
    { ...manual, name: '  ' },
    { ...manual, name: 'あ'.repeat(51) },
    { ...manual, type: 'church' },
  ]) {
    assertEquals((await handleAddSpot(deps, TOKEN, { manual: bad })).status, 400);
  }
  assertEquals(inserted.length, 1);
  assertEquals((await handleAddSpot(deps, TOKEN, {})).status, 400);
});

Deno.test(
  'AC-16: 同じ名前の active か本人の pending が 300m 以内にあれば、入れずにそれを返す',
  async () => {
    const existing: NearbySpotRow = {
      id: 'mine',
      name: '鹿島台 神社',
      lat: 38.4805,
      lng: 141.0894,
      status: 'pending',
      created_by_user_id: ME,
    };
    const { deps, inserted } = makeDeps({ nearby: [existing] });
    const res = await handleAddSpot(deps, TOKEN, researched);
    assertEquals(inserted.length, 0);
    assertEquals((res.body.spot as { id: string }).id, 'mine');

    // 他人の pending は重複とみなさない（見えないので）
    const { deps: d2, inserted: i2 } = makeDeps({
      nearby: [{ ...existing, created_by_user_id: OTHER }],
    });
    await handleAddSpot(d2, TOKEN, researched);
    assertEquals(i2.length, 1);
  }
);

Deno.test('AC-17: 応答は spot だけで、落ちた基準を含まない', async () => {
  const one = { ...good, sources: [good.sources[0]] };
  const { deps } = makeDeps({
    research: { user_id: ME, candidates: [one], created_at: new Date(NOW).toISOString() },
  });
  const res = await handleAddSpot(deps, TOKEN, researched);
  assertEquals(Object.keys(res.body), ['spot']);
});
