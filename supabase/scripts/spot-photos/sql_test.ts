// Deno テスト（PGlite に、本物の migration と、台帳から作る SQL をそのまま流す）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
//   ⚠ --node-modules-dir=none が要る（無いとルートの package.json 経由で npm: の解決に失敗する）
//
// 契約書: docs/issues/issue-302-spot-photo-band.md（S1 / AC-1・AC-2、S4 / AC-23・AC-24）
//
// PGlite は Postgres 17 の WASM。Supabase のロールと auth.role() は無いので、ここで作り物を足す:
// ロール anon・authenticated・service_role、auth.role()（request.jwt.claim.role を返す）、
// Supabase の既定の権限の代わりの GRANT。本番の RLS は H-10・H-13 の確かめる SQL で見る
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { PGlite } from 'npm:@electric-sql/pglite@0.3.16';

import { SEED_FILES } from '../spot-coords/coords.ts';
import { fixtureLedgerJson, fixturePhotos, realSeedRows } from './fixtures/load.ts';
import {
  buildCheckSql,
  buildMigrationSql,
  type Ledger302,
  type LedgerEntry302,
  parseLedger302,
} from './select.ts';

const REPO = new URL('../../../', import.meta.url);
const readRepo = (rel: string) => Deno.readTextFile(new URL(rel, REPO));

const DDL_PATH = 'supabase/migrations/20261004000000_create_spot_photos.sql';

/** spots の最小の形（spot-coords/sql_test.ts と同じ）と、Supabase のロール・auth.role() の作り物 */
const SCHEMA = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
CREATE TYPE public.spot_type AS ENUM ('shrine', 'temple');
CREATE TYPE public.spot_status AS ENUM ('active', 'pending', 'merged');
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TABLE public.spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  type public.spot_type NOT NULL,
  address TEXT,
  prefecture TEXT,
  rank INTEGER NOT NULL DEFAULT 1,
  status public.spot_status NOT NULL DEFAULT 'active',
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER on_spots_updated
  BEFORE UPDATE ON public.spots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
`;

/** Supabase の既定の権限の代わり（anon・authenticated も表の権限は持ち、RLS で絞られる） */
const GRANTS = `
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spot_photos TO anon, authenticated, service_role;
`;

export async function withDb(
  fn: (db: PGlite) => Promise<void>,
  opts: { ddl?: boolean } = {}
): Promise<void> {
  const db = await PGlite.create();
  try {
    await db.exec(SCHEMA);
    if (opts.ddl !== false) {
      await db.exec(await readRepo(DDL_PATH));
      await db.exec(GRANTS);
    }
    await fn(db);
  } finally {
    await db.close();
  }
}

/** RAISE EXCEPTION の文（例外にならなければ null） */
export async function raised(db: PGlite, sql: string): Promise<string | null> {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export async function insertSpot(
  db: PGlite,
  name: string,
  prefecture: string,
  by: string | null = null
): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO public.spots (name, lat, lng, type, prefecture, created_by_user_id)
     VALUES ($1, 35, 139, 'shrine', $2, $3) RETURNING id::text AS id`,
    [name, prefecture, by]
  );
  return res.rows[0].id;
}

export const sha = (c: string) => c.repeat(40);

export interface PhotoValues {
  spot_id: string;
  r2_key: string;
  width: number;
  height: number;
  focus_y: number;
  author: string | null;
  license: string;
  license_url: string | null;
  source_url: string;
  is_cropped: boolean;
  status: string;
}

export function photoValues(spotId: string, over: Partial<PhotoValues> = {}): PhotoValues {
  return {
    spot_id: spotId,
    r2_key: `spot-photos/${sha('a')}.jpg`,
    width: 4032,
    height: 3024,
    focus_y: 0.5,
    author: 'Bachstelze',
    license: 'CC BY-SA 3.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/3.0',
    source_url: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    is_cropped: true,
    status: 'approved',
    ...over,
  };
}

const COLUMNS = [
  'spot_id',
  'r2_key',
  'width',
  'height',
  'focus_y',
  'author',
  'license',
  'license_url',
  'source_url',
  'is_cropped',
  'status',
] as const;

export function insertPhotoSql(v: PhotoValues): string {
  const lit = (x: string | number | boolean | null) =>
    x === null ? 'NULL' : typeof x === 'string' ? `'${x.replaceAll("'", "''")}'` : String(x);
  return `INSERT INTO public.spot_photos (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(c =>
    lit(v[c])
  ).join(', ')});`;
}

export async function insertPhoto(db: PGlite, v: PhotoValues): Promise<string | null> {
  return await raised(db, insertPhotoSql(v));
}

export async function photoCount(db: PGlite): Promise<number> {
  const res = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.spot_photos');
  return res.rows[0].n;
}

/** 全行（spot_id の順。updated_at を除く） */
export async function photoRows(db: PGlite): Promise<Record<string, unknown>[]> {
  const res = await db.query<Record<string, unknown>>(
    `SELECT ${COLUMNS.join(', ')} FROM public.spot_photos ORDER BY r2_key`
  );
  return res.rows;
}

// --- AC-1: 表・制約・トリガー・RLS ---

Deno.test('AC-1: spot_photos に D-2 の列があり、RLS が有効で、ポリシーが2つ', async () => {
  await withDb(async db => {
    const cols = await db.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'spot_photos'
        ORDER BY ordinal_position`
    );
    assertEquals(
      cols.rows.map(c => [c.column_name, c.data_type, c.is_nullable]),
      [
        ['id', 'uuid', 'NO'],
        ['spot_id', 'uuid', 'NO'],
        ['r2_key', 'text', 'NO'],
        ['width', 'integer', 'NO'],
        ['height', 'integer', 'NO'],
        ['focus_y', 'real', 'NO'],
        ['author', 'text', 'YES'],
        ['license', 'text', 'NO'],
        ['license_url', 'text', 'YES'],
        ['source_url', 'text', 'NO'],
        ['is_cropped', 'boolean', 'NO'],
        ['status', 'text', 'NO'],
        ['created_at', 'timestamp with time zone', 'NO'],
        ['updated_at', 'timestamp with time zone', 'NO'],
      ]
    );
    const defaults = Object.fromEntries(cols.rows.map(c => [c.column_name, c.column_default]));
    assertEquals(defaults.id, 'gen_random_uuid()');
    assertEquals(defaults.is_cropped, 'true');
    assertEquals(defaults.status, "'approved'::text");
    assertEquals(defaults.created_at, 'now()');
    assertEquals(defaults.updated_at, 'now()');

    const rls = await db.query<{ on: boolean }>(
      `SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.spot_photos'::regclass`
    );
    assertEquals(rls.rows[0].on, true);

    const policies = await db.query<{ policyname: string; cmd: string; qual: string }>(
      `SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'spot_photos' ORDER BY policyname`
    );
    assertEquals(
      policies.rows.map(p => [p.policyname, p.cmd]),
      [
        ['Anyone can view approved spot photos', 'SELECT'],
        ['Service role can manage spot photos', 'ALL'],
      ]
    );
  });
});

Deno.test('AC-1: 正しい行は入り、決まりに合わない行は入らない', async () => {
  await withDb(async db => {
    const a = await insertSpot(db, '金蛇水神社', '宮城県');
    const b = await insertSpot(db, '輪王寺', '栃木県');
    const bad: [string, Partial<PhotoValues>][] = [
      ['r2_key が短い', { r2_key: 'spot-photos/abc.jpg' }],
      ['r2_key の頭が違う', { r2_key: `photos/${sha('b')}.jpg` }],
      ['r2_key の拡張子が gif', { r2_key: `spot-photos/${sha('b')}.gif` }],
      ['focus_y が −0.01', { focus_y: -0.01 }],
      ['focus_y が 1.01', { focus_y: 1.01 }],
      ['width が 0', { width: 0 }],
      ['height が 0', { height: 0 }],
      ['source_url が Commons でない', { source_url: 'https://example.com/x' }],
      ['status が hidden', { status: 'hidden' }],
    ];
    for (const [why, over] of bad) {
      assert((await insertPhoto(db, photoValues(a, over))) !== null, why);
    }
    assertEquals(await photoCount(db), 0);

    assertEquals(await insertPhoto(db, photoValues(a)), null);
    assertEquals(
      await insertPhoto(db, photoValues(b, { r2_key: `spot-photos/${sha('c')}.png` })),
      null
    );
    assertEquals(await photoCount(db), 2);

    // 1 寺社 1 枚・1 ファイル 1 寺社
    const sameSpot = await insertPhoto(
      db,
      photoValues(a, { r2_key: `spot-photos/${sha('d')}.jpg` })
    );
    assertStringIncludes(sameSpot ?? '', 'duplicate key');
    const c = await insertSpot(db, '靖國神社', '東京都');
    const sameKey = await insertPhoto(db, photoValues(c));
    assertStringIncludes(sameKey ?? '', 'duplicate key');
    assertEquals(await photoCount(db), 2);

    // author・license_url は null 可、license は null 不可
    assertEquals(
      await insertPhoto(
        db,
        photoValues(c, { r2_key: `spot-photos/${sha('e')}.jpg`, author: null, license_url: null })
      ),
      null
    );
    const d = await insertSpot(db, '戸越八幡神社', '東京都');
    assert(
      (await raised(
        db,
        insertPhotoSql(photoValues(d, { r2_key: `spot-photos/${sha('f')}.jpg` })).replace(
          "'CC BY-SA 3.0'",
          'NULL'
        )
      )) !== null
    );
  });
});

Deno.test('AC-1: spots の行を消すと写真の行も消え、UPDATE すると updated_at が進む', async () => {
  await withDb(async db => {
    const a = await insertSpot(db, '金蛇水神社', '宮城県');
    const b = await insertSpot(db, '輪王寺', '栃木県');
    await insertPhoto(db, photoValues(a));
    await insertPhoto(db, photoValues(b, { r2_key: `spot-photos/${sha('b')}.jpg` }));
    // updated_at を昔に置く（トリガーを止めないと now() に戻る）
    await db.exec(`ALTER TABLE public.spot_photos DISABLE TRIGGER on_spot_photos_updated`);
    await db.exec(`UPDATE public.spot_photos SET updated_at = '2026-01-01T00:00:00Z'`);
    await db.exec(`ALTER TABLE public.spot_photos ENABLE TRIGGER on_spot_photos_updated`);

    await db.query('UPDATE public.spot_photos SET focus_y = 0.3 WHERE spot_id = $1', [a]);
    const at = await db.query<{ spot_id: string; moved: boolean }>(
      `SELECT spot_id::text AS spot_id, updated_at > '2026-01-02T00:00:00Z' AS moved
         FROM public.spot_photos ORDER BY r2_key`
    );
    assertEquals(
      at.rows.map(r => [r.spot_id, r.moved]),
      [
        [a, true],
        [b, false],
      ]
    );

    await db.query('DELETE FROM public.spots WHERE id = $1', [a]);
    const left = await db.query<{ spot_id: string }>(
      'SELECT spot_id::text AS spot_id FROM public.spot_photos'
    );
    assertEquals(
      left.rows.map(r => r.spot_id),
      [b]
    );
  });
});

// --- AC-2: RLS（承認済みだけ見える・書くのは service_role だけ） ---

/** 承認済み 2 行・取り下げ 1 行 */
async function threeRows(db: PGlite): Promise<string[]> {
  const ids = [
    await insertSpot(db, '金蛇水神社', '宮城県'),
    await insertSpot(db, '輪王寺', '栃木県'),
    await insertSpot(db, '靖國神社', '東京都'),
  ];
  await insertPhoto(db, photoValues(ids[0], { r2_key: `spot-photos/${sha('a')}.jpg` }));
  await insertPhoto(db, photoValues(ids[1], { r2_key: `spot-photos/${sha('b')}.jpg` }));
  await insertPhoto(
    db,
    photoValues(ids[2], { r2_key: `spot-photos/${sha('c')}.jpg`, status: 'withdrawn' })
  );
  return ids;
}

/** ロールと jwt のロールを、その文の間だけ（トランザクションの中で）替えて流す */
async function asRole<T>(
  db: PGlite,
  role: string,
  fn: (tx: { query: PGlite['query']; exec: PGlite['exec'] }) => Promise<T>
): Promise<T> {
  return await db.transaction(async tx => {
    await tx.exec(
      `SET LOCAL ROLE ${role}; SELECT set_config('request.jwt.claim.role', '${role}', true);`
    );
    return await fn(tx as unknown as { query: PGlite['query']; exec: PGlite['exec'] });
  });
}

async function tryAs(db: PGlite, role: string, sql: string): Promise<string | null> {
  try {
    await asRole(db, role, async tx => {
      await tx.exec(sql);
    });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

for (const role of ['anon', 'authenticated']) {
  Deno.test(
    `AC-2: ${role} は承認済みの2行だけ見え、書き込めない（行の数と中身が変わらない）`,
    async () => {
      await withDb(async db => {
        const ids = await threeRows(db);
        const seen = await asRole(db, role, async tx => {
          const res = await tx.query<{ n: number }>(
            'SELECT count(*)::int AS n FROM public.spot_photos'
          );
          return res.rows[0].n;
        });
        assertEquals(seen, 2);

        const before = await photoRows(db);
        const d = await insertSpot(db, '戸越八幡神社', '東京都');
        const ins = await tryAs(
          db,
          role,
          insertPhotoSql(photoValues(d, { r2_key: `spot-photos/${sha('d')}.jpg` }))
        );
        assertStringIncludes(ins ?? '', 'row-level security');
        await tryAs(db, role, `UPDATE public.spot_photos SET focus_y = 0.1`);
        await tryAs(db, role, `UPDATE public.spot_photos SET status = 'approved'`);
        await tryAs(db, role, `DELETE FROM public.spot_photos`);
        await tryAs(db, role, `DELETE FROM public.spot_photos WHERE spot_id = '${ids[0]}'`);
        assertEquals(await photoRows(db), before);
      });
    }
  );
}

Deno.test('AC-2: service_role（jwt のロールが service_role）は3行見えて入れられる', async () => {
  await withDb(async db => {
    await threeRows(db);
    const d = await insertSpot(db, '戸越八幡神社', '東京都');
    const n = await asRole(db, 'service_role', async tx => {
      const res = await tx.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM public.spot_photos'
      );
      await tx.exec(insertPhotoSql(photoValues(d, { r2_key: `spot-photos/${sha('d')}.jpg` })));
      return res.rows[0].n;
    });
    assertEquals(n, 3);
    assertEquals(await photoCount(db), 4);
  });
});

// --- AC-23: 台帳から作る migration（本物の seed 10 本） ---

async function fixtureLedger(): Promise<Ledger302> {
  return parseLedger302(await fixtureLedgerJson(), await fixturePhotos(), await realSeedRows());
}

async function seedAll(db: PGlite): Promise<void> {
  for (const f of SEED_FILES) await db.exec(await readRepo(f));
}

const USER = '00000000-0000-4000-8000-000000000001';

/** 写真の行と、結んだ寺社の名前・都道府県・作成者（updated_at を除く） */
async function attached(db: PGlite) {
  const res = await db.query<Record<string, unknown>>(
    `SELECT s.name, s.prefecture, s.created_by_user_id::text AS by, p.spot_id::text AS spot_id,
            p.r2_key, p.width, p.height, p.focus_y, p.author, p.license, p.license_url,
            p.source_url, p.is_cropped, p.status, p.created_at::text AS created_at
       FROM public.spot_photos p JOIN public.spots s ON s.id = p.spot_id
      ORDER BY s.name, s.prefecture`
  );
  return res.rows;
}

Deno.test(
  'AC-23: 本物の seed に流すと3行入り、名前・都道府県・作成者なしの寺社に結ぶ。2回流しても同じ',
  async () => {
    const ledger = await fixtureLedger();
    const sql = buildMigrationSql(ledger.entries);
    await withDb(async db => {
      await seedAll(db);
      assertEquals(await raised(db, sql), null);
      const rows = await attached(db);
      assertEquals(rows.length, 3);
      for (const e of ledger.entries) {
        const r = rows.find(x => x.name === e.name && x.prefecture === e.prefecture)!;
        const ids = await db.query<{ id: string }>(
          `SELECT id::text AS id FROM public.spots WHERE name = $1 AND prefecture = $2 AND created_by_user_id IS NULL`,
          [e.name, e.prefecture]
        );
        assertEquals(ids.rows.length, 1);
        assertEquals(r.spot_id, ids.rows[0].id);
        assertEquals(
          [
            r.r2_key,
            r.width,
            r.height,
            r.author,
            r.license,
            r.license_url,
            r.source_url,
            r.is_cropped,
            r.status,
          ],
          [
            e.r2Key,
            e.width,
            e.height,
            e.author,
            e.license,
            e.licenseUrl,
            e.sourceUrl,
            e.isCropped,
            e.status,
          ]
        );
        assert(Math.abs((r.focus_y as number) - e.focusY) < 1e-6, e.name);
      }
      assertEquals(await raised(db, sql), null);
      assertEquals(await attached(db), rows);
    });
  }
);

Deno.test('AC-23: マスタの寺社が無い DB では何も入れず、エラーにならない', async () => {
  const sql = buildMigrationSql((await fixtureLedger()).entries);
  await withDb(async db => {
    assertEquals(await raised(db, sql), null);
    assertEquals(await photoCount(db), 0);
    // 利用者が足した寺社しか無い DB でも同じ
    await insertSpot(db, '金蛇水神社', '宮城県', USER);
    assertEquals(await raised(db, sql), null);
    assertEquals(await photoCount(db), 0);
  });
});

Deno.test('AC-23: seed に無い名前が1つあると、その名前で例外になり1行も入らない', async () => {
  const entries: LedgerEntry302[] = (await fixtureLedger()).entries;
  const bad = buildMigrationSql([entries[0], { ...entries[1], name: '存在しない寺' }, entries[2]]);
  await withDb(async db => {
    await seedAll(db);
    const msg = await raised(db, bad);
    assert(msg !== null);
    assertStringIncludes(msg, 'spot_photos_302 batch1: 存在しない寺（栃木県）');
    assertStringIncludes(msg, '0 行');
    assertEquals(await photoCount(db), 0);
  });
});

Deno.test('AC-23: 同じ名前・都道府県の利用者の寺社があっても、マスタの寺社にだけ結ぶ', async () => {
  const ledger = await fixtureLedger();
  const sql = buildMigrationSql(ledger.entries);
  await withDb(async db => {
    await seedAll(db);
    const user = await insertSpot(db, '金蛇水神社', '宮城県', USER);
    assertEquals(await raised(db, sql), null);
    const rows = await attached(db);
    assertEquals(rows.length, 3);
    assertEquals(
      rows.filter(r => r.spot_id === user),
      []
    );
    assert(rows.every(r => r.by === null));
  });
});

Deno.test('AC-23: 同じ名前・都道府県のマスタの寺社が2行あると、2 行で例外', async () => {
  const sql = buildMigrationSql((await fixtureLedger()).entries);
  await withDb(async db => {
    await seedAll(db);
    await insertSpot(db, '金蛇水神社', '宮城県');
    const msg = await raised(db, sql);
    assertStringIncludes(msg ?? '', '金蛇水神社（宮城県）');
    assertStringIncludes(msg ?? '', '2 行');
    assertEquals(await photoCount(db), 0);
  });
});

// --- AC-24: 確かめる SQL ---

async function masterCount(db: PGlite): Promise<number> {
  const res = await db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM public.spots WHERE created_by_user_id IS NULL'
  );
  return res.rows[0].n;
}

const resultLine = (v: Record<string, string | number>) =>
  'RESULT ' +
  [
    'table',
    'rls',
    'total',
    'listed',
    'not_one',
    'present',
    'differ',
    'missing',
    'extra',
    'anon_select',
    'anon_insert',
  ]
    .map(k => `${k}=${v[k]}`)
    .join(' ');

Deno.test(
  'AC-24: 表が無い DB で table=absent、表だけで missing=3、migration のあとで present=3',
  async () => {
    const ledger = await fixtureLedger();
    const check = buildCheckSql(ledger, 1109);
    const migration = buildMigrationSql(ledger.entries);
    await withDb(
      async db => {
        await seedAll(db);
        assertEquals(await raised(db, check), 'RESULT table=absent');
      },
      { ddl: false }
    );
    await withDb(async db => {
      await seedAll(db);
      const total = await masterCount(db);
      assertEquals(total, 1109);
      const base = {
        table: 'present',
        rls: 'on',
        total,
        listed: 3,
        not_one: 0,
        extra: 0,
        anon_insert: 'denied',
      };
      assertEquals(
        await raised(db, check),
        resultLine({ ...base, present: 0, differ: 0, missing: 3, anon_select: 0 })
      );
      // 確かめる SQL は何も残さない
      assertEquals(await photoCount(db), 0);

      await db.exec(migration);
      assertEquals(
        await raised(db, check),
        resultLine({ ...base, present: 3, differ: 0, missing: 0, anon_select: 3 })
      );

      await db.exec(
        `UPDATE public.spot_photos SET focus_y = 0.11 WHERE r2_key = '${ledger.entries[2].r2Key}'`
      );
      assertEquals(
        await raised(db, check),
        resultLine({ ...base, present: 2, differ: 1, missing: 0, anon_select: 3 })
      );

      const other = await db.query<{ id: string }>(
        `SELECT id::text AS id FROM public.spots WHERE name = '戸越八幡神社' AND prefecture = '東京都'`
      );
      await insertPhoto(
        db,
        photoValues(other.rows[0].id, {
          r2_key: `spot-photos/${sha('9')}.jpg`,
          status: 'withdrawn',
        })
      );
      const before = await photoRows(db);
      assertEquals(
        await raised(db, check),
        resultLine({ ...base, present: 2, differ: 1, missing: 0, extra: 1, anon_select: 3 })
      );
      assertEquals(await photoRows(db), before);
    });
  }
);

Deno.test('AC-24: 絞れない寺社は not_one に数える', async () => {
  const ledger = await fixtureLedger();
  await withDb(async db => {
    await seedAll(db);
    await db.exec(buildMigrationSql(ledger.entries));
    await insertSpot(db, '輪王寺', '栃木県');
    const msg = await raised(db, buildCheckSql(ledger, 1109));
    assertStringIncludes(
      msg ?? '',
      'total=1110 listed=3 not_one=1 present=2 differ=0 missing=0 extra=1'
    );
  });
});

Deno.test(
  'AC-24: INSERT・UPDATE・DELETE は anon で試す1つだけで、BEGIN … EXCEPTION の中にある',
  async () => {
    const check = buildCheckSql(await fixtureLedger(), 1109);
    const words = check.match(/\b(insert|update|delete|truncate|drop|alter)\b/gi) ?? [];
    assertEquals(
      words.map(w => w.toUpperCase()),
      ['INSERT']
    );
    const at = check.search(/\bINSERT\b/);
    const begin = check.lastIndexOf('BEGIN', at);
    const exception = check.indexOf('EXCEPTION', at);
    const roleAt = check.lastIndexOf('SET LOCAL ROLE anon', at);
    assert(begin > roleAt && roleAt > 0, 'anon にしてからサブブロックに入る');
    assert(exception > at);
    assertStringIncludes(
      check,
      'supabase db query --linked -f supabase/validation/spot_photos_302_check.sql'
    );
    for (const h of ['H-7', 'H-10', 'H-13']) assertStringIncludes(check, h);
    assertStringIncludes(
      check,
      'RESULT table=present rls=on total=1109 listed=3 not_one=0 present=3 differ=0 missing=0 extra=0 anon_select=3 anon_insert=denied'
    );
  }
);
