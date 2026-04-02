import { renderHook, waitFor } from '@testing-library/react-native';
import { useSpots } from '@hooks/useSpots';
import type { Spot } from '@/types/supabase';

const mockFetchSpotsByBounds = jest.fn();

jest.mock('@services/spots', () => ({
  fetchSpotsByBounds: (...args: unknown[]) => mockFetchSpotsByBounds(...args),
}));

const makeFakeSpot = (overrides: Partial<Spot> = {}): Spot => ({
  id: 'spot-1',
  name: 'Test Shrine',
  lat: 38.27,
  lng: 140.87,
  type: 'shrine',
  address: null,
  prefecture: null,
  status: 'active',
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
});

describe('useSpots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches spots for given location', async () => {
    const spots = [makeFakeSpot(), makeFakeSpot({ id: 'spot-2', name: 'Test Temple' })];
    mockFetchSpotsByBounds.mockResolvedValue(spots);

    const { result } = renderHook(() => useSpots({ latitude: 38.2682, longitude: 140.8694 }, null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toHaveLength(2);
    expect(mockFetchSpotsByBounds).toHaveBeenCalled();
  });

  it('returns empty array when location is null', async () => {
    const { result } = renderHook(() => useSpots(null, null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toEqual([]);
    expect(mockFetchSpotsByBounds).not.toHaveBeenCalled();
  });

  it('auto-expands radius when too few spots', async () => {
    // First call returns < MIN_SPOTS_THRESHOLD, second call returns more
    mockFetchSpotsByBounds
      .mockResolvedValueOnce([makeFakeSpot()])
      .mockResolvedValueOnce([
        makeFakeSpot({ id: '1' }),
        makeFakeSpot({ id: '2' }),
        makeFakeSpot({ id: '3' }),
        makeFakeSpot({ id: '4' }),
        makeFakeSpot({ id: '5' }),
      ]);

    const { result } = renderHook(() => useSpots({ latitude: 38.2682, longitude: 140.8694 }, null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have expanded and fetched more
    expect(mockFetchSpotsByBounds).toHaveBeenCalledTimes(2);
    expect(result.current.spots).toHaveLength(5);
  });

  it('filters by visited when filterMode is visited', async () => {
    const spots = [
      makeFakeSpot({ id: 'spot-1' }),
      makeFakeSpot({ id: 'spot-2' }),
      makeFakeSpot({ id: 'spot-3' }),
    ];
    mockFetchSpotsByBounds.mockResolvedValue(spots);

    const visitedIds = new Set(['spot-1', 'spot-3']);
    const { result } = renderHook(() =>
      useSpots({ latitude: 38.2682, longitude: 140.8694 }, null, 'visited', visitedIds)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toHaveLength(2);
    expect(result.current.spots.map(s => s.id)).toEqual(['spot-1', 'spot-3']);
  });

  it('returns all spots when filterMode is all', async () => {
    const spots = [makeFakeSpot({ id: 'spot-1' }), makeFakeSpot({ id: 'spot-2' })];
    mockFetchSpotsByBounds.mockResolvedValue(spots);

    const visitedIds = new Set(['spot-1']);
    const { result } = renderHook(() =>
      useSpots({ latitude: 38.2682, longitude: 140.8694 }, null, 'all', visitedIds)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toHaveLength(2);
  });

  it('fetches spots by map region when provided', async () => {
    const spots = [makeFakeSpot({ id: 'spot-1' }), makeFakeSpot({ id: 'spot-2' })];
    mockFetchSpotsByBounds.mockResolvedValue(spots);

    const region = {
      latitude: 38.27,
      longitude: 140.87,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };

    const { result } = renderHook(() => useSpots(null, region));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toHaveLength(2);
    expect(mockFetchSpotsByBounds).toHaveBeenCalledWith({
      minLat: 38.27 - 0.025,
      maxLat: 38.27 + 0.025,
      minLng: 140.87 - 0.025,
      maxLng: 140.87 + 0.025,
    });
  });
});
