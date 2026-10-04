// 帯の写真の第2弾（Issue #320）のネット: Wikidata の項目を引いて手で結ぶ（manualLink）。
// fetch・時計・ファイルは io で受ける（テストは偽物の fetch と時計で回す）。呼び出しの決まりは第1弾の fetch と同じ:
// 1 度に 1 つ・前の呼び出しの終わりから 1,000ms・User-Agent に連絡先・リダイレクトについて行かない・
// 429 / 5xx / 応答の error（maxlag を含む）で止まる（StopError。取れた分はキャッシュに残り、同じコマンドで続きから）。
// 契約書: docs/issues/issue-320-spot-photos-batch2.md（D-4・D-12・D-13）
import { entitiesUrl } from '../spot-wikidata/fetchers.ts';
import { parseEntity, type SeedRow, serializeJson, type WdItem } from '../spot-wikidata/match.ts';
import { type ManualCtx, type ManualEntry320, manualLinkOf } from './batch2.ts';
import { COMMONS_BATCH, type NetIo, StopError, userAgent } from './fetchers.ts';
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
