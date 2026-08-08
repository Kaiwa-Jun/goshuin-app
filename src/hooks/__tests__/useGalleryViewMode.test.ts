import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useGalleryViewMode,
  GALLERY_VIEW_MODE_KEY,
  DEFAULT_GALLERY_VIEW_MODE,
} from '@hooks/useGalleryViewMode';

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

describe('useGalleryViewMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
  });

  it('既定値は flip である', () => {
    expect(DEFAULT_GALLERY_VIEW_MODE).toBe('flip');
  });

  it('初期値を同期的に flip で返す（描画をブロックしない）', async () => {
    const { result } = renderHook(() => useGalleryViewMode());
    expect(result.current.viewMode).toBe('flip');
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
  });

  it('保存値が grid のとき grid に復元する', async () => {
    mockGetItem.mockResolvedValueOnce('grid');
    const { result } = renderHook(() => useGalleryViewMode());
    await waitFor(() => expect(result.current.viewMode).toBe('grid'));
  });

  it('保存値が flip のとき flip のままである', async () => {
    mockGetItem.mockResolvedValueOnce('flip');
    const { result } = renderHook(() => useGalleryViewMode());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.viewMode).toBe('flip');
  });

  it('保存値が不正なとき既定値のままである', async () => {
    mockGetItem.mockResolvedValueOnce('banana');
    const { result } = renderHook(() => useGalleryViewMode());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.viewMode).toBe('flip');
  });

  it('読み出しが完了すると isHydrated が true になる', async () => {
    const { result } = renderHook(() => useGalleryViewMode());
    expect(result.current.isHydrated).toBe(false);
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
  });

  it('setViewMode で AsyncStorage に保存する', async () => {
    const { result } = renderHook(() => useGalleryViewMode());
    act(() => result.current.setViewMode('grid'));
    await waitFor(() => expect(mockSetItem).toHaveBeenCalledWith(GALLERY_VIEW_MODE_KEY, 'grid'));
  });

  it('保存の完了を待たずに viewMode が切り替わる', async () => {
    const { result } = renderHook(() => useGalleryViewMode());
    act(() => result.current.setViewMode('grid'));
    expect(result.current.viewMode).toBe('grid');
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
  });

  it('保存キーが gallery_view_mode である', () => {
    expect(GALLERY_VIEW_MODE_KEY).toBe('gallery_view_mode');
  });

  it('復元が setViewMode の結果を上書きしない', async () => {
    let resolveGet: ((value: string | null) => void) | undefined;
    mockGetItem.mockReturnValueOnce(
      new Promise<string | null>(resolve => {
        resolveGet = resolve;
      })
    );

    const { result } = renderHook(() => useGalleryViewMode());
    act(() => result.current.setViewMode('grid'));

    // 読み出しが遅れて返ってきても、ユーザーの選択を巻き戻さない
    await act(async () => {
      resolveGet?.('flip');
    });

    expect(result.current.viewMode).toBe('grid');
  });
});
