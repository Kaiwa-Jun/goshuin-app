import { fetchWishlistSpotIds, addToWishlist, removeFromWishlist } from '@services/wishlist';

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
