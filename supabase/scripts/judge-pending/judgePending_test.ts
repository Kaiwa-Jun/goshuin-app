// Deno ユニットテスト。実行: deno test supabase/scripts/judge-pending/
// 契約書: docs/issues/issue-248-spot-add-research.md（S6 / AC-42・AC-43）
import { assertEquals } from 'jsr:@std/assert@1';
import { judgePending, type JudgeDeps, type PendingRow } from './judgePending.ts';
import type { StoredCandidate } from '../../functions/_shared/spotResearch.ts';

const row: PendingRow = {
  id: 'kashimadai',
  name: '鹿島台神社',
  type: 'shrine',
  address: '宮城県大崎市鹿島台平渡',
  prefecture: '宮城県',
  lat: 38.4803,
  lng: 141.0894,
};

const found: StoredCandidate = {
  name: '鹿島台 神社',
  type: 'shrine',
  address: '宮城県大崎市鹿島台平渡',
  prefecture: '宮城県',
  lat: 38.49,
  lng: 141.1,
  sources: [
    { url: 'https://jinja.or.jp/a', title: 'a' },
    { url: 'https://city.osaki.miyagi.jp/b', title: 'b' },
  ],
  officialUrl: null,
};

function makeDeps(candidates: StoredCandidate[] | null) {
  const activated: string[] = [];
  const asked: { name: string; hint: unknown }[] = [];
  const lines: string[] = [];
  const deps: JudgeDeps = {
    listPending: async () => [row],
    nearbyActives: async () => [],
    research: async (name, hint) => {
      asked.push({ name, hint });
      return candidates;
    },
    activate: async id => {
      activated.push(id);
    },
    log: line => lines.push(line),
  };
  return { deps, activated, asked, lines };
}

Deno.test('AC-42: 既定は dry-run で、判定を出すだけで書き換えない', async () => {
  const { deps, activated, lines } = makeDeps([found]);
  const results = await judgePending(deps, ['kashimadai'], false);
  assertEquals(results, [{ id: 'kashimadai', name: '鹿島台神社', status: 'active', failed: [] }]);
  assertEquals(activated, []);
  assertEquals(lines.length, 1);
});

Deno.test('AC-42: --apply のときだけ active と判定した行を更新する', async () => {
  const { deps, activated } = makeDeps([found]);
  await judgePending(deps, ['kashimadai'], true);
  assertEquals(activated, ['kashimadai']);
});

Deno.test(
  'AC-43: 行の名前と住所から作った手がかりで調べ、同じ名前・同じ県の候補を使う',
  async () => {
    const { deps, asked } = makeDeps([found]);
    await judgePending(deps, ['kashimadai'], false);
    assertEquals(asked, [{ name: '鹿島台神社', hint: { prefecture: '宮城県', city: '大崎市' } }]);
  }
);

Deno.test('AC-43: 一致する候補が無ければ pending のまま', async () => {
  for (const c of [
    [],
    [{ ...found, name: '鹿島神社' }],
    [{ ...found, prefecture: '福島県' }],
    null,
  ]) {
    const { deps, activated } = makeDeps(c);
    const [r] = await judgePending(deps, ['kashimadai'], true);
    assertEquals(r.status, 'pending');
    assertEquals(activated, []);
  }
});

Deno.test('AC-43: 基準で落ちれば pending（情報源が1つ）', async () => {
  const { deps, activated } = makeDeps([{ ...found, sources: [found.sources[0]] }]);
  const [r] = await judgePending(deps, ['kashimadai'], true);
  assertEquals(r, { id: 'kashimadai', name: '鹿島台神社', status: 'pending', failed: ['P-1'] });
  assertEquals(activated, []);
});
