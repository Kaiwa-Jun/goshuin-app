// #292 第2弾の座標をオーナーが地図で選ぶ画面のサーバー（Issue #301）。127.0.0.1 だけで待つ。
// 画面のコードは review/（データは持たない）。データ・選んだ途中・書き出しは作業フォルダの review/。
// 契約書: docs/issues/issue-301-spot-wikidata.md（D-16〜D-18）
import { type Ledger, LEDGER_PATH, parseLedger, SEED_FILES } from '../spot-coords/coords.ts';
import {
  type ExportItem,
  readSeedRows,
  type SeedRow,
  serializeJson,
  validateExport,
} from './match.ts';

export const DEFAULT_PORT = 8301;
export const EXPORT_FROM = 'spot-wikidata review (#301)';
export const EXPORT_FILE = 'coords-292-review.json';
export const EXPORT_PREV = 'coords-292-review.prev.json';
export const CHOICES_FILE = 'choices.json';
export const DATA_FILE = 'review-data.json';

const ASSETS: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/review.js': { file: 'review.js', type: 'text/javascript; charset=utf-8' },
  '/review.css': { file: 'review.css', type: 'text/css; charset=utf-8' },
};

interface ReviewPoint {
  kind: string;
  lat: number;
  lng: number;
  ref: string | null;
}

interface ReviewItem {
  idx: number;
  name: string;
  prefecture: string;
  file: string;
  line: number;
  seed: { lat: number; lng: number };
  verdict: string;
  points: ReviewPoint[];
}

export interface ServerOptions {
  /** リポジトリの直下（seed と台帳を読む） */
  root: string;
  /** 作業フォルダ（review/review-data.json を読み、選んだものを書く） */
  work: string;
  now: () => number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const notFound = () => new Response('not found', { status: 404 });

async function readOptional(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
}

/** 途中で止まっても半端なファイルを残さない */
async function writeAtomic(path: string, text: string): Promise<void> {
  const tmp = `${path}.tmp-${crypto.randomUUID()}`;
  await Deno.writeTextFile(tmp, text);
  await Deno.rename(tmp, path);
}

export async function loadServerData(opts: ServerOptions): Promise<{
  rows: SeedRow[];
  ledger: Ledger;
  dataText: string;
  items: Map<number, ReviewItem>;
}> {
  const root = opts.root.replace(/\/+$/, '');
  const files = [];
  for (const path of SEED_FILES) {
    files.push({ path, text: await Deno.readTextFile(`${root}/${path}`) });
  }
  const rows = readSeedRows(files);
  const ledger = parseLedger(await Deno.readTextFile(`${root}/${LEDGER_PATH}`));
  const dataPath = `${opts.work}/review/${DATA_FILE}`;
  const dataText = await readOptional(dataPath);
  if (dataText === null) {
    throw new Error(`${DATA_FILE} が無い: ${dataPath}（先に review-data を打つ）`);
  }
  const data = JSON.parse(dataText) as { items?: ReviewItem[] };
  if (!Array.isArray(data.items)) throw new Error(`${dataPath} に items が無い`);
  return { rows, ledger, dataText, items: new Map(data.items.map(i => [i.idx, i])) };
}

export async function createHandler(
  opts: ServerOptions
): Promise<{ handler: (req: Request) => Promise<Response>; count: number }> {
  const { rows, ledger, dataText, items } = await loadServerData(opts);
  const dir = `${opts.work}/review`;
  const choicesPath = `${dir}/${CHOICES_FILE}`;

  const readChoices = async (): Promise<ExportItem[]> => {
    const text = await readOptional(choicesPath);
    if (text === null) return [];
    const saved = JSON.parse(text) as { items?: ExportItem[] };
    return Array.isArray(saved.items) ? saved.items : [];
  };

  /** 届いた1件を、画面のデータと seed から書き出しの1行にする（座標と ref はサーバーが埋める） */
  const toItem = (body: Record<string, unknown>): ExportItem => {
    const idx = body.idx;
    const item = typeof idx === 'number' ? items.get(idx) : undefined;
    if (!item) throw new Error(`idx ${String(idx)} は画面の寺社ではない`);
    const who = `${item.name}（${item.prefecture}）`;
    const choice = String(body.choice);
    let lat: number | null = item.seed.lat;
    let lng: number | null = item.seed.lng;
    let ref: string | null = null;
    if (choice === 'wd' || choice === 'osm') {
      const p = item.points.find(x => x.kind === choice);
      if (!p) throw new Error(`${who}: ${choice} の点が無い`);
      [lat, lng, ref] = [p.lat, p.lng, p.ref];
    } else if (choice === 'custom') {
      if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
        throw new Error(`${who}: 地図で置いた点の lat / lng が無い`);
      }
      [lat, lng] = [body.lat, body.lng];
    } else if (choice !== 'seed') {
      const p = item.points.find(x => x.kind === choice);
      if (p) [lat, lng] = [p.lat, p.lng];
    }
    return {
      idx: item.idx,
      name: item.name,
      prefecture: item.prefecture,
      file: item.file,
      line: item.line,
      verdict: item.verdict,
      seed: item.seed,
      choice,
      lat,
      lng,
      ref,
      note: typeof body.note === 'string' ? body.note : '',
      chosen_at: new Date(opts.now()).toISOString(),
    };
  };

  const putChoice = async (req: Request): Promise<Response> => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: '選択が JSON ではない' }, 400);
    }
    if (typeof body !== 'object' || body === null) return json({ error: '選択が無い' }, 400);
    try {
      const item = toItem(body as Record<string, unknown>);
      const saved = await readChoices();
      const merged = [...saved.filter(s => s.idx !== item.idx), item].sort((a, b) => a.idx - b.idx);
      validateExport({ items: merged }, rows, ledger);
      await Deno.mkdir(dir, { recursive: true });
      await writeAtomic(
        choicesPath,
        serializeJson({ issue: 292, from: EXPORT_FROM, items: merged })
      );
      return json({
        item,
        count: merged.length,
        osm: merged.filter(m => m.choice === 'osm').length,
      });
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  };

  const postExport = async (): Promise<Response> => {
    try {
      const saved = await readChoices();
      if (saved.length === 0) return json({ error: 'まだ1件も選んでいない' }, 400);
      const out = {
        issue: 292,
        from: EXPORT_FROM,
        exported_at: new Date(opts.now()).toISOString(),
        count: saved.length,
        items: saved,
      };
      validateExport(out, rows, ledger);
      const path = `${dir}/${EXPORT_FILE}`;
      const prev = await readOptional(path);
      if (prev !== null) await writeAtomic(`${dir}/${EXPORT_PREV}`, prev);
      await writeAtomic(path, serializeJson(out));
      return json({ count: saved.length, file: EXPORT_FILE });
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  };

  const handler = async (req: Request): Promise<Response> => {
    const path = new URL(req.url).pathname;
    const asset = ASSETS[path];
    if (asset) {
      if (req.method !== 'GET') return notFound();
      const text = await Deno.readTextFile(new URL(`./review/${asset.file}`, import.meta.url));
      return new Response(text, {
        headers: { 'content-type': asset.type, 'cache-control': 'no-store' },
      });
    }
    if (path === '/api/data' && req.method === 'GET') {
      return new Response(dataText, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }
    if (path === '/api/choices' && req.method === 'GET') {
      const text = await readOptional(choicesPath);
      return text === null
        ? json({ items: [] })
        : new Response(text, {
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
            },
          });
    }
    if (path === '/api/choices' && req.method === 'PUT') return await putChoice(req);
    if (path === '/api/export' && req.method === 'POST') return await postExport();
    return notFound();
  };

  return { handler, count: items.size };
}

/** 127.0.0.1 だけで待つ（0.0.0.0 にしない） */
export async function startServer(
  opts: ServerOptions & { port: number; onListen?: (port: number, count: number) => void }
): Promise<Deno.HttpServer<Deno.NetAddr>> {
  const { handler, count } = await createHandler(opts);
  return Deno.serve(
    {
      hostname: '127.0.0.1',
      port: opts.port,
      onListen: addr => opts.onListen?.(addr.port, count),
    },
    handler
  );
}
