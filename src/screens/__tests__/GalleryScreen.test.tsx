import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Image } from 'react-native';
import { GalleryScreen } from '@screens/GalleryScreen';
import { useGalleryStamps } from '@hooks/useGalleryStamps';
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

let mockAuth: { user: { id: string } | null; isAuthenticated: boolean } = {
  user: { id: 'user-1' },
  isAuthenticated: true,
};

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@hooks/useGalleryStamps', () => ({
  useGalleryStamps: jest.fn(),
}));

jest.mock('@hooks/useStampDetail', () => ({
  useStampDetail: () => ({
    stamp: null,
    isLoading: false,
    error: null,
    isUpdating: false,
    isDeleting: false,
    handleUpdate: jest.fn(),
    handleDelete: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('@services/stamps', () => ({
  getStampImageUrl: jest.fn((path: string) => `https://example.com/${path}`),
}));

jest
  .spyOn(Image, 'getSize')
  .mockImplementation((_uri: string, success: (width: number, height: number) => void) => {
    success(800, 1200);
  });

const mockUseGalleryStamps = useGalleryStamps as jest.MockedFunction<typeof useGalleryStamps>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(),
  canGoBack: jest.fn(),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
};

const mockRoute = { key: 'test', name: 'Gallery' as const, params: undefined };

function renderGalleryScreen() {
  return render(<GalleryScreen navigation={mockNavigation as never} route={mockRoute} />);
}

const makeStamp = (overrides: Partial<StampWithSpot> = {}): StampWithSpot => ({
  id: '1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-01-15',
  image_path: 'user-1/stamp-1.jpg',
  memo: null,
  is_public: false,
  extracted_info: null,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  spots: { name: '明治神宮', type: 'shrine' },
  ...overrides,
});

describe('GalleryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = { user: { id: 'user-1' }, isAuthenticated: true };
  });

  it('ローディング中に ActivityIndicator を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: true,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = renderGalleryScreen();
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('スタンプデータがある場合にスポット名を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', spots: { name: '明治神宮', type: 'shrine' } })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByText } = renderGalleryScreen();
    expect(getByText('明治神宮')).toBeTruthy();
  });

  it('スタンプデータがある場合に画像を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', image_path: 'user-1/stamp-1.jpg' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = renderGalleryScreen();
    expect(getByTestId('stamp-image-1')).toBeTruthy();
  });

  it('スタンプがない場合に空状態メッセージを表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = renderGalleryScreen();
    expect(getByTestId('empty-state')).toBeTruthy();
  });

  it('ソートボタンを押すと sortOrder が切り替わる', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId, getByText } = renderGalleryScreen();
    expect(getByText('日付順 ▼')).toBeTruthy();
    fireEvent.press(getByTestId('sort-button'));
    expect(getByText('スポット順 ▼')).toBeTruthy();
  });

  it('date ソート時に訪問日を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', visited_at: '2024-01-15' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByText } = renderGalleryScreen();
    expect(getByText('2024/01/15')).toBeTruthy();
  });

  it('spot ソート時に訪問日を表示しない', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', visited_at: '2024-01-15' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId, queryByText } = renderGalleryScreen();
    fireEvent.press(getByTestId('sort-button'));
    expect(queryByText('2024/01/15')).toBeNull();
  });

  it('アイテムタップでギャラリーモーダルが開く', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: 'stamp-abc' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = renderGalleryScreen();
    fireEvent.press(getByTestId('gallery-item-stamp-abc'));
    expect(getByTestId('gallery-image')).toBeTruthy();
  });

  describe('未ログイン時のゲスト空状態', () => {
    beforeEach(() => {
      mockAuth = { user: null, isAuthenticated: false };
      mockUseGalleryStamps.mockReturnValue({
        stamps: [],
        totalCount: 0,
        isLoading: false,
        error: null,
        removeStamp: jest.fn(),
        updateStamp: jest.fn(),
      });
    });

    it('ゲスト空状態を表示し、一覧と通常空状態は表示しない', () => {
      const { getByTestId, queryByTestId } = renderGalleryScreen();
      expect(getByTestId('gallery-guest-empty-state')).toBeTruthy();
      expect(queryByTestId('gallery-list')).toBeNull();
      expect(queryByTestId('empty-state')).toBeNull();
    });

    it('スタンプが返っていても一覧を表示しない（認証で分岐する）', () => {
      mockUseGalleryStamps.mockReturnValue({
        stamps: [makeStamp({ id: '1' })],
        totalCount: 1,
        isLoading: false,
        error: null,
        removeStamp: jest.fn(),
        updateStamp: jest.fn(),
      });

      const { queryByTestId } = renderGalleryScreen();
      expect(queryByTestId('gallery-list')).toBeNull();
    });

    it('ソートボタンを表示しない', () => {
      const { queryByTestId } = renderGalleryScreen();
      expect(queryByTestId('sort-button')).toBeNull();
    });

    it('CTA を押すと Login へ navigate する', () => {
      const { getByTestId } = renderGalleryScreen();
      fireEvent.press(getByTestId('gallery-login-cta'));
      expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
    });

    it('タイトル・説明・プレビュー3行を表示する', () => {
      const { getByText } = renderGalleryScreen();
      expect(getByText('あなたの御朱印帳')).toBeTruthy();
      expect(getByText('記録した御朱印がここに一覧で並びます')).toBeTruthy();
      expect(getByText('写真で御朱印を残す')).toBeTruthy();
      expect(getByText('日付順・スポット順で並べ替え')).toBeTruthy();
      expect(getByText('タップで大きく表示')).toBeTruthy();
    });
  });

  it('ログイン済みでスタンプ0件のとき通常空状態を表示しゲスト空状態は表示しない', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId, getByText, queryByTestId } = renderGalleryScreen();
    expect(getByTestId('empty-state')).toBeTruthy();
    expect(getByText('御朱印がまだありません')).toBeTruthy();
    expect(queryByTestId('gallery-guest-empty-state')).toBeNull();
  });

  it('ログイン済みでスタンプありのとき一覧を表示しゲスト空状態は表示しない', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId, queryByTestId } = renderGalleryScreen();
    expect(getByTestId('gallery-list')).toBeTruthy();
    expect(queryByTestId('gallery-guest-empty-state')).toBeNull();
  });
});
