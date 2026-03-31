import {
  fetchWishlistSpotIds,
  addToWishlist,
  removeFromWishlist,
  fetchWishlistSpots,
} from '@services/wishlist';

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockDelete = jest.fn();
const mockFrom = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('fetchWishlistSpotIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ユーザーのwishlist spot IDをSet<string>で返す', async () => {
    const mockData = [{ spot_id: 'spot-1' }, { spot_id: 'spot-2' }];
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ data: mockData, error: null });

    const result = await fetchWishlistSpotIds('user-1');

    expect(mockFrom).toHaveBeenCalledWith('wishlists');
    expect(mockSelect).toHaveBeenCalledWith('spot_id');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result).toEqual(new Set(['spot-1', 'spot-2']));
  });

  it('エラー時は空のSetを返す', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ data: null, error: { message: 'error' } });

    const result = await fetchWishlistSpotIds('user-1');

    expect(result).toEqual(new Set());
  });

  it('データが空の場合は空のSetを返す', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ data: [], error: null });

    const result = await fetchWishlistSpotIds('user-1');

    expect(result).toEqual(new Set());
  });
});

describe('addToWishlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wishlistにupsertで追加する', async () => {
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockReturnValue({ error: null });

    await addToWishlist('user-1', 'spot-1');

    expect(mockFrom).toHaveBeenCalledWith('wishlists');
    expect(mockUpsert).toHaveBeenCalledWith(
      { user_id: 'user-1', spot_id: 'spot-1' },
      { onConflict: 'user_id,spot_id' }
    );
  });

  it('エラー時はconsole.warnを呼ぶ', async () => {
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockReturnValue({ error: { message: 'insert error' } });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addToWishlist('user-1', 'spot-1');

    expect(warnSpy).toHaveBeenCalledWith('addToWishlist error:', 'insert error');
    warnSpy.mockRestore();
  });
});

describe('removeFromWishlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wishlistから削除する', async () => {
    const mockEqSpot = jest.fn();
    mockFrom.mockReturnValue({ delete: mockDelete });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEqSpot });
    mockEqSpot.mockReturnValue({ error: null });

    await removeFromWishlist('user-1', 'spot-1');

    expect(mockFrom).toHaveBeenCalledWith('wishlists');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockEqSpot).toHaveBeenCalledWith('spot_id', 'spot-1');
  });

  it('エラー時はconsole.warnを呼ぶ', async () => {
    const mockEqSpot = jest.fn();
    mockFrom.mockReturnValue({ delete: mockDelete });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEqSpot });
    mockEqSpot.mockReturnValue({ error: { message: 'delete error' } });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await removeFromWishlist('user-1', 'spot-1');

    expect(warnSpy).toHaveBeenCalledWith('removeFromWishlist error:', 'delete error');
    warnSpy.mockRestore();
  });
});

describe('fetchWishlistSpots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('スポット情報込みのwishlistを返す', async () => {
    const mockData = [
      {
        id: 'wl-1',
        user_id: 'user-1',
        spot_id: 'spot-1',
        created_at: '2026-01-01T00:00:00Z',
        spots: { name: '伊勢神宮', type: 'shrine', address: '三重県伊勢市宇治館町1' },
      },
      {
        id: 'wl-2',
        user_id: 'user-1',
        spot_id: 'spot-2',
        created_at: '2026-01-02T00:00:00Z',
        spots: { name: '浅草寺', type: 'temple', address: '東京都台東区浅草2-3-1' },
      },
    ];
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ data: mockData, error: null });

    const result = await fetchWishlistSpots('user-1');

    expect(mockFrom).toHaveBeenCalledWith('wishlists');
    expect(mockSelect).toHaveBeenCalledWith('*, spots!inner(name, type, address)');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result).toEqual(mockData);
    expect(result[0].spots.name).toBe('伊勢神宮');
  });

  it('エラー時は空配列を返す', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ data: null, error: { message: 'error' } });

    const result = await fetchWishlistSpots('user-1');

    expect(result).toEqual([]);
  });

  it('住所がnullのスポットも含む', async () => {
    const mockData = [
      {
        id: 'wl-1',
        user_id: 'user-1',
        spot_id: 'spot-1',
        created_at: '2026-01-01T00:00:00Z',
        spots: { name: '不明神社', type: 'shrine', address: null },
      },
    ];
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ data: mockData, error: null });

    const result = await fetchWishlistSpots('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].spots.address).toBeNull();
  });
});
