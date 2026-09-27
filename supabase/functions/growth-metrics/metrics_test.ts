// Deno ユニットテスト（Jest からは *_test.ts 命名により不可視）
// 実行: deno test -A --node-modules-dir=none supabase/functions/growth-metrics/
//
// 契約書: docs/issues/issue-285-growth-metrics.md（S2 / AC-10〜AC-15、S3 / AC-17〜AC-21）
// 合言葉はダミーの値だけを使う
import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import {
  ACTIVATION_WEEKS,
  ACTIVATION_WINDOW_DAYS,
  MIN_COHORT_SIZE,
  RETENTION_MONTHS,
  SCHEMA_VERSION,
  buildMetrics,
  handleGrowthMetrics,
  metricWindows,
  toRpcParams,
  type GrowthMetricsDeps,
  type RpcParams,
} from './metrics.ts';

// 2026-09-28（月）09:00 JST
const NOW = Date.parse('2026-09-28T09:00:00+09:00');

/** SQL が返す生の数（契約書の「返す JSON」の例になる値） */
function rawCounts(): Record<string, unknown> {
  return {
    users_total: 42,
    users_period: 5,
    stamps_total: 310,
    stamps_period: 25,
    recorders_period: 7,
    research_period: 4,
    added_spots_total_active: 3,
    added_spots_total_pending: 9,
    added_spots_period_active: 1,
    added_spots_period_pending: 2,
    activation: [
      { week: '2026-08-24', signups: 8, activated: 8 }, // labels に無い → 捨てる
      { week: '2026-08-31', signups: 4, activated: 3 },
      { week: '2026-09-07', signups: 2, activated: 1 },
      // 2026-09-14 は人がいない → 0 で埋める
      { week: '2026-09-21', signups: 5, activated: 1 },
    ],
    retention: [
      { month: '2026-07', recorders: 3, retained: 2 },
      { month: '2026-08', recorders: 9, retained: 4 },
      { month: '2026-09', recorders: 6, retained: 0 }, // labels に無い（今月）→ 捨てる
    ],
  };
}

/** 契約書の「返す JSON」の例（キーの順序もこのとおり） */
const EXPECTED_BODY = {
  schemaVersion: 1,
  generatedAt: '2026-09-28T09:00:00+09:00',
  timezone: 'Asia/Tokyo',
  period: { from: '2026-09-21', to: '2026-09-27' },
  users: { total: 42, last7Days: 5 },
  activation: {
    windowDays: 7,
    minCohortSize: 3,
    weeks: [
      { weekStart: '2026-08-31', signups: 4, activated: 3, rate: 0.75, complete: true },
      { weekStart: '2026-09-07', signups: 2, activated: null, rate: null, complete: true },
      { weekStart: '2026-09-14', signups: 0, activated: 0, rate: null, complete: true },
      { weekStart: '2026-09-21', signups: 5, activated: 1, rate: 0.2, complete: false },
    ],
  },
  retention: {
    minCohortSize: 3,
    months: [
      { month: '2026-03', recorders: 0, retained: 0, rate: null, complete: true },
      { month: '2026-04', recorders: 0, retained: 0, rate: null, complete: true },
      { month: '2026-05', recorders: 0, retained: 0, rate: null, complete: true },
      { month: '2026-06', recorders: 0, retained: 0, rate: null, complete: true },
      { month: '2026-07', recorders: 3, retained: 2, rate: 0.667, complete: true },
      { month: '2026-08', recorders: 9, retained: 4, rate: 0.444, complete: false },
    ],
  },
  stamps: { total: 310, last7Days: 25, recordersLast7Days: 7 },
  spotResearch: { requestsLast7Days: 4 },
  addedSpots: {
    total: { active: 3, pending: 9 },
    last7Days: { active: 1, pending: 2 },
  },
};

const build = (raw: unknown, now = NOW) => buildMetrics(raw, metricWindows(now), now);

// --- 定数 ---

Deno.test('定数: schemaVersion 1・伏せる閾値 3・7日・4週・6か月', () => {
  assertEquals(SCHEMA_VERSION, 1);
  assertEquals(MIN_COHORT_SIZE, 3);
  assertEquals(ACTIVATION_WINDOW_DAYS, 7);
  assertEquals(ACTIVATION_WEEKS, 4);
  assertEquals(RETENTION_MONTHS, 6);
});

// --- AC-10: metricWindows ---

Deno.test('AC-10: 2026-09-28（月）09:00 JST の境目', () => {
  const w = metricWindows(NOW);
  assertEquals(w.period, {
    start: '2026-09-20T15:00:00.000Z',
    end: '2026-09-27T15:00:00.000Z',
    from: '2026-09-21',
    to: '2026-09-27',
  });
  assertEquals(w.weeks, {
    start: '2026-08-30T15:00:00.000Z',
    end: '2026-09-27T15:00:00.000Z',
    labels: ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'],
  });
  assertEquals(w.months, {
    start: '2026-02-28T15:00:00.000Z',
    end: '2026-08-31T15:00:00.000Z',
    labels: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'],
  });
});

Deno.test('toRpcParams: SQL の引数名で境目を渡す', () => {
  assertEquals(toRpcParams(metricWindows(NOW)), {
    p_period_start: '2026-09-20T15:00:00.000Z',
    p_period_end: '2026-09-27T15:00:00.000Z',
    p_weeks_start: '2026-08-30T15:00:00.000Z',
    p_weeks_end: '2026-09-27T15:00:00.000Z',
    p_months_start: '2026-02-28T15:00:00.000Z',
    p_months_end: '2026-08-31T15:00:00.000Z',
  });
});

// --- AC-11: 日本時間の境目 ---

Deno.test('AC-11: 日本時間の日曜 23:59:59.999 はまだ前の週・前の日', () => {
  const w = metricWindows(Date.parse('2026-09-27T14:59:59.999Z'));
  assertEquals(w.period.to, '2026-09-26');
  assertEquals(w.period.from, '2026-09-20');
  assertEquals(w.weeks.labels.at(-1), '2026-09-14');
});

Deno.test('AC-11: 日本時間の月曜 0:00 で新しい週・新しい日', () => {
  const w = metricWindows(Date.parse('2026-09-27T15:00:00.000Z'));
  assertEquals(w.period.to, '2026-09-27');
  assertEquals(w.weeks.labels.at(-1), '2026-09-21');
  assertEquals(w.weeks.end, '2026-09-27T15:00:00.000Z');
});

Deno.test('AC-11: 日本時間 10/1 0:00 で月が進む', () => {
  const w = metricWindows(Date.parse('2026-09-30T15:00:00.000Z'));
  assertEquals(w.months.labels, ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  assertEquals(w.months.end, '2026-09-30T15:00:00.000Z');
  // その1ミリ秒前はまだ 9 月
  const before = metricWindows(Date.parse('2026-09-30T14:59:59.999Z'));
  assertEquals(before.months.labels.at(-1), '2026-08');
});

Deno.test('AC-11: 年をまたぐ（2027-01-04）', () => {
  const w = metricWindows(Date.parse('2027-01-04T01:00:00.000Z'));
  assertEquals(w.months.labels, ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
  assertEquals(w.months.start, '2026-06-30T15:00:00.000Z');
  assertEquals(w.months.end, '2026-12-31T15:00:00.000Z');
  assertEquals(w.weeks.labels, ['2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28']);
  assertEquals(w.period.from, '2026-12-28');
  assertEquals(w.period.to, '2027-01-03');
});

// --- AC-12: 並べ方・割合・complete ---

Deno.test(
  'AC-12: 欠けた週・月は 0 で埋め、labels に無いものは捨てる。complete は D-7 / D-8 のとおり',
  () => {
    const body = build(rawCounts());
    assertEquals(
      body.activation.weeks.map(w => w.weekStart),
      ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21']
    );
    assertEquals(body.activation.weeks[2], {
      weekStart: '2026-09-14',
      signups: 0,
      activated: 0,
      rate: null,
      complete: true,
    });
    assertEquals(
      body.retention.months.map(m => m.month),
      ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']
    );
    assertEquals(body.retention.months[0], {
      month: '2026-03',
      recorders: 0,
      retained: 0,
      rate: null,
      complete: true,
    });
    assertEquals(
      body.activation.weeks.map(w => w.complete),
      [true, true, true, false]
    );
    assertEquals(
      body.retention.months.map(m => m.complete),
      [true, true, true, true, true, false]
    );
  }
);

Deno.test('AC-12: rate は小数3桁に丸める（2/3 → 0.667、1/4 → 0.25）', () => {
  const raw = rawCounts();
  raw.activation = [{ week: '2026-08-31', signups: 4, activated: 1 }];
  raw.retention = [{ month: '2026-07', recorders: 3, retained: 2 }];
  const body = build(raw);
  assertEquals(body.activation.weeks[0].rate, 0.25);
  assertEquals(body.retention.months[4].rate, 0.667);
});

Deno.test('AC-12: complete の境目（週は月曜 0 時 + 14日、月は翌々月の1日 0 時）', () => {
  // 2026-09-14 の週: 2026-09-28 00:00 JST で complete になる
  const beforeWeek = Date.parse('2026-09-27T14:59:59.999Z');
  const atWeek = Date.parse('2026-09-27T15:00:00.000Z');
  const weekOf = (now: number, label: string) =>
    build(rawCounts(), now).activation.weeks.find(w => w.weekStart === label)?.complete;
  assertEquals(weekOf(beforeWeek, '2026-09-07'), true);
  assertEquals(weekOf(beforeWeek, '2026-09-14'), false);
  assertEquals(weekOf(atWeek, '2026-09-14'), true);
  // 2026-08 の月: 2026-10-01 00:00 JST で complete になる
  const monthOf = (now: number, label: string) =>
    build(rawCounts(), now).retention.months.find(m => m.month === label)?.complete;
  assertEquals(monthOf(Date.parse('2026-09-30T14:59:59.999Z'), '2026-08'), false);
  assertEquals(monthOf(Date.parse('2026-09-30T15:00:00.000Z'), '2026-08'), true);
});

// --- AC-13: 伏せ方 ---

Deno.test('AC-13: 分母が 1・2 なら内訳と rate を null、3 なら実数と割合、0 なら 0 と null', () => {
  const raw = rawCounts();
  raw.activation = [
    { week: '2026-08-31', signups: 1, activated: 1 },
    { week: '2026-09-07', signups: 2, activated: 0 },
    { week: '2026-09-14', signups: 3, activated: 1 },
  ];
  raw.retention = [
    { month: '2026-06', recorders: 1, retained: 0 },
    { month: '2026-07', recorders: 2, retained: 2 },
    { month: '2026-08', recorders: 3, retained: 3 },
  ];
  const body = build(raw);
  assertEquals(
    body.activation.weeks.map(w => [w.signups, w.activated, w.rate]),
    [
      [1, null, null],
      [2, null, null],
      [3, 1, 0.333],
      [0, 0, null],
    ]
  );
  assertEquals(
    body.retention.months.slice(3).map(m => [m.recorders, m.retained, m.rate]),
    [
      [1, null, null],
      [2, null, null],
      [3, 3, 1],
    ]
  );
});

Deno.test('AC-13: 全体の数は 1 でも伏せない', () => {
  const raw = rawCounts();
  raw.users_total = 1;
  raw.recorders_period = 1;
  raw.added_spots_period_active = 1;
  const body = build(raw);
  assertEquals(body.users.total, 1);
  assertEquals(body.stamps.recordersLast7Days, 1);
  assertEquals(body.addedSpots.last7Days.active, 1);
});

// --- AC-14: 返す形 ---

Deno.test('AC-14: 本文は「返す JSON」とキーの集合・順序・値まで一致する', () => {
  const body = build(rawCounts());
  assertEquals(body, EXPECTED_BODY);
  // assertEquals はキーの順序を見ないので、文字列でも比べる
  assertEquals(JSON.stringify(body), JSON.stringify(EXPECTED_BODY));
});

Deno.test('AC-14: 生の数に個人の値が混ざっていても、本文は変わらない', () => {
  const raw = {
    ...rawCounts(),
    user_id: '11111111-2222-3333-4444-555555555555',
    email: 'someone@example.com',
    name: '鹿島台神社',
    lat: 38.46,
    lng: 141.08,
    address: '宮城県大崎市鹿島台平渡',
    image_path: 'users/11111111-2222-3333-4444-555555555555/a.jpg',
  };
  const body = build(raw);
  assertEquals(JSON.stringify(body), JSON.stringify(EXPECTED_BODY));
  const text = JSON.stringify(body);
  assertEquals(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text), false);
  assertEquals(text.includes('@'), false);
});

Deno.test('AC-14: 配列の要素に余計なキーがあっても出さない', () => {
  const raw = rawCounts();
  raw.activation = [
    {
      week: '2026-08-31',
      signups: 4,
      activated: 3,
      user_ids: ['11111111-2222-3333-4444-555555555555'],
    },
  ];
  const body = build(raw);
  assertEquals(Object.keys(body.activation.weeks[0]), [
    'weekStart',
    'signups',
    'activated',
    'rate',
    'complete',
  ]);
  assertEquals(JSON.stringify(body).includes('user_ids'), false);
});

// --- AC-15: 生の数の形が合わない ---

Deno.test('AC-15: 生の数の形が合わなければ throw する', () => {
  const cases: [string, (raw: Record<string, unknown>) => unknown][] = [
    [
      'キーが欠ける',
      raw => {
        delete raw.stamps_total;
        return raw;
      },
    ],
    ['負の数', raw => ({ ...raw, users_total: -1 })],
    ['小数', raw => ({ ...raw, stamps_period: 1.5 })],
    ['文字列の数', raw => ({ ...raw, research_period: '4' })],
    ['activation が配列でない', raw => ({ ...raw, activation: {} })],
    ['retention が配列でない', raw => ({ ...raw, retention: null })],
    [
      'activation の要素の数が文字列',
      raw => ({ ...raw, activation: [{ week: '2026-08-31', signups: '4', activated: 3 }] }),
    ],
    [
      'retention の要素にラベルが無い',
      raw => ({ ...raw, retention: [{ recorders: 3, retained: 2 }] }),
    ],
    [
      'retention の要素の数が負',
      raw => ({ ...raw, retention: [{ month: '2026-07', recorders: 3, retained: -2 }] }),
    ],
    ['null', () => null],
    ['配列', () => []],
  ];
  for (const [label, make] of cases) {
    assertThrows(() => build(make(rawCounts())), Error, 'invalid counts', label);
  }
});

// --- handleGrowthMetrics（S3） ---

const TOKEN = 'dummy-token-'.padEnd(64, '0');
const WRONG = 'wrong-dummy-'.padEnd(64, '9');

function makeDeps(options: { expectedToken?: string; counts?: () => Promise<unknown> } = {}) {
  const calls: RpcParams[] = [];
  const logs: { level: string; message: string }[] = [];
  const deps: GrowthMetricsDeps = {
    expectedToken: 'expectedToken' in options ? options.expectedToken : TOKEN,
    fetchCounts: params => {
      calls.push(params);
      return options.counts ? options.counts() : Promise.resolve(rawCounts());
    },
    now: () => NOW,
    log: (level, message) => logs.push({ level, message }),
  };
  return { deps, calls, logs };
}

/** ログのどの行にも、合言葉（関数側・送られてきた値）が出ていない */
function assertNoSecrets(logs: { message: string }[], ...secrets: string[]) {
  for (const { message } of logs) {
    for (const secret of secrets) assert(!message.includes(secret), 'ログに合言葉が出ている');
  }
}

Deno.test('AC-17: GET 以外は合言葉が正しくても 405・Allow: GET で、数えない', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const { deps, calls, logs } = makeDeps();
    const res = await handleGrowthMetrics(deps, method, `Bearer ${TOKEN}`);
    assertEquals(res.status, 405, method);
    assertEquals(res.headers.Allow, 'GET');
    assertEquals(res.body, { error: 'method not allowed' });
    assertEquals(calls.length, 0);
    assertEquals(logs, [{ level: 'warn', message: '[growth-metrics] method not allowed' }]);
    assertNoSecrets(logs, TOKEN);
  }
});

Deno.test(
  'AC-18 / AC-21: 合言葉が無い・違う・Bearer でない・Basic は 401 で、数えない',
  async () => {
    const headers = [null, `Bearer ${WRONG}`, TOKEN, `Basic ${TOKEN}`, 'Bearer '];
    for (const authorization of headers) {
      const { deps, calls, logs } = makeDeps();
      const res = await handleGrowthMetrics(deps, 'GET', authorization);
      assertEquals(res.status, 401, String(authorization));
      assertEquals(res.body, { error: 'unauthorized' });
      assertEquals(calls.length, 0);
      assertEquals(logs, [{ level: 'warn', message: '[growth-metrics] unauthorized' }]);
      assertNoSecrets(logs, TOKEN, WRONG);
    }
  }
);

Deno.test(
  'AC-18 / AC-21: 関数側の合言葉が未設定・空・31 文字なら、同じ値が来ても 401（token not configured）',
  async () => {
    const short = TOKEN.slice(0, 31);
    const cases: [string | undefined, string][] = [
      [undefined, `Bearer ${TOKEN}`],
      ['', `Bearer ${TOKEN}`],
      [short, `Bearer ${short}`],
    ];
    for (const [expectedToken, authorization] of cases) {
      const { deps, calls, logs } = makeDeps({ expectedToken });
      const res = await handleGrowthMetrics(deps, 'GET', authorization);
      assertEquals(res.status, 401, String(expectedToken?.length));
      assertEquals(res.body, { error: 'unauthorized' });
      assertEquals(calls.length, 0);
      assertEquals(logs, [{ level: 'warn', message: '[growth-metrics] token not configured' }]);
      assertNoSecrets(logs, TOKEN, short);
    }
  }
);

Deno.test(
  'AC-19 / AC-21: 合言葉が合うと 200。1回だけ数え、引数は toRpcParams(metricWindows(now))',
  async () => {
    const { deps, calls, logs } = makeDeps();
    const res = await handleGrowthMetrics(deps, 'GET', `Bearer ${TOKEN}`);
    assertEquals(res.status, 200);
    assertEquals(calls, [toRpcParams(metricWindows(NOW))]);
    assertEquals(res.headers['Content-Type'], 'application/json');
    assertEquals(res.headers['Cache-Control'], 'no-store');
    assertEquals(
      Object.keys(res.headers).filter(h => h.toLowerCase().startsWith('access-control-')),
      []
    );
    assertEquals(JSON.stringify(res.body), JSON.stringify(EXPECTED_BODY));
    assertEquals(logs, [{ level: 'info', message: '[growth-metrics] ok' }]);
    assertNoSecrets(logs, TOKEN);
  }
);

Deno.test('AC-17〜AC-20: どの応答にも CORS のヘッダーを付けない', async () => {
  const cases: [string, string | null][] = [
    ['OPTIONS', null],
    ['GET', null],
    ['GET', `Bearer ${TOKEN}`],
  ];
  for (const [method, authorization] of cases) {
    const { deps } = makeDeps();
    const res = await handleGrowthMetrics(deps, method, authorization);
    assertEquals(
      Object.keys(res.headers).filter(h => h.toLowerCase().startsWith('access-control-')),
      []
    );
  }
});

Deno.test(
  'AC-20 / AC-21: 数えるのに失敗したら 500。本文は internal error だけで、エラーの文は返さない',
  async () => {
    const { deps, calls, logs } = makeDeps({
      counts: () => Promise.reject(new Error('42P01 relation "public.stamps" does not exist')),
    });
    const res = await handleGrowthMetrics(deps, 'GET', `Bearer ${TOKEN}`);
    assertEquals(res.status, 500);
    assertEquals(res.body, { error: 'internal error' });
    assertEquals(JSON.stringify(res.body).includes('relation'), false);
    assertEquals(calls.length, 1);
    assertEquals(logs.length, 1);
    assertEquals(logs[0].level, 'error');
    assert(logs[0].message.startsWith('[growth-metrics] failed:'));
    assertEquals(
      logs[0].message,
      '[growth-metrics] failed: 42P01 relation "public.stamps" does not exist'
    );
    assertNoSecrets(logs, TOKEN);
  }
);

Deno.test('AC-20 / AC-21: 生の数の形が合わなければ 500（failed: invalid counts）', async () => {
  for (const counts of [{}, null, { ...rawCounts(), users_total: '42' }]) {
    const { deps, logs } = makeDeps({ counts: () => Promise.resolve(counts) });
    const res = await handleGrowthMetrics(deps, 'GET', `Bearer ${TOKEN}`);
    assertEquals(res.status, 500);
    assertEquals(res.body, { error: 'internal error' });
    assertEquals(logs, [{ level: 'error', message: '[growth-metrics] failed: invalid counts' }]);
  }
});

Deno.test('AC-21: Error でない値が throw されても 500 で、決まった書き出しのログ', async () => {
  const { deps, logs } = makeDeps({ counts: () => Promise.reject('boom') });
  const res = await handleGrowthMetrics(deps, 'GET', `Bearer ${TOKEN}`);
  assertEquals(res.status, 500);
  assertEquals(res.body, { error: 'internal error' });
  assertEquals(logs, [{ level: 'error', message: '[growth-metrics] failed: boom' }]);
});
