// 帯の写真（Issue #302）。候補の規則・台帳の形を決める純関数（ネット・ファイルに出ない）。
// CLI は main.ts、選ぶ画面のサーバーは server.ts、Commons と R2 は fetchers.ts。
// 契約書: docs/issues/issue-302-spot-photo-band.md（D-3〜D-9・D-19）
import type { Mapping, PhotoFile, Photos, SeedRow } from '../spot-wikidata/match.ts';

// --- 定数（値を変えるのはリーダーの判断。契約書の表とテストと README を一緒に直す） ---

/** D-5 ② 候補にする写真の幅の下限（縮小版 1280 を作れる） */
export const PHOTO_MIN_WIDTH = 1280;
/** D-9 R2 に置く縮小版の幅（Commons の iiurlwidth） */
export const PHOTO_STORE_WIDTH = 1280;
/** R2 のキーの頭 */
export const R2_PREFIX = 'spot-photos/';
/** 縮小版を取る間（ms）。API は1度に1つ */
export const COMMONS_INTERVAL_MS = 1000;

export const LEDGER_PATH = 'supabase/data/spot-photos-302.json';
export const MIGRATION_PATH = 'supabase/migrations/20261004010000_spot_photos_302_batch1.sql';
export const CHECK_SQL_PATH = 'supabase/validation/spot_photos_302_check.sql';

export const LEDGER_NOTE =
  '帯に出す寺社の写真（承認したものだけ）。supabase/scripts/spot-photos/main.ts export で作る。本番の SQL はここから generate で作る。手で直さない';
export const LEDGER_ATTRIBUTION = {
  commons:
    'Wikimedia Commons。撮影者とライセンスは行ごと（author・license・licenseUrl・sourceUrl）',
};

const MIMES: readonly string[] = ['image/jpeg', 'image/png'];

// --- 型 ---

/** 選ぶ画面のカードの1ファイル */
export interface CandidateFile {
  file: string;
  sha1: string;
  mime: string;
  width: number;
  height: number;
  /** ブラウザが直接読む Commons の縮小版（幅 1280。元が 1280 以下なら元のファイル） */
  thumbUrl: string;
  /** 帯で出す撮影者（Commons の表示のまま。null は Public domain・CC0） */
  author: string | null;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
}

/** 選ぶ画面のカードの1寺社 */
export interface Candidate {
  idx: number;
  name: string;
  prefecture: string;
  /** seed の住所 */
  address: string;
  qid: string;
  /** 対応表の Wikidata のラベル */
  label: string | null;
  linkConfidence: 'high' | 'medium';
  files: CandidateFile[];
}

export interface Candidates {
  schemaVersion: 1;
  issue: 302;
  counts: { spots: number; files: number; high: number; medium: number };
  entries: Candidate[];
}

export interface LedgerEntry302 {
  batch: number;
  idx: number;
  name: string;
  prefecture: string;
  qid: string;
  linkConfidence: 'high' | 'medium';
  linkChecked: boolean;
  file: string;
  sha1: string;
  r2Key: string;
  width: number;
  height: number;
  focusY: number;
  author: string | null;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
  isCropped: boolean;
  status: 'approved' | 'withdrawn';
}

export interface Ledger302 {
  schemaVersion: 1;
  issue: 302;
  note: string;
  attribution: { commons: string };
  entries: LedgerEntry302[];
}

// --- 小さな道具 ---

export function label(e: { name: string; prefecture: string }): string {
  return `${e.name}（${e.prefecture}）`;
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

/** 0〜1 で小数2桁まで（focus_y） */
export function isFocusY(v: unknown): v is number {
  return (
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 && Number(v.toFixed(2)) === v
  );
}

// --- D-5: 候補の規則 ---

/**
 * 候補にするファイル: ① 横長 ② 幅 1280 以上 ③ ライセンスがあり GFDL で始まらない
 * ④ restrictions が空 ⑤ JPEG か PNG ⑥ 撮影者が無いなら、帰属の表示が要らないもの
 */
export function screenFile(f: PhotoFile): boolean {
  return (
    f.width > f.height &&
    f.width >= PHOTO_MIN_WIDTH &&
    f.license !== null &&
    !f.license.startsWith('GFDL') &&
    f.restrictions === '' &&
    MIMES.includes(f.mime) &&
    (f.artist !== null && f.artist !== '' ? true : f.attributionRequired === false)
  );
}

// --- D-9: 縮小版の URL・R2 のキー ---

const UPLOAD =
  /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/;

/** Commons の元のファイルの URL → 幅 width の縮小版の URL（名前は URL のまま2か所に入れる） */
export function commonsThumbUrl(url: string, width: number): string {
  const m = url.match(UPLOAD);
  if (!m) throw new Error(`Commons の元のファイルの URL ではない: ${url}`);
  const [, base, a, ab, name] = m;
  return `${base}/thumb/${a}/${ab}/${name}/${width}px-${name}`;
}

/** R2 のキー。PNG は .png、ほかは .jpg */
export function r2KeyOf(f: { sha1: string; mime: string }): string {
  return `${R2_PREFIX}${f.sha1}.${f.mime === 'image/png' ? 'png' : 'jpg'}`;
}

// --- D-5・D-7: 候補（選ぶ画面のデータ） ---

function seedRowOf(
  rows: Map<number, SeedRow>,
  e: { idx: number; name: string; prefecture: string }
): SeedRow {
  const row = rows.get(e.idx);
  if (!row) throw new Error(`${label(e)}: seed に idx ${e.idx} の行が無い`);
  if (row.name !== e.name || row.prefecture !== e.prefecture) {
    throw new Error(`${label(e)}: seed の idx ${e.idx} は ${label(row)}`);
  }
  return row;
}

function candidateFile(f: PhotoFile): CandidateFile {
  return {
    file: f.file,
    sha1: f.sha1,
    mime: f.mime,
    width: f.width,
    height: f.height,
    thumbUrl: f.width > PHOTO_STORE_WIDTH ? commonsThumbUrl(f.url, PHOTO_STORE_WIDTH) : f.url,
    author: f.artist,
    license: f.license as string,
    licenseUrl: f.licenseUrl,
    sourceUrl: f.descriptionUrl,
  };
}

/** #301 の写真の候補から、規則を通るファイルが1つ以上ある寺社だけ（idx の順） */
export function buildCandidates(photos: Photos, mapping: Mapping, rows: SeedRow[]): Candidates {
  const seed = new Map(rows.map(r => [r.idx, r]));
  const byIdx = new Map(mapping.entries.map(m => [m.idx, m]));
  const entries: Candidate[] = [];
  for (const e of [...photos.entries].sort((a, b) => a.idx - b.idx)) {
    const files = e.files.filter(screenFile).map(candidateFile);
    if (files.length === 0) continue;
    const row = seedRowOf(seed, e);
    const m = byIdx.get(e.idx);
    if (!m || m.name !== e.name || m.prefecture !== e.prefecture) {
      throw new Error(`${label(e)}: 対応表に idx ${e.idx} の同じ寺社が無い`);
    }
    entries.push({
      idx: e.idx,
      name: e.name,
      prefecture: e.prefecture,
      address: row.address,
      qid: e.qid,
      label: m.label,
      linkConfidence: e.linkConfidence,
      files,
    });
  }
  return {
    schemaVersion: 1,
    issue: 302,
    counts: {
      spots: entries.length,
      files: entries.reduce((n, e) => n + e.files.length, 0),
      high: entries.filter(e => e.linkConfidence === 'high').length,
      medium: entries.filter(e => e.linkConfidence === 'medium').length,
    },
    entries,
  };
}

// --- D-8: 台帳 ---

export const LEDGER_KEYS = [
  'batch',
  'idx',
  'name',
  'prefecture',
  'qid',
  'linkConfidence',
  'linkChecked',
  'file',
  'sha1',
  'r2Key',
  'width',
  'height',
  'focusY',
  'author',
  'license',
  'licenseUrl',
  'sourceUrl',
  'isCropped',
  'status',
] as const;

const TOP_KEYS = ['schemaVersion', 'issue', 'note', 'attribution', 'entries'] as const;

function nullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

function parseEntry(raw: unknown, i: number): LedgerEntry302 {
  if (!isObject(raw)) throw new Error(`entries[${i}] がオブジェクトでない`);
  if (typeof raw.name !== 'string' || typeof raw.prefecture !== 'string') {
    throw new Error(`entries[${i}]: name / prefecture が文字でない`);
  }
  const who = label({ name: raw.name, prefecture: raw.prefecture });
  exactKeys(raw, LEDGER_KEYS, who);
  const e = raw as unknown as LedgerEntry302;
  if (!isInt(e.batch, 1)) throw new Error(`${who}: batch が 1 以上の整数でない`);
  if (!isInt(e.idx, 1)) throw new Error(`${who}: idx が 1 以上の整数でない`);
  if (typeof e.qid !== 'string' || !/^Q\d+$/.test(e.qid)) throw new Error(`${who}: qid の形が違う`);
  if (e.linkConfidence !== 'high' && e.linkConfidence !== 'medium') {
    throw new Error(`${who}: linkConfidence が high / medium でない`);
  }
  if (typeof e.linkChecked !== 'boolean') throw new Error(`${who}: linkChecked が真偽でない`);
  if (typeof e.file !== 'string' || e.file === '') throw new Error(`${who}: file が無い`);
  if (typeof e.sha1 !== 'string' || !/^[0-9a-f]{40}$/.test(e.sha1)) {
    throw new Error(`${who}: sha1 の形が違う`);
  }
  if (typeof e.r2Key !== 'string') throw new Error(`${who}: r2Key が文字でない`);
  if (!isInt(e.width, 1) || !isInt(e.height, 1)) {
    throw new Error(`${who}: width / height が正の整数でない`);
  }
  if (!isFocusY(e.focusY)) {
    throw new Error(`${who}: focusY が 0〜1 で小数2桁までの数でない: ${String(e.focusY)}`);
  }
  if (!nullableString(e.author)) throw new Error(`${who}: author が文字か null でない`);
  if (typeof e.license !== 'string' || e.license === '') throw new Error(`${who}: license が無い`);
  if (!nullableString(e.licenseUrl)) throw new Error(`${who}: licenseUrl が文字か null でない`);
  if (typeof e.sourceUrl !== 'string') throw new Error(`${who}: sourceUrl が文字でない`);
  if (typeof e.isCropped !== 'boolean') throw new Error(`${who}: isCropped が真偽でない`);
  if (e.status !== 'approved' && e.status !== 'withdrawn') {
    throw new Error(`${who}: status が approved / withdrawn でない`);
  }
  return Object.fromEntries(LEDGER_KEYS.map(k => [k, e[k]])) as unknown as LedgerEntry302;
}

/** 台帳の行が #301 のファイル（承認したときの Commons の値）と同じか */
function checkAgainst301(e: LedgerEntry302, photos: Map<number, Photos['entries'][number]>): void {
  const who = label(e);
  const p = photos.get(e.idx);
  if (!p || p.name !== e.name || p.prefecture !== e.prefecture) {
    throw new Error(`${who}: #301 の写真の候補に idx ${e.idx} の同じ寺社が無い`);
  }
  if (p.qid !== e.qid) throw new Error(`${who}: qid ${e.qid} が #301（${p.qid}）と違う`);
  if (p.linkConfidence !== e.linkConfidence) {
    throw new Error(
      `${who}: linkConfidence ${e.linkConfidence} が #301（${p.linkConfidence}）と違う`
    );
  }
  const f = p.files.find(x => x.file === e.file);
  if (!f) throw new Error(`${who}: ${e.file} が #301 の写真の候補に無い`);
  const expected: Partial<Record<keyof LedgerEntry302, unknown>> = {
    sha1: f.sha1,
    width: f.width,
    height: f.height,
    author: f.artist,
    license: f.license,
    licenseUrl: f.licenseUrl,
    sourceUrl: f.descriptionUrl,
  };
  for (const [k, v] of Object.entries(expected)) {
    if (e[k as keyof LedgerEntry302] !== v) {
      throw new Error(
        `${who}: ${k} が #301 と違う（台帳 ${JSON.stringify(e[k as keyof LedgerEntry302])}・#301 ${JSON.stringify(v)}）`
      );
    }
  }
  if (!screenFile(f)) throw new Error(`${who}: ${e.file} は候補の規則（D-5）を通らない`);
  if (e.r2Key !== r2KeyOf(f)) throw new Error(`${who}: r2Key が ${r2KeyOf(f)} でない: ${e.r2Key}`);
}

/**
 * 公開の台帳の検査（JSON の文字でも、読んだ値でもよい）。決めたキーのほかがある・#301 と合わない・
 * 規則を通らない・重なる・順でない、のどれでも寺社の名前を含む文で止める
 */
export function parseLedger302(json: unknown, photos: Photos, rows: SeedRow[]): Ledger302 {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isObject(raw)) throw new Error('台帳がオブジェクトでない');
  exactKeys(raw, TOP_KEYS, '台帳');
  if (raw.schemaVersion !== 1) throw new Error('台帳: schemaVersion が 1 でない');
  if (raw.issue !== 302) throw new Error('台帳: issue が 302 でない');
  if (typeof raw.note !== 'string') throw new Error('台帳: note が文字でない');
  if (!isObject(raw.attribution) || typeof raw.attribution.commons !== 'string') {
    throw new Error('台帳: attribution.commons が無い');
  }
  exactKeys(raw.attribution, ['commons'], '台帳: attribution');
  if (!Array.isArray(raw.entries)) throw new Error('台帳: entries が配列でない');

  const seed = new Map(rows.map(r => [r.idx, r]));
  const byIdx = new Map(photos.entries.map(p => [p.idx, p]));
  const entries = raw.entries.map(parseEntry);
  const seenIdx = new Map<number, LedgerEntry302>();
  const seenName = new Map<string, LedgerEntry302>();
  const seenSha1 = new Map<string, LedgerEntry302>();
  let last: LedgerEntry302 | null = null;
  for (const e of entries) {
    const who = label(e);
    seedRowOf(seed, e);
    const dupIdx = seenIdx.get(e.idx);
    if (dupIdx) throw new Error(`${who}: idx ${e.idx} が2行ある`);
    const dupName = seenName.get(who);
    if (dupName) throw new Error(`${who}: 同じ名前・都道府県が2行ある`);
    const dupSha1 = seenSha1.get(e.sha1);
    if (dupSha1) throw new Error(`${who}: sha1 が ${label(dupSha1)} と重なる（1 ファイル 1 寺社）`);
    if (last && (e.batch < last.batch || (e.batch === last.batch && e.idx < last.idx))) {
      throw new Error(`${who}: (batch, idx) の順でない（前は ${label(last)}）`);
    }
    checkAgainst301(e, byIdx);
    if (e.linkConfidence === 'medium' && e.linkChecked !== true) {
      throw new Error(`${who}: 結びつきが medium なのに linkChecked が true でない`);
    }
    seenIdx.set(e.idx, e);
    seenName.set(who, e);
    seenSha1.set(e.sha1, e);
    last = e;
  }
  return {
    schemaVersion: 1,
    issue: 302,
    note: raw.note,
    attribution: { commons: raw.attribution.commons },
    entries,
  };
}
