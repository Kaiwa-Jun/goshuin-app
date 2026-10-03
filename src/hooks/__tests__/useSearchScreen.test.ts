import { renderHook, act } from '@testing-library/react-native';
import { PermissionStatus } from 'expo-location';
import { useSearchScreen, MAX_SUGGESTED_SPOTS } from '@hooks/useSearchScreen';
import type { Spot } from '@/types/supabase';
import type { SearchRow, SpotRow } from '@utils/placeSearch';
import { TEST_SPOTS } from '@utils/__tests__/placeSearchFixtures';

import { useSpots } from '@hooks/useSpots';
import { useLocation } from '@hooks/useLocation';

// モック（supabase 初期化を回避するため useSpots, useLocation をモック）
jest.mock('@services/spots', () => ({
  fetchSpotsByBounds: jest.fn(),
}));
jest.mock('@hooks/useSpots');
jest.mock('@hooks/useLocation');

const mockUseSpots = useSpots as jest.MockedFunction<typeof useSpots>;
const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;

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

const allSpots: Spot[] = [
  makeFakeSpot({ id: '1', name: 'Aoba Shrine', lat: 38.269, lng: 140.87, type: 'shrine' }),
  makeFakeSpot({ id: '2', name: 'Sendai Temple', lat: 38.28, lng: 140.88, type: 'temple' }),
  makeFakeSpot({ id: '3', name: 'Zuihoden Temple', lat: 38.25, lng: 140.86, type: 'temple' }),
];

const userLocation = { latitude: 38.2682, longitude: 140.8694 };

beforeEach(() => {
  mockUseLocation.mockReturnValue({
    location: userLocation,
    isLoading: false,
    error: null,
    permissionStatus: PermissionStatus.GRANTED,
    refreshLocation: jest.fn(),
  });
  mockUseSpots.mockReturnValue({
    spots: allSpots,
    allSpots,
    isLoading: false,
    error: null,
  });
});

function mockLocationDenied() {
  mockUseLocation.mockReturnValue({
    location: userLocation,
    isLoading: false,
    error: null,
    permissionStatus: PermissionStatus.DENIED,
    refreshLocation: jest.fn(),
  });
}

function mockSpots(spots: Spot[]) {
  mockUseSpots.mockReturnValue({
    spots,
    allSpots: spots,
    isLoading: false,
    error: null,
  });
}

/** 一覧の寺社の行だけ（Issue #311 で results は rows になった） */
function spotRows(rows: SearchRow[]): SpotRow[] {
  return rows.filter((r): r is SpotRow => r.kind === 'spot');
}

describe('useSearchScreen', () => {
  it('初期状態で query が空、rows が空', () => {
    const { result } = renderHook(() => useSearchScreen());
    expect(result.current.query).toBe('');
    expect(result.current.rows).toEqual([]);
    expect(result.current.filterType).toBe('all');
  });

  it('setQuery でテキスト入力 → 300ms 後に rows が更新される', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSearchScreen());

    act(() => {
      result.current.setQuery('Temple');
    });

    // デバウンス前は rows が空
    expect(spotRows(result.current.rows)).toEqual([]);

    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(spotRows(result.current.rows).length).toBe(2);
    expect(spotRows(result.current.rows).every(r => r.spot.name.includes('Temple'))).toBe(true);
    jest.useRealTimers();
  });

  it('filterType を shrine に変更 → 寺社の行が神社のみに絞り込まれる', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSearchScreen());

    act(() => {
      result.current.setQuery('a');
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    // filterType を shrine に変更
    act(() => {
      result.current.setFilterType('shrine');
    });

    expect(spotRows(result.current.rows).every(r => r.spot.type === 'shrine')).toBe(true);
    jest.useRealTimers();
  });

  it('clearSearch で query と filterType がリセットされる', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSearchScreen());

    act(() => {
      result.current.setQuery('Temple');
      result.current.setFilterType('temple');
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(spotRows(result.current.rows).length).toBe(2);

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.query).toBe('');
    expect(result.current.filterType).toBe('all');
    expect(spotRows(result.current.rows)).toEqual([]);
    jest.useRealTimers();
  });

  it('filterType 変更後も寺社の行はフィルタに従う', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSearchScreen());

    act(() => {
      result.current.setQuery('e');
      result.current.setFilterType('temple');
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(spotRows(result.current.rows).every(r => r.spot.type === 'temple')).toBe(true);
    jest.useRealTimers();
  });

  it('query が空なら rows は空', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSearchScreen());

    act(() => {
      result.current.setQuery('');
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    // query が空なので rows は空
    expect(spotRows(result.current.rows)).toEqual([]);
    jest.useRealTimers();
  });

  describe('未入力時の提案スポット', () => {
    it('位置情報許可済みのとき nearby モードで距離昇順に並ぶ', () => {
      const { result } = renderHook(() => useSearchScreen());

      expect(result.current.suggestionMode).toBe('nearby');
      const distances = result.current.suggestedSpots.map(s => s.distance);
      expect(distances).toEqual([...distances].sort((a, b) => a - b));
    });

    it('位置情報拒否のとき popular モードで rank 降順に並ぶ', () => {
      mockLocationDenied();
      mockSpots([
        makeFakeSpot({ id: '1', rank: 1 }),
        makeFakeSpot({ id: '2', rank: 5 }),
        makeFakeSpot({ id: '3', rank: 3 }),
      ]);

      const { result } = renderHook(() => useSearchScreen());

      expect(result.current.suggestionMode).toBe('popular');
      expect(result.current.suggestedSpots.map(s => s.spot.rank)).toEqual([5, 3, 1]);
    });

    it('popular モードで同 rank は id 昇順のタイブレーク', () => {
      mockLocationDenied();
      mockSpots([makeFakeSpot({ id: 'b', rank: 3 }), makeFakeSpot({ id: 'a', rank: 3 })]);

      const { result } = renderHook(() => useSearchScreen());

      expect(result.current.suggestedSpots.map(s => s.spot.id)).toEqual(['a', 'b']);
    });

    it('MAX_SUGGESTED_SPOTS は 10 で、11件与えると nearby は 10 件に切り詰める', () => {
      const spots = Array.from({ length: 11 }, (_, i) =>
        makeFakeSpot({ id: `spot-${i}`, lat: 38.27 + i * 0.01 })
      );
      mockSpots(spots);

      const { result } = renderHook(() => useSearchScreen());

      expect(MAX_SUGGESTED_SPOTS).toBe(10);
      expect(result.current.suggestedSpots.length).toBe(10);
    });

    it('11件与えると popular も 10 件に切り詰める', () => {
      mockLocationDenied();
      const spots = Array.from({ length: 11 }, (_, i) =>
        makeFakeSpot({ id: `spot-${i}`, rank: (i % 5) + 1 })
      );
      mockSpots(spots);

      const { result } = renderHook(() => useSearchScreen());

      expect(result.current.suggestedSpots.length).toBe(10);
    });

    it('スポット0件のとき suggestedSpots は空配列', () => {
      mockSpots([]);

      const { result } = renderHook(() => useSearchScreen());

      expect(result.current.suggestedSpots).toEqual([]);
    });

    it('popular モードの distance はすべて 0（見せかけの距離を返さない）', () => {
      mockLocationDenied();

      const { result } = renderHook(() => useSearchScreen());

      expect(result.current.suggestedSpots.every(s => s.distance === 0)).toBe(true);
    });

    it('query を入力しても suggestedSpots は変わらない', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useSearchScreen());

      const before = result.current.suggestedSpots.map(s => s.spot.id);

      act(() => {
        result.current.setQuery('Temple');
      });
      act(() => {
        jest.advanceTimersByTime(350);
      });

      expect(result.current.suggestedSpots.map(s => s.spot.id)).toEqual(before);
      jest.useRealTimers();
    });

    it('allSpots の元配列を破壊しない', () => {
      mockLocationDenied();
      const spots = [
        makeFakeSpot({ id: '1', rank: 1 }),
        makeFakeSpot({ id: '2', rank: 5 }),
        makeFakeSpot({ id: '3', rank: 3 }),
      ];
      const originalOrder = spots.map(s => s.id);
      mockSpots(spots);

      renderHook(() => useSearchScreen());

      expect(spots.map(s => s.id)).toEqual(originalOrder);
    });
  });

  describe('場所の行とエンター（Issue #311）', () => {
    // 東京駅。位置情報は許可（並びは nearby）
    const tokyoStation = { latitude: 35.6812, longitude: 139.7671 };

    beforeEach(() => {
      mockUseLocation.mockReturnValue({
        location: tokyoStation,
        isLoading: false,
        error: null,
        permissionStatus: PermissionStatus.GRANTED,
        refreshLocation: jest.fn(),
      });
      mockSpots(TEST_SPOTS.map(s => s.spot));
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('AC-20: 「横浜」で 300ms のあと、いちばん上が場所の行、寺社は名前・地名だけの順', () => {
      const { result } = renderHook(() => useSearchScreen());

      act(() => {
        result.current.setQuery('横浜');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.rows[0]).toMatchObject({
        kind: 'place',
        label: '横浜',
        prefecture: '神奈川県',
        count: 3,
      });
      expect(spotRows(result.current.rows).map(r => r.spot.id)).toEqual(['y1', 'y3', 'y2']);
      expect(result.current.showPlaceCredit).toBe(false);
    });

    it('AC-21: エンターは 300ms 待たずに、いま入っている言葉で一覧のいちばん上を返す', async () => {
      const { result } = renderHook(() => useSearchScreen());

      act(() => {
        result.current.setQuery('明治神宮');
      });
      let top: SearchRow | null = null;
      await act(async () => {
        top = await result.current.resolveSubmit();
      });
      expect(top).toMatchObject({ kind: 'spot', spot: { id: 't1' } });

      act(() => {
        result.current.setQuery('');
      });
      let empty: SearchRow | null = null;
      await act(async () => {
        empty = await result.current.resolveSubmit();
      });
      expect(empty).toBeNull();
    });

    it('AC-41: 「八坂」は場所の行があっても、エンターは最初の寺社', async () => {
      const { result } = renderHook(() => useSearchScreen());

      act(() => {
        result.current.setQuery('八坂');
      });
      let top: SearchRow | null = null;
      await act(async () => {
        top = await result.current.resolveSubmit();
      });

      expect(top).toMatchObject({ kind: 'spot', spot: { id: 'q2' } });
    });

    it('寺社の読み込み中は、エンターで何もしない（null）', async () => {
      mockUseSpots.mockReturnValue({ spots: [], allSpots: [], isLoading: true, error: null });
      const { result } = renderHook(() => useSearchScreen());

      act(() => {
        result.current.setQuery('横浜');
      });
      let top: SearchRow | null = null;
      await act(async () => {
        top = await result.current.resolveSubmit();
      });

      expect(top).toBeNull();
    });
  });
});
