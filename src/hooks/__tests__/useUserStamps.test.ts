import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useUserStamps } from '@hooks/useUserStamps';

// useFocusEffect を useEffect として動かし、最後に渡された cb を覚える（useWishlist.test.ts と同じ）
let mockFocusCallback: (() => void) | null = null;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { useEffect } = require('react');
    mockFocusCallback = cb;
    useEffect(cb, [cb]);
  },
}));

const mockFetchVisitedSpotIds = jest.fn();

jest.mock('@services/stamps', () => ({
  fetchVisitedSpotIds: (...args: unknown[]) => mockFetchVisitedSpotIds(...args),
}));

let mockIsAuthenticated = false;

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

describe('useUserStamps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = false;
  });

  it('returns empty Set when not authenticated', async () => {
    mockIsAuthenticated = false;
    const { result } = renderHook(() => useUserStamps());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visitedSpotIds.size).toBe(0);
    expect(mockFetchVisitedSpotIds).not.toHaveBeenCalled();
  });

  it('fetches visited spot IDs when authenticated', async () => {
    mockIsAuthenticated = true;
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-1', 'spot-2']));

    const { result } = renderHook(() => useUserStamps());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visitedSpotIds.size).toBe(2);
    expect(result.current.visitedSpotIds.has('spot-1')).toBe(true);
  });

  it('returns empty Set on fetch error', async () => {
    mockIsAuthenticated = true;
    mockFetchVisitedSpotIds.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUserStamps());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visitedSpotIds.size).toBe(0);
  });

  /* Issue #293 D-11: 記録して地図に戻ったら、訪問済みを取り直す */
  describe('画面に戻ったときの取り直し', () => {
    it('戻ると取り直す。届くまでは isLoading を戻さず、今の Set を出したまま（AC-1）', async () => {
      mockIsAuthenticated = true;
      mockFetchVisitedSpotIds.mockResolvedValueOnce(new Set(['a']));

      const { result } = renderHook(() => useUserStamps());
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.visitedSpotIds.has('a')).toBe(true);
      const before = result.current.visitedSpotIds;

      let resolveSecond: (ids: Set<string>) => void = () => {};
      mockFetchVisitedSpotIds.mockReturnValueOnce(
        new Promise<Set<string>>(resolve => {
          resolveSecond = resolve;
        })
      );
      act(() => {
        mockFocusCallback?.();
      });

      expect(mockFetchVisitedSpotIds).toHaveBeenCalledTimes(2);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.visitedSpotIds).toBe(before);

      await act(async () => {
        resolveSecond(new Set(['a', 'b']));
      });
      expect(result.current.visitedSpotIds.has('b')).toBe(true);
    });

    it('ログインしたときは最初の取得と同じ扱い。届くまで isLoading が true（AC-1）', async () => {
      mockIsAuthenticated = false;
      const { result, rerender } = renderHook(() => useUserStamps());
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(mockFetchVisitedSpotIds).not.toHaveBeenCalled();

      let resolveFirst: (ids: Set<string>) => void = () => {};
      mockFetchVisitedSpotIds.mockReturnValueOnce(
        new Promise<Set<string>>(resolve => {
          resolveFirst = resolve;
        })
      );
      mockIsAuthenticated = true;
      rerender({});

      expect(mockFetchVisitedSpotIds).toHaveBeenCalledTimes(1);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveFirst(new Set(['a']));
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.visitedSpotIds.has('a')).toBe(true);
    });

    it('取り直しに失敗したら、今の Set を残す（AC-2）', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockIsAuthenticated = true;
      mockFetchVisitedSpotIds.mockResolvedValueOnce(new Set(['a']));

      const { result } = renderHook(() => useUserStamps());
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockFetchVisitedSpotIds.mockRejectedValueOnce(new Error('Network error'));
      await act(async () => {
        mockFocusCallback?.();
      });

      expect(mockFetchVisitedSpotIds).toHaveBeenCalledTimes(2);
      expect(result.current.visitedSpotIds.size).toBe(1);
      expect(result.current.visitedSpotIds.has('a')).toBe(true);
      expect(warn.mock.calls.at(-1)?.[0]).toBe('[useUserStamps] fetchVisitedSpotIds failed:');
      warn.mockRestore();
    });
  });
});

/* Issue #327: 「取れた 0 枚」と「失敗」「取り直し中」を見分ける（地図のカードを嘘で出さない） */
describe('useUserStamps（#327 取れた・失敗・取り直し中）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = false;
  });

  it('AC-5: 戻り値は 4 つ。ゲストは取らずに 0 枚・どれも false', async () => {
    const { result } = renderHook(() => useUserStamps());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(Object.keys(result.current).sort()).toEqual(
      ['isLoading', 'isRefreshing', 'loadFailed', 'visitedSpotIds'].sort()
    );
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.visitedSpotIds.size).toBe(0);
    expect(mockFetchVisitedSpotIds).toHaveBeenCalledTimes(0);
  });

  it('AC-6: 最初の取得が成功したら、どれも false で 2 件', async () => {
    mockIsAuthenticated = true;
    mockFetchVisitedSpotIds.mockResolvedValueOnce(new Set(['spot-1', 'spot-2']));
    const { result } = renderHook(() => useUserStamps());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.visitedSpotIds.size).toBe(2);
  });

  it('AC-7: 最初の取得が失敗したら loadFailed。次に取れたら戻る（その最中は isLoading）', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockIsAuthenticated = true;
    mockFetchVisitedSpotIds.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useUserStamps());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.loadFailed).toBe(true);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.visitedSpotIds.size).toBe(0);

    let resolveRetry: (ids: Set<string>) => void = () => {};
    mockFetchVisitedSpotIds.mockReturnValueOnce(
      new Promise<Set<string>>(resolve => {
        resolveRetry = resolve;
      })
    );
    act(() => {
      mockFocusCallback?.();
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveRetry(new Set(['a']));
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.visitedSpotIds.size).toBe(1);
    warn.mockRestore();
  });

  it('AC-8: 取り直しの最中だけ isRefreshing。失敗しても今の Set を残し loadFailed にしない', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockIsAuthenticated = true;
    mockFetchVisitedSpotIds.mockResolvedValueOnce(new Set(['a']));
    const { result } = renderHook(() => useUserStamps());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let resolveRefresh: (ids: Set<string>) => void = () => {};
    mockFetchVisitedSpotIds.mockReturnValueOnce(
      new Promise<Set<string>>(resolve => {
        resolveRefresh = resolve;
      })
    );
    act(() => {
      mockFocusCallback?.();
    });
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.visitedSpotIds.has('a')).toBe(true);

    await act(async () => {
      resolveRefresh(new Set(['a', 'b']));
    });
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.visitedSpotIds.size).toBe(2);

    mockFetchVisitedSpotIds.mockRejectedValueOnce(new Error('Network error'));
    await act(async () => {
      mockFocusCallback?.();
    });
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.visitedSpotIds.has('a')).toBe(true);
    expect(result.current.loadFailed).toBe(false);
    warn.mockRestore();
  });

  it('AC-9: ゲスト → ログインに切り替わったその描画から、取れるまで isLoading', async () => {
    const seen: { auth: boolean; isLoading: boolean }[] = [];
    const { result, rerender } = renderHook(() => {
      const r = useUserStamps();
      seen.push({ auth: mockIsAuthenticated, isLoading: r.isLoading });
      return r;
    });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let resolveFirst: (ids: Set<string>) => void = () => {};
    mockFetchVisitedSpotIds.mockReturnValueOnce(
      new Promise<Set<string>>(resolve => {
        resolveFirst = resolve;
      })
    );
    mockIsAuthenticated = true;
    rerender({});

    const before = seen.filter(s => s.auth);
    expect(before.length).toBeGreaterThan(0);
    expect(before.filter(s => !s.isLoading)).toEqual([]);

    await act(async () => {
      resolveFirst(new Set());
    });
    expect(result.current.isLoading).toBe(false);
  });
});
