// 寺社のマスタの座標の台帳（supabase/data/spot-coords-292.json）を扱う CLI（Issue #292）。
//
//   deno run -A supabase/scripts/spot-coords/main.ts import-draft <draft.json> --preset batch1 --batch 1 [--dry-run] [--root <dir>]
//   deno run -A supabase/scripts/spot-coords/main.ts import-owner <owner.json> --batch 2 [--dry-run] [--root <dir>]
//   deno run -A supabase/scripts/spot-coords/main.ts generate --batch 1 --version 20260928000000 [--check] [--root <dir>]
//   deno run -A supabase/scripts/spot-coords/main.ts revert --batch 1
//
// --root の既定はカレントディレクトリ（リポジトリの直下で打つ）。エラーは標準エラーに出し、終了コード 1。
// 契約書: docs/issues/issue-292-spot-coords.md（D-9〜D-14）
import {
  buildCheckSql,
  buildMigrationSql,
  CHECK_SQL_PATH,
  countSeedRows,
  type DraftItem,
  draftItemToEntry,
  emptyLedger,
  type Ledger,
  LEDGER_PATH,
  type LedgerEntry,
  mergeEntries,
  migrationPath,
  type OwnerItem,
  ownerItemToEntry,
  parseLedger,
  rewriteSeed,
  SEED_FILES,
  selectFirstBatch,
  serializeLedger,
} from './coords.ts';

export interface CliIo {
  /** 無いときは null */
  readTextFile(path: string): Promise<string | null>;
  /** 親のフォルダも作る */
  writeTextFile(path: string, text: string): Promise<void>;
  stdout(text: string): void;
  stderr(text: string): void;
}

const PRESETS: Record<string, (item: DraftItem) => boolean> = { batch1: selectFirstBatch };

interface Args {
  command: string;
  file?: string;
  batch?: number;
  version?: string;
  preset?: string;
  root: string;
  dryRun: boolean;
  check: boolean;
}

const VALUE_FLAGS = ['--batch', '--version', '--preset', '--root'];

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  const a: Args = { command: command ?? '', root: '.', dryRun: false, check: false };
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--dry-run') a.dryRun = true;
    else if (arg === '--check') a.check = true;
    else if (VALUE_FLAGS.includes(arg)) {
      const v = rest[++i];
      if (v === undefined) throw new Error(`${arg} の値が無い`);
      if (arg === '--batch') {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1) throw new Error(`--batch は 1 以上の整数: ${v}`);
        a.batch = n;
      } else if (arg === '--version') a.version = v;
      else if (arg === '--preset') a.preset = v;
      else a.root = v;
    } else if (arg.startsWith('--')) throw new Error(`知らない引数: ${arg}`);
    else positional.push(arg);
  }
  if (positional.length > 1) throw new Error(`余分な引数: ${positional.slice(1).join(' ')}`);
  a.file = positional[0];
  return a;
}

function need<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`${what} が要る`);
  return v;
}

function joinPath(root: string, rel: string): string {
  return `${root.replace(/\/+$/, '')}/${rel}`;
}

async function readRequired(io: CliIo, path: string): Promise<string> {
  const text = await io.readTextFile(path);
  if (text === null) throw new Error(`ファイルが無い: ${path}`);
  return text;
}

async function readLedger(io: CliIo, root: string): Promise<Ledger | null> {
  const text = await io.readTextFile(joinPath(root, LEDGER_PATH));
  return text === null ? null : parseLedger(text);
}

function itemsOf(json: string, path: string): unknown[] {
  const data = JSON.parse(json) as { items?: unknown };
  if (!Array.isArray(data.items)) throw new Error(`${path} に items の配列が無い`);
  return data.items;
}

/** import-draft / import-owner の共通: 台帳に足して、書く（--dry-run は台帳の全体を標準出力に出す） */
async function importEntries(io: CliIo, a: Args, entries: LedgerEntry[]): Promise<number> {
  if (entries.length === 0) throw new Error('台帳に足す行が無い');
  const ledger = mergeEntries((await readLedger(io, a.root)) ?? emptyLedger(), entries);
  const text = serializeLedger(ledger);
  if (a.dryRun) {
    io.stdout(text);
    io.stderr(
      `（--dry-run: 書いていない）台帳に ${entries.length} 件足すと ${ledger.entries.length} 件\n`
    );
  } else {
    await io.writeTextFile(joinPath(a.root, LEDGER_PATH), text);
    io.stdout(`${LEDGER_PATH} に ${entries.length} 件足した（全 ${ledger.entries.length} 件）\n`);
  }
  return 0;
}

async function importDraft(io: CliIo, a: Args): Promise<number> {
  const file = need(a.file, '下書きの JSON のパス');
  const batch = need(a.batch, '--batch');
  const preset = PRESETS[need(a.preset, '--preset')];
  if (!preset)
    throw new Error(
      `知らない --preset: ${a.preset}（あるのは ${Object.keys(PRESETS).join(', ')}）`
    );
  const items = itemsOf(await readRequired(io, file), file) as DraftItem[];
  return importEntries(
    io,
    a,
    items.filter(preset).map(item => draftItemToEntry(item, batch))
  );
}

async function importOwner(io: CliIo, a: Args): Promise<number> {
  const file = need(a.file, 'オーナーの書き出しの JSON のパス');
  const batch = need(a.batch, '--batch');
  const items = itemsOf(await readRequired(io, file), file) as OwnerItem[];
  const entries = items
    .map(item => ownerItemToEntry(item, batch))
    .filter((e): e is LedgerEntry => e !== null);
  return importEntries(io, a, entries);
}

/** 台帳から作るもの（パス → 中身）。seed は今のファイルに台帳を当てたもの */
async function buildOutputs(io: CliIo, a: Args): Promise<Map<string, string>> {
  const batch = need(a.batch, '--batch');
  const version = need(a.version, '--version');
  if (!/^\d{14}$/.test(version)) throw new Error(`--version は 14 桁の数字: ${version}`);
  const ledger = await readLedger(io, a.root);
  if (!ledger) throw new Error(`台帳が無い: ${LEDGER_PATH}`);
  const entries = ledger.entries.filter(e => e.batch === batch);
  if (entries.length === 0) throw new Error(`第${batch}弾の行が台帳に無い`);

  const outputs = new Map<string, string>();
  let seedRows = 0;
  const seeds = new Map<string, string>();
  for (const path of SEED_FILES) {
    const text = await readRequired(io, joinPath(a.root, path));
    seedRows += countSeedRows(text);
    if (ledger.entries.some(e => e.seedFile === path)) {
      seeds.set(path, rewriteSeed(text, path, ledger.entries).text);
    }
  }
  outputs.set(
    migrationPath(version, batch),
    buildMigrationSql(entries, { batch, direction: 'apply', version })
  );
  outputs.set(CHECK_SQL_PATH, buildCheckSql(ledger, seedRows));
  for (const [path, text] of seeds) outputs.set(path, text);
  return outputs;
}

async function generate(io: CliIo, a: Args): Promise<number> {
  const outputs = await buildOutputs(io, a);
  const differ: string[] = [];
  for (const [path, text] of outputs) {
    if ((await io.readTextFile(joinPath(a.root, path))) !== text) differ.push(path);
  }
  if (a.check) {
    if (differ.length > 0) {
      io.stderr(
        `台帳からの生成物と違う（generate をやり直す）:\n${differ.map(p => `  ${p}\n`).join('')}`
      );
      return 1;
    }
    io.stdout(`生成物は台帳と同じ（${outputs.size} ファイル）\n`);
    return 0;
  }
  for (const path of differ) await io.writeTextFile(joinPath(a.root, path), outputs.get(path)!);
  io.stdout(
    differ.length > 0
      ? `書いた:\n${differ.map(p => `  ${p}\n`).join('')}`
      : `変わるものは無い（${outputs.size} ファイル）\n`
  );
  return 0;
}

async function revert(io: CliIo, a: Args): Promise<number> {
  const batch = need(a.batch, '--batch');
  const ledger = await readLedger(io, a.root);
  if (!ledger) throw new Error(`台帳が無い: ${LEDGER_PATH}`);
  const entries = ledger.entries.filter(e => e.batch === batch);
  io.stdout(buildMigrationSql(entries, { batch, direction: 'revert' }));
  return 0;
}

const COMMANDS: Record<string, (io: CliIo, a: Args) => Promise<number>> = {
  'import-draft': importDraft,
  'import-owner': importOwner,
  generate,
  revert,
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
    readTextFile: async path => {
      try {
        return await Deno.readTextFile(path);
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) return null;
        throw e;
      }
    },
    writeTextFile: async (path, text) => {
      const dir = path.slice(0, path.lastIndexOf('/'));
      if (dir) await Deno.mkdir(dir, { recursive: true });
      await Deno.writeTextFile(path, text);
    },
    stdout: text => writeAll(Deno.stdout, text),
    stderr: text => writeAll(Deno.stderr, text),
  };
}

if (import.meta.main) {
  Deno.exit(await runCli(Deno.args, denoIo()));
}
