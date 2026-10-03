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
  // アプリが Linking.openURL で開く。http(s) のほか（javascript: など）は入れない
  if (e.licenseUrl !== null && !/^https?:\/\//.test(e.licenseUrl)) {
    throw new Error(`${who}: licenseUrl が http(s) の URL でない: ${e.licenseUrl}`);
  }
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

// --- D-7: 選ぶ画面の1件（choices.json） ---

/** 外した理由（人が大きく写る・別の寺社や場所・寺社が写っていない・暗い/ぼけ/傾き・そのほか） */
export const REJECT_REASONS = ['person', 'other-place', 'not-spot', 'quality', 'other'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type Choice =
  | { idx: number; decision: 'approve'; file: string; focusY: number; linkChecked: boolean }
  | { idx: number; decision: 'reject'; reason: RejectReason };

const CHOICE_KEYS = ['idx', 'decision', 'file', 'focusY', 'linkChecked', 'reason'];

/**
 * 選ぶ画面から届いた1件を確かめる（サーバーが保存する前と export）。others は保存してある分で、
 * 同じ idx の行は置き換えるので見ない。だめなら寺社の名前を含む文で止める
 */
export function parseChoice(body: unknown, candidates: Candidates, others: Choice[]): Choice {
  if (!isObject(body)) throw new Error('選んだ1件がオブジェクトでない');
  const entry = candidates.entries.find(e => e.idx === body.idx);
  if (!entry) throw new Error(`idx ${String(body.idx)} は候補の寺社ではない`);
  const who = label(entry);
  const extra = Object.keys(body).filter(k => !CHOICE_KEYS.includes(k));
  if (extra.length > 0) throw new Error(`${who}: 知らないキー ${extra.join(', ')}`);

  if (body.decision === 'reject') {
    if (!REJECT_REASONS.includes(body.reason as RejectReason)) {
      throw new Error(
        `${who}: 外す理由が ${REJECT_REASONS.join(' / ')} のどれでもない: ${String(body.reason)}`
      );
    }
    return { idx: entry.idx, decision: 'reject', reason: body.reason as RejectReason };
  }
  if (body.decision !== 'approve') {
    throw new Error(`${who}: decision が approve / reject でない: ${String(body.decision)}`);
  }
  const file = entry.files.find(f => f.file === body.file);
  if (!file) throw new Error(`${who}: ${String(body.file)} はこの寺社の候補のファイルではない`);
  if (!isFocusY(body.focusY)) {
    throw new Error(`${who}: focusY が 0〜1 で小数2桁までの数でない: ${String(body.focusY)}`);
  }
  if (body.linkChecked !== undefined && typeof body.linkChecked !== 'boolean') {
    throw new Error(`${who}: linkChecked が真偽でない`);
  }
  const linkChecked = body.linkChecked === true;
  if (entry.linkConfidence === 'medium' && !linkChecked) {
    throw new Error(
      `${who}: 結びつきが「中」なので、Wikidata の項目がこの寺社だと確かめてから採る`
    );
  }
  for (const o of others) {
    if (o.idx === entry.idx || o.decision !== 'approve') continue;
    const other = candidates.entries.find(e => e.idx === o.idx);
    const sha1 = other?.files.find(f => f.file === o.file)?.sha1;
    if (other && sha1 === file.sha1) {
      throw new Error(`${who}: このファイルは ${label(other)} で採っている（1 ファイル 1 寺社）`);
    }
  }
  return { idx: entry.idx, decision: 'approve', file: file.file, focusY: body.focusY, linkChecked };
}

/** choices.json の全部を確かめる（idx の順・1 idx 1 行）。だめなら寺社の名前で止める */
export function parseChoices(json: unknown, candidates: Candidates): Choice[] {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isObject(raw) || !Array.isArray(raw.choices))
    throw new Error('choices.json に choices が無い');
  const out: Choice[] = [];
  for (const c of raw.choices) {
    if (isObject(c) && out.some(o => o.idx === c.idx)) {
      throw new Error(`idx ${String(c.idx)} が choices.json に2行ある`);
    }
    out.push(parseChoice(c, candidates, out));
  }
  return out.sort((a, b) => a.idx - b.idx);
}

/** 1 回目の承認の弾 */
export const BATCH = 1;

/** 採った寺社だけを台帳にする（(batch, idx) の順）。#301 の値をそのまま写し、parseLedger302 を通す */
export function buildLedger(choices: Choice[], photos: Photos, rows: SeedRow[]): Ledger302 {
  const byIdx = new Map(photos.entries.map(p => [p.idx, p]));
  const entries: LedgerEntry302[] = [];
  for (const c of [...choices].sort((a, b) => a.idx - b.idx)) {
    if (c.decision !== 'approve') continue;
    const p = byIdx.get(c.idx);
    const f = p?.files.find(x => x.file === c.file);
    if (!p || !f) throw new Error(`idx ${c.idx}: #301 の写真の候補に ${c.file} が無い`);
    entries.push({
      batch: BATCH,
      idx: p.idx,
      name: p.name,
      prefecture: p.prefecture,
      qid: p.qid,
      linkConfidence: p.linkConfidence,
      linkChecked: c.linkChecked,
      file: f.file,
      sha1: f.sha1,
      r2Key: r2KeyOf(f),
      width: f.width,
      height: f.height,
      focusY: c.focusY,
      author: f.artist,
      license: f.license as string,
      licenseUrl: f.licenseUrl,
      sourceUrl: f.descriptionUrl,
      isCropped: true,
      status: 'approved',
    });
  }
  const ledger: Ledger302 = {
    schemaVersion: 1,
    issue: 302,
    note: LEDGER_NOTE,
    attribution: LEDGER_ATTRIBUTION,
    entries,
  };
  return parseLedger302(ledger, photos, rows);
}

// --- D-19: 本番の SQL（台帳から作る生成物） ---

const SQL_TAG = 'spot_photos_302 batch1';

/** jsonb の1行（表の列の名前で） */
function photoRow(e: LedgerEntry302): string {
  return JSON.stringify({
    name: e.name,
    prefecture: e.prefecture,
    r2_key: e.r2Key,
    width: e.width,
    height: e.height,
    focus_y: e.focusY,
    author: e.author,
    license: e.license,
    license_url: e.licenseUrl,
    source_url: e.sourceUrl,
    is_cropped: e.isCropped,
    status: e.status,
  });
}

/**
 * SQL のドル引用（$photos$ と、外側の $spot_photos_302$ など）の中に埋める jsonb の行。
 * 撮影者・ライセンス・URL は Commons の誰でも直せる値なので、$ を1つも残さない:
 * JSON の文字の中の $ を \u0024 にする（jsonb が読むときに $ に戻るので、中身は変わらない）
 */
function photoRows(entries: LedgerEntry302[]): string {
  const text = entries.map(photoRow).join(',\n').replaceAll('$', '\\u0024');
  if (text.includes('$')) throw new Error('台帳の行の $ を消せない（SQL に埋められない）');
  return text;
}

const RECORD_COLUMNS =
  'x(name text, prefecture text, r2_key text, width int, height int, focus_y real, author text, license text, license_url text, source_url text, is_cropped boolean, status text)';

const SAME_SPOT =
  's.name = f.name AND s.prefecture = f.prefecture AND s.created_by_user_id IS NULL';

/**
 * 台帳の全部の行を spot_photos に入れる migration（DO ブロック1つ）。1件ずつ「名前・都道府県・作成者なし」で
 * ちょうど1行の寺社に絞り（0 行・2 行以上なら例外で全体を止める）、spot_id で upsert する
 */
export function buildMigrationSql(entries: LedgerEntry302[]): string {
  if (entries.length === 0) throw new Error('台帳に行が無い');
  return `-- Issue #302 第1弾: 地図のピンのシートの帯に出す寺社の写真 ${entries.length} 件を spot_photos に入れる。
-- 生成物。手で直さない。台帳 supabase/data/spot-photos-302.json から次で作る:
--   deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts generate
-- 1件ずつ「名前・都道府県・作成者なし」でちょうど1行の寺社に絞り（0 行・2 行以上なら例外で全体を止める）、
-- spot_id で upsert する（何度流しても同じ中身）。マスタの寺社が1件も無い DB（seed を入れる前）では何もしない。
DO $spot_photos_302$
DECLARE
  photos CONSTANT jsonb := $photos$[
${photoRows(entries)}
]$photos$;
  f record;
  n int;
  sid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.spots WHERE created_by_user_id IS NULL) THEN
    RAISE NOTICE '${SQL_TAG}: マスタの寺社が無いので何もしない';
    RETURN;
  END IF;

  FOR f IN SELECT * FROM jsonb_to_recordset(photos) AS ${RECORD_COLUMNS}
  LOOP
    SELECT count(*), min(s.id::text)::uuid INTO n, sid
      FROM public.spots s
     WHERE ${SAME_SPOT};
    IF n <> 1 THEN
      RAISE EXCEPTION '${SQL_TAG}: %（%）: 名前と都道府県で % 行（1 行のはず）', f.name, f.prefecture, n;
    END IF;
    INSERT INTO public.spot_photos
      (spot_id, r2_key, width, height, focus_y, author, license, license_url, source_url, is_cropped, status)
    VALUES
      (sid, f.r2_key, f.width, f.height, f.focus_y, f.author, f.license, f.license_url, f.source_url, f.is_cropped, f.status)
    ON CONFLICT (spot_id) DO UPDATE SET
      r2_key = EXCLUDED.r2_key,
      width = EXCLUDED.width,
      height = EXCLUDED.height,
      focus_y = EXCLUDED.focus_y,
      author = EXCLUDED.author,
      license = EXCLUDED.license,
      license_url = EXCLUDED.license_url,
      source_url = EXCLUDED.source_url,
      is_cropped = EXCLUDED.is_cropped,
      status = EXCLUDED.status;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION '${SQL_TAG}: %（%）: 入ったのが % 行（1 行のはず）', f.name, f.prefecture, n;
    END IF;
  END LOOP;
END
$spot_photos_302$;
`;
}

export const CHECK_KEYS = [
  'table',
  'rls',
  'total',
  'listed',
  'not_one',
  'present',
  'differ',
  'missing',
  'extra',
  'anon_select',
  'anon_insert',
] as const;

export function checkResultLine(v: Record<(typeof CHECK_KEYS)[number], string | number>): string {
  return `RESULT ${CHECK_KEYS.map(k => `${k}=${v[k]}`).join(' ')}`;
}

/** 本番の spot_photos が台帳と合うかを読むだけの SQL。最後に RAISE EXCEPTION 'RESULT …' で全部戻す */
export function buildCheckSql(ledger: Ledger302, seedRowCount: number): string {
  const entries = ledger.entries;
  const listed = entries.filter(e => e.status === 'approved').length;
  const n = entries.length;
  const base = {
    table: 'present',
    rls: 'on',
    total: seedRowCount,
    listed,
    not_one: 0,
    extra: 0,
    anon_insert: 'denied',
  };
  const before = checkResultLine({ ...base, present: 0, differ: 0, missing: n, anon_select: 0 });
  const after = checkResultLine({
    ...base,
    present: n,
    differ: 0,
    missing: 0,
    anon_select: listed,
  });
  const format = CHECK_KEYS.filter(k => k !== 'table')
    .map(k => `${k}=%`)
    .join(' ');
  return `-- ============================================================
-- 帯の写真: 本番の spot_photos が台帳と合うか（Issue #302 / H-7・H-10・H-13）
--
-- 実行: supabase db query --linked -f supabase/validation/spot_photos_302_check.sql
--
-- ⚠ 必ずエラーで終わる。それで正しい。最後に RAISE EXCEPTION して、何も残さない（読むだけ）。
--   期待値:
--   H-7（表を作る前）: RESULT table=absent
--   H-10（表を作ったあと・中身を入れる前）: ${before}
--   H-13（中身を入れたあと）: ${after}
--
-- table       = 表 public.spot_photos があるか（absent ならほかは出さない）
-- rls         = 表の RLS が有効なら on
-- total       = 作成者なし（created_by_user_id IS NULL）の spots の数（期待値は seed の寺社の行の数）
-- listed      = 台帳の status: approved の件数
-- not_one     = 台帳の行のうち、名前・都道府県・作成者なしで 0 行か 2 行以上だった件数
-- present     = 1 行に絞れて、その寺社の写真の行があり、全部の列が台帳と同じ件数
-- differ      = 1 行に絞れて、行はあるが列が台帳と違う件数
-- missing     = 1 行に絞れて、行が無い件数
-- extra       = spot_photos の行のうち、台帳のどの寺社でもない件数
-- anon_select = anon のロールで数えた行の数（承認済みだけが見える）
-- anon_insert = anon のロールで1行入れようとして断られたら denied（下のサブブロックで試し、最後の例外で戻す）
--
-- 生成物。手で直さない。台帳 supabase/data/spot-photos-302.json から
-- supabase/scripts/spot-photos/main.ts generate で作る
-- ============================================================

DO $spot_photos_302_check$
DECLARE
  photos CONSTANT jsonb := $photos$[
${photoRows(entries)}
]$photos$;
  f record;
  n int;
  sid uuid;
  matched uuid[] := '{}';
  any_spot uuid;
  rls text;
  total int;
  listed int := 0;
  not_one int := 0;
  present int := 0;
  differ int := 0;
  missing int := 0;
  extra int;
  anon_select int;
  anon_insert text := 'allowed';
BEGIN
  IF to_regclass('public.spot_photos') IS NULL THEN
    RAISE EXCEPTION 'RESULT table=absent';
  END IF;

  SELECT CASE WHEN c.relrowsecurity THEN 'on' ELSE 'off' END INTO rls
    FROM pg_class c WHERE c.oid = 'public.spot_photos'::regclass;
  SELECT count(*) INTO total FROM public.spots WHERE created_by_user_id IS NULL;

  FOR f IN SELECT * FROM jsonb_to_recordset(photos) AS ${RECORD_COLUMNS}
  LOOP
    IF f.status = 'approved' THEN
      listed := listed + 1;
    END IF;
    SELECT count(*), min(s.id::text)::uuid INTO n, sid
      FROM public.spots s
     WHERE ${SAME_SPOT};
    IF n <> 1 THEN
      not_one := not_one + 1;
      CONTINUE;
    END IF;
    matched := matched || sid;
    IF NOT EXISTS (SELECT 1 FROM public.spot_photos p WHERE p.spot_id = sid) THEN
      missing := missing + 1;
    ELSIF EXISTS (
      SELECT 1 FROM public.spot_photos p
       WHERE p.spot_id = sid
         AND p.r2_key = f.r2_key
         AND p.width = f.width
         AND p.height = f.height
         AND p.focus_y = f.focus_y
         AND p.author IS NOT DISTINCT FROM f.author
         AND p.license = f.license
         AND p.license_url IS NOT DISTINCT FROM f.license_url
         AND p.source_url = f.source_url
         AND p.is_cropped = f.is_cropped
         AND p.status = f.status
    ) THEN
      present := present + 1;
    ELSE
      differ := differ + 1;
    END IF;
  END LOOP;

  SELECT count(*) INTO extra FROM public.spot_photos p WHERE NOT (p.spot_id = ANY (matched));
  SELECT s.id INTO any_spot FROM public.spots s ORDER BY s.id LIMIT 1;

  -- ここから anon のロール（このトランザクションの間だけ）
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO anon_select FROM public.spot_photos;
  BEGIN
    INSERT INTO public.spot_photos (spot_id, r2_key, width, height, focus_y, license, source_url)
    VALUES (coalesce(any_spot, gen_random_uuid()), 'spot-photos/' || repeat('0', 40) || '.jpg',
            1, 1, 0.5, 'check', 'https://commons.wikimedia.org/wiki/File:check.jpg');
  EXCEPTION WHEN insufficient_privilege THEN
    anon_insert := 'denied';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'RESULT table=present ${format}',
    rls, total, listed, not_one, present, differ, missing, extra, anon_select, anon_insert;
END
$spot_photos_302_check$;
`;
}
