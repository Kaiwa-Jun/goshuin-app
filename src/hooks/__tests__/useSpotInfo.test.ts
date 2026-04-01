import { renderHook, waitFor } from '@testing-library/react-native';
import { useSpotInfo, parseAggregatedInfo } from '@hooks/useSpotInfo';
import type { SpotAggregatedInfo } from '@/types/supabase';

const mockFetchSpotAggregatedInfo = jest.fn();

jest.mock('@services/spotInfo', () => ({
  fetchSpotAggregatedInfo: (...args: unknown[]) => mockFetchSpotAggregatedInfo(...args),
}));

const makeAggregatedInfo = (overrides: Partial<SpotAggregatedInfo> = {}): SpotAggregatedInfo => ({
  id: 'info-1',
  spot_id: 'spot-1',
  info_type: 'parking',
  info_data: { available: true, capacity: 10 },
  source_stamp_ids: ['stamp-1'],
  confidence_score: 0.9,
  last_reported_at: '2024-06-01T00:00:00Z',
  created_at: '2024-06-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
  ...overrides,
});

describe('parseAggregatedInfo', () => {
  it('returns null for empty array', () => {
    expect(parseAggregatedInfo([])).toBeNull();
  });

  it('parses parking info', () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'parking',
        info_data: { available: true, capacity: 20, location: '境内南側' },
      }),
    ];
    const result = parseAggregatedInfo(items);
    expect(result).toEqual({
      parking: { available: true, capacity: 20, location: '境内南側' },
    });
  });

  it('parses reception hours', () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'reception_hours',
        info_data: { open: '9:00', close: '16:00', notes: '年末年始は休み' },
      }),
    ];
    const result = parseAggregatedInfo(items);
    expect(result).toEqual({
      receptionHours: { open: '9:00', close: '16:00', notes: '年末年始は休み' },
    });
  });

  it('parses affiliated shrines', () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'affiliated_shrines',
        info_data: [{ name: '末社A', details: '境内東' }, { name: '末社B' }] as unknown as Record<
          string,
          unknown
        >,
      }),
    ];
    const result = parseAggregatedInfo(items);
    expect(result).toEqual({
      affiliatedShrines: [{ name: '末社A', details: '境内東' }, { name: '末社B' }],
    });
  });

  it('parses access notes array format', () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'access_notes',
        info_data: [
          { type: 'walking', text: '駅から徒歩10分' },
          { type: 'car', text: 'ICから車で5分' },
        ] as unknown as Record<string, unknown>,
      }),
    ];
    const result = parseAggregatedInfo(items);
    expect(result).toEqual({
      accessNotes: [
        { type: 'walking', text: '駅から徒歩10分' },
        { type: 'car', text: 'ICから車で5分' },
      ],
    });
  });

  it('parses access notes with legacy { value } format', () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'access_notes',
        info_data: { value: '駅から徒歩10分' } as unknown as Record<string, unknown>,
      }),
    ];
    const result = parseAggregatedInfo(items);
    expect(result).toEqual({
      accessNotes: [{ type: 'note', text: '駅から徒歩10分' }],
    });
  });

  it('parses multiple info types', () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'parking',
        info_data: { available: false },
      }),
      makeAggregatedInfo({
        id: 'info-2',
        info_type: 'reception_hours',
        info_data: { open: '9:00', close: '17:00' },
      }),
    ];
    const result = parseAggregatedInfo(items);
    expect(result).toEqual({
      parking: { available: false },
      receptionHours: { open: '9:00', close: '17:00' },
    });
  });
});

describe('useSpotInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when spotId is empty', async () => {
    const { result } = renderHook(() => useSpotInfo(''));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotInfo).toBeNull();
    expect(mockFetchSpotAggregatedInfo).not.toHaveBeenCalled();
  });

  it('returns parsed parking info', async () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'parking',
        info_data: { available: true, capacity: 10 },
      }),
    ];
    mockFetchSpotAggregatedInfo.mockResolvedValue(items);

    const { result } = renderHook(() => useSpotInfo('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotInfo).toEqual({
      parking: { available: true, capacity: 10 },
    });
    expect(mockFetchSpotAggregatedInfo).toHaveBeenCalledWith('spot-1');
  });

  it('returns parsed reception hours', async () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'reception_hours',
        info_data: { open: '9:00', close: '16:00' },
      }),
    ];
    mockFetchSpotAggregatedInfo.mockResolvedValue(items);

    const { result } = renderHook(() => useSpotInfo('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotInfo).toEqual({
      receptionHours: { open: '9:00', close: '16:00' },
    });
  });

  it('returns null when no data', async () => {
    mockFetchSpotAggregatedInfo.mockResolvedValue([]);

    const { result } = renderHook(() => useSpotInfo('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotInfo).toBeNull();
  });

  it('returns null on error', async () => {
    mockFetchSpotAggregatedInfo.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSpotInfo('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotInfo).toBeNull();
  });

  it('sets isLoading to true while fetching', async () => {
    let resolvePromise: (value: SpotAggregatedInfo[]) => void;
    mockFetchSpotAggregatedInfo.mockReturnValue(
      new Promise<SpotAggregatedInfo[]>(resolve => {
        resolvePromise = resolve;
      })
    );

    const { result } = renderHook(() => useSpotInfo('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    resolvePromise!([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
