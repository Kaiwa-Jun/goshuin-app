// Deno テスト（本物の台帳 supabase/data/spot-photos-302.json と、そこから作った生成物。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-302-spot-photo-band.md（S6 / AC-36・AC-38・AC-40）
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { parsePhotos } from '../spot-wikidata/match.ts';
import { readRepo, realMapping, realSeedRows, REPO } from './fixtures/load.ts';
import { type CliIo, denoIo, runCli } from './main.ts';
import { LEDGER_PATH, parseLedger302 } from './select.ts';
import {
  checkPoolTargets,
  MANUAL_PATH,
  parseManual320,
  parsePool320,
  POOL_PATH,
  targets320,
} from './batch2.ts';

/** S6 で採った数（main.ts status の「採る」。progress.md に書いた値） */
export const APPROVED = 688;
/** そのうち結びつきが medium の数 */
export const APPROVED_MEDIUM = 19;
export const APPROVED_BATCH2 = 89;
export const MANUAL_BATCH2 = 24;

export async function realBatch2Data() {
  const rows = await realSeedRows();
  const mapping = await realMapping();
  const photos = parsePhotos(await readRepo('supabase/data/spot-photos-301.json'), mapping);
  const raw = JSON.parse(await readRepo(LEDGER_PATH));
  const ledger1 = parseLedger302(
    { ...raw, entries: raw.entries.filter((e: { batch: number }) => e.batch === 1) },
    photos,
    rows
  );
  const targets = targets320(rows, ledger1);
  const manual = parseManual320(await readRepo(MANUAL_PATH), rows, mapping, targets);
  const pool = parsePool320(await readRepo(POOL_PATH), {
    rows,
    mapping,
    manual,
    targets,
    photos301: photos,
    ledger: ledger1,
  });
  return { rows, mapping, targets, manual, pool, ledger: parseLedger302(raw, photos, rows, pool) };
}

async function realLedger() {
  return (await realBatch2Data()).ledger;
}

Deno.test(
  'AC-36: 本物の台帳は検査を通り、全部が第1弾・承認済みで、数は status の「採る」と同じ',
  async () => {
    const all = await realLedger();
    const ledger = { ...all, entries: all.entries.filter(e => e.batch === 1) };
    assert(ledger.entries.length > 0);
    assertEquals(ledger.entries.length, APPROVED);
    assert(ledger.entries.every(e => e.batch === 1 && e.status === 'approved'));
    assertEquals(ledger.entries.filter(e => e.linkConfidence === 'medium').length, APPROVED_MEDIUM);
    assert(ledger.entries.every(e => e.linkConfidence === 'high' || e.linkChecked));
    assert(ledger.entries.every(e => e.isCropped));
  }
);

Deno.test('#320 AC-19〜21: 本物の手動対応・候補150件・第2弾89件が規則を通る', async () => {
  const { targets, manual, pool, ledger } = await realBatch2Data();
  assertEquals(manual.entries.length, MANUAL_BATCH2);
  checkPoolTargets(pool, targets);
  assertEquals(pool.entries.length, 150);
  assertEquals(pool.counts.withFiles + pool.counts.noQid + pool.counts.noFiles, 150);
  assertEquals(pool.counts.noQid, 50 - MANUAL_BATCH2);
  assertEquals(pool.counts.manual, MANUAL_BATCH2);
  assert(pool.entries.every(e => e.files.length <= 30));
  const batch2 = ledger.entries.filter(e => e.batch === 2);
  assertEquals(batch2.length, APPROVED_BATCH2);
  assert(batch2.every(e => e.status === 'approved' && targets.some(t => t.idx === e.idx)));
  assert(batch2.filter(e => e.linkConfidence === 'manual').every(e => e.linkChecked));
});

Deno.test(
  '#320 AC-25: 本物の台帳で第1弾688キーの偽R2にdry-runし、新規89件だけを数える（b2不要）',
  async () => {
    const ledger = await realLedger();
    const work = await Deno.makeTempDir({ prefix: 'spot-photos-cache-only-' });
    try {
      await Deno.mkdir(`${work}/cache`);
      for (const e of ledger.entries) {
        await Deno.writeFile(
          `${work}/cache/${e.sha1}.${e.r2Key.endsWith('.png') ? 'png' : 'jpg'}`,
          new Uint8Array()
        );
      }
      let out = '';
      const io: CliIo = {
        ...denoIo(),
        env: () => 'fixture-only',
        stdout: t => void (out += t),
        fetch: async (input, init) => {
          const request = new Request(input, init);
          assertEquals(request.method, 'GET');
          assertEquals(new URL(request.url).searchParams.get('list-type'), '2');
          return new Response(
            `<ListBucketResult>${ledger.entries
              .filter(e => e.batch === 1)
              .map(e => `<Contents><Key>${e.r2Key}</Key></Contents>`)
              .join('')}<IsTruncated>false</IsTruncated></ListBucketResult>`
          );
        },
      };
      const root = decodeURIComponent(new URL('.', REPO).pathname);
      assertEquals(await runCli(['upload', '--dry-run', '--root', root, '--work', work], io), 0);
      assertEquals(
        out,
        '台帳 777 件 / R2 に既にある 688 件 / 置く 89 件 / キャッシュに無い 0 件\n'
      );
    } finally {
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'AC-38: 誤りと分かっている結びつきと、別の神社の写真が無い。sha1 が重ならない',
  async () => {
    const ledger = await realLedger();
    const has = (name: string, prefecture: string) =>
      ledger.entries.find(e => e.name === name && e.prefecture === prefecture);
    assertEquals(has('尾張猿田彦神社', '愛知県'), undefined);
    assertEquals(has('円福寺', '宮城県'), undefined);
    const sano = has('狭野神社', '宮崎県');
    assert(sano === undefined || sano.file !== 'Tsuno Shrine 2009 001.JPG');
    assertEquals(new Set(ledger.entries.map(e => e.sha1)).size, ledger.entries.length);
    assertEquals(new Set(ledger.entries.map(e => e.r2Key)).size, ledger.entries.length);
  }
);

Deno.test(
  'AC-40: コミットした migration と確かめる SQL は、台帳から作るものと同じ（generate --check が 0）',
  async () => {
    let err = '';
    const io: CliIo = { ...denoIo(), stdout: () => {}, stderr: t => void (err += t) };
    const root = decodeURIComponent(new URL('.', REPO).pathname);
    assertEquals(await runCli(['generate', '--check', '--root', root], io), 0, err);
  }
);
