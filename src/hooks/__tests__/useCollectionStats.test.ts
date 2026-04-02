import { renderHook, waitFor } from '@testing-library/react-native';
import { useCollectionStats } from '@hooks/useCollectionStats';

const mockFetchCollectionStats = jest.fn();
const mockFetchRegionStats = jest.fn();

jest.mock('@services/collection', () => ({
  fetchCollectionStats: (...args: unknown[]) => mockFetchCollectionStats(...args),
  fetchRegionStats: (...args: unknown[]) => mockFetchRegionStats(...args),
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

describe('useCollectionStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  it('未認証時は初期値 (0/0/[]) を返す', async () => {
    mockUser = null;
    const { result } = renderHook(() => useCollectionStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotCount).toBe(0);
    expect(result.current.stampCount).toBe(0);
    expect(result.current.regionStats).toEqual([]);
    expect(mockFetchCollectionStats).not.toHaveBeenCalled();
    expect(mockFetchRegionStats).not.toHaveBeenCalled();
  });

  it('ログイン時に fetchCollectionStats と fetchRegionStats を呼び出す', async () => {
    mockUser = { id: 'user-1' };
    mockFetchCollectionStats.mockResolvedValue({ spotCount: 0, stampCount: 0 });
    mockFetchRegionStats.mockResolvedValue([]);

    const { result } = renderHook(() => useCollectionStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchCollectionStats).toHaveBeenCalledWith('user-1');
    expect(mockFetchRegionStats).toHaveBeenCalledWith('user-1');
  });

  it('取得したデータを正しく返す', async () => {
    mockUser = { id: 'user-1' };
    mockFetchCollectionStats.mockResolvedValue({ spotCount: 10, stampCount: 25 });
    mockFetchRegionStats.mockResolvedValue([
      { prefecture: '宮城県', visitedCount: 5 },
      { prefecture: '東京都', visitedCount: 3 },
    ]);

    const { result } = renderHook(() => useCollectionStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotCount).toBe(10);
    expect(result.current.stampCount).toBe(25);
    expect(result.current.regionStats).toHaveLength(2);
    expect(result.current.regionStats[0]).toEqual({ prefecture: '宮城県', visitedCount: 5 });
    expect(result.current.error).toBeNull();
  });

  it('エラー時は初期値 (0/0/[]) を返す', async () => {
    mockUser = { id: 'user-1' };
    mockFetchCollectionStats.mockRejectedValue(new Error('Network error'));
    mockFetchRegionStats.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCollectionStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotCount).toBe(0);
    expect(result.current.stampCount).toBe(0);
    expect(result.current.regionStats).toEqual([]);
  });
});
