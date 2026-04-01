import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StampDetailScreen } from '@screens/StampDetailScreen';
import { fetchStampById, getStampImageUrl, updateStamp, deleteStamp } from '@services/stamps';
import type { StampWithSpot } from '@/types/supabase';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@services/stamps', () => ({
  fetchStampById: jest.fn(),
  getStampImageUrl: jest.fn((path: string) => `https://example.com/${path}`),
  updateStamp: jest.fn(),
  deleteStamp: jest.fn(),
}));

const mockFetchStampById = fetchStampById as jest.MockedFunction<typeof fetchStampById>;
const mockGetStampImageUrl = getStampImageUrl as jest.MockedFunction<typeof getStampImageUrl>;
const mockUpdateStamp = updateStamp as jest.MockedFunction<typeof updateStamp>;
const mockDeleteStamp = deleteStamp as jest.MockedFunction<typeof deleteStamp>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
} as any;

const mockRoute = {
  key: 'test',
  name: 'StampDetail' as const,
  params: { stampId: 'stamp-1' },
};

const mockStamp: StampWithSpot = {
  id: 'stamp-1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-01-15',
  image_path: 'user-1/stamp-1.jpg',
  memo: '初めての御朱印。天気が良くて気持ちの良い参拝でした。',
  is_public: false,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  spots: { name: '明治神宮', type: 'shrine' },
};

describe('StampDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStampImageUrl.mockImplementation((path: string) => `https://example.com/${path}`);
  });

  it('ローディング中に ActivityIndicator を表示する', () => {
    // fetchStampById が解決しない Promise を返す
    mockFetchStampById.mockReturnValue(new Promise(() => {}));

    const { getByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('データが取得できた場合にスポット名を表示する', async () => {
    mockFetchStampById.mockResolvedValue(mockStamp);

    const { getByText } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByText('明治神宮')).toBeTruthy();
    });
  });

  it('データが取得できた場合に訪問日を表示する（YYYY/MM/DD 形式）', async () => {
    mockFetchStampById.mockResolvedValue(mockStamp);

    const { getByText } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByText('2024/01/15')).toBeTruthy();
    });
  });

  it('データが取得できた場合にメモを表示する', async () => {
    mockFetchStampById.mockResolvedValue(mockStamp);

    const { getByText } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByText('初めての御朱印。天気が良くて気持ちの良い参拝でした。')).toBeTruthy();
    });
  });

  it('データが取得できた場合に画像を表示する', async () => {
    mockFetchStampById.mockResolvedValue(mockStamp);

    const { getByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByTestId('stamp-image')).toBeTruthy();
    });
  });

  it('神社の場合に shrine バッジを表示する', async () => {
    mockFetchStampById.mockResolvedValue(mockStamp);

    const { getByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByTestId('badge-shrine')).toBeTruthy();
    });
  });

  it('寺院の場合に temple バッジを表示する', async () => {
    const templeStamp: StampWithSpot = {
      ...mockStamp,
      spots: { name: '浅草寺', type: 'temple' },
    };
    mockFetchStampById.mockResolvedValue(templeStamp);

    const { getByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByTestId('badge-temple')).toBeTruthy();
    });
  });

  it('データが取得できない場合にエラーメッセージを表示する', async () => {
    mockFetchStampById.mockRejectedValue(new Error('Not found'));

    const { getByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByTestId('error-state')).toBeTruthy();
    });
  });

  it('戻るボタンで goBack を呼ぶ', () => {
    mockFetchStampById.mockReturnValue(new Promise(() => {}));

    const { getByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    fireEvent.press(getByTestId('back-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('編集ボタンタップで EditStampModal が表示される', async () => {
    mockFetchStampById.mockResolvedValue(mockStamp);

    const { getByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByTestId('edit-button')).toBeTruthy();
    });
    fireEvent.press(getByTestId('edit-button'));
    await waitFor(() => {
      expect(getByTestId('modal-content')).toBeTruthy();
    });
  });

  it('削除ボタンタップで DeleteConfirmModal が表示される', async () => {
    mockFetchStampById.mockResolvedValue(mockStamp);

    const { getByTestId, getAllByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByTestId('delete-button')).toBeTruthy();
    });
    fireEvent.press(getByTestId('delete-button'));
    await waitFor(() => {
      const contents = getAllByTestId('modal-content');
      expect(contents.length).toBeGreaterThan(0);
    });
  });

  it('EditStampModal で保存すると updateStamp が呼ばれ、モーダルが閉じる', async () => {
    mockFetchStampById.mockResolvedValue(mockStamp);
    const updatedStamp = { ...mockStamp, visited_at: '2024-03-01' };
    mockUpdateStamp.mockResolvedValue(updatedStamp);

    const { getByTestId, getByText } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByTestId('edit-button')).toBeTruthy();
    });
    fireEvent.press(getByTestId('edit-button'));
    await waitFor(() => {
      expect(getByText('保存')).toBeTruthy();
    });
    fireEvent.press(getByText('保存'));
    await waitFor(() => {
      expect(mockUpdateStamp).toHaveBeenCalled();
    });
  });

  it('DeleteConfirmModal で削除すると deleteStamp が呼ばれ、goBack する', async () => {
    mockFetchStampById.mockResolvedValue(mockStamp);
    mockDeleteStamp.mockResolvedValue(undefined);

    const { getByTestId, getByText } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByTestId('delete-button')).toBeTruthy();
    });
    fireEvent.press(getByTestId('delete-button'));
    await waitFor(() => {
      expect(getByText('削除する')).toBeTruthy();
    });
    fireEvent.press(getByText('削除する'));
    await waitFor(() => {
      expect(mockDeleteStamp).toHaveBeenCalledWith('stamp-1', 'user-1/stamp-1.jpg');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });
});
