// Deno テスト（PGlite に、本物の migration と、台帳から作る SQL をそのまま流す）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
//   ⚠ --node-modules-dir=none が要る（無いとルートの package.json 経由で npm: の解決に失敗する）
//
// 契約書: docs/issues/issue-302-spot-photo-band.md（S1 / AC-1・AC-2）
//
// PGlite は Postgres 17 の WASM。Supabase のロールと auth.role() は無いので、ここで作り物を足す:
// ロール anon・authenticated・service_role、auth.role()（request.jwt.claim.role を返す）、
// Supabase の既定の権限の代わりの GRANT。本番の RLS は H-10・H-13 の確かめる SQL で見る
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { PGlite } from 'npm:@electric-sql/pglite@0.3.16';

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
