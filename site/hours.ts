// 受付時間の seed（supabase/seeds/seed_reception_hours_2026-08.sql）の読み方と表示の形。
// 本番に流していなくてよい。ファイルにある公式サイトの値と出典を出す。
// 契約書: docs/issues/issue-324-homepage.md D-8・AC-5〜7
import type { SeedRow } from '../supabase/scripts/spot-wikidata/match.ts';

export type HoursKind = 'explicit' | 'proxy';

export interface ReceptionHours {
  /** seed の行の番号（readSeedRows の idx） */
  idx: number;
  kind: HoursKind;
  /** seed の名前と都道府県（コメントの県の略から決めた寺社） */
  name: string;
  prefecture: string;
  /** 出典（公式サイト）の URL */
  url: string;
  open: string;
  close: string | null;
  notes: string;
  lastReportedAt: string;
}

/** `-- [⚠️ ]<名前>（<県の略>）<URL>`。名前に括弧があってもよいよう、URL の直前の（…）を県の略とする */
const NAME_COMMENT = /^\s*--\s*(?:\u26A0\uFE0F?\s*)?(.+)（([^（）]+)）(https?:\/\/\S+)/;
const SECTION = /^\s*--\s*(explicit|proxy):/;
const VALUE_ROW = /^\s*\('([0-9a-fA-F-]{36})',\s*'reception_hours',/;
const JSON_LINE = /^\s*'(\{.*\})'::jsonb,/;
const STAMP = /'(\d{4}-\d{2}-\d{2}T[0-9:.]+Z)'\)/;

/** 値の行の後ろで JSON とタイムスタンプを探す行の数 */
const LOOKAHEAD = 3;

export function parseReceptionHours(text: string, rows: SeedRow[]): ReceptionHours[] {
  const lines = text.split('\n');
  const out: ReceptionHours[] = [];
  let section: HoursKind | null = null;
  let pending: { name: string; abbr: string; url: string } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sec = SECTION.exec(line);
    if (sec) {
      section = sec[1] as HoursKind;
      continue;
    }
    const nc = NAME_COMMENT.exec(line);
    if (nc) {
      pending = { name: nc[1].trim(), abbr: nc[2].trim(), url: nc[3] };
      continue;
    }
    const v = VALUE_ROW.exec(line);
    if (!v) continue;
    const at = `受付時間の seed の ${i + 1} 行目（${v[1]}）`;
    if (!pending) throw new Error(`${at}: 前に名前のコメント（-- 名前（県の略）URL）が無い`);
    const who = `${pending.name}（${pending.abbr}）`;
    if (!section) throw new Error(`${who}: explicit / proxy の見出しの外の値の行（${at}）`);
    const hits = rows.filter(
      r => r.name === pending!.name && r.prefecture.startsWith(pending!.abbr)
    );
    if (hits.length !== 1) {
      throw new Error(`${who}: 名前に合う seed の寺社が ${hits.length} 件（1 件でない）`);
    }
    let json: Record<string, unknown> | null = null;
    let stamp: string | null = null;
    for (let k = i + 1; k <= i + LOOKAHEAD && k < lines.length; k++) {
      const j = JSON_LINE.exec(lines[k]);
      if (j && json === null) json = JSON.parse(j[1]);
      const s = STAMP.exec(lines[k]);
      if (s && stamp === null) stamp = s[1];
    }
    if (!json) throw new Error(`${who}: 値の JSON（'{…}'::jsonb）が読めない`);
    if (!stamp) throw new Error(`${who}: last_reported_at が読めない`);
    const { open, close, notes } = json;
    if (typeof open !== 'string' || !/^\d{2}:\d{2}$/.test(open)) {
      throw new Error(`${who}: open が HH:MM でない`);
    }
    if (close !== undefined && (typeof close !== 'string' || !/^\d{2}:\d{2}$/.test(close))) {
      throw new Error(`${who}: close が HH:MM でない`);
    }
    if (typeof notes !== 'string') throw new Error(`${who}: notes が文字でない`);
    const hit = hits[0];
    out.push({
      idx: hit.idx,
      kind: section,
      name: hit.name,
      prefecture: hit.prefecture,
      url: pending.url,
      open,
      close: (close as string | undefined) ?? null,
      notes,
      lastReportedAt: stamp,
    });
    pending = null;
  }
  return out;
}

function hm(t: string): string {
  const [h, m] = t.split(':');
  return `${Number(h)}:${m}`;
}

/** `09:10`→`9:10`。close があれば `9:10〜17:00`、無ければ `9:00〜` */
export function formatHours(open: string, close: string | null): string {
  return `${hm(open)}〜${close === null ? '' : hm(close)}`;
}

/** 出典のリンクの文字（URL のホスト名） */
export function hostOf(url: string): string {
  return new URL(url).host;
}

/** `2026-08-11T00:00:00Z` → `2026年8月`（日付の文字から。時刻帯で動かない） */
export function yearMonthOf(stamp: string): string {
  const m = /^(\d{4})-(\d{2})-/.exec(stamp);
  if (!m) throw new Error(`日付の形が違う: ${stamp}`);
  return `${m[1]}年${Number(m[2])}月`;
}
