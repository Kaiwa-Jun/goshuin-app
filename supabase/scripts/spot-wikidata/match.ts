// 寺社と Wikidata の対応表（Issue #301）。判定の純関数（ネット・ファイルに出ない）。
// 取得は fetchers.ts、CLI は main.ts、画面のサーバーは server.ts。
// 契約書: docs/issues/issue-301-spot-wikidata.md（D-2〜D-11・D-13・D-17）
import { VectorTile } from 'npm:@mapbox/vector-tile@2.0.3';
import Pbf from 'npm:pbf@4.0.1';

import {
  distanceMeters,
  type LatLng,
  type Ledger,
  type LedgerEntry,
  MAX_MOVE_M,
  MAX_OSM_FEATURES,
  mergeEntries,
  MIN_MOVE_M,
  type OwnerItem,
  ownerItemToEntry,
} from '../spot-coords/coords.ts';

// --- 定数（値を変えるのはリーダーの判断。契約書の表とテストと README を一緒に直す） ---

/** D-5 ⑤ 項目の P625 を基準点が支える距離（m） */
export const SUPPORT_M = 300;
/** D-5 ③（= spot-coords の MAX_MOVE_M） */
export const MAX_LINK_M = MAX_MOVE_M;
/** D-9 ① 別の家族の点どうしが合う距離（m） */
export const AGREE_M = 150;
/** D-9 ② seed が支えられる距離（m） */
export const SEED_OK_M = 200;
/** D-9 ① 提案にする、seed からの最小の距離（m） */
export const MIN_SUGGEST_M = 200;
/** D-11 注記から記号に寄せる距離（m） */
export const SNAP_M = 150;
/** D-11 タイルのズームと、まわりに取る枚数（1 → 3×3） */
export const TILE_Z = 16;
export const TILE_RADIUS = 1;
/** 呼び出しの間隔（ms）。Wikimedia の API は1度に1つ（間隔は決めない） */
export const INTERVAL_MS = { nominatim: 1_100, gsiAddr: 1_000, gsiTile: 200, wdqs: 1_000 } as const;
/** D-5 ④ 都道府県の P31 と、P131 をたどる段の数 */
export const PREFECTURE_CLASS = 'Q50337';
export const MAX_P131_DEPTH = 5;
/** 地理院の注記（661・662）と記号（3231・3232）のうち寺社のもの */
export const GSI_LABEL_CODES: readonly number[] = [661, 662];
export const GSI_SYMBOL_CODES: readonly number[] = [3231, 3232];
/** 書き出しの note の上限（文字） */
export const NOTE_MAX = 200;

export const MAPPING_PATH = 'supabase/data/spot-wikidata-301.json';
export const PHOTOS_PATH = 'supabase/data/spot-photos-301.json';

export const MAPPING_NOTE =
  '寺社のマスタ（seed の 1,109 件）と Wikidata の項目の対応表。supabase/scripts/spot-wikidata/main.ts build で作る生成物。手で直さない';
export const MAPPING_ATTRIBUTION = { wikidata: 'Wikidata（CC0 1.0）https://www.wikidata.org/' };
export const PHOTOS_NOTE =
  'Wikimedia Commons の写真の候補（対応表の P18）。採るか・focus_y・承認は #302 で決める。表示には撮影者・ライセンス・元のページが要る';
export const PHOTOS_ATTRIBUTION = {
  commons: 'Wikimedia Commons。ライセンスはファイルごと（license・licenseUrl）',
};

// --- 型 ---

export interface SeedRow {
  idx: number;
  name: string;
  prefecture: string;
  type: string;
  address: string;
  rank: number;
  file: string;
  line: number;
  lat: number;
  lng: number;
}

export interface WdItem {
  qid: string;
  label: string | null;
  aliases: string[];
  p625: LatLng | null;
  p18: string[];
  p373: string | null;
  p131: string[];
  p31: string[];
}

export type Confidence = 'high' | 'medium' | 'low' | 'none';
export type Method = 'ledger' | 'rule';

export interface LinkInput {
  row: SeedRow;
  /** 台帳の第1弾で source = wikidata の行の ref（それ以外は null） */
  ledgerRef: string | null;
  /** 検索と WDQS で出た項目（名前で絞る前） */
  candidates: WdItem[];
  /** P131 の先を引く */
  lookup: (qid: string) => WdItem | undefined;
  /** 地理院の住所検索で番地まで当たった点 */
  addr: LatLng | null;
  /** 地理院の注記・記号の点 */
  gsi: LatLng | null;
}

export interface Link {
  idx: number;
  name: string;
  prefecture: string;
  qid: string | null;
  confidence: Confidence;
  method: Method;
  candidates: string[];
  basis: string;
  /** D-5 ② 候補の括弧が住所か seed の括弧に合った */
  qualifierMatch: boolean;
  /** seed の名前に括弧がある（D-5 ⑩ の3つ目） */
  hasQualifier: boolean;
}

export interface GsiFeature extends LatLng {
  kind: 'label' | 'symbol';
  /** label は annoCtg、symbol は ftCode */
  code: number;
  /** label の knj（symbol は null） */
  name: string | null;
}

export type PointKind = 'wd' | 'osm' | 'gsi' | 'addr';

export interface CoordPoint extends LatLng {
  kind: PointKind;
  ref: string | null;
  label: string | null;
}

export type Verdict = 'suggest' | 'owner' | 'investigate' | 'keep';

export interface Suggestion {
  choice: 'wd' | 'osm';
  lat: number;
  lng: number;
  ref: string | null;
}

export interface Classification {
  verdict: Verdict;
  suggestion: Suggestion | null;
  /** OSM 抜きで owner か investigate（D-9。Nominatim に聞くのはこの行だけ） */
  needsOsm: boolean;
}

export interface MappingEntry {
  idx: number;
  name: string;
  prefecture: string;
  qid: string | null;
  label: string | null;
  p625: LatLng | null;
  p18: string[];
  p373: string | null;
  confidence: Confidence;
  method: Method;
  candidates: string[];
  basis: string;
}

export interface Mapping {
  schemaVersion: 1;
  issue: 301;
  note: string;
  attribution: { wikidata: string };
  entries: MappingEntry[];
}

export interface PhotoFile {
  file: string;
  width: number;
  height: number;
  mime: string;
  sha1: string;
  url: string;
  descriptionUrl: string;
  license: string | null;
  licenseUrl: string | null;
  artist: string | null;
  artistHtml: string | null;
  credit: string | null;
  creditHtml: string | null;
  attributionRequired: boolean | null;
  copyrighted: boolean | null;
  restrictions: string;
  usageTerms: string | null;
}

export interface PhotoEntry {
  idx: number;
  name: string;
  prefecture: string;
  qid: string;
  linkConfidence: 'high' | 'medium';
  files: PhotoFile[];
}

export interface Photos {
  schemaVersion: 1;
  issue: 301;
  note: string;
  attribution: { commons: string };
  entries: PhotoEntry[];
}

/** 書き出し（D-18）の1行。import-owner の OwnerItem に ref と verdict を足したもの */
export interface ExportItem {
  idx: number;
  name: string;
  prefecture: string;
  file: string;
  line: number;
  verdict: string;
  seed: LatLng;
  choice: string;
  lat: number | null;
  lng: number | null;
  ref: string | null;
  note: string | null;
  chosen_at: string;
}

// --- 小さな道具 ---

function label(e: { name: string; prefecture: string }): string {
  return `${e.name}（${e.prefecture}）`;
}

export function round6(n: number): number {
  return Number(n.toFixed(6));
}

export function inJapan(p: LatLng): boolean {
  return p.lat >= 20 && p.lat <= 46 && p.lng >= 122 && p.lng <= 154;
}

function meters(d: number): string {
  return `${Math.round(d)}m`;
}

function qidNumber(q: string): number {
  return Number(q.slice(1));
}

export function sortQids(qids: Iterable<string>): string[] {
  return [...new Set(qids)].sort((a, b) => qidNumber(a) - qidNumber(b));
}

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

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// --- D-2: seed の行 ---

const SEED_ROW = /^\('(?:[^']|'')*',\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?,/;

/** `('名前', 数, 数, 'type', '住所', '県', 数, 'status')` を値に分ける */
function splitRow(line: string): (string | number)[] | null {
  const values: (string | number)[] = [];
  let i = 1;
  while (i < line.length) {
    while (line[i] === ' ') i++;
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
      values.push(s);
    } else {
      const start = i;
      while (i < line.length && line[i] !== ',' && line[i] !== ')') i++;
      const text = line.slice(start, i).trim();
      if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
      values.push(Number(text));
    }
    while (line[i] === ' ') i++;
    if (line[i] === ',') {
      i++;
      continue;
    }
    if (line[i] === ')') return values;
    return null;
  }
  return null;
}

/** SEED_FILES の順に寺社の行を数えた、1 から始まる番号（台帳の idx と同じ） */
export function readSeedRows(files: { path: string; text: string }[]): SeedRow[] {
  const rows: SeedRow[] = [];
  for (const { path, text } of files) {
    text.split('\n').forEach((line, i) => {
      if (!SEED_ROW.test(line)) return;
      const v = splitRow(line);
      if (!v || v.length < 7) throw new Error(`${path}:${i + 1}: 寺社の行を読めない: ${line}`);
      const [name, lat, lng, type, address, prefecture, rank] = v;
      if (
        typeof name !== 'string' ||
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        typeof type !== 'string' ||
        typeof address !== 'string' ||
        typeof prefecture !== 'string' ||
        typeof rank !== 'number'
      ) {
        throw new Error(`${path}:${i + 1}: 寺社の行の値の形が違う: ${line}`);
      }
      rows.push({
        idx: rows.length + 1,
        name,
        prefecture,
        type,
        address,
        rank,
        file: path,
        line: i + 1,
        lat,
        lng,
      });
    });
  }
  return rows;
}

// --- D-3・D-4: 名前 ---

/** 旧字体 → 新字体（比べるためだけ。足すときはテストも足す） */
const OLD_TO_NEW: Record<string, string> = {
  賣: '売',
  國: '国',
  縣: '県',
  彌: '弥',
  廣: '広',
  澤: '沢',
  濱: '浜',
  邊: '辺',
  邉: '辺',
  齋: '斎',
  齊: '斎',
  嶋: '島',
  櫻: '桜',
  瀧: '滝',
  龍: '竜',
  寶: '宝',
  藏: '蔵',
  圓: '円',
  靈: '霊',
  德: '徳',
  眞: '真',
  豐: '豊',
  禮: '礼',
  ヶ: 'ケ',
};

/** NFKC → 空白を消す → 旧字体を新字体に寄せる */
export function normalizeText(s: string): string {
  return [...s.normalize('NFKC').replace(/\s+/g, '')].map(c => OLD_TO_NEW[c] ?? c).join('');
}

/** 末尾の括弧を外して qualifier にする（比べるためだけ。表に出す名前は変えない） */
export function normalizeName(s: string): { base: string; qualifier: string | null } {
  const t = normalizeText(s);
  const m = /^(.+)\(([^()]*)\)$/.exec(t);
  if (!m) return { base: t, qualifier: null };
  return { base: m[1], qualifier: m[2] === '' ? null : m[2] };
}

const SPOT_SUFFIXES = [
  '寺',
  '院',
  '神社',
  '宮',
  '社',
  '大師',
  '観音',
  '不動',
  '不動尊',
  '大仏',
  '稲荷',
  '権現',
  '明神',
  '堂',
  '庵',
  '坊',
];

export function isSpotLikeName(s: string): boolean {
  const t = normalizeText(s);
  return SPOT_SUFFIXES.some(x => t.endsWith(x));
}

export type NameLevel = 'exact' | 'partial' | 'none';

export function nameMatch(a: string, b: string): NameLevel {
  const x = normalizeName(a).base;
  const y = normalizeName(b).base;
  if (x === '' || y === '') return 'none';
  if (x === y) return 'exact';
  const [short, long] = [...x].length <= [...y].length ? [x, y] : [y, x];
  return [...short].length >= 3 && long.includes(short) ? 'partial' : 'none';
}

/** D-5 ① 比べる名前: seed の base と、括弧が寺社の名前ならそれも */
export function linkNames(name: string): string[] {
  const { base, qualifier } = normalizeName(name);
  return qualifier !== null && isSpotLikeName(qualifier) ? [base, qualifier] : [base];
}

/**
 * 検索（Wikidata の検索・WDQS・Nominatim）に渡す名前。seed の字のまま括弧を外したものと、
 * 旧字体を寄せたもの（違うときだけ）、括弧が寺社の名前ならその両方。
 * 検索は字の違いを同じに見ない（姉倉比売神社 では 姉倉比賣神社（富山市舟倉）が出ない）
 */
export function searchNames(name: string): string[] {
  const raw = name.trim();
  const m = /^(.+?)\s*[（(]([^（）()]*)[）)]$/.exec(raw);
  const parts = [m ? m[1].trim() : raw];
  if (m && m[2] !== '' && isSpotLikeName(m[2])) parts.push(m[2].trim());
  const out: string[] = [];
  for (const p of parts) {
    out.push(p);
    const n = normalizeName(p).base;
    if (n !== p) out.push(n);
  }
  return [...new Set(out)];
}

function itemNames(c: WdItem): string[] {
  return [...(c.label === null ? [] : [c.label]), ...c.aliases];
}

function bestLevel(names: string[], others: string[]): NameLevel {
  let best: NameLevel = 'none';
  for (const a of names) {
    for (const b of others) {
      const m = nameMatch(a, b);
      if (m === 'exact') return 'exact';
      if (m === 'partial') best = 'partial';
    }
  }
  return best;
}

// --- D-10: 地理院の住所 ---

const KANJI_DIGIT: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function kanjiNumber(k: string): number {
  if (k === '十') return 10;
  if (k.startsWith('十')) return 10 + KANJI_DIGIT[k[1]];
  return KANJI_DIGIT[k];
}

export function normalizeAddress(s: string): string {
  return normalizeText(s)
    .replace(
      /(十[一二三四五六七八九]?|[一二三四五六七八九])丁目/g,
      (_, k: string) => `${kanjiNumber(k)}-`
    )
    .replace(/(\d)丁目/g, '$1-')
    .replace(/(\d)番地/g, '$1-')
    .replace(/(\d)番/g, '$1-')
    .replace(/(\d)号/g, '$1')
    .replace(/(\d)[-ー‐−–—―]/g, '$1-')
    .replace(/-+/g, '-')
    .replace(/-+$/, '');
}

/** 地理院の住所検索の title が、seed の住所のどこまで当たったか。基準点に使うのは banchi だけ */
export function addressHitLevel(query: string, title: string): 'banchi' | 'town' | 'none' {
  const q = normalizeAddress(query);
  const t = normalizeAddress(title);
  if (t === '' || !q.startsWith(t)) return 'none';
  const next = q.slice(t.length, t.length + 1);
  if (/[0-9]/.test(next)) return 'town';
  if (!/[0-9]$/.test(t)) return 'none';
  // 丁目までの点は町名と同じく番地ではない
  return normalizeText(title).endsWith('丁目') ? 'town' : 'banchi';
}

// --- D-6: Wikidata の値 ---

interface Statement {
  rank?: string;
  mainsnak?: { snaktype?: string; datavalue?: { value?: unknown } };
}

function statementValues(claims: Record<string, unknown>, p: string): unknown[] {
  const list = (Array.isArray(claims[p]) ? claims[p] : []) as Statement[];
  const usable = list.filter(
    s => s.rank !== 'deprecated' && s.mainsnak?.snaktype === 'value' && s.mainsnak.datavalue
  );
  const preferred = usable.filter(s => s.rank === 'preferred');
  const rest = usable.filter(s => s.rank !== 'preferred');
  return [...preferred, ...rest].map(s => s.mainsnak!.datavalue!.value);
}

function entityIds(values: unknown[]): string[] {
  return values
    .map(v => (isObject(v) && typeof v.id === 'string' ? v.id : null))
    .filter((v): v is string => v !== null && /^Q\d+$/.test(v));
}

/** wbgetentities の1項目 → 使う値（D-6） */
export function parseEntity(raw: unknown): WdItem {
  if (!isObject(raw) || typeof raw.id !== 'string') throw new Error('Wikidata の項目ではない');
  const labels = isObject(raw.labels) ? raw.labels : {};
  const aliases = isObject(raw.aliases) ? raw.aliases : {};
  const claims = isObject(raw.claims) ? raw.claims : {};
  const ja = labels.ja;
  const coord = statementValues(claims, 'P625').find(
    v => isObject(v) && typeof v.latitude === 'number' && typeof v.longitude === 'number'
  ) as { latitude: number; longitude: number } | undefined;
  const strings = (p: string) =>
    statementValues(claims, p).filter((v): v is string => typeof v === 'string' && v !== '');
  return {
    qid: raw.id,
    label: isObject(ja) && typeof ja.value === 'string' ? ja.value : null,
    aliases: (Array.isArray(aliases.ja) ? aliases.ja : [])
      .map(a => (isObject(a) && typeof a.value === 'string' ? a.value : null))
      .filter((v): v is string => v !== null),
    p625: coord ? { lat: round6(coord.latitude), lng: round6(coord.longitude) } : null,
    p18: [...new Set(strings('P18'))],
    p373: strings('P373')[0] ?? null,
    p131: [...new Set(entityIds(statementValues(claims, 'P131')))],
    p31: [...new Set(entityIds(statementValues(claims, 'P31')))],
  };
}

/** D-5 ④ P131 をたどって着いた都道府県のラベル（5段まで。都道府県の先はたどらない） */
export function prefecturesOf(item: WdItem, lookup: (qid: string) => WdItem | undefined): string[] {
  const found = new Set<string>();
  const seen = new Set<string>();
  let frontier = item.p131;
  for (let depth = 0; depth < MAX_P131_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const q of frontier) {
      if (seen.has(q)) continue;
      seen.add(q);
      const e = lookup(q);
      if (!e) continue;
      if (e.p31.includes(PREFECTURE_CLASS)) {
        if (e.label !== null) found.add(e.label);
      } else next.push(...e.p131);
    }
    frontier = next;
  }
  return [...found].sort();
}

/** P131 をたどるのに要るが、まだ手元に無い Q-ID（取得で、無くなるまで繰り返す） */
export function p131ToFetch(
  items: WdItem[],
  lookup: (qid: string) => WdItem | undefined,
  known: (qid: string) => boolean = q => lookup(q) !== undefined
): string[] {
  const need = new Set<string>();
  for (const item of items) {
    const seen = new Set<string>();
    let frontier = item.p131;
    for (let depth = 0; depth < MAX_P131_DEPTH && frontier.length > 0; depth++) {
      const next: string[] = [];
      for (const q of frontier) {
        if (seen.has(q)) continue;
        seen.add(q);
        if (!known(q)) {
          need.add(q);
          continue;
        }
        const e = lookup(q);
        if (e && !e.p31.includes(PREFECTURE_CLASS)) next.push(...e.p131);
      }
      frontier = next;
    }
  }
  return sortQids(need);
}

// --- D-5: 結びつけ ---

export const LEDGER_BASIS = '#292 の台帳（第1弾）で人が確かめた Q-ID';

type BaseKind = 'addr' | 'gsi' | 'seed';

const BASE_TEXT: Record<BaseKind, string> = {
  addr: '地理院の住所（番地）',
  gsi: '地理院の注記・記号',
  seed: 'seed ',
};

interface Judged {
  item: WdItem;
  qualifierMatch: boolean;
  /** 合った括弧と、どこに合ったか */
  qualifierText: string | null;
  qualifierWhere: '住所' | 'seed の括弧' | null;
  supports: { kind: BaseKind; d: number }[];
}

/** 名前で絞ったあとの候補（D-5 ①）。取得でタイルの範囲を決めるのにも使う */
export function nameMatchedCandidates(
  row: SeedRow,
  candidates: WdItem[]
): { level: 'exact' | 'partial' | null; items: WdItem[] } {
  const names = linkNames(row.name);
  const byQid = new Map<string, WdItem>();
  for (const c of candidates) if (!byQid.has(c.qid)) byQid.set(c.qid, c);
  const leveled = [...byQid.values()].map(c => ({ c, level: bestLevel(names, itemNames(c)) }));
  const exact = leveled.filter(l => l.level === 'exact').map(l => l.c);
  if (exact.length > 0) return { level: 'exact', items: exact };
  const partial = leveled.filter(l => l.level === 'partial').map(l => l.c);
  return partial.length > 0 ? { level: 'partial', items: partial } : { level: null, items: [] };
}

/** D-5 ②: 候補の括弧が seed に合うか。null は括弧を持たない */
function qualifierCheck(
  row: SeedRow,
  c: WdItem
): { ok: boolean; text: string | null; where: '住所' | 'seed の括弧' | null } | null {
  const quals = itemNames(c)
    .map(n => normalizeName(n).qualifier)
    .filter((q): q is string => q !== null);
  if (quals.length === 0) return null;
  const address = normalizeText(row.address);
  const seedQ = normalizeName(row.name).qualifier;
  for (const q of quals) {
    if (address.includes(q)) return { ok: true, text: q, where: '住所' };
    if (seedQ !== null && (seedQ.includes(q) || q.includes(seedQ))) {
      return { ok: true, text: q, where: 'seed の括弧' };
    }
  }
  return { ok: false, text: null, where: null };
}

/** D-5 ①〜④ を通った候補（取得でタイルの範囲を決めるときは gsi を null で呼ぶ） */
export function filterCandidates(input: LinkInput): {
  level: 'exact' | 'partial' | null;
  matched: WdItem[];
  kept: Judged[];
} {
  const { row } = input;
  const { level, items } = nameMatchedCandidates(row, input.candidates);
  const seed = { lat: row.lat, lng: row.lng };
  const bases: { kind: BaseKind; p: LatLng }[] = [
    ...(input.addr ? [{ kind: 'addr' as const, p: input.addr }] : []),
    ...(input.gsi ? [{ kind: 'gsi' as const, p: input.gsi }] : []),
    { kind: 'seed', p: seed },
  ];
  const kept: Judged[] = [];
  for (const c of items) {
    const q = qualifierCheck(row, c);
    if (q && !q.ok) continue; // ②
    if (c.p625) {
      const near = Math.min(...bases.map(b => distanceMeters(b.p, c.p625!)));
      if (near > MAX_LINK_M) continue; // ③
    }
    const prefs = prefecturesOf(c, input.lookup);
    if (prefs.length > 0 && !prefs.includes(row.prefecture)) continue; // ④
    const supports = c.p625
      ? bases
          .map(b => ({ kind: b.kind, d: distanceMeters(b.p, c.p625!) }))
          .filter(s => s.d <= SUPPORT_M)
      : [];
    kept.push({
      item: c,
      qualifierMatch: q?.ok === true,
      qualifierText: q?.text ?? null,
      qualifierWhere: q?.where ?? null,
      supports,
    });
  }
  return { level, matched: items, kept };
}

function describe(row: SeedRow, j: Judged, matched: number, partial: boolean): string[] {
  const parts: string[] = [];
  if (partial) parts.push(matched >= 2 ? `名前の一部が合う項目 ${matched} 件` : '名前の一部が合う');
  else parts.push(matched >= 2 ? `同名 ${matched} 件` : '名前が一致');
  if (j.qualifierMatch && j.qualifierText) {
    parts.push(`名前の（${j.qualifierText}）が${j.qualifierWhere}に合う`);
  }
  if (j.supports.length > 0) {
    parts.push(j.supports.map(s => `${BASE_TEXT[s.kind]}から ${meters(s.d)}`).join('・'));
  } else if (j.item.p625) {
    const d = distanceMeters({ lat: row.lat, lng: row.lng }, j.item.p625);
    parts.push(`どの基準点からも ${SUPPORT_M}m より遠い（seed から ${meters(d)}）`);
  } else {
    parts.push('項目に座標が無い');
  }
  return parts;
}

export function judgeLink(input: LinkInput): Link {
  const { row } = input;
  const common = {
    idx: row.idx,
    name: row.name,
    prefecture: row.prefecture,
    hasQualifier: normalizeName(row.name).qualifier !== null,
  };
  // ⓪ 台帳の第1弾（人が確かめた）
  if (input.ledgerRef !== null) {
    return {
      ...common,
      qid: input.ledgerRef,
      confidence: 'high',
      method: 'ledger',
      candidates: [],
      basis: LEDGER_BASIS,
      qualifierMatch: false,
    };
  }
  const { level, matched, kept } = filterCandidates(input);
  const matchedIds = sortQids(matched.map(c => c.qid));
  const decide = (j: Judged, confidence: Confidence, extra: string[] = []): Link => ({
    ...common,
    qid: j.item.qid,
    confidence,
    method: 'rule',
    candidates: matchedIds.filter(q => q !== j.item.qid),
    basis: [...describe(row, j, matched.length, level === 'partial'), ...extra].join('。'),
    qualifierMatch: j.qualifierMatch,
  });
  const none = (basis: string): Link => ({
    ...common,
    qid: null,
    confidence: 'none',
    method: 'rule',
    candidates: matchedIds,
    basis,
    qualifierMatch: false,
  });

  if (matched.length === 0) return none('名前の合う項目が無い');
  if (kept.length === 0) {
    return none(`名前の合う項目 ${matched.length} 件が、括弧・距離・都道府県で外れた`);
  }
  // ⑨ partial だけ
  if (level === 'partial') {
    const supported = kept.filter(k => k.supports.length > 0);
    if (supported.length === 1) return decide(supported[0], 'low');
    return none(
      `名前の一部が合う項目 ${kept.length} 件のうち、基準点に支えられたものが ${supported.length} 件で決められない`
    );
  }
  // ⑥ 強い候補（地理院の点に支えられる・括弧が合う）
  const strong = kept.filter(k => k.qualifierMatch || k.supports.some(s => s.kind !== 'seed'));
  if (strong.length === 1) return decide(strong[0], 'high');
  if (strong.length >= 2) {
    const q = strong.filter(k => k.qualifierMatch);
    if (q.length === 1) return decide(q[0], 'high');
    return none(`地理院の点か括弧に合う項目が ${strong.length} 件あり、決められない`);
  }
  // ⑦ seed だけに支えられた候補
  const bySeed = kept.filter(k => k.supports.length > 0);
  if (bySeed.length === 1) {
    if (kept.length === 1) return decide(bySeed[0], 'high');
    return decide(bySeed[0], 'medium', [`ほかに候補 ${kept.length - 1} 件`]);
  }
  if (bySeed.length >= 2) {
    return none(`seed の近くに同名の項目が ${bySeed.length} 件あり、決められない`);
  }
  // ⑧ どこにも支えられない
  if (kept.length === 1) return decide(kept[0], 'medium');
  return none(`同名の項目が ${kept.length} 件あり、どれも基準点から遠く、決められない`);
}

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1, none: 0 };

function linkRank(l: Link): number[] {
  return [
    l.method === 'ledger' ? 4 : CONFIDENCE_RANK[l.confidence],
    l.qualifierMatch ? 1 : 0,
    l.hasQualifier ? 0 : 1,
  ];
}

function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
}

/**
 * D-5 ⑩ 同じ Q-ID を2つ以上の行が選んだら1行に残す。台帳の行（人が確かめた）はどれも残し、
 * 規則の行は台帳の行に負ける。並んだら全部決めない。並びは変えない
 */
export function dedupeLinks(links: Link[]): Link[] {
  const groups = new Map<string, Link[]>();
  for (const l of links) {
    if (l.qid === null) continue;
    groups.set(l.qid, [...(groups.get(l.qid) ?? []), l]);
  }
  const losers = new Map<Link, string>();
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const ledger = group.filter(l => l.method === 'ledger');
    if (ledger.length > 0) {
      for (const l of group) {
        if (l.method !== 'ledger') {
          losers.set(
            l,
            `同じ項目を ${ledger.map(x => x.name).join('・')} が選んだ（台帳）ので決めない`
          );
        }
      }
      continue;
    }
    const sorted = [...group].sort((a, b) => compareRank(linkRank(a), linkRank(b)));
    if (compareRank(linkRank(sorted[0]), linkRank(sorted[1])) === 0) {
      for (const l of group) {
        const others = group.filter(x => x !== l).map(x => x.name);
        losers.set(l, `同じ項目を ${others.join('・')} と取り合い、決められない`);
      }
    } else {
      for (const l of sorted.slice(1)) {
        losers.set(l, `同じ項目を ${sorted[0].name} が選んだので決めない`);
      }
    }
  }
  return links.map(l => {
    const basis = losers.get(l);
    if (basis === undefined) return l;
    return {
      ...l,
      qid: null,
      confidence: 'none' as const,
      candidates: sortQids([...l.candidates, l.qid!]),
      basis,
      qualifierMatch: false,
    };
  });
}

// --- D-11: 地理院のベクトルタイル ---

export function tileOf(p: LatLng, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((p.lng + 180) / 360) * n);
  const r = (p.lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return { x, y };
}

/** 点のそれぞれを中心にした (2r+1)×(2r+1) 枚（重なりは1回）。x, y の順 */
export function tilesAround(
  points: LatLng[],
  z: number = TILE_Z,
  radius: number = TILE_RADIUS
): { x: number; y: number }[] {
  const keys = new Map<string, { x: number; y: number }>();
  for (const p of points) {
    const c = tileOf(p, z);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const t = { x: c.x + dx, y: c.y + dy };
        keys.set(`${t.x}/${t.y}`, t);
      }
    }
  }
  return [...keys.values()].sort((a, b) => a.x - b.x || a.y - b.y);
}

function tilePointToLatLng(
  px: number,
  py: number,
  extent: number,
  z: number,
  x: number,
  y: number
) {
  const n = 2 ** z;
  const lng = ((x + px / extent) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n))) * 180) / Math.PI;
  return { lat, lng };
}

/** z/x/y のタイルから、寺社の注記（label の annoCtg 661・662）と記号（symbol の ftCode 3231・3232）だけ */
export function parseGsiTile(bytes: Uint8Array, z: number, x: number, y: number): GsiFeature[] {
  if (bytes.length === 0) return [];
  const tile = new VectorTile(new Pbf(bytes));
  const out: GsiFeature[] = [];
  const read = (layerName: 'label' | 'symbol', key: string, codes: readonly number[]) => {
    const layer = tile.layers[layerName];
    if (!layer) return;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      const code = Number(f.properties[key]);
      if (!codes.includes(code)) continue;
      const first = f.loadGeometry()[0]?.[0];
      if (!first) continue;
      const knj = f.properties.knj;
      out.push({
        kind: layerName,
        code,
        name: layerName === 'label' && typeof knj === 'string' ? knj : null,
        ...tilePointToLatLng(first.x, first.y, layer.extent, z, x, y),
      });
    }
  };
  read('label', 'annoCtg', GSI_LABEL_CODES);
  read('symbol', 'ftCode', GSI_SYMBOL_CODES);
  return out;
}

function nearestLabel(labels: GsiFeature[], to: LatLng[]): { f: GsiFeature; d: number } | null {
  let best: { f: GsiFeature; d: number } | null = null;
  for (const f of labels) {
    const d = Math.min(...to.map(p => distanceMeters(p, f)));
    if (
      !best ||
      d < best.d ||
      (d === best.d && (f.lat < best.f.lat || (f.lat === best.f.lat && f.lng < best.f.lng)))
    ) {
      best = { f, d };
    }
  }
  return best;
}

/**
 * 名前の合う注記を1つ選び、注記から SNAP_M 以内に記号があればいちばん近い記号の点、無ければ注記の点。
 * 選び方: anchors（seed と地理院の住所の点）から SUPPORT_M 以内に名前の合う注記があれば、anchors に
 * いちばん近いもの。無ければ near（anchors と候補の P625）のどれかにいちばん近いもの（D-11）。
 * anchors を先に見るのは、同じ名前の別の寺社の注記が、その寺社の項目の P625 のすぐ近くにあるため
 * （S4 の抜き取りで、湯殿山神社・黄金山神社が別の同名の項目に high で結びついた）
 */
export function gsiPointFor(
  names: string[],
  features: GsiFeature[],
  near: LatLng[],
  anchors: LatLng[] = near
): (LatLng & { label: string }) | null {
  if (near.length === 0 && anchors.length === 0) return null;
  const labels = features.filter(
    f => f.kind === 'label' && f.name !== null && names.some(n => nameMatch(f.name!, n) !== 'none')
  );
  const anchored = anchors.length > 0 ? nearestLabel(labels, anchors) : null;
  const best =
    anchored && anchored.d <= SUPPORT_M ? anchored : nearestLabel(labels, [...anchors, ...near]);
  if (!best) return null;
  let snap: { f: GsiFeature; d: number } | null = null;
  for (const s of features) {
    if (s.kind !== 'symbol') continue;
    const d = distanceMeters(best.f, s);
    if (d <= SNAP_M && (!snap || d < snap.d)) snap = { f: s, d };
  }
  const p = snap ? snap.f : best.f;
  return { lat: p.lat, lng: p.lng, label: best.f.name! };
}

// --- D-9: #292 第2弾の分け方 ---

const FAMILY: Record<PointKind, string> = {
  wd: 'wikidata',
  osm: 'osm',
  gsi: 'gsi',
  addr: 'gsi',
};

function classifyOnce(seed: LatLng, points: CoordPoint[]): Omit<Classification, 'needsOsm'> {
  const proposals = points.filter(
    p =>
      (p.kind === 'wd' || p.kind === 'osm') &&
      distanceMeters(seed, p) >= MIN_SUGGEST_M &&
      points.some(q => FAMILY[q.kind] !== FAMILY[p.kind] && distanceMeters(p, q) <= AGREE_M)
  );
  const seedOk = points.some(p => distanceMeters(seed, p) <= SEED_OK_M);
  if (proposals.length > 0) {
    if (seedOk) return { verdict: 'owner', suggestion: null };
    const p = proposals.find(x => x.kind === 'wd') ?? proposals.find(x => x.kind === 'osm')!;
    return {
      verdict: 'suggest',
      suggestion: { choice: p.kind as 'wd' | 'osm', lat: p.lat, lng: p.lng, ref: p.ref },
    };
  }
  if (seedOk) return { verdict: 'keep', suggestion: null };
  if (points.length > 0) return { verdict: 'owner', suggestion: null };
  return { verdict: 'investigate', suggestion: null };
}

export function classifyCoord(seed: LatLng, points: CoordPoint[]): Classification {
  const withoutOsm = classifyOnce(
    seed,
    points.filter(p => p.kind !== 'osm')
  ).verdict;
  return {
    ...classifyOnce(seed, points),
    needsOsm: withoutOsm === 'owner' || withoutOsm === 'investigate',
  };
}

// --- D-8: Commons ---

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
      if (e.startsWith('#x') || e.startsWith('#X'))
        return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith('#')) return String.fromCodePoint(Number(e.slice(1)));
      return ENTITIES[e] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function stripQuery(url: string): string {
  const i = url.indexOf('?');
  return i < 0 ? url : url.slice(0, i);
}

function metaValue(em: Record<string, unknown>, key: string): string | null {
  const v = em[key];
  if (!isObject(v) || v.value === undefined || v.value === null) return null;
  return String(v.value);
}

function metaBool(em: Record<string, unknown>, key: string): boolean | null {
  const v = metaValue(em, key)?.trim().toLowerCase();
  return v === 'true' ? true : v === 'false' ? false : null;
}

/** Commons の imageinfo の応答（formatversion=2）→ 要るファイル名ごとの情報と、Commons に無いファイル */
export function parseImageInfo(
  res: unknown,
  requested: string[]
): { files: Record<string, PhotoFile>; missing: string[] } {
  const query = isObject(res) && isObject(res.query) ? res.query : {};
  const normalized = new Map<string, string>();
  for (const n of Array.isArray(query.normalized) ? query.normalized : []) {
    if (isObject(n) && typeof n.from === 'string' && typeof n.to === 'string') {
      normalized.set(n.from, n.to);
    }
  }
  const rawPages = Array.isArray(query.pages)
    ? query.pages
    : isObject(query.pages)
      ? Object.values(query.pages)
      : [];
  const pages = new Map<string, Record<string, unknown>>();
  for (const p of rawPages) if (isObject(p) && typeof p.title === 'string') pages.set(p.title, p);

  const files: Record<string, PhotoFile> = {};
  const missing: string[] = [];
  for (const name of requested) {
    const title = `File:${name}`;
    const page = pages.get(normalized.get(title) ?? title);
    const info = page && Array.isArray(page.imageinfo) ? page.imageinfo[0] : undefined;
    if (!page || page.missing !== undefined || !isObject(info)) {
      missing.push(name);
      continue;
    }
    const em = isObject(info.extmetadata) ? info.extmetadata : {};
    const artistHtml = metaValue(em, 'Artist');
    const creditHtml = metaValue(em, 'Credit');
    const license = metaValue(em, 'LicenseShortName');
    const usageTerms = metaValue(em, 'UsageTerms');
    files[name] = {
      file: name,
      width: Number(info.width),
      height: Number(info.height),
      mime: String(info.mime),
      sha1: String(info.sha1),
      url: stripQuery(String(info.url)),
      descriptionUrl: stripQuery(String(info.descriptionurl)),
      license: license === null ? null : htmlToText(license),
      licenseUrl: metaValue(em, 'LicenseUrl'),
      artist: artistHtml === null ? null : htmlToText(artistHtml),
      artistHtml,
      credit: creditHtml === null ? null : htmlToText(creditHtml),
      creditHtml,
      attributionRequired: metaBool(em, 'AttributionRequired'),
      copyrighted: metaBool(em, 'Copyrighted'),
      restrictions: metaValue(em, 'Restrictions') ?? '',
      usageTerms: usageTerms === null ? null : htmlToText(usageTerms),
    };
  }
  return { files, missing };
}

// --- D-13: 公開の2ファイルの検査 ---

const MAPPING_KEYS = [
  'idx',
  'name',
  'prefecture',
  'qid',
  'label',
  'p625',
  'p18',
  'p373',
  'confidence',
  'method',
  'candidates',
  'basis',
] as const;

const TOP_KEYS = ['schemaVersion', 'issue', 'note', 'attribution', 'entries'];
const QID = /^Q\d+$/;

function parseTop(json: unknown, attributionKey: string, what: string): Record<string, unknown> {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isObject(raw)) throw new Error(`${what}ではない`);
  exactKeys(raw, TOP_KEYS, what);
  if (raw.schemaVersion !== 1 || raw.issue !== 301) {
    throw new Error(`${what}ではない（schemaVersion 1・issue 301 のはず）`);
  }
  if (typeof raw.note !== 'string' || raw.note === '') throw new Error(`${what}の note が無い`);
  if (!isObject(raw.attribution)) throw new Error(`${what}の attribution が無い`);
  exactKeys(raw.attribution, [attributionKey], `${what}の attribution`);
  if (typeof raw.attribution[attributionKey] !== 'string') {
    throw new Error(`${what}の attribution.${attributionKey} が文字でない`);
  }
  if (!Array.isArray(raw.entries)) throw new Error(`${what}の entries が配列でない`);
  return raw;
}

function checkNamePrefecture(
  e: Record<string, unknown>,
  i: number
): { name: string; prefecture: string } {
  if (typeof e.name !== 'string' || e.name === '') throw new Error(`entries[${i}]: name が空`);
  if (typeof e.prefecture !== 'string' || !/[都道府県]$/.test(e.prefecture)) {
    throw new Error(`entries[${i}] ${e.name}: prefecture が都道府県でない`);
  }
  return { name: e.name, prefecture: e.prefecture };
}

function checkOrderAndUnique(entries: { idx: number; name: string; prefecture: string }[]): void {
  const names = new Set<string>();
  let last = 0;
  for (const e of entries) {
    if (e.idx <= last) {
      throw new Error(`${label(e)}: idx ${e.idx} が重なるか、順でない（前は ${last}）`);
    }
    last = e.idx;
    const key = `${e.name}\u0000${e.prefecture}`;
    if (names.has(key)) throw new Error(`${label(e)}: 名前と都道府県が重なる`);
    names.add(key);
  }
}

function parseMappingEntry(raw: unknown, i: number): MappingEntry {
  if (!isObject(raw)) throw new Error(`entries[${i}] がオブジェクトでない`);
  const { name, prefecture } = checkNamePrefecture(raw, i);
  const who = label({ name, prefecture });
  exactKeys(raw, MAPPING_KEYS, who);
  const e = raw as unknown as MappingEntry;
  if (!isInt(e.idx, 1)) throw new Error(`${who}: idx が 1 以上の整数でない`);
  if (e.qid !== null && (typeof e.qid !== 'string' || !QID.test(e.qid))) {
    throw new Error(`${who}: qid の形が違う: ${String(e.qid)}`);
  }
  if (!['high', 'medium', 'low', 'none'].includes(e.confidence)) {
    throw new Error(`${who}: 知らない confidence: ${String(e.confidence)}`);
  }
  if ((e.qid === null) !== (e.confidence === 'none')) {
    throw new Error(
      `${who}: qid が null ⇔ confidence が none のはず（${e.qid} / ${e.confidence}）`
    );
  }
  if (e.label !== null && typeof e.label !== 'string')
    throw new Error(`${who}: label が文字か null でない`);
  if (e.p625 !== null) {
    if (!isObject(e.p625)) throw new Error(`${who}: p625 が { lat, lng } でない`);
    exactKeys(e.p625 as unknown as Record<string, unknown>, ['lat', 'lng'], `${who}: p625`);
    const { lat, lng } = e.p625;
    if (typeof lat !== 'number' || typeof lng !== 'number')
      throw new Error(`${who}: p625 が数でない`);
    if (round6(lat) !== lat || round6(lng) !== lng)
      throw new Error(`${who}: p625 が小数6桁を超える`);
    if (!inJapan(e.p625)) throw new Error(`${who}: p625 が日本の範囲の外`);
  }
  if (
    !Array.isArray(e.p18) ||
    e.p18.some(f => typeof f !== 'string' || f === '' || f.startsWith('File:'))
  ) {
    throw new Error(`${who}: p18 がファイル名（File: を付けない）の配列でない`);
  }
  if (new Set(e.p18).size !== e.p18.length) throw new Error(`${who}: p18 が重なる`);
  if (e.p373 !== null && typeof e.p373 !== 'string')
    throw new Error(`${who}: p373 が文字か null でない`);
  if (
    e.qid === null &&
    (e.label !== null || e.p625 !== null || e.p18.length > 0 || e.p373 !== null)
  ) {
    throw new Error(`${who}: qid が null なのに項目の値がある`);
  }
  if (e.method !== 'ledger' && e.method !== 'rule')
    throw new Error(`${who}: 知らない method: ${String(e.method)}`);
  if (
    !Array.isArray(e.candidates) ||
    e.candidates.some(q => typeof q !== 'string' || !QID.test(q))
  ) {
    throw new Error(`${who}: candidates が Q-ID の配列でない`);
  }
  for (let k = 1; k < e.candidates.length; k++) {
    if (qidNumber(e.candidates[k - 1]) >= qidNumber(e.candidates[k])) {
      throw new Error(`${who}: candidates が重なるか、Q の数の昇順でない`);
    }
  }
  if (e.qid !== null && e.candidates.includes(e.qid))
    throw new Error(`${who}: candidates に qid がある`);
  if (e.method === 'ledger' && (e.confidence !== 'high' || e.candidates.length > 0)) {
    throw new Error(`${who}: 台帳の行は high で candidates が空のはず`);
  }
  if (typeof e.basis !== 'string' || e.basis.trim() === '') throw new Error(`${who}: basis が空`);
  if (/https?:|:\/\/|\/Users|~\//.test(e.basis) || /\d+\.\d{4,}/.test(e.basis)) {
    throw new Error(`${who}: basis に URL・パス・座標がある: ${e.basis}`);
  }
  return {
    idx: e.idx,
    name,
    prefecture,
    qid: e.qid,
    label: e.label,
    p625: e.p625 === null ? null : { lat: e.p625.lat, lng: e.p625.lng },
    p18: [...e.p18],
    p373: e.p373,
    confidence: e.confidence,
    method: e.method,
    candidates: [...e.candidates],
    basis: e.basis,
  };
}

/** 対応表の検査（JSON の文字でも、読んだ値でもよい）。決めたキー以外があれば止める */
export function parseMapping(json: unknown): Mapping {
  const raw = parseTop(json, 'wikidata', '対応表');
  const entries = (raw.entries as unknown[]).map(parseMappingEntry);
  checkOrderAndUnique(entries);
  const byQid = new Map<string, MappingEntry>();
  for (const e of entries) {
    if (e.qid === null) continue;
    const dup = byQid.get(e.qid);
    if (dup && !(dup.method === 'ledger' && e.method === 'ledger')) {
      throw new Error(`${label(e)}: qid ${e.qid} が ${label(dup)} と重なる`);
    }
    if (!dup || e.method === 'rule') byQid.set(e.qid, e);
  }
  return {
    schemaVersion: 1,
    issue: 301,
    note: raw.note as string,
    attribution: { wikidata: (raw.attribution as { wikidata: string }).wikidata },
    entries,
  };
}

const PHOTO_ENTRY_KEYS = ['idx', 'name', 'prefecture', 'qid', 'linkConfidence', 'files'] as const;
const PHOTO_FILE_KEYS = [
  'file',
  'width',
  'height',
  'mime',
  'sha1',
  'url',
  'descriptionUrl',
  'license',
  'licenseUrl',
  'artist',
  'artistHtml',
  'credit',
  'creditHtml',
  'attributionRequired',
  'copyrighted',
  'restrictions',
  'usageTerms',
] as const;

function nullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

function parsePhotoFile(raw: unknown, who: string): PhotoFile {
  if (!isObject(raw)) throw new Error(`${who}: files の要素がオブジェクトでない`);
  exactKeys(raw, PHOTO_FILE_KEYS, `${who}: files`);
  const f = raw as unknown as PhotoFile;
  const at = `${who}: ${String(f.file)}`;
  if (typeof f.file !== 'string' || f.file === '' || f.file.startsWith('File:')) {
    throw new Error(`${who}: file がファイル名（File: を付けない）でない`);
  }
  if (!isInt(f.width, 1) || !isInt(f.height, 1))
    throw new Error(`${at}: width / height が正の整数でない`);
  if (typeof f.mime !== 'string' || f.mime === '') throw new Error(`${at}: mime が無い`);
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
  for (const k of [
    'license',
    'licenseUrl',
    'artist',
    'artistHtml',
    'credit',
    'creditHtml',
    'usageTerms',
  ] as const) {
    if (!nullableString(f[k])) throw new Error(`${at}: ${k} が文字か null でない`);
  }
  for (const k of ['attributionRequired', 'copyrighted'] as const) {
    if (f[k] !== null && typeof f[k] !== 'boolean')
      throw new Error(`${at}: ${k} が真偽か null でない`);
  }
  if (typeof f.restrictions !== 'string') throw new Error(`${at}: restrictions が文字でない`);
  return Object.fromEntries(PHOTO_FILE_KEYS.map(k => [k, f[k]])) as unknown as PhotoFile;
}

function parsePhotoEntry(raw: unknown, i: number): PhotoEntry {
  if (!isObject(raw)) throw new Error(`entries[${i}] がオブジェクトでない`);
  const { name, prefecture } = checkNamePrefecture(raw, i);
  const who = label({ name, prefecture });
  exactKeys(raw, PHOTO_ENTRY_KEYS, who);
  const e = raw as unknown as PhotoEntry;
  if (!isInt(e.idx, 1)) throw new Error(`${who}: idx が 1 以上の整数でない`);
  if (typeof e.qid !== 'string' || !QID.test(e.qid))
    throw new Error(`${who}: qid の形が違う: ${String(e.qid)}`);
  if (e.linkConfidence !== 'high' && e.linkConfidence !== 'medium') {
    throw new Error(`${who}: linkConfidence が high / medium でない`);
  }
  if (!Array.isArray(e.files) || e.files.length === 0) throw new Error(`${who}: files が空`);
  const files = e.files.map(f => parsePhotoFile(f, who));
  if (new Set(files.map(f => f.file)).size !== files.length)
    throw new Error(`${who}: files が重なる`);
  return { idx: e.idx, name, prefecture, qid: e.qid, linkConfidence: e.linkConfidence, files };
}

/** 写真の候補の検査。mapping を渡すと、対応表と食い違わないか（qid・確かさ・p18）も見る */
export function parsePhotos(json: unknown, mapping?: Mapping): Photos {
  const raw = parseTop(json, 'commons', '写真の候補');
  const entries = (raw.entries as unknown[]).map(parsePhotoEntry);
  checkOrderAndUnique(entries);
  const byIdx = new Map(mapping?.entries.map(m => [m.idx, m]));
  const seenQid = new Map<string, PhotoEntry>();
  for (const e of entries) {
    const m = byIdx.get(e.idx);
    const dup = seenQid.get(e.qid);
    if (dup) {
      const dm = byIdx.get(dup.idx);
      if (!(m?.method === 'ledger' && dm?.method === 'ledger')) {
        throw new Error(`${label(e)}: qid ${e.qid} が ${label(dup)} と重なる`);
      }
    }
    seenQid.set(e.qid, e);
    if (!mapping) continue;
    if (!m || m.name !== e.name || m.prefecture !== e.prefecture) {
      throw new Error(`${label(e)}: 対応表に idx ${e.idx} の同じ寺社が無い`);
    }
    if (m.qid !== e.qid) throw new Error(`${label(e)}: qid ${e.qid} が対応表（${m.qid}）と違う`);
    if (m.confidence !== e.linkConfidence) {
      throw new Error(
        `${label(e)}: linkConfidence ${e.linkConfidence} が対応表（${m.confidence}）と違う`
      );
    }
    let last = -1;
    for (const f of e.files) {
      const at = m.p18.indexOf(f.file);
      if (at < 0) throw new Error(`${label(e)}: ${f.file} が対応表の p18 に無い`);
      if (at <= last) throw new Error(`${label(e)}: files が対応表の p18 の順でない`);
      last = at;
    }
  }
  return {
    schemaVersion: 1,
    issue: 301,
    note: raw.note as string,
    attribution: { commons: (raw.attribution as { commons: string }).commons },
    entries,
  };
}

/** 生成物の書き方（D-15）: 2字下げ・最後に改行1つ */
export function serializeJson(x: unknown): string {
  return JSON.stringify(x, null, 2) + '\n';
}

// --- D-17: 書き出しの検査 ---

const CHOICES = ['seed', 'wd', 'osm', 'custom'];
const REF: Record<string, RegExp | null> = {
  wd: /^Q\d+$/,
  osm: /^(node|way|relation)\/\d+$/,
  seed: null,
  custom: null,
};
const SAME_COORD = 1e-9;

/**
 * 書き出し（D-18）を確かめる。サーバー（選ぶたび・書き出すとき）と check-export で同じ関数。
 * 止めるときは寺社の名前と都道府県を含む文。最後に spot-coords の ownerItemToEntry と mergeEntries を当てる
 */
export function validateExport(
  json: unknown,
  rows: SeedRow[],
  ledger: Ledger
): { items: ExportItem[]; entries: LedgerEntry[] } {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isObject(raw) || !Array.isArray(raw.items)) throw new Error('書き出しに items の配列が無い');
  if (raw.count !== undefined && raw.count !== raw.items.length) {
    throw new Error(
      `書き出しの count ${String(raw.count)} が items の数 ${raw.items.length} と違う`
    );
  }
  const byIdx = new Map(rows.map(r => [r.idx, r]));
  const ledgerNames = new Set(ledger.entries.map(e => `${e.name}\u0000${e.prefecture}`));
  const ledgerIdx = new Set(ledger.entries.map(e => e.idx));
  let osm = ledger.entries.filter(e => e.source === 'osm').length;
  const ledgerOsm = osm;
  const seen = new Set<number>();
  const items: ExportItem[] = [];
  for (const [i, it] of (raw.items as unknown[]).entries()) {
    if (!isObject(it)) throw new Error(`items[${i}] がオブジェクトでない`);
    const name = String(it.name);
    const prefecture = String(it.prefecture);
    const who = `${name}（${prefecture}）`;
    const r = typeof it.idx === 'number' ? byIdx.get(it.idx) : undefined;
    if (!r) throw new Error(`${who}: idx ${String(it.idx)} の seed の行が無い`);
    if (r.name !== name || r.prefecture !== prefecture) {
      throw new Error(`${who}: idx ${r.idx} の seed の行（${label(r)}）と名前・都道府県が合わない`);
    }
    if (it.file !== r.file || it.line !== r.line) {
      throw new Error(
        `${who}: ファイルと行 ${String(it.file)}:${String(it.line)} が seed（${r.file}:${r.line}）と違う`
      );
    }
    const seed = it.seed;
    if (
      !isObject(seed) ||
      typeof seed.lat !== 'number' ||
      typeof seed.lng !== 'number' ||
      Math.abs(seed.lat - r.lat) >= SAME_COORD ||
      Math.abs(seed.lng - r.lng) >= SAME_COORD
    ) {
      throw new Error(`${who}: seed の座標が seed の行（${r.lat}, ${r.lng}）と違う`);
    }
    if (seen.has(r.idx)) throw new Error(`${who}: idx ${r.idx} が書き出しの中で重なる`);
    seen.add(r.idx);
    const choice = it.choice;
    if (choice === 'gsi') {
      throw new Error(`${who}: 国土地理院の点（gsi）は選べない（出典の表示が未決。#292 D-12）`);
    }
    if (typeof choice !== 'string' || !CHOICES.includes(choice)) {
      throw new Error(`${who}: 知らない choice: ${String(choice)}`);
    }
    if (choice !== 'seed') {
      if (typeof it.lat !== 'number' || typeof it.lng !== 'number') {
        throw new Error(`${who}: lat / lng が数でない`);
      }
      const to = { lat: it.lat, lng: it.lng };
      if (!inJapan(to)) throw new Error(`${who}: 選んだ点が日本の範囲の外`);
      const d = distanceMeters({ lat: r.lat, lng: r.lng }, to);
      if (!(d >= MIN_MOVE_M && d <= MAX_MOVE_M)) {
        throw new Error(
          `${who}: seed からの距離 ${Math.round(d)}m が ${MIN_MOVE_M}m〜${MAX_MOVE_M}m の外`
        );
      }
    }
    const rawRef = it.ref ?? null;
    const pattern = REF[choice];
    if (pattern === null ? rawRef !== null : typeof rawRef !== 'string' || !pattern.test(rawRef)) {
      throw new Error(`${who}: ${choice} の ref の形が違う: ${String(rawRef)}`);
    }
    const ref = rawRef as string | null;
    if (ledgerNames.has(`${name}\u0000${prefecture}`) || ledgerIdx.has(r.idx)) {
      throw new Error(`${who}: 台帳（第1弾）にもうある。第2弾では選べない`);
    }
    const note = it.note ?? null;
    if (note !== null && typeof note !== 'string') throw new Error(`${who}: note が文字でない`);
    if (note !== null && [...note].length > NOTE_MAX) {
      throw new Error(`${who}: メモが ${[...note].length} 文字（${NOTE_MAX} 文字まで）`);
    }
    if (note !== null && EMAIL.test(note)) {
      throw new Error(`${who}: メモにメールの形がある（公開の台帳に入るので書かない）`);
    }
    if (choice === 'osm') {
      osm++;
      if (osm > MAX_OSM_FEATURES) {
        throw new Error(
          `${who}: OSM 由来が 台帳 ${ledgerOsm} + 選んだ ${osm - ledgerOsm} = ${osm} 件になる。全部の弾で ${MAX_OSM_FEATURES} 件まで`
        );
      }
    }
    items.push({
      idx: r.idx,
      name,
      prefecture,
      file: r.file,
      line: r.line,
      verdict: typeof it.verdict === 'string' ? it.verdict : '',
      seed: { lat: seed.lat, lng: seed.lng },
      choice,
      lat: typeof it.lat === 'number' ? it.lat : null,
      lng: typeof it.lng === 'number' ? it.lng : null,
      ref,
      note,
      chosen_at: typeof it.chosen_at === 'string' ? it.chosen_at : '',
    });
  }
  const entries = items
    .map(item => ownerItemToEntry(item as OwnerItem, 2))
    .filter((e): e is LedgerEntry => e !== null);
  if (entries.length > 0) mergeEntries(ledger, entries);
  return { items, entries };
}
