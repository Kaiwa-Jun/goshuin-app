// Deno テスト（本物の台帳 supabase/data/spot-photos-302.json と、そこから作った生成物。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-302-spot-photo-band.md（S6 / AC-36・AC-38・AC-40）
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { parsePhotos } from '../spot-wikidata/match.ts';
import { readRepo, realMapping, realSeedRows, REPO } from './fixtures/load.ts';
import { type CliIo, denoIo, runCli } from './main.ts';
import { LEDGER_PATH, parseLedger302 } from './select.ts';

/** S6 で採った数（main.ts status の「採る」。progress.md に書いた値） */
export const APPROVED = 692;
/** そのうち結びつきが medium の数 */
export const APPROVED_MEDIUM = 22;

async function realLedger() {
  const photos = parsePhotos(
    await readRepo('supabase/data/spot-photos-301.json'),
    await realMapping()
  );
  return parseLedger302(await readRepo(LEDGER_PATH), photos, await realSeedRows());
}

Deno.test(
  'AC-36: 本物の台帳は検査を通り、全部が第1弾・承認済みで、数は status の「採る」と同じ',
  async () => {
    const ledger = await realLedger();
    assert(ledger.entries.length > 0);
    assertEquals(ledger.entries.length, APPROVED);
    assert(ledger.entries.every(e => e.batch === 1 && e.status === 'approved'));
    assertEquals(ledger.entries.filter(e => e.linkConfidence === 'medium').length, APPROVED_MEDIUM);
    assert(ledger.entries.every(e => e.linkConfidence === 'high' || e.linkChecked));
    assert(ledger.entries.every(e => e.isCropped));
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
