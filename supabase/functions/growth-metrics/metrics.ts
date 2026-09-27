// グロースの数字を、集計だけの JSON にする（Issue #285 / S2・S3）
//
// 数えるのは SQL の関数 public.growth_metrics_counts（migration 20260927000000）。
// ここは I/O を持たない純関数で、次を受け持つ（D-3）:
//   - 境目の計算（metricWindows）: 時刻はすべて日本時間（D-4）。暦の計算は UTC に 9 時間足した Date の
//     getUTC* で行う（research-spot の startOfTodayJstIso と同じ考え方。日本時間に夏時間は無い）
//   - 欠けた週・月を 0 で埋める、割合、少人数の伏せ（D-10）、返す形（D-11）: buildMetrics
//   - SQL の戻り値の型の検査。返すのは許可リストのキーだけで、生の数をコピーしない
//   - 認可と応答（handleGrowthMetrics）: DB・時計・ログは注入する（index.ts が本物をつなぐ）
//
// 返す JSON を変えるとき（キーを足す・意味を変える）は SCHEMA_VERSION を上げる
import { extractBearerToken, isTokenConfigured, tokenMatches } from './token.ts';

export const SCHEMA_VERSION = 1;
/** 週・月の集団の人数（分母）がこれ未満（1〜2 人）なら、内訳と割合を null にする（D-10） */
export const MIN_COHORT_SIZE = 3;
/** 活性化: 登録から何日以内に記録したか（SQL は interval '168 hours'） */
export const ACTIVATION_WINDOW_DAYS = 7;
/** 活性化: 今週の前の何週を返すか */
export const ACTIVATION_WEEKS = 4;
/** 継続: 今月の前の何か月を返すか */
export const RETENTION_MONTHS = 6;

const TIMEZONE = 'Asia/Tokyo';
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MetricWindows {
  /** この7日: [今日 0 時 − 7日, 今日 0 時)。start / end は UTC の ISO、from / to は日本時間の日付（どちらも含む） */
  period: { start: string; end: string; from: string; to: string };
  /** 活性化: 今週の前の4週。labels は各週の月曜（YYYY-MM-DD、古い順） */
  weeks: { start: string; end: string; labels: string[] };
  /** 継続: 今月の前の6か月。labels は YYYY-MM（古い順） */
  months: { start: string; end: string; labels: string[] };
}

/** SQL の関数の引数（名前付きで rpc に渡す。キーは SQL の引数名と同じ） */
export interface RpcParams {
  p_period_start: string;
  p_period_end: string;
  p_weeks_start: string;
  p_weeks_end: string;
  p_months_start: string;
  p_months_end: string;
}

export interface ActivationWeek {
  weekStart: string;
  signups: number;
  activated: number | null;
  rate: number | null;
  complete: boolean;
}

export interface RetentionMonth {
  month: string;
  recorders: number;
  retained: number | null;
  rate: number | null;
  complete: boolean;
}

export interface GrowthMetrics {
  schemaVersion: number;
  generatedAt: string;
  timezone: string;
  period: { from: string; to: string };
  users: { total: number; last7Days: number };
  activation: { windowDays: number; minCohortSize: number; weeks: ActivationWeek[] };
  retention: { minCohortSize: number; months: RetentionMonth[] };
  stamps: { total: number; last7Days: number; recordersLast7Days: number };
  spotResearch: { requestsLast7Days: number };
  addedSpots: {
    total: { active: number; pending: number };
    last7Days: { active: number; pending: number };
  };
}

/** 日本時間の暦の y 年 m 月（0 始まり）d 日 0 時を、UTC のミリ秒で（はみ出した月・日は Date.UTC が繰り上げる） */
const jstMidnight = (y: number, m: number, d: number) => Date.UTC(y, m, d) - JST_OFFSET_MS;
const isoUtc = (ms: number) => new Date(ms).toISOString();
/** UTC のミリ秒 → 日本時間の YYYY-MM-DD */
const jstDate = (ms: number) => new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 10);
/** UTC のミリ秒 → 日本時間の YYYY-MM */
const jstMonth = (ms: number) => new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 7);

/** D-4・D-7・D-8 の境目 */
export function metricWindows(now: number): MetricWindows {
  const jst = new Date(now + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth();
  const d = jst.getUTCDate();

  const today = jstMidnight(y, m, d);
  const periodStart = jstMidnight(y, m, d - 7);

  const sinceMonday = (jst.getUTCDay() + 6) % 7; // 月曜はじまり（date_trunc('week') と同じ）
  const thisMonday = jstMidnight(y, m, d - sinceMonday);
  const mondays = Array.from({ length: ACTIVATION_WEEKS }, (_, i) =>
    jstMidnight(y, m, d - sinceMonday - 7 * (ACTIVATION_WEEKS - i))
  );

  const firstDays = Array.from({ length: RETENTION_MONTHS }, (_, i) =>
    jstMidnight(y, m - RETENTION_MONTHS + i, 1)
  );

  return {
    period: {
      start: isoUtc(periodStart),
      end: isoUtc(today),
      from: jstDate(periodStart),
      to: jstDate(today - DAY_MS),
    },
    weeks: { start: isoUtc(mondays[0]), end: isoUtc(thisMonday), labels: mondays.map(jstDate) },
    months: {
      start: isoUtc(firstDays[0]),
      end: isoUtc(jstMidnight(y, m, 1)),
      labels: firstDays.map(jstMonth),
    },
  };
}

export function toRpcParams(windows: MetricWindows): RpcParams {
  return {
    p_period_start: windows.period.start,
    p_period_end: windows.period.end,
    p_weeks_start: windows.weeks.start,
    p_weeks_end: windows.weeks.end,
    p_months_start: windows.months.start,
    p_months_end: windows.months.end,
  };
}

// --- 生の数の検査 ---

const COUNT_KEYS = [
  'users_total',
  'users_period',
  'stamps_total',
  'stamps_period',
  'recorders_period',
  'research_period',
  'added_spots_total_active',
  'added_spots_total_pending',
  'added_spots_period_active',
  'added_spots_period_pending',
] as const;

type CountKey = (typeof COUNT_KEYS)[number];

interface CohortCounts {
  total: number;
  hit: number;
}

interface RawCounts extends Record<CountKey, number> {
  activation: Map<string, CohortCounts>;
  retention: Map<string, CohortCounts>;
}

const invalidCounts = () => new Error('invalid counts');

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** activation / retention の配列を、ラベル → 分母・分子 にする */
function parseCohorts(
  value: unknown,
  labelKey: string,
  totalKey: string,
  hitKey: string
): Map<string, CohortCounts> {
  if (!Array.isArray(value)) throw invalidCounts();
  const cohorts = new Map<string, CohortCounts>();
  for (const row of value) {
    if (!isRecord(row)) throw invalidCounts();
    const label = row[labelKey];
    const total = row[totalKey];
    const hit = row[hitKey];
    if (typeof label !== 'string' || !isCount(total) || !isCount(hit)) throw invalidCounts();
    cohorts.set(label, { total, hit });
  }
  return cohorts;
}

/** 12個のキーがあり、数が0以上の整数で、配列の要素の形が合うこと。合わなければ throw（余計なキーは読まない） */
function parseRawCounts(raw: unknown): RawCounts {
  if (!isRecord(raw)) throw invalidCounts();
  const counts = {} as Record<CountKey, number>;
  for (const key of COUNT_KEYS) {
    const value = raw[key];
    if (!isCount(value)) throw invalidCounts();
    counts[key] = value;
  }
  return {
    ...counts,
    activation: parseCohorts(raw.activation, 'week', 'signups', 'activated'),
    retention: parseCohorts(raw.retention, 'month', 'recorders', 'retained'),
  };
}

// --- 返す形 ---

/** 分母が 0 なら内訳 0・割合 null、1〜2 人なら内訳も割合も null（D-10）、それ以外は実数と小数3桁の割合 */
function cohortResult({ total, hit }: CohortCounts): { hit: number | null; rate: number | null } {
  if (total === 0) return { hit: 0, rate: null };
  if (total < MIN_COHORT_SIZE) return { hit: null, rate: null };
  return { hit, rate: Math.round((hit / total) * 1000) / 1000 };
}

const EMPTY: CohortCounts = { total: 0, hit: 0 };

/** 日本時間の ISO（+09:00、秒まで） */
const jstIso = (ms: number) => new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 19) + '+09:00';

/**
 * SQL の生の数から、返す JSON を新しく組み立てる（raw はコピーしない。キーの順序もここで決まる）。
 * 生の数の形が合わなければ throw する
 */
export function buildMetrics(raw: unknown, windows: MetricWindows, now: number): GrowthMetrics {
  const c = parseRawCounts(raw);

  const weeks = windows.weeks.labels.map((label): ActivationWeek => {
    const cohort = c.activation.get(label) ?? EMPTY;
    const { hit, rate } = cohortResult(cohort);
    // その週に登録した全員に、まる7日が過ぎた（D-7）
    const monday = Date.parse(`${label}T00:00:00+09:00`);
    const complete = now >= monday + (7 + ACTIVATION_WINDOW_DAYS) * DAY_MS;
    return { weekStart: label, signups: cohort.total, activated: hit, rate, complete };
  });

  const months = windows.months.labels.map((label): RetentionMonth => {
    const cohort = c.retention.get(label) ?? EMPTY;
    const { hit, rate } = cohortResult(cohort);
    // 翌月が終わっている = 翌々月の1日 0 時を過ぎた（D-8）
    const [year, month] = label.split('-').map(Number);
    const complete = now >= jstMidnight(year, month - 1 + 2, 1);
    return { month: label, recorders: cohort.total, retained: hit, rate, complete };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: jstIso(now),
    timezone: TIMEZONE,
    period: { from: windows.period.from, to: windows.period.to },
    users: { total: c.users_total, last7Days: c.users_period },
    activation: { windowDays: ACTIVATION_WINDOW_DAYS, minCohortSize: MIN_COHORT_SIZE, weeks },
    retention: { minCohortSize: MIN_COHORT_SIZE, months },
    stamps: {
      total: c.stamps_total,
      last7Days: c.stamps_period,
      recordersLast7Days: c.recorders_period,
    },
    spotResearch: { requestsLast7Days: c.research_period },
    addedSpots: {
      total: { active: c.added_spots_total_active, pending: c.added_spots_total_pending },
      last7Days: { active: c.added_spots_period_active, pending: c.added_spots_period_pending },
    },
  };
}

// --- 認可と応答（S3） ---

export type LogLevel = 'info' | 'warn' | 'error';

export interface GrowthMetricsDeps {
  /** GROWTH_METRICS_TOKEN。未設定・空・32 文字未満なら、どんなリクエストも 401 */
  expectedToken: string | undefined;
  /** SQL の関数を service role で1回呼ぶ。失敗したら「code message」を持つ Error を throw する */
  fetchCounts(params: RpcParams): Promise<unknown>;
  now(): number;
  /** 決まった文だけを渡す（合言葉・ヘッダー・集計した数は渡さない。D-14） */
  log(level: LogLevel, message: string): void;
}

export interface GrowthMetricsResponse {
  status: number;
  headers: Record<string, string>;
  body: GrowthMetrics | { error: string };
}

const LOG_PREFIX = '[growth-metrics]';

/** 呼ぶのはルーティン（サーバー）なので、CORS のヘッダーは付けない（D-12） */
function respond(
  status: number,
  body: GrowthMetricsResponse['body'],
  extraHeaders: Record<string, string> = {}
): GrowthMetricsResponse {
  return {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
    body,
  };
}

/**
 * D-12 の順で判定する: ① GET 以外は 405 ② 合言葉を定数時間で比べて、合わなければ 401 ③ 合ったときだけ数える。
 * 401・405 の前に DB に触らない。500 の本文にエラーの文を入れない
 */
export async function handleGrowthMetrics(
  deps: GrowthMetricsDeps,
  method: string,
  authorization: string | null
): Promise<GrowthMetricsResponse> {
  if (method !== 'GET') {
    deps.log('warn', `${LOG_PREFIX} method not allowed`);
    return respond(405, { error: 'method not allowed' }, { Allow: 'GET' });
  }

  if (!isTokenConfigured(deps.expectedToken)) {
    deps.log('warn', `${LOG_PREFIX} token not configured`);
    return respond(401, { error: 'unauthorized' });
  }
  if (!(await tokenMatches(extractBearerToken(authorization), deps.expectedToken))) {
    deps.log('warn', `${LOG_PREFIX} unauthorized`);
    return respond(401, { error: 'unauthorized' });
  }

  const now = deps.now();
  const windows = metricWindows(now);
  let raw: unknown;
  try {
    raw = await deps.fetchCounts(toRpcParams(windows));
  } catch (error) {
    // SQL の引数は時刻だけなので、rpc のエラーの文に個人の値は入らない（D-14）
    const detail = error instanceof Error ? error.message : String(error);
    deps.log('error', `${LOG_PREFIX} failed: ${detail}`);
    return respond(500, { error: 'internal error' });
  }

  let body: GrowthMetrics;
  try {
    body = buildMetrics(raw, windows, now);
  } catch {
    deps.log('error', `${LOG_PREFIX} failed: invalid counts`);
    return respond(500, { error: 'internal error' });
  }

  deps.log('info', `${LOG_PREFIX} ok`);
  return respond(200, body);
}
