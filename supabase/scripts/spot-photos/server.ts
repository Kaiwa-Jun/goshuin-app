// 帯の写真を選ぶ画面のサーバー（Issue #302）。127.0.0.1 だけで待つ。
// 画面のコードは review/（データは持たない）。データ・選んだ途中は作業フォルダの review/。
// 契約書: docs/issues/issue-302-spot-photo-band.md（D-7・「選ぶ画面」）
import { serializeJson } from '../spot-wikidata/match.ts';
import { type Candidates, type Choice, parseChoice, parseChoices } from './select.ts';

export const DEFAULT_PORT = 8302;
export const CANDIDATES_FILE = 'candidates.json';
export const CHOICES_FILE = 'choices.json';

/** 画面のファイル（これのほかのパスは 404。.. や %2e%2e も当たらない） */
const ASSETS: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/review.js': { file: 'review.js', type: 'text/javascript; charset=utf-8' },
  '/review.css': { file: 'review.css', type: 'text/css; charset=utf-8' },
  '/geometry.js': { file: 'geometry.js', type: 'text/javascript; charset=utf-8' },
};

export interface ServerOptions {
  /** 作業フォルダ（review/candidates.json を読み、review/choices.json に書く） */
  work: string;
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

export function choicesFileText(choices: Choice[]): string {
  return serializeJson({ schemaVersion: 1, issue: 302, choices });
}

export async function loadCandidates(work: string): Promise<{ text: string; data: Candidates }> {
  const path = `${work}/review/${CANDIDATES_FILE}`;
  const text = await readOptional(path);
  if (text === null)
    throw new Error(`${CANDIDATES_FILE} が無い: ${path}（先に candidates を打つ）`);
  const data = JSON.parse(text) as Candidates;
  if (!Array.isArray(data.entries)) throw new Error(`${path} に entries が無い`);
  return { text, data };
}

export async function createHandler(
  opts: ServerOptions
): Promise<{ handler: (req: Request) => Promise<Response>; count: number }> {
  const { text: dataText, data } = await loadCandidates(opts.work);
  const dir = `${opts.work}/review`;
  const choicesPath = `${dir}/${CHOICES_FILE}`;

  const readChoices = async (): Promise<Choice[]> => {
    const text = await readOptional(choicesPath);
    return text === null ? [] : parseChoices(text, data);
  };

  const putChoice = async (req: Request): Promise<Response> => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: '選んだ1件が JSON ではない' }, 400);
    }
    try {
      const saved = await readChoices();
      const idx = (body as { idx?: unknown } | null)?.idx;
      const others = saved.filter(s => s.idx !== idx);
      const choice = parseChoice(body, data, others);
      const merged = [...others, choice].sort((a, b) => a.idx - b.idx);
      await writeAtomic(choicesPath, choicesFileText(merged));
      return json({ choice, decided: merged.length, total: data.entries.length });
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
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (path === '/api/choices' && req.method === 'GET') {
      try {
        return json({ choices: await readChoices() });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }
    if (path === '/api/choices' && req.method === 'PUT') return await putChoice(req);
    return notFound();
  };

  return { handler, count: data.entries.length };
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
