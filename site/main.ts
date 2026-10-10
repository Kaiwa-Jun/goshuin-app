// ホームページ goshuinsanpo.com（Issue #324）の CLI。リポジトリの直下で打つ。
//
//   deno run -A --node-modules-dir=none site/main.ts slugs [--check] [--root <dir>]
//
// slugs は slug の台帳に無い寺社を末尾に足す（既存の行は変えない）。--check は書かずに比べ、足りなければ終了コード 1。
// --root の既定はカレントディレクトリ。止めるときは標準エラーに理由（寺社なら「名前（都道府県）」、ファイルならパス）を出して終了コード 1。
// 契約書: docs/issues/issue-324-homepage.md（「CLI」）
import { SEED_FILES } from '../supabase/scripts/spot-coords/coords.ts';
import { readSeedRows } from '../supabase/scripts/spot-wikidata/match.ts';
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
}

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  const a: Args = { command: command ?? '', root: '.', check: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--check') a.check = true;
    else if (arg === '--root') {
      const v = rest[++i];
      if (v === undefined) throw new Error(`${arg} の値が無い`);
      a.root = v.replace(/\/+$/, '') || '/';
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

const COMMANDS: Record<string, (io: CliIo, a: Args) => Promise<number>> = {
  slugs: slugsCommand,
};

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  try {
    const a = parseArgs(argv);
    const command = COMMANDS[a.command];
    if (!command) {
      throw new Error(`サブコマンドは ${Object.keys(COMMANDS).join(' / ')} のどれか: ${a.command}`);
    }
    return await command(io, a);
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
