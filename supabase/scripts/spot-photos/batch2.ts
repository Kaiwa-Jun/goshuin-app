// 帯の写真の第2弾（Issue #320）。対象・手で Wikidata に結ぶ規則・候補の規則を決める純関数（ネット・ファイルに出ない）。
// ネットは gather.ts、CLI は main.ts。第1弾の規則（screenFile など）は select.ts のまま使う。
// 契約書: docs/issues/issue-320-spot-photos-batch2.md（D-1・D-3〜D-7）
import { distanceMeters } from '../spot-coords/coords.ts';
import {
  linkNames,
  type Mapping,
  type MappingEntry,
  nameMatch,
  type PhotoFile,
  type Photos,
  type SeedRow,
  type WdItem,
} from '../spot-wikidata/match.ts';
import { label, screenFile } from './select.ts';

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
export const POOL_NOTE =
  '帯の写真の第2弾の候補。rank 5 で第1弾の台帳に無い寺社の全部と、Commons のカテゴリ（P373 の直下）・P180・P18（手で結んだ寺社）から集めて規則で絞ったファイル。supabase/scripts/spot-photos/main.ts pool で作る。手で直さない';
export const POOL_ATTRIBUTION = {
  commons: 'Wikimedia Commons。ライセンスはファイルごと（license・licenseUrl）',
};

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

// --- D-4: 集める出どころ ---

/** 寺社の結びつき（第2弾。manual は手で結ぶ台帳の行） */
export type LinkConfidence320 = 'high' | 'medium' | 'manual';
/** ファイルの出どころ（並べる順） */
export const SOURCES = ['p18', 'p373', 'p180'] as const;
export type Source320 = (typeof SOURCES)[number];
/** 1回の一覧に収まらなかった出どころ */
export type ListSource = 'p373' | 'p180';

/** 対象の1寺社と、集める出どころ（Q-ID の無い寺社は qid が null） */
export interface Spot320 {
  idx: number;
  name: string;
  prefecture: string;
  qid: string | null;
  linkConfidence: LinkConfidence320 | null;
  /** 対応表か手で結ぶ台帳のラベル */
  label: string | null;
  /** 手で結んだ寺社の basis（ほかは null） */
  basis: string | null;
  p373: string | null;
  /** 出どころにする P18（手で結んだ寺社だけ。high / medium の P18 は第1弾で見たので []） */
  p18: string[];
}

/** 対象ごとに、対応表（high / medium）か手で結ぶ台帳から、集める出どころを決める（idx の順） */
export function spots320(
  targets: readonly SeedRow[],
  mapping: Mapping,
  manual: Manual320
): Spot320[] {
  const byIdx = new Map(mapping.entries.map(m => [m.idx, m]));
  const manualByIdx = new Map(manual.entries.map(m => [m.idx, m]));
  return [...targets]
    .sort((a, b) => a.idx - b.idx)
    .map(t => {
      const base = { idx: t.idx, name: t.name, prefecture: t.prefecture };
      const me = manualByIdx.get(t.idx);
      if (me) {
        return {
          ...base,
          qid: me.qid,
          linkConfidence: 'manual',
          label: me.label,
          basis: me.basis,
          p373: me.p373,
          p18: [...me.p18],
        };
      }
      const m = byIdx.get(t.idx);
      if (m && isLinked(m) && m.qid !== null) {
        return {
          ...base,
          qid: m.qid,
          linkConfidence: m.confidence as 'high' | 'medium',
          label: m.label,
          basis: null,
          p373: m.p373,
          p18: [],
        };
      }
      return {
        ...base,
        qid: null,
        linkConfidence: null,
        label: null,
        basis: null,
        p373: null,
        p18: [],
      };
    });
}

/** 1寺社の集めた値（作業フォルダの b2/gather/<idx>.json。連絡先・時刻は入れない） */
export interface Gathered320 {
  idx: number;
  name: string;
  prefecture: string;
  /** 集めたときの Q-ID・P373・P18（いまの対応表・手で結ぶ台帳と違えば集め直す） */
  qid: string;
  p373: string | null;
  p18: string[];
  /** 一覧で出た名前（P373 の直下・P180 = Q-ID） */
  lists: { p373: string[]; p180: string[] };
  truncated: ListSource[];
  /** imageinfo を #301 の parseImageInfo で読んだ値（聞いた順） */
  files: PhotoFile[];
  /** Commons に無かった名前 */
  missing: string[];
}

const GATHERED_KEYS = [
  'idx',
  'name',
  'prefecture',
  'qid',
  'p373',
  'p18',
  'lists',
  'truncated',
  'files',
  'missing',
] as const;

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(x => typeof x === 'string');

/** 集めた値の形を確かめる（作業フォルダのファイル。だめなら寺社の名前で止める） */
export function parseGathered320(json: unknown): Gathered320 {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isObject(raw) || typeof raw.name !== 'string' || typeof raw.prefecture !== 'string') {
    throw new Error('集めた値に name / prefecture が無い');
  }
  const who = label({ name: raw.name, prefecture: raw.prefecture });
  exactKeys(raw, GATHERED_KEYS, `${who}: 集めた値`);
  const g = raw as unknown as Gathered320;
  if (!isInt(g.idx, 1)) throw new Error(`${who}: 集めた値の idx が 1 以上の整数でない`);
  if (typeof g.qid !== 'string' || !QID.test(g.qid))
    throw new Error(`${who}: 集めた値の qid の形が違う`);
  if (g.p373 !== null && typeof g.p373 !== 'string')
    throw new Error(`${who}: 集めた値の p373 が文字か null でない`);
  if (!isStrings(g.p18) || !isStrings(g.missing))
    throw new Error(`${who}: 集めた値の p18 / missing が文字の配列でない`);
  if (!isObject(g.lists) || !isStrings(g.lists.p373) || !isStrings(g.lists.p180)) {
    throw new Error(`${who}: 集めた値の lists が { p373, p180 } でない`);
  }
  if (!Array.isArray(g.truncated) || g.truncated.some(t => t !== 'p373' && t !== 'p180')) {
    throw new Error(`${who}: 集めた値の truncated が p373 / p180 でない`);
  }
  if (!Array.isArray(g.files) || g.files.some(f => !isObject(f) || typeof f.file !== 'string')) {
    throw new Error(`${who}: 集めた値の files がファイルの配列でない`);
  }
  return g;
}

// --- D-5・D-6: 候補 ---

/** 候補の1ファイル（PhotoFile のうち決めた値と出どころ。HTML・クレジットは持たない） */
export interface PoolFile320 {
  file: string;
  sources: Source320[];
  width: number;
  height: number;
  mime: string;
  sha1: string;
  url: string;
  descriptionUrl: string;
  license: string | null;
  licenseUrl: string | null;
  artist: string | null;
  attributionRequired: boolean | null;
  restrictions: string;
}

export type Gap320 = 'no-qid' | 'no-files';

export interface PoolEntry320 {
  idx: number;
  name: string;
  prefecture: string;
  qid: string | null;
  linkConfidence: LinkConfidence320 | null;
  p373: string | null;
  gap: Gap320 | null;
  truncated: ListSource[];
  files: PoolFile320[];
}

export interface PoolCounts320 {
  targets: number;
  withFiles: number;
  noQid: number;
  noFiles: number;
  manual: number;
  files: number;
  truncated: number;
}

export interface Pool320 {
  schemaVersion: 1;
  issue: 320;
  note: string;
  attribution: { commons: string };
  counts: PoolCounts320;
  entries: PoolEntry320[];
}

/** 候補を作るときに見る、台帳（第1弾の行の sha1）と #301 の写真の候補 */
export interface PoolSources {
  ledger: { entries: readonly { batch: number; sha1: string }[] };
  photos301: Photos;
}

/** 候補の検査に要るもの */
export interface PoolCtx extends PoolSources {
  rows: readonly SeedRow[];
  mapping: Mapping;
  manual: Manual320;
  targets: readonly SeedRow[];
}

const POOL_FILE_KEYS = [
  'file',
  'sources',
  'width',
  'height',
  'mime',
  'sha1',
  'url',
  'descriptionUrl',
  'license',
  'licenseUrl',
  'artist',
  'attributionRequired',
  'restrictions',
] as const;

/** D-5 ②③ で外すファイル: 台帳の第1弾の行の sha1、その寺社の第1弾の候補（#301 で screenFile を通るもの） */
function excluded(
  ctx: PoolSources
): (idx: number, f: { file: string; sha1: string }) => string | null {
  const batch1 = new Set(ctx.ledger.entries.filter(e => e.batch === 1).map(e => e.sha1));
  const first = new Map(
    ctx.photos301.entries.map(e => [e.idx, e.files.filter(f => screenFile(f))])
  );
  return (idx, f) => {
    if (batch1.has(f.sha1)) return '台帳の第1弾の行と同じファイル';
    const seen = first.get(idx) ?? [];
    if (seen.some(x => x.file === f.file || x.sha1 === f.sha1)) {
      return 'この寺社の第1弾の候補だったファイル';
    }
    return null;
  };
}

/** D-5 ⑤ width × height の大きい順、同じならファイル名の昇順 */
function byArea(a: { file: string; width: number; height: number }, b: typeof a): number {
  const d = b.width * b.height - a.width * a.height;
  if (d !== 0) return d;
  return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
}

function countsOf(entries: readonly PoolEntry320[]): PoolCounts320 {
  return {
    targets: entries.length,
    withFiles: entries.filter(e => e.gap === null).length,
    noQid: entries.filter(e => e.gap === 'no-qid').length,
    noFiles: entries.filter(e => e.gap === 'no-files').length,
    manual: entries.filter(e => e.linkConfidence === 'manual').length,
    files: entries.reduce((n, e) => n + e.files.length, 0),
    truncated: entries.filter(e => e.truncated.length > 0).length,
  };
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * D-5: 寺社ごとに、集めたファイルを ① screenFile ② 台帳の第1弾の行の sha1 ③ その寺社の第1弾の候補 で絞り、
 * ④ 名前で1つにして出どころを p18 → p373 → p180 の順に持たせ、⑤ 大きい順に 30 まで。
 * Q-ID の無い寺社は no-qid、ファイルが 0 なら no-files。集めた値が無い・出どころが今と違う寺社は名前で止める
 */
export function buildPool320(
  spots: readonly Spot320[],
  gathered: ReadonlyMap<number, Gathered320>,
  ctx: PoolSources
): Pool320 {
  const skip = excluded(ctx);
  const entries: PoolEntry320[] = [...spots]
    .sort((a, b) => a.idx - b.idx)
    .map(s => {
      const base = { idx: s.idx, name: s.name, prefecture: s.prefecture };
      if (s.qid === null) {
        return {
          ...base,
          qid: null,
          linkConfidence: null,
          p373: null,
          gap: 'no-qid',
          truncated: [],
          files: [],
        };
      }
      const g = gathered.get(s.idx);
      if (!g)
        throw new Error(
          `${label(s)}: 集めた値（gather/${s.idx}.json）が無い（先に gather を打つ）`
        );
      if (g.qid !== s.qid || g.p373 !== s.p373 || !sameList(g.p18, s.p18)) {
        throw new Error(
          `${label(s)}: 集めた値の qid / p373 / p18 が、いまの対応表・手で結ぶ台帳と違う（gather をやり直す: gather/${s.idx}.json を消して打ち直す）`
        );
      }
      const from = {
        p18: new Set(s.p18),
        p373: new Set(g.lists.p373),
        p180: new Set(g.lists.p180),
      };
      const seen = new Set<string>();
      const files: PoolFile320[] = [];
      for (const f of g.files) {
        if (seen.has(f.file)) continue;
        seen.add(f.file);
        if (!screenFile(f) || skip(s.idx, f) !== null) continue;
        files.push({
          file: f.file,
          sources: SOURCES.filter(k => from[k].has(f.file)),
          width: f.width,
          height: f.height,
          mime: f.mime,
          sha1: f.sha1,
          url: f.url,
          descriptionUrl: f.descriptionUrl,
          license: f.license,
          licenseUrl: f.licenseUrl,
          artist: f.artist,
          attributionRequired: f.attributionRequired,
          restrictions: f.restrictions,
        });
      }
      const top = files.sort(byArea).slice(0, POOL_MAX_FILES);
      return {
        ...base,
        qid: s.qid,
        linkConfidence: s.linkConfidence,
        p373: s.p373,
        gap: top.length === 0 ? 'no-files' : null,
        truncated: (['p373', 'p180'] as const).filter(k => g.truncated.includes(k)),
        files: top,
      };
    });
  return {
    schemaVersion: 1,
    issue: 320,
    note: POOL_NOTE,
    attribution: { ...POOL_ATTRIBUTION },
    counts: countsOf(entries),
    entries,
  };
}

// --- D-6: 候補の検査 ---

const POOL_TOP_KEYS = [
  'schemaVersion',
  'issue',
  'note',
  'attribution',
  'counts',
  'entries',
] as const;
const POOL_ENTRY_KEYS = [
  'idx',
  'name',
  'prefecture',
  'qid',
  'linkConfidence',
  'p373',
  'gap',
  'truncated',
  'files',
] as const;
const COUNT_KEYS = [
  'targets',
  'withFiles',
  'noQid',
  'noFiles',
  'manual',
  'files',
  'truncated',
] as const;

function nullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

function parsePoolFile(raw: unknown, who: string): PoolFile320 {
  if (!isObject(raw)) throw new Error(`${who}: files の要素がオブジェクトでない`);
  exactKeys(raw, POOL_FILE_KEYS, `${who}: files`);
  const f = raw as unknown as PoolFile320;
  const at = `${who}: ${String(f.file)}`;
  if (typeof f.file !== 'string' || f.file === '' || f.file.startsWith('File:')) {
    throw new Error(`${who}: file がファイル名（File: を付けない）でない`);
  }
  if (
    !Array.isArray(f.sources) ||
    f.sources.length === 0 ||
    !sameList(
      f.sources,
      SOURCES.filter(k => f.sources.includes(k))
    )
  ) {
    throw new Error(`${at}: sources が p18 / p373 / p180 をこの順で重ねずに持たない`);
  }
  if (!isInt(f.width, 1) || !isInt(f.height, 1))
    throw new Error(`${at}: width / height が正の整数でない`);
  if (typeof f.mime !== 'string') throw new Error(`${at}: mime が無い`);
  if (typeof f.sha1 !== 'string' || !/^[0-9a-f]{40}$/.test(f.sha1))
    throw new Error(`${at}: sha1 の形が違う`);
  if (typeof f.url !== 'string' || !f.url.startsWith('https://upload.wikimedia.org/')) {
    throw new Error(`${at}: url が upload.wikimedia.org でない`);
  }
  if (
    typeof f.descriptionUrl !== 'string' ||
    !f.descriptionUrl.startsWith('https://commons.wikimedia.org/')
  ) {
    throw new Error(`${at}: descriptionUrl が commons.wikimedia.org でない`);
  }
  for (const k of ['license', 'licenseUrl', 'artist'] as const) {
    if (!nullableString(f[k])) throw new Error(`${at}: ${k} が文字か null でない`);
  }
  if (f.attributionRequired !== null && typeof f.attributionRequired !== 'boolean') {
    throw new Error(`${at}: attributionRequired が真偽か null でない`);
  }
  if (typeof f.restrictions !== 'string') throw new Error(`${at}: restrictions が文字でない`);
  if (!screenFile(f)) throw new Error(`${at}: 候補の規則（screenFile）を通らない`);
  return Object.fromEntries(POOL_FILE_KEYS.map(k => [k, f[k]])) as unknown as PoolFile320;
}

/**
 * 公開の候補（spot-photos-320.json）の検査（JSON の文字でも、読んだ値でもよい）。決めたキーのほか・対象でない idx・
 * 結びつきが対応表か手で結ぶ台帳と合わない・screenFile を通らない・外すはずのファイル・31 ファイル以上・
 * 並びが大きい順でない・gap と files が食い違う、のどれでも寺社の名前で止める。対象の全部がそろっているかは
 * checkPoolTargets が見る
 */
export function parsePool320(json: unknown, ctx: PoolCtx): Pool320 {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isObject(raw)) throw new Error('候補がオブジェクトでない');
  exactKeys(raw, POOL_TOP_KEYS, '候補');
  if (raw.schemaVersion !== 1) throw new Error('候補: schemaVersion が 1 でない');
  if (raw.issue !== 320) throw new Error('候補: issue が 320 でない');
  if (typeof raw.note !== 'string' || raw.note === '') throw new Error('候補: note が無い');
  if (!isObject(raw.attribution) || typeof raw.attribution.commons !== 'string') {
    throw new Error('候補: attribution.commons が無い');
  }
  exactKeys(raw.attribution, ['commons'], '候補: attribution');
  if (!isObject(raw.counts)) throw new Error('候補: counts が無い');
  exactKeys(raw.counts, COUNT_KEYS, '候補: counts');
  if (!Array.isArray(raw.entries)) throw new Error('候補: entries が配列でない');

  const rawEntries: unknown[] = raw.entries;
  const seed = new Map(ctx.rows.map(r => [r.idx, r]));
  const targetIdx = new Set(ctx.targets.map(t => t.idx));
  const listed = new Set(rawEntries.map(e => (isObject(e) ? e.idx : null)));
  const expected = new Map(
    spots320(
      ctx.targets.filter(t => listed.has(t.idx)),
      ctx.mapping,
      ctx.manual
    ).map(s => [s.idx, s])
  );
  const skip = excluded(ctx);
  const entries: PoolEntry320[] = [];
  for (const [i, x] of rawEntries.entries()) {
    if (!isObject(x)) throw new Error(`候補: entries[${i}] がオブジェクトでない`);
    if (typeof x.name !== 'string' || typeof x.prefecture !== 'string') {
      throw new Error(`候補: entries[${i}]: name / prefecture が文字でない`);
    }
    const who = label({ name: x.name, prefecture: x.prefecture });
    exactKeys(x, POOL_ENTRY_KEYS, who);
    const e = x as unknown as PoolEntry320;
    if (!isInt(e.idx, 1)) throw new Error(`${who}: idx が 1 以上の整数でない`);
    const row = seed.get(e.idx);
    if (!row || row.name !== e.name || row.prefecture !== e.prefecture) {
      throw new Error(`${who}: seed の idx ${e.idx} は ${row ? label(row) : '無い'}`);
    }
    const last = entries.at(-1);
    if (last && e.idx <= last.idx)
      throw new Error(`${who}: idx の順でないか重なる（前は ${label(last)}）`);
    if (!targetIdx.has(e.idx))
      throw new Error(`${who}: 対象でない（rank 5 で第1弾の行の無い寺社だけ）`);
    const s = expected.get(e.idx)!;
    if (e.qid !== s.qid || e.linkConfidence !== s.linkConfidence) {
      throw new Error(
        `${who}: qid / linkConfidence（${String(e.qid)}・${String(e.linkConfidence)}）が、対応表か手で結ぶ台帳（${String(s.qid)}・${String(s.linkConfidence)}）と合わない`
      );
    }
    if (e.p373 !== s.p373) throw new Error(`${who}: p373 が対応表か手で結ぶ台帳と違う`);
    if (
      !Array.isArray(e.truncated) ||
      !sameList(
        e.truncated,
        (['p373', 'p180'] as const).filter(k => e.truncated.includes(k))
      )
    ) {
      throw new Error(`${who}: truncated が p373 / p180 をこの順で重ねずに持たない`);
    }
    if (!Array.isArray(e.files)) throw new Error(`${who}: files が配列でない`);
    const files = e.files.map(f => parsePoolFile(f, who));
    if (e.gap === 'no-qid' && (s.qid !== null || files.length > 0 || e.truncated.length > 0)) {
      throw new Error(`${who}: gap が no-qid なのに Q-ID かファイルがある`);
    }
    if (e.gap === 'no-files' && files.length > 0)
      throw new Error(`${who}: gap が no-files なのにファイルがある`);
    if (e.gap === null && files.length === 0)
      throw new Error(`${who}: gap が null なのにファイルが無い`);
    if (e.gap !== null && e.gap !== 'no-qid' && e.gap !== 'no-files') {
      throw new Error(`${who}: gap が null / no-qid / no-files でない`);
    }
    if (s.qid === null && e.gap !== 'no-qid')
      throw new Error(`${who}: Q-ID が無いのに gap が no-qid でない`);
    if (files.length > POOL_MAX_FILES)
      throw new Error(`${who}: ファイルが ${files.length}（${POOL_MAX_FILES} まで）`);
    const names = new Set<string>();
    for (const [k, f] of files.entries()) {
      if (names.has(f.file)) throw new Error(`${who}: ${f.file} が2つある`);
      names.add(f.file);
      const why = skip(e.idx, f);
      if (why !== null) throw new Error(`${who}: ${f.file} は外すはずのファイル（${why}）`);
      if (k > 0 && byArea(files[k - 1], f) > 0) {
        throw new Error(
          `${who}: files が width × height の大きい順（同じならファイル名の順）でない`
        );
      }
    }
    entries.push({
      idx: e.idx,
      name: e.name,
      prefecture: e.prefecture,
      qid: e.qid,
      linkConfidence: e.linkConfidence,
      p373: e.p373,
      gap: e.gap,
      truncated: [...e.truncated],
      files,
    });
  }
  const counts = countsOf(entries);
  for (const k of COUNT_KEYS) {
    if (raw.counts[k] !== counts[k]) {
      throw new Error(`候補: counts.${k} が ${String(raw.counts[k])}（数え直すと ${counts[k]}）`);
    }
  }
  return {
    schemaVersion: 1,
    issue: 320,
    note: raw.note,
    attribution: { commons: raw.attribution.commons },
    counts,
    entries,
  };
}

/** 候補が対象の全部（idx）を持つか。足りない寺社の名前で止める */
export function checkPoolTargets(pool: Pool320, targets: readonly SeedRow[]): void {
  const have = new Set(pool.entries.map(e => e.idx));
  const missing = targets.filter(t => !have.has(t.idx));
  if (missing.length > 0) {
    throw new Error(
      `候補に対象の寺社が ${missing.length} 足りない: ${missing.map(t => label(t)).join('・')}`
    );
  }
}
