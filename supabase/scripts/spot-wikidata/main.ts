// 寺社と Wikidata の対応表・写真の候補・#292 第2弾の画面のデータを作る CLI（Issue #301）。
//
//   SPOT_WIKIDATA_CONTACT=<連絡先> deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts fetch all [--work <dir>] [--limit <n>]
//     段ごと: fetch wikidata / fetch gsi / fetch osm / fetch commons
//   deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts status [--work <dir>]
//   deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts build [--check] [--root <dir>] [--work <dir>]
//   deno run -A --node-modules-dir=none supabase/scripts/spot-wikidata/main.ts review-data [--root <dir>] [--work <dir>]
//
// --root の既定はカレントディレクトリ（リポジトリの直下で打つ）、--work の既定は $HOME/goshuin-work/spot-wikidata。
// エラーは標準エラーに出し、終了コード 1。契約書: docs/issues/issue-301-spot-wikidata.md（D-12・D-15・D-16）
import { type Ledger, LEDGER_PATH, parseLedger, SEED_FILES } from '../spot-coords/coords.ts';
import {
  analyze,
  type Analysis,
  Cache,
  Client,
  type Ctx,
  LimitError,
  RESUME,
  type Stage,
  STAGES,
  StopError,
} from './fetchers.ts';
import {
  MAPPING_PATH,
  parseMapping,
  parsePhotos,
  PHOTOS_PATH,
  readSeedRows,
  type SeedRow,
  serializeJson,
} from './match.ts';

export interface CliIo {
  /** 無いときは null */
  readTextFile(path: string): Promise<string | null>;
  /** 親のフォルダも作る */
  writeTextFile(path: string, text: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array | null>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  stdout(text: string): void;
  stderr(text: string): void;
  env(name: string): string | undefined;
  fetch(input: string, init: RequestInit): Promise<Response>;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** 時間切れの信号（本物だけ） */
  timeout?: (ms: number) => AbortSignal | undefined;
}

export interface Args {
  command: string;
  positional: string[];
  root: string;
  work: string | null;
  limit?: number;
  port?: number;
  check: boolean;
}

const VALUE_FLAGS = ['--root', '--work', '--limit', '--port'];

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  const a: Args = { command: command ?? '', positional: [], root: '.', work: null, check: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--check') a.check = true;
    else if (VALUE_FLAGS.includes(arg)) {
      const v = rest[++i];
      if (v === undefined) throw new Error(`${arg} の値が無い`);
      if (arg === '--root') a.root = v;
      else if (arg === '--work') a.work = v;
      else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1) throw new Error(`${arg} は 1 以上の整数: ${v}`);
        if (arg === '--limit') a.limit = n;
        else a.port = n;
      }
    } else if (arg.startsWith('--')) throw new Error(`知らない引数: ${arg}`);
    else a.positional.push(arg);
  }
  return a;
}

export function joinPath(root: string, rel: string): string {
  return `${root.replace(/\/+$/, '')}/${rel}`;
}

export function workDir(io: CliIo, a: Args): string {
  if (a.work) return a.work.replace(/\/+$/, '');
  const home = io.env('HOME');
  if (!home) throw new Error('HOME が無い。--work で作業フォルダを渡す');
  return `${home}/goshuin-work/spot-wikidata`;
}

export async function readRequired(io: CliIo, path: string): Promise<string> {
  const text = await io.readTextFile(path);
  if (text === null) throw new Error(`ファイルが無い: ${path}`);
  return text;
}

export async function loadSeedAndLedger(
  io: CliIo,
  root: string
): Promise<{ rows: SeedRow[]; ledger: Ledger }> {
  const files = [];
  for (const path of SEED_FILES) {
    files.push({ path, text: await readRequired(io, joinPath(root, path)) });
  }
  const rows = readSeedRows(files);
  const ledger = parseLedger(await readRequired(io, joinPath(root, LEDGER_PATH)));
  return { rows, ledger };
}

async function context(io: CliIo, a: Args): Promise<Ctx> {
  const { rows, ledger } = await loadSeedAndLedger(io, a.root);
  const cache = new Cache(
    workDir(io, a),
    { readFile: io.readFile, writeFile: io.writeFile },
    io.now
  );
  return { rows, ledger, cache };
}

// --- status ---

function statusText(an: Analysis): string {
  const lines: string[] = [];
  for (const stage of STAGES) {
    const steps = an.steps.filter(s => s.stage === stage);
    if (steps.length === 0) {
      lines.push(`${stage}: （前の段が終わってから数える）`);
      continue;
    }
    for (const s of steps) {
      lines.push(
        `${stage} ${s.label}: 要る ${s.need}・取った ${s.done}・残り ${s.need - s.done}${s.optional ? '（任意。取れなくても先に進める）' : ''}`
      );
    }
  }
  return lines.join('\n') + '\n';
}

function remainingText(an: Analysis): string {
  const b = an.blocked;
  if (!b) return '残り 0';
  return `${b.step.stage} ${b.step.label} の残り ${b.step.need - b.step.done}`;
}

async function status(io: CliIo, a: Args): Promise<number> {
  const an = await analyze(await context(io, a));
  io.stdout(statusText(an));
  return 0;
}

// --- fetch ---

async function fetchCommand(io: CliIo, a: Args): Promise<number> {
  const which = a.positional[0];
  const stages: Stage[] =
    which === 'all' ? [...STAGES] : STAGES.includes(which as Stage) ? [which as Stage] : [];
  if (stages.length === 0) {
    throw new Error(`fetch の段は all / ${STAGES.join(' / ')} のどれか: ${which ?? '（無い）'}`);
  }
  const contact = io.env('SPOT_WIKIDATA_CONTACT')?.trim();
  if (!contact) {
    throw new Error(
      'SPOT_WIKIDATA_CONTACT が無い。Wikimedia と Nominatim の User-Agent に入れる連絡先を環境変数で渡す（何も取っていない）'
    );
  }
  const ctx = await context(io, a);
  const client = new Client({
    fetch: io.fetch,
    now: io.now,
    sleep: io.sleep,
    contact,
    limit: a.limit,
    timeout: io.timeout,
  });
  const triedWdqs = new Set<string>();
  try {
    for (;;) {
      const an = await analyze(ctx);
      if (stages.includes('wikidata')) {
        const wdqs = an.wdqsTasks.filter(t => !triedWdqs.has(t.id));
        if (wdqs.length > 0) {
          io.stderr(`wikidata WDQS（任意）: ${wdqs.length} 回\n`);
          for (const t of wdqs) {
            triedWdqs.add(t.id);
            await t.run(client);
          }
          continue;
        }
      }
      if (!an.blocked) break;
      const at = an.blocked.step.stage;
      if (!stages.includes(at)) {
        if (STAGES.indexOf(at) < STAGES.indexOf(stages[0])) {
          throw new Error(`先に fetch ${at} を終える（${remainingText(an)}）`);
        }
        break;
      }
      const tasks = an.blocked.tasks;
      io.stderr(`${at} ${an.blocked.step.label}: ${tasks.length} 回取る\n`);
      for (const [i, t] of tasks.entries()) {
        await t.run(client);
        if ((i + 1) % 100 === 0) io.stderr(`  … ${i + 1} / ${tasks.length}\n`);
      }
    }
  } catch (e) {
    if (e instanceof LimitError) {
      io.stderr(`${e.message}（この回は ${client.calls} 回呼んだ）。${RESUME}\n`);
      io.stdout(statusText(await analyze(ctx)));
      return 0;
    }
    if (e instanceof StopError) {
      io.stderr(`エラー: ${e.message}\n${RESUME}\n`);
      return 1;
    }
    throw e;
  }
  io.stderr(`この回は ${client.calls} 回呼んだ\n`);
  io.stdout(statusText(await analyze(ctx)));
  return 0;
}

// --- build ---

function sameJson(text: string | null, value: unknown): boolean {
  if (text === null) return false;
  try {
    return JSON.stringify(JSON.parse(text)) === JSON.stringify(value);
  } catch {
    return false;
  }
}

async function build(io: CliIo, a: Args): Promise<number> {
  const an = await analyze(await context(io, a));
  if (!an.outputs) {
    io.stderr(`キャッシュに残りがある（${remainingText(an)}）。fetch all を打ち直す\n`);
    return 1;
  }
  const { mapping, photos, summary } = an.outputs;
  // 書く前に、公開の検査を通す（D-13）
  parsePhotos(photos, parseMapping(mapping));
  const outputs: [string, unknown][] = [
    [MAPPING_PATH, mapping],
    [PHOTOS_PATH, photos],
  ];
  const differ: string[] = [];
  for (const [path, value] of outputs) {
    if (!sameJson(await io.readTextFile(joinPath(a.root, path)), value)) differ.push(path);
  }
  if (a.check) {
    if (differ.length > 0) {
      io.stderr(
        `キャッシュからの生成物と違う（build をやり直す）:\n${differ.map(p => `  ${p}\n`).join('')}`
      );
      return 1;
    }
    io.stdout(`生成物はキャッシュと同じ（${outputs.length} ファイル）\n`);
    return 0;
  }
  for (const [path, value] of outputs) {
    if (differ.includes(path)) {
      await io.writeTextFile(joinPath(a.root, path), serializeJson(value));
    }
  }
  io.stdout(
    differ.length > 0
      ? `書いた:\n${differ.map(p => `  ${p}\n`).join('')}`
      : `変わるものは無い（${outputs.length} ファイル）\n`
  );
  const c = summary.confidence;
  io.stdout(
    [
      `対応表 ${mapping.entries.length} 件: high ${c.high}・medium ${c.medium}・low ${c.low}・none ${c.none}（台帳 ${summary.method.ledger}・規則 ${summary.method.rule}）`,
      `写真の候補: ${summary.photoRows} 寺社・${summary.photoFiles} ファイル。Commons に無いファイル ${summary.missingFiles}`,
      `第2弾: suggest ${summary.counts.suggest}・owner ${summary.counts.owner}・investigate ${summary.counts.investigate}・keep ${summary.counts.keep}`,
      '',
    ].join('\n')
  );
  return 0;
}

// --- review-data ---

export const REVIEW_DATA = 'review/review-data.json';

async function reviewData(io: CliIo, a: Args): Promise<number> {
  const ctx = await context(io, a);
  const an = await analyze(ctx);
  if (!an.review) {
    io.stderr(`キャッシュに残りがある（${remainingText(an)}）。fetch all を打ち直す\n`);
    return 1;
  }
  const path = `${ctx.cache.work}/${REVIEW_DATA}`;
  await io.writeTextFile(path, serializeJson(an.review));
  const c = an.review.counts;
  io.stdout(
    `${path} を書いた（画面に出す ${an.review.items.length} 件。suggest ${c.suggest}・owner ${c.owner}・investigate ${c.investigate}・keep ${c.keep}）\n`
  );
  return 0;
}

// --- 入口 ---

export type Command = (io: CliIo, a: Args) => Promise<number>;

const COMMANDS: Record<string, Command> = {
  fetch: fetchCommand,
  status,
  build,
  'review-data': reviewData,
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

async function ensureDir(path: string): Promise<void> {
  const dir = path.slice(0, path.lastIndexOf('/'));
  if (dir) await Deno.mkdir(dir, { recursive: true });
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
      await ensureDir(path);
      await Deno.writeTextFile(path, text);
    },
    readFile: async path => {
      try {
        return await Deno.readFile(path);
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) return null;
        throw e;
      }
    },
    writeFile: async (path, data) => {
      await ensureDir(path);
      // 途中で止まっても半端なファイルを残さない
      const tmp = `${path}.tmp-${crypto.randomUUID()}`;
      await Deno.writeFile(tmp, data);
      await Deno.rename(tmp, path);
    },
    stdout: text => writeAll(Deno.stdout, text),
    stderr: text => writeAll(Deno.stderr, text),
    env: name => Deno.env.get(name),
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    timeout: ms => AbortSignal.timeout(ms),
  };
}

if (import.meta.main) {
  Deno.exit(await runCli(Deno.args, denoIo()));
}
