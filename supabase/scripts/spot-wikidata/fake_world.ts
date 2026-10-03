// テスト用の作り物の世界（seed・台帳・Wikidata・地理院・OSM・Commons の偽物）。テストからだけ読む。
// 地理院のタイルはここで vt-pbf から作る（本物のタイル・Nominatim の応答はリポジトリに置かない）
import geojsonVt from 'npm:geojson-vt@4.0.2';
import vtpbf from 'npm:vt-pbf@3.1.3';

import { type LatLng, LEDGER_PATH, SEED_FILES } from '../spot-coords/coords.ts';
import { tileOf, TILE_Z } from './match.ts';

export interface FakeSpot {
  name: string;
  prefecture: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
  rank?: number;
}

export interface FakeLedgerEntry {
  /** seed の何番目か（1 から） */
  idx: number;
  source: 'wikidata' | 'osm';
  ref: string;
  to: LatLng;
}

export interface FakeEntity {
  qid: string;
  label?: string;
  aliases?: string[];
  p625?: LatLng;
  p18?: string[];
  p131?: string[];
  p31?: string[];
}

export interface FakeGsiFeature extends LatLng {
  layer: 'label' | 'symbol';
  code: number;
  knj?: string;
}

export interface FakeWorld {
  spots: FakeSpot[];
  ledger: FakeLedgerEntry[];
  entities: FakeEntity[];
  /** 検索の名前（haswbstatement を除く）→ Q-ID */
  search: Record<string, string[]>;
  /** WDQS の完全一致の名前 → Q-ID */
  wdqs: Record<string, string[]>;
  /** 住所 → 地理院の住所検索の結果（title と点） */
  addr: Record<string, { title: string; at: LatLng }[]>;
  gsi: FakeGsiFeature[];
  /** Nominatim の q → 結果 */
  nominatim: Record<string, { name: string; at: LatLng; osm_type: string; osm_id: number }[]>;
  /** Commons にあるファイル（無いものは missing で返る） */
  commons: string[];
}

/** p から北へ m メートル */
export function north(p: LatLng, m: number): LatLng {
  return { lat: p.lat + (m / 6_371_000) * (180 / Math.PI), lng: p.lng };
}

/** p から東へ m メートル */
export function east(p: LatLng, m: number): LatLng {
  const dLng = (m / (6_371_000 * Math.cos((p.lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: p.lat, lng: p.lng + dLng };
}

function sqlString(s: string): string {
  return `'${s.replaceAll("'", "''")}'`;
}

/** 寺社の行を最初の seed に全部入れ、ほかの seed は行なし */
export function seedTexts(spots: FakeSpot[]): Map<string, string> {
  const out = new Map<string, string>();
  const rows = spots.map(
    (s, i) =>
      `(${sqlString(s.name)}, ${s.lat}, ${s.lng}, ${sqlString(s.type ?? 'temple')}, ${sqlString(s.address)}, ${sqlString(s.prefecture)}, ${s.rank ?? 3}, 'active')${i === spots.length - 1 ? '' : ','}\n-- 住所確認: テスト`
  );
  SEED_FILES.forEach((path, i) => {
    out.set(
      path,
      i === 0
        ? [
            '-- テスト用',
            'INSERT INTO spots (name, lat, lng, type, address, prefecture, rank, status) VALUES',
            ...rows,
            ';',
            '',
          ].join('\n')
        : '-- テスト用（行なし）\n'
    );
  });
  return out;
}

/** 台帳の写し（spot-coords の parseLedger を通る形） */
export function ledgerText(world: FakeWorld): string {
  const texts = seedTexts(world.spots);
  const lines = texts.get(SEED_FILES[0])!.split('\n');
  const entries = world.ledger.map(l => {
    const s = world.spots[l.idx - 1];
    const line = lines.findIndex(x => x.startsWith(`(${sqlString(s.name)},`)) + 1;
    return {
      batch: 1,
      idx: l.idx,
      name: s.name,
      prefecture: s.prefecture,
      seedFile: SEED_FILES[0],
      seedLine: line,
      old: { lat: s.lat, lng: s.lng },
      new: { lat: Number(l.to.lat.toFixed(6)), lng: Number(l.to.lng.toFixed(6)) },
      source: l.source,
      ref: l.ref,
      confidence: 'high',
      basis: 'テスト',
    };
  });
  return (
    JSON.stringify(
      {
        schemaVersion: 1,
        issue: 292,
        note: 'テスト',
        attribution: { wikidata: 'Wikidata', osm: 'OSM' },
        entries,
      },
      null,
      2
    ) + '\n'
  );
}

export async function writeRoot(root: string, world: FakeWorld): Promise<void> {
  for (const [path, text] of seedTexts(world.spots)) {
    const full = `${root}/${path}`;
    await Deno.mkdir(full.slice(0, full.lastIndexOf('/')), { recursive: true });
    await Deno.writeTextFile(full, text);
  }
  await Deno.mkdir(`${root}/supabase/data`, { recursive: true });
  await Deno.writeTextFile(`${root}/${LEDGER_PATH}`, ledgerText(world));
}

function claim(value: unknown, type: string) {
  return { mainsnak: { snaktype: 'value', datavalue: { value, type } }, rank: 'normal' };
}

function rawEntity(e: FakeEntity) {
  const claims: Record<string, unknown[]> = {};
  if (e.p625) {
    claims.P625 = [claim({ latitude: e.p625.lat, longitude: e.p625.lng }, 'globecoordinate')];
  }
  if (e.p18) claims.P18 = e.p18.map(f => claim(f, 'string'));
  if (e.p131) claims.P131 = e.p131.map(q => claim({ id: q }, 'wikibase-entityid'));
  if (e.p31) claims.P31 = e.p31.map(q => claim({ id: q }, 'wikibase-entityid'));
  claims.P17 = [claim({ id: 'Q17' }, 'wikibase-entityid')];
  return {
    type: 'item',
    id: e.qid,
    labels: e.label ? { ja: { language: 'ja', value: e.label } } : {},
    aliases: e.aliases ? { ja: e.aliases.map(value => ({ language: 'ja', value })) } : {},
    claims,
  };
}

export interface Call {
  url: string;
  method: string;
  userAgent: string | null;
  at: number;
  body: string | null;
}

export type Override = (url: string, call: Call) => Response | 'timeout' | undefined;

/** 偽の fetch。呼ばれた URL・ヘッダー・時刻（偽の時計）を記録する */
export class FakeNet {
  calls: Call[] = [];
  override: Override | null = null;
  inFlight = 0;
  maxInFlight = 0;
  constructor(
    private world: FakeWorld,
    private clock: { t: number }
  ) {}

  fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const call: Call = {
      url,
      method: init?.method ?? 'GET',
      userAgent: headers.get('User-Agent'),
      at: this.clock.t,
      body: typeof init?.body === 'string' ? init.body : init?.body ? String(init.body) : null,
    };
    this.calls.push(call);
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      await Promise.resolve();
      const o = this.override?.(url, call);
      if (o === 'timeout') throw new DOMException('timed out', 'TimeoutError');
      if (o) return o;
      return this.respond(url, call);
    } finally {
      this.inFlight--;
    }
  };

  callsTo(host: string): Call[] {
    return this.calls.filter(c => new URL(c.url).host === host);
  }

  private json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  private respond(url: string, call: Call): Response {
    const u = new URL(url);
    if (u.host === 'www.wikidata.org') {
      const action = u.searchParams.get('action');
      if (action === 'query') {
        const q = (u.searchParams.get('srsearch') ?? '').replace(/\s*haswbstatement:P17=Q17$/, '');
        const hits = this.world.search[q] ?? [];
        return this.json({ query: { search: hits.map(title => ({ ns: 0, title })) } });
      }
      if (action === 'wbgetentities') {
        const ids = (u.searchParams.get('ids') ?? '').split('|');
        const entities: Record<string, unknown> = {};
        for (const id of ids) {
          const e = this.world.entities.find(x => x.qid === id);
          if (!e) {
            return this.json({ error: { code: 'no-such-entity', id, info: 'no such entity' } });
          }
          entities[id] = rawEntity(e);
        }
        return this.json({ entities, success: 1 });
      }
    }
    if (u.host === 'query.wikidata.org') {
      const query = new URLSearchParams(call.body ?? '').get('query') ?? '';
      const names = [...query.matchAll(/"((?:[^"\\]|\\.)*)"@ja/g)].map(m => m[1]);
      const bindings = names.flatMap(name =>
        (this.world.wdqs[name] ?? []).map(q => ({
          item: { type: 'uri', value: `http://www.wikidata.org/entity/${q}` },
          name: { type: 'literal', value: name, 'xml:lang': 'ja' },
        }))
      );
      return this.json({ head: { vars: ['item', 'name'] }, results: { bindings } });
    }
    if (u.host === 'msearch.gsi.go.jp') {
      const q = u.searchParams.get('q') ?? '';
      return this.json(
        (this.world.addr[q] ?? []).map(a => ({
          geometry: { coordinates: [a.at.lng, a.at.lat], type: 'Point' },
          type: 'Feature',
          properties: { addressCode: '', title: a.title },
        }))
      );
    }
    if (u.host === 'cyberjapandata.gsi.go.jp') {
      const m = /\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(u.pathname)!;
      const [z, x, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const inTile = this.world.gsi.filter(f => {
        const t = tileOf(f, z);
        return t.x === x && t.y === y;
      });
      if (inTile.length === 0) return new Response('', { status: 404 });
      return new Response(new Uint8Array(makeGsiTile(inTile, z, x, y)), { status: 200 });
    }
    if (u.host === 'nominatim.openstreetmap.org') {
      const q = u.searchParams.get('q') ?? '';
      return this.json(
        (this.world.nominatim[q] ?? []).map(r => ({
          osm_type: r.osm_type,
          osm_id: r.osm_id,
          lat: String(r.at.lat),
          lon: String(r.at.lng),
          name: r.name,
          namedetails: { name: r.name },
        }))
      );
    }
    if (u.host === 'commons.wikimedia.org') {
      const titles = (u.searchParams.get('titles') ?? '').split('|');
      const pages = titles.map((title, i) => {
        const file = title.replace(/^File:/, '');
        if (!this.world.commons.includes(file)) {
          return { ns: 6, title, missing: true, imagerepository: '' };
        }
        const under = file.replaceAll(' ', '_');
        return {
          pageid: i + 1,
          ns: 6,
          title,
          imagerepository: 'local',
          imageinfo: [
            {
              width: 1200,
              height: 800,
              url: `https://upload.wikimedia.org/wikipedia/commons/0/00/${under}?utm_source=commons.wikimedia.org`,
              descriptionurl: `https://commons.wikimedia.org/wiki/File:${under}`,
              sha1: '0123456789abcdef0123456789abcdef01234567',
              mime: 'image/jpeg',
              extmetadata: {
                Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Foo">Foo</a>' },
                LicenseShortName: { value: 'CC BY-SA 4.0' },
                LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
                AttributionRequired: { value: 'true' },
              },
            },
          ],
        };
      });
      return this.json({ batchcomplete: true, query: { pages } });
    }
    return new Response('not found', { status: 404 });
  }
}

export function makeGsiTile(
  features: FakeGsiFeature[],
  z: number,
  x: number,
  y: number
): Uint8Array {
  const layers: Record<string, unknown> = {};
  for (const layer of ['label', 'symbol'] as const) {
    const fs = features
      .filter(f => f.layer === layer)
      .map(f => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
        properties: layer === 'label' ? { annoCtg: f.code, knj: f.knj ?? '' } : { ftCode: f.code },
      }));
    if (fs.length === 0) continue;
    const index = geojsonVt(
      { type: 'FeatureCollection', features: fs },
      { maxZoom: z, indexMaxZoom: z, tolerance: 0, buffer: 0 }
    );
    layers[layer] = index.getTile(z, x, y);
  }
  return vtpbf.fromGeojsonVt(layers, { version: 2 });
}

// --- 決まった世界: 寺社 7 件（台帳 2・keep 2・suggest 1・owner 1・investigate 1） ---

const BASE: LatLng = { lat: 34.7, lng: 137.9 };
const at = (km: number): LatLng => east(BASE, km * 1000);

export const SPOTS = {
  ledgerWd: { name: '台帳の寺', prefecture: '静岡県', address: '静岡県袋井市一丁目1', ...at(0) },
  ledgerOsm: {
    name: '台帳の社',
    prefecture: '静岡県',
    address: '静岡県袋井市二丁目2',
    ...at(10),
    type: 'shrine',
  },
  keepWd: { name: '近い寺', prefecture: '静岡県', address: '静岡県掛川市三番町3', ...at(20) },
  keepGsi: {
    name: '地図の社',
    prefecture: '静岡県',
    address: '静岡県掛川市四番町4',
    ...at(30),
    type: 'shrine',
  },
  suggest: { name: '離れた寺', prefecture: '静岡県', address: '静岡県磐田市五番町5', ...at(40) },
  owner: { name: '住所だけの寺', prefecture: '静岡県', address: '静岡県磐田市六番町6', ...at(50) },
  investigate: {
    name: '手がかりの無い寺',
    prefecture: '静岡県',
    address: '静岡県磐田市七番町7',
    ...at(60),
  },
} satisfies Record<string, FakeSpot>;

export function standardWorld(only?: (keyof typeof SPOTS)[]): FakeWorld {
  const keys = (only ?? (Object.keys(SPOTS) as (keyof typeof SPOTS)[])).filter(k => k in SPOTS);
  const spots = keys.map(k => SPOTS[k]);
  const idxOf = (k: keyof typeof SPOTS) => keys.indexOf(k) + 1;
  const suggestWd = north(SPOTS.suggest, 800);
  const world: FakeWorld = {
    spots,
    ledger: [],
    entities: [
      { qid: 'Q900', label: '静岡県', p31: ['Q50337'] },
      { qid: 'Q800', label: '掛川市', p131: ['Q900'] },
      {
        qid: 'Q9001',
        label: '台帳の寺',
        p625: north(SPOTS.ledgerWd, 300),
        p18: ['Ledger temple.jpg'],
      },
      {
        qid: 'Q101',
        label: '近い寺',
        p625: north(SPOTS.keepWd, 50),
        p18: ['Near temple haiden.jpg'],
        p131: ['Q800'],
      },
      { qid: 'Q103', label: '離れた寺', p625: suggestWd, p131: ['Q800'] },
    ],
    search: {
      近い寺: ['Q101'],
      離れた寺: ['Q103'],
      台帳の寺: ['Q9001'],
    },
    wdqs: {},
    addr: {
      [SPOTS.keepWd.address]: [{ title: '静岡県掛川市三番町３', at: north(SPOTS.keepWd, 30) }],
      [SPOTS.keepGsi.address]: [{ title: '静岡県掛川市四番町４', at: north(SPOTS.keepGsi, 40) }],
      [SPOTS.suggest.address]: [{ title: '静岡県磐田市', at: north(SPOTS.suggest, 3000) }],
      [SPOTS.owner.address]: [{ title: '静岡県磐田市六番町６', at: north(SPOTS.owner, 500) }],
    },
    gsi: [
      { layer: 'label', code: 661, knj: '地図の社', ...east(SPOTS.keepGsi, 60) },
      { layer: 'label', code: 662, knj: '離れた寺', ...east(suggestWd, 50) },
      { layer: 'label', code: 673, knj: '離れた山', ...east(suggestWd, 20) },
    ],
    nominatim: {},
    commons: ['Near temple haiden.jpg'],
  };
  if (keys.includes('ledgerWd')) {
    world.ledger.push({
      idx: idxOf('ledgerWd'),
      source: 'wikidata',
      ref: 'Q9001',
      to: north(SPOTS.ledgerWd, 300),
    });
  }
  if (keys.includes('ledgerOsm')) {
    world.ledger.push({
      idx: idxOf('ledgerOsm'),
      source: 'osm',
      ref: 'way/1',
      to: north(SPOTS.ledgerOsm, 200),
    });
  }
  return world;
}
