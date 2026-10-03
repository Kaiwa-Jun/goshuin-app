// 取得とキャッシュ（Issue #301）。Wikidata（検索・WDQS・項目）→ 地理院（住所・タイル）→ OSM（Nominatim）→ Commons。
// fetch・時計・待ち・ファイルは外から渡す（テストは偽物）。判定は match.ts の純関数。
// 契約書: docs/issues/issue-301-spot-wikidata.md（D-7・D-8・D-10〜D-12・D-15）
import {
  distanceMeters,
  type LatLng,
  type Ledger,
  MAX_OSM_FEATURES,
} from '../spot-coords/coords.ts';
import {
  addressHitLevel,
  classifyCoord,
  type CoordPoint,
  dedupeLinks,
  filterCandidates,
  type GsiFeature,
  gsiPointFor,
  inJapan,
  INTERVAL_MS,
  judgeLink,
  type Link,
  linkNames,
  MAPPING_ATTRIBUTION,
  MAPPING_NOTE,
  type Mapping,
  type MappingEntry,
  MAX_LINK_M,
  nameMatch,
  nameMatchedCandidates,
  p131ToFetch,
  parseEntity,
  parseGsiTile,
  parseImageInfo,
  type PhotoEntry,
  type PhotoFile,
  type Photos,
  PHOTOS_ATTRIBUTION,
  PHOTOS_NOTE,
  searchNames,
  type SeedRow,
  sortQids,
  type Suggestion,
  TILE_Z,
  tilesAround,
  type Verdict,
  type WdItem,
} from './match.ts';

// --- HTTP ---

export type Kind = 'wikimedia' | 'wdqs' | 'gsiAddr' | 'gsiTile' | 'nominatim';

const INTERVAL: Record<Kind, number> = {
  wikimedia: 0,
  wdqs: INTERVAL_MS.wdqs,
  gsiAddr: INTERVAL_MS.gsiAddr,
  gsiTile: INTERVAL_MS.gsiTile,
  nominatim: INTERVAL_MS.nominatim,
};

/** 429・503・5xx・時間切れのとき、何回まで取るか（3回続けてだめなら止める） */
export const MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_MS = 60_000;
export const MAX_RETRY_MS = 300_000;
export const TIMEOUT_MS = 60_000;
export const RESUME = '続きから再開できます（同じコマンドを打ち直す）';

export function userAgent(contact: string): string {
  return `goshuin-spot-wikidata/1 (${contact})`;
}

/** 取り直してもだめだった。それまでの分はキャッシュに残っている */
export class StopError extends Error {}
/** --limit の数まで呼んだ */
export class LimitError extends Error {}

export interface NetDeps {
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** SPOT_WIKIDATA_CONTACT（User-Agent に入れる。キャッシュにも結果にも書かない） */
  contact: string;
  /** この回に呼ぶ数の上限（--limit） */
  limit?: number;
  /** 時間切れの信号（本物は AbortSignal.timeout。テストは渡さない） */
  timeout?: (ms: number) => AbortSignal | undefined;
}

export interface HttpResult {
  status: number;
  bytes: Uint8Array;
}

function retryAfterMs(header: string | null, now: number): number {
  if (header === null) return DEFAULT_RETRY_MS;
  const s = Number(header);
  if (header.trim() !== '' && Number.isFinite(s) && s >= 0) return Math.min(s * 1000, MAX_RETRY_MS);
  const at = Date.parse(header);
  if (Number.isFinite(at)) return Math.min(Math.max(at - now, 0), MAX_RETRY_MS);
  return DEFAULT_RETRY_MS;
}

function isMaxlag(bytes: Uint8Array): boolean {
  if (bytes.length > 4096) return false;
  try {
    const j = JSON.parse(new TextDecoder().decode(bytes));
    return j?.error?.code === 'maxlag';
  } catch {
    return false;
  }
}

function shortUrl(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/** 間隔・取り直し・User-Agent を守って1つずつ取る */
export class Client {
  calls = 0;
  private last = new Map<Kind, number>();
  private readonly ua: string;

  constructor(private deps: NetDeps) {
    const contact = deps.contact?.trim();
    if (!contact) throw new Error('SPOT_WIKIDATA_CONTACT が空');
    this.ua = userAgent(contact);
  }

  private async pace(kind: Kind): Promise<void> {
    const last = this.last.get(kind);
    if (last === undefined || INTERVAL[kind] === 0) return;
    const wait = last + INTERVAL[kind] - this.deps.now();
    if (wait > 0) await this.deps.sleep(wait);
  }

  /** 200・404 は返す。WDQS は 429・5xx・時間切れなら null（その回は使わない）。ほかは取り直すか StopError */
  async get(
    kind: Kind,
    url: string,
    init: { method?: 'GET' | 'POST'; body?: string; accept?: string } = {}
  ): Promise<HttpResult | null> {
    for (let attempt = 1; ; attempt++) {
      if (this.deps.limit !== undefined && this.calls >= this.deps.limit) {
        throw new LimitError(`--limit ${this.deps.limit} に達した`);
      }
      await this.pace(kind);
      this.last.set(kind, this.deps.now());
      this.calls++;
      let res: Response;
      try {
        res = await this.deps.fetch(url, {
          method: init.method ?? 'GET',
          headers: {
            'User-Agent': this.ua,
            Accept: init.accept ?? 'application/json',
            ...(init.body === undefined
              ? {}
              : { 'Content-Type': 'application/x-www-form-urlencoded' }),
          },
          body: init.body,
          signal: this.deps.timeout?.(TIMEOUT_MS),
        });
      } catch (e) {
        if (kind === 'wdqs') return null;
        if (attempt >= MAX_ATTEMPTS) {
          throw new StopError(
            `${shortUrl(url)}: 時間切れか、つながらない（${MAX_ATTEMPTS} 回）: ${(e as Error).message}`
          );
        }
        await this.deps.sleep(DEFAULT_RETRY_MS);
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const retryable =
        res.status === 429 ||
        res.status >= 500 ||
        (res.status === 200 && kind === 'wikimedia' && isMaxlag(bytes));
      if (!retryable) {
        if (res.status === 200 || res.status === 404) return { status: res.status, bytes };
        throw new StopError(`${shortUrl(url)}: ${res.status}`);
      }
      if (kind === 'wdqs') return null;
      if (attempt >= MAX_ATTEMPTS) {
        throw new StopError(`${shortUrl(url)}: ${res.status} が ${MAX_ATTEMPTS} 回続いた`);
      }
      await this.deps.sleep(retryAfterMs(res.headers.get('Retry-After'), this.deps.now()));
    }
  }
}

// --- キャッシュ（D-12） ---

export interface CacheFs {
  readFile(path: string): Promise<Uint8Array | null>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

export interface CacheRecord {
  url: string;
  status: number;
  body: unknown;
  fetchedAt?: string;
}

export async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** `<work>/cache/<種類>/<キー>`。読んで形を変えたものは覚えておく（同じ回で何度も読まない） */
export class Cache {
  private memo = new Map<string, unknown>();

  constructor(
    readonly work: string,
    private fs: CacheFs,
    private now: () => number
  ) {}

  path(kind: string, key: string): string {
    return `${this.work}/cache/${kind}/${key}`;
  }

  async json(kind: string, key: string): Promise<CacheRecord | null> {
    const bytes = await this.fs.readFile(this.path(kind, key));
    return bytes === null ? null : (JSON.parse(decoder.decode(bytes)) as CacheRecord);
  }

  async putJson(kind: string, key: string, rec: CacheRecord): Promise<void> {
    const out = { ...rec, fetchedAt: new Date(this.now()).toISOString() };
    await this.fs.writeFile(this.path(kind, key), encoder.encode(JSON.stringify(out) + '\n'));
  }

  async bytes(kind: string, key: string): Promise<Uint8Array | null> {
    return await this.fs.readFile(this.path(kind, key));
  }

  async putBytes(kind: string, key: string, data: Uint8Array): Promise<void> {
    await this.fs.writeFile(this.path(kind, key), data);
  }

  /** undefined（まだ無い）は覚えない */
  async remember<T>(id: string, load: () => Promise<T | undefined>): Promise<T | undefined> {
    if (this.memo.has(id)) return this.memo.get(id) as T;
    const v = await load();
    if (v !== undefined) this.memo.set(id, v);
    return v;
  }

  forget(id: string): void {
    this.memo.delete(id);
  }
}

// --- URL ---

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WDQS = 'https://query.wikidata.org/sparql';
const GSI_ADDR = 'https://msearch.gsi.go.jp/address-search/AddressSearch';
const GSI_TILE = 'https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export const WDQS_BATCH = 100;
export const SEARCH_LIMIT = 20;
export const WIKIMEDIA_BATCH = 50;

function q(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export function searchUrl(name: string): string {
  return `${WIKIDATA_API}?${q({
    action: 'query',
    list: 'search',
    srsearch: `${name} haswbstatement:P17=Q17`,
    srlimit: String(SEARCH_LIMIT),
    srnamespace: '0',
    srprop: '',
    format: 'json',
    formatversion: '2',
    maxlag: '5',
  })}`;
}

export function entitiesUrl(ids: string[]): string {
  return `${WIKIDATA_API}?${q({
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'labels|aliases|claims',
    languages: 'ja',
    format: 'json',
    maxlag: '5',
  })}`;
}

function sparqlString(s: string): string {
  return `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"@ja`;
}

export function wdqsQuery(names: string[]): string {
  return `SELECT ?item ?name WHERE { VALUES ?name { ${names.map(sparqlString).join(' ')} } ?item rdfs:label|skos:altLabel ?name . ?item wdt:P17 wd:Q17 . }`;
}

export function addrUrl(address: string): string {
  return `${GSI_ADDR}?${q({ q: address })}`;
}

export function tileUrl(x: number, y: number): string {
  return `${GSI_TILE}/${TILE_Z}/${x}/${y}.pbf`;
}

export function nominatimUrl(row: SeedRow): string {
  return `${NOMINATIM}?${q({
    q: `${searchNames(row.name)[0]} ${row.prefecture}`,
    format: 'jsonv2',
    countrycodes: 'jp',
    limit: '5',
    namedetails: '1',
  })}`;
}

export function commonsUrl(files: string[]): string {
  return `${COMMONS_API}?${q({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|sha1|extmetadata',
    iiextmetadatafilter:
      'LicenseShortName|LicenseUrl|Artist|Credit|AttributionRequired|Copyrighted|Restrictions|UsageTerms',
    iiextmetadatalanguage: 'en',
    titles: files.map(f => `File:${f}`).join('|'),
    format: 'json',
    formatversion: '2',
    maxlag: '5',
  })}`;
}

// --- 段と、要るもの ---

export type Stage = 'wikidata' | 'gsi' | 'osm' | 'commons';
export const STAGES: readonly Stage[] = ['wikidata', 'gsi', 'osm', 'commons'];

export interface Step {
  stage: Stage;
  label: string;
  need: number;
  done: number;
  optional?: boolean;
}

export interface Task {
  id: string;
  run: (client: Client) => Promise<void>;
}

export interface Ctx {
  rows: SeedRow[];
  ledger: Ledger;
  cache: Cache;
}

export interface ReviewPoint extends CoordPoint {
  distanceM: number;
}

export interface ReviewItem {
  idx: number;
  name: string;
  prefecture: string;
  address: string;
  type: string;
  rank: number;
  file: string;
  line: number;
  seed: LatLng;
  verdict: Verdict;
  suggestion: Suggestion | null;
  points: ReviewPoint[];
  link: { qid: string | null; confidence: string; label: string | null };
}

export interface ReviewData {
  schemaVersion: 1;
  ledgerOsmCount: number;
  maxOsm: number;
  counts: Record<Verdict, number>;
  items: ReviewItem[];
}

export interface Summary {
  confidence: Record<string, number>;
  method: Record<string, number>;
  photoRows: number;
  photoFiles: number;
  missingFiles: number;
  counts: Record<Verdict, number>;
}

export interface Analysis {
  steps: Step[];
  /** 最初の、残りのある段（任意の WDQS は数えない） */
  blocked: { step: Step; tasks: Task[] } | null;
  /** まだ取れていない WDQS（任意。取れなくても先に進める） */
  wdqsTasks: Task[];
  /** osm の段まで終わっていれば */
  review?: ReviewData;
  /** 全部の段が終わっていれば */
  outputs?: { mapping: Mapping; photos: Photos; summary: Summary };
}

function chunk<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

function step(stage: Stage, label: string, need: number, done: number, optional = false): Step {
  return { stage, label, need, done, ...(optional ? { optional } : {}) };
}

// --- 読み方（キャッシュ → 値） ---

async function loadWdqs(cache: Cache, key: string): Promise<Map<string, string[]> | undefined> {
  return await cache.remember(`wdqs/${key}`, async () => {
    const rec = await cache.json('wdqs', `${key}.json`);
    if (!rec || rec.status !== 200) return undefined;
    const hits = new Map<string, string[]>();
    const body = rec.body as {
      results?: { bindings?: { item?: { value?: string }; name?: { value?: string } }[] };
    };
    for (const b of body.results?.bindings ?? []) {
      const qid = /\/(Q\d+)$/.exec(b.item?.value ?? '')?.[1];
      const name = b.name?.value;
      if (qid && name) hits.set(name, [...(hits.get(name) ?? []), qid]);
    }
    return hits;
  });
}

async function searchKey(idx: number, name: string): Promise<string> {
  return `${idx}-${(await sha256hex(name)).slice(0, 8)}.json`;
}

async function loadSearch(cache: Cache, key: string): Promise<string[] | undefined> {
  return await cache.remember(`wd-search/${key}`, async () => {
    const rec = await cache.json('wd-search', key);
    if (!rec) return undefined;
    const body = rec.body as { query?: { search?: { title?: string }[] } };
    return (body?.query?.search ?? []).map(s => s.title ?? '').filter(t => /^Q\d+$/.test(t));
  });
}

/** 項目。null は Wikidata に無い（404 として覚える）、undefined はまだ取っていない */
async function loadEntity(cache: Cache, qid: string): Promise<WdItem | null | undefined> {
  return await cache.remember(`wd-entity/${qid}`, async () => {
    const rec = await cache.json('wd-entity', `${qid}.json`);
    if (!rec) return undefined;
    return rec.status === 200 ? parseEntity(rec.body) : null;
  });
}

interface AddrHit extends LatLng {
  label: string;
}

async function loadAddr(cache: Cache, row: SeedRow): Promise<{ hit: AddrHit | null } | undefined> {
  return await cache.remember(`gsi-addr/${row.idx}`, async () => {
    const rec = await cache.json('gsi-addr', `${row.idx}.json`);
    if (!rec) return undefined;
    const features = (Array.isArray(rec.body) ? rec.body : []) as {
      geometry?: { coordinates?: number[] };
      properties?: { title?: string };
    }[];
    for (const f of features) {
      const title = f.properties?.title;
      const c = f.geometry?.coordinates;
      if (!title || !c || c.length < 2) continue;
      if (addressHitLevel(row.address, title) === 'banchi') {
        return { hit: { lat: c[1], lng: c[0], label: title } };
      }
    }
    return { hit: null };
  });
}

async function loadTile(cache: Cache, x: number, y: number): Promise<GsiFeature[] | undefined> {
  return await cache.remember(`gsi-tile/${x}/${y}`, async () => {
    const bytes = await cache.bytes('gsi-tile', `${TILE_Z}/${x}/${y}.pbf`);
    return bytes === null ? undefined : parseGsiTile(bytes, TILE_Z, x, y);
  });
}

interface NominatimResult {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  namedetails?: { name?: string };
}

async function loadNominatim(cache: Cache, idx: number): Promise<NominatimResult[] | undefined> {
  return await cache.remember(`nominatim/${idx}`, async () => {
    const rec = await cache.json('nominatim', `${idx}.json`);
    if (!rec) return undefined;
    return (Array.isArray(rec.body) ? rec.body : []) as NominatimResult[];
  });
}

async function loadCommons(
  cache: Cache,
  file: string
): Promise<{ info: PhotoFile | null } | undefined> {
  return await cache.remember(`commons/${file}`, async () => {
    const rec = await cache.json('commons', `${await sha256hex(file)}.json`);
    if (!rec) return undefined;
    const parsed = parseImageInfo(rec.body, [file]);
    return { info: parsed.files[file] ?? null };
  });
}

// --- 取り方（1つ取ってキャッシュに書く） ---

async function getJson(
  client: Client,
  kind: Kind,
  url: string
): Promise<{ status: number; body: unknown }> {
  const res = (await client.get(kind, url))!;
  if (res.status === 404) return { status: 404, body: null };
  try {
    return { status: 200, body: JSON.parse(decoder.decode(res.bytes)) };
  } catch {
    throw new StopError(`${shortUrl(url)}: JSON ではない応答`);
  }
}

function wikimediaError(body: unknown): { code: string; id?: string; info?: string } | null {
  const e = (body as { error?: { code?: string; id?: string; info?: string } } | null)?.error;
  return e?.code ? { code: e.code, id: e.id, info: e.info } : null;
}

async function fetchEntities(cache: Cache, client: Client, ids: string[]): Promise<void> {
  let rest = [...ids];
  while (rest.length > 0) {
    const url = entitiesUrl(rest);
    const { status, body } = await getJson(client, 'wikimedia', url);
    const err = wikimediaError(body);
    if (err?.code === 'no-such-entity' && err.id && rest.includes(err.id)) {
      await cache.putJson('wd-entity', `${err.id}.json`, { url, status: 404, body: null });
      rest = rest.filter(x => x !== err.id);
      continue;
    }
    if (err) throw new StopError(`${shortUrl(url)}: ${err.code} ${err.info ?? ''}`);
    const entities = ((body as { entities?: unknown } | null)?.entities ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    for (const id of rest) {
      const e =
        entities[id] ??
        Object.values(entities).find(
          x => (x.redirects as { from?: string } | undefined)?.from === id
        );
      const missing = status === 404 || !e || 'missing' in e || typeof e.id !== 'string';
      await cache.putJson('wd-entity', `${id}.json`, {
        url,
        status: missing ? 404 : 200,
        body: missing ? null : e,
      });
      cache.forget(`wd-entity/${id}`);
    }
    return;
  }
}

async function fetchCommons(cache: Cache, client: Client, files: string[]): Promise<void> {
  const url = commonsUrl(files);
  const { body } = await getJson(client, 'wikimedia', url);
  const err = wikimediaError(body);
  if (err) throw new StopError(`${shortUrl(url)}: ${err.code} ${err.info ?? ''}`);
  const query = ((body as { query?: unknown } | null)?.query ?? {}) as {
    normalized?: { from: string; to: string }[];
    pages?: { title?: string }[];
  };
  const normalized = query.normalized ?? [];
  const pages = query.pages ?? [];
  for (const file of files) {
    const title = `File:${file}`;
    const n = normalized.filter(x => x.from === title);
    const to = n[0]?.to ?? title;
    const page = pages.find(p => p.title === to) ?? { ns: 6, title: to, missing: true };
    await cache.putJson('commons', `${await sha256hex(file)}.json`, {
      url,
      status: 200,
      body: { query: { normalized: n, pages: [page] } },
    });
    cache.forget(`commons/${file}`);
  }
}

// --- 解析（キャッシュから、要るもの・残り・結果を出す。ネットに出ない） ---

function nominatimPoint(
  row: SeedRow,
  results: NominatimResult[],
  addr: LatLng | null
): CoordPoint | null {
  const names = linkNames(row.name);
  const refs: LatLng[] = [{ lat: row.lat, lng: row.lng }, ...(addr ? [addr] : [])];
  for (const r of results) {
    const given = [r.namedetails?.name, r.name].filter(
      (x): x is string => typeof x === 'string' && x !== ''
    );
    if (!given.some(c => names.some(n => nameMatch(c, n) !== 'none'))) continue;
    const p = { lat: Number(r.lat), lng: Number(r.lon) };
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !inJapan(p)) continue;
    if (!refs.some(x => distanceMeters(x, p) <= MAX_LINK_M)) continue;
    if (!r.osm_type || r.osm_id === undefined) continue;
    return { kind: 'osm', ...p, ref: `${r.osm_type}/${r.osm_id}`, label: given[0] };
  }
  return null;
}

export async function analyze(ctx: Ctx): Promise<Analysis> {
  const { rows, ledger, cache } = ctx;
  const a: Analysis = { steps: [], blocked: null, wdqsTasks: [] };
  const block = (s: Step, tasks: Task[]): Analysis => {
    a.steps.push(s);
    a.blocked = { step: s, tasks };
    return a;
  };

  const ledgerWd = new Map<number, string>();
  const inLedger = new Set<number>();
  for (const e of ledger.entries) {
    const r = rows[e.idx - 1];
    if (!r || r.name !== e.name || r.prefecture !== e.prefecture) {
      throw new Error(`台帳の idx ${e.idx}（${e.name}（${e.prefecture}））が seed の行と合わない`);
    }
    inLedger.add(e.idx);
    if (e.source === 'wikidata' && e.ref) ledgerWd.set(e.idx, e.ref);
  }
  const targets = rows.filter(r => !ledgerWd.has(r.idx));
  const reviewRows = rows.filter(r => !inLedger.has(r.idx));
  const namesOf = new Map(targets.map(r => [r.idx, searchNames(r.name)]));

  // W1: WDQS（任意）
  const allNames = [...new Set(targets.flatMap(r => namesOf.get(r.idx)!))];
  const wdqsHits = new Map<string, string[]>();
  let wdqsDone = 0;
  const batches = chunk(allNames, WDQS_BATCH);
  for (const names of batches) {
    const key = await sha256hex(names.join('\n'));
    const hits = await loadWdqs(cache, key);
    if (hits) {
      wdqsDone++;
      for (const [n, qs] of hits) wdqsHits.set(n, [...(wdqsHits.get(n) ?? []), ...qs]);
      continue;
    }
    a.wdqsTasks.push({
      id: `wdqs/${key}`,
      run: async client => {
        const body = new URLSearchParams({ query: wdqsQuery(names), format: 'json' }).toString();
        const res = await client.get('wdqs', WDQS, {
          method: 'POST',
          body,
          accept: 'application/sparql-results+json',
        });
        if (res === null || res.status !== 200) return; // 使わずに続ける（D-7 ①）
        let parsed: unknown;
        try {
          parsed = JSON.parse(decoder.decode(res.bytes));
        } catch {
          return;
        }
        await cache.putJson('wdqs', `${key}.json`, { url: WDQS, status: 200, body: parsed });
      },
    });
  }
  a.steps.push(step('wikidata', 'WDQS（任意）', batches.length, wdqsDone, true));

  // W2: 検索（台帳の第1弾 wikidata を除く全部）
  const searchHits = new Map<number, string[]>();
  const searchTasks: Task[] = [];
  let searchNeed = 0;
  for (const r of targets) {
    for (const name of namesOf.get(r.idx)!) {
      searchNeed++;
      const key = await searchKey(r.idx, name);
      const hits = await loadSearch(cache, key);
      if (hits) {
        searchHits.set(r.idx, [...(searchHits.get(r.idx) ?? []), ...hits]);
        continue;
      }
      searchTasks.push({
        id: `wd-search/${key}`,
        run: async client => {
          const url = searchUrl(name);
          const { status, body } = await getJson(client, 'wikimedia', url);
          const err = wikimediaError(body);
          if (err) throw new StopError(`${shortUrl(url)}: ${err.code} ${err.info ?? ''}`);
          await cache.putJson('wd-search', key, { url, status, body });
        },
      });
    }
  }
  const searchStep = step('wikidata', '検索', searchNeed, searchNeed - searchTasks.length);
  if (searchTasks.length > 0) return block(searchStep, searchTasks);
  a.steps.push(searchStep);

  // W3: 項目（検索と WDQS の候補・台帳の Q-ID）
  const candidateIds = new Map<number, string[]>();
  for (const r of targets) {
    const ids = [
      ...(searchHits.get(r.idx) ?? []),
      ...namesOf.get(r.idx)!.flatMap(n => wdqsHits.get(n) ?? []),
    ];
    candidateIds.set(r.idx, sortQids(ids));
  }
  const directIds = sortQids([...[...candidateIds.values()].flat(), ...ledgerWd.values()]);
  const entities = new Map<string, WdItem | null>();
  const missingIds: string[] = [];
  for (const qid of directIds) {
    const e = await loadEntity(cache, qid);
    if (e === undefined) missingIds.push(qid);
    else entities.set(qid, e);
  }
  const entityStep = step(
    'wikidata',
    '項目',
    directIds.length,
    directIds.length - missingIds.length
  );
  const entityTasks = (ids: string[]): Task[] =>
    chunk(ids, WIKIMEDIA_BATCH).map(batch => ({
      id: `wd-entity/${batch.join('|')}`,
      run: client => fetchEntities(cache, client, batch),
    }));
  if (missingIds.length > 0) return block(entityStep, entityTasks(missingIds));
  a.steps.push(entityStep);

  // W4: P131 の先（名前で絞った候補から、5段まで）
  const candidatesOf = (r: SeedRow): WdItem[] =>
    (candidateIds.get(r.idx) ?? []).map(id => entities.get(id)).filter((e): e is WdItem => !!e);
  const matched = targets.flatMap(r => nameMatchedCandidates(r, candidatesOf(r)).items);
  const p131Known = new Set<string>();
  for (;;) {
    const need = p131ToFetch(
      matched,
      id => entities.get(id) ?? undefined,
      id => entities.has(id)
    );
    if (need.length === 0) break;
    const fresh: string[] = [];
    for (const id of need) {
      const e = await loadEntity(cache, id);
      if (e === undefined) fresh.push(id);
      else {
        entities.set(id, e);
        p131Known.add(id);
      }
    }
    if (fresh.length > 0) {
      const s = step('wikidata', 'P131 の先', p131Known.size + fresh.length, p131Known.size);
      return block(s, entityTasks(fresh));
    }
  }
  a.steps.push(step('wikidata', 'P131 の先', p131Known.size, p131Known.size));
  const lookup = (id: string) => entities.get(id) ?? undefined;

  // G1: 地理院の住所
  const addrOf = new Map<number, AddrHit | null>();
  const addrTasks: Task[] = [];
  for (const r of targets) {
    const hit = await loadAddr(cache, r);
    if (hit) {
      addrOf.set(r.idx, hit.hit);
      continue;
    }
    addrTasks.push({
      id: `gsi-addr/${r.idx}`,
      run: async client => {
        const url = addrUrl(r.address);
        const { status, body } = await getJson(client, 'gsiAddr', url);
        await cache.putJson('gsi-addr', `${r.idx}.json`, { url, status, body });
      },
    });
  }
  const addrStep = step('gsi', '住所', targets.length, targets.length - addrTasks.length);
  if (addrTasks.length > 0) return block(addrStep, addrTasks);
  a.steps.push(addrStep);

  // G2: 地理院のタイル（seed・候補の P625・住所の点のまわり 3×3）
  const nearOf = new Map<number, LatLng[]>();
  const tileKeys = new Map<string, { x: number; y: number }>();
  const tilesOf = new Map<number, { x: number; y: number }[]>();
  for (const r of targets) {
    const addr = addrOf.get(r.idx) ?? null;
    const { kept } = filterCandidates({
      row: r,
      ledgerRef: null,
      candidates: candidatesOf(r),
      lookup,
      addr,
      gsi: null,
    });
    const near: LatLng[] = [
      { lat: r.lat, lng: r.lng },
      ...(addr ? [{ lat: addr.lat, lng: addr.lng }] : []),
      ...kept.map(k => k.item.p625).filter((p): p is LatLng => p !== null),
    ];
    nearOf.set(r.idx, near);
    const tiles = tilesAround(near);
    tilesOf.set(r.idx, tiles);
    for (const t of tiles) tileKeys.set(`${t.x}/${t.y}`, t);
  }
  const tileTasks: Task[] = [];
  for (const t of [...tileKeys.values()].sort((p, s) => p.x - s.x || p.y - s.y)) {
    if ((await loadTile(cache, t.x, t.y)) !== undefined) continue;
    tileTasks.push({
      id: `gsi-tile/${t.x}/${t.y}`,
      run: async client => {
        const res = (await client.get('gsiTile', tileUrl(t.x, t.y), { accept: '*/*' }))!;
        await cache.putBytes(
          'gsi-tile',
          `${TILE_Z}/${t.x}/${t.y}.pbf`,
          res.status === 200 ? res.bytes : new Uint8Array(0)
        );
      },
    });
  }
  const tileStep = step('gsi', 'タイル', tileKeys.size, tileKeys.size - tileTasks.length);
  if (tileTasks.length > 0) return block(tileStep, tileTasks);
  a.steps.push(tileStep);

  const gsiOf = new Map<number, (LatLng & { label: string }) | null>();
  for (const r of targets) {
    const features: GsiFeature[] = [];
    for (const t of tilesOf.get(r.idx)!) {
      features.push(...((await loadTile(cache, t.x, t.y)) ?? []));
    }
    const addr = addrOf.get(r.idx) ?? null;
    const anchors: LatLng[] = [
      { lat: r.lat, lng: r.lng },
      ...(addr ? [{ lat: addr.lat, lng: addr.lng }] : []),
    ];
    gsiOf.set(r.idx, gsiPointFor(linkNames(r.name), features, nearOf.get(r.idx)!, anchors));
  }

  // 結びつけ（D-5）
  const links: Link[] = dedupeLinks(
    rows.map(r =>
      judgeLink({
        row: r,
        ledgerRef: ledgerWd.get(r.idx) ?? null,
        candidates: ledgerWd.has(r.idx) ? [] : candidatesOf(r),
        lookup,
        addr: addrOf.get(r.idx) ?? null,
        gsi: gsiOf.get(r.idx) ?? null,
      })
    )
  );
  const linkOf = new Map(links.map(l => [l.idx, l]));

  // O1: 第2弾の分け方（台帳に無い行）。OSM 抜きで owner / investigate の行だけ Nominatim に聞く
  const pointsOf = new Map<number, CoordPoint[]>();
  for (const r of reviewRows) {
    const l = linkOf.get(r.idx)!;
    const pts: CoordPoint[] = [];
    const e = l.qid ? entities.get(l.qid) : null;
    if ((l.confidence === 'high' || l.confidence === 'medium') && e?.p625) {
      pts.push({ kind: 'wd', ...e.p625, ref: l.qid, label: e.label });
    }
    const g = gsiOf.get(r.idx);
    if (g) pts.push({ kind: 'gsi', lat: g.lat, lng: g.lng, ref: null, label: g.label });
    const ad = addrOf.get(r.idx);
    if (ad) pts.push({ kind: 'addr', lat: ad.lat, lng: ad.lng, ref: null, label: ad.label });
    pointsOf.set(r.idx, pts);
  }
  const osmRows = reviewRows.filter(r => classifyCoord(r, pointsOf.get(r.idx)!).needsOsm);
  const osmTasks: Task[] = [];
  for (const r of osmRows) {
    const results = await loadNominatim(cache, r.idx);
    if (results) {
      const p = nominatimPoint(r, results, addrOf.get(r.idx) ?? null);
      if (p) pointsOf.get(r.idx)!.push(p);
      continue;
    }
    osmTasks.push({
      id: `nominatim/${r.idx}`,
      run: async client => {
        const url = nominatimUrl(r);
        const { status, body } = await getJson(client, 'nominatim', url);
        await cache.putJson('nominatim', `${r.idx}.json`, { url, status, body });
      },
    });
  }
  const osmStep = step('osm', 'Nominatim', osmRows.length, osmRows.length - osmTasks.length);
  if (osmTasks.length > 0) return block(osmStep, osmTasks);
  a.steps.push(osmStep);

  const counts: Record<Verdict, number> = { suggest: 0, owner: 0, investigate: 0, keep: 0 };
  const items: ReviewItem[] = [];
  for (const r of reviewRows) {
    const pts = pointsOf.get(r.idx)!;
    const c = classifyCoord(r, pts);
    counts[c.verdict]++;
    if (c.verdict === 'keep') continue;
    const l = linkOf.get(r.idx)!;
    const e = l.qid ? entities.get(l.qid) : null;
    items.push({
      idx: r.idx,
      name: r.name,
      prefecture: r.prefecture,
      address: r.address,
      type: r.type,
      rank: r.rank,
      file: r.file,
      line: r.line,
      seed: { lat: r.lat, lng: r.lng },
      verdict: c.verdict,
      suggestion: c.suggestion,
      points: pts.map(p => ({ ...p, distanceM: Math.round(distanceMeters(r, p)) })),
      link: { qid: l.qid, confidence: l.confidence, label: e?.label ?? null },
    });
  }
  const ORDER: Verdict[] = ['suggest', 'owner', 'investigate'];
  items.sort(
    (x, y) =>
      ORDER.indexOf(x.verdict) - ORDER.indexOf(y.verdict) || y.rank - x.rank || x.idx - y.idx
  );
  a.review = {
    schemaVersion: 1,
    ledgerOsmCount: ledger.entries.filter(e => e.source === 'osm').length,
    maxOsm: MAX_OSM_FEATURES,
    counts,
    items,
  };

  // 対応表（D-5・D-6）
  const mappingEntries: MappingEntry[] = links.map(l => {
    const e = l.qid ? entities.get(l.qid) : null;
    return {
      idx: l.idx,
      name: l.name,
      prefecture: l.prefecture,
      qid: l.qid,
      label: e?.label ?? null,
      p625: e?.p625 && inJapan(e.p625) ? e.p625 : null,
      p18: e?.p18 ?? [],
      p373: e?.p373 ?? null,
      confidence: l.confidence,
      method: l.method,
      candidates: l.candidates,
      basis: l.basis,
    };
  });

  // C1: Commons（high / medium で P18 がある寺社のファイル）
  const wanted = [
    ...new Set(
      mappingEntries
        .filter(m => m.confidence === 'high' || m.confidence === 'medium')
        .flatMap(m => m.p18)
    ),
  ];
  const info = new Map<string, PhotoFile | null>();
  const missingFiles: string[] = [];
  for (const f of wanted) {
    const v = await loadCommons(cache, f);
    if (v === undefined) missingFiles.push(f);
    else info.set(f, v.info);
  }
  const commonsStep = step(
    'commons',
    'Commons',
    wanted.length,
    wanted.length - missingFiles.length
  );
  if (missingFiles.length > 0) {
    return block(
      commonsStep,
      chunk(missingFiles, WIKIMEDIA_BATCH).map(batch => ({
        id: `commons/${batch.join('|')}`,
        run: client => fetchCommons(cache, client, batch),
      }))
    );
  }
  a.steps.push(commonsStep);

  const photoEntries: PhotoEntry[] = [];
  for (const m of mappingEntries) {
    if (m.qid === null || (m.confidence !== 'high' && m.confidence !== 'medium')) continue;
    const files = m.p18.map(f => info.get(f)).filter((f): f is PhotoFile => !!f);
    if (files.length === 0) continue;
    photoEntries.push({
      idx: m.idx,
      name: m.name,
      prefecture: m.prefecture,
      qid: m.qid,
      linkConfidence: m.confidence,
      files,
    });
  }
  const tally = (list: string[]) =>
    list.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {});
  a.outputs = {
    mapping: {
      schemaVersion: 1,
      issue: 301,
      note: MAPPING_NOTE,
      attribution: MAPPING_ATTRIBUTION,
      entries: mappingEntries,
    },
    photos: {
      schemaVersion: 1,
      issue: 301,
      note: PHOTOS_NOTE,
      attribution: PHOTOS_ATTRIBUTION,
      entries: photoEntries,
    },
    summary: {
      confidence: {
        high: 0,
        medium: 0,
        low: 0,
        none: 0,
        ...tally(mappingEntries.map(m => m.confidence)),
      },
      method: { ledger: 0, rule: 0, ...tally(mappingEntries.map(m => m.method)) },
      photoRows: photoEntries.length,
      photoFiles: photoEntries.reduce((n, e) => n + e.files.length, 0),
      missingFiles: [...info.values()].filter(v => v === null).length,
      counts,
    },
  };
  return a;
}
