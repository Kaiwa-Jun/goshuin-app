// Deno テスト（CLI の runCli。一時フォルダを --root にして、本物のファイルの読み書きで確かめる）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-coords/
// 契約書: docs/issues/issue-292-spot-coords.md（S1 / AC-10）
import { assert, assertEquals, assertMatch, assertStringIncludes } from 'jsr:@std/assert@1';

import { CHECK_SQL_PATH, LEDGER_PATH, type Ledger, migrationPath, SEED_FILES } from './coords.ts';
import { type CliIo, denoIo, runCli } from './main.ts';

const CHUBU = 'supabase/seeds/03_chubu.sql';
const VERSION = '20260928000000';
const MIGRATION = migrationPath(VERSION, 1);

/** 寺社の行を1つ持つ seed（ファイルごとに名前を変える） */
function tinySeed(i: number): string {
  return [
    '-- テスト用',
    'INSERT INTO spots (name, lat, lng, type, address, prefecture, rank, status) VALUES',
    `('ほかの寺${i}', 35.0${i}, 135.0${i}, 'temple', '京都府京都市', '京都府', 1, 'active')`,
    ';',
    '',
  ].join('\n');
}

const CHUBU_TEXT = [
  '-- 中部',
  'INSERT INTO spots (name, lat, lng, type, address, prefecture, rank, status) VALUES',
  "('尊永寺', 34.7669, 137.8116, 'temple', '静岡県袋井市豊沢2777', '静岡県', 4, 'active'),",
  '-- 住所確認: ホトカミ ✓, Wikipedia ✓ | 座標: Wikipedia推定 ✓',
  "('若狭姫神社', 35.4731, 135.7927, 'shrine', '福井県小浜市遠敷65-41', '福井県', 4, 'active'),",
  '-- 住所確認: ホトカミ ✓ | 座標: NAVITIME推定 ✓',
  "('修禅寺', 34.9729, 138.9346, 'temple', '静岡県伊豆市修善寺964', '静岡県', 4, 'active')",
  '-- 住所確認: ホトカミ ✓ | 座標: Wikipedia推定 ✓',
  ';',
  '',
].join('\n');

const DRAFT = {
  meta: { issue: 292 },
  items: [
    {
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
      reason: 'テストの根拠',
      source_ref: 'Q11555090',
    },
    {
      idx: 306,
      name: '若狭姫神社',
      prefecture: '福井県',
      file: CHUBU,
      line: 5,
      prod_match: { name: '若狭姫神社', prefecture: '福井県', lat: 35.4731, lng: 135.7927 },
      seed: { lat: 35.4731, lng: 135.7927 },
      decision: 'check_decided',
      lat: 35.4790577,
      lng: 135.7805249,
      source: 'osmc0',
      confidence: '高',
      reason: 'OSM 同名候補',
      source_ref: 'way/799099092',
    },
    {
      // 選ばれない（keep）
      idx: 400,
      name: '修禅寺',
      prefecture: '静岡県',
      file: CHUBU,
      line: 7,
      prod_match: { name: '修禅寺', prefecture: '静岡県', lat: 34.9729, lng: 138.9346 },
      seed: { lat: 34.9729, lng: 138.9346 },
      decision: 'keep',
      lat: 34.9729,
      lng: 138.9346,
      source: 'seed',
      confidence: null,
      reason: 'そのまま',
    },
  ],
};

const OWNER = {
  issue: 292,
  exported_at: '2026-09-28T00:00:00.000Z',
  count: 2,
  items: [
    {
      idx: 400,
      name: '修禅寺',
      prefecture: '静岡県',
      file: '03_chubu.sql',
      line: 7,
      verdict: 'check',
      priority: 'high',
      seed: { lat: 34.9729, lng: 138.9346 },
      choice: 'custom',
      lat: 34.9701234,
      lng: 138.9301234,
      note: '',
      chosen_at: '2026-09-28T00:00:00.000Z',
    },
    {
      idx: 401,
      name: '見ない寺',
      prefecture: '静岡県',
      file: '03_chubu.sql',
      line: 9,
      verdict: 'check',
      priority: 'low',
      seed: { lat: 34.9, lng: 138.9 },
      choice: 'seed',
      lat: null,
      lng: null,
      note: '',
      chosen_at: '2026-09-28T00:00:00.000Z',
    },
  ],
};

interface Run {
  code: number;
  out: string;
  err: string;
  writes: string[];
}

interface Env {
  root: string;
  run: (...args: string[]) => Promise<Run>;
  read: (rel: string) => Promise<string>;
  write: (rel: string, text: string) => Promise<void>;
  exists: (rel: string) => Promise<boolean>;
}

async function withRoot(fn: (env: Env) => Promise<void>): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: 'spot-coords-' });
  const base = denoIo();
  const env: Env = {
    root,
    run: async (...args) => {
      const r: Run = { code: -1, out: '', err: '', writes: [] };
      const io: CliIo = {
        readTextFile: p => base.readTextFile(p),
        writeTextFile: async (p, t) => {
          r.writes.push(p);
          await base.writeTextFile(p, t);
        },
        stdout: t => {
          r.out += t;
        },
        stderr: t => {
          r.err += t;
        },
      };
      r.code = await runCli([...args, '--root', root], io);
      return r;
    },
    read: rel => Deno.readTextFile(`${root}/${rel}`),
    write: (rel, text) => base.writeTextFile(`${root}/${rel}`, text),
    exists: async rel => (await base.readTextFile(`${root}/${rel}`)) !== null,
  };
  try {
    for (const [i, f] of SEED_FILES.entries()) {
      await env.write(f, f === CHUBU ? CHUBU_TEXT : tinySeed(i));
    }
    await env.write('in/draft.json', JSON.stringify(DRAFT));
    await env.write('in/owner.json', JSON.stringify(OWNER));
    await fn(env);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

const draftPath = (env: Env) => `${env.root}/in/draft.json`;
const ownerPath = (env: Env) => `${env.root}/in/owner.json`;

Deno.test(
  'AC-10: import-draft --dry-run は台帳を標準出力に出すだけで、ファイルを書かない',
  async () => {
    await withRoot(async env => {
      const r = await env.run(
        'import-draft',
        draftPath(env),
        '--preset',
        'batch1',
        '--batch',
        '1',
        '--dry-run'
      );
      assertEquals(r.code, 0, r.err);
      assertEquals(r.writes, []);
      assertEquals(await env.exists(LEDGER_PATH), false);
      const ledger = JSON.parse(r.out) as Ledger;
      assertEquals(
        ledger.entries.map(e => [e.name, e.source, e.ref]),
        [
          ['尊永寺', 'wikidata', 'Q11555090'],
          ['若狭姫神社', 'osm', 'way/799099092'],
        ]
      );
    });
  }
);

Deno.test(
  'AC-10: import-draft は台帳を書き、同じ寺社をもう一度入れると止まって台帳は変わらない',
  async () => {
    await withRoot(async env => {
      const first = await env.run(
        'import-draft',
        draftPath(env),
        '--preset',
        'batch1',
        '--batch',
        '1'
      );
      assertEquals(first.code, 0, first.err);
      assertEquals(first.writes, [`${env.root}/${LEDGER_PATH}`]);
      const before = await env.read(LEDGER_PATH);

      const again = await env.run(
        'import-draft',
        draftPath(env),
        '--preset',
        'batch1',
        '--batch',
        '1'
      );
      assertEquals(again.code, 1);
      assertStringIncludes(again.err, '尊永寺');
      assertEquals(again.writes, []);
      assertEquals(await env.read(LEDGER_PATH), before);
    });
  }
);

Deno.test(
  'AC-10: import-owner --dry-run はファイルを書かず、seed を選んだ行は入れない',
  async () => {
    await withRoot(async env => {
      await env.run('import-draft', draftPath(env), '--preset', 'batch1', '--batch', '1');
      const before = await env.read(LEDGER_PATH);
      const r = await env.run('import-owner', ownerPath(env), '--batch', '2', '--dry-run');
      assertEquals(r.code, 0, r.err);
      assertEquals(r.writes, []);
      assertEquals(await env.read(LEDGER_PATH), before);
      const ledger = JSON.parse(r.out) as Ledger;
      assertEquals(
        ledger.entries.map(e => [e.batch, e.name, e.source]),
        [
          [1, '尊永寺', 'wikidata'],
          [1, '若狭姫神社', 'osm'],
          [2, '修禅寺', 'owner'],
        ]
      );
    });
  }
);

Deno.test('AC-10: import-owner は台帳にある寺社が来たら止まり、台帳は変わらない', async () => {
  await withRoot(async env => {
    await env.run('import-draft', draftPath(env), '--preset', 'batch1', '--batch', '1');
    const before = await env.read(LEDGER_PATH);
    const dup = {
      ...OWNER,
      items: [
        {
          ...OWNER.items[0],
          idx: 391,
          name: '尊永寺',
          line: 3,
          seed: { lat: 34.7669, lng: 137.8116 },
        },
      ],
    };
    await env.write('in/dup.json', JSON.stringify(dup));
    const r = await env.run('import-owner', `${env.root}/in/dup.json`, '--batch', '2');
    assertEquals(r.code, 1);
    assertStringIncludes(r.err, '尊永寺');
    assertEquals(r.writes, []);
    assertEquals(await env.read(LEDGER_PATH), before);
  });
});

Deno.test('AC-10: import-owner は国土地理院の選択で止まる', async () => {
  await withRoot(async env => {
    const gsi = { ...OWNER, items: [{ ...OWNER.items[0], choice: 'gsi' }] };
    await env.write('in/gsi.json', JSON.stringify(gsi));
    const r = await env.run('import-owner', `${env.root}/in/gsi.json`, '--batch', '2');
    assertEquals(r.code, 1);
    assertStringIncludes(r.err, '地理院');
    assertStringIncludes(r.err, '修禅寺');
    assertEquals(r.writes, []);
  });
});

Deno.test(
  'AC-10: generate --check は、生成物が無い・1バイト違うと 1 で名前を出し、書かない。同じなら 0',
  async () => {
    await withRoot(async env => {
      await env.run('import-draft', draftPath(env), '--preset', 'batch1', '--batch', '1');
      const gen = ['generate', '--batch', '1', '--version', VERSION];

      // 生成物が無い（seed はまだ旧座標）
      const missing = await env.run(...gen, '--check');
      assertEquals(missing.code, 1);
      assertStringIncludes(missing.err, MIGRATION);
      assertStringIncludes(missing.err, CHECK_SQL_PATH);
      assertStringIncludes(missing.err, CHUBU);
      assertEquals(missing.writes, []);
      assertEquals(await env.exists(MIGRATION), false);

      // 作る
      const made = await env.run(...gen);
      assertEquals(made.code, 0, made.err);
      assertEquals(
        [...made.writes].sort(),
        [MIGRATION, CHECK_SQL_PATH, CHUBU].map(p => `${env.root}/${p}`).sort()
      );
      const chubu = (await env.read(CHUBU)).split('\n');
      assertEquals(chubu.length, CHUBU_TEXT.split('\n').length);
      assertMatch(chubu[2], /^\('尊永寺', 34\.737787, 137\.977230,/);
      assertStringIncludes(chubu[5], '© OpenStreetMap contributors, ODbL');

      // 同じなら 0
      const same = await env.run(...gen, '--check');
      assertEquals(same.code, 0, same.err);
      assertEquals(same.writes, []);

      // もう一度作っても1バイトも変わらない
      const before = await Promise.all([MIGRATION, CHECK_SQL_PATH, CHUBU].map(p => env.read(p)));
      const again = await env.run(...gen);
      assertEquals(again.code, 0);
      assertEquals(again.writes, []);
      assertEquals(
        await Promise.all([MIGRATION, CHECK_SQL_PATH, CHUBU].map(p => env.read(p))),
        before
      );

      // 1バイト違う
      const sql = await env.read(MIGRATION);
      await env.write(MIGRATION, sql.replace('1e-6', '1e-7'));
      const diff = await env.run(...gen, '--check');
      assertEquals(diff.code, 1);
      assertStringIncludes(diff.err, MIGRATION);
      assert(!diff.err.includes(CHECK_SQL_PATH));
      assertEquals(diff.writes, []);
      assertEquals(await env.read(MIGRATION), sql.replace('1e-6', '1e-7'));
    });
  }
);

Deno.test('generate: 台帳に無い弾・版の形が違う・seed が合わないときは 1 で止まる', async () => {
  await withRoot(async env => {
    await env.run('import-draft', draftPath(env), '--preset', 'batch1', '--batch', '1');
    assertEquals((await env.run('generate', '--batch', '2', '--version', VERSION)).code, 1);
    assertEquals((await env.run('generate', '--batch', '1', '--version', '2026')).code, 1);
    await env.write(CHUBU, CHUBU_TEXT.replace('34.7669', '34.7000'));
    const bad = await env.run('generate', '--batch', '1', '--version', VERSION);
    assertEquals(bad.code, 1);
    assertStringIncludes(bad.err, `${CHUBU}:3 尊永寺`);
    assertEquals(bad.writes, []);
  });
});

Deno.test('revert は戻す SQL を標準出力に出すだけで、ファイルを書かない', async () => {
  await withRoot(async env => {
    await env.run('import-draft', draftPath(env), '--preset', 'batch1', '--batch', '1');
    const r = await env.run('revert', '--batch', '1');
    assertEquals(r.code, 0, r.err);
    assertEquals(r.writes, []);
    assertStringIncludes(r.out, 'DO $spot_coords_292$');
    assertStringIncludes(r.out, 'batch1 revert');
    assertStringIncludes(r.out, '"old_lat":34.737787');
  });
});

Deno.test('知らないサブコマンド・引数は 1 で止まる', async () => {
  await withRoot(async env => {
    assertEquals((await env.run('nope')).code, 1);
    assertEquals(
      (await env.run('import-draft', draftPath(env), '--preset', 'all', '--batch', '1')).code,
      1
    );
    assertEquals(
      (await env.run('generate', '--batch', '1', '--version', VERSION, '--force')).code,
      1
    );
  });
});
