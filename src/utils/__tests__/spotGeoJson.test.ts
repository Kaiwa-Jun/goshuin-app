import type { Spot } from '@/types/supabase';
import { buildSpotSources, getSpotPinState, pointCollection } from '@utils/spotGeoJson';

function makeSpot(overrides: Partial<Spot> & Pick<Spot, 'id'>): Spot {
  return {
    name: `スポット${overrides.id}`,
    type: 'shrine',
    lat: 35.0,
    lng: 135.0,
    rank: 3,
    status: 'active',
    address: null,
    prefecture: null,
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Spot;
}

const NONE = new Set<string>();

describe('getSpotPinState', () => {
  it('訪問済みの神社と寺院を種別ごとに区別する', () => {
    const shrine = makeSpot({ id: 'a', type: 'shrine' });
    const temple = makeSpot({ id: 'b', type: 'temple' });
    const visited = new Set(['a', 'b']);

    expect(getSpotPinState(shrine, visited, NONE)).toBe('visited-shrine');
    expect(getSpotPinState(temple, visited, NONE)).toBe('visited-temple');
  });

  it('訪問済みは行きたいより優先される', () => {
    const spot = makeSpot({ id: 'a' });
    expect(getSpotPinState(spot, new Set(['a']), new Set(['a']))).toBe('visited-shrine');
  });

  it('どちらでもなければ unvisited', () => {
    expect(getSpotPinState(makeSpot({ id: 'a' }), NONE, NONE)).toBe('unvisited');
  });
});

describe('buildSpotSources', () => {
  const spots = [
    makeSpot({ id: 'visited', type: 'temple' }),
    makeSpot({ id: 'wish' }),
    makeSpot({ id: 'plain1' }),
    makeSpot({ id: 'plain2' }),
  ];
  const visited = new Set(['visited']);
  const wishlist = new Set(['wish']);

  it('訪問済み・行きたいは団子化されない pinned 側へ入る', () => {
    const { clustered, pinned } = buildSpotSources({
      spots,
      visitedSpotIds: visited,
      wishlistSpotIds: wishlist,
    });

    expect(pinned.features.map(f => f.properties.spotId).sort()).toEqual(['visited', 'wish']);
    expect(clustered.features.map(f => f.properties.spotId).sort()).toEqual(['plain1', 'plain2']);
  });

  it('全件を渡す（描画件数の上限で間引かない）', () => {
    const many = Array.from({ length: 500 }, (_, i) => makeSpot({ id: `s${i}` }));
    const { clustered } = buildSpotSources({
      spots: many,
      visitedSpotIds: NONE,
      wishlistSpotIds: NONE,
    });

    expect(clustered.features).toHaveLength(500);
  });

  it('GeoJSON は [lng, lat] の順で座標を持ち、スタイル式が参照する属性を含む', () => {
    const { clustered } = buildSpotSources({
      spots: [makeSpot({ id: 'a', lat: 35.0036, lng: 135.778, rank: 5, name: '八坂神社' })],
      visitedSpotIds: NONE,
      wishlistSpotIds: NONE,
    });

    expect(clustered.features[0]).toEqual({
      type: 'Feature',
      properties: { spotId: 'a', name: '八坂神社', rank: 5, state: 'unvisited' },
      geometry: { type: 'Point', coordinates: [135.778, 35.0036] },
    });
  });

  it('入力配列を破壊しない', () => {
    const input = [...spots];
    buildSpotSources({ spots: input, visitedSpotIds: visited, wishlistSpotIds: wishlist });
    expect(input).toEqual(spots);
  });

  it('スポットが無ければ両方とも空の FeatureCollection', () => {
    const { clustered, pinned } = buildSpotSources({
      spots: [],
      visitedSpotIds: NONE,
      wishlistSpotIds: NONE,
    });
    expect(clustered).toEqual({ type: 'FeatureCollection', features: [] });
    expect(pinned).toEqual({ type: 'FeatureCollection', features: [] });
  });
});

describe('pointCollection', () => {
  it('現在地を1点の FeatureCollection にする', () => {
    expect(pointCollection({ latitude: 35.68, longitude: 139.76 })).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [139.76, 35.68] },
        },
      ],
    });
  });

  it('現在地が無ければ空', () => {
    expect(pointCollection(null).features).toHaveLength(0);
  });
});
