import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useStampDetail } from '@hooks/useStampDetail';
import type { StampWithSpot } from '@/types/supabase';

const mockFetchStampById = jest.fn();
const mockUpdateStamp = jest.fn();
const mockDeleteStamp = jest.fn();

jest.mock('@services/stamps', () => ({
  fetchStampById: (...args: unknown[]) => mockFetchStampById(...args),
  updateStamp: (...args: unknown[]) => mockUpdateStamp(...args),
  deleteStamp: (...args: unknown[]) => mockDeleteStamp(...args),
}));

const fakeStamp: StampWithSpot = {
  id: 'stamp-1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-06-01',
  image_path: 'img/1.jpg',
  memo: 'テストメモ',
  is_public: false,
  extracted_info: null,
  created_at: '2024-06-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
  spots: { name: '伊勢神宮', type: 'shrine' },
};

describe('useStampDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初期ロード時に isLoading が true になり、データ取得後に false になる', async () => {
    mockFetchStampById.mockResolvedValue(fakeStamp);

    const { result } = renderHook(() => useStampDetail('stamp-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamp).toEqual(fakeStamp);
    expect(result.current.error).toBeNull();
    expect(mockFetchStampById).toHaveBeenCalledWith('stamp-1');
  });

  it('フェッチ失敗時に error が設定される', async () => {
    mockFetchStampById.mockRejectedValue(new Error('fetch error'));

    const { result } = renderHook(() => useStampDetail('stamp-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamp).toBeNull();
    expect(result.current.error).toBe('fetch error');
  });

  it('handleUpdate 成功時に stamp state が更新され、更新後のデータが返る', async () => {
    mockFetchStampById.mockResolvedValue(fakeStamp);
    const updatedStamp: StampWithSpot = { ...fakeStamp, memo: '更新メモ' };
    mockUpdateStamp.mockResolvedValue(updatedStamp);

    const { result } = renderHook(() => useStampDetail('stamp-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let returnedStamp: StampWithSpot | null;
    await act(async () => {
      returnedStamp = await result.current.handleUpdate({ memo: '更新メモ' });
    });

    expect(returnedStamp!).toEqual(updatedStamp);
    expect(result.current.stamp).toEqual(updatedStamp);
    expect(result.current.error).toBeNull();
    expect(mockUpdateStamp).toHaveBeenCalledWith('stamp-1', { memo: '更新メモ' });
  });

  it('handleUpdate 失敗時に null が返り error が設定される', async () => {
    mockFetchStampById.mockResolvedValue(fakeStamp);
    mockUpdateStamp.mockRejectedValue(new Error('update failed'));

    const { result } = renderHook(() => useStampDetail('stamp-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let returnedStamp: StampWithSpot | null;
    await act(async () => {
      returnedStamp = await result.current.handleUpdate({ memo: '更新メモ' });
    });

    expect(returnedStamp!).toBeNull();
    expect(result.current.error).toBe('update failed');
  });

  it('handleDelete 成功時に true が返る', async () => {
    mockFetchStampById.mockResolvedValue(fakeStamp);
    mockDeleteStamp.mockResolvedValue(undefined);

    const { result } = renderHook(() => useStampDetail('stamp-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.handleDelete();
    });

    expect(success!).toBe(true);
    expect(mockDeleteStamp).toHaveBeenCalledWith('stamp-1', 'img/1.jpg');
  });

  it('handleDelete 失敗時に false が返り error が設定される', async () => {
    mockFetchStampById.mockResolvedValue(fakeStamp);
    mockDeleteStamp.mockRejectedValue(new Error('delete failed'));

    const { result } = renderHook(() => useStampDetail('stamp-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.handleDelete();
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBe('delete failed');
  });

  it('refresh 呼び出しでデータが再取得される', async () => {
    mockFetchStampById.mockResolvedValue(fakeStamp);

    const { result } = renderHook(() => useStampDetail('stamp-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchStampById).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(mockFetchStampById).toHaveBeenCalledTimes(2);
    });
  });
});
