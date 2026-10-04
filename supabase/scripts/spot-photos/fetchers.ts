// 帯の写真（Issue #302）を Commons から取り（fetch）、R2 に置き（upload）、独自ドメインで読めるか確かめる（verify）。
// ネットとファイルは io で受ける（テストは偽物の fetch と時計で回す）。契約書: D-9・D-20・AC-19〜AC-22
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

import {
  COMMONS_INTERVAL_MS,
  label,
  type LedgerEntry302,
  PHOTO_STORE_WIDTH,
  R2_PREFIX,
} from './select.ts';

/** R2 のバケット（#227） */
export const R2_BUCKET = 'goshuin-images';
/** 置いた写真を変換なしで読む独自ドメイン（#227。アプリは /cdn-cgi/image/ の変換を通す） */
export const R2_PUBLIC_ORIGIN = 'https://img.goshuinsanpo.com';
/** imageinfo を1回で聞く数 */
export const COMMONS_BATCH = 50;
export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
/**
 * 縮小版の置き場所（imageinfo の thumburl はここだけを読む）。縮小版は thumb.wikimedia.org、
 * 元の幅が 1280 ちょうどの写真は元のファイル（upload.wikimedia.org）が返る
 */
export const COMMONS_THUMB_ORIGINS: readonly string[] = [
  'https://thumb.wikimedia.org/',
  'https://upload.wikimedia.org/',
];
/** R2 に置くときの Cache-Control（キーが中身の sha1 で決まるので変わらない） */
export const CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const R2_ENV_NAMES = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const;

const KEY_PATTERN = /^spot-photos\/[0-9a-f]{40}\.(jpg|png)$/;

export interface NetIo {
  readFile(path: string): Promise<Uint8Array | null>;
  /** 親のフォルダも作る。途中で止まっても半端なファイルを残さない */
  writeFile(path: string, data: Uint8Array): Promise<void>;
  writeTextFile(path: string, text: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
  now(): number;
  sleep(ms: number): Promise<void>;
  stdout(text: string): void;
  stderr(text: string): void;
}

export function userAgent(contact: string): string {
  return `goshuin-spot-photos/1 (${contact})`;
}

function extOf(e: LedgerEntry302): 'jpg' | 'png' {
  return e.r2Key.endsWith('.png') ? 'png' : 'jpg';
}

export function mimeOf(e: LedgerEntry302): 'image/jpeg' | 'image/png' {
  return extOf(e) === 'png' ? 'image/png' : 'image/jpeg';
}

/** 作業フォルダの縮小版と、そのときの API の値 */
export function cachePaths(work: string, e: LedgerEntry302): { image: string; meta: string } {
  return {
    image: `${work}/cache/${e.sha1}.${extOf(e)}`,
    meta: `${work}/cache/${e.sha1}.json`,
  };
}

const JPEG_HEAD = [0xff, 0xd8, 0xff];
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47];

function startsWith(bytes: Uint8Array, head: number[]): boolean {
  return head.every((b, i) => bytes[i] === b);
}

/** 取り直しても無駄な止まり方（429・maxlag など）。続きは同じコマンドで */
export class StopError extends Error {}

// --- fetch: Commons から縮小版を取る ---

interface ImageInfo {
  sha1?: string;
  mime?: string;
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  width?: number;
  height?: number;
}

/** 呼び出しの間を、前の呼び出しの終わりから COMMONS_INTERVAL_MS あける */
class Paced {
  private lastEnd: number | null = null;
  calls = 0;
  constructor(
    private io: NetIo,
    private ua: string
  ) {}

  async get(url: string): Promise<{ status: number; body: Uint8Array; retryAfter: string | null }> {
    if (this.lastEnd !== null) {
      const wait = this.lastEnd + COMMONS_INTERVAL_MS - this.io.now();
      if (wait > 0) await this.io.sleep(wait);
    }
    try {
      this.calls++;
      // リダイレクトにはついて行かない（3xx は失敗。置き場所の検査を最初の URL だけで済ませないため）
      const res = await this.io.fetch(url, {
        headers: { 'User-Agent': this.ua },
        redirect: 'manual',
      });
      const body = new Uint8Array(await res.arrayBuffer());
      return { status: res.status, body, retryAfter: res.headers.get('retry-after') };
    } finally {
      this.lastEnd = this.io.now();
    }
  }
}

function imageInfoUrl(files: string[]): string {
  const q = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|size|sha1|mime',
    iiurlwidth: String(PHOTO_STORE_WIDTH),
    maxlag: '5',
    titles: files.map(f => `File:${f}`).join('|'),
  });
  return `${COMMONS_API}?${q}`;
}

/** imageinfo の応答 → 頼んだファイル名ごとの値（名前は Commons が直した形でも引ける） */
function parseImageInfo(json: unknown, files: string[]): Map<string, ImageInfo | null> {
  const body = json as {
    error?: { code?: string; info?: string };
    query?: {
      normalized?: { from: string; to: string }[];
      pages?: { title: string; missing?: boolean; imageinfo?: ImageInfo[] }[];
    };
  };
  if (body.error) {
    throw new StopError(
      `Commons の API がエラー: ${body.error.code ?? ''} ${body.error.info ?? ''}`
    );
  }
  const renamed = new Map((body.query?.normalized ?? []).map(n => [n.from, n.to]));
  const pages = new Map((body.query?.pages ?? []).map(p => [p.title, p]));
  return new Map(
    files.map(f => {
      const title = `File:${f}`;
      const page = pages.get(renamed.get(title) ?? title) ?? pages.get(title);
      return [f, page && !page.missing ? (page.imageinfo?.[0] ?? null) : null];
    })
  );
}

export interface FetchResult {
  saved: number;
  cached: number;
  failed: string[];
}

/**
 * 台帳の承認済みでキャッシュに無いものだけ、imageinfo を 50 件ずつ聞き、縮小版を1つずつ取って
 * `<work>/cache/` に置く。sha1 が台帳と違う・中身が JPEG / PNG でない・幅が 1280 でないものは置かない
 */
export async function fetchPhotos(
  entries: LedgerEntry302[],
  opts: { io: NetIo; work: string; contact: string }
): Promise<FetchResult> {
  const { io, work } = opts;
  const approved = entries.filter(e => e.status === 'approved');
  const todo: LedgerEntry302[] = [];
  for (const e of approved) {
    const p = cachePaths(work, e);
    if ((await io.exists(p.image)) && (await io.exists(p.meta))) continue;
    todo.push(e);
  }
  const result: FetchResult = { saved: 0, cached: approved.length - todo.length, failed: [] };
  if (todo.length === 0) return result;

  const net = new Paced(io, userAgent(opts.contact));
  const fail = (e: LedgerEntry302, why: string) => {
    result.failed.push(label(e));
    io.stderr(`${label(e)}: ${e.file}: ${why}\n`);
  };
  io.stderr(`縮小版を ${todo.length} 件取る（キャッシュにある ${result.cached} 件は飛ばす）\n`);

  for (let i = 0; i < todo.length; i += COMMONS_BATCH) {
    const batch = todo.slice(i, i + COMMONS_BATCH);
    const api = await net.get(imageInfoUrl(batch.map(e => e.file)));
    if (api.status === 429 || api.status >= 500) {
      throw new StopError(
        `Commons の API が HTTP ${api.status}${api.retryAfter ? `（Retry-After ${api.retryAfter}）` : ''}`
      );
    }
    if (api.status !== 200) throw new StopError(`Commons の API が HTTP ${api.status}`);
    const infos = parseImageInfo(
      JSON.parse(new TextDecoder().decode(api.body)),
      batch.map(e => e.file)
    );

    for (const e of batch) {
      const info = infos.get(e.file);
      if (!info) {
        fail(e, 'Commons にファイルが無い');
        continue;
      }
      if (info.sha1 !== e.sha1) {
        fail(
          e,
          `Commons の sha1（${info.sha1}）が台帳（${e.sha1}）と違う。承認のあとでファイルが差し替わった（選び直す）`
        );
        continue;
      }
      // 応答の URL へ取りに行くので、Commons の置き場所のほかへは行かない
      const thumbUrl = info.thumburl ?? '';
      if (!COMMONS_THUMB_ORIGINS.some(o => thumbUrl.startsWith(o))) {
        fail(e, `縮小版の URL が ${COMMONS_THUMB_ORIGINS.join(' か ')} でない: ${info.thumburl}`);
        continue;
      }
      if (info.thumbwidth !== PHOTO_STORE_WIDTH) {
        fail(e, `縮小版の幅が ${PHOTO_STORE_WIDTH} でない（${info.thumbwidth}）`);
        continue;
      }
      const thumb = await net.get(thumbUrl);
      if (thumb.status === 429) {
        throw new StopError(
          `縮小版が HTTP 429${thumb.retryAfter ? `（Retry-After ${thumb.retryAfter}）` : ''}`
        );
      }
      if (thumb.status !== 200) {
        fail(e, `縮小版が HTTP ${thumb.status}`);
        continue;
      }
      const head = extOf(e) === 'png' ? PNG_HEAD : JPEG_HEAD;
      if (!startsWith(thumb.body, head)) {
        fail(e, `縮小版の中身が ${mimeOf(e)} でない`);
        continue;
      }
      const p = cachePaths(work, e);
      await io.writeFile(p.image, thumb.body);
      await io.writeTextFile(
        p.meta,
        JSON.stringify(
          {
            file: e.file,
            sha1: info.sha1,
            mime: info.mime,
            width: info.width,
            height: info.height,
            thumbUrl: info.thumburl,
            thumbWidth: info.thumbwidth,
            thumbHeight: info.thumbheight,
            bytes: thumb.body.length,
          },
          null,
          2
        ) + '\n'
      );
      result.saved++;
    }
    io.stderr(`  … ${Math.min(i + COMMONS_BATCH, todo.length)} / ${todo.length}\n`);
  }
  return result;
}

// --- upload: R2 に置く ---

function checkKeys(entries: LedgerEntry302[]): void {
  for (const e of entries) {
    if (!e.r2Key.startsWith(R2_PREFIX) || !KEY_PATTERN.test(e.r2Key)) {
      throw new Error(
        `${label(e)}: r2Key が ${R2_PREFIX}<sha1>.<jpg|png> でない: ${e.r2Key}（何も置いていない）`
      );
    }
  }
}

class R2 {
  private aws: AwsClient;
  private endpoint: string;
  constructor(
    private io: NetIo,
    env: Record<(typeof R2_ENV_NAMES)[number], string>
  ) {
    this.aws = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    });
    this.endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
  }

  private async send(url: string, init?: RequestInit): Promise<Response> {
    return await this.io.fetch(await this.aws.sign(url, init));
  }

  /** spot-photos/ の下のキー */
  async list(): Promise<Set<string>> {
    const keys = new Set<string>();
    let token: string | null = null;
    do {
      const q = new URLSearchParams({ 'list-type': '2', prefix: R2_PREFIX });
      if (token) q.set('continuation-token', token);
      const res = await this.send(`${this.endpoint}?${q}`);
      const xml = await res.text();
      if (!res.ok) throw new Error(`R2 の一覧に失敗: HTTP ${res.status}`);
      for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.add(m[1]);
      token = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1] ?? null;
    } while (token);
    return keys;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const res = await this.send(`${this.endpoint}/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
      body: body as BodyInit,
    });
    await res.body?.cancel();
    if (!res.ok) throw new Error(`R2 に置けない: HTTP ${res.status}`);
  }
}

/**
 * 台帳の承認済みの写真を、キャッシュから R2 の `spot-photos/` に置く（無いキーだけ・消さない）。
 * 最後に一覧を数え直し、台帳の全部があれば 0
 */
export async function uploadPhotos(
  entries: LedgerEntry302[],
  opts: { io: NetIo; work: string; env: Record<string, string | undefined>; dryRun: boolean }
): Promise<number> {
  const { io, work } = opts;
  for (const name of R2_ENV_NAMES) {
    if (!opts.env[name]) {
      io.stderr(`エラー: ${name} が未設定（何もしていない）\n`);
      return 1;
    }
  }
  const approved = entries.filter(e => e.status === 'approved');
  try {
    checkKeys(approved);
  } catch (e) {
    io.stderr(`エラー: ${(e as Error).message}\n`);
    return 1;
  }
  const r2 = new R2(io, opts.env as Record<(typeof R2_ENV_NAMES)[number], string>);
  const present = await r2.list();
  const toPut = approved.filter(e => !present.has(e.r2Key));
  const missing: LedgerEntry302[] = [];
  for (const e of toPut) if (!(await io.exists(cachePaths(work, e).image))) missing.push(e);
  io.stdout(
    `台帳 ${approved.length} 件 / R2 に既にある ${approved.length - toPut.length} 件 / 置く ${toPut.length} 件 / キャッシュに無い ${missing.length} 件\n`
  );
  if (missing.length > 0) {
    for (const e of missing) io.stderr(`キャッシュに無い: ${label(e)}: ${e.file}\n`);
    io.stderr('エラー: キャッシュに無い写真がある（fetch を先に流す。何も置いていない）\n');
    return 1;
  }
  if (opts.dryRun) return 0;

  let put = 0;
  const failed: string[] = [];
  for (const [i, e] of toPut.entries()) {
    try {
      const body = await io.readFile(cachePaths(work, e).image);
      if (!body) throw new Error('キャッシュを読めない');
      await r2.put(e.r2Key, body, mimeOf(e));
      put++;
    } catch (err) {
      failed.push(label(e));
      io.stderr(`失敗: ${label(e)}: ${e.r2Key}: ${(err as Error).message}\n`);
    }
    if ((i + 1) % 100 === 0) io.stderr(`  … ${i + 1} / ${toPut.length}\n`);
  }
  // 流し終わったら数え直す
  const after = await r2.list();
  const there = approved.filter(e => after.has(e.r2Key)).length;
  io.stdout(
    `置いた ${put} 件 / 失敗 ${failed.length} 件 / R2 にある台帳の写真 ${there} / ${approved.length}\n`
  );
  return there === approved.length ? 0 : 1;
}

// --- verify: 独自ドメインで読めるか（変換を使わない） ---

export async function verifyPhotos(
  entries: LedgerEntry302[],
  opts: { io: NetIo }
): Promise<number> {
  const { io } = opts;
  const approved = entries.filter(e => e.status === 'approved');
  let ok = 0;
  for (const e of approved) {
    let status: number | string;
    try {
      // リダイレクトにはついて行かない（3xx は 200 と数えない）
      const res = await io.fetch(`${R2_PUBLIC_ORIGIN}/${e.r2Key}`, {
        method: 'HEAD',
        redirect: 'manual',
      });
      await res.body?.cancel();
      status = res.status;
    } catch (err) {
      status = (err as Error).message;
    }
    if (status === 200) ok++;
    else io.stderr(`${label(e)}: ${R2_PUBLIC_ORIGIN}/${e.r2Key} が ${status}\n`);
  }
  io.stdout(`${ok}/${approved.length} 件 200\n`);
  return ok === approved.length ? 0 : 1;
}
