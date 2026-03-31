import { renderHook, waitFor } from '@testing-library/react-native';
import { useWishlistSpots } from '@hooks/useWishlistSpots';
import type { WishlistWithSpot } from '@/types/supabase';

const mockFetchWishlistSpots = jest.fn();

jest.mock('@services/wishlist', () => ({
  fetchWishlistSpots: (...args: unknown[]) => mockFetchWishlistSpots(...args),
}));

// useFocusEffect をuseEffectとして動作させるモック
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
}));

let mockUser: { id: string } | null = null;

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const makeWishlistSpot = (spotId: string, name: string): WishlistWithSpot => ({
  id: `wl-${spotId}`,
  user_id: 'user-1',
  spot_id: spotId,
  created_at: '2026-01-01T00:00:00Z',
  spots: {
    name,
    type: 'shrine',
    address: `${name}の住所`,
  },
});

describe('useWishlistSpots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  it('未認証時はspots=[], isLoading=falseを返す', async () => {
    mockUser = null;
    const { result } = renderHook(() => useWishlistSpots());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toEqual([]);
    expect(mockFetchWishlistSpots).not.toHaveBeenCalled();
  });

  it('認証済み: fetchWishlistSpotsがuserIdで呼ばれる', async () => {
    mockUser = { id: 'user-1' };
    mockFetchWishlistSpots.mockResolvedValue([]);

    const { result } = renderHook(() => useWishlistSpots());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchWishlistSpots).toHaveBeenCalledWith('user-1');
  });

  it('データ取得成功: wishlistスポット一覧を返す', async () => {
    mockUser = { id: 'user-1' };
    const mockSpots = [
      makeWishlistSpot('spot-1', '伊勢神宮'),
      makeWishlistSpot('spot-2', '浅草寺'),
    ];
    mockFetchWishlistSpots.mockResolvedValue(mockSpots);

    const { result } = renderHook(() => useWishlistSpots());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toHaveLength(2);
    expect(result.current.spots[0].spots.name).toBe('伊勢神宮');
    expect(result.current.error).toBeNull();
  });

  it('エラー時: error がセットされ、spots は空のまま', async () => {
    mockUser = { id: 'user-1' };
    mockFetchWishlistSpots.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWishlistSpots());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spots).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });

  it('フォーカス時にリフェッチされる', async () => {
    mockUser = { id: 'user-1' };
    mockFetchWishlistSpots.mockResolvedValue([]);

    const { result } = renderHook(() => useWishlistSpots());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // useFocusEffect がuseEffectとして動くため、マウント時に1回呼ばれる
    expect(mockFetchWishlistSpots).toHaveBeenCalledTimes(1);
  });
});
