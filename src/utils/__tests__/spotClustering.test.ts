import {
  CLUSTER_EXTENT,
  CLUSTER_MAX_ZOOM,
  CLUSTER_MIN_POINTS,
  CLUSTER_MIN_ZOOM,
  CLUSTER_RADIUS,
  MAX_CLUSTER_BUBBLES,
  MAX_INDIVIDUAL_SPOTS,
  MAX_PINNED_SPOTS,
  MAX_TOTAL_MARKERS,
  buildClusterView,
  createClusterIndex,
  getDeltaFromZoom,
  getZoomFromRegion,
  regionToBBox,
  selectPinnedSpots,
  takeNearest,
} from '@utils/spotClustering';
import type { MapRegion } from '@utils/spotSelection';
import type { Spot } from '@/types/supabase';

const CENTER_LAT = 38.2682;
const CENTER_LNG = 140.8694;

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

function makeRegion(delta: number): MapRegion {
  return {
    latitude: CENTER_LAT,
    longitude: CENTER_LNG,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

const noIds = new Set<string>();

/** 中心周辺の decimal グリッドに count 件を決定的に配置する（10列で折り返し） */
function makeGridSpots(
  count: number,
  spacing: number,
  overrides: Partial<Spot> = {},
  idPrefix = 'gen'
): Spot[] {
  return Array.from({ length: count }, (_, i) => {
    const col = i % 10;
    const row = Math.floor(i / 10);
    return makeSpot({
      id: `${idPrefix}-${String(i).padStart(4, '0')}`,
      lat: CENTER_LAT + (row - 4.5) * spacing,
      lng: CENTER_LNG + (col - 4.5) * spacing,
      ...overrides,
    });
  });
}

/** useSpotClusters と同じ分割で buildClusterView を呼ぶテストヘルパー */
function buildView(
  spots: Spot[],
  region: MapRegion,
  visitedSpotIds: Set<string> = noIds,
  wishlistSpotIds: Set<string> = noIds
) {
  const clusterable = spots.filter(s => !visitedSpotIds.has(s.id) && !wishlistSpotIds.has(s.id));
  const index = createClusterIndex(clusterable);
  const spotById = new Map(clusterable.map(s => [s.id, s]));
  const pinnedSpots = selectPinnedSpots({ spots, region, visitedSpotIds, wishlistSpotIds });
  return buildClusterView({ index, spotById, region, pinnedSpots });
}

describe('getZoomFromRegion', () => {
  it('AC-1: 代表 delta に対して仕様の zoom を返す', () => {
    const cases: [number, number][] = [
      [0.015, 15],
      [0.019, 14],
      [0.021, 14],
      [0.025, 14],
      [0.1, 12],
      [0.2, 11],
      [0.6, 9],
      [5, 6],
    ];
    for (const [delta, zoom] of cases) {
      expect(getZoomFromRegion(makeRegion(delta))).toBe(zoom);
    }
  });

  it('AC-2: 0〜20 にクランプされる', () => {
    expect(getZoomFromRegion(makeRegion(360))).toBe(0);
    expect(getZoomFromRegion(makeRegion(1e-9))).toBe(20);
  });

  it('AC-3: クラスタ化開始境界が delta 0.031/0.032 の間にある', () => {
    expect(getZoomFromRegion(makeRegion(0.031))).toBe(14);
    expect(getZoomFromRegion(makeRegion(0.032))).toBe(13);
  });
});

describe('getDeltaFromZoom', () => {
  it('AC-4: 360 / 2^zoom を返し、getZoomFromRegion と往復整合する', () => {
    expect(getDeltaFromZoom(14)).toBe(360 / 2 ** 14);
    for (const z of [6, 9, 12, 14]) {
      expect(getZoomFromRegion(makeRegion(getDeltaFromZoom(z)))).toBe(z);
    }
  });
});

describe('regionToBBox', () => {
  it('AC-5: VIEWPORT_MARGIN 適用済みの [west, south, east, north] を返す', () => {
    const bbox = regionToBBox({
      latitude: 38.2682,
      longitude: 140.8694,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
    expect(bbox[0]).toBeCloseTo(140.8574, 6);
    expect(bbox[1]).toBeCloseTo(38.2562, 6);
    expect(bbox[2]).toBeCloseTo(140.8814, 6);
    expect(bbox[3]).toBeCloseTo(38.2802, 6);
  });

  it('AC-6: 緯度は [-90, 90] にクランプされる', () => {
    const bbox = regionToBBox({
      latitude: 0,
      longitude: CENTER_LNG,
      latitudeDelta: 200,
      longitudeDelta: 0.02,
    });
    expect(bbox[1]).toBe(-90);
    expect(bbox[3]).toBe(90);
  });
});

describe('takeNearest', () => {
  it('AC-7: 中心距離昇順 → id 昇順で maxCount 件を返し、入力配列を破壊しない', () => {
    const region = makeRegion(0.02);
    const spots = [
      makeSpot({ id: 'b', lat: CENTER_LAT + 0.001 }),
      makeSpot({ id: 'a', lat: CENTER_LAT - 0.001 }),
      makeSpot({ id: 'c', lat: CENTER_LAT + 0.0005 }),
    ];
    const inputSnapshot = [...spots];

    const result = takeNearest(spots, region, 2);

    expect(result.map(s => s.id)).toEqual(['c', 'a']);
    expect(spots).toEqual(inputSnapshot);
  });
});

describe('buildClusterView', () => {
  it('AC-8: 近接 100 件が delta 0.6 で 1 クラスタ(count 100)に畳まれる', () => {
    const spots = makeGridSpots(100, 0.0005);
    const view = buildView(spots, makeRegion(0.6));

    expect(view.clusters).toHaveLength(1);
    expect(view.clusters[0].count).toBe(100);
    expect(view.individualSpots).toHaveLength(0);
  });

  it('AC-9: 初期ズーム(delta 0.015)では全点個別になり上限 60 件', () => {
    const spots = makeGridSpots(100, 0.0015);
    const view = buildView(spots, makeRegion(0.015));

    expect(view.clusters).toHaveLength(0);
    expect(view.individualSpots).toHaveLength(60);
  });

  it('AC-10: visited スポットはクラスタに吸収されず individualSpots に含まれる', () => {
    const spots = makeGridSpots(51, 0.0005);
    const visited = new Set([spots[0].id]);
    const view = buildView(spots, makeRegion(0.6), visited);

    expect(view.individualSpots.map(s => s.id)).toContain(spots[0].id);
  });

  it('AC-11: 49 クラスタ生成時は count 降順で MAX_CLUSTER_BUBBLES(40) 件に切り詰める', () => {
    const spots: Spot[] = [];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        const lat = CENTER_LAT + (row - 3) * 0.11;
        const lng = CENTER_LNG + (col - 3) * 0.11;
        const base = (row * 7 + col) * 2;
        spots.push(
          makeSpot({ id: `gen-${String(base).padStart(4, '0')}`, lat, lng }),
          makeSpot({ id: `gen-${String(base + 1).padStart(4, '0')}`, lat: lat + 0.0001, lng })
        );
      }
    }
    const view = buildView(spots, makeRegion(0.6));

    expect(view.clusters).toHaveLength(40);
    expect(view.clusters.every(c => c.count === 2)).toBe(true);
  });

  it('AC-12: 非クラスタ帯の個別選択は rank 5 が rank 1 より優先される', () => {
    const rank5 = makeGridSpots(100, 0.0005, { rank: 5 }, 'r5');
    const rank1 = makeGridSpots(100, 0.0005, { rank: 1 }, 'r1').map(s => ({
      ...s,
      lat: s.lat + 0.00023,
    }));
    const view = buildView([...rank5, ...rank1], makeRegion(0.015));

    expect(view.individualSpots).toHaveLength(60);
    expect(view.individualSpots.every(s => s.rank === 5)).toBe(true);
  });

  it('AC-13: クラスタリング定数が仕様どおり', () => {
    expect(CLUSTER_RADIUS).toBe(60);
    expect(CLUSTER_EXTENT).toBe(512);
    expect(CLUSTER_MIN_POINTS).toBe(2);
    expect(CLUSTER_MIN_ZOOM).toBe(0);
    expect(CLUSTER_MAX_ZOOM).toBe(13);
    expect(MAX_CLUSTER_BUBBLES).toBe(40);
    expect(MAX_INDIVIDUAL_SPOTS).toBe(60);
    expect(MAX_PINNED_SPOTS).toBe(30);
    expect(MAX_TOTAL_MARKERS).toBe(130);
    expect(MAX_CLUSTER_BUBBLES + MAX_INDIVIDUAL_SPOTS + MAX_PINNED_SPOTS).toBe(MAX_TOTAL_MARKERS);
  });

  it('AC-39: クラスタが合流しても id が leaf 由来で継続する', () => {
    const groupA = Array.from({ length: 10 }, (_, i) =>
      makeSpot({ id: `a-${i}`, lat: 38.27, lng: 140.87 + i * 0.001 })
    );
    const groupB = Array.from({ length: 10 }, (_, i) =>
      makeSpot({ id: `b-${i}`, lat: 38.9, lng: 141.3 + i * 0.001 })
    );
    const spots = [...groupA, ...groupB];
    const index = createClusterIndex(spots);
    const spotById = new Map(spots.map(s => [s.id, s]));
    const centerRegion = (delta: number) => ({
      latitude: 38.6,
      longitude: 141.08,
      latitudeDelta: delta,
      longitudeDelta: delta,
    });

    // 分離ズーム(zoom 9): 2グループがそれぞれ1クラスタ
    const separated = buildClusterView({
      index,
      spotById,
      region: centerRegion(0.9),
      pinnedSpots: [],
    });
    expect(separated.clusters).toHaveLength(2);

    // 合流ズーム(zoom 5): 1クラスタに合流し、id は分離時のどちらかを引き継ぐ
    const merged = buildClusterView({
      index,
      spotById,
      region: centerRegion(11.25),
      pinnedSpots: [],
    });
    expect(merged.clusters).toHaveLength(1);
    expect(merged.clusters[0].count).toBe(20);
    expect(separated.clusters.map(c => c.id)).toContain(merged.clusters[0].id);
  });

  it('AC-15: 同一入力で結果が決定的であり、入力配列を破壊しない', () => {
    const spots = [...makeGridSpots(100, 0.0005), ...makeGridSpots(50, 0.11, {}, 'far')];
    const inputSnapshot = [...spots];
    const region = makeRegion(0.6);

    const first = buildView(spots, region);
    const second = buildView(spots, region);

    expect(second.clusters.map(c => c.id)).toEqual(first.clusters.map(c => c.id));
    expect(second.individualSpots.map(s => s.id)).toEqual(first.individualSpots.map(s => s.id));
    expect(spots).toEqual(inputSnapshot);
  });
});

describe('selectPinnedSpots', () => {
  it('AC-14: ビューポート内の pinned のみを中心距離昇順の上位 30 件で返す', () => {
    const region = makeRegion(0.02);
    const visited = Array.from({ length: 31 }, (_, i) =>
      makeSpot({ id: `visited-${String(i).padStart(4, '0')}`, lat: CENTER_LAT + i * 0.0002 })
    );
    const outside = makeSpot({ id: 'visited-outside', lat: CENTER_LAT + 0.02 });
    const unvisited = makeSpot({ id: 'unvisited-0000' });
    const visitedSpotIds = new Set([...visited.map(s => s.id), outside.id]);

    const result = selectPinnedSpots({
      spots: [...visited, outside, unvisited],
      region,
      visitedSpotIds,
      wishlistSpotIds: noIds,
    });

    expect(result).toHaveLength(30);
    const ids = result.map(s => s.id);
    expect(ids).not.toContain('visited-outside');
    expect(ids).not.toContain('visited-0030');
    expect(ids).not.toContain('unvisited-0000');
    expect(ids).toContain('visited-0029');
  });
});

describe('パフォーマンス基準（Issue #67 の全国 5,000 件規模）', () => {
  // 日本全域（lat 30〜44.7 / lng 128〜145.82）の決定的グリッドに 5,000 件
  const nationwideSpots = Array.from({ length: 5000 }, (_, i) =>
    makeSpot({
      id: `nw-${String(i).padStart(4, '0')}`,
      lat: 30 + (i % 50) * 0.3,
      lng: 128 + Math.floor(i / 50) * 0.18,
    })
  );

  it('P-1: 全国 region(delta 5)でクラスタ <= 40 / 個別 <= 60 に収まる', () => {
    const view = buildView(nationwideSpots, makeRegion(5));

    expect(view.clusters.length).toBeLessThanOrEqual(MAX_CLUSTER_BUBBLES);
    expect(view.individualSpots.length).toBeLessThanOrEqual(MAX_INDIVIDUAL_SPOTS);
  });

  it('P-2: delta 0.015/0.1/0.6/5 の各 5 回でマーカー総数が常に 130 以下', () => {
    const clusterable = nationwideSpots;
    const index = createClusterIndex(clusterable);
    const spotById = new Map(clusterable.map(s => [s.id, s]));

    for (const delta of [0.015, 0.1, 0.6, 5]) {
      for (let i = 0; i < 5; i++) {
        const view = buildClusterView({
          index,
          spotById,
          region: makeRegion(delta),
          pinnedSpots: [],
        });
        expect(view.clusters.length + view.individualSpots.length).toBeLessThanOrEqual(
          MAX_TOTAL_MARKERS
        );
      }
    }
  });
});
