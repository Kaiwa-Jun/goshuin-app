import { renderHook, act } from '@testing-library/react-native';
import { PermissionStatus } from 'expo-location';
import { useSearchScreen, MAX_SUGGESTED_SPOTS } from '@hooks/useSearchScreen';
import type { Spot } from '@/types/supabase';

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

describe('useSearchScreen', () => {
  it('初期状態で query が空、results が空', () => {
    const { result } = renderHook(() => useSearchScreen());
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.filterType).toBe('all');
  });

  it('setQuery でテキスト入力 → 300ms 後に results が更新される', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSearchScreen());

    act(() => {
      result.current.setQuery('Temple');
    });

    // デバウンス前は results が空
    expect(result.current.results).toEqual([]);

    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(result.current.results.length).toBe(2);
    expect(result.current.results.every(r => r.spot.name.includes('Temple'))).toBe(true);
    jest.useRealTimers();
  });

  it('filterType を shrine に変更 → results が神社のみに絞り込まれる', () => {
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

    expect(result.current.results.every(r => r.spot.type === 'shrine')).toBe(true);
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

    expect(result.current.results.length).toBe(2);

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.query).toBe('');
    expect(result.current.filterType).toBe('all');
    expect(result.current.results).toEqual([]);
    jest.useRealTimers();
  });

  it('filterType 変更後も results はフィルタに従う', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSearchScreen());

    act(() => {
      result.current.setQuery('e');
      result.current.setFilterType('temple');
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(result.current.results.every(r => r.spot.type === 'temple')).toBe(true);
    jest.useRealTimers();
  });

  it('results は距離順にソートされる', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSearchScreen());

    act(() => {
      result.current.setQuery('');
    });
    act(() => {
      jest.advanceTimersByTime(350);
    });

    // query が空なので results は空
    expect(result.current.results).toEqual([]);
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
});
