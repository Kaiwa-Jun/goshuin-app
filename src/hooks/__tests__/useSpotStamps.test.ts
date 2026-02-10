import { renderHook, waitFor } from '@testing-library/react-native';
import { useSpotStamps } from '@hooks/useSpotStamps';
import type { Stamp } from '@/types/supabase';

const mockFetchStampsBySpotId = jest.fn();

jest.mock('@services/stamps', () => ({
  fetchStampsBySpotId: (...args: unknown[]) => mockFetchStampsBySpotId(...args),
}));

let mockIsAuthenticated = false;

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

const makeStamp = (overrides: Partial<Stamp> = {}): Stamp => ({
  id: 'stamp-1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-06-01',
  image_path: 'img/1.jpg',
  memo: null,
  created_at: '2024-06-01',
  updated_at: '2024-06-01',
  ...overrides,
});

describe('useSpotStamps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = false;
  });

  it('returns empty result when not authenticated', async () => {
    mockIsAuthenticated = false;
    const { result } = renderHook(() => useSpotStamps('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamps).toEqual([]);
    expect(result.current.visitCount).toBe(0);
    expect(result.current.latestVisitDate).toBeNull();
    expect(mockFetchStampsBySpotId).not.toHaveBeenCalled();
  });

  it('fetches stamps when authenticated', async () => {
    mockIsAuthenticated = true;
    const stamps = [
      makeStamp({ id: 'stamp-1', visited_at: '2024-06-01' }),
      makeStamp({ id: 'stamp-2', visited_at: '2024-01-15' }),
    ];
    mockFetchStampsBySpotId.mockResolvedValue(stamps);

    const { result } = renderHook(() => useSpotStamps('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchStampsBySpotId).toHaveBeenCalledWith('spot-1');
    expect(result.current.stamps).toEqual(stamps);
    expect(result.current.visitCount).toBe(2);
    expect(result.current.latestVisitDate).toBe('2024-06-01');
  });

  it('returns empty result when authenticated but no stamps', async () => {
    mockIsAuthenticated = true;
    mockFetchStampsBySpotId.mockResolvedValue([]);

    const { result } = renderHook(() => useSpotStamps('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamps).toEqual([]);
    expect(result.current.visitCount).toBe(0);
    expect(result.current.latestVisitDate).toBeNull();
  });

  it('returns empty result on fetch error', async () => {
    mockIsAuthenticated = true;
    mockFetchStampsBySpotId.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSpotStamps('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamps).toEqual([]);
    expect(result.current.visitCount).toBe(0);
    expect(result.current.latestVisitDate).toBeNull();
  });
});
