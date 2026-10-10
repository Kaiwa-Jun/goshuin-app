// ホームページ goshuinsanpo.com（Issue #324）の CLI。リポジトリの直下で打つ。
//
//   deno run -A --node-modules-dir=none site/main.ts build [--production] [--root <dir>]
//   deno run -A --node-modules-dir=none site/main.ts serve [--port 8324] [--root <dir>]
//   deno run -A --node-modules-dir=none site/main.ts slugs [--check] [--root <dir>]
//
// build は site/dist の中を消してから作る。--production は APP_STORE_PT と CF_BEACON_TOKEN（site/config.ts）が要る。
// serve は 127.0.0.1 だけで待つ。slugs は slug の台帳に無い寺社を末尾に足す（既存の行は変えない）。
// --check は書かずに比べ、足りなければ終了コード 1。
// --root の既定はカレントディレクトリ。止めるときは標準エラーに理由（寺社なら「名前（都道府県）」、ファイルならパス）を出して終了コード 1。
// 契約書: docs/issues/issue-324-homepage.md（「CLI」・D-16・D-25）
import { SEED_FILES } from '../supabase/scripts/spot-coords/coords.ts';
import { readSeedRows } from '../supabase/scripts/spot-wikidata/match.ts';
import { BADGE_FILE, detectAssets, STATIC_DIR } from './assets.ts';
import { LEGAL_FILES, renderSite } from './build.ts';
import { DEFAULT_CONFIG, DEFAULT_PORT, OUT_DIR, type SiteConfig } from './config.ts';
import { buildSiteData, loadInputs } from './data.ts';
import { serve } from './serve.ts';
import {
  appendSlugEntries,
  missingSlugEntries,
  newSlugLedger,
  parseSlugLedger,
  serializeSlugLedger,
  SLUGS_PATH,
} from './slugs.ts';

export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface Args {
  command: string;
  root: string;
  check: boolean;
  production: boolean;
  port: number;
}

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  const a: Args = {
    command: command ?? '',
    root: '.',
    check: false,
    production: false,
    port: DEFAULT_PORT,
  };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--check') a.check = true;
    else if (arg === '--production') a.production = true;
    else if (arg === '--root' || arg === '--port') {
      const v = rest[++i];
      if (v === undefined) throw new Error(`${arg} の値が無い`);
      if (arg === '--root') a.root = v.replace(/\/+$/, '') || '/';
      else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`--port は 1〜65535: ${v}`);
        a.port = n;
      }
    } else throw new Error(`知らない引数: ${arg}`);
  }
  return a;
}

export function joinPath(root: string, rel: string): string {
  return `${root.replace(/\/+$/, '')}/${rel}`;
}

async function readText(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
}

export async function readRequired(path: string): Promise<string> {
  const text = await readText(path);
  if (text === null) throw new Error(`ファイルが無い: ${path}`);
  return text;
}

/** フォルダの下のファイル（相対パス・文字コードの順）。. で始まる名前は除く。無ければ空 */
export async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (rel: string) => {
    let entries: Deno.DirEntry[];
    try {
      entries = await Array.fromAsync(Deno.readDir(rel ? `${dir}/${rel}` : dir));
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return;
      throw e;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory) await walk(p);
      else if (e.isFile) out.push(p);
    }
  };
  await walk('');
  return out.sort();
}

/** --production に要る値のうち null の名前 */
export function missingProductionConfig(config: SiteConfig): string[] {
  return (['APP_STORE_PT', 'CF_BEACON_TOKEN'] as const).filter(k => config[k] === null);
}

// --- build ---

async function buildCommand(io: CliIo, a: Args, config: SiteConfig): Promise<number> {
  if (a.production) {
    const missing = missingProductionConfig(config);
    if (missing.length > 0) {
      io.stderr(
        `--production には site/config.ts の ${missing.join('・')} が要る（null のまま。何も書いていない）\n`
      );
      return 1;
    }
  }
  const inputs = await loadInputs(rel => readRequired(joinPath(a.root, rel)));
  const data = buildSiteData(inputs);
  const staticDir = joinPath(a.root, STATIC_DIR);
  const statics = await listFiles(staticDir);
  const badgeSvg = statics.includes(BADGE_FILE)
    ? await readRequired(`${staticDir}/${BADGE_FILE}`)
    : null;
  const { assets, notices } = detectAssets(statics, badgeSvg);
  const legal = {
    privacy: await readRequired(joinPath(a.root, LEGAL_FILES.privacy.src)),
    terms: await readRequired(joinPath(a.root, LEGAL_FILES.terms.src)),
  };
  const files = renderSite(data, config, assets, legal);
  const clash = statics.filter(f => files.has(f));
  if (clash.length > 0) {
    throw new Error(`${STATIC_DIR} のファイルが生成するページと重なる: ${clash.join('・')}`);
  }

  const out = joinPath(a.root, OUT_DIR);
  await Deno.remove(out, { recursive: true }).catch(e => {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  });
  const dirs = new Set<string>();
  const ensureDir = async (path: string) => {
    const dir = path.slice(0, path.lastIndexOf('/'));
    if (dirs.has(dir)) return;
    await Deno.mkdir(dir, { recursive: true });
    dirs.add(dir);
  };
  for (const path of [...files.keys()].sort()) {
    const to = `${out}/${path}`;
    await ensureDir(to);
    await Deno.writeTextFile(to, files.get(path)!);
  }
  for (const path of statics) {
    const to = `${out}/${path}`;
    await ensureDir(to);
    await Deno.copyFile(`${staticDir}/${path}`, to);
  }
  const html = [...files.keys()].filter(p => p.endsWith('.html')).length;
  const spots = data.spots.filter(s => s.hasPage).length;
  io.stdout(
    `${OUT_DIR} を作った: HTML ${html}（寺社 ${spots}・都道府県 47）・ほか ${files.size - html}・素材 ${statics.length}${a.production ? '（--production）' : ''}\n`
  );
  for (const n of notices) io.stdout(`まだ無い: ${n}\n`);
  return 0;
}

// --- serve ---

async function serveCommand(io: CliIo, a: Args): Promise<number> {
  const dir = joinPath(a.root, OUT_DIR);
  if (!(await readText(`${dir}/index.html`))) {
    throw new Error(`${dir}/index.html が無い（先に build を打つ）`);
  }
  const server = serve(dir, a.port, port =>
    io.stdout(`http://127.0.0.1:${port}/ で ${OUT_DIR} を配信している（止めるのは Ctrl+C）\n`)
  );
  await server.finished;
  return 0;
}

// --- slugs ---

async function slugsCommand(io: CliIo, a: Args): Promise<number> {
  const files = [];
  for (const path of SEED_FILES) {
    files.push({ path, text: await readRequired(joinPath(a.root, path)) });
  }
  const rows = readSeedRows(files);
  const path = joinPath(a.root, SLUGS_PATH);
  const text = await readText(path);
  const ledger = text === null ? null : parseSlugLedger(text);
  const added = missingSlugEntries(ledger, rows);
  const names = added.map(e => `${e.name}（${e.prefecture}）`).join('・');
  if (a.check) {
    if (added.length > 0) {
      io.stderr(`slug の台帳に無い寺社が ${added.length}（site/main.ts slugs で足す）: ${names}\n`);
      return 1;
    }
    io.stdout(`slug の台帳は seed の寺社を全部持つ（${ledger!.entries.length} 行）\n`);
    return 0;
  }
  if (added.length === 0) {
    io.stdout(`足す寺社は無い（${SLUGS_PATH}・${ledger!.entries.length} 行）\n`);
    return 0;
  }
  const next =
    text === null ? serializeSlugLedger(newSlugLedger(added)) : appendSlugEntries(text, added);
  // 足したあとの台帳も検査を通ることを確かめてから書く
  parseSlugLedger(next);
  await Deno.mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  await Deno.writeTextFile(path, next);
  io.stdout(
    `${SLUGS_PATH} に ${added.length} 行を足した: ${added.length > 10 ? `${added.length} 寺社` : names}\n`
  );
  return 0;
}

type Command = (io: CliIo, a: Args, config: SiteConfig) => Promise<number>;

const COMMANDS: Record<string, Command> = {
  build: buildCommand,
  serve: serveCommand,
  slugs: slugsCommand,
};

/** config は site/config.ts の値（テストは値を渡す） */
export async function runCli(
  argv: string[],
  io: CliIo,
  config: SiteConfig = DEFAULT_CONFIG
): Promise<number> {
  try {
    const a = parseArgs(argv);
    const command = COMMANDS[a.command];
    if (!command) {
      throw new Error(`サブコマンドは ${Object.keys(COMMANDS).join(' / ')} のどれか: ${a.command}`);
    }
    return await command(io, a, config);
  } catch (e) {
    io.stderr(`エラー: ${(e as Error).message}\n`);
    return 1;
  }
}

function writeAll(w: { writeSync(p: Uint8Array): number }, text: string): void {
  const data = new TextEncoder().encode(text);
  let off = 0;
  while (off < data.length) off += w.writeSync(data.subarray(off));
}

export function denoIo(): CliIo {
  return {
    stdout: text => writeAll(Deno.stdout, text),
    stderr: text => writeAll(Deno.stderr, text),
  };
}

if (import.meta.main) {
  Deno.exit(await runCli(Deno.args, denoIo()));
}
