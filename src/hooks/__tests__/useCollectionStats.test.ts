import { renderHook, waitFor } from '@testing-library/react-native';
import { useCollectionStats, RECENT_VISITS_COUNT } from '@hooks/useCollectionStats';

const mockFetchCollectionStats = jest.fn();
const mockFetchRegionStats = jest.fn();
const mockFetchPilgrimageProgress = jest.fn();

const mockFetchAllStamps = jest.fn().mockResolvedValue([]);

jest.mock('@services/stamps', () => ({
  fetchAllStamps: (...args: unknown[]) => mockFetchAllStamps(...args),
}));

const mockFetchVisitLog = jest.fn().mockResolvedValue([]);

jest.mock('@services/collection', () => ({
  fetchCollectionStats: (...args: unknown[]) => mockFetchCollectionStats(...args),
  fetchRegionStats: (...args: unknown[]) => mockFetchRegionStats(...args),
  fetchVisitLog: (...args: unknown[]) => mockFetchVisitLog(...args),
}));

const mockFetchSpotsByBounds = jest.fn().mockResolvedValue([]);
jest.mock('@services/spots', () => ({
  fetchSpotsByBounds: (...args: unknown[]) => mockFetchSpotsByBounds(...args),
}));

jest.mock('@services/pilgrimages', () => ({
  fetchPilgrimageProgress: (...args: unknown[]) => mockFetchPilgrimageProgress(...args),
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

  it('未認証時は初期値 (0/0/[]/[]) を返す', async () => {
    mockUser = null;
    const { result } = renderHook(() => useCollectionStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotCount).toBe(0);
    expect(result.current.stampCount).toBe(0);
    expect(result.current.regionStats).toEqual([]);
    expect(result.current.pilgrimageProgress).toEqual([]);
    expect(mockFetchCollectionStats).not.toHaveBeenCalled();
    expect(mockFetchRegionStats).not.toHaveBeenCalled();
    expect(mockFetchPilgrimageProgress).not.toHaveBeenCalled();
  });

  it('ログイン時に fetchCollectionStats, fetchRegionStats, fetchPilgrimageProgress を呼び出す', async () => {
    mockUser = { id: 'user-1' };
    mockFetchCollectionStats.mockResolvedValue({ spotCount: 0, stampCount: 0 });
    mockFetchRegionStats.mockResolvedValue([]);
    mockFetchPilgrimageProgress.mockResolvedValue([]);

    const { result } = renderHook(() => useCollectionStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchCollectionStats).toHaveBeenCalledWith('user-1');
    expect(mockFetchRegionStats).toHaveBeenCalledWith('user-1');
    expect(mockFetchPilgrimageProgress).toHaveBeenCalledWith('user-1');
  });

  it('取得したデータを正しく返す', async () => {
    mockUser = { id: 'user-1' };
    mockFetchCollectionStats.mockResolvedValue({ spotCount: 10, stampCount: 25 });
    mockFetchRegionStats.mockResolvedValue([
      { prefecture: '宮城県', visitedCount: 5, totalCount: 10 },
      { prefecture: '東京都', visitedCount: 3, totalCount: 20 },
    ]);
    mockFetchPilgrimageProgress.mockResolvedValue([
      {
        id: 'pilgrimage-1',
        name: '四国八十八ヶ所',
        description: null,
        category: null,
        totalSpots: 88,
        visitedCount: 12,
      },
    ]);

    const { result } = renderHook(() => useCollectionStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotCount).toBe(10);
    expect(result.current.stampCount).toBe(25);
    expect(result.current.regionStats).toHaveLength(2);
    expect(result.current.regionStats[0]).toEqual({
      prefecture: '宮城県',
      visitedCount: 5,
      totalCount: 10,
    });
    expect(result.current.pilgrimageProgress).toHaveLength(1);
    expect(result.current.pilgrimageProgress[0].name).toBe('四国八十八ヶ所');
    expect(result.current.pilgrimageProgress[0].visitedCount).toBe(12);
    expect(result.current.error).toBeNull();
  });

  it('エラー時は初期値 (0/0/[]/[]) を返す', async () => {
    mockUser = { id: 'user-1' };
    mockFetchCollectionStats.mockRejectedValue(new Error('Network error'));
    mockFetchRegionStats.mockRejectedValue(new Error('Network error'));
    mockFetchPilgrimageProgress.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCollectionStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotCount).toBe(0);
    expect(result.current.stampCount).toBe(0);
    expect(result.current.regionStats).toEqual([]);
    expect(result.current.pilgrimageProgress).toEqual([]);
  });
});

describe('useCollectionStats — 最近の参拝', () => {
  // 定数を外すと御朱印帳ぶんの全件が飛んでくる。引数まで見ないと気づけない
  it('直近3件だけを取りに行く', async () => {
    mockFetchAllStamps.mockClear();

    renderHook(() => useCollectionStats());

    await waitFor(() =>
      expect(mockFetchAllStamps).toHaveBeenCalledWith(expect.any(String), RECENT_VISITS_COUNT)
    );
    expect(RECENT_VISITS_COUNT).toBe(3);
  });
});

describe('useCollectionStats — もう少し（Issue #245）', () => {
  const SENDAI = { lat: 38.267, lng: 140.859 };
  const months = ['2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01'];
  const log = months.map((d, i) => ({
    spot_id: `visited-${i}`,
    visited_at: d,
    spotName: `寺社${i}`,
    spotType: 'shrine',
    lat: SENDAI.lat + i * 0.001,
    lng: SENDAI.lng,
    address: '宮城県仙台市青葉区',
    prefecture: '宮城県',
  }));
  const spotRow = (id: string, rank: number, dLat: number) => ({
    id,
    name: `候補${id}`,
    lat: SENDAI.lat + dLat,
    lng: SENDAI.lng,
    type: 'temple',
    address: '宮城県仙台市青葉区北山1',
    prefecture: '宮城県',
    status: 'active',
    rank,
  });

  beforeEach(() => {
    mockUser = { id: 'user-1' };
    mockFetchCollectionStats.mockResolvedValue({ spotCount: 4, stampCount: 4 });
    mockFetchRegionStats.mockResolvedValue([]);
    mockFetchPilgrimageProgress.mockResolvedValue([]);
    mockFetchVisitLog.mockResolvedValue(log);
  });

  it('よく行くエリアのまだの寺社を、ランク3以上・未訪問・近い順で返す', async () => {
    mockFetchSpotsByBounds.mockResolvedValue([
      spotRow('far', 5, 0.03),
      spotRow('near', 3, 0.005),
      spotRow('lowRank', 1, 0.001),
      spotRow('visited-0', 5, 0),
      spotRow('outside', 5, 0.2),
    ]);

    const { result } = renderHook(() => useCollectionStats());

    await waitFor(() => expect(result.current.mouSukoshi.some(r => r.kind === 'area')).toBe(true));
    const area = result.current.mouSukoshi.find(r => r.kind === 'area');
    if (area?.kind !== 'area') throw new Error();
    expect(area.label).toBe('仙台');
    expect(area.spots.map(s => s.id)).toEqual(['near', 'far']);
  });

  it('よく行くエリアが無ければ、寺社を取りに行かない', async () => {
    mockFetchVisitLog.mockResolvedValue(log.slice(0, 2));
    mockFetchSpotsByBounds.mockClear();

    const { result } = renderHook(() => useCollectionStats());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchSpotsByBounds).not.toHaveBeenCalled();
    expect(result.current.mouSukoshi).toEqual([]);
  });
});
