import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useStampDetail } from '@hooks/useStampDetail';
import type { StampWithSpot } from '@/types/supabase';

const mockFetchStampById = jest.fn();
const mockUpdateStamp = jest.fn();
const mockDeleteStamp = jest.fn();
const mockUploadStampImage = jest.fn();
const mockDeleteStampImage = jest.fn();

jest.mock('@services/stamps', () => ({
  fetchStampById: (...args: unknown[]) => mockFetchStampById(...args),
  updateStamp: (...args: unknown[]) => mockUpdateStamp(...args),
  deleteStamp: (...args: unknown[]) => mockDeleteStamp(...args),
  uploadStampImage: (...args: unknown[]) => mockUploadStampImage(...args),
  deleteStampImage: (...args: unknown[]) => mockDeleteStampImage(...args),
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

  /*
   * 写真の差し替え。uploadStampImage / deleteStampImage が Supabase と R2 の
   * 両方を扱う（Issue #227 S3）ので、ここは「新しい写真を上げ → 行を更新 → 古い写真を消す」
   * の順と引数を固定する（AC-10）
   */
  it('写真を差し替えると、新しい写真を上げて行を更新し、古い写真を消す', async () => {
    mockFetchStampById.mockResolvedValue(fakeStamp);
    mockUploadStampImage.mockResolvedValue('user-1/2-new.jpg');
    mockUpdateStamp.mockResolvedValue({ ...fakeStamp, image_path: 'user-1/2-new.jpg' });
    mockDeleteStampImage.mockResolvedValue(undefined);

    const { result } = renderHook(() => useStampDetail('stamp-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleUpdate({ newImageUri: 'file:///new.jpg' });
    });

    expect(mockUploadStampImage).toHaveBeenCalledWith('user-1', 'file:///new.jpg');
    expect(mockUpdateStamp).toHaveBeenCalledWith('stamp-1', { image_path: 'user-1/2-new.jpg' });
    expect(mockDeleteStampImage).toHaveBeenCalledTimes(1);
    expect(mockDeleteStampImage).toHaveBeenCalledWith('img/1.jpg');
  });

  it('写真の差し替えで行の更新に失敗したら、上げた新しい写真を消して古い写真は残す', async () => {
    mockFetchStampById.mockResolvedValue(fakeStamp);
    mockUploadStampImage.mockResolvedValue('user-1/2-new.jpg');
    mockUpdateStamp.mockRejectedValue(new Error('db error'));
    mockDeleteStampImage.mockResolvedValue(undefined);

    const { result } = renderHook(() => useStampDetail('stamp-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleUpdate({ newImageUri: 'file:///new.jpg' });
    });

    expect(mockDeleteStampImage).toHaveBeenCalledTimes(1);
    expect(mockDeleteStampImage).toHaveBeenCalledWith('user-1/2-new.jpg');
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
