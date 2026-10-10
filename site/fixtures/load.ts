// テストで読む本物の入力（seed・写真の台帳・座標の台帳・受付時間の seed・slug の台帳）。ネットに出ない。
// 読むのは一度だけ（deno test site/ は全部のテストのファイルを1つのプロセスで流す）
import { type Assets, renderSite } from '../build.ts';
import { DEFAULT_CONFIG, type SiteConfig } from '../config.ts';
import { buildSiteData, loadInputs, type SiteData, type SiteInputs } from '../data.ts';

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

let data: Promise<SiteData> | null = null;

/** 本物の入力から作った寺社の一覧（一度だけ作る。テストで書き換えない。書き換えるなら structuredClone） */
export function realData(): Promise<SiteData> {
  data ??= realInputs().then(buildSiteData);
  return data;
}

export const NO_ASSETS: Assets = { screens: false, badge: null };
export const ALL_ASSETS: Assets = { screens: true, badge: { width: 135, height: 40 } };

export async function realLegal() {
  return {
    privacy: await readRepo('docs/legal/privacy.html'),
    terms: await readRepo('docs/legal/terms.html'),
  };
}

const sites = new Map<string, Promise<Map<string, string>>>();

/** 本物の入力から renderSite で作った生成物（config・素材ごとに一度だけ作る） */
export function realSite(
  config: SiteConfig = DEFAULT_CONFIG,
  assets: Assets = NO_ASSETS
): Promise<Map<string, string>> {
  const key = JSON.stringify([config, assets]);
  if (!sites.has(key)) {
    sites.set(key, (async () => renderSite(await realData(), config, assets, await realLegal()))());
  }
  return sites.get(key)!;
}

/** 生成物を一時のディレクトリに書く（検査のフィクスチャ）。extra はテストだけの仮の素材 */
export async function writeDist(
  files: Map<string, string>,
  extra: Record<string, string> = {}
): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: 'site-dist-' });
  for (const [p, t] of [...files, ...Object.entries(extra)]) {
    const to = `${dir}/${p}`;
    await Deno.mkdir(to.slice(0, to.lastIndexOf('/')), { recursive: true });
    await Deno.writeTextFile(to, t);
  }
  return dir;
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
