// Deno テスト（PGlite に、生成した migration と確かめる SQL をそのまま流す）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-coords/
//   ⚠ --node-modules-dir=none が要る（無いとルートの package.json 経由で npm: の解決に失敗する）
//
// 契約書: docs/issues/issue-292-spot-coords.md（S1 / AC-7〜AC-9）
//
// PGlite は Postgres 17 の WASM。Supabase のロールや RLS までは同じでないので、
// spots の列とトリガーだけの最小のスキーマを作る。本番の接続で行が見えるかは H-1・H-3 で確かめる
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { PGlite } from 'npm:@electric-sql/pglite@0.3.16';

import { buildCheckSql, buildMigrationSql, emptyLedger, type LedgerEntry } from './coords.ts';

export const SCHEMA = `
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

export async function withDb(fn: (db: PGlite) => Promise<void>): Promise<void> {
  const db = await PGlite.create();
  try {
    await db.exec(SCHEMA);
    await fn(db);
  } finally {
    await db.close();
  }
}

export interface Row {
  name: string;
  prefecture: string;
  lat: number;
  lng: number;
  status: string;
  created_by_user_id: string | null;
  updated_at: string;
}

/** 全行（名前・都道府県・作成者の順に並べる） */
export async function rows(db: PGlite): Promise<Row[]> {
  const res = await db.query<Row>(
    `SELECT name, prefecture, lat, lng, status::text AS status, created_by_user_id::text AS created_by_user_id,
            to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS updated_at
       FROM public.spots ORDER BY name, prefecture, created_by_user_id NULLS FIRST`
  );
  return res.rows;
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

// --- フィクスチャ: 台帳 3 件 + 台帳に無いマスタの寺社 2 件 ---

const CHUBU = 'supabase/seeds/03_chubu.sql';

const FIXES: LedgerEntry[] = [
  {
    batch: 1,
    idx: 1,
    name: '尊永寺',
    prefecture: '静岡県',
    seedFile: CHUBU,
    seedLine: 3,
    old: { lat: 34.7669, lng: 137.8116 },
    new: { lat: 34.737787, lng: 137.97723 },
    source: 'wikidata',
    ref: 'Q11555090',
    confidence: 'high',
    basis: 'テスト',
  },
  {
    batch: 1,
    idx: 2,
    name: '若狭姫神社',
    prefecture: '福井県',
    seedFile: CHUBU,
    seedLine: 5,
    old: { lat: 35.4731, lng: 135.7927 },
    new: { lat: 35.479058, lng: 135.780525 },
    source: 'osm',
    ref: 'way/799099092',
    confidence: 'high',
    basis: 'テスト',
  },
  {
    batch: 1,
    idx: 3,
    name: '秋保神社',
    prefecture: '宮城県',
    seedFile: 'supabase/seed_miyagi_spots_and_pilgrimages.sql',
    seedLine: 30,
    old: { lat: 38.2186, lng: 140.7104 },
    new: { lat: 38.263611, lng: 140.659611 },
    source: 'wikidata',
    ref: 'Q79733806',
    confidence: 'high',
    basis: 'テスト',
  },
];

const OTHERS = [
  { name: '八坂神社', prefecture: '京都府', lat: 35.0036, lng: 135.778 },
  { name: '護国寺', prefecture: '東京都', lat: 35.7186, lng: 139.7275 },
];

const OLD_AT = '2026-01-01T00:00:00.000000';
const USER = '00000000-0000-4000-8000-000000000001';

async function insert(
  db: PGlite,
  r: { name: string; prefecture: string; lat: number; lng: number },
  by: string | null = null
): Promise<void> {
  await db.query(
    `INSERT INTO public.spots (name, lat, lng, type, prefecture, created_by_user_id, created_at, updated_at)
     VALUES ($1, $2, $3, 'shrine', $4, $5, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    [r.name, r.lat, r.lng, r.prefecture, by]
  );
}

/** 台帳の 3 件は at（old / new）の座標で、台帳に無い 2 件はそのまま入れる */
async function seedFixture(
  db: PGlite,
  at: ('old' | 'new')[] = ['old', 'old', 'old']
): Promise<void> {
  for (const [i, f] of FIXES.entries()) {
    await insert(db, { name: f.name, prefecture: f.prefecture, ...f[at[i]] });
  }
  for (const o of OTHERS) await insert(db, o);
}

async function setCoords(db: PGlite, name: string, lat: number, lng: number): Promise<void> {
  await db.query('UPDATE public.spots SET lat = $2, lng = $3 WHERE name = $1', [name, lat, lng]);
}

const APPLY = buildMigrationSql(FIXES, { batch: 1, direction: 'apply', version: '20260928000000' });
const REVERT = buildMigrationSql(FIXES, { batch: 1, direction: 'revert' });
const CHECK = buildCheckSql({ ...emptyLedger(), entries: FIXES }, 5);

const coordsOf = (rs: Row[]) =>
  rs.map(r => [r.name, r.prefecture, r.lat, r.lng, r.created_by_user_id]);

// --- AC-7: migration（apply） ---

Deno.test(
  'AC-7: 全件が旧座標なら3件を直し、台帳に無い寺社は座標も updated_at も変えない',
  async () => {
    await withDb(async db => {
      await seedFixture(db);
      assertEquals(await raised(db, APPLY), null);
      const after = await rows(db);
      for (const f of FIXES) {
        const r = after.find(x => x.name === f.name)!;
        assertEquals([r.lat, r.lng], [f.new.lat, f.new.lng]);
        assert(r.updated_at > OLD_AT, `${f.name} の updated_at が進んでいない`);
      }
      for (const o of OTHERS) {
        const r = after.find(x => x.name === o.name)!;
        assertEquals([r.lat, r.lng], [o.lat, o.lng]);
        assertEquals(r.updated_at, OLD_AT);
      }
    });
  }
);

Deno.test('AC-7: 続けてもう1回流しても例外にならず、座標も updated_at も変わらない', async () => {
  await withDb(async db => {
    await seedFixture(db);
    await db.exec(APPLY);
    const once = await rows(db);
    assertEquals(await raised(db, APPLY), null);
    assertEquals(await rows(db), once);
  });
});

Deno.test('AC-7: 1件が旧でも新でもないと、その名前で例外になり、ほかも旧座標のまま', async () => {
  await withDb(async db => {
    await seedFixture(db);
    await setCoords(db, '若狭姫神社', 35.5, 135.8);
    const before = await rows(db);
    const msg = await raised(db, APPLY);
    assert(msg !== null);
    assertStringIncludes(msg, '若狭姫神社');
    assertStringIncludes(msg, '旧座標でも新座標でもない');
    assertEquals(await rows(db), before);
    const son = (await rows(db)).find(r => r.name === '尊永寺')!;
    assertEquals([son.lat, son.lng], [FIXES[0].old.lat, FIXES[0].old.lng]);
  });
});

Deno.test(
  'AC-7: 同じ名前・都道府県の作成者なしの行が2行あると例外（2 行）で、何も変わらない',
  async () => {
    await withDb(async db => {
      await seedFixture(db);
      await insert(db, { name: '尊永寺', prefecture: '静岡県', lat: 34.7, lng: 137.9 });
      const before = await rows(db);
      const msg = await raised(db, APPLY);
      assert(msg !== null);
      assertStringIncludes(msg, '尊永寺');
      assertStringIncludes(msg, '2 行');
      assertEquals(await rows(db), before);
    });
  }
);

Deno.test('AC-7: 利用者が足した同じ名前・旧座標の行は例外にならず、旧座標のまま', async () => {
  await withDb(async db => {
    await seedFixture(db);
    await insert(db, { name: '尊永寺', prefecture: '静岡県', ...FIXES[0].old }, USER);
    assertEquals(await raised(db, APPLY), null);
    const all = await rows(db);
    const user = all.find(r => r.name === '尊永寺' && r.created_by_user_id === USER)!;
    assertEquals([user.lat, user.lng], [FIXES[0].old.lat, FIXES[0].old.lng]);
    assertEquals(user.updated_at, OLD_AT);
    const master = all.find(r => r.name === '尊永寺' && r.created_by_user_id === null)!;
    assertEquals([master.lat, master.lng], [FIXES[0].new.lat, FIXES[0].new.lng]);
  });
});

Deno.test('AC-7: spots が空なら例外にならず、行は0のまま', async () => {
  await withDb(async db => {
    assertEquals(await raised(db, APPLY), null);
    assertEquals((await rows(db)).length, 0);
  });
});

Deno.test('AC-7: 利用者が足した寺社しか無い DB でも何もしない', async () => {
  await withDb(async db => {
    await insert(db, { name: '尊永寺', prefecture: '静岡県', ...FIXES[0].old }, USER);
    const before = await rows(db);
    assertEquals(await raised(db, APPLY), null);
    assertEquals(await rows(db), before);
  });
});

Deno.test('AC-7: 2件が新座標・1件が旧座標だと例外（混ざっている）で、何も変わらない', async () => {
  await withDb(async db => {
    await seedFixture(db, ['new', 'new', 'old']);
    const before = await rows(db);
    const msg = await raised(db, APPLY);
    assert(msg !== null);
    assertStringIncludes(msg, '混ざっている');
    assertEquals(await rows(db), before);
  });
});

// --- AC-8: 確かめる SQL ---

Deno.test('AC-8: 流す前は at_old=3、流した後は at_new=3 の RESULT で終わる', async () => {
  await withDb(async db => {
    await seedFixture(db);
    assertEquals(
      await raised(db, CHECK),
      'RESULT total=5 listed=3 rest=2 at_new=0 at_old=3 neither=0 not_one=0 inactive=0'
    );
    await db.exec(APPLY);
    assertEquals(
      await raised(db, CHECK),
      'RESULT total=5 listed=3 rest=2 at_new=3 at_old=0 neither=0 not_one=0 inactive=0'
    );
  });
});

Deno.test(
  'AC-8: merged の行は inactive、旧でも新でもない行は neither、絞れない行は not_one に数える',
  async () => {
    await withDb(async db => {
      await seedFixture(db);
      await db.query(`UPDATE public.spots SET status = 'merged' WHERE name = '尊永寺'`);
      await setCoords(db, '若狭姫神社', 35.5, 135.8);
      assertEquals(
        await raised(db, CHECK),
        'RESULT total=5 listed=3 rest=2 at_new=0 at_old=2 neither=1 not_one=0 inactive=1'
      );
      await insert(db, { name: '秋保神社', prefecture: '宮城県', lat: 38.2, lng: 140.7 });
      assertEquals(
        await raised(db, CHECK),
        'RESULT total=6 listed=3 rest=4 at_new=0 at_old=1 neither=1 not_one=1 inactive=1'
      );
    });
  }
);

Deno.test('AC-8: 確かめる SQL は読むだけ（前と後で全行の座標と updated_at が同じ）', async () => {
  await withDb(async db => {
    await seedFixture(db);
    const before = await rows(db);
    await raised(db, CHECK);
    assertEquals(await rows(db), before);
  });
});

Deno.test("AC-8: 最後の文が RAISE EXCEPTION 'RESULT で、書き換える語を含まない", () => {
  const body = CHECK.split('\n').map(l => l.trim());
  const end = body.lastIndexOf('END');
  const last = body
    .slice(0, end)
    .filter(l => l !== '')
    .at(-1)!;
  const stmt = body
    .slice(
      body.findLastIndex((l, i) => i < end && l.startsWith('RAISE')),
      end
    )
    .join(' ');
  assert(stmt.startsWith("RAISE EXCEPTION 'RESULT"), stmt);
  assert(last.endsWith(';'));
  assertEquals(CHECK.match(/\b(update|insert|delete|truncate|drop|alter)\b/gi), null);
});

// --- AC-9: 戻す ---

Deno.test(
  'AC-9: 直したあと戻すと全行の座標が元に戻り、戻すのを2回流しても例外にならない',
  async () => {
    await withDb(async db => {
      await seedFixture(db);
      const before = coordsOf(await rows(db));
      await db.exec(APPLY);
      assertEquals(await raised(db, REVERT), null);
      assertEquals(coordsOf(await rows(db)), before);
      assertEquals(await raised(db, REVERT), null);
      assertEquals(coordsOf(await rows(db)), before);
      assertEquals(
        await raised(db, CHECK),
        'RESULT total=5 listed=3 rest=2 at_new=0 at_old=3 neither=0 not_one=0 inactive=0'
      );
    });
  }
);

Deno.test('AC-9: まだ直していない DB で戻すのを流しても何もしない', async () => {
  await withDb(async db => {
    await seedFixture(db);
    const before = await rows(db);
    assertEquals(await raised(db, REVERT), null);
    assertEquals(await rows(db), before);
  });
});

Deno.test(
  'migration は1つの文なので、途中の例外で前の UPDATE も戻る（GET DIAGNOSTICS の確かめ）',
  async () => {
    await withDb(async db => {
      await seedFixture(db);
      // 秋保神社の UPDATE だけを BEFORE トリガーで取り消す → ROW_COUNT が 0 になり、全体が止まる
      await db.exec(`
      CREATE FUNCTION public.test_skip() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.name = '秋保神社' THEN RETURN NULL; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER test_skip BEFORE UPDATE ON public.spots FOR EACH ROW EXECUTE FUNCTION public.test_skip();
    `);
      const before = await rows(db);
      const msg = await raised(db, APPLY);
      assert(msg !== null);
      assertStringIncludes(msg, '秋保神社');
      assertStringIncludes(msg, '変わったのが 0 行');
      assertEquals(await rows(db), before);
    });
  }
);
