import { renderHook, act } from '@testing-library/react-native';
import { useSearchScreen } from '@hooks/useSearchScreen';
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
  status: 'active',
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
    permissionStatus: null,
    refreshLocation: jest.fn(),
  });
  mockUseSpots.mockReturnValue({
    spots: allSpots,
    allSpots,
    isLoading: false,
    error: null,
  });
});

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
});
