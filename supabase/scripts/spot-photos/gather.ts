// 帯の写真の第2弾（Issue #320）のネット: Wikidata の項目を引いて手で結ぶ（manualLink）、
// Commons のカテゴリ（P373 の直下）と P180 の一覧と imageinfo を集める（gatherSpots）。
// fetch・時計・ファイルは io で受ける（テストは偽物の fetch と時計で回す）。呼び出しの決まりは第1弾の fetch と同じ:
// 1 度に 1 つ・前の呼び出しの終わりから 1,000ms・User-Agent に連絡先・リダイレクトについて行かない・
// 429 / 5xx / 応答の error（maxlag を含む）で止まる（StopError。取れた分はキャッシュに残り、同じコマンドで続きから）。
// 契約書: docs/issues/issue-320-spot-photos-batch2.md（D-4・D-12・D-13）
import { commonsUrl, entitiesUrl } from '../spot-wikidata/fetchers.ts';
import {
  parseEntity,
  parseImageInfo,
  type PhotoFile,
  type SeedRow,
  serializeJson,
  type WdItem,
} from '../spot-wikidata/match.ts';
import {
  type Gathered320,
  LIST_LIMIT,
  type ListSource,
  type ManualCtx,
  type ManualEntry320,
  manualLinkOf,
  type Spot320,
} from './batch2.ts';
import { COMMONS_API, COMMONS_BATCH, type NetIo, StopError, userAgent } from './fetchers.ts';
import { COMMONS_INTERVAL_MS, label } from './select.ts';

export interface GatherIo extends NetIo {
  /** 無いときは null */
  readTextFile(path: string): Promise<string | null>;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 呼び出しの間を、前の呼び出しの終わりから COMMONS_INTERVAL_MS あける。JSON の応答だけを読む */
export class Pacer {
  private lastEnd: number | null = null;
  calls = 0;
  constructor(
    private io: GatherIo,
    private ua: string
  ) {}

  async getJson(url: string, what: string): Promise<Record<string, unknown>> {
    if (this.lastEnd !== null) {
      const wait = this.lastEnd + COMMONS_INTERVAL_MS - this.io.now();
      if (wait > 0) await this.io.sleep(wait);
    }
    let status: number;
    let retryAfter: string | null;
    let text: string;
    try {
      this.calls++;
      // リダイレクトにはついて行かない（3xx は失敗）
      const res = await this.io.fetch(url, {
        headers: { 'User-Agent': this.ua },
        redirect: 'manual',
      });
      status = res.status;
      retryAfter = res.headers.get('retry-after');
      text = await res.text();
    } finally {
      this.lastEnd = this.io.now();
    }
    if (status !== 200) {
      throw new StopError(
        `${what}が HTTP ${status}${retryAfter ? `（Retry-After ${retryAfter}）` : ''}`
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new StopError(`${what}の応答が JSON でない`);
    }
    if (!isObject(body)) throw new StopError(`${what}の応答がオブジェクトでない`);
    if (isObject(body.error)) {
      throw new StopError(
        `${what}がエラー: ${String(body.error.code ?? '')} ${String(body.error.info ?? '')}`.trim()
      );
    }
    return body;
  }
}

// --- D-12: 手で結ぶ（Wikidata） ---

/** parseEntity が読む値（日本語のラベル・別名と P625・P18・P373・P131・P31 の値と rank）だけを残す */
const KEEP_CLAIMS = ['P625', 'P18', 'P373', 'P131', 'P31'] as const;

/**
 * wbgetentities の1項目から、parseEntity が読む値だけを残す（キャッシュに置く形）。
 * 出典（references）の取得日・改版の時刻などは残さない
 */
export function trimEntity(e: Record<string, unknown>): Record<string, unknown> {
  const labels = isObject(e.labels) && isObject(e.labels.ja) ? e.labels.ja : null;
  const aliases = isObject(e.aliases) && Array.isArray(e.aliases.ja) ? e.aliases.ja : null;
  const claims = isObject(e.claims) ? e.claims : {};
  return {
    type: e.type,
    id: e.id,
    labels: labels ? { ja: { language: 'ja', value: labels.value } } : {},
    aliases: aliases
      ? { ja: aliases.map(a => ({ language: 'ja', value: isObject(a) ? a.value : null })) }
      : {},
    claims: Object.fromEntries(
      KEEP_CLAIMS.filter(p => Array.isArray(claims[p])).map(p => [
        p,
        (claims[p] as unknown[]).map(s => {
          const st = isObject(s) ? s : {};
          const snak = isObject(st.mainsnak) ? st.mainsnak : {};
          return {
            mainsnak: { snaktype: snak.snaktype, datavalue: snak.datavalue },
            rank: st.rank,
          };
        }),
      ])
    ),
  };
}

export interface ManualDraft {
  links: { idx: number; qid: string }[];
}

/** 下書き `{ "links": [{ "idx": 421, "qid": "Q…" }] }`（リーダーが書く）を読む */
export function parseDraft(json: unknown): ManualDraft {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isObject(raw) || !Array.isArray(raw.links)) throw new Error('下書きに links が無い');
  return {
    links: raw.links.map((l, i) => {
      if (!isObject(l)) throw new Error(`下書きの links[${i}] がオブジェクトでない`);
      if (typeof l.idx !== 'number' || !Number.isInteger(l.idx) || l.idx < 1) {
        throw new Error(`下書きの links[${i}]: idx が 1 以上の整数でない`);
      }
      if (typeof l.qid !== 'string' || !/^Q\d+$/.test(l.qid)) {
        throw new Error(`下書きの links[${i}]: qid の形が違う: ${String(l.qid)}`);
      }
      return { idx: l.idx, qid: l.qid };
    }),
  };
}

export interface ManualLinkResult {
  /** 全部の行が規則を通ったら、結んだ行（idx の順）。1行でも通らなければ null */
  entries: ManualEntry320[] | null;
  /** 通らない行ごとの `<名前>（<都道府県>）: <qid>: <理由>` */
  failures: string[];
  calls: number;
}

/**
 * 下書きの Q-ID を wbgetentities で 50 件ずつ引き（`<work>/wd-entity/<qid>.json` にあるものは引かない）、
 * 1行ずつ D-3 の規則に当てる。work は作業フォルダの b2/
 */
export async function manualLink(opts: {
  io: GatherIo;
  work: string;
  contact: string;
  draft: ManualDraft;
  rows: readonly SeedRow[];
  ctx: ManualCtx;
}): Promise<ManualLinkResult> {
  const { io, work, draft } = opts;
  const net = new Pacer(io, userAgent(opts.contact));
  const cachePath = (qid: string) => `${work}/wd-entity/${qid}.json`;

  const items = new Map<string, WdItem | null>();
  const todo: string[] = [];
  for (const qid of new Set(draft.links.map(l => l.qid))) {
    const text = await io.readTextFile(cachePath(qid));
    if (text === null) todo.push(qid);
    else items.set(qid, parseEntity(JSON.parse(text)));
  }
  for (let i = 0; i < todo.length; i += COMMONS_BATCH) {
    const batch = todo.slice(i, i + COMMONS_BATCH);
    const body = await net.getJson(entitiesUrl(batch), 'Wikidata の API ');
    const entities = isObject(body.entities) ? body.entities : {};
    for (const qid of batch) {
      const e = entities[qid];
      if (!isObject(e) || 'missing' in e || e.id !== qid) {
        items.set(qid, null);
        continue;
      }
      const trimmed = trimEntity(e);
      await io.writeTextFile(cachePath(qid), serializeJson(trimmed));
      items.set(qid, parseEntity(trimmed));
    }
  }

  const seed = new Map(opts.rows.map(r => [r.idx, r]));
  const failures: string[] = [];
  const entries: ManualEntry320[] = [];
  const seen = new Set<number>();
  for (const l of draft.links) {
    const row = seed.get(l.idx);
    const who = row ? label(row) : `idx ${l.idx}`;
    let reason: string | null = null;
    if (seen.has(l.idx)) reason = 'idx が2行ある';
    else if (!row) reason = '対象でない';
    else {
      const r = manualLinkOf(row, items.get(l.qid) ?? null, opts.ctx);
      if (r.ok) entries.push(r.entry);
      else reason = r.reason;
    }
    seen.add(l.idx);
    if (reason !== null) failures.push(`${who}: ${l.qid}: ${reason}`);
  }
  return {
    entries: failures.length === 0 ? entries.sort((a, b) => a.idx - b.idx) : null,
    failures,
    calls: net.calls,
  };
}

// --- D-4: Commons から集める ---

/** P373 の直下のファイル（1 回だけ。再帰しない・continue を追わない） */
export function categoryMembersUrl(p373: string): string {
  const q = new URLSearchParams({
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${p373}`,
    cmtype: 'file',
    cmlimit: String(LIST_LIMIT),
    cmprop: 'title',
    format: 'json',
    formatversion: '2',
    maxlag: '5',
  });
  return `${COMMONS_API}?${q}`;
}

/** 構造化データで「描かれているもの P180 = Q-ID」のファイル（1 回だけ） */
export function p180SearchUrl(qid: string): string {
  const q = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: `haswbstatement:P180=${qid}`,
    srnamespace: '6',
    srlimit: String(LIST_LIMIT),
    srprop: '',
    format: 'json',
    formatversion: '2',
    maxlag: '5',
  });
  return `${COMMONS_API}?${q}`;
}

/** 一覧の応答 → ファイル名（File: を外す）と、収まらなかったか */
function listNames(
  body: Record<string, unknown>,
  key: 'categorymembers' | 'search'
): { names: string[]; truncated: boolean } {
  const query = isObject(body.query) ? body.query : {};
  const items = Array.isArray(query[key]) ? (query[key] as unknown[]) : [];
  const names = items
    .map(x => (isObject(x) && typeof x.title === 'string' ? x.title : ''))
    .filter(t => t.startsWith('File:'))
    .map(t => t.slice('File:'.length));
  return { names, truncated: body.continue !== undefined };
}

export interface GatherResult {
  /** 集めた寺社 */
  gathered: number;
  /** キャッシュにあったので呼ばなかった寺社 */
  cached: number;
  calls: number;
  /** 止まったときの理由（429・5xx・error。終わった寺社は残る） */
  stopped: string | null;
}

/**
 * Q-ID のある寺社ごとに (a) P373 の直下 (b) P180 = Q-ID の一覧を1回ずつ聞き、(c) 手で結んだ寺社の P18 と
 * 名前で重ねずにまとめ、imageinfo を 50 件ずつ聞いて、全部が済んでから `<work>/gather/<idx>.json` を書く。
 * キャッシュがある寺社は呼ばない。work は作業フォルダの b2/
 */
export async function gatherSpots(
  spots: readonly Spot320[],
  opts: { io: GatherIo; work: string; contact: string }
): Promise<GatherResult> {
  const { io, work } = opts;
  const net = new Pacer(io, userAgent(opts.contact));
  const result: GatherResult = { gathered: 0, cached: 0, calls: 0, stopped: null };
  try {
    for (const s of spots) {
      if (s.qid === null) continue;
      const path = `${work}/gather/${s.idx}.json`;
      if (await io.exists(path)) {
        result.cached++;
        continue;
      }
      const truncated: ListSource[] = [];
      let p373: string[] = [];
      if (s.p373 !== null) {
        const l = listNames(
          await net.getJson(categoryMembersUrl(s.p373), 'Commons の API '),
          'categorymembers'
        );
        p373 = l.names;
        if (l.truncated) truncated.push('p373');
      }
      const l = listNames(await net.getJson(p180SearchUrl(s.qid), 'Commons の API '), 'search');
      const p180 = l.names;
      if (l.truncated) truncated.push('p180');
      const names = [...new Set([...s.p18, ...p373, ...p180])];
      const files: PhotoFile[] = [];
      const missing: string[] = [];
      for (let i = 0; i < names.length; i += COMMONS_BATCH) {
        const batch = names.slice(i, i + COMMONS_BATCH);
        const info = parseImageInfo(await net.getJson(commonsUrl(batch), 'Commons の API '), batch);
        for (const n of batch) if (info.files[n]) files.push(info.files[n]);
        missing.push(...info.missing);
      }
      const g: Gathered320 = {
        idx: s.idx,
        name: s.name,
        prefecture: s.prefecture,
        qid: s.qid,
        p373: s.p373,
        p18: [...s.p18],
        lists: { p373, p180 },
        truncated,
        files,
        missing,
      };
      await io.writeTextFile(path, serializeJson(g));
      result.gathered++;
    }
  } catch (e) {
    if (!(e instanceof StopError)) throw e;
    result.stopped = e.message;
  } finally {
    result.calls = net.calls;
  }
  return result;
}
