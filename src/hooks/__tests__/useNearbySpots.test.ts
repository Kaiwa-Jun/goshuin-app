import { renderHook, act } from '@testing-library/react-native';
import { useNearbySpots } from '@hooks/useNearbySpots';
import { useLocation } from '@hooks/useLocation';
import { useSpots } from '@hooks/useSpots';
import { calculateDistance } from '@utils/geo';
import type { Spot } from '@/types/supabase';

jest.mock('@hooks/useLocation', () => ({
  useLocation: jest.fn(),
}));
jest.mock('@hooks/useSpots', () => ({
  useSpots: jest.fn(),
}));
jest.mock('@utils/geo', () => ({
  ...jest.requireActual('@utils/geo'),
  calculateDistance: jest.fn(),
}));

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockUseSpots = useSpots as jest.MockedFunction<typeof useSpots>;
const mockCalculateDistance = calculateDistance as jest.MockedFunction<typeof calculateDistance>;

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

describe('useNearbySpots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('読み込み中は isLoading: true を返す', () => {
    mockUseLocation.mockReturnValue({
      location: null,
      isLoading: true,
      error: null,
      permissionStatus: null,
      refreshLocation: jest.fn(),
    });
    mockUseSpots.mockReturnValue({
      spots: [],
      allSpots: [],
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() => useNearbySpots());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.nearbySpots).toEqual([]);
  });

  it('スポットを距離順でソートして返す', () => {
    const location = { latitude: 38.2682, longitude: 140.8694 };
    const spotA = makeFakeSpot({ id: 'spot-a', name: 'Far Shrine', lat: 38.3, lng: 140.9 });
    const spotB = makeFakeSpot({ id: 'spot-b', name: 'Near Temple', lat: 38.269, lng: 140.87 });
    const spotC = makeFakeSpot({ id: 'spot-c', name: 'Mid Shrine', lat: 38.28, lng: 140.88 });

    mockUseLocation.mockReturnValue({
      location,
      isLoading: false,
      error: null,
      permissionStatus: null,
      refreshLocation: jest.fn(),
    });
    mockUseSpots.mockReturnValue({
      spots: [spotA, spotB, spotC],
      allSpots: [spotA, spotB, spotC],
      isLoading: false,
      error: null,
    });

    // Near (0.5km), Mid (1.5km), Far (5.0km)
    mockCalculateDistance
      .mockReturnValueOnce(5.0) // spotA
      .mockReturnValueOnce(0.5) // spotB
      .mockReturnValueOnce(1.5); // spotC

    const { result } = renderHook(() => useNearbySpots());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.nearbySpots).toHaveLength(3);
    expect(result.current.nearbySpots[0].spot.id).toBe('spot-b');
    expect(result.current.nearbySpots[0].distanceKm).toBe(0.5);
    expect(result.current.nearbySpots[1].spot.id).toBe('spot-c');
    expect(result.current.nearbySpots[1].distanceKm).toBe(1.5);
    expect(result.current.nearbySpots[2].spot.id).toBe('spot-a');
    expect(result.current.nearbySpots[2].distanceKm).toBe(5.0);
  });

  it('検索クエリでフィルタリングできる', () => {
    const location = { latitude: 38.2682, longitude: 140.8694 };
    const spotA = makeFakeSpot({ id: 'spot-a', name: '青葉神社' });
    const spotB = makeFakeSpot({ id: 'spot-b', name: '大崎八幡宮' });
    const spotC = makeFakeSpot({ id: 'spot-c', name: '青葉山寺院' });

    mockUseLocation.mockReturnValue({
      location,
      isLoading: false,
      error: null,
      permissionStatus: null,
      refreshLocation: jest.fn(),
    });
    mockUseSpots.mockReturnValue({
      spots: [spotA, spotB, spotC],
      allSpots: [spotA, spotB, spotC],
      isLoading: false,
      error: null,
    });

    mockCalculateDistance
      .mockReturnValueOnce(1.0)
      .mockReturnValueOnce(2.0)
      .mockReturnValueOnce(3.0);

    const { result } = renderHook(() => useNearbySpots());

    // searchQuery が空のとき filteredSpots === nearbySpots
    expect(result.current.filteredSpots).toEqual(result.current.nearbySpots);
    expect(result.current.filteredSpots).toHaveLength(3);

    // 検索クエリを設定 - distance が再計算されるので mock を再設定
    mockCalculateDistance
      .mockReturnValueOnce(1.0)
      .mockReturnValueOnce(2.0)
      .mockReturnValueOnce(3.0);

    act(() => {
      result.current.setSearchQuery('青葉');
    });

    expect(result.current.searchQuery).toBe('青葉');
    expect(result.current.filteredSpots).toHaveLength(2);
    expect(result.current.filteredSpots[0].spot.name).toBe('青葉神社');
    expect(result.current.filteredSpots[1].spot.name).toBe('青葉山寺院');
  });

  it('位置情報なしの場合は空配列を返す', () => {
    mockUseLocation.mockReturnValue({
      location: null,
      isLoading: false,
      error: null,
      permissionStatus: null,
      refreshLocation: jest.fn(),
    });
    mockUseSpots.mockReturnValue({
      spots: [],
      allSpots: [],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useNearbySpots());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.nearbySpots).toEqual([]);
    expect(result.current.filteredSpots).toEqual([]);
  });

  it('エラー時にerrorを返す', () => {
    mockUseLocation.mockReturnValue({
      location: null,
      isLoading: false,
      error: '位置情報の取得に失敗しました',
      permissionStatus: null,
      refreshLocation: jest.fn(),
    });
    mockUseSpots.mockReturnValue({
      spots: [],
      allSpots: [],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useNearbySpots());

    expect(result.current.error).toBe('位置情報の取得に失敗しました');
    expect(result.current.nearbySpots).toEqual([]);
  });
});
