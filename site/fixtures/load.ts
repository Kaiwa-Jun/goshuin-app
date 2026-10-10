// テストで読む本物の入力（seed・写真の台帳・座標の台帳・受付時間の seed・slug の台帳）。ネットに出ない。
// 読むのは一度だけ（deno test site/ は全部のテストのファイルを1つのプロセスで流す）
import { loadInputs, type SiteInputs } from '../data.ts';

export const REPO = new URL('../../', import.meta.url);
export const REPO_DIR = decodeURIComponent(REPO.pathname).replace(/\/$/, '');
export const readRepo = (rel: string) => Deno.readTextFile(new URL(rel, REPO));
export const readFixture = (name: string) =>
  Deno.readTextFile(new URL(`./${name}`, import.meta.url));

let inputs: Promise<SiteInputs> | null = null;

/** 本物の入力（一度だけ読む。テストで書き換えない） */
export function realInputs(): Promise<SiteInputs> {
  inputs ??= loadInputs(readRepo);
  return inputs;
}

/** フォルダの下の全ファイルと中身（書いていないことを確かめる） */
export async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (d: string) => {
    let entries: Deno.DirEntry[];
    try {
      entries = [...(await Array.fromAsync(Deno.readDir(d)))];
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return;
      throw e;
    }
    for (const e of entries) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory) await walk(p);
      else out[p.slice(dir.length + 1)] = await Deno.readTextFile(p);
    }
  };
  await walk(dir);
  return out;
}

/** 本物の seed 10 本・台帳・受付時間の seed・slug の台帳・docs/legal を写した、一時のリポジトリの直下 */
export async function makeRoot(
  opts: {
    /** slug の台帳の中身（null なら置かない。既定は本物） */
    slugsText?: string | null;
    /** seed の末尾に足す行（ファイル → 行） */
    seedAppend?: Record<string, string>;
    /** site/static を写す（既定 true） */
    statics?: boolean;
  } = {}
): Promise<string> {
  const { SEED_FILES } = await import('../../supabase/scripts/spot-coords/coords.ts');
  const { INPUT_PATHS } = await import('../data.ts');
  const root = await Deno.makeTempDir({ prefix: 'site-root-' });
  const copy = async (rel: string, text?: string) => {
    const to = `${root}/${rel}`;
    await Deno.mkdir(to.slice(0, to.lastIndexOf('/')), { recursive: true });
    await Deno.writeTextFile(to, text ?? (await readRepo(rel)));
  };
  for (const path of SEED_FILES) {
    const extra = opts.seedAppend?.[path];
    await copy(path, extra ? (await readRepo(path)) + extra : undefined);
  }
  await copy(INPUT_PATHS.photos);
  await copy(INPUT_PATHS.coords);
  await copy(INPUT_PATHS.hours);
  await copy('docs/legal/privacy.html');
  await copy('docs/legal/terms.html');
  if (opts.slugsText !== null) await copy(INPUT_PATHS.slugs, opts.slugsText);
  if (opts.statics !== false) {
    const walk = async (rel: string) => {
      for await (const e of Deno.readDir(new URL(rel, REPO))) {
        const p = `${rel}/${e.name}`;
        if (e.isDirectory) await walk(p);
        else {
          await Deno.mkdir(`${root}/${rel}`, { recursive: true });
          await Deno.copyFile(new URL(p, REPO), `${root}/${p}`);
        }
      }
    };
    try {
      await walk('site/static');
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }
  return root;
}

/** 出力を貯める io */
export function captureIo() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { stdout: (s: string) => void out.push(s), stderr: (s: string) => void err.push(s) },
    out: () => out.join(''),
    err: () => err.join(''),
  };
}

/** 例外を投げることを確かめ、その文を返す */
export function errorOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error('例外が出なかった');
}
