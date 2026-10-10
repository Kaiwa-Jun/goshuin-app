// slug の台帳（site/data/spot-slugs.json）。寺社のページの URL（/spots/<slug>/）を決める。
// 一度決めた slug は変えない・使い回さない。新しい寺社は main.ts slugs で末尾に足す。
// 契約書: docs/issues/issue-324-homepage.md D-23・AC-2・AC-3
import type { SeedRow } from '../supabase/scripts/spot-wikidata/match.ts';
import { prefectureByName } from './prefectures.ts';

export const SLUGS_PATH = 'site/data/spot-slugs.json';
export const SLUGS_NOTE =
  '寺社のページの URL（/spots/<slug>/）の台帳。一度決めた slug は変えない・使い回さない。新しい寺社は site/main.ts slugs で足す。seed で名前が変わったら name を手で直す';

export interface SlugEntry {
  name: string;
  prefecture: string;
  slug: string;
}

export interface SlugLedger {
  schemaVersion: 1;
  issue: 324;
  note: string;
  entries: SlugEntry[];
}

const SLUG = /^[a-z]+-\d{3}$/;
const ENTRY_KEYS = ['name', 'prefecture', 'slug'];

function label(e: { name: string; prefecture: string }): string {
  return `${e.name}（${e.prefecture}）`;
}

function key(e: { name: string; prefecture: string }): string {
  return `${e.name}\t${e.prefecture}`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 台帳の検査（形・slug の形と県のローマ字・slug と (name, prefecture) の重なり） */
export function parseSlugLedger(text: string): SlugLedger {
  const raw: unknown = JSON.parse(text);
  if (!isObject(raw)) throw new Error(`${SLUGS_PATH}: オブジェクトでない`);
  if (raw.schemaVersion !== 1 || raw.issue !== 324) {
    throw new Error(`${SLUGS_PATH}: schemaVersion が 1・issue が 324 でない`);
  }
  if (typeof raw.note !== 'string') throw new Error(`${SLUGS_PATH}: note が文字でない`);
  if (!Array.isArray(raw.entries)) throw new Error(`${SLUGS_PATH}: entries が配列でない`);
  const bySlug = new Map<string, SlugEntry>();
  const byKey = new Map<string, SlugEntry>();
  const entries = raw.entries.map((e: unknown, i: number): SlugEntry => {
    if (!isObject(e)) throw new Error(`${SLUGS_PATH}: entries[${i}] がオブジェクトでない`);
    const keys = Object.keys(e);
    if (keys.length !== ENTRY_KEYS.length || !ENTRY_KEYS.every(k => keys.includes(k))) {
      throw new Error(`${SLUGS_PATH}: entries[${i}] のキーが name・prefecture・slug でない`);
    }
    const { name, prefecture, slug } = e;
    if (typeof name !== 'string' || name === '' || typeof prefecture !== 'string') {
      throw new Error(`${SLUGS_PATH}: entries[${i}] の name・prefecture が文字でない`);
    }
    const who = label({ name, prefecture });
    const pref = prefectureByName(prefecture);
    if (!pref) throw new Error(`${who}: 知らない都道府県`);
    if (typeof slug !== 'string' || !SLUG.test(slug)) {
      throw new Error(`${who}: slug の形が違う（^[a-z]+-\\d{3}$）: ${String(slug)}`);
    }
    if (slug.slice(0, slug.lastIndexOf('-')) !== pref.slug) {
      throw new Error(`${who}: slug ${slug} の前半が ${pref.slug} でない`);
    }
    const entry = { name, prefecture, slug };
    const dupSlug = bySlug.get(slug);
    if (dupSlug) throw new Error(`${who}: slug ${slug} が ${label(dupSlug)} と重なる`);
    const dupKey = byKey.get(key(entry));
    if (dupKey) throw new Error(`${who}: 台帳に2行ある（${dupKey.slug}・${slug}）`);
    bySlug.set(slug, entry);
    byKey.set(key(entry), entry);
    return entry;
  });
  return { schemaVersion: 1, issue: 324, note: raw.note, entries };
}

/** seed の寺社（idx）→ slug。台帳に無い寺社・台帳だけにある行があれば名前を並べて止まる */
export function matchSlugs(ledger: SlugLedger, rows: SeedRow[]): Map<number, string> {
  const byKey = new Map(ledger.entries.map(e => [key(e), e]));
  const missing = rows.filter(r => !byKey.has(key(r)));
  const seen = new Set(rows.map(key));
  const extra = ledger.entries.filter(e => !seen.has(key(e)));
  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(
      `slug の台帳に無い寺社が ${missing.length}（site/main.ts slugs で足す）: ${missing.map(label).join('・')}`
    );
  }
  if (extra.length > 0) {
    problems.push(
      `seed に無い台帳の行が ${extra.length}（seed で名前が変わったなら台帳の name を手で直す）: ${extra.map(label).join('・')}`
    );
  }
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return new Map(rows.map(r => [r.idx, byKey.get(key(r))!.slug]));
}

/**
 * 台帳に無い seed の寺社に slug を振る（seed の順）。番号はその都道府県のいちばん大きい番号の次から。
 * 台帳が無ければ（null）全部を 001 から振る
 */
export function missingSlugEntries(ledger: SlugLedger | null, rows: SeedRow[]): SlugEntry[] {
  const have = new Set((ledger?.entries ?? []).map(key));
  const max = new Map<string, number>();
  for (const e of ledger?.entries ?? []) {
    const pref = e.slug.slice(0, e.slug.lastIndexOf('-'));
    const n = Number(e.slug.slice(e.slug.lastIndexOf('-') + 1));
    max.set(pref, Math.max(max.get(pref) ?? 0, n));
  }
  const out: SlugEntry[] = [];
  for (const r of rows) {
    if (have.has(key(r))) continue;
    const pref = prefectureByName(r.prefecture);
    if (!pref) throw new Error(`${label(r)}: 知らない都道府県`);
    const n = (max.get(pref.slug) ?? 0) + 1;
    if (n > 999) throw new Error(`${label(r)}: ${pref.slug} の番号が 999 を超える`);
    max.set(pref.slug, n);
    out.push({
      name: r.name,
      prefecture: r.prefecture,
      slug: `${pref.slug}-${String(n).padStart(3, '0')}`,
    });
    have.add(key(r));
  }
  return out;
}

/** 台帳の書き方: 2字下げ・最後に改行1つ（supabase/data の台帳と同じ） */
export function serializeSlugLedger(ledger: SlugLedger): string {
  return JSON.stringify(ledger, null, 2) + '\n';
}

export function newSlugLedger(entries: SlugEntry[]): SlugLedger {
  return { schemaVersion: 1, issue: 324, note: SLUGS_NOTE, entries };
}

/** 台帳の文字の末尾（entries の閉じ括弧の前）に行を足す。既存の行の中身は1バイトも変えない */
export function appendSlugEntries(text: string, added: SlugEntry[]): string {
  if (added.length === 0) return text;
  const close = text.lastIndexOf(']');
  if (close < 0 || !/^\s*\}\s*$/.test(text.slice(close + 1))) {
    throw new Error(`${SLUGS_PATH}: entries が最後のキーの形でない（足す場所が分からない）`);
  }
  const head = text.slice(0, close).trimEnd();
  const lines = added.map(e =>
    JSON.stringify(e, null, 2)
      .split('\n')
      .map(l => `    ${l}`)
      .join('\n')
  );
  const sep = head.endsWith('[') ? '\n' : ',\n';
  return `${head}${sep}${lines.join(',\n')}\n  ${text.slice(close)}`;
}
