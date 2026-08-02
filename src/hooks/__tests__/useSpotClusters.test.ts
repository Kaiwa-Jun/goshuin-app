import { renderHook } from '@testing-library/react-native';
import { useSpotClusters } from '@hooks/useSpotClusters';
import { createClusterIndex } from '@utils/spotClustering';
import type { MapRegion } from '@utils/spotSelection';
import type { Spot } from '@/types/supabase';

jest.mock('@utils/spotClustering', () => {
  const actual = jest.requireActual('@utils/spotClustering');
  return { ...actual, createClusterIndex: jest.fn(actual.createClusterIndex) };
});

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

function makeRegion(delta: number, latitude = CENTER_LAT): MapRegion {
  return { latitude, longitude: CENTER_LNG, latitudeDelta: delta, longitudeDelta: delta };
}

function makeNearbySpots(count: number): Spot[] {
  return Array.from({ length: count }, (_, i) =>
    makeSpot({
      id: `gen-${String(i).padStart(4, '0')}`,
      lat: CENTER_LAT + (Math.floor(i / 10) - 4.5) * 0.0005,
      lng: CENTER_LNG + ((i % 10) - 4.5) * 0.0005,
    })
  );
}

const noIds = new Set<string>();

describe('useSpotClusters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('AC-22: region だけの変化では index を再構築しない', () => {
    const spots = makeNearbySpots(50);
    const { rerender } = renderHook(
      ({ region }) =>
        useSpotClusters({ spots, region, visitedSpotIds: noIds, wishlistSpotIds: noIds }),
      { initialProps: { region: makeRegion(0.015) } }
    );

    rerender({ region: makeRegion(0.1) });
    rerender({ region: makeRegion(0.6) });
    rerender({ region: makeRegion(0.6, CENTER_LAT + 0.2) });

    expect(createClusterIndex).toHaveBeenCalledTimes(1);
  });

  it('AC-23: spots 配列の差し替えで index を再構築する', () => {
    const { rerender } = renderHook(
      ({ spots }) =>
        useSpotClusters({
          spots,
          region: makeRegion(0.015),
          visitedSpotIds: noIds,
          wishlistSpotIds: noIds,
        }),
      { initialProps: { spots: makeNearbySpots(50) } }
    );

    rerender({ spots: makeNearbySpots(51) });

    expect(createClusterIndex).toHaveBeenCalledTimes(2);
  });

  it('AC-24: getClusterExpansionRegion がクラスタ座標へのズームイン region を返す', () => {
    const { result } = renderHook(() =>
      useSpotClusters({
        spots: makeNearbySpots(100),
        region: makeRegion(0.6),
        visitedSpotIds: noIds,
        wishlistSpotIds: noIds,
      })
    );

    expect(result.current.clusters.length).toBeGreaterThan(0);
    const cluster = result.current.clusters[0];
    const region = result.current.getClusterExpansionRegion(cluster);

    expect(region.latitude).toBe(cluster.latitude);
    expect(region.longitude).toBe(cluster.longitude);
    expect(region.latitudeDelta).toBe(region.longitudeDelta);
    expect(region.latitudeDelta).toBeLessThan(0.6);
  });
});
