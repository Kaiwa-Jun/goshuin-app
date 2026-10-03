// 寺社のマスタの座標の直し（Issue #292）。台帳・migration・確かめる SQL・seed の書き換えを作る純関数。
// ファイルの読み書きは main.ts。契約書: docs/issues/issue-292-spot-coords.md（D-1〜D-14）

/** 座標を比べる幅（度。約 0.1m）。migration と確かめる SQL で使う */
export const EPS = 1e-6;
/** 台帳の新座標と seed に書く小数の桁 */
export const COORD_DECIMALS = 6;
/** 旧と新の距離の下限・上限（m） */
export const MIN_MOVE_M = 10;
export const MAX_MOVE_M = 100_000;
/** 台帳の OSM 由来の上限（全部の弾の合計。OSMF の Substantial - Guideline の 100 Features 未満） */
export const MAX_OSM_FEATURES = 99;
/** seed の数と台帳の旧座標を同じとみなす幅 */
const SEED_EPS = 1e-9;

export const LEDGER_PATH = 'supabase/data/spot-coords-292.json';
export const CHECK_SQL_PATH = 'supabase/validation/spot_coords_292_check.sql';
const MIYAGI_SEED = 'supabase/seed_miyagi_spots_and_pilgrimages.sql';

/** 寺社の行がある seed（この 10 本だけを数え、書き換え、PGlite に流す） */
export const SEED_FILES: readonly string[] = [
  'supabase/seeds/01_hokkaido_tohoku.sql',
  'supabase/seeds/02_kanto.sql',
  'supabase/seeds/03_chubu.sql',
  'supabase/seeds/04_kinki.sql',
  'supabase/seeds/05_chugoku_shikoku.sql',
  'supabase/seeds/06_kyushu_okinawa.sql',
  'supabase/seeds/seed_tokyo_spots.sql',
  'supabase/seeds/seed_tokyo_rank3_4_spots.sql',
  'supabase/seeds/seed_kyoto_rank_spots.sql',
  MIYAGI_SEED,
];

export function migrationPath(version: string, batch: number): string {
  return `supabase/migrations/${version}_spot_coords_292_batch${batch}.sql`;
}

// --- 型 ---

export type Source = 'wikidata' | 'osm' | 'owner';
export type Confidence = 'high' | 'medium';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LedgerEntry {
  batch: number;
  idx: number;
  name: string;
  prefecture: string;
  seedFile: string;
  seedLine: number;
  old: LatLng;
  new: LatLng;
  source: Source;
  ref: string | null;
  confidence: Confidence;
  basis: string;
}

export interface Ledger {
  schemaVersion: 1;
  issue: 292;
  note: string;
  attribution: { wikidata: string; osm: string };
  entries: LedgerEntry[];
}

/** 下書き（decisions-draft.json の items[]）の1行。使うキーだけ */
export interface DraftItem {
  idx: number;
  name: string;
  prefecture: string;
  file: string;
  line: number;
  prod_match: ({ name?: string; prefecture?: string } & LatLng) | null;
  seed?: LatLng;
  decision: string;
  lat: number | null;
  lng: number | null;
  source: string | null;
  confidence: string | null;
  reason: string;
  source_ref?: string;
}

/** オーナーの書き出し（review-owner.html の items[]）の1行 */
export interface OwnerItem {
  idx: number;
  name: string;
  prefecture: string;
  file: string;
  line: number;
  verdict?: string;
  priority?: string;
  seed: LatLng;
  choice: string;
  lat: number | null;
  lng: number | null;
  /** 出どころの ID（wd は Q-ID・osm は node/way/relation）。#301 の画面の書き出しにだけある */
  ref?: string | null;
  note?: string | null;
  chosen_at?: string;
}

// --- 小さな道具 ---

export function coordText(n: number): string {
  return n.toFixed(COORD_DECIMALS);
}

function round6(n: number): number {
  return Number(coordText(n));
}

/** ハバーサイン（地球の半径 6,371km。src/utils/geo.ts と同じ） */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function label(e: { name: string; prefecture: string }): string {
  return `${e.name}（${e.prefecture}）`;
}

function where(e: {
  name: string;
  prefecture: string;
  seedFile?: string;
  seedLine?: number;
}): string {
  return e.seedFile ? `${e.seedFile}:${e.seedLine} ${label(e)}` : label(e);
}

// --- D-1: 第1弾の選び方 ---

const FIRST_BATCH_CHECK_SOURCE = /^(wd|osm|wdc\d+|osmc\d+)$/;

export function selectFirstBatch(
  item: Pick<DraftItem, 'decision' | 'source' | 'confidence'>
): boolean {
  if (item.decision === 'fix') return item.source === 'wikidata' || item.source === 'osm';
  return (
    item.decision === 'check_decided' &&
    item.confidence === '高' &&
    FIRST_BATCH_CHECK_SOURCE.test(item.source ?? '')
  );
}

function normalizeDraftSource(source: string | null): 'wikidata' | 'osm' | null {
  if (source === 'wikidata' || source === 'wd' || /^wdc\d+$/.test(source ?? '')) return 'wikidata';
  if (source === 'osm' || /^osmc\d+$/.test(source ?? '')) return 'osm';
  return null;
}

function latLng(v: unknown, what: string): LatLng {
  const o = v as { lat?: unknown; lng?: unknown } | null;
  if (!o || typeof o.lat !== 'number' || typeof o.lng !== 'number') {
    throw new Error(`${what} の lat / lng が数でない`);
  }
  return { lat: o.lat, lng: o.lng };
}

export function draftItemToEntry(item: DraftItem, batch: number): LedgerEntry {
  const who = `${item.file}:${item.line} ${label(item)}`;
  const source = normalizeDraftSource(item.source);
  if (!source) throw new Error(`${who}: 出どころ ${item.source} は台帳に入れられない`);
  if (!item.source_ref) throw new Error(`${who}: source_ref が無い`);
  const next = latLng({ lat: item.lat, lng: item.lng }, who);
  return {
    batch,
    idx: item.idx,
    name: item.name,
    prefecture: item.prefecture,
    seedFile: item.file,
    seedLine: item.line,
    old: latLng(item.prod_match, `${who}: prod_match`),
    new: { lat: round6(next.lat), lng: round6(next.lng) },
    source,
    ref: item.source_ref,
    confidence: 'high',
    basis: item.reason,
  };
}

// --- D-11: オーナーの選択 ---

const OWNER_CHOICE: Record<string, Source> = { wd: 'wikidata', osm: 'osm', custom: 'owner' };

export function resolveSeedPath(file: string): string {
  if (SEED_FILES.includes(file)) return file;
  const path =
    file === 'seed_miyagi_spots_and_pilgrimages.sql' ? MIYAGI_SEED : `supabase/seeds/${file}`;
  if (file.includes('/') || !SEED_FILES.includes(path)) {
    throw new Error(`寺社の行がある seed ではない: ${file}`);
  }
  return path;
}

export function ownerItemToEntry(item: OwnerItem, batch: number): LedgerEntry | null {
  const who = `${item.file}:${item.line} ${label(item)}`;
  if (item.choice === 'seed') return null;
  if (item.choice === 'gsi') {
    throw new Error(`${who}: 国土地理院由来（gsi）は出典の表示が未決なので取り込まない（D-12）`);
  }
  const source = OWNER_CHOICE[item.choice];
  if (!source) throw new Error(`${who}: 知らない choice: ${item.choice}`);
  const next = latLng({ lat: item.lat, lng: item.lng }, who);
  const note = (item.note ?? '').trim();
  // #301 の画面の書き出しは Q-ID・OSM の要素を持つ（review-owner.html の書き出しは持たない）
  const ref = item.ref ?? null;
  const pattern = REF_PATTERN[source];
  if (ref !== null && (!pattern || !pattern.test(ref))) {
    throw new Error(`${who}: ${source} の ref の形が違う: ${ref}`);
  }
  return {
    batch,
    idx: item.idx,
    name: item.name,
    prefecture: item.prefecture,
    seedFile: resolveSeedPath(item.file),
    seedLine: item.line,
    old: latLng(item.seed, `${who}: seed`),
    new: { lat: round6(next.lat), lng: round6(next.lng) },
    source,
    ref,
    confidence: 'high',
    basis: `オーナーが選んだ（${item.choice}）${note ? `。${note}` : ''}`,
  };
}

// --- D-9: 台帳 ---

export function emptyLedger(): Ledger {
  return {
    schemaVersion: 1,
    issue: 292,
    note: '寺社のマスタ（created_by_user_id が NULL の spots と seed）の座標の直し。old は直す前の本番と seed の値、new は直す値（小数6桁）。migration・確かめる SQL・seed の書き換えはこの台帳から supabase/scripts/spot-coords/main.ts で作る',
    attribution: {
      wikidata: 'Wikidata（CC0 1.0）https://www.wikidata.org/',
      osm: '© OpenStreetMap contributors（ODbL 1.0）https://www.openstreetmap.org/copyright',
    },
    entries: [],
  };
}

const ENTRY_KEYS = [
  'batch',
  'idx',
  'name',
  'prefecture',
  'seedFile',
  'seedLine',
  'old',
  'new',
  'source',
  'ref',
  'confidence',
  'basis',
];

const REF_PATTERN: Record<Source, RegExp | null> = {
  wikidata: /^Q\d+$/,
  osm: /^(node|way|relation)\/\d+$/,
  owner: null,
};

function isInt(v: unknown, min: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min;
}

function checkCoord(p: LatLng, what: string): void {
  if (!(p.lat >= 20 && p.lat <= 46 && p.lng >= 122 && p.lng <= 154)) {
    throw new Error(`${what} が日本の範囲（lat 20〜46・lng 122〜154）の外: ${p.lat}, ${p.lng}`);
  }
}

/** 1行を検査し、キーの順をそろえた新しい行を返す */
function parseEntry(raw: unknown, i: number): LedgerEntry {
  const e = raw as Record<string, unknown>;
  if (!e || typeof e !== 'object') throw new Error(`entries[${i}] がオブジェクトでない`);
  const name = e.name;
  const prefecture = e.prefecture;
  if (typeof name !== 'string' || name === '' || name.includes('$')) {
    throw new Error(`entries[${i}]: name が空か $ を含む: ${String(name)}`);
  }
  if (typeof prefecture !== 'string' || !/[都道府県]$/.test(prefecture)) {
    throw new Error(`entries[${i}] ${name}: prefecture が都道府県でない: ${String(prefecture)}`);
  }
  const who = `${String(e.seedFile)}:${String(e.seedLine)} ${label({ name, prefecture })}`;
  const extra = Object.keys(e).filter(k => !ENTRY_KEYS.includes(k));
  if (extra.length > 0) throw new Error(`${who}: 知らないキー ${extra.join(', ')}`);
  if (!isInt(e.batch, 1)) throw new Error(`${who}: batch が 1 以上の整数でない`);
  if (!isInt(e.idx, 1)) throw new Error(`${who}: idx が 1 以上の整数でない`);
  if (typeof e.seedFile !== 'string' || !SEED_FILES.includes(e.seedFile)) {
    throw new Error(`${who}: seedFile が寺社の行がある seed ではない`);
  }
  if (!isInt(e.seedLine, 1)) throw new Error(`${who}: seedLine が 1 以上の整数でない`);
  const old = latLng(e.old, `${who}: old`);
  const next = latLng(e.new, `${who}: new`);
  checkCoord(old, `${who}: old`);
  checkCoord(next, `${who}: new`);
  if (round6(next.lat) !== next.lat || round6(next.lng) !== next.lng) {
    throw new Error(`${who}: new が小数${COORD_DECIMALS}桁を超える: ${next.lat}, ${next.lng}`);
  }
  const d = distanceMeters(old, next);
  if (!(d >= MIN_MOVE_M && d <= MAX_MOVE_M)) {
    throw new Error(
      `${who}: 旧と新の距離 ${Math.round(d)}m が ${MIN_MOVE_M}m〜${MAX_MOVE_M}m の外`
    );
  }
  const source = e.source as Source;
  if (source === ('gsi' as string)) {
    throw new Error(`${who}: 国土地理院由来（gsi）は台帳に入れない（D-12）`);
  }
  if (!(source in REF_PATTERN)) throw new Error(`${who}: 知らない source: ${String(source)}`);
  const ref = e.ref;
  const pattern = REF_PATTERN[source];
  if (ref === null) {
    if (source !== 'owner' && e.batch === 1) throw new Error(`${who}: 第1弾は ref が要る`);
  } else if (typeof ref !== 'string' || !pattern || !pattern.test(ref)) {
    throw new Error(`${who}: ${source} の ref の形が違う: ${String(ref)}`);
  }
  if (e.confidence !== 'high' && e.confidence !== 'medium') {
    throw new Error(`${who}: confidence が high / medium でない`);
  }
  if (typeof e.basis !== 'string' || e.basis.trim() === '') throw new Error(`${who}: basis が空`);
  return {
    batch: e.batch,
    idx: e.idx,
    name,
    prefecture,
    seedFile: e.seedFile,
    seedLine: e.seedLine,
    old,
    new: next,
    source,
    ref: ref as string | null,
    confidence: e.confidence,
    basis: e.basis,
  };
}

/** 台帳の検査（JSON の文字でも、読んだ値でもよい）。重なり・OSM の上限で止める */
export function parseLedger(json: unknown): Ledger {
  const raw = (typeof json === 'string' ? JSON.parse(json) : json) as Record<string, unknown>;
  if (!raw || raw.schemaVersion !== 1 || raw.issue !== 292) {
    throw new Error('台帳ではない（schemaVersion 1・issue 292 のはず）');
  }
  const attribution = raw.attribution as Record<string, unknown> | undefined;
  if (
    typeof raw.note !== 'string' ||
    typeof attribution?.wikidata !== 'string' ||
    typeof attribution?.osm !== 'string'
  ) {
    throw new Error('台帳の note / attribution が無い');
  }
  if (!Array.isArray(raw.entries)) throw new Error('台帳の entries が配列でない');
  const entries = raw.entries.map(parseEntry);

  const byName = new Map<string, LedgerEntry>();
  const byIdx = new Map<number, LedgerEntry>();
  for (const e of entries) {
    const key = `${e.name}\u0000${e.prefecture}`;
    const dupName = byName.get(key);
    if (dupName)
      throw new Error(`${where(e)}: 名前と都道府県が台帳の中で重なる（${where(dupName)}）`);
    const dupIdx = byIdx.get(e.idx);
    if (dupIdx) throw new Error(`${where(e)}: idx ${e.idx} が台帳の中で重なる（${where(dupIdx)}）`);
    byName.set(key, e);
    byIdx.set(e.idx, e);
  }
  const osm = entries.filter(e => e.source === 'osm').length;
  if (osm > MAX_OSM_FEATURES) {
    throw new Error(
      `台帳の OSM 由来が ${osm} 件。全部の弾を合わせて ${MAX_OSM_FEATURES} 件まで（D-12）`
    );
  }
  return {
    schemaVersion: 1,
    issue: 292,
    note: raw.note,
    attribution: { wikidata: attribution.wikidata, osm: attribution.osm },
    entries,
  };
}

function compareEntries(a: LedgerEntry, b: LedgerEntry): number {
  if (a.batch !== b.batch) return a.batch - b.batch;
  if (a.seedFile !== b.seedFile) return a.seedFile < b.seedFile ? -1 : 1;
  return a.seedLine - b.seedLine;
}

/** 台帳に足す。すでにある (name, prefecture) か idx が来たら止める（上書きしない） */
export function mergeEntries(ledger: Ledger, entries: LedgerEntry[]): Ledger {
  const names = new Set(ledger.entries.map(e => `${e.name}\u0000${e.prefecture}`));
  const idxs = new Set(ledger.entries.map(e => e.idx));
  for (const e of entries) {
    if (names.has(`${e.name}\u0000${e.prefecture}`)) {
      throw new Error(`${where(e)}: 台帳にもうある（名前と都道府県）。上書きしない`);
    }
    if (idxs.has(e.idx))
      throw new Error(`${where(e)}: 台帳にもうある（idx ${e.idx}）。上書きしない`);
  }
  const merged = parseLedger({ ...ledger, entries: [...ledger.entries, ...entries] });
  return { ...merged, entries: [...merged.entries].sort(compareEntries) };
}

export function serializeLedger(ledger: Ledger): string {
  const sorted = { ...ledger, entries: [...ledger.entries].sort(compareEntries) };
  return JSON.stringify(sorted, null, 2) + '\n';
}

// --- D-2・D-3: migration ---

export interface MigrationOptions {
  batch: number;
  direction: 'apply' | 'revert';
  /** 先頭のコメントの generate のコマンドに書く版（apply のとき） */
  version?: string;
}

/** 台帳の1件 → jsonb の1行。旧は最短の表し方、新は小数6桁（どちらも seed の文字と同じ double になる） */
function fixRow(name: string, prefecture: string, from: string[], to: string[]): string {
  return (
    `{"name":${JSON.stringify(name)},"prefecture":${JSON.stringify(prefecture)},` +
    `"old_lat":${from[0]},"old_lng":${from[1]},"new_lat":${to[0]},"new_lng":${to[1]}}`
  );
}

function jsonbRows(entries: LedgerEntry[], direction: 'apply' | 'revert'): string {
  return entries
    .map(e => {
      const oldText = [String(e.old.lat), String(e.old.lng)];
      const newText = [coordText(e.new.lat), coordText(e.new.lng)];
      return direction === 'apply'
        ? fixRow(e.name, e.prefecture, oldText, newText)
        : fixRow(e.name, e.prefecture, newText, oldText);
    })
    .join(',\n');
}

const RECORD_COLUMNS =
  'x(name text, prefecture text, old_lat float8, old_lng float8, new_lat float8, new_lng float8)';

const SAME_SPOT =
  's.name = f.name AND s.prefecture = f.prefecture AND s.created_by_user_id IS NULL';

export function buildMigrationSql(entries: LedgerEntry[], opts: MigrationOptions): string {
  if (entries.length === 0) throw new Error(`第${opts.batch}弾の行が台帳に無い`);
  const tag = `spot_coords_292 batch${opts.batch}${opts.direction === 'revert' ? ' revert' : ''}`;
  const head =
    opts.direction === 'apply'
      ? [
          `-- Issue #292 第${opts.batch}弾: 寺社のマスタ（created_by_user_id が NULL の spots）の座標を ${entries.length} 件直す。`,
          '-- 生成物。手で直さない。台帳 supabase/data/spot-coords-292.json から次で作る:',
          `--   deno run -A supabase/scripts/spot-coords/main.ts generate --batch ${opts.batch} --version ${opts.version}`,
        ]
      : [
          `-- Issue #292 第${opts.batch}弾を戻す: 寺社のマスタ（created_by_user_id が NULL の spots）の座標を ${entries.length} 件、直す前の値に戻す。`,
          '-- 生成物。コミットしない。台帳 supabase/data/spot-coords-292.json から次で作る:',
          `--   deno run -A supabase/scripts/spot-coords/main.ts revert --batch ${opts.batch}`,
        ];
  return `${head.join('\n')}
-- 1件ずつ「名前・都道府県・作成者なし」でちょうど1行に絞り、座標で分ける。
-- 全件が旧座標なら全件を直す / 全件が新座標なら何もしない（2回目）/ それ以外は例外で全体を止める。
-- マスタの寺社が1件も無い DB（seed を入れる前）では何もしない。
DO $spot_coords_292$
DECLARE
  fixes CONSTANT jsonb := $fixes$[
${jsonbRows(entries, opts.direction)}
]$fixes$;
  eps CONSTANT float8 := ${EPS.toExponential()};
  expected CONSTANT int := ${entries.length};
  f record;
  n int;
  n_old int;
  n_new int;
  at_old int := 0;
  at_new int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.spots WHERE created_by_user_id IS NULL) THEN
    RAISE NOTICE '${tag}: マスタの寺社が無いので何もしない';
    RETURN;
  END IF;

  FOR f IN SELECT * FROM jsonb_to_recordset(fixes) AS ${RECORD_COLUMNS}
  LOOP
    SELECT count(*),
           count(*) FILTER (WHERE abs(s.lat - f.old_lat) < eps AND abs(s.lng - f.old_lng) < eps),
           count(*) FILTER (WHERE abs(s.lat - f.new_lat) < eps AND abs(s.lng - f.new_lng) < eps)
      INTO n, n_old, n_new
      FROM public.spots s
     WHERE ${SAME_SPOT};
    IF n <> 1 THEN
      RAISE EXCEPTION '${tag}: %（%）: 名前と都道府県で % 行（1 行のはず）', f.name, f.prefecture, n;
    END IF;
    IF n_old = 1 THEN
      at_old := at_old + 1;
    ELSIF n_new = 1 THEN
      at_new := at_new + 1;
    ELSE
      RAISE EXCEPTION '${tag}: %（%）: 旧座標でも新座標でもない', f.name, f.prefecture;
    END IF;
  END LOOP;

  IF at_new = expected THEN
    RAISE NOTICE '${tag}: もう直っている（% 件）。何もしない', at_new;
    RETURN;
  END IF;
  IF at_new > 0 THEN
    RAISE EXCEPTION '${tag}: 直っている % 件と直っていない % 件が混ざっている', at_new, at_old;
  END IF;

  FOR f IN SELECT * FROM jsonb_to_recordset(fixes) AS ${RECORD_COLUMNS}
  LOOP
    UPDATE public.spots s SET lat = f.new_lat, lng = f.new_lng
     WHERE ${SAME_SPOT}
       AND abs(s.lat - f.old_lat) < eps AND abs(s.lng - f.old_lng) < eps;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION '${tag}: %（%）: 変わったのが % 行（1 行のはず）', f.name, f.prefecture, n;
    END IF;
  END LOOP;
END
$spot_coords_292$;
`;
}

// --- D-13: 確かめる SQL ---

export const RESULT_KEYS = [
  'total',
  'listed',
  'rest',
  'at_new',
  'at_old',
  'neither',
  'not_one',
  'inactive',
] as const;
export type ResultValues = Record<(typeof RESULT_KEYS)[number], number>;

export function resultLine(v: ResultValues): string {
  return `RESULT ${RESULT_KEYS.map(k => `${k}=${v[k]}`).join(' ')}`;
}

/** RESULT の各値を SQL で出す式（rest は台帳に無いマスタの寺社 = total − 1行に絞れた台帳の件数） */
const RESULT_SQL: Record<(typeof RESULT_KEYS)[number], string> = {
  total: 'total',
  listed: 'listed',
  rest: 'total - matched',
  at_new: 'at_new',
  at_old: 'at_old',
  neither: 'neither',
  not_one: 'not_one',
  inactive: 'inactive',
};

export function buildCheckSql(ledger: Ledger, seedRowCount: number): string {
  const entries = [...ledger.entries].sort(compareEntries);
  const listed = entries.length;
  const batches = [...new Set(entries.map(e => e.batch))].sort((a, b) => a - b);
  const countUpTo = (pred: (b: number) => boolean) => entries.filter(e => pred(e.batch)).length;
  const expect = (atNew: number): string =>
    resultLine({
      total: seedRowCount,
      listed,
      rest: seedRowCount - listed,
      at_new: atNew,
      at_old: listed - atNew,
      neither: 0,
      not_one: 0,
      inactive: 0,
    });
  const expectLines = batches.flatMap(b => [
    `--   第${b}弾の前（H-1）: ${expect(countUpTo(x => x < b))}`,
    `--   第${b}弾の後（H-3）: ${expect(countUpTo(x => x <= b))}`,
  ]);
  const format = RESULT_KEYS.map(k => `${k}=%`).join(' ');
  const args = RESULT_KEYS.map(k => RESULT_SQL[k]).join(', ');
  return `-- ============================================================
-- 寺社のマスタの座標の直し: 本番の座標が台帳と合うか（Issue #292 / H-1・H-3）
--
-- 実行: supabase db query --linked -f supabase/validation/spot_coords_292_check.sql
--
-- ⚠ 必ずエラーで終わる。それで正しい。最後に RAISE EXCEPTION して、何も残さない（読むだけ）。
--   期待値（弾ごとに、直す前と後）:
${expectLines.join('\n')}
--
-- total    = 作成者なし（created_by_user_id IS NULL）の行の数（期待値は seed の寺社の行の数）
-- listed   = 台帳の件数（全部の弾）
-- rest     = total − 1行に絞れた台帳の件数（台帳に無いマスタの寺社）
-- at_new   = 1行に絞れて、新座標にある件数（直した件数）
-- at_old   = 1行に絞れて、旧座標にある件数（まだ直っていない件数）
-- neither  = 1行に絞れたが、旧でも新でもない件数
-- not_one  = 名前・都道府県・作成者なしで 0 行か 2 行以上だった件数
-- inactive = 1行に絞れて、status が active でない件数
--
-- 生成物。手で直さない。台帳 supabase/data/spot-coords-292.json から
-- supabase/scripts/spot-coords/main.ts generate で作る（どの弾の generate でも同じものができる）
-- ============================================================

DO $spot_coords_292_check$
DECLARE
  entries CONSTANT jsonb := $entries$[
${jsonbRows(entries, 'apply')}
]$entries$;
  eps CONSTANT float8 := ${EPS.toExponential()};
  f record;
  n int;
  n_old int;
  n_new int;
  n_inactive int;
  total int;
  listed int := 0;
  matched int := 0;
  at_new int := 0;
  at_old int := 0;
  neither int := 0;
  not_one int := 0;
  inactive int := 0;
BEGIN
  SELECT count(*) INTO total FROM public.spots WHERE created_by_user_id IS NULL;

  FOR f IN SELECT * FROM jsonb_to_recordset(entries) AS ${RECORD_COLUMNS}
  LOOP
    listed := listed + 1;
    SELECT count(*),
           count(*) FILTER (WHERE abs(s.lat - f.old_lat) < eps AND abs(s.lng - f.old_lng) < eps),
           count(*) FILTER (WHERE abs(s.lat - f.new_lat) < eps AND abs(s.lng - f.new_lng) < eps),
           count(*) FILTER (WHERE s.status <> 'active')
      INTO n, n_old, n_new, n_inactive
      FROM public.spots s
     WHERE ${SAME_SPOT};
    IF n <> 1 THEN
      not_one := not_one + 1;
      CONTINUE;
    END IF;
    matched := matched + 1;
    IF n_old = 1 THEN
      at_old := at_old + 1;
    ELSIF n_new = 1 THEN
      at_new := at_new + 1;
    ELSE
      neither := neither + 1;
    END IF;
    IF n_inactive = 1 THEN
      inactive := inactive + 1;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'RESULT ${format}',
    ${args};
END
$spot_coords_292_check$;
`;
}

// --- D-8: seed の書き換え ---

interface Token {
  text: string;
  start: number;
  end: number;
  /** 文字列の値（'…' のとき。'' は ' に戻す） */
  str: string | null;
}

/** `('名前', 数, 数, …)` の行を値に分ける。寺社の行でなければ null */
function tokenizeRow(line: string): Token[] | null {
  if (!line.startsWith('(')) return null;
  const tokens: Token[] = [];
  let i = 1;
  while (i < line.length) {
    while (line[i] === ' ') i++;
    const start = i;
    if (line[i] === "'") {
      let s = '';
      i++;
      for (;;) {
        if (i >= line.length) return null;
        if (line[i] === "'") {
          if (line[i + 1] === "'") {
            s += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        s += line[i++];
      }
      tokens.push({ text: line.slice(start, i), start, end: i, str: s });
    } else {
      while (i < line.length && line[i] !== ',' && line[i] !== ')') i++;
      const text = line.slice(start, i).trimEnd();
      tokens.push({ text, start, end: start + text.length, str: null });
    }
    while (line[i] === ' ') i++;
    if (line[i] === ',') {
      i++;
      continue;
    }
    if (line[i] === ')') return tokens;
    return null;
  }
  return null;
}

const NUMBER = /^-?\d+(\.\d+)?$/;
const SEED_ROW = /^\('(?:[^']|'')*',\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?,/;
const COMMENT_MARK = ' | 座標: ';

/** 寺社の行（`('名前', 数, 数,` で始まる行）を数える */
export function countSeedRows(text: string): number {
  return text.split('\n').filter(l => SEED_ROW.test(l)).length;
}

function sourceText(e: LedgerEntry): string {
  const ref = e.ref ? ` ${e.ref}` : '';
  if (e.source === 'wikidata') return `座標: Wikidata${ref}（#292 で直した）`;
  if (e.source === 'osm') {
    return `座標: OpenStreetMap${ref}（© OpenStreetMap contributors, ODbL・#292 で直した）`;
  }
  return '座標: オーナーが地図で決めた（#292 で直した）';
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < SEED_EPS;
}

/**
 * 台帳の行のうち path のものを seed に当てる。座標の数2つと、すぐ次の行のコメントの「座標: 」から行末だけを替える。
 * すでに新座標の行は何もしない（already に数える）。行数は変えない
 */
export function rewriteSeed(
  text: string,
  path: string,
  entries: LedgerEntry[]
): { text: string; changed: number; already: number } {
  const lines = text.split('\n');
  let changed = 0;
  let already = 0;
  for (const e of entries.filter(x => x.seedFile === path)) {
    const who = `${path}:${e.seedLine} ${e.name}`;
    const i = e.seedLine - 1;
    const line = lines[i];
    if (line === undefined) throw new Error(`${who}: その行が無い`);
    const t = tokenizeRow(line);
    if (!t || t.length < 6 || !NUMBER.test(t[1].text) || !NUMBER.test(t[2].text)) {
      throw new Error(`${who}: 寺社の行ではない: ${line}`);
    }
    if (t[0].str !== e.name || t[5].str !== e.prefecture) {
      throw new Error(
        `${who}（${e.prefecture}）: 行の名前・都道府県が台帳と違う: ${t[0].text}, ${t[5].text}`
      );
    }
    const lat = Number(t[1].text);
    const lng = Number(t[2].text);
    if (near(lat, e.new.lat) && near(lng, e.new.lng)) {
      already++;
      continue;
    }
    if (!near(lat, e.old.lat) || !near(lng, e.old.lng)) {
      throw new Error(`${who}（${e.prefecture}）: 座標 ${lat}, ${lng} が台帳の旧でも新でもない`);
    }
    lines[i] =
      line.slice(0, t[1].start) +
      coordText(e.new.lat) +
      line.slice(t[1].end, t[2].start) +
      coordText(e.new.lng) +
      line.slice(t[2].end);
    const next = lines[i + 1];
    if (next !== undefined && next.startsWith('--') && next.includes(COMMENT_MARK)) {
      const at = next.indexOf(COMMENT_MARK) + ' | '.length;
      lines[i + 1] = next.slice(0, at) + sourceText(e);
    }
    changed++;
  }
  return { text: lines.join('\n'), changed, already };
}
