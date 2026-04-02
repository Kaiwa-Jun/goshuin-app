import { renderHook, waitFor } from '@testing-library/react-native';
import { useSpots } from '@hooks/useSpots';
import type { Spot } from '@/types/supabase';

const mockFetchAllActiveSpots = jest.fn();

jest.mock('@services/spots', () => ({
  fetchAllActiveSpots: (...args: unknown[]) => mockFetchAllActiveSpots(...args),
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
  rank: 3,
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

  it('fetches all active spots for given location', async () => {
    const spots = [makeFakeSpot(), makeFakeSpot({ id: 'spot-2', name: 'Test Temple' })];
    mockFetchAllActiveSpots.mockResolvedValue(spots);

    const { result } = renderHook(() => useSpots({ latitude: 38.2682, longitude: 140.8694 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toHaveLength(2);
    expect(mockFetchAllActiveSpots).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when location is null', async () => {
    const { result } = renderHook(() => useSpots(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toEqual([]);
    expect(mockFetchAllActiveSpots).not.toHaveBeenCalled();
  });

  it('filters by visited when filterMode is visited', async () => {
    const spots = [
      makeFakeSpot({ id: 'spot-1' }),
      makeFakeSpot({ id: 'spot-2' }),
      makeFakeSpot({ id: 'spot-3' }),
    ];
    mockFetchAllActiveSpots.mockResolvedValue(spots);

    const visitedIds = new Set(['spot-1', 'spot-3']);
    const { result } = renderHook(() =>
      useSpots({ latitude: 38.2682, longitude: 140.8694 }, 'visited', visitedIds)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toHaveLength(2);
    expect(result.current.spots.map(s => s.id)).toEqual(['spot-1', 'spot-3']);
  });

  it('returns all spots when filterMode is all', async () => {
    const spots = [makeFakeSpot({ id: 'spot-1' }), makeFakeSpot({ id: 'spot-2' })];
    mockFetchAllActiveSpots.mockResolvedValue(spots);

    const visitedIds = new Set(['spot-1']);
    const { result } = renderHook(() =>
      useSpots({ latitude: 38.2682, longitude: 140.8694 }, 'all', visitedIds)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toHaveLength(2);
  });
});
