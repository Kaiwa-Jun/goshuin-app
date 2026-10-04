// 帯の写真の第2弾（Issue #320）。対象・手で Wikidata に結ぶ規則・候補の規則を決める純関数（ネット・ファイルに出ない）。
// ネットは gather.ts、CLI は main.ts。第1弾の規則（screenFile など）は select.ts のまま使う。
// 契約書: docs/issues/issue-320-spot-photos-batch2.md（D-1・D-3〜D-7）
import { distanceMeters } from '../spot-coords/coords.ts';
import {
  linkNames,
  type Mapping,
  type MappingEntry,
  nameMatch,
  type SeedRow,
  type WdItem,
} from '../spot-wikidata/match.ts';
import { label } from './select.ts';

// --- 定数（値を変えるのはリーダーの判断。契約書の表とテストと README を一緒に直す） ---

/** D-1 対象の rank */
export const TARGET_RANK = 5;
/** D-3 ② 手で結ぶ項目の P625 と seed の距離の上限（m） */
export const MANUAL_MAX_DISTANCE_M = 3000;
/** D-5 ⑤ 1 寺社の候補のファイルの上限 */
export const POOL_MAX_FILES = 30;
/** D-4 一覧（categorymembers・search）を1回で聞く数（1 回だけ） */
export const LIST_LIMIT = 500;
/** D-7 選ぶ画面の一覧の小さな写真の幅 */
export const GRID_THUMB_WIDTH = 250;
/** D-2 作業フォルダの中の第2弾の置き場所 */
export const BATCH2_DIR = 'b2';

export const MANUAL_PATH = 'supabase/data/spot-wikidata-manual-320.json';
export const POOL_PATH = 'supabase/data/spot-photos-320.json';

export const MANUAL_NOTE =
  '#301 の対応表で結べなかった（none / low）rank 5 の寺社を、リーダーが Wikidata の項目と確かめて結んだもの。supabase/scripts/spot-photos/main.ts manual-link で作る。手で直さない';
export const MANUAL_ATTRIBUTION = { wikidata: 'Wikidata（CC0 1.0）https://www.wikidata.org/' };

// --- 型 ---

export interface ManualEntry320 {
  idx: number;
  name: string;
  prefecture: string;
  qid: string;
  /** 項目の日本語のラベル（無ければ null） */
  label: string | null;
  /** いちばん強く合ったラベルか別名 */
  matchedName: string;
  nameLevel: 'exact' | 'partial';
  p625: { lat: number; lng: number };
  /** seed から P625 までの距離（km・小数1桁） */
  distanceKm: number;
  p18: string[];
  p373: string | null;
  basis: string;
}

export interface Manual320 {
  schemaVersion: 1;
  issue: 320;
  note: string;
  attribution: { wikidata: string };
  entries: ManualEntry320[];
}

/** manualLinkOf の答え（結べないときは理由） */
export type ManualLink = { ok: true; entry: ManualEntry320 } | { ok: false; reason: string };

/** 手で結ぶ規則に要る、対象と対応表 */
export interface ManualCtx {
  targets: readonly SeedRow[];
  mapping: Mapping;
}

// --- 小さな道具 ---

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown, min: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min;
}

function exactKeys(o: Record<string, unknown>, keys: readonly string[], who: string): void {
  const extra = Object.keys(o).filter(k => !keys.includes(k));
  if (extra.length > 0) throw new Error(`${who}: 知らないキー ${extra.join(', ')}`);
  const missing = keys.filter(k => !(k in o));
  if (missing.length > 0) throw new Error(`${who}: キーが無い ${missing.join(', ')}`);
}

const QID = /^Q\d+$/;

function isLinked(m: MappingEntry | undefined): boolean {
  return m?.confidence === 'high' || m?.confidence === 'medium';
}

/** km（小数1桁） */
function kmOf(meters: number): number {
  return Math.round(meters / 100) / 10;
}

// --- D-1: 対象 ---

/**
 * rank 5 で、台帳に第1弾（batch: 1）の行が無い寺社（idx の順）。第1弾の行だけを見るので、
 * 第2弾の行を足したあとも変わらない
 */
export function targets320(
  seedRows: readonly SeedRow[],
  ledger: { entries: readonly { batch: number; idx: number }[] }
): SeedRow[] {
  const batch1 = new Set(ledger.entries.filter(e => e.batch === 1).map(e => e.idx));
  return seedRows
    .filter(r => r.rank === TARGET_RANK && !batch1.has(r.idx))
    .sort((a, b) => a.idx - b.idx);
}

// --- D-3: 手で結ぶ規則 ---

/** D-3 の決まった形の文（ラベルで合ったか別名で合ったかは matchedName がラベルと同じかで決まる） */
export function basisText(
  e: Pick<ManualEntry320, 'label' | 'matchedName' | 'nameLevel' | 'distanceKm'>
): string {
  const by = e.matchedName === e.label ? 'ラベル' : '別名';
  const how = e.nameLevel === 'exact' ? '同じ' : '一部が同じ';
  return `${by}「${e.matchedName}」が seed の名前と${how}。P625 は seed から ${e.distanceKm.toFixed(1)} km`;
}

/** seed の名前（linkNames）と1つの名前のいちばん強い一致 */
function levelOf(seedName: string, name: string): 'exact' | 'partial' | 'none' {
  let best: 'exact' | 'partial' | 'none' = 'none';
  for (const n of linkNames(seedName)) {
    const l = nameMatch(n, name);
    if (l === 'exact') return 'exact';
    if (l === 'partial') best = 'partial';
  }
  return best;
}

/** ラベル → 別名（項目の順）で、いちばん強く合った最初の名前 */
function bestName(
  seedName: string,
  item: WdItem
): { matchedName: string; nameLevel: 'exact' | 'partial' } | null {
  const names = [...(item.label === null ? [] : [item.label]), ...item.aliases];
  let partial: string | null = null;
  for (const n of names) {
    const l = levelOf(seedName, n);
    if (l === 'exact') return { matchedName: n, nameLevel: 'exact' };
    if (l === 'partial' && partial === null) partial = n;
  }
  return partial === null ? null : { matchedName: partial, nameLevel: 'partial' };
}

/**
 * seed の1寺社と Wikidata の1項目を、D-3 の規則で結ぶ。① P625 がある ② seed から 3km 以内
 * ③ 名前が exact か partial で合う ④ 対応表で high / medium の行の項目でない。
 * 規則を通る項目が2つ以上あるとき、どれを採るかは人が決める（ここは「通らなければ結ばない」ため）
 */
export function manualLinkOf(row: SeedRow, item: WdItem | null, ctx: ManualCtx): ManualLink {
  const fail = (reason: string): ManualLink => ({ ok: false, reason });
  if (!ctx.targets.some(t => t.idx === row.idx)) return fail('対象でない');
  const m = ctx.mapping.entries.find(x => x.idx === row.idx);
  if (isLinked(m)) return fail('対応表で結べている（high / medium）');
  if (item === null) return fail('Wikidata に項目が無い');
  if (item.p625 === null) return fail('P625 が無い');
  const meters = distanceMeters({ lat: row.lat, lng: row.lng }, item.p625);
  if (meters > MANUAL_MAX_DISTANCE_M) {
    return fail(`seed から ${kmOf(meters).toFixed(1)} km（3 km を超える）`);
  }
  const name = bestName(row.name, item);
  if (name === null) return fail('名前が合わない');
  const other = ctx.mapping.entries.find(x => x.qid === item.qid && isLinked(x));
  if (other) return fail(`${label(other)} の対応表の項目と同じ`);
  const entry: ManualEntry320 = {
    idx: row.idx,
    name: row.name,
    prefecture: row.prefecture,
    qid: item.qid,
    label: item.label,
    matchedName: name.matchedName,
    nameLevel: name.nameLevel,
    p625: { lat: item.p625.lat, lng: item.p625.lng },
    distanceKm: kmOf(meters),
    p18: [...item.p18],
    p373: item.p373,
    basis: '',
  };
  entry.basis = basisText(entry);
  return { ok: true, entry };
}

/** 結んだ行（idx の順に並べ直す）→ 手で結ぶ台帳 */
export function manual320Of(entries: ManualEntry320[]): Manual320 {
  return {
    schemaVersion: 1,
    issue: 320,
    note: MANUAL_NOTE,
    attribution: { ...MANUAL_ATTRIBUTION },
    entries: [...entries].sort((a, b) => a.idx - b.idx),
  };
}

// --- D-3: 手で結ぶ台帳の検査 ---

const MANUAL_TOP_KEYS = ['schemaVersion', 'issue', 'note', 'attribution', 'entries'] as const;
export const MANUAL_KEYS = [
  'idx',
  'name',
  'prefecture',
  'qid',
  'label',
  'matchedName',
  'nameLevel',
  'p625',
  'distanceKm',
  'p18',
  'p373',
  'basis',
] as const;

function parseManualEntry(
  raw: unknown,
  i: number,
  seed: Map<number, SeedRow>,
  targetIdx: Set<number>,
  mapping: Mapping
): ManualEntry320 {
  if (!isObject(raw)) throw new Error(`entries[${i}] がオブジェクトでない`);
  if (typeof raw.name !== 'string' || typeof raw.prefecture !== 'string') {
    throw new Error(`entries[${i}]: name / prefecture が文字でない`);
  }
  const who = label({ name: raw.name, prefecture: raw.prefecture });
  exactKeys(raw, MANUAL_KEYS, who);
  const e = raw as unknown as ManualEntry320;
  if (!isInt(e.idx, 1)) throw new Error(`${who}: idx が 1 以上の整数でない`);
  const row = seed.get(e.idx);
  if (!row || row.name !== e.name || row.prefecture !== e.prefecture) {
    throw new Error(`${who}: seed の idx ${e.idx} は ${row ? label(row) : '無い'}`);
  }
  if (!targetIdx.has(e.idx))
    throw new Error(`${who}: 対象でない（rank 5 で第1弾の行の無い寺社だけ）`);
  const m = mapping.entries.find(x => x.idx === e.idx);
  if (isLinked(m)) throw new Error(`${who}: 対応表で結べている（high / medium）`);
  if (typeof e.qid !== 'string' || !QID.test(e.qid)) throw new Error(`${who}: qid の形が違う`);
  const other = mapping.entries.find(x => x.qid === e.qid && isLinked(x));
  if (other) throw new Error(`${who}: ${e.qid} は ${label(other)} の対応表の項目と同じ`);
  if (e.label !== null && (typeof e.label !== 'string' || e.label === '')) {
    throw new Error(`${who}: label が文字か null でない`);
  }
  if (typeof e.matchedName !== 'string' || e.matchedName === '') {
    throw new Error(`${who}: matchedName が無い`);
  }
  if (e.nameLevel !== 'exact' && e.nameLevel !== 'partial') {
    throw new Error(`${who}: nameLevel が exact / partial でない`);
  }
  const level = levelOf(e.name, e.matchedName);
  if (level === 'none')
    throw new Error(`${who}: matchedName「${e.matchedName}」が seed の名前と合わない`);
  if (level !== e.nameLevel) {
    throw new Error(`${who}: nameLevel が ${e.nameLevel} だが、名前を比べ直すと ${level}`);
  }
  if (!isObject(e.p625) || typeof e.p625.lat !== 'number' || typeof e.p625.lng !== 'number') {
    throw new Error(`${who}: p625 が { lat, lng } でない`);
  }
  exactKeys(e.p625 as unknown as Record<string, unknown>, ['lat', 'lng'], `${who}: p625`);
  const meters = distanceMeters({ lat: row.lat, lng: row.lng }, e.p625);
  if (meters > MANUAL_MAX_DISTANCE_M) {
    throw new Error(`${who}: p625 が seed から ${kmOf(meters).toFixed(1)} km（3 km を超える）`);
  }
  if (e.distanceKm !== kmOf(meters)) {
    throw new Error(
      `${who}: distanceKm ${String(e.distanceKm)} が計算し直した ${kmOf(meters)} と違う`
    );
  }
  if (!Array.isArray(e.p18) || e.p18.some(f => typeof f !== 'string' || f === '')) {
    throw new Error(`${who}: p18 がファイル名の配列でない`);
  }
  if (e.p373 !== null && (typeof e.p373 !== 'string' || e.p373 === '')) {
    throw new Error(`${who}: p373 が文字か null でない`);
  }
  if (typeof e.basis !== 'string' || /http|@/.test(e.basis)) {
    throw new Error(`${who}: basis に http か @ がある`);
  }
  if (e.basis !== basisText(e)) {
    throw new Error(`${who}: basis が決まった形の文でない（「${basisText(e)}」のはず）`);
  }
  return Object.fromEntries(MANUAL_KEYS.map(k => [k, e[k]])) as unknown as ManualEntry320;
}

/**
 * 手で結ぶ台帳の検査（JSON の文字でも、読んだ値でもよい）。決めたキーのほか・idx の順でない / 重なる・
 * seed と合わない・対象でない・対応表で結べている・ほかの寺社の項目・距離・名前・basis のどれでも、
 * 寺社の名前を含む文で止める。手で結んだ行どうしの同じ Q-ID は許す
 */
export function parseManual320(
  json: unknown,
  rows: readonly SeedRow[],
  mapping: Mapping,
  targets: readonly SeedRow[]
): Manual320 {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isObject(raw)) throw new Error('手で結ぶ台帳がオブジェクトでない');
  exactKeys(raw, MANUAL_TOP_KEYS, '手で結ぶ台帳');
  if (raw.schemaVersion !== 1) throw new Error('手で結ぶ台帳: schemaVersion が 1 でない');
  if (raw.issue !== 320) throw new Error('手で結ぶ台帳: issue が 320 でない');
  if (typeof raw.note !== 'string' || raw.note === '') throw new Error('手で結ぶ台帳: note が無い');
  if (!isObject(raw.attribution) || typeof raw.attribution.wikidata !== 'string') {
    throw new Error('手で結ぶ台帳: attribution.wikidata が無い');
  }
  exactKeys(raw.attribution, ['wikidata'], '手で結ぶ台帳: attribution');
  if (!Array.isArray(raw.entries)) throw new Error('手で結ぶ台帳: entries が配列でない');

  const seed = new Map(rows.map(r => [r.idx, r]));
  const targetIdx = new Set(targets.map(t => t.idx));
  const entries: ManualEntry320[] = [];
  for (const [i, x] of raw.entries.entries()) {
    const e = parseManualEntry(x, i, seed, targetIdx, mapping);
    const last = entries.at(-1);
    if (last && e.idx === last.idx) throw new Error(`${label(e)}: idx ${e.idx} が2行ある`);
    if (last && e.idx < last.idx)
      throw new Error(`${label(e)}: idx の順でない（前は ${label(last)}）`);
    entries.push(e);
  }
  return {
    schemaVersion: 1,
    issue: 320,
    note: raw.note,
    attribution: { wikidata: raw.attribution.wikidata },
    entries,
  };
}
