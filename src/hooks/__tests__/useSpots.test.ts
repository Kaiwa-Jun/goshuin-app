import { act, renderHook, waitFor } from '@testing-library/react-native';
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

  it('行きたいフィルタで、保存したスポットだけに絞る', async () => {
    const spots = [makeFakeSpot(), makeFakeSpot({ id: 'spot-2' }), makeFakeSpot({ id: 'spot-3' })];
    mockFetchAllActiveSpots.mockResolvedValue(spots);

    const { result } = renderHook(() =>
      useSpots(
        { latitude: 38.2682, longitude: 140.8694 },
        'wishlist',
        new Set(['spot-2']),
        new Set(['spot-1', 'spot-3'])
      )
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 訪問済みの Set は無視され、行きたいの Set だけが効く
    expect(result.current.spots.map(s => s.id)).toEqual(['spot-1', 'spot-3']);
    expect(result.current.allSpots).toHaveLength(3);
  });

  it('行きたいが0件なら空になる。全件に戻さない', async () => {
    mockFetchAllActiveSpots.mockResolvedValue([makeFakeSpot()]);

    const { result } = renderHook(() =>
      useSpots({ latitude: 38.2682, longitude: 140.8694 }, 'wishlist', undefined, new Set())
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.spots).toEqual([]);
  });
});

/* Issue #327 D-9: 位置が届いた描画から、その位置の取得が終わるまで isLoading（空の一覧を「読み終えた」と見せない） */
describe('useSpots（#327 位置が届いた描画）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('AC-11: 位置が null から値に変わったその描画から、取れるまで isLoading', async () => {
    const O = { latitude: 35, longitude: 135 };
    const seen: { loc: unknown; isLoading: boolean }[] = [];
    const { result, rerender } = renderHook(
      ({ loc }: { loc: { latitude: number; longitude: number } | null }) => {
        const r = useSpots(loc);
        seen.push({ loc, isLoading: r.isLoading });
        return r;
      },
      { initialProps: { loc: null as { latitude: number; longitude: number } | null } }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let resolveFetch: (spots: Spot[]) => void = () => {};
    mockFetchAllActiveSpots.mockReturnValueOnce(
      new Promise<Spot[]>(resolve => {
        resolveFetch = resolve;
      })
    );
    rerender({ loc: O });

    const before = seen.filter(s => s.loc === O);
    expect(before.length).toBeGreaterThan(0);
    expect(before.filter(s => !s.isLoading)).toEqual([]);

    const spots = [makeFakeSpot()];
    await act(async () => {
      resolveFetch(spots);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.allSpots).toEqual(spots);
  });
});
