import { fetchPilgrimageProgress, fetchPilgrimageSpots } from '@services/pilgrimages';

const mockFrom = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('fetchPilgrimageProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('巡礼進捗を正しく返す（visitedCount の計算）', async () => {
    const mockPilgrimages = [
      {
        id: 'pilgrimage-1',
        name: '東北三十三観音',
        description: '東北地方の観音霊場',
        category: '観音',
        total_spots: 33,
        pilgrimage_spots: [{ spot_id: 'spot-1' }, { spot_id: 'spot-2' }, { spot_id: 'spot-3' }],
      },
      {
        id: 'pilgrimage-2',
        name: '仙台七福神',
        description: null,
        category: '七福神',
        total_spots: 7,
        pilgrimage_spots: [{ spot_id: 'spot-4' }, { spot_id: 'spot-5' }],
      },
    ];
    const mockStamps = [{ spot_id: 'spot-1' }, { spot_id: 'spot-2' }, { spot_id: 'spot-4' }];

    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockPilgrimages, error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockStamps, error: null }),
        }),
      });

    const result = await fetchPilgrimageProgress('user-1');

    expect(result).toHaveLength(2);
    const pilgrimage1 = result.find(p => p.id === 'pilgrimage-1');
    expect(pilgrimage1).toEqual({
      id: 'pilgrimage-1',
      name: '東北三十三観音',
      description: '東北地方の観音霊場',
      category: '観音',
      totalSpots: 33,
      visitedCount: 2,
    });
    const pilgrimage2 = result.find(p => p.id === 'pilgrimage-2');
    expect(pilgrimage2).toEqual({
      id: 'pilgrimage-2',
      name: '仙台七福神',
      description: null,
      category: '七福神',
      totalSpots: 7,
      visitedCount: 1,
    });
  });

  it('進捗率降順でソートされる', async () => {
    const mockPilgrimages = [
      {
        id: 'pilgrimage-1',
        name: '巡礼A',
        description: null,
        category: null,
        total_spots: 10,
        pilgrimage_spots: [{ spot_id: 'spot-1' }, { spot_id: 'spot-2' }],
      },
      {
        id: 'pilgrimage-2',
        name: '巡礼B',
        description: null,
        category: null,
        total_spots: 10,
        pilgrimage_spots: [{ spot_id: 'spot-3' }, { spot_id: 'spot-4' }, { spot_id: 'spot-5' }],
      },
      {
        id: 'pilgrimage-3',
        name: '巡礼C',
        description: null,
        category: null,
        total_spots: 5,
        pilgrimage_spots: [{ spot_id: 'spot-6' }, { spot_id: 'spot-7' }, { spot_id: 'spot-8' }],
      },
    ];
    // 巡礼A: 1/10=10%, 巡礼B: 2/10=20%, 巡礼C: 3/5=60%
    const mockStamps = [
      { spot_id: 'spot-1' }, // 巡礼A: 1件
      { spot_id: 'spot-3' }, // 巡礼B: 1件
      { spot_id: 'spot-4' }, // 巡礼B: 2件
      { spot_id: 'spot-6' }, // 巡礼C: 1件
      { spot_id: 'spot-7' }, // 巡礼C: 2件
      { spot_id: 'spot-8' }, // 巡礼C: 3件
    ];

    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockPilgrimages, error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockStamps, error: null }),
        }),
      });

    const result = await fetchPilgrimageProgress('user-1');

    expect(result[0].id).toBe('pilgrimage-3'); // 60%
    expect(result[1].id).toBe('pilgrimage-2'); // 20%
    expect(result[2].id).toBe('pilgrimage-1'); // 10%
  });

  it('訪問なしの巡礼は visitedCount: 0 を返す', async () => {
    const mockPilgrimages = [
      {
        id: 'pilgrimage-1',
        name: '未訪問巡礼',
        description: null,
        category: null,
        total_spots: 10,
        pilgrimage_spots: [{ spot_id: 'spot-1' }, { spot_id: 'spot-2' }],
      },
    ];
    const mockStamps: { spot_id: string }[] = [];

    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockPilgrimages, error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockStamps, error: null }),
        }),
      });

    const result = await fetchPilgrimageProgress('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].visitedCount).toBe(0);
  });

  it('エラー時は空配列を返す', async () => {
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ data: null, error: { message: 'fetch error' } }),
      }),
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchPilgrimageProgress('user-1');

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('fetchPilgrimageProgress error:', 'fetch error');
    warnSpy.mockRestore();
  });
});

describe('fetchPilgrimageSpots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('巡礼IDに紐づくスポット一覧を正しく返す', async () => {
    const mockSpotRow = {
      id: 'ps-1',
      sort_order: 1,
      label: '一番札所',
      spots: {
        id: 'spot-1',
        name: '陸奥国分寺',
        lat: 38.25,
        lng: 140.87,
        type: 'temple',
        address: '宮城県仙台市若林区木ノ下3',
        prefecture: '宮城県',
        status: 'active',
        rank: 3,
        created_by_user_id: null,
        merged_into_spot_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    };

    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({ data: [mockSpotRow], error: null }),
        }),
      }),
    });

    const result = await fetchPilgrimageSpots('pilgrimage-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'ps-1',
      sortOrder: 1,
      label: '一番札所',
      spot: mockSpotRow.spots,
    });
  });

  it('sort_order 昇順でソートされている', async () => {
    const makeSpot = (spotId: string) => ({
      id: spotId,
      name: `スポット${spotId}`,
      lat: 38.0,
      lng: 140.0,
      type: 'shrine' as const,
      address: null,
      prefecture: null,
      status: 'active' as const,
      rank: 3,
      created_by_user_id: null,
      merged_into_spot_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    const mockRows = [
      { id: 'ps-3', sort_order: 3, label: '三番', spots: makeSpot('spot-3') },
      { id: 'ps-1', sort_order: 1, label: '一番', spots: makeSpot('spot-1') },
      { id: 'ps-2', sort_order: 2, label: '二番', spots: makeSpot('spot-2') },
    ];

    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({ data: mockRows, error: null }),
        }),
      }),
    });

    const result = await fetchPilgrimageSpots('pilgrimage-1');

    expect(result[0].sortOrder).toBe(3);
    expect(result[1].sortOrder).toBe(1);
    expect(result[2].sortOrder).toBe(2);
  });

  it('エラー時は空配列を返す', async () => {
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({ data: null, error: { message: 'db error' } }),
        }),
      }),
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchPilgrimageSpots('pilgrimage-1');

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('fetchPilgrimageSpots error:', 'db error');
    warnSpy.mockRestore();
  });
});
