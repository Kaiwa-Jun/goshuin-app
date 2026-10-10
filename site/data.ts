// 入力（seed・写真の台帳・座標の台帳・受付時間の seed・slug の台帳）を1つの寺社の一覧にまとめる。
// ファイルは読むだけ（関数 read を渡す）。ネットに出ない。
// 契約書: docs/issues/issue-324-homepage.md D-6・D-8〜D-11・D-22・D-23・AC-1・AC-8〜11
import {
  distanceMeters,
  LEDGER_PATH as COORDS_PATH,
  SEED_FILES,
} from '../supabase/scripts/spot-coords/coords.ts';
import { readSeedRows, type SeedRow } from '../supabase/scripts/spot-wikidata/match.ts';
import { NEARBY_LIMIT, NEARBY_RADIUS_M } from './config.ts';
import { formatHours, hostOf, parseReceptionHours, yearMonthOf } from './hours.ts';
import { googleMapsUrl, osmUrl, PHOTO_WIDTH, photoHeight, photoUrl } from './links.ts';
import { type Prefecture, prefectureByName } from './prefectures.ts';
import { matchSlugs, parseSlugLedger, type SlugLedger, SLUGS_PATH } from './slugs.ts';

export const INPUT_PATHS = {
  photos: 'supabase/data/spot-photos-302.json',
  coords: COORDS_PATH,
  hours: 'supabase/seeds/seed_reception_hours_2026-08.sql',
  slugs: SLUGS_PATH,
} as const;

export interface SiteInputs {
  rows: SeedRow[];
  /** seed のファイル → 中身（座標の文字を取り出す） */
  seedTexts: Map<string, string>;
  /** 写真の台帳（spot-photos-302.json を読んだだけの値） */
  photos: { entries: unknown[] };
  /** 座標の台帳（spot-coords-292.json を読んだだけの値） */
  coords: { entries: unknown[] };
  hoursText: string;
  slugs: SlugLedger;
}

export type SpotType = 'shrine' | 'temple';

export interface Photo {
  url: string;
  width: number;
  height: number;
  author: string | null;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
}

export interface Hours {
  open: string;
  close: string | null;
  /** formatHours の結果 */
  text: string;
  notes: string;
  url: string;
  host: string;
  /** `2026年8月` */
  yearMonth: string;
}

export interface Spot {
  idx: number;
  name: string;
  prefecture: string;
  pref: Prefecture;
  type: SpotType;
  address: string;
  lat: number;
  lng: number;
  /** seed の値の文字のまま */
  latText: string;
  lngText: string;
  file: string;
  line: number;
  slug: string;
  hasPage: boolean;
  photo: Photo | null;
  hours: Hours | null;
  /** spot-coords-292.json に (name, prefecture) がある */
  coordsVerified: boolean;
  googleMapsUrl: string;
  /** 座標を確かめた寺社だけ */
  osmUrl: string | null;
  /** 近くの寺社の idx（ページのある寺社だけ・近い順） */
  nearby: number[];
}

export interface SiteData {
  /** seed の順 */
  spots: Spot[];
}

/** ファイルを読む関数（リポジトリの直下からの相対パス）からまとめて読む */
export async function loadInputs(read: (rel: string) => Promise<string>): Promise<SiteInputs> {
  const seedTexts = new Map<string, string>();
  for (const path of SEED_FILES) seedTexts.set(path, await read(path));
  const rows = readSeedRows([...seedTexts].map(([path, text]) => ({ path, text })));
  return {
    rows,
    seedTexts,
    photos: JSON.parse(await read(INPUT_PATHS.photos)),
    coords: JSON.parse(await read(INPUT_PATHS.coords)),
    hoursText: await read(INPUT_PATHS.hours),
    slugs: parseSlugLedger(await read(INPUT_PATHS.slugs)),
  };
}

function label(e: { name: string; prefecture: string }): string {
  return `${e.name}（${e.prefecture}）`;
}

const SEED_COORDS = /^\('(?:[^']|'')*',\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),/;

/** seed の行から座標の文字を取り出す（readSeedRows の数と同じ値であることも見る） */
function coordTexts(row: SeedRow, seedTexts: Map<string, string>): [string, string] {
  const line = seedTexts.get(row.file)?.split('\n')[row.line - 1] ?? '';
  const m = SEED_COORDS.exec(line);
  if (!m || Number(m[1]) !== row.lat || Number(m[2]) !== row.lng) {
    throw new Error(`${label(row)}: seed の ${row.file}:${row.line} から座標の文字を取れない`);
  }
  return [m[1], m[2]];
}

interface PhotoRow {
  idx: number;
  name: string;
  prefecture: string;
  r2Key: string;
  width: number;
  height: number;
  author: string | null;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
  status: string;
}

function readPhotoRows(photos: { entries: unknown[] }, rows: SeedRow[]): Map<number, PhotoRow> {
  const byIdx = new Map(rows.map(r => [r.idx, r]));
  const out = new Map<number, PhotoRow>();
  for (const raw of photos.entries) {
    const e = raw as PhotoRow;
    const who = label(e);
    if (e.status !== 'approved') continue;
    const r = byIdx.get(e.idx);
    if (!r || r.name !== e.name || r.prefecture !== e.prefecture) {
      throw new Error(`${who}: 写真の台帳の idx ${e.idx} が seed の寺社と合わない`);
    }
    if (out.has(e.idx)) throw new Error(`${who}: 写真の台帳に承認の行が2つある`);
    if (typeof e.r2Key !== 'string' || e.r2Key === '') throw new Error(`${who}: r2Key が無い`);
    if (!Number.isInteger(e.width) || !Number.isInteger(e.height) || e.width < 1 || e.height < 1) {
      throw new Error(`${who}: width / height が正の整数でない`);
    }
    if (typeof e.license !== 'string' || e.license === '')
      throw new Error(`${who}: license が無い`);
    if (
      typeof e.sourceUrl !== 'string' ||
      !e.sourceUrl.startsWith('https://commons.wikimedia.org/')
    ) {
      throw new Error(`${who}: sourceUrl が commons.wikimedia.org でない`);
    }
    out.set(e.idx, e);
  }
  return out;
}

export function buildSiteData(inputs: SiteInputs): SiteData {
  const { rows } = inputs;
  const slugOf = matchSlugs(inputs.slugs, rows);
  const photoRows = readPhotoRows(inputs.photos, rows);
  const hours = new Map(
    parseReceptionHours(inputs.hoursText, rows)
      .filter(h => h.kind === 'explicit')
      .map(h => [h.idx, h])
  );
  const verified = new Set(
    (inputs.coords.entries as { name: string; prefecture: string }[]).map(
      e => `${e.name}\t${e.prefecture}`
    )
  );

  const spots: Spot[] = rows.map(r => {
    const pref = prefectureByName(r.prefecture);
    if (!pref) throw new Error(`${label(r)}: 知らない都道府県`);
    if (r.type !== 'shrine' && r.type !== 'temple') {
      throw new Error(`${label(r)}: type が shrine / temple でない: ${r.type}`);
    }
    if (!r.address.startsWith(r.prefecture)) {
      throw new Error(`${label(r)}: 住所が都道府県の名前で始まらない`);
    }
    const p = photoRows.get(r.idx);
    const h = hours.get(r.idx);
    const hasPage = p !== undefined || h !== undefined;
    const coordsVerified = verified.has(`${r.name}\t${r.prefecture}`);
    const [latText, lngText] = coordTexts(r, inputs.seedTexts);
    return {
      idx: r.idx,
      name: r.name,
      prefecture: r.prefecture,
      pref,
      type: r.type,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      latText,
      lngText,
      file: r.file,
      line: r.line,
      slug: slugOf.get(r.idx)!,
      hasPage,
      photo: p
        ? {
            url: photoUrl(p.r2Key),
            width: PHOTO_WIDTH,
            height: photoHeight(p.width, p.height),
            author: p.author,
            license: p.license,
            licenseUrl: p.licenseUrl,
            sourceUrl: p.sourceUrl,
          }
        : null,
      hours: h
        ? {
            open: h.open,
            close: h.close,
            text: formatHours(h.open, h.close),
            notes: h.notes,
            url: h.url,
            host: hostOf(h.url),
            yearMonth: yearMonthOf(h.lastReportedAt),
          }
        : null,
      coordsVerified,
      googleMapsUrl: googleMapsUrl(r.name, r.address),
      osmUrl: coordsVerified ? osmUrl(latText, lngText) : null,
      nearby: [],
    };
  });

  const pages = spots.filter(s => s.hasPage);
  for (const s of pages) {
    s.nearby = pages
      .filter(o => o.idx !== s.idx)
      .map(o => ({ idx: o.idx, d: distanceMeters(s, o) }))
      .filter(x => x.d <= NEARBY_RADIUS_M)
      .sort((a, b) => a.d - b.d || a.idx - b.idx)
      .slice(0, NEARBY_LIMIT)
      .map(x => x.idx);
  }
  return { spots };
}

/** 神社 / お寺 */
export function kindLabel(type: SpotType): string {
  return type === 'shrine' ? '神社' : 'お寺';
}
