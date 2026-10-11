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

// useFocusEffect を useEffect として動作させるモック
let focusCallback: (() => void) | null = null;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { useEffect } = require('react');
    focusCallback = cb;
    useEffect(cb, [cb]);
  },
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

describe('useWishlist フォーカス復帰時の再取得（Issue #125）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'user-1' };
    focusCallback = null;
  });

  it('画面にフォーカスが戻るたびに ID を取り直す', async () => {
    mockFetchWishlistSpotIds
      .mockResolvedValueOnce(new Set(['spot-1', 'spot-2']))
      .mockResolvedValueOnce(new Set(['spot-1']));

    const { result } = renderHook(() => useWishlist());

    await waitFor(() => {
      expect(result.current.wishlistSpotIds.size).toBe(2);
    });

    // 別画面で削除されたあと、地図に戻ってきた想定
    await act(async () => {
      focusCallback?.();
    });

    await waitFor(() => {
      expect(result.current.wishlistSpotIds.size).toBe(1);
    });
    expect(mockFetchWishlistSpotIds).toHaveBeenCalledTimes(2);
  });
});

/* Issue #327 D-9: 「行きたい」からログインしたら、そのユーザーの行きたいを読み終えてから足す */
describe('useWishlist（#327 ログインに切り替わった描画）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  it('AC-10: ゲスト → ログインに切り替わったその描画から、取れるまで isLoading', async () => {
    const seen: { auth: boolean; isLoading: boolean }[] = [];
    const { result, rerender } = renderHook(() => {
      const r = useWishlist();
      seen.push({ auth: mockUser !== null, isLoading: r.isLoading });
      return r;
    });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let resolveFirst: (ids: Set<string>) => void = () => {};
    mockFetchWishlistSpotIds.mockReturnValueOnce(
      new Promise<Set<string>>(resolve => {
        resolveFirst = resolve;
      })
    );
    mockUser = { id: 'u1' };
    rerender({});

    const before = seen.filter(s => s.auth);
    expect(before.length).toBeGreaterThan(0);
    expect(before.filter(s => !s.isLoading)).toEqual([]);

    await act(async () => {
      resolveFirst(new Set(['s']));
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.wishlistSpotIds.has('s')).toBe(true);
  });
});
