import {
  MAX_VISIBLE_SPOTS,
  VIEWPORT_MARGIN,
  selectVisibleSpots,
  type MapRegion,
} from '@utils/spotSelection';
import type { Spot } from '@/types/supabase';

const CENTER_LAT = 38.2682;
const CENTER_LNG = 140.8694;

// 中心 38.2682/140.8694、delta 0.02 → マージン(1.2)込みの half = 0.012
const region: MapRegion = {
  latitude: CENTER_LAT,
  longitude: CENTER_LNG,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

function makeSpot(overrides: Partial<Spot> & { id: string }): Spot {
  return {
    name: `Spot ${overrides.id}`,
    lat: CENTER_LAT,
    lng: CENTER_LNG,
    type: 'shrine',
    address: null,
    prefecture: null,
    status: 'active',
    rank: 3,
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  };
}

const noIds = new Set<string>();

function select(spots: Spot[], opts: Partial<Parameters<typeof selectVisibleSpots>[0]> = {}) {
  return selectVisibleSpots({
    spots,
    region,
    visitedSpotIds: noIds,
    wishlistSpotIds: noIds,
    ...opts,
  });
}

describe('selectVisibleSpots', () => {
  describe('ビューポート判定（マージン込み half = 0.012）', () => {
    it('生ビューポート外・マージン内のスポットは含まれる', () => {
      const spots = [makeSpot({ id: 'a', lat: CENTER_LAT + 0.011 })];
      expect(select(spots).map(s => s.id)).toEqual(['a']);
    });

    it('マージン外のスポットは含まれない', () => {
      const spots = [makeSpot({ id: 'a', lat: CENTER_LAT + 0.013 })];
      expect(select(spots)).toEqual([]);
    });

    it('境界ちょうどのスポットは含まれる（inclusive）', () => {
      const spots = [makeSpot({ id: 'a', lat: CENTER_LAT + 0.012 })];
      expect(select(spots).map(s => s.id)).toEqual(['a']);
    });
  });

  describe('選択順序', () => {
    it('rank 降順で上位 maxCount 件が選ばれる', () => {
      const spots = [1, 2, 3, 4, 5].map(rank => makeSpot({ id: `rank-${rank}`, rank }));
      const result = select(spots, { maxCount: 3 });
      expect(result.map(s => s.id).sort()).toEqual(['rank-3', 'rank-4', 'rank-5']);
    });

    it('同 rank では中心距離昇順で選ばれる', () => {
      const spots = [
        makeSpot({ id: 'far', lat: CENTER_LAT + 0.01 }),
        makeSpot({ id: 'near', lat: CENTER_LAT + 0.001 }),
      ];
      expect(select(spots, { maxCount: 1 }).map(s => s.id)).toEqual(['near']);
    });

    it('同 rank・等距離では id 昇順の決定的タイブレーク', () => {
      const spots = [
        makeSpot({ id: 'b', lat: CENTER_LAT + 0.005 }),
        makeSpot({ id: 'a', lat: CENTER_LAT - 0.005 }),
      ];
      expect(select(spots, { maxCount: 1 }).map(s => s.id)).toEqual(['a']);
    });
  });

  describe('visited / wishlist の常時包含', () => {
    it('visited はビューポート内なら maxCount を超えても全件含まれる', () => {
      const spots = ['v1', 'v2', 'v3'].map(id => makeSpot({ id }));
      const result = select(spots, {
        maxCount: 2,
        visitedSpotIds: new Set(['v1', 'v2', 'v3']),
      });
      expect(result.map(s => s.id).sort()).toEqual(['v1', 'v2', 'v3']);
    });

    it('wishlist はビューポート内なら maxCount を超えても全件含まれる', () => {
      const spots = ['w1', 'w2', 'w3'].map(id => makeSpot({ id }));
      const result = select(spots, {
        maxCount: 2,
        wishlistSpotIds: new Set(['w1', 'w2', 'w3']),
      });
      expect(result.map(s => s.id).sort()).toEqual(['w1', 'w2', 'w3']);
    });

    it('ビューポート外の visited / wishlist は含まれない', () => {
      const spots = [
        makeSpot({ id: 'v-out', lat: CENTER_LAT + 0.5 }),
        makeSpot({ id: 'w-out', lng: CENTER_LNG - 0.5 }),
      ];
      const result = select(spots, {
        visitedSpotIds: new Set(['v-out']),
        wishlistSpotIds: new Set(['w-out']),
      });
      expect(result).toEqual([]);
    });

    it('残り枠は maxCount から pinned 件数を引いた数になる', () => {
      const visited = ['v1', 'v2'].map(id => makeSpot({ id, rank: 1 }));
      const unvisited = Array.from({ length: 10 }, (_, i) =>
        makeSpot({ id: `u-${String(i).padStart(2, '0')}`, rank: (i % 5) + 1 })
      );
      const result = select([...visited, ...unvisited], {
        maxCount: 5,
        visitedSpotIds: new Set(['v1', 'v2']),
      });
      expect(result).toHaveLength(5);
      const ids = result.map(s => s.id);
      expect(ids).toContain('v1');
      expect(ids).toContain('v2');
      expect(ids.filter(id => id.startsWith('u-'))).toHaveLength(3);
    });
  });

  describe('フォールバック・その他', () => {
    it('region が null のときは全件対象に rank 降順 → id 昇順で選ばれ、クラッシュしない', () => {
      const spots = [
        makeSpot({ id: 'v-far', lat: 35.0, lng: 135.0, rank: 1 }),
        makeSpot({ id: 'b', rank: 5 }),
        makeSpot({ id: 'a', rank: 5 }),
        makeSpot({ id: 'c', rank: 3 }),
      ];
      const result = selectVisibleSpots({
        spots,
        region: null,
        visitedSpotIds: new Set(['v-far']),
        wishlistSpotIds: noIds,
        maxCount: 3,
      });
      // pinned(v-far 全件) + rank5 の a, b（id 昇順で採用対象を決定）
      expect(result.map(s => s.id).sort()).toEqual(['a', 'b', 'v-far']);
    });

    it('spots が空のとき空配列が返る', () => {
      expect(select([])).toEqual([]);
    });

    it('定数: MAX_VISIBLE_SPOTS = 80 / VIEWPORT_MARGIN = 1.2、maxCount 省略時は 80 件', () => {
      expect(MAX_VISIBLE_SPOTS).toBe(80);
      expect(VIEWPORT_MARGIN).toBe(1.2);
      const spots = Array.from({ length: 100 }, (_, i) =>
        makeSpot({ id: `s-${String(i).padStart(3, '0')}`, lat: CENTER_LAT + i * 0.00001 })
      );
      expect(select(spots)).toHaveLength(80);
    });

    it('決定的かつ入力を破壊しない', () => {
      const spots = Array.from({ length: 20 }, (_, i) =>
        makeSpot({ id: `s-${String(i).padStart(2, '0')}`, rank: (i % 5) + 1 })
      );
      const original = [...spots];
      const r1 = select(spots, { maxCount: 7 }).map(s => s.id);
      const r2 = select(spots, { maxCount: 7 }).map(s => s.id);
      expect(r1).toEqual(r2);
      expect(spots).toEqual(original);
    });
  });

  describe('パフォーマンス上限', () => {
    it('5,000 件を渡しても返り値は 80 件（Issue #67 規模の上限保証）', () => {
      const spots = Array.from({ length: 5000 }, (_, i) =>
        makeSpot({
          id: `gen-${String(i).padStart(4, '0')}`,
          lat: CENTER_LAT + (i % 50) * 0.0001,
          lng: CENTER_LNG + Math.floor(i / 50) * 0.00001,
          rank: (i % 5) + 1,
        })
      );
      expect(select(spots)).toHaveLength(80);
    });
  });
});
