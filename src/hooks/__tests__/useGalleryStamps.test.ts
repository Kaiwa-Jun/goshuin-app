import { renderHook, waitFor } from '@testing-library/react-native';
import { useGalleryStamps } from '@hooks/useGalleryStamps';
import type { StampWithSpot } from '@/types/supabase';

const mockFetchAllStamps = jest.fn();

jest.mock('@services/stamps', () => ({
  fetchAllStamps: (...args: unknown[]) => mockFetchAllStamps(...args),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
}));

let mockUser: { id: string } | null = null;

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

const makeStampWithSpot = (overrides: Partial<StampWithSpot> = {}): StampWithSpot => ({
  id: 'stamp-1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-06-01',
  image_path: 'img/1.jpg',
  memo: null,
  is_public: false,
  extracted_info: null,
  created_at: '2024-06-01',
  updated_at: '2024-06-01',
  spots: { name: '伊勢神宮', type: 'shrine' },
  ...overrides,
});

describe('useGalleryStamps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  it('未認証時: 空配列を返し isLoading=false になる', async () => {
    mockUser = null;

    const { result } = renderHook(() => useGalleryStamps('date'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamps).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(mockFetchAllStamps).not.toHaveBeenCalled();
  });

  it('認証済み: fetchAllStamps が userId で呼ばれる', async () => {
    mockUser = { id: 'user-1' };
    mockFetchAllStamps.mockResolvedValue([makeStampWithSpot()]);

    const { result } = renderHook(() => useGalleryStamps('date'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchAllStamps).toHaveBeenCalledWith('user-1');
  });

  it('日付順: API のソート順のまま返る', async () => {
    mockUser = { id: 'user-1' };
    const stamps = [
      makeStampWithSpot({ id: 'stamp-1', visited_at: '2024-06-01' }),
      makeStampWithSpot({ id: 'stamp-2', visited_at: '2024-01-15' }),
    ];
    mockFetchAllStamps.mockResolvedValue(stamps);

    const { result } = renderHook(() => useGalleryStamps('date'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamps[0].id).toBe('stamp-1');
    expect(result.current.stamps[1].id).toBe('stamp-2');
  });

  it('スポット順: localeCompare("ja") でソートされる', async () => {
    mockUser = { id: 'user-1' };
    const stamps = [
      makeStampWithSpot({ id: 'stamp-1', spots: { name: '浅草寺', type: 'temple' } }),
      makeStampWithSpot({ id: 'stamp-2', spots: { name: '伊勢神宮', type: 'shrine' } }),
      makeStampWithSpot({ id: 'stamp-3', spots: { name: '金閣寺', type: 'temple' } }),
    ];
    mockFetchAllStamps.mockResolvedValue(stamps);

    const { result } = renderHook(() => useGalleryStamps('spot'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const names = result.current.stamps.map(s => s.spots.name);
    expect(names).toEqual(['伊勢神宮', '金閣寺', '浅草寺']);
  });

  it('20件超: 20件に制限、totalCount は全件数', async () => {
    mockUser = { id: 'user-1' };
    const stamps = Array.from({ length: 25 }, (_, i) => makeStampWithSpot({ id: `stamp-${i}` }));
    mockFetchAllStamps.mockResolvedValue(stamps);

    const { result } = renderHook(() => useGalleryStamps('date'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamps).toHaveLength(20);
    expect(result.current.totalCount).toBe(25);
  });

  it('フェッチエラー: error がセットされる', async () => {
    mockUser = { id: 'user-1' };
    mockFetchAllStamps.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGalleryStamps('date'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamps).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });
});
