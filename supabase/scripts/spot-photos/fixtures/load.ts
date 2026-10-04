// テストで読むフィクスチャと、本物の seed・対応表（ネットに出ない）。
// photos-301.json は #301 の spot-photos-301.json の本物の 20 寺社（各場合を1行ずつ）、
// ledger-302.json はそこから作った台帳 3 行、work/ は選ぶ画面を Playwright で見る作業フォルダの写し。
// #320（第2弾）: wd/ は #301 のキャッシュの本物の Wikidata の項目を trimEntity で縮めた写し
// （皇大神宮は P18 を、戸隠神社は P625（中社と奥社のあいだ）と P373 を変えてある）、
// manual-320.json は wd/ から manual-link で作る手で結ぶ台帳 3 行。
// commons-b2/ は偽の Commons の応答（pages.json は #301 のキャッシュの本物の imageinfo の page、lists.json は
// カテゴリと P180 の一覧）と、そこから gather で集めた値（gather/<idx>.json）、
// pool-320.json はそこから pool で作る候補 7 寺社
import { SEED_FILES } from '../../spot-coords/coords.ts';
import {
  type Mapping,
  parseMapping,
  parsePhotos,
  type Photos,
  readSeedRows,
  type SeedRow,
} from '../../spot-wikidata/match.ts';
import {
  type Gathered320,
  type Manual320,
  parseGathered320,
  parseManual320,
  parsePool320,
  type Pool320,
  type PoolCtx,
  type Spot320,
  spots320,
  targets320,
} from '../batch2.ts';
import { buildCandidates, type Candidates, type Ledger302, parseLedger302 } from '../select.ts';

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

/** 手で結ぶ台帳のフィクスチャ（#320。読んだだけの値。テストで書き換える） */
export async function fixtureManualJson(): Promise<
  Record<string, unknown> & { entries: Record<string, unknown>[] }
> {
  return JSON.parse(await readFixture('manual-320.json'));
}

/** wd/ の Wikidata の項目（wbgetentities の1項目。#301 のキャッシュの本物の項目の写しか、値を変えたもの） */
export async function fixtureWdEntity(qid: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFixture(`wd/${qid}.json`));
}

/** 台帳のフィクスチャ（第1弾 3 行）を読んだもの */
export async function fixtureLedger(): Promise<Ledger302> {
  return parseLedger302(await fixtureLedgerJson(), await fixturePhotos(), await realSeedRows());
}

/** 台帳のフィクスチャ（第1弾 3 行）から見た第2弾の対象（本物の seed の rank 5 から 3 寺社を除いたもの） */
export async function fixtureTargets(): Promise<SeedRow[]> {
  return targets320(await realSeedRows(), await fixtureLedger());
}

export async function fixtureManual(): Promise<Manual320> {
  return parseManual320(
    await fixtureManualJson(),
    await realSeedRows(),
    await realMapping(),
    await fixtureTargets()
  );
}

/** 候補のフィクスチャの 7 寺社（no-qid・high・同じファイルの manual 2・manual（exact）・medium・no-files） */
export const POOL_FIXTURE_IDX: readonly number[] = [9, 41, 347, 348, 421, 544, 890];

/** 候補のフィクスチャの 7 寺社の、集める出どころ */
export async function fixtureSpots(): Promise<Spot320[]> {
  const targets = (await fixtureTargets()).filter(t => POOL_FIXTURE_IDX.includes(t.idx));
  return spots320(targets, await realMapping(), await fixtureManual());
}

/** commons-b2/gather/<idx>.json（偽の Commons から gather で集めた値。Q-ID の無い寺社は無い） */
export async function fixtureGathered(): Promise<Map<number, Gathered320>> {
  const out = new Map<number, Gathered320>();
  for (const s of await fixtureSpots()) {
    if (s.qid === null) continue;
    out.set(s.idx, parseGathered320(await readFixture(`commons-b2/gather/${s.idx}.json`)));
  }
  return out;
}

/** 候補の検査に要るもの（台帳と #301 はフィクスチャ） */
export async function fixturePoolCtx(): Promise<PoolCtx> {
  return {
    rows: await realSeedRows(),
    mapping: await realMapping(),
    manual: await fixtureManual(),
    targets: await fixtureTargets(),
    photos301: await fixturePhotos(),
    ledger: await fixtureLedger(),
  };
}

/** 候補のフィクスチャ（読んだだけの値。テストで書き換える） */
export async function fixturePoolJson(): Promise<
  Record<string, unknown> & { counts: Record<string, number>; entries: Record<string, unknown>[] }
> {
  return JSON.parse(await readFixture('pool-320.json'));
}

export async function fixturePool(): Promise<Pool320> {
  return parsePool320(await fixturePoolJson(), await fixturePoolCtx());
}

/** 本物の seed 10 本とフィクスチャ（または本物）の #301 を持つ、一時のリポジトリの直下 */
export async function makeRoot(
  opts: {
    photos?: 'fixture' | 'real' | 'none';
    mapping?: boolean;
    ledger?: boolean;
    /** 台帳の中身（ledger より先に見る） */
    ledgerText?: string;
    /** 手で結ぶ台帳のフィクスチャ（#320）を置く */
    manual?: boolean;
    /** 第2弾の候補のフィクスチャ（#320）を置く */
    pool?: boolean;
  } = {}
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
  if (opts.ledgerText !== undefined) {
    await copy('supabase/data/spot-photos-302.json', opts.ledgerText);
  } else if (opts.ledger) {
    await copy('supabase/data/spot-photos-302.json', await readFixture('ledger-302.json'));
  }
  if (opts.manual) {
    await copy('supabase/data/spot-wikidata-manual-320.json', await readFixture('manual-320.json'));
  }
  if (opts.pool) {
    await copy('supabase/data/spot-photos-320.json', await readFixture('pool-320.json'));
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
