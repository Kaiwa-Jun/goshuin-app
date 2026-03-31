import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useWishlist } from '@hooks/useWishlist';

const mockFetchWishlistSpotIds = jest.fn();
const mockAddToWishlist = jest.fn();
const mockRemoveFromWishlist = jest.fn();

jest.mock('@services/wishlist', () => ({
  fetchWishlistSpotIds: (...args: unknown[]) => mockFetchWishlistSpotIds(...args),
  addToWishlist: (...args: unknown[]) => mockAddToWishlist(...args),
  removeFromWishlist: (...args: unknown[]) => mockRemoveFromWishlist(...args),
}));

let mockUser: { id: string } | null = null;

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockUser !== null,
  }),
}));

describe('useWishlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  it('未ログイン時は空のSetを返す', async () => {
    mockUser = null;
    const { result } = renderHook(() => useWishlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.wishlistSpotIds.size).toBe(0);
    expect(mockFetchWishlistSpotIds).not.toHaveBeenCalled();
  });

  it('ログイン時にwishlist spot IDsを取得する', async () => {
    mockUser = { id: 'user-1' };
    mockFetchWishlistSpotIds.mockResolvedValue(new Set(['spot-1', 'spot-2']));

    const { result } = renderHook(() => useWishlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.wishlistSpotIds.size).toBe(2);
    expect(result.current.wishlistSpotIds.has('spot-1')).toBe(true);
    expect(mockFetchWishlistSpotIds).toHaveBeenCalledWith('user-1');
  });

  it('フェッチエラー時は空のSetを返す', async () => {
    mockUser = { id: 'user-1' };
    mockFetchWishlistSpotIds.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWishlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.wishlistSpotIds.size).toBe(0);
  });

  it('toggleWishlist: 未登録スポットを追加する（楽観的更新）', async () => {
    mockUser = { id: 'user-1' };
    mockFetchWishlistSpotIds.mockResolvedValue(new Set(['spot-1']));
    mockAddToWishlist.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWishlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleWishlist('spot-2');
    });

    expect(result.current.wishlistSpotIds.has('spot-2')).toBe(true);
    expect(mockAddToWishlist).toHaveBeenCalledWith('user-1', 'spot-2');
  });

  it('toggleWishlist: 登録済みスポットを削除する（楽観的更新）', async () => {
    mockUser = { id: 'user-1' };
    mockFetchWishlistSpotIds.mockResolvedValue(new Set(['spot-1', 'spot-2']));
    mockRemoveFromWishlist.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWishlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleWishlist('spot-1');
    });

    expect(result.current.wishlistSpotIds.has('spot-1')).toBe(false);
    expect(mockRemoveFromWishlist).toHaveBeenCalledWith('user-1', 'spot-1');
  });

  it('toggleWishlist: API失敗時にロールバックする', async () => {
    mockUser = { id: 'user-1' };
    mockFetchWishlistSpotIds.mockResolvedValue(new Set(['spot-1']));
    mockAddToWishlist.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useWishlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleWishlist('spot-2');
    });

    // ロールバックされて spot-2 が含まれていないこと
    expect(result.current.wishlistSpotIds.has('spot-2')).toBe(false);
  });

  it('toggleWishlist: 未ログイン時は何もしない', async () => {
    mockUser = null;
    const { result } = renderHook(() => useWishlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleWishlist('spot-1');
    });

    expect(mockAddToWishlist).not.toHaveBeenCalled();
    expect(mockRemoveFromWishlist).not.toHaveBeenCalled();
  });

  it('isToggling: toggle中はtrueになる', async () => {
    mockUser = { id: 'user-1' };
    mockFetchWishlistSpotIds.mockResolvedValue(new Set());
    // addToWishlist を遅延させる
    mockAddToWishlist.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    const { result } = renderHook(() => useWishlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.toggleWishlist('spot-1');
    });

    expect(result.current.isToggling).toBe(true);

    await waitFor(() => {
      expect(result.current.isToggling).toBe(false);
    });
  });
});
