import { renderHook, waitFor } from '@testing-library/react-native';
import { useSpotInfo, parseAggregatedInfo } from '@hooks/useSpotInfo';
import type { SpotAggregatedInfo } from '@/types/supabase';

const mockFetchSpotAggregatedInfo = jest.fn();
const mockFetchSpotSnsLinks = jest.fn();

jest.mock('@services/spotInfo', () => ({
  fetchSpotAggregatedInfo: (...args: unknown[]) => mockFetchSpotAggregatedInfo(...args),
  fetchSpotSnsLinks: (...args: unknown[]) => mockFetchSpotSnsLinks(...args),
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

describe('parseAggregatedInfo: limited_goshuin', () => {
  const goshuinItem = {
    name: '夏詣限定御朱印',
    period: '7月1日〜8月31日',
    period_start: '2026-07-01',
    period_end: '2026-08-31',
    description: '書き置きのみ',
    source_url: 'https://example.jp/goshuin',
    fetched_at: '2026-08-01T00:00:00Z',
  };

  it('items とトップレベル fetched_at をパースする', () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'limited_goshuin',
        info_data: { items: [goshuinItem], fetched_at: '2026-08-01T00:00:00Z' },
      }),
    ];
    expect(parseAggregatedInfo(items)).toEqual({
      limitedGoshuin: { items: [goshuinItem], fetched_at: '2026-08-01T00:00:00Z' },
    });
  });

  it('items が空配列なら limitedGoshuin を設定せず null を返す', () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'limited_goshuin',
        info_data: { items: [], fetched_at: '2026-08-01T00:00:00Z' },
      }),
    ];
    expect(parseAggregatedInfo(items)).toBeNull();
  });

  it('items が配列でないとき limitedGoshuin を設定しない（クラッシュしない）', () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'limited_goshuin',
        info_data: { items: 'not-an-array' } as unknown as Record<string, unknown>,
      }),
    ];
    expect(parseAggregatedInfo(items)).toBeNull();
  });

  it('fetched_at 欠落時は last_reported_at にフォールバックする', () => {
    const items = [
      makeAggregatedInfo({
        info_type: 'limited_goshuin',
        info_data: { items: [goshuinItem] },
        last_reported_at: '2026-08-02T10:00:00Z',
      }),
    ];
    const result = parseAggregatedInfo(items);
    expect(result?.limitedGoshuin?.fetched_at).toBe('2026-08-02T10:00:00Z');
  });
});

describe('useSpotInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchSpotSnsLinks.mockResolvedValue([]);
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

  it('fetchSpotSnsLinks を spotId で1回呼ぶ', async () => {
    mockFetchSpotAggregatedInfo.mockResolvedValue([]);

    renderHook(() => useSpotInfo('spot-1'));

    await waitFor(() => {
      expect(mockFetchSpotSnsLinks).toHaveBeenCalledTimes(1);
    });
    expect(mockFetchSpotSnsLinks).toHaveBeenCalledWith('spot-1');
  });

  it('集約情報が無くても SNS リンクがあれば spotInfo が非 null になる', async () => {
    const links = [{ id: 'src-1', url: 'https://x.com/example' }];
    mockFetchSpotAggregatedInfo.mockResolvedValue([]);
    mockFetchSpotSnsLinks.mockResolvedValue(links);

    const { result } = renderHook(() => useSpotInfo('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotInfo).toEqual({ snsLinks: links });
  });

  it('SNS リンクが空配列のとき spotInfo に snsLinks キーが存在しない', async () => {
    mockFetchSpotAggregatedInfo.mockResolvedValue([
      makeAggregatedInfo({ info_type: 'parking', info_data: { available: true } }),
    ]);
    mockFetchSpotSnsLinks.mockResolvedValue([]);

    const { result } = renderHook(() => useSpotInfo('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotInfo).not.toBeNull();
    expect(result.current.spotInfo).not.toHaveProperty('snsLinks');
  });

  it('fetchSpotSnsLinks が reject しても例外が漏れず spotInfo は null になる', async () => {
    mockFetchSpotAggregatedInfo.mockResolvedValue([]);
    mockFetchSpotSnsLinks.mockRejectedValue(new Error('sns error'));

    const { result } = renderHook(() => useSpotInfo('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.spotInfo).toBeNull();
  });

  it('spotId が空のとき fetchSpotSnsLinks も呼ばれない', async () => {
    const { result } = renderHook(() => useSpotInfo(''));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchSpotSnsLinks).not.toHaveBeenCalled();
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
