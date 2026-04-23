import { fetchCollectionStats, fetchRegionStats } from '@services/collection';

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('fetchCollectionStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ユニークスポット数と総御朱印枚数を返す', async () => {
    const mockData = [
      { spot_id: 'spot-1' },
      { spot_id: 'spot-2' },
      { spot_id: 'spot-1' }, // 重複
    ];
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ data: mockData, error: null });

    const result = await fetchCollectionStats('user-1');

    expect(mockFrom).toHaveBeenCalledWith('stamps');
    expect(mockSelect).toHaveBeenCalledWith('spot_id');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result).toEqual({ spotCount: 2, stampCount: 3 });
  });

  it('同じspot_idが複数ある場合はユニーク数のみカウントする', async () => {
    const mockData = [{ spot_id: 'spot-1' }, { spot_id: 'spot-1' }, { spot_id: 'spot-1' }];
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ data: mockData, error: null });

    const result = await fetchCollectionStats('user-1');

    expect(result).toEqual({ spotCount: 1, stampCount: 3 });
  });

  it('エラー時は { spotCount: 0, stampCount: 0 } を返す', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ data: null, error: { message: 'fetch error' } });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchCollectionStats('user-1');

    expect(result).toEqual({ spotCount: 0, stampCount: 0 });
    expect(warnSpy).toHaveBeenCalledWith('fetchCollectionStats error:', 'fetch error');
    warnSpy.mockRestore();
  });

  it('データなしの場合は { spotCount: 0, stampCount: 0 } を返す', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ data: [], error: null });

    const result = await fetchCollectionStats('user-1');

    expect(result).toEqual({ spotCount: 0, stampCount: 0 });
  });
});

describe('fetchRegionStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // allSpots 取得用の共通ヘルパー（空配列を返す）
  function mockAllSpotsEmpty() {
    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({ data: [], error: null }),
        }),
      }),
    };
  }

  it('都道府県別のユニーク訪問スポット数を返す', async () => {
    const mockData = [
      { spot_id: 'spot-1', spots: { prefecture: '宮城県' } },
      { spot_id: 'spot-2', spots: { prefecture: '東京都' } },
      { spot_id: 'spot-3', spots: { prefecture: '宮城県' } },
    ];
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockData, error: null }),
        }),
      })
      .mockReturnValueOnce(mockAllSpotsEmpty());

    const result = await fetchRegionStats('user-1');

    expect(mockFrom).toHaveBeenCalledWith('stamps');
    expect(result).toEqual(
      expect.arrayContaining([
        { prefecture: '宮城県', visitedCount: 2, totalCount: 0 },
        { prefecture: '東京都', visitedCount: 1, totalCount: 0 },
      ])
    );
    expect(result).toHaveLength(2);
  });

  it('同じ都道府県の同じスポットを複数回訪問した場合はスポット単位でカウントする', async () => {
    const mockData = [
      { spot_id: 'spot-1', spots: { prefecture: '宮城県' } },
      { spot_id: 'spot-1', spots: { prefecture: '宮城県' } }, // 同じスポットの再訪
      { spot_id: 'spot-2', spots: { prefecture: '宮城県' } },
    ];
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockData, error: null }),
        }),
      })
      .mockReturnValueOnce(mockAllSpotsEmpty());

    const result = await fetchRegionStats('user-1');

    expect(result).toEqual([{ prefecture: '宮城県', visitedCount: 2, totalCount: 0 }]);
  });

  it('prefecture が null のデータは除外する', async () => {
    const mockData = [
      { spot_id: 'spot-1', spots: { prefecture: '宮城県' } },
      { spot_id: 'spot-2', spots: { prefecture: null } },
    ];
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockData, error: null }),
        }),
      })
      .mockReturnValueOnce(mockAllSpotsEmpty());

    const result = await fetchRegionStats('user-1');

    expect(result).toEqual([{ prefecture: '宮城県', visitedCount: 1, totalCount: 0 }]);
  });

  it('エラー時は空配列を返す', async () => {
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ data: null, error: { message: 'region error' } }),
      }),
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchRegionStats('user-1');

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('fetchRegionStats error:', 'region error');
    warnSpy.mockRestore();
  });

  it('totalCount が正しく返される', async () => {
    const mockStampsData = [
      { spot_id: 'spot-1', spots: { prefecture: '宮城県' } },
      { spot_id: 'spot-2', spots: { prefecture: '東京都' } },
      { spot_id: 'spot-3', spots: { prefecture: '宮城県' } },
    ];
    const mockAllSpotsData = [
      { prefecture: '宮城県' },
      { prefecture: '宮城県' },
      { prefecture: '宮城県' },
      { prefecture: '宮城県' },
      { prefecture: '宮城県' },
      { prefecture: '東京都' },
      { prefecture: '東京都' },
      { prefecture: '東京都' },
    ];

    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockStampsData, error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({ data: mockAllSpotsData, error: null }),
          }),
        }),
      });

    const result = await fetchRegionStats('user-1');

    expect(result).toHaveLength(2);
    const miyagi = result.find(r => r.prefecture === '宮城県');
    expect(miyagi).toEqual({ prefecture: '宮城県', visitedCount: 2, totalCount: 5 });
    const tokyo = result.find(r => r.prefecture === '東京都');
    expect(tokyo).toEqual({ prefecture: '東京都', visitedCount: 1, totalCount: 3 });
  });

  it('訪問なしの県も totalCount 付きで返される', async () => {
    const mockStampsData = [{ spot_id: 'spot-1', spots: { prefecture: '宮城県' } }];
    const mockAllSpotsData = [
      { prefecture: '宮城県' },
      { prefecture: '宮城県' },
      { prefecture: '東京都' }, // 未訪問の県
      { prefecture: '東京都' },
      { prefecture: '東京都' },
    ];

    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: mockStampsData, error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({ data: mockAllSpotsData, error: null }),
          }),
        }),
      });

    const result = await fetchRegionStats('user-1');

    expect(result).toHaveLength(2);
    const miyagi = result.find(r => r.prefecture === '宮城県');
    expect(miyagi).toEqual({ prefecture: '宮城県', visitedCount: 1, totalCount: 2 });
    const tokyo = result.find(r => r.prefecture === '東京都');
    expect(tokyo).toEqual({ prefecture: '東京都', visitedCount: 0, totalCount: 3 });
  });
});
