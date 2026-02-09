import { renderHook, waitFor } from '@testing-library/react-native';
import { useSpotDetail } from '@hooks/useSpotDetail';
import type { Spot } from '@/types/supabase';

const mockFetchSpotById = jest.fn();

jest.mock('@services/spots', () => ({
  fetchSpotById: (...args: unknown[]) => mockFetchSpotById(...args),
}));

const fakeSpot: Spot = {
  id: 'spot-1',
  name: '大崎八幡宮',
  lat: 38.2744,
  lng: 140.8577,
  type: 'shrine',
  address: '宮城県仙台市青葉区八幡4-6-1',
  status: 'active',
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

describe('useSpotDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches spot by id', async () => {
    mockFetchSpotById.mockResolvedValue(fakeSpot);

    const { result } = renderHook(() => useSpotDetail('spot-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spot).toEqual(fakeSpot);
    expect(result.current.error).toBeNull();
    expect(mockFetchSpotById).toHaveBeenCalledWith('spot-1');
  });

  it('sets error when spot not found', async () => {
    mockFetchSpotById.mockResolvedValue(null);

    const { result } = renderHook(() => useSpotDetail('nonexistent'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spot).toBeNull();
    expect(result.current.error).toBe('スポットが見つかりません');
  });

  it('sets error when fetch throws', async () => {
    mockFetchSpotById.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSpotDetail('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spot).toBeNull();
    expect(result.current.error).toBe('Network error');
  });
});
