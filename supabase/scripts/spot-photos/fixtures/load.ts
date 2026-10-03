// テストで読むフィクスチャと、本物の seed・対応表（ネットに出ない）。
// photos-301.json は #301 の spot-photos-301.json の本物の 20 寺社（各場合を1行ずつ）、
// ledger-302.json はそこから作った台帳 3 行、work/ は選ぶ画面を Playwright で見る作業フォルダの写し
import { SEED_FILES } from '../../spot-coords/coords.ts';
import {
  type Mapping,
  parseMapping,
  parsePhotos,
  type Photos,
  readSeedRows,
  type SeedRow,
} from '../../spot-wikidata/match.ts';
import { buildCandidates, type Candidates } from '../select.ts';

export const REPO = new URL('../../../../', import.meta.url);
export const readRepo = (rel: string) => Deno.readTextFile(new URL(rel, REPO));
export const readFixture = (name: string) =>
  Deno.readTextFile(new URL(`./${name}`, import.meta.url));

export async function realSeedRows(): Promise<SeedRow[]> {
  return readSeedRows(
    await Promise.all(SEED_FILES.map(async path => ({ path, text: await readRepo(path) })))
  );
}

export async function realMapping(): Promise<Mapping> {
  return parseMapping(await readRepo('supabase/data/spot-wikidata-301.json'));
}

export async function fixturePhotos(): Promise<Photos> {
  return parsePhotos(await readFixture('photos-301.json'), await realMapping());
}

export async function fixtureCandidates(): Promise<Candidates> {
  return buildCandidates(await fixturePhotos(), await realMapping(), await realSeedRows());
}

/** 台帳のフィクスチャ（読んだだけの値。テストで書き換える） */
export async function fixtureLedgerJson(): Promise<
  Record<string, unknown> & { entries: Record<string, unknown>[] }
> {
  return JSON.parse(await readFixture('ledger-302.json'));
}

/** 本物の seed 10 本とフィクスチャ（または本物）の #301 を持つ、一時のリポジトリの直下 */
export async function makeRoot(
  opts: { photos?: 'fixture' | 'real' | 'none'; mapping?: boolean; ledger?: boolean } = {}
): Promise<string> {
  const root = await Deno.makeTempDir({ prefix: 'spot-photos-root-' });
  const copy = async (rel: string, text?: string) => {
    const to = `${root}/${rel}`;
    await Deno.mkdir(to.slice(0, to.lastIndexOf('/')), { recursive: true });
    await Deno.writeTextFile(to, text ?? (await readRepo(rel)));
  };
  for (const path of SEED_FILES) await copy(path);
  if (opts.mapping !== false) await copy('supabase/data/spot-wikidata-301.json');
  const photos = opts.photos ?? 'fixture';
  if (photos === 'fixture') {
    await copy('supabase/data/spot-photos-301.json', await readFixture('photos-301.json'));
  } else if (photos === 'real') {
    await copy('supabase/data/spot-photos-301.json');
  }
  if (opts.ledger) {
    await copy('supabase/data/spot-photos-302.json', await readFixture('ledger-302.json'));
  }
  return root;
}

/** フォルダの下の全ファイルと中身（書いていないことを確かめる） */
export async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (d: string) => {
    for await (const e of Deno.readDir(d)) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory) await walk(p);
      else out[p.slice(dir.length + 1)] = await Deno.readTextFile(p);
    }
  };
  await walk(dir);
  return out;
}

/** ドル引用を閉じて、その後ろに SQL を足そうとする撮影者の文字 */
export const EVIL_AUTHORS = [
  'x$spot_photos_302$; DROP TABLE public.spots; DO $spot_photos_302$',
  'a $photos$ b',
  'c $$ d $spot_photos_302_check$; DROP TABLE public.spots; DO $spot_photos_302_check$',
];
