// ローカルの配信（契約書 docs/issues/issue-324-homepage.md D-25）。127.0.0.1 だけで待つ。
// GitHub Pages と同じに: /<dir>/ は <dir>/index.html、/<dir>（ディレクトリがある）は /<dir>/ へ 301、
// 無いパスは 404.html を状態 404 で返す。Deno.serve だけで作る（新しい依存を足さない）

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
};

function typeOf(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return TYPES[ext] ?? 'application/octet-stream';
}

async function stat(path: string): Promise<Deno.FileInfo | null> {
  try {
    return await Deno.stat(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound || e instanceof Deno.errors.NotADirectory) return null;
    throw e;
  }
}

async function file(path: string, status = 200): Promise<Response> {
  return new Response(await Deno.readFile(path), {
    status,
    headers: { 'content-type': typeOf(path), 'cache-control': 'no-cache' },
  });
}

export function createHandler(dir: string): (req: Request) => Promise<Response> {
  const root = dir.replace(/\/+$/, '');
  const notFound = async () => {
    const page = `${root}/404.html`;
    if (await stat(page)) return await file(page, 404);
    return new Response('404', { status: 404 });
  };
  return async req => {
    let path: string;
    try {
      path = decodeURIComponent(new URL(req.url).pathname);
    } catch {
      return await notFound();
    }
    const parts = path.split('/');
    if (parts.some(p => p === '..' || p === '.') || path.includes('\0')) return await notFound();
    const local = root + path;
    if (path.endsWith('/')) {
      const index = `${local}index.html`;
      return (await stat(index))?.isFile ? await file(index) : await notFound();
    }
    const info = await stat(local);
    if (info?.isFile) return await file(local);
    if (info?.isDirectory) {
      return new Response(null, {
        status: 301,
        headers: { location: `${new URL(req.url).pathname}/` },
      });
    }
    return await notFound();
  };
}

export function serve(
  dir: string,
  port: number,
  onListen: (port: number) => void
): Deno.HttpServer {
  return Deno.serve(
    { hostname: '127.0.0.1', port, onListen: ({ port }) => onListen(port) },
    createHandler(dir)
  );
}
