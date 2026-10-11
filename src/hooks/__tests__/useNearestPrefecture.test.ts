import { renderHook, waitFor } from '@testing-library/react-native';

import { useNearestPrefecture } from '@hooks/useNearestPrefecture';
import { getBoundingBox } from '@utils/geo';

/*
 * あゆみの一言の県（Issue #327 D-13）。地図のカードと同じ規則:
 * 位置情報が許可されて取れたときだけ、50km 以内でいちばん近い寺社の県
 */
const mockFetchSpotsByBounds = jest.fn();
jest.mock('@services/spots', () => ({
  fetchSpotsByBounds: (...args: unknown[]) => mockFetchSpotsByBounds(...args),
}));

let mockLocation: {
  location: { latitude: number; longitude: number } | null;
  isLoading: boolean;
  error: string | null;
  permissionStatus: string;
};
jest.mock('@hooks/useLocation', () => ({
  useLocation: () => ({ ...mockLocation, refreshLocation: jest.fn() }),
}));

const O = { latitude: 35, longitude: 135 };
const spot = (id: string, km: number, prefecture: string | null) => ({
  id,
  name: id,
  lat: 35 + km / 111.195,
  lng: 135,
  type: 'shrine',
  address: null,
  prefecture,
  status: 'active',
  rank: 3,
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
});
const F = [spot('s1', 0.3, null), spot('s2', 0.8, '京都府'), spot('s3', 1.2, '滋賀県')];

describe('useNearestPrefecture（#327）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation = { location: O, isLoading: false, error: null, permissionStatus: 'granted' };
  });

  it('AC-49 (a): 許可があって取れたら、近くの寺社を 50km の範囲で 1 回読み、いちばん近い県', async () => {
    mockFetchSpotsByBounds.mockResolvedValue(F);
    const { result } = renderHook(() => useNearestPrefecture());

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current).toEqual({ prefecture: '京都府', isResolved: true });
    expect(mockFetchSpotsByBounds).toHaveBeenCalledTimes(1);
    expect(mockFetchSpotsByBounds).toHaveBeenCalledWith(getBoundingBox(35, 135, 50));
  });

  it('AC-49 (b): 許可がなければ読まずに null', async () => {
    mockLocation = { ...mockLocation, permissionStatus: 'denied' };
    const { result } = renderHook(() => useNearestPrefecture());

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current).toEqual({ prefecture: null, isResolved: true });
    expect(mockFetchSpotsByBounds).toHaveBeenCalledTimes(0);
  });

  it('AC-49 (c): 位置を取っている間は決まっていない', () => {
    mockLocation = { ...mockLocation, isLoading: true };
    const { result } = renderHook(() => useNearestPrefecture());

    expect(result.current.isResolved).toBe(false);
    expect(mockFetchSpotsByBounds).toHaveBeenCalledTimes(0);
  });

  it('AC-49 (d): 位置が取れなかったら読まずに null', async () => {
    mockLocation = { ...mockLocation, error: 'x' };
    const { result } = renderHook(() => useNearestPrefecture());

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current).toEqual({ prefecture: null, isResolved: true });
    expect(mockFetchSpotsByBounds).toHaveBeenCalledTimes(0);
  });

  it('AC-49 (e): 近くに寺社が無ければ null', async () => {
    mockFetchSpotsByBounds.mockResolvedValue([]);
    const { result } = renderHook(() => useNearestPrefecture());

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current).toEqual({ prefecture: null, isResolved: true });
  });
});
