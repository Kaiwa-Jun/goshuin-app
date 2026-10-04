// Deno テスト（CLI。一時フォルダのリポジトリの直下と作業フォルダで回す。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-302-spot-photo-band.md（S3 / AC-14・AC-17・AC-18、S4 / AC-25）
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { serializeJson } from '../spot-wikidata/match.ts';
import {
  fixtureCandidates,
  fixturePhotos,
  makeRoot,
  readFixture,
  realSeedRows,
  snapshot,
} from './fixtures/load.ts';
import { type CliIo, denoIo, runCli } from './main.ts';
import { CHECK_SQL_PATH, LEDGER_PATH, MIGRATION_PATH, parseLedger302 } from './select.ts';

export function captureIo(over: Partial<CliIo> = {}) {
  let out = '';
  let err = '';
  const io: CliIo = {
    ...denoIo(),
    stdout: t => void (out += t),
    stderr: t => void (err += t),
    ...over,
  };
  return { io, out: () => out, err: () => err };
}

async function run(args: string[], over: Partial<CliIo> = {}) {
  const c = captureIo(over);
  const code = await runCli(args, c.io);
  return { code, out: c.out(), err: c.err() };
}

async function tempWork(): Promise<string> {
  return await Deno.makeTempDir({ prefix: 'spot-photos-work-' });
}

// --- AC-14: candidates ---

Deno.test(
  'AC-14: candidates は作業フォルダの review/candidates.json だけを書き、2回目も同じ中身',
  async () => {
    const root = await makeRoot();
    const work = await tempWork();
    try {
      const before = await snapshot(root);
      const first = await run(['candidates', '--root', root, '--work', work]);
      assertEquals(first.code, 0, first.err);
      assertStringIncludes(first.out, '15 寺社・18 ファイル');
      assertStringIncludes(first.out, 'high 14・medium 1');
      assertEquals(await snapshot(root), before);
      const written = await snapshot(work);
      assertEquals(Object.keys(written), ['review/candidates.json']);
      const data = JSON.parse(written['review/candidates.json']);
      assertEquals(data.entries.length, 15);
      assertEquals(data, await fixtureCandidates());

      const second = await run(['candidates', '--root', root, '--work', work]);
      assertEquals(second.code, 0, second.err);
      assertEquals(await snapshot(work), written);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'fixtures/work の candidates.json は、フィクスチャから candidates で作ったものと同じ',
  async () => {
    const committed = JSON.parse(await readFixture('work/review/candidates.json'));
    assertEquals(committed, await fixtureCandidates());
  }
);

// --- AC-17: status・export ---

/** ホームのパスの頭（文字のまま書くと、Q-14 の grep に当たる） */
const HOME_DIRS = ['', 'Users', ''].join('/');

const KANAHEBI_FILE = 'Haiden of Kanahebi-Suijinja shrine 1.JPG';

/** 採る 3（high 2・medium 1）・外す 2 */
async function someChoices() {
  const c = await fixtureCandidates();
  const of = (name: string) => c.entries.find(e => e.name === name)!;
  return {
    total: c.entries.length,
    choices: [
      {
        idx: of('北海道神宮頓宮').idx,
        decision: 'approve',
        file: of('北海道神宮頓宮').files[0].file,
        focusY: 0.6,
        linkChecked: true,
      },
      {
        idx: of('中尊寺').idx,
        decision: 'approve',
        file: of('中尊寺').files[0].file,
        focusY: 0.5,
        linkChecked: false,
      },
      { idx: of('中尊寺金色堂').idx, decision: 'reject', reason: 'other-place' },
      { idx: of('平等院').idx, decision: 'reject', reason: 'person' },
      {
        idx: of('金蛇水神社').idx,
        decision: 'approve',
        file: KANAHEBI_FILE,
        focusY: 0.42,
        linkChecked: false,
      },
    ],
  };
}

async function writeChoices(work: string, choices: unknown[]): Promise<void> {
  await Deno.mkdir(`${work}/review`, { recursive: true });
  await Deno.writeTextFile(
    `${work}/review/choices.json`,
    serializeJson({ schemaVersion: 1, issue: 302, choices })
  );
}

Deno.test(
  'AC-17: status は 決めた・採る（high・medium）・外す・まだ と、外した理由ごとの数を出す',
  async () => {
    const root = await makeRoot();
    const work = await tempWork();
    try {
      assertEquals((await run(['candidates', '--root', root, '--work', work])).code, 0);
      const none = await run(['status', '--work', work]);
      assertEquals(none.code, 0, none.err);
      assertStringIncludes(none.out, '決めた 0 / 15・採る 0（high 0・medium 0）・外す 0・まだ 15');

      const { choices } = await someChoices();
      await writeChoices(work, choices);
      const some = await run(['status', '--work', work]);
      assertEquals(some.code, 0, some.err);
      assertStringIncludes(some.out, '決めた 5 / 15・採る 3（high 2・medium 1）・外す 2・まだ 10');
      assertStringIncludes(
        some.out,
        '外した理由: person 1・other-place 1・not-spot 0・quality 0・other 0'
      );
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'AC-17: export は採った寺社だけを (batch, idx) の順で台帳に書き、まだがあれば標準エラーに出す',
  async () => {
    const root = await makeRoot();
    const work = await tempWork();
    try {
      assertEquals((await run(['candidates', '--root', root, '--work', work])).code, 0);
      const { choices } = await someChoices();
      await writeChoices(work, choices);
      const res = await run(['export', '--root', root, '--work', work]);
      assertEquals(res.code, 0, res.err);
      assertStringIncludes(res.err, 'まだ 10 件');
      assertStringIncludes(res.out, LEDGER_PATH);

      const text = await Deno.readTextFile(`${root}/${LEDGER_PATH}`);
      const ledger = parseLedger302(text, await fixturePhotos(), await realSeedRows());
      assertEquals(
        ledger.entries.map(e => [e.batch, e.idx, e.name, e.focusY, e.linkChecked]),
        [
          [1, 4, '北海道神宮頓宮', 0.6, true],
          [1, 41, '中尊寺', 0.5, false],
          [1, 1028, '金蛇水神社', 0.42, false],
        ]
      );
      assert(ledger.entries.every(e => e.status === 'approved' && e.isCropped));
      for (const word of ['reason', 'decided_at', 'other-place', 'person', work, 'goshuin-work']) {
        assertEquals(text.includes(word), false, word);
      }
      assertEquals(text.match(/\d{4}-\d{2}-\d{2}T/), null);
      assertEquals(text, serializeJson(ledger));

      // 2回目も同じ中身
      const again = await run(['export', '--root', root, '--work', work]);
      assertEquals(again.code, 0, again.err);
      assertEquals(await Deno.readTextFile(`${root}/${LEDGER_PATH}`), text);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'AC-17: 全部決めたら、まだを出さない。選んだものが決まりに合わなければ書かずに止める',
  async () => {
    const root = await makeRoot();
    const work = await tempWork();
    try {
      assertEquals((await run(['candidates', '--root', root, '--work', work])).code, 0);
      const { choices } = await someChoices();
      const decided = new Set(choices.map(c => c.idx));
      const rest = (await fixtureCandidates()).entries
        .filter(e => !decided.has(e.idx))
        .map(e => ({ idx: e.idx, decision: 'reject', reason: 'quality' }));
      const all = [...choices, ...rest].sort((a, b) => a.idx - b.idx);
      await writeChoices(work, all);
      const res = await run(['export', '--root', root, '--work', work]);
      assertEquals(res.code, 0, res.err);
      assertEquals(res.err.includes('まだ'), false, res.err);
      assertStringIncludes((await run(['status', '--work', work])).out, 'まだ 0');

      // medium を確かめずに採った choices.json（手で書き換えた）は書かずに止める
      await Deno.remove(`${root}/${LEDGER_PATH}`);
      await writeChoices(
        work,
        all.map(c => (c.idx === 4 ? { ...c, linkChecked: false } : c))
      );
      const bad = await run(['export', '--root', root, '--work', work]);
      assertEquals(bad.code, 1);
      assertStringIncludes(bad.err, '北海道神宮頓宮');
      assertEquals(await snapshot(root).then(s => LEDGER_PATH in s), false);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test('AC-17: 1件も採っていなければ export は書かずに止める', async () => {
  const root = await makeRoot();
  const work = await tempWork();
  try {
    assertEquals((await run(['candidates', '--root', root, '--work', work])).code, 0);
    const res = await run(['export', '--root', root, '--work', work]);
    assertEquals(res.code, 1);
    assertStringIncludes(res.err, '採ったものが無い');
    assertEquals(await snapshot(root).then(s => LEDGER_PATH in s), false);
  } finally {
    await Deno.remove(root, { recursive: true });
    await Deno.remove(work, { recursive: true });
  }
});

// --- AC-18: 無いファイル ---

Deno.test(
  'AC-18: spot-photos-301.json・対応表・candidates.json が無いと、無いファイルの名前を出して 1',
  async () => {
    const work = await tempWork();
    const noPhotos = await makeRoot({ photos: 'none' });
    const noMapping = await makeRoot({ mapping: false });
    try {
      for (const cmd of ['candidates', 'export']) {
        const res = await run([cmd, '--root', noPhotos, '--work', work]);
        assertEquals(res.code, 1, cmd);
        assertStringIncludes(res.err, 'spot-photos-301.json', cmd);
      }
      const m = await run(['candidates', '--root', noMapping, '--work', work]);
      assertEquals(m.code, 1);
      assertStringIncludes(m.err, 'spot-wikidata-301.json');

      // 作業フォルダに candidates.json が無い
      const s = await run(['status', '--work', work]);
      assertEquals(s.code, 1);
      assertStringIncludes(s.err, 'candidates.json');
      const e = await run(['export', '--root', noMapping, '--work', work]);
      assertEquals(e.code, 1);
    } finally {
      await Deno.remove(work, { recursive: true });
      await Deno.remove(noPhotos, { recursive: true });
      await Deno.remove(noMapping, { recursive: true });
    }
  }
);

Deno.test(
  '知らないサブコマンド・引数は 1。--work の既定は $HOME/goshuin-work/spot-photos',
  async () => {
    assertEquals((await run(['nope'])).code, 1);
    assertEquals((await run(['status', '--nope'])).code, 1);
    const home = await tempWork();
    try {
      const res = await run(['status'], { env: name => (name === 'HOME' ? home : undefined) });
      assertEquals(res.code, 1);
      assertStringIncludes(res.err, `${home}/goshuin-work/spot-photos/review/candidates.json`);
    } finally {
      await Deno.remove(home, { recursive: true });
    }
  }
);

// --- AC-25: generate ---

Deno.test(
  'AC-25: generate は2つのファイルを書き、2回目は変わるものが無い。--check は同じなら 0',
  async () => {
    const root = await makeRoot({ ledger: true });
    try {
      const first = await run(['generate', '--root', root]);
      assertEquals(first.code, 0, first.err);
      assertStringIncludes(first.out, MIGRATION_PATH);
      assertStringIncludes(first.out, CHECK_SQL_PATH);
      const migration = await Deno.readTextFile(`${root}/${MIGRATION_PATH}`);
      const check = await Deno.readTextFile(`${root}/${CHECK_SQL_PATH}`);
      for (const text of [migration, check]) {
        assertEquals(text.match(/\d{4}-\d{2}-\d{2}T/), null);
        assertEquals(text.includes(HOME_DIRS), false);
        assertEquals(text.includes('goshuin-work'), false);
        assertEquals(text.includes(root), false);
      }
      assertStringIncludes(migration, '金蛇水神社');
      assertStringIncludes(check, 'total=1109 listed=3');

      const second = await run(['generate', '--root', root]);
      assertEquals(second.code, 0, second.err);
      assertStringIncludes(second.out, '変わるものは無い');

      const ok = await run(['generate', '--check', '--root', root]);
      assertEquals(ok.code, 0, ok.err);
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  }
);

Deno.test(
  'AC-25: 台帳の値を1つ変えると --check は 1 で違うファイルの名前を出し、書かない',
  async () => {
    const root = await makeRoot({ ledger: true });
    try {
      assertEquals((await run(['generate', '--root', root])).code, 0);
      const before = await snapshot(root);
      const ledgerPath = `${root}/${LEDGER_PATH}`;
      const ledger = JSON.parse(await Deno.readTextFile(ledgerPath));
      ledger.entries[2].focusY = 0.31;
      await Deno.writeTextFile(ledgerPath, serializeJson(ledger));
      const res = await run(['generate', '--check', '--root', root]);
      assertEquals(res.code, 1);
      assertStringIncludes(res.err, MIGRATION_PATH);
      assertStringIncludes(res.err, CHECK_SQL_PATH);
      const after = await snapshot(root);
      assertEquals(after[MIGRATION_PATH], before[MIGRATION_PATH]);
      assertEquals(after[CHECK_SQL_PATH], before[CHECK_SQL_PATH]);
      // 書くと --check が通る
      assertEquals((await run(['generate', '--root', root])).code, 0);
      assertEquals((await run(['generate', '--check', '--root', root])).code, 0);
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  }
);

Deno.test(
  'AC-18: 台帳が無いと generate・fetch・upload・verify は台帳の名前を出して 1',
  async () => {
    const root = await makeRoot();
    const work = await tempWork();
    try {
      for (const args of [['generate'], ['fetch'], ['upload', '--dry-run'], ['verify']]) {
        const res = await run([...args, '--root', root, '--work', work], {
          env: name => (name === 'HOME' ? work : 'x'),
          fetch: () => Promise.reject(new Error('呼ばない')),
        });
        assertEquals(res.code, 1, args[0]);
        assertStringIncludes(res.err, 'spot-photos-302.json', args[0]);
      }
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test('AC-18: 台帳の行が #301 と合わないと、寺社の名前を出して 1', async () => {
  const root = await makeRoot({ ledger: true });
  try {
    const ledgerPath = `${root}/${LEDGER_PATH}`;
    const ledger = JSON.parse(await Deno.readTextFile(ledgerPath));
    ledger.entries[1].author = 'someone else';
    await Deno.writeTextFile(ledgerPath, serializeJson(ledger));
    const res = await run(['generate', '--root', root]);
    assertEquals(res.code, 1);
    assertStringIncludes(res.err, '輪王寺（栃木県）');
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
