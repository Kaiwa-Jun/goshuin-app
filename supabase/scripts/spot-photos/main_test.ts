// Deno テスト（CLI。一時フォルダのリポジトリの直下と作業フォルダで回す。ネットに出ない）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-302-spot-photo-band.md（S3 / AC-14・AC-17・AC-18、S4 / AC-25）
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { serializeJson } from '../spot-wikidata/match.ts';
import { BATCH2_DIR, type Gathered320, MANUAL_PATH, POOL_PATH, spots320 } from './batch2.ts';
import {
  fixtureCandidates,
  fixtureCandidates320,
  fixtureGathered,
  fixtureLedgerB2Json,
  fixtureManual,
  fixturePhotos,
  fixturePool,
  fixturePoolJson,
  fixtureTargets,
  makeRoot,
  readFixture,
  realMapping,
  realSeedRows,
  snapshot,
} from './fixtures/load.ts';
import { type CliIo, denoIo, runCli } from './main.ts';
import { CHECK_SQL_PATH, LEDGER_PATH, MIGRATION_PATH, parseLedger302 } from './select.ts';
import {
  buildCheckSql,
  buildMigrationSql,
  CHECK_SQL_PATH_BATCH2,
  MIGRATION_PATH_BATCH2,
} from './select.ts';

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

// --- #320 AC-8: pool ---

/**
 * 台帳のフィクスチャの root の対象（約 466 寺社）のうち Q-ID のある寺社の、集めた値を作業フォルダに置く。
 * 候補のフィクスチャの寺社は commons-b2/gather/ の値、ほかは何も集まらなかった値
 */
async function writeGathered(work: string): Promise<number> {
  const spots = spots320(await fixtureTargets(), await realMapping(), await fixtureManual());
  const known = await fixtureGathered();
  let n = 0;
  for (const s of spots) {
    if (s.qid === null) continue;
    const g: Gathered320 = known.get(s.idx) ?? {
      idx: s.idx,
      name: s.name,
      prefecture: s.prefecture,
      qid: s.qid,
      p373: s.p373,
      p18: s.p18,
      lists: { p373: [], p180: [] },
      truncated: [],
      files: [],
      missing: [],
    };
    const path = `${work}/${BATCH2_DIR}/gather/${s.idx}.json`;
    await Deno.mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
    await Deno.writeTextFile(path, serializeJson(g));
    n++;
  }
  return n;
}

Deno.test(
  'AC-8: pool は --root の spot-photos-320.json だけを書き（--work は書かない）、2回目も同じ中身',
  async () => {
    const root = await makeRoot({ ledger: true, manual: true });
    const work = await tempWork();
    try {
      await writeGathered(work);
      const rootBefore = await snapshot(root);
      const workBefore = await snapshot(work);
      const first = await run(['pool', '--root', root, '--work', work]);
      assertEquals(first.code, 0, first.err);
      assertStringIncludes(first.out, POOL_PATH);
      assertEquals(await snapshot(work), workBefore);
      const after = await snapshot(root);
      assertEquals(
        Object.keys(after).filter(k => !(k in rootBefore)),
        [POOL_PATH]
      );
      const text = after[POOL_PATH];
      const pool = JSON.parse(text);
      // 対象の全部を idx の順に持ち、フィクスチャの寺社は pool-320.json と同じ
      const targets = await fixtureTargets();
      assertEquals(
        pool.entries.map((e: { idx: number }) => e.idx),
        targets.map(t => t.idx)
      );
      const fixture = await fixturePoolJson();
      for (const e of fixture.entries) {
        assertEquals(
          pool.entries.find((x: { idx: number }) => x.idx === e.idx),
          e,
          String(e.name)
        );
      }
      assertEquals(pool.counts.targets, targets.length);
      assertEquals(text.match(/\d{4}-\d{2}-\d{2}T/), null);
      assertEquals(text.includes(work), false);

      const second = await run(['pool', '--root', root, '--work', work]);
      assertEquals(second.code, 0, second.err);
      assertStringIncludes(second.out, '変わるものは無い');
      assertEquals(await Deno.readTextFile(`${root}/${POOL_PATH}`), text);

      // --check: 同じなら 0。prettier で整形しても（JSON として同じなら）0
      assertEquals((await run(['pool', '--check', '--root', root, '--work', work])).code, 0);
      const pretty = JSON.stringify(pool);
      await Deno.writeTextFile(`${root}/${POOL_PATH}`, pretty);
      assertEquals((await run(['pool', '--check', '--root', root, '--work', work])).code, 0);
      // 値を1つ変えると 1 でファイルの名前を出し、書かない
      const changed = pretty.replace('"width":5472', '"width":5473');
      assert(changed !== pretty);
      await Deno.writeTextFile(`${root}/${POOL_PATH}`, changed);
      const bad = await run(['pool', '--check', '--root', root, '--work', work]);
      assertEquals(bad.code, 1);
      assertStringIncludes(bad.err, 'spot-photos-320.json');
      assertEquals(await Deno.readTextFile(`${root}/${POOL_PATH}`), changed);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'AC-8: Q-ID のある対象の寺社の集めた値が無いと、その寺社の名前と gather を出して 1',
  async () => {
    const root = await makeRoot({ ledger: true, manual: true });
    const work = await tempWork();
    try {
      await writeGathered(work);
      await Deno.remove(`${work}/${BATCH2_DIR}/gather/421.json`);
      const res = await run(['pool', '--root', root, '--work', work]);
      assertEquals(res.code, 1);
      assertStringIncludes(res.err, '伊勢神宮内宮（皇大神宮）（三重県）');
      assertStringIncludes(res.err, 'gather');
      assertEquals(POOL_PATH in (await snapshot(root)), false);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'AC-8: 手で結ぶ台帳の p373 を変えたあと（集めた値は前のまま）に pool を打つと、その寺社の名前を出して 1',
  async () => {
    const root = await makeRoot({ ledger: true, manual: true });
    const work = await tempWork();
    try {
      await writeGathered(work);
      const path = `${root}/${MANUAL_PATH}`;
      const manual = JSON.parse(await Deno.readTextFile(path));
      manual.entries[2].p373 = 'Ise Grand Shrine';
      await Deno.writeTextFile(path, serializeJson(manual));
      const res = await run(['pool', '--root', root, '--work', work]);
      assertEquals(res.code, 1);
      assertStringIncludes(res.err, '伊勢神宮内宮（皇大神宮）（三重県）');
      assertEquals(POOL_PATH in (await snapshot(root)), false);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

// --- #320 AC-9: candidates --batch 2 ---

/** 第1弾 3 行の台帳・#301・手で結ぶ台帳・第2弾の候補のフィクスチャを持つ root */
async function root320(): Promise<string> {
  return await makeRoot({ ledger: true, manual: true, pool: true });
}

Deno.test(
  'AC-9: candidates --batch 2 は <work>/b2/review/candidates.json だけを書き、ほかは1バイトも変えない',
  async () => {
    const root = await root320();
    const work = await tempWork();
    try {
      assertEquals((await run(['candidates', '--root', root, '--work', work])).code, 0);
      const rootBefore = await snapshot(root);
      const workBefore = await snapshot(work);
      const res = await run(['candidates', '--batch', '2', '--root', root, '--work', work]);
      assertEquals(res.code, 0, res.err);
      assertStringIncludes(res.out, `${BATCH2_DIR}/review/candidates.json`);
      assertEquals(await snapshot(root), rootBefore);
      const after = await snapshot(work);
      assertEquals(
        Object.keys(after).filter(k => !(k in workBefore)),
        ['b2/review/candidates.json']
      );
      for (const k of Object.keys(workBefore)) assertEquals(after[k], workBefore[k], k);

      const data = JSON.parse(after['b2/review/candidates.json']);
      assertEquals(data, await fixtureCandidates320());
      assertEquals(data.batch, 2);
      // 候補のファイルがある寺社だけ（idx の順）
      assertEquals(
        data.entries.map((e: { idx: number }) => e.idx),
        [41, 347, 348, 421, 544]
      );
      const manual = JSON.parse(await Deno.readTextFile(`${root}/${MANUAL_PATH}`));
      for (const e of data.entries) {
        if (e.linkConfidence === 'manual') {
          const m = manual.entries.find((x: { idx: number }) => x.idx === e.idx);
          assertEquals(e.basis, m.basis);
        } else assertEquals(e.basis, null);
        for (const f of e.files) {
          assert(f.sources.length > 0);
          assertStringIncludes(f.thumbUrl, '/1280px-');
          assertStringIncludes(f.gridUrl, '/250px-');
        }
      }
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test('AC-9: --batch に 1・2 のほかを渡すと 1', async () => {
  const root = await root320();
  const work = await tempWork();
  try {
    for (const v of ['3', '0', 'two']) {
      const res = await run(['candidates', '--batch', v, '--root', root, '--work', work]);
      assertEquals(res.code, 1, v);
      assertStringIncludes(res.err, '--batch');
    }
    assertEquals((await run(['candidates', '--batch'])).code, 1);
    assertEquals(Object.keys(await snapshot(work)), []);
  } finally {
    await Deno.remove(root, { recursive: true });
    await Deno.remove(work, { recursive: true });
  }
});

Deno.test(
  'fixtures/work/b2 の candidates.json は、フィクスチャから candidates --batch 2 で作ったものと同じ',
  async () => {
    const committed = JSON.parse(await readFixture('work/b2/review/candidates.json'));
    assertEquals(committed, await fixtureCandidates320());
  }
);

// --- #320 AC-11: status --batch 2 ---

async function writeChoices320(work: string, choices: unknown[]): Promise<void> {
  await Deno.mkdir(`${work}/${BATCH2_DIR}/review`, { recursive: true });
  await Deno.writeTextFile(
    `${work}/${BATCH2_DIR}/review/choices.json`,
    serializeJson({ schemaVersion: 1, issue: 302, choices })
  );
}

/** 第2弾: 採る 2（high 1・manual 1）・外す 1 */
async function someChoices320() {
  const c = await fixtureCandidates320();
  const of = (name: string) => c.entries.find(e => e.name === name)!;
  return [
    {
      idx: of('中尊寺').idx,
      decision: 'approve',
      file: 'Miyajima, daisho-in, 05.jpg',
      focusY: 0.5,
      linkChecked: false,
    },
    { idx: of('戸隠神社中社').idx, decision: 'reject', reason: 'quality' },
    {
      idx: of('伊勢神宮内宮（皇大神宮）').idx,
      decision: 'approve',
      file: 'Masumida Shrine Haiden.jpg',
      focusY: 0.45,
    },
  ];
}

Deno.test(
  'AC-11: status --batch 2 は 対象・候補あり・結べない・候補のファイルが無い・一覧が切れた と、決めた数・外した理由を出す',
  async () => {
    const root = await root320();
    const work = await tempWork();
    try {
      assertEquals(
        (await run(['candidates', '--batch', '2', '--root', root, '--work', work])).code,
        0
      );
      const none = await run(['status', '--batch', '2', '--work', work]);
      assertEquals(none.code, 0, none.err);
      const lines = none.out.trimEnd().split('\n');
      assertEquals(lines, [
        '対象 7・候補あり 5（high 1・medium 1・manual 3）・結べない 1・候補のファイルが無い 1・一覧が切れた 1',
        '決めた 0 / 5・採る 0（high 0・medium 0・manual 0）・外す 0・まだ 5',
        '外した理由: person 0・other-place 0・not-spot 0・quality 0・other 0',
      ]);
      // 対象 = 候補あり + 結べない + 候補のファイルが無い
      const [t, c, q, z] = lines[0]
        .match(/\d+/g)!
        .map(Number)
        .filter((_, i) => [0, 1, 5, 6].includes(i));
      assertEquals(t, c + q + z);

      await writeChoices320(work, await someChoices320());
      const some = await run(['status', '--batch', '2', '--work', work]);
      assertEquals(some.code, 0, some.err);
      assertStringIncludes(
        some.out,
        '決めた 3 / 5・採る 2（high 1・medium 0・manual 1）・外す 1・まだ 2'
      );
      assertStringIncludes(
        some.out,
        '外した理由: person 0・other-place 0・not-spot 0・quality 1・other 0'
      );
      // 第1弾の status（--batch なし）は第2弾の作業フォルダを見ない
      const first = await run(['status', '--work', work]);
      assertEquals(first.code, 1);
      assertStringIncludes(first.err, `${work}/review/candidates.json`);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

// --- #320 AC-12: export --batch 2 ---

Deno.test(
  'AC-12: export --batch 2 は第1弾の行を変えずに、採った寺社だけを batch: 2・idx の順で後ろに足す',
  async () => {
    const root = await root320();
    const work = await tempWork();
    try {
      const before = JSON.parse(await Deno.readTextFile(`${root}/${LEDGER_PATH}`));
      assertEquals(
        (await run(['candidates', '--batch', '2', '--root', root, '--work', work])).code,
        0
      );
      await writeChoices320(work, await someChoices320());
      const res = await run(['export', '--batch', '2', '--root', root, '--work', work]);
      assertEquals(res.code, 0, res.err);
      assertStringIncludes(res.err, 'まだ 2 件');

      const text = await Deno.readTextFile(`${root}/${LEDGER_PATH}`);
      const ledger = JSON.parse(text);
      for (const k of ['schemaVersion', 'issue', 'note', 'attribution']) {
        assertEquals(ledger[k], before[k], k);
      }
      assertEquals(ledger.entries.slice(0, 3), before.entries);
      assertEquals(
        ledger.entries
          .slice(3)
          .map((e: Record<string, unknown>) => [
            e.batch,
            e.idx,
            e.name,
            e.linkConfidence,
            e.linkChecked,
            e.file,
            e.focusY,
          ]),
        [
          [2, 41, '中尊寺', 'high', false, 'Miyajima, daisho-in, 05.jpg', 0.5],
          [2, 421, '伊勢神宮内宮（皇大神宮）', 'manual', true, 'Masumida Shrine Haiden.jpg', 0.45],
        ]
      );
      assertEquals(ledger, await fixtureLedgerB2Json());
      parseLedger302(text, await fixturePhotos(), await realSeedRows(), await fixturePool());
      for (const word of ['reason', 'quality', work, 'goshuin-work']) {
        assertEquals(text.includes(word), false, word);
      }

      // 2回打っても同じ文字
      const again = await run(['export', '--batch', '2', '--root', root, '--work', work]);
      assertEquals(again.code, 0, again.err);
      assertEquals(await Deno.readTextFile(`${root}/${LEDGER_PATH}`), text);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'AC-12: 第2弾の行のある台帳で export（--batch なし）を打つと、第2弾の行が残る',
  async () => {
    const root = await makeRoot({
      ledgerText: await readFixture('ledger-302-b2.json'),
      manual: true,
      pool: true,
    });
    const work = await tempWork();
    try {
      assertEquals((await run(['candidates', '--root', root, '--work', work])).code, 0);
      const c = await fixtureCandidates();
      const of = (name: string) => c.entries.find(e => e.name === name)!;
      await writeChoices(work, [
        {
          idx: of('北海道神宮頓宮').idx,
          decision: 'approve',
          file: of('北海道神宮頓宮').files[0].file,
          focusY: 0.6,
          linkChecked: true,
        },
        {
          idx: of('輪王寺').idx,
          decision: 'approve',
          file: of('輪王寺').files[0].file,
          focusY: 0.5,
        },
        {
          idx: of('金蛇水神社').idx,
          decision: 'approve',
          file: of('金蛇水神社').files[0].file,
          focusY: 0.42,
        },
      ]);
      const res = await run(['export', '--root', root, '--work', work]);
      assertEquals(res.code, 0, res.err);
      const ledger = JSON.parse(await Deno.readTextFile(`${root}/${LEDGER_PATH}`));
      const b2 = await fixtureLedgerB2Json();
      assertEquals(
        ledger.entries.map((e: Record<string, unknown>) => [e.batch, e.idx, e.focusY]),
        [
          [1, 4, 0.6],
          [1, 144, 0.5],
          [1, 1028, 0.42],
          [2, 41, 0.5],
          [2, 421, 0.45],
        ]
      );
      assertEquals(ledger.entries.slice(3), b2.entries.slice(3));
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

Deno.test(
  'AC-12: <work>/b2/review/candidates.json が、いまの候補から作るものと違うと書かずに 1',
  async () => {
    const root = await root320();
    const work = await tempWork();
    try {
      assertEquals(
        (await run(['candidates', '--batch', '2', '--root', root, '--work', work])).code,
        0
      );
      await writeChoices320(work, await someChoices320());
      const path = `${work}/${BATCH2_DIR}/review/candidates.json`;
      const data = JSON.parse(await Deno.readTextFile(path));
      data.entries[0].files[0].focus = 1;
      await Deno.writeTextFile(path, serializeJson(data));
      const before = await Deno.readTextFile(`${root}/${LEDGER_PATH}`);
      const res = await run(['export', '--batch', '2', '--root', root, '--work', work]);
      assertEquals(res.code, 1);
      assertStringIncludes(res.err, 'candidates.json');
      assertEquals(await Deno.readTextFile(`${root}/${LEDGER_PATH}`), before);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(work, { recursive: true });
    }
  }
);

// --- #320 AC-15: generate（弾ごと） ---

Deno.test(
  'AC-15: 第2弾の行のある台帳で generate は4ファイルを書き、第1弾の2ファイルは第2弾の行を除いて作ったものと同じ',
  async () => {
    const root = await makeRoot({
      ledgerText: await readFixture('ledger-302-b2.json'),
      manual: true,
      pool: true,
    });
    try {
      const first = await run(['generate', '--root', root]);
      assertEquals(first.code, 0, first.err);
      for (const p of [
        MIGRATION_PATH,
        CHECK_SQL_PATH,
        MIGRATION_PATH_BATCH2,
        CHECK_SQL_PATH_BATCH2,
      ]) {
        assertStringIncludes(first.out, p);
      }
      const read = (p: string) => Deno.readTextFile(`${root}/${p}`);
      const ledger = parseLedger302(
        await read(LEDGER_PATH),
        await fixturePhotos(),
        await realSeedRows(),
        await fixturePool()
      );
      const b1 = ledger.entries.filter(e => e.batch === 1);
      assertEquals(await read(MIGRATION_PATH), buildMigrationSql(b1));
      assertEquals(await read(CHECK_SQL_PATH), buildCheckSql({ ...ledger, entries: b1 }, 1109));
      // 第1弾だけの台帳から作ったものとも同じ
      const only1 = await makeRoot({ ledger: true });
      try {
        assertEquals((await run(['generate', '--root', only1])).code, 0);
        const s1 = await snapshot(only1);
        assertEquals(await read(MIGRATION_PATH), s1[MIGRATION_PATH]);
        assertEquals(await read(CHECK_SQL_PATH), s1[CHECK_SQL_PATH]);
        // 第1弾の行だけの台帳では第2弾の2ファイルを作らない
        assertEquals(MIGRATION_PATH_BATCH2 in s1, false);
        assertEquals(CHECK_SQL_PATH_BATCH2 in s1, false);
      } finally {
        await Deno.remove(only1, { recursive: true });
      }
      const m2 = await read(MIGRATION_PATH_BATCH2);
      const c2 = await read(CHECK_SQL_PATH_BATCH2);
      assertStringIncludes(m2, '-- Issue #320（#302 第2弾）');
      assertStringIncludes(m2, '伊勢神宮内宮（皇大神宮）');
      assertEquals(m2.includes('北海道神宮頓宮'), false);
      assertStringIncludes(c2, 'total=1109 listed=2');
      for (const text of [m2, c2, await read(MIGRATION_PATH), await read(CHECK_SQL_PATH)]) {
        assertEquals(text.match(/\d{4}-\d{2}-\d{2}T/), null);
        assertEquals(text.includes(HOME_DIRS), false);
        assertEquals(text.includes('goshuin-work'), false);
        assertEquals(text.includes(root), false);
      }

      const second = await run(['generate', '--root', root]);
      assertEquals(second.code, 0, second.err);
      assertStringIncludes(second.out, '変わるものは無い（4 ファイル）');
      assertEquals((await run(['generate', '--check', '--root', root])).code, 0);

      // 第2弾の行の値を1つ変えると --check は 1 で、第2弾の migration の名前を出して書かない
      const before = await snapshot(root);
      const ledgerPath = `${root}/${LEDGER_PATH}`;
      const raw = JSON.parse(await Deno.readTextFile(ledgerPath));
      raw.entries[4].focusY = 0.31;
      await Deno.writeTextFile(ledgerPath, serializeJson(raw));
      const bad = await run(['generate', '--check', '--root', root]);
      assertEquals(bad.code, 1);
      assertStringIncludes(bad.err, '20261004020000_spot_photos_302_batch2.sql');
      assertEquals(bad.err.includes(MIGRATION_PATH), false);
      const after = await snapshot(root);
      for (const p of [
        MIGRATION_PATH,
        CHECK_SQL_PATH,
        MIGRATION_PATH_BATCH2,
        CHECK_SQL_PATH_BATCH2,
      ]) {
        assertEquals(after[p], before[p], p);
      }
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  }
);
