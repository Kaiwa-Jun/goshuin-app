// Deno テスト（PGlite に本物の migration を流して、SQL の関数 growth_metrics_counts を確かめる）
// 実行: deno test -A --node-modules-dir=none supabase/functions/growth-metrics/sql_test.ts
//   ⚠ --node-modules-dir=none が要る（無いとルートの package.json 経由で npm: の解決に失敗する）
//
// 契約書: docs/issues/issue-285-growth-metrics.md（S1 / AC-1〜AC-9）
//
// PGlite は Postgres 17 の WASM。Supabase のロールや auth スキーマの権限までは同じでないので、
// 使う列だけの最小のスキーマとロールをここで作ってから migration を流す。
// 持ち主（postgres）が本番で auth.users を読めるかは H-3 で確かめる
import { assert, assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert@1';
import { PGlite } from 'npm:@electric-sql/pglite@0.3.16';

const MIGRATION_URL = new URL(
  '../../migrations/20260927000000_growth_metrics.sql',
  import.meta.url
);

const SCHEMA = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TYPE public.spot_status AS ENUM ('active', 'pending', 'merged');
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE public.spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status public.spot_status NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE public.stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE public.spot_research_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL
);
`;

/** now = 2026-09-28（月）09:00 JST のときの境目（metricWindows と同じ値を手で書く） */
export const PARAMS_2026_09_28 = {
  p_period_start: '2026-09-20T15:00:00.000Z',
  p_period_end: '2026-09-27T15:00:00.000Z',
  p_weeks_start: '2026-08-30T15:00:00.000Z',
  p_weeks_end: '2026-09-27T15:00:00.000Z',
  p_months_start: '2026-02-28T15:00:00.000Z',
  p_months_end: '2026-08-31T15:00:00.000Z',
};

export interface Fixture {
  /** [id, created_at] */
  users?: [string, string][];
  /** [user_id, created_at] */
  stamps?: [string, string][];
  /** [status, created_by_user_id, created_at] */
  spots?: [string, string | null, string][];
  /** [user_id, created_at] */
  research?: [string, string][];
}

/** 読みやすい UUID（n 番の人） */
export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export async function setupDb(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(SCHEMA);
  await db.exec(await Deno.readTextFile(MIGRATION_URL));
  return db;
}

export async function seed(db: PGlite, f: Fixture): Promise<void> {
  for (const [id, at] of f.users ?? []) {
    await db.query('INSERT INTO auth.users (id, created_at) VALUES ($1, $2)', [id, at]);
  }
  for (const [user, at] of f.stamps ?? []) {
    await db.query('INSERT INTO public.stamps (user_id, created_at) VALUES ($1, $2)', [user, at]);
  }
  for (const [status, by, at] of f.spots ?? []) {
    await db.query(
      'INSERT INTO public.spots (status, created_by_user_id, created_at) VALUES ($1, $2, $3)',
      [status, by, at]
    );
  }
  for (const [user, at] of f.research ?? []) {
    await db.query(
      'INSERT INTO public.spot_research_requests (user_id, created_at) VALUES ($1, $2)',
      [user, at]
    );
  }
}

/**
 * 名前付きの引数で呼ぶ（Edge Function の rpc と同じ）。params のキーをそのまま引数名にするので、
 * キーと SQL の引数名がずれると、ここで「関数が無い」で落ちる
 */
export async function callCounts(
  db: PGlite,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const keys = Object.keys(params);
  const args = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
  const res = await db.query<{ counts: Record<string, unknown> }>(
    `SELECT public.growth_metrics_counts(${args}) AS counts`,
    keys.map(k => params[k])
  );
  return res.rows[0].counts;
}

async function withDb(fn: (db: PGlite) => Promise<void>): Promise<void> {
  const db = await setupDb();
  try {
    await fn(db);
  } finally {
    await db.close();
  }
}

// --- フィクスチャ（人の番号はテストどうしで重ねない。AC-8 でまとめて入れる） ---

/** AC-4: この7日の境目（[2026-09-20T15:00Z, 2026-09-27T15:00Z)） */
const FIX_PERIOD: Fixture = {
  users: [
    [uid(1), '2026-09-20T15:00:00.000Z'], // 始まりちょうど → 数える
    [uid(2), '2026-09-20T14:59:59.999Z'], // 1ミリ秒前 → 数えない
    [uid(3), '2026-09-27T15:00:00.000Z'], // 終わりちょうど → 数えない
    [uid(4), '2026-09-25T00:00:00.000Z'], // 中 → 数える
  ],
  stamps: [
    [uid(1), '2026-09-20T15:00:00.000Z'], // 始まりちょうど
    [uid(1), '2026-09-22T00:00:00.000Z'], // 同じ人の2件目（記録した人は1人）
    [uid(2), '2026-09-20T14:59:59.999Z'], // 1ミリ秒前
    [uid(3), '2026-09-27T15:00:00.000Z'], // 終わりちょうど
    [uid(4), '2026-09-26T00:00:00.000Z'],
  ],
};

/** AC-5: 活性化（168時間）と週のラベル（[2026-08-30T15:00Z, 2026-09-27T15:00Z)） */
const FIX_ACTIVATION: Fixture = {
  users: [
    [uid(11), '2026-09-01T00:00:00.000Z'], // 167時間59分後の記録 → 活性化
    [uid(12), '2026-09-01T00:00:00.000Z'], // 168時間ちょうど後の記録だけ → 活性化しない
    [uid(13), '2026-09-20T14:59:00.000Z'], // 日本時間の日曜 23:59 → 週 2026-09-14
    [uid(14), '2026-09-20T15:00:00.000Z'], // 日本時間の月曜 00:00 → 週 2026-09-21
    [uid(15), '2026-08-30T14:59:59.999Z'], // 最初の週の1ミリ秒前 → 入らない
    [uid(16), '2026-09-27T15:00:00.000Z'], // 今週の月曜 0 時 → 入らない
  ],
  stamps: [
    [uid(11), '2026-09-07T23:59:00.000Z'],
    [uid(12), '2026-09-08T00:00:00.000Z'],
  ],
};

/** AC-6: 継続（[2026-03, 2026-08]。今月 2026-09 はラベルに出ないが先月の retained に使う） */
const FIX_RETENTION: Fixture = {
  users: [
    [uid(21), '2026-01-01T00:00:00.000Z'],
    [uid(22), '2026-01-01T00:00:00.000Z'],
    [uid(23), '2026-01-01T00:00:00.000Z'],
    [uid(24), '2026-01-01T00:00:00.000Z'],
    [uid(25), '2026-01-01T00:00:00.000Z'],
  ],
  stamps: [
    // 7月と8月 → 7月の retained
    [uid(21), '2026-07-10T00:00:00.000Z'],
    [uid(21), '2026-07-20T00:00:00.000Z'],
    [uid(21), '2026-08-10T00:00:00.000Z'],
    // 7月と9月だけ → 7月の retained に入らない
    [uid(22), '2026-07-10T00:00:00.000Z'],
    [uid(22), '2026-09-10T00:00:00.000Z'],
    // 日本時間 8/1 00:00 → 8月。9月（今月）にも記録 → 8月の retained
    [uid(23), '2026-07-31T15:00:00.000Z'],
    [uid(23), '2026-09-05T00:00:00.000Z'],
    // 日本時間 7/31 23:59:59.999 → 7月
    [uid(24), '2026-07-31T14:59:59.999Z'],
    // 日本時間 2/28 → 対象の外。3月だけが集団になる
    [uid(25), '2026-02-28T14:59:59.999Z'],
    [uid(25), '2026-03-05T00:00:00.000Z'],
  ],
};

/** AC-7: 探して追加（寺社と調べた回数） */
const FIX_SPOTS: Fixture = {
  users: [[uid(31), '2026-01-01T00:00:00.000Z']],
  spots: [
    ['active', null, '2026-09-22T00:00:00.000Z'], // マスタ（NULL）→ 数えない
    ['merged', uid(31), '2026-09-22T00:00:00.000Z'], // merged → 数えない
    ['active', uid(31), '2026-01-01T00:00:00.000Z'], // 期間の外
    ['active', uid(31), '2026-09-20T15:00:00.000Z'], // 期間の始まりちょうど
    ['pending', uid(31), '2026-09-27T15:00:00.000Z'], // 期間の終わりちょうど → 期間には入らない
    ['pending', uid(31), '2026-09-23T00:00:00.000Z'], // 期間の中
    ['pending', uid(31), '2026-09-20T14:59:59.999Z'], // 1ミリ秒前
  ],
  research: [
    [uid(31), '2026-09-20T15:00:00.000Z'], // 始まりちょうど → 数える
    [uid(31), '2026-09-20T14:59:59.999Z'], // 1ミリ秒前 → 数えない
    [uid(31), '2026-09-27T15:00:00.000Z'], // 終わりちょうど → 数えない
    [uid(31), '2026-09-24T00:00:00.000Z'], // 中 → 数える
  ],
};

/** AC-8: セッションのタイムゾーンで結果が変わりやすい記録（UTC と New York で日付がずれる） */
const FIX_TZ: Fixture = {
  users: [
    [uid(41), '2026-09-21T02:00:00.000Z'], // 日本時間 月 11:00 / UTC 月 / New York 日
    [uid(42), '2026-08-01T02:00:00.000Z'],
  ],
  stamps: [
    [uid(41), '2026-09-21T03:00:00.000Z'],
    [uid(42), '2026-08-01T02:00:00.000Z'], // 日本時間 8/1 / New York 7/31
    [uid(42), '2026-09-01T02:00:00.000Z'],
  ],
};

const ALL_FIXTURES = [FIX_PERIOD, FIX_ACTIVATION, FIX_RETENTION, FIX_SPOTS, FIX_TZ];

// --- AC-1 / AC-2: migration ファイルの中身 ---

Deno.test(
  'AC-1: LANGUAGE sql / STABLE / SECURITY DEFINER / search_path 空 / auth.users を読む',
  async () => {
    const sql = await Deno.readTextFile(MIGRATION_URL);
    assertMatch(sql, /CREATE FUNCTION public\.growth_metrics_counts\(/);
    for (const word of [
      'RETURNS JSONB',
      'LANGUAGE sql',
      'STABLE',
      'SECURITY DEFINER',
      "SET search_path = ''",
      'auth.users',
    ]) {
      assert(sql.includes(word), `${word} が無い`);
    }
    // 定義された関数そのものも見る（引数は TIMESTAMPTZ 6つ、JSONB を返す、DEFINER、STABLE、search_path 空）
    await withDb(async db => {
      const res = await db.query<{
        args: string;
        ret: string;
        definer: boolean;
        volatile: string;
        config: string[] | null;
      }>(
        `SELECT pg_get_function_identity_arguments(p.oid) AS args, p.prorettype::regtype::text AS ret,
              p.prosecdef AS definer, p.provolatile AS volatile, p.proconfig AS config
       FROM pg_proc p WHERE p.proname = 'growth_metrics_counts'`
      );
      assertEquals(res.rows.length, 1);
      const [fn] = res.rows;
      assertEquals(
        fn.args,
        'p_period_start timestamp with time zone, p_period_end timestamp with time zone, ' +
          'p_weeks_start timestamp with time zone, p_weeks_end timestamp with time zone, ' +
          'p_months_start timestamp with time zone, p_months_end timestamp with time zone'
      );
      assertEquals(fn.ret, 'jsonb');
      assertEquals(fn.definer, true);
      assertEquals(fn.volatile, 's');
      assertEquals(fn.config, ['search_path=""']);
    });
  }
);

Deno.test(
  'AC-2: REVOKE（PUBLIC, anon, authenticated）と GRANT（service_role）があり、書き込み・定義変更の語が無い',
  async () => {
    const sql = await Deno.readTextFile(MIGRATION_URL);
    assertMatch(
      sql,
      /REVOKE EXECUTE ON FUNCTION public\.growth_metrics_counts\([^)]*\) FROM PUBLIC, anon, authenticated;/
    );
    assertMatch(
      sql,
      /GRANT EXECUTE ON FUNCTION public\.growth_metrics_counts\([^)]*\) TO service_role;/
    );
    // grep -inwE "insert|update|delete|truncate|drop|alter|create (table|index|policy)" と同じ
    const forbidden = /\b(insert|update|delete|truncate|drop|alter|create (table|index|policy))\b/i;
    const hits = sql.split('\n').filter(line => forbidden.test(line));
    assertEquals(hits, []);
  }
);

// --- AC-3: 権限 ---

Deno.test(
  'AC-3: migration が通り、authenticated と anon は permission denied、service_role は呼べる',
  async () => {
    await withDb(async db => {
      for (const role of ['authenticated', 'anon']) {
        await db.exec(`SET ROLE ${role}`);
        let message = '';
        try {
          await callCounts(db, PARAMS_2026_09_28);
        } catch (e) {
          message = e instanceof Error ? e.message : String(e);
        } finally {
          await db.exec('RESET ROLE');
        }
        assertMatch(message, /permission denied/, `${role} が呼べてしまう`);
      }
      await db.exec('SET ROLE service_role');
      try {
        const counts = await callCounts(db, PARAMS_2026_09_28);
        assertEquals(counts.users_total, 0);
      } finally {
        await db.exec('RESET ROLE');
      }
    });
  }
);

// --- AC-4: 利用者・記録 ---

Deno.test(
  'AC-4: この7日は始まりちょうどを数え、1ミリ秒前と終わりちょうどを数えない。2件の人は1人',
  async () => {
    await withDb(async db => {
      await seed(db, FIX_PERIOD);
      const c = await callCounts(db, PARAMS_2026_09_28);
      assertEquals(c.users_total, 4);
      assertEquals(c.users_period, 2);
      assertEquals(c.stamps_total, 5);
      assertEquals(c.stamps_period, 3);
      assertEquals(c.recorders_period, 2);
    });
  }
);

// --- AC-5: 活性化 ---

Deno.test(
  'AC-5: 167時間59分後の記録は活性化、168時間ちょうどは活性化しない。週は日本時間の月曜はじまり',
  async () => {
    await withDb(async db => {
      await seed(db, FIX_ACTIVATION);
      const c = await callCounts(db, PARAMS_2026_09_28);
      assertEquals(c.activation, [
        { week: '2026-08-31', signups: 2, activated: 1 },
        { week: '2026-09-14', signups: 1, activated: 0 },
        { week: '2026-09-21', signups: 1, activated: 0 },
      ]);
    });
  }
);

// --- AC-6: 継続 ---

Deno.test(
  'AC-6: 翌月にも記録した人が retained。日本時間の月で分け、今月はラベルに出ない',
  async () => {
    await withDb(async db => {
      await seed(db, FIX_RETENTION);
      const c = await callCounts(db, PARAMS_2026_09_28);
      assertEquals(c.retention, [
        { month: '2026-03', recorders: 1, retained: 0 },
        { month: '2026-07', recorders: 3, retained: 1 },
        { month: '2026-08', recorders: 2, retained: 1 },
      ]);
    });
  }
);

// --- AC-7: 探して追加 ---

Deno.test(
  'AC-7: 足した寺社は NULL と merged を除き active / pending で分ける。調べた回数は期間の中だけ',
  async () => {
    await withDb(async db => {
      await seed(db, FIX_SPOTS);
      const c = await callCounts(db, PARAMS_2026_09_28);
      assertEquals(c.added_spots_total_active, 2);
      assertEquals(c.added_spots_total_pending, 3);
      assertEquals(c.added_spots_period_active, 1);
      assertEquals(c.added_spots_period_pending, 1);
      assertEquals(c.research_period, 2);
    });
  }
);

// --- AC-8: セッションのタイムゾーン ---

Deno.test('AC-8: TimeZone が UTC でも America/New_York でも同じ JSONB を返す', async () => {
  await withDb(async db => {
    for (const f of ALL_FIXTURES) await seed(db, f);
    const results: Record<string, unknown>[] = [];
    try {
      for (const tz of ['UTC', 'America/New_York']) {
        await db.exec(`SET TimeZone = '${tz}'`);
        results.push(await callCounts(db, PARAMS_2026_09_28));
      }
    } finally {
      await db.exec('RESET TimeZone');
    }
    assertEquals(results[0], results[1]);
    // 境目の人が日本時間で数えられている（uid(41) は週 2026-09-21。セッションの時刻で切ると New York では 09-14 になる）
    assertEquals(results[0].activation, [
      { week: '2026-08-31', signups: 2, activated: 1 }, // uid(11) uid(12)
      { week: '2026-09-14', signups: 2, activated: 1 }, // uid(2) uid(13)
      { week: '2026-09-21', signups: 4, activated: 3 }, // uid(1) uid(4) uid(14) uid(41)
    ]);
    assertNotEquals(results[0].retention, []);
  });
});

// --- AC-9: 返すキー ---

Deno.test(
  'AC-9: 最上位のキーはちょうど12個。activation / retention の要素のキーも決まったものだけ',
  async () => {
    await withDb(async db => {
      for (const f of ALL_FIXTURES) await seed(db, f);
      const c = await callCounts(db, PARAMS_2026_09_28);
      assertEquals(Object.keys(c).sort(), [
        'activation',
        'added_spots_period_active',
        'added_spots_period_pending',
        'added_spots_total_active',
        'added_spots_total_pending',
        'recorders_period',
        'research_period',
        'retention',
        'stamps_period',
        'stamps_total',
        'users_period',
        'users_total',
      ]);
      const activation = c.activation as Record<string, unknown>[];
      const retention = c.retention as Record<string, unknown>[];
      assert(activation.length > 0 && retention.length > 0);
      for (const row of activation)
        assertEquals(Object.keys(row).sort(), ['activated', 'signups', 'week']);
      for (const row of retention)
        assertEquals(Object.keys(row).sort(), ['month', 'recorders', 'retained']);
    });
  }
);

// --- H-3 の確認 SQL（supabase/validation/growth_metrics_check.sql）が壊れていないこと ---

Deno.test('H-3 の確認 SQL は PGlite でも期待値の RESULT で終わる（数は出さない）', async () => {
  await withDb(async db => {
    const now = Date.now();
    const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();
    await seed(db, {
      users: [
        [uid(51), daysAgo(3)],
        [uid(52), daysAgo(20)],
        [uid(53), daysAgo(90)],
      ],
      stamps: [
        [uid(51), daysAgo(2)],
        [uid(52), daysAgo(19)],
        [uid(53), daysAgo(60)],
      ],
    });
    const check = await Deno.readTextFile(
      new URL('../../validation/growth_metrics_check.sql', import.meta.url)
    );
    let message = '';
    try {
      await db.exec(check);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    assertEquals(
      message,
      'RESULT definer=yes stable=yes users=match stamps=match signups=match authenticated=denied anon=denied'
    );
  });
});
