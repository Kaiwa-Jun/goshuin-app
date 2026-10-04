// 帯の写真（Issue #302）の CLI。候補を作り、選ぶ画面を立て、採ったものを台帳に書く。
//
//   deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts candidates [--root <dir>] [--work <dir>]
//   deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts serve [--port 8302] [--work <dir>]
//   deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts status [--work <dir>]
//   deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts export [--root <dir>] [--work <dir>]
//   SPOT_WIKIDATA_CONTACT=<連絡先> deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts fetch [--root <dir>] [--work <dir>]
//   deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts upload [--dry-run] [--root <dir>] [--work <dir>]（R2_* が要る）
//   deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts verify [--root <dir>]
//   deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts generate [--check] [--root <dir>]
//
// 第2弾（#320）:
//   SPOT_WIKIDATA_CONTACT=<連絡先> deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts manual-link [--root <dir>] [--work <dir>]
//   SPOT_WIKIDATA_CONTACT=<連絡先> deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts gather [--root <dir>] [--work <dir>]
//   deno run -A --node-modules-dir=none supabase/scripts/spot-photos/main.ts pool [--check] [--root <dir>] [--work <dir>]
//
// --root の既定はカレントディレクトリ（リポジトリの直下で打つ）、--work の既定は $HOME/goshuin-work/spot-photos。
// エラーは標準エラーに、寺社の名前・都道府県か無いファイルの名前を含めて出し、終了コード 1。
// 契約書: docs/issues/issue-302-spot-photo-band.md（D-1・D-7・D-9・D-19・D-20・「CLI」）、
//         docs/issues/issue-320-spot-photos-batch2.md（D-2〜D-6・D-12・「CLI」）
import { SEED_FILES } from '../spot-coords/coords.ts';
import {
  MAPPING_PATH,
  parseMapping,
  parsePhotos,
  type Photos,
  PHOTOS_PATH,
  readSeedRows,
  type SeedRow,
  serializeJson,
} from '../spot-wikidata/match.ts';
import {
  BATCH2_DIR,
  buildPool320,
  type Gathered320,
  MANUAL_PATH,
  manual320Of,
  parseGathered320,
  parseManual320,
  parsePool320,
  POOL_PATH,
  spots320,
  targets320,
} from './batch2.ts';
import {
  fetchPhotos,
  type NetIo,
  R2_ENV_NAMES,
  StopError,
  uploadPhotos,
  verifyPhotos,
} from './fetchers.ts';
import { gatherSpots, manualLink, parseDraft } from './gather.ts';
import {
  buildCandidates,
  buildCheckSql,
  buildLedger,
  buildMigrationSql,
  type Candidates,
  CHECK_SQL_PATH,
  type Choice,
  type Ledger302,
  LEDGER_PATH,
  MIGRATION_PATH,
  parseChoices,
  parseLedger302,
  label,
  REJECT_REASONS,
} from './select.ts';
import {
  CANDIDATES_FILE,
  CHOICES_FILE,
  DEFAULT_PORT,
  loadCandidates,
  startServer,
} from './server.ts';

export interface CliIo extends NetIo {
  /** 無いときは null */
  readTextFile(path: string): Promise<string | null>;
  /** 親のフォルダも作る */
  writeTextFile(path: string, text: string): Promise<void>;
  env(name: string): string | undefined;
}

export interface Args {
  command: string;
  root: string;
  work: string | null;
  port?: number;
  check: boolean;
  dryRun: boolean;
}

const VALUE_FLAGS = ['--root', '--work', '--port'];

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  const a: Args = { command: command ?? '', root: '.', work: null, check: false, dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--check') a.check = true;
    else if (arg === '--dry-run') a.dryRun = true;
    else if (VALUE_FLAGS.includes(arg)) {
      const v = rest[++i];
      if (v === undefined) throw new Error(`${arg} の値が無い`);
      if (arg === '--root') a.root = v;
      else if (arg === '--work') a.work = v;
      else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1) throw new Error(`${arg} は 1 以上の整数: ${v}`);
        a.port = n;
      }
    } else throw new Error(`知らない引数: ${arg}`);
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
  return `${home}/goshuin-work/spot-photos`;
}

export async function readRequired(io: CliIo, path: string): Promise<string> {
  const text = await io.readTextFile(path);
  if (text === null) throw new Error(`ファイルが無い: ${path}`);
  return text;
}

export async function loadSeedRows(io: CliIo, root: string): Promise<SeedRow[]> {
  const files = [];
  for (const path of SEED_FILES) {
    files.push({ path, text: await readRequired(io, joinPath(root, path)) });
  }
  return readSeedRows(files);
}

/** #301 の写真の候補（対応表と食い違わないかも見る）と seed */
async function loadSources(
  io: CliIo,
  root: string
): Promise<{ photos: Photos; candidates: Candidates; rows: SeedRow[] }> {
  const photosText = await readRequired(io, joinPath(root, PHOTOS_PATH));
  const mapping = parseMapping(await readRequired(io, joinPath(root, MAPPING_PATH)));
  const photos = parsePhotos(photosText, mapping);
  const rows = await loadSeedRows(io, root);
  return { photos, candidates: buildCandidates(photos, mapping, rows), rows };
}

async function readCandidates(io: CliIo, work: string): Promise<Candidates> {
  const path = `${work}/review/${CANDIDATES_FILE}`;
  const text = await io.readTextFile(path);
  if (text === null)
    throw new Error(`${CANDIDATES_FILE} が無い: ${path}（先に candidates を打つ）`);
  return JSON.parse(text) as Candidates;
}

async function readChoices(io: CliIo, work: string, candidates: Candidates): Promise<Choice[]> {
  const text = await io.readTextFile(`${work}/review/${CHOICES_FILE}`);
  return text === null ? [] : parseChoices(text, candidates);
}

// --- candidates ---

async function candidatesCommand(io: CliIo, a: Args): Promise<number> {
  const { candidates } = await loadSources(io, a.root);
  const path = `${workDir(io, a)}/review/${CANDIDATES_FILE}`;
  await io.writeTextFile(path, serializeJson(candidates));
  const c = candidates.counts;
  io.stdout(
    `${path} を書いた（${c.spots} 寺社・${c.files} ファイル。high ${c.high}・medium ${c.medium}）\n`
  );
  return 0;
}

// --- status ---

export function statusText(candidates: Candidates, choices: Choice[]): string {
  const conf = new Map(candidates.entries.map(e => [e.idx, e.linkConfidence]));
  const mine = choices.filter(c => conf.has(c.idx));
  const approved = mine.filter(c => c.decision === 'approve');
  const rejected = mine.filter(c => c.decision === 'reject');
  const high = approved.filter(c => conf.get(c.idx) === 'high').length;
  const total = candidates.entries.length;
  const reasons = REJECT_REASONS.map(
    r => `${r} ${rejected.filter(c => c.decision === 'reject' && c.reason === r).length}`
  );
  return [
    `決めた ${mine.length} / ${total}・採る ${approved.length}（high ${high}・medium ${approved.length - high}）・外す ${rejected.length}・まだ ${total - mine.length}`,
    `外した理由: ${reasons.join('・')}`,
    '',
  ].join('\n');
}

async function status(io: CliIo, a: Args): Promise<number> {
  const work = workDir(io, a);
  const candidates = await readCandidates(io, work);
  io.stdout(statusText(candidates, await readChoices(io, work, candidates)));
  return 0;
}

// --- export ---

async function exportCommand(io: CliIo, a: Args): Promise<number> {
  const { photos, candidates, rows } = await loadSources(io, a.root);
  const work = workDir(io, a);
  // 画面のデータと、いまの #301・規則から作った候補が同じでなければ、選んだものは信じない
  const saved = await readCandidates(io, work);
  if (JSON.stringify(saved) !== JSON.stringify(candidates)) {
    throw new Error(
      `${work}/review/${CANDIDATES_FILE} が、いまの #301 から作る候補と違う（candidates を打ち直して選び直す）`
    );
  }
  const choices = await readChoices(io, work, candidates);
  const ledger = buildLedger(choices, photos, rows);
  if (ledger.entries.length === 0) throw new Error('採ったものが無い（台帳は書かない）');
  const path = joinPath(a.root, LEDGER_PATH);
  await io.writeTextFile(path, serializeJson(ledger));
  const pending = candidates.entries.length - choices.length;
  if (pending > 0) io.stderr(`まだ ${pending} 件（決めていない寺社は台帳に入らない）\n`);
  const medium = ledger.entries.filter(e => e.linkConfidence === 'medium').length;
  io.stdout(
    `${LEDGER_PATH} を書いた（採る ${ledger.entries.length} 件。high ${ledger.entries.length - medium}・medium ${medium}）\n`
  );
  return 0;
}

// --- serve ---

async function serve(io: CliIo, a: Args): Promise<number> {
  const work = workDir(io, a);
  await loadCandidates(work);
  const server = await startServer({
    work,
    port: a.port ?? DEFAULT_PORT,
    onListen: (port, count) => io.stdout(`http://127.0.0.1:${port}/ で開けます（${count} 寺社）\n`),
  });
  await server.finished;
  return 0;
}

// --- 台帳を読む（fetch・upload・verify・generate） ---

async function loadLedger(
  io: CliIo,
  root: string
): Promise<{ ledger: Ledger302; rows: SeedRow[] }> {
  const text = await readRequired(io, joinPath(root, LEDGER_PATH));
  const photos = parsePhotos(
    await readRequired(io, joinPath(root, PHOTOS_PATH)),
    parseMapping(await readRequired(io, joinPath(root, MAPPING_PATH)))
  );
  const rows = await loadSeedRows(io, root);
  return { ledger: parseLedger302(text, photos, rows), rows };
}

// --- fetch ---

async function fetchCommand(io: CliIo, a: Args): Promise<number> {
  const contact = io.env('SPOT_WIKIDATA_CONTACT')?.trim();
  if (!contact) {
    throw new Error(
      'SPOT_WIKIDATA_CONTACT が無い。Commons の User-Agent に入れる連絡先を環境変数で渡す（何も取っていない）'
    );
  }
  const { ledger } = await loadLedger(io, a.root);
  const started = io.now();
  try {
    const r = await fetchPhotos(ledger.entries, { io, work: workDir(io, a), contact });
    const sec = Math.round((io.now() - started) / 1000);
    io.stdout(
      `取った ${r.saved} 件 / キャッシュにあった ${r.cached} 件 / 失敗 ${r.failed.length} 件（${sec} 秒）\n`
    );
    return r.failed.length === 0 ? 0 : 1;
  } catch (e) {
    if (e instanceof StopError) {
      io.stderr(`エラー: ${e.message}。取れた分は残る（同じコマンドで続きから）\n`);
      return 1;
    }
    throw e;
  }
}

// --- upload ---

async function upload(io: CliIo, a: Args): Promise<number> {
  const { ledger } = await loadLedger(io, a.root);
  const env = Object.fromEntries(R2_ENV_NAMES.map(n => [n, io.env(n)]));
  return await uploadPhotos(ledger.entries, { io, work: workDir(io, a), env, dryRun: a.dryRun });
}

// --- verify ---

async function verify(io: CliIo, a: Args): Promise<number> {
  const { ledger } = await loadLedger(io, a.root);
  return await verifyPhotos(ledger.entries, { io });
}

// --- generate ---

async function generate(io: CliIo, a: Args): Promise<number> {
  const { ledger, rows } = await loadLedger(io, a.root);
  const outputs: [string, string][] = [
    [MIGRATION_PATH, buildMigrationSql(ledger.entries)],
    [CHECK_SQL_PATH, buildCheckSql(ledger, rows.length)],
  ];
  const differ: string[] = [];
  for (const [path, text] of outputs) {
    if ((await io.readTextFile(joinPath(a.root, path))) !== text) differ.push(path);
  }
  if (a.check) {
    if (differ.length > 0) {
      io.stderr(
        `台帳から作るものと違う（generate をやり直す）:\n${differ.map(p => `  ${p}\n`).join('')}`
      );
      return 1;
    }
    io.stdout(`生成物は台帳と同じ（${outputs.length} ファイル・${ledger.entries.length} 件）\n`);
    return 0;
  }
  for (const [path, text] of outputs) {
    if (differ.includes(path)) await io.writeTextFile(joinPath(a.root, path), text);
  }
  io.stdout(
    differ.length > 0
      ? `書いた（${ledger.entries.length} 件）:\n${differ.map(p => `  ${p}\n`).join('')}`
      : `変わるものは無い（${outputs.length} ファイル）\n`
  );
  return 0;
}

// --- #320: 第2弾の対象（台帳の第1弾の行だけを見る） ---

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 台帳の第1弾の行だけを読む（第2弾の行があっても、第2弾の候補なしで読める） */
function ledgerBatch1(text: string, photos: Photos, rows: SeedRow[]): Ledger302 {
  const raw = JSON.parse(text);
  if (!isObject(raw) || !Array.isArray(raw.entries)) return parseLedger302(raw, photos, rows);
  return parseLedger302(
    { ...raw, entries: raw.entries.filter(e => isObject(e) && e.batch === 1) },
    photos,
    rows
  );
}

async function loadTargets(io: CliIo, root: string) {
  const mapping = parseMapping(await readRequired(io, joinPath(root, MAPPING_PATH)));
  const photos = parsePhotos(await readRequired(io, joinPath(root, PHOTOS_PATH)), mapping);
  const rows = await loadSeedRows(io, root);
  const ledger1 = ledgerBatch1(await readRequired(io, joinPath(root, LEDGER_PATH)), photos, rows);
  return { mapping, photos, rows, ledger1, targets: targets320(rows, ledger1) };
}

function requireContact(io: CliIo): string {
  const contact = io.env('SPOT_WIKIDATA_CONTACT')?.trim();
  if (!contact) {
    throw new Error(
      'SPOT_WIKIDATA_CONTACT が無い。Wikidata・Commons の User-Agent に入れる連絡先を環境変数で渡す（何も呼んでいない）'
    );
  }
  return contact;
}

function seconds(io: CliIo, started: number): number {
  return Math.round((io.now() - started) / 1000);
}

// --- manual-link（D-12） ---

async function manualLinkCommand(io: CliIo, a: Args): Promise<number> {
  const contact = requireContact(io);
  const work = `${workDir(io, a)}/${BATCH2_DIR}`;
  const draft = parseDraft(await readRequired(io, `${work}/manual-draft.json`));
  const { mapping, rows, targets } = await loadTargets(io, a.root);
  const started = io.now();
  let r;
  try {
    r = await manualLink({ io, work, contact, draft, rows, ctx: { targets, mapping } });
  } catch (e) {
    if (e instanceof StopError) {
      io.stderr(`エラー: ${e.message}。取れた項目はキャッシュに残る（同じコマンドで続きから）\n`);
      return 1;
    }
    throw e;
  }
  const calls = `呼び出し ${r.calls} 回（${seconds(io, started)} 秒）`;
  if (r.entries === null) {
    for (const f of r.failures) io.stderr(`${f}\n`);
    io.stderr(
      `エラー: 規則を通らない行が ${r.failures.length} 行ある（${MANUAL_PATH} は書いていない。下書きを直して打ち直す）。${calls}\n`
    );
    return 1;
  }
  const manual = parseManual320(manual320Of(r.entries), rows, mapping, targets);
  await io.writeTextFile(joinPath(a.root, MANUAL_PATH), serializeJson(manual));
  io.stdout(`${MANUAL_PATH} を書いた（${manual.entries.length} 寺社）/ ${calls}\n`);
  return 0;
}

// --- gather（D-4） ---

async function loadSpots(io: CliIo, root: string) {
  const t = await loadTargets(io, root);
  const manual = parseManual320(
    await readRequired(io, joinPath(root, MANUAL_PATH)),
    t.rows,
    t.mapping,
    t.targets
  );
  return { ...t, manual, spots: spots320(t.targets, t.mapping, manual) };
}

async function gatherCommand(io: CliIo, a: Args): Promise<number> {
  const contact = requireContact(io);
  const { spots } = await loadSpots(io, a.root);
  const started = io.now();
  const r = await gatherSpots(spots, { io, work: `${workDir(io, a)}/${BATCH2_DIR}`, contact });
  const line = `集めた ${r.gathered} 寺社 / キャッシュにあった ${r.cached} 寺社 / 呼び出し ${r.calls} 回（${seconds(io, started)} 秒）\n`;
  if (r.stopped !== null) {
    io.stderr(`エラー: ${r.stopped}。終わった寺社は残る（同じコマンドで続きから）\n${line}`);
    return 1;
  }
  io.stdout(line);
  return 0;
}

// --- pool（D-5・D-6） ---

/** JSON として同じか（コミットのときに prettier が整形しても同じとみなす） */
function sameJson(text: string | null, value: unknown): boolean {
  if (text === null) return false;
  try {
    return JSON.stringify(JSON.parse(text)) === JSON.stringify(value);
  } catch {
    return false;
  }
}

async function poolCommand(io: CliIo, a: Args): Promise<number> {
  const { rows, mapping, photos, ledger1, targets, manual, spots } = await loadSpots(io, a.root);
  const work = `${workDir(io, a)}/${BATCH2_DIR}`;
  const gathered = new Map<number, Gathered320>();
  const absent: string[] = [];
  for (const s of spots) {
    if (s.qid === null) continue;
    const text = await io.readTextFile(`${work}/gather/${s.idx}.json`);
    if (text === null) absent.push(`${label(s)}: ${work}/gather/${s.idx}.json が無い\n`);
    else gathered.set(s.idx, parseGathered320(text));
  }
  if (absent.length > 0) {
    io.stderr(absent.join(''));
    throw new Error(`集めた値が無い寺社が ${absent.length} ある（先に gather を打つ）`);
  }
  const pool = buildPool320(spots, gathered, { ledger: ledger1, photos301: photos });
  parsePool320(pool, { rows, mapping, manual, targets, photos301: photos, ledger: ledger1 });
  const path = joinPath(a.root, POOL_PATH);
  const same = sameJson(await io.readTextFile(path), pool);
  const c = pool.counts;
  const summary = `対象 ${c.targets}・候補あり ${c.withFiles}・結べない ${c.noQid}・候補のファイルが無い ${c.noFiles}・手で結んだ ${c.manual}・ファイル ${c.files}・一覧が切れた ${c.truncated}`;
  if (a.check) {
    if (!same) {
      io.stderr(`いまの集めた値から作る候補と違う（pool をやり直す）:\n  ${POOL_PATH}\n`);
      return 1;
    }
    io.stdout(`${POOL_PATH} は集めた値と同じ（${summary}）\n`);
    return 0;
  }
  if (same) {
    io.stdout(`変わるものは無い（${POOL_PATH}。${summary}）\n`);
    return 0;
  }
  await io.writeTextFile(path, serializeJson(pool));
  io.stdout(`${POOL_PATH} を書いた（${summary}）\n`);
  return 0;
}

// --- 入口 ---

export type Command = (io: CliIo, a: Args) => Promise<number>;

const COMMANDS: Record<string, Command> = {
  candidates: candidatesCommand,
  serve,
  status,
  export: exportCommand,
  fetch: fetchCommand,
  upload,
  verify,
  generate,
  'manual-link': manualLinkCommand,
  gather: gatherCommand,
  pool: poolCommand,
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
      // 途中で止まっても半端なファイルを残さない
      const tmp = `${path}.tmp-${crypto.randomUUID()}`;
      await Deno.writeTextFile(tmp, text);
      await Deno.rename(tmp, path);
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
      const tmp = `${path}.tmp-${crypto.randomUUID()}`;
      await Deno.writeFile(tmp, data);
      await Deno.rename(tmp, path);
    },
    exists: async path => {
      try {
        await Deno.stat(path);
        return true;
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) return false;
        throw e;
      }
    },
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    stdout: text => writeAll(Deno.stdout, text),
    stderr: text => writeAll(Deno.stderr, text),
    env: name => Deno.env.get(name),
  };
}

if (import.meta.main) {
  Deno.exit(await runCli(Deno.args, denoIo()));
}
