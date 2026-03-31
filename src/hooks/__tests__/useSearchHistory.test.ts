import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSearchHistory } from '@hooks/useSearchHistory';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSearchHistory', () => {
  it('初期状態で history が空配列、isLoading が false になる', async () => {
    const { result } = renderHook(() => useSearchHistory());
    await act(async () => {});
    expect(result.current.history).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('addHistory でスポットが履歴に追加される', async () => {
    const { result } = renderHook(() => useSearchHistory());
    await act(async () => {});

    await act(async () => {
      await result.current.addHistory({ spotId: 'spot-1', spotName: '青葉神社' });
    });

    expect(result.current.history).toEqual([{ spotId: 'spot-1', spotName: '青葉神社' }]);
    expect(mockSetItem).toHaveBeenCalledWith(
      'search_history',
      JSON.stringify([{ spotId: 'spot-1', spotName: '青葉神社' }])
    );
  });

  it('重複するスポットは先頭に移動される', async () => {
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify([
        { spotId: 'spot-1', spotName: '青葉神社' },
        { spotId: 'spot-2', spotName: '仙台東照宮' },
      ])
    );
    const { result } = renderHook(() => useSearchHistory());
    await act(async () => {});

    await act(async () => {
      await result.current.addHistory({ spotId: 'spot-2', spotName: '仙台東照宮' });
    });

    expect(result.current.history[0]).toEqual({ spotId: 'spot-2', spotName: '仙台東照宮' });
    expect(result.current.history[1]).toEqual({ spotId: 'spot-1', spotName: '青葉神社' });
    expect(result.current.history).toHaveLength(2);
  });

  it('最大10件を超えると古い履歴が削除される', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      spotId: `spot-${i}`,
      spotName: `Spot ${i}`,
    }));
    mockGetItem.mockResolvedValueOnce(JSON.stringify(items));
    const { result } = renderHook(() => useSearchHistory());
    await act(async () => {});

    await act(async () => {
      await result.current.addHistory({ spotId: 'spot-new', spotName: 'New Spot' });
    });

    expect(result.current.history).toHaveLength(10);
    expect(result.current.history[0]).toEqual({ spotId: 'spot-new', spotName: 'New Spot' });
    expect(result.current.history.find(h => h.spotId === 'spot-9')).toBeUndefined();
  });

  it('空の spotId は追加されない', async () => {
    const { result } = renderHook(() => useSearchHistory());
    await act(async () => {});

    await act(async () => {
      await result.current.addHistory({ spotId: '', spotName: '' });
    });

    expect(result.current.history).toEqual([]);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('clearHistory で全履歴が削除される', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify([{ spotId: 'spot-1', spotName: '青葉神社' }]));
    const { result } = renderHook(() => useSearchHistory());
    await act(async () => {});

    expect(result.current.history).toHaveLength(1);

    await act(async () => {
      await result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
    expect(mockRemoveItem).toHaveBeenCalledWith('search_history');
  });
});
