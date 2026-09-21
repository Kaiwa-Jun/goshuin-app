import { MAP_STYLE } from '@components/map/mapStyle';

/**
 * assets/map-style.json は scripts/generate-map-style.mjs で焼いた成果物で、
 * スクリプトは配信元（positron）からレイヤ id が消えたとき警告して飛ばす。
 * つまり焼き直したときに調整が黙って抜け落ちても実行は成功するため、
 * ここで焼き上がりの現物を押さえておく。
 *
 * 落ちたら「スタイルを直す」のではなく scripts/generate-map-style.mjs を見ること。
 * 期待値を書き換えるのは、意図して見た目を変えたときだけ。
 */

interface BakedLayer {
  id: string;
  type: string;
  minzoom?: number;
  filter?: unknown;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  'source-layer'?: string;
}

const layers = MAP_STYLE.layers as unknown as BakedLayer[];

function layer(id: string): BakedLayer {
  const found = layers.find(l => l.id === id);
  if (!found) throw new Error(`レイヤ "${id}" が焼き上がりに無い`);
  return found;
}

/** グレー（色相を持たない）と見なす RGB のばらつき幅 */
const GRAY_TOLERANCE = 8;

/**
 * 色がグレーかどうか。判定できない形式は null を返す（呼び出し側で失敗扱いにする）。
 * positron は #fff / rgb(213, 213, 213) / hsl(0,0%,88%) を混在させている
 */
function isGray(value: string): boolean | null {
  const text = value.trim();

  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
    const channels = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
    return Math.max(...channels) - Math.min(...channels) <= GRAY_TOLERANCE;
  }

  const rgb = text.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
  if (rgb) {
    const channels = rgb.slice(1).map(Number);
    return Math.max(...channels) - Math.min(...channels) <= GRAY_TOLERANCE;
  }

  // hsl は彩度だけ見れば足りる
  const hsl = text.match(/^hsla?\(\s*[\d.]+\s*,\s*([\d.]+)%/i);
  if (hsl) return Number(hsl[1]) === 0;

  return null;
}

describe('assets/map-style.json（焼き込み済みの下地スタイル）', () => {
  describe('引き算', () => {
    it('町名を出さない。地名ラベルは区と島だけ', () => {
      // 京都・東山の z14 タイル1枚に neighbourhood が 1,660 件入っている。
      // これを出すと地図帳になり、スポット名の置き場所も奪われる
      const serialized = JSON.stringify(layer('label_other').filter);
      expect(serialized).not.toContain('neighbourhood');
      expect(serialized).toContain('suburb');
    });

    it('建物は z15 から、フェードインさせて出す', () => {
      const building = layer('building');
      expect(building.minzoom).toBe(15);
      expect(building.paint?.['fill-opacity']).toBeDefined();
    });

    it('生活道路と歩道を広域では出さない', () => {
      expect(layer('highway_minor').minzoom).toBe(13);
      expect(layer('highway_path').minzoom).toBe(15);
    });
  });

  describe('色は面にだけ入れる', () => {
    it('公園・森林・水に色が付いている', () => {
      expect(layer('park').paint?.['fill-color']).toBe('#D2E7CB');
      expect(layer('landcover_wood').paint?.['fill-color']).toBe('#C3DCBA');
      expect(layer('water').paint?.['fill-color']).toBe('#A9CFE8');
      expect(layer('waterway').paint?.['line-color']).toBe('#A9CFE8');
    });

    it('道路と建物はグレーのまま。暖色にするとスポットピンが沈む', () => {
      // 目視では気付きにくいので、色相を持つ色が入っていないことを機械で見る。
      // 読めない形式は「素通り」ではなく失敗させる。positron は #fff と
      // rgb() と hsl() を混在させていて、片方しか見ない判定だと穴になる
      const colorProps: [string, string][] = [];
      for (const id of [
        'highway_minor',
        'highway_major_inner',
        'highway_major_casing',
        'building',
      ]) {
        for (const [key, value] of Object.entries(layer(id).paint ?? {})) {
          if (typeof value === 'string' && key.includes('color')) {
            colorProps.push([`${id}.${key}`, value]);
          }
        }
      }

      // 判定そのものが素通りしていないことを先に確かめる
      expect(colorProps.length).toBeGreaterThanOrEqual(5);
      expect(colorProps.filter(([, value]) => isGray(value) !== true)).toEqual([]);
    });
  });

  describe('駅ラベル', () => {
    it('poi の鉄道駅だけを引いている（バス停は入れない）', () => {
      const station = layer('label_station');
      expect(station['source-layer']).toBe('poi');

      const filter = JSON.stringify(station.filter);
      expect(filter).toContain('railway');
      expect(filter).toContain('station');
      expect(filter).not.toContain('bus');
    });

    it('スタイルの最後にある。アプリが上に重ねるピンがラベルの衝突に勝つため', () => {
      expect(layers[layers.length - 1].id).toBe('label_station');
    });
  });

  // 拡大すると幹線沿いに 403 のような四角が大量に並び、こちらのスポット名と
  // 衝突していた。参拝先を探す地図で道路番号を読む場面は無い
  it('道路番号の盾は焼き込まない', () => {
    const shields = layers.filter(l => /shield/i.test(l.id));

    expect(shields).toEqual([]);
  });

  // ref（道路番号）を出すレイヤが別名で復活していないかも見る
  it('道路番号（ref）を出すレイヤが残っていない', () => {
    const refLayers = layers.filter(l => {
      const field = l.layout?.['text-field'];
      return field !== undefined && JSON.stringify(field).includes('"ref"');
    });

    expect(refLayers.map(l => l.id)).toEqual([]);
  });

  it('ラベルはすべて日本語優先で引く', () => {
    const labelLayers = layers.filter(
      l => l.layout?.['text-field'] && JSON.stringify(l.layout['text-field']).includes('name')
    );
    expect(labelLayers.length).toBeGreaterThan(10);
    for (const l of labelLayers) {
      expect(JSON.stringify(l.layout?.['text-field'])).toContain('name:ja');
    }
  });
});
