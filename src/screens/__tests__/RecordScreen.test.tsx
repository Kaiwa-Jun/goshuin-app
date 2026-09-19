import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Image, Keyboard, ScrollView, StyleSheet } from 'react-native';
import { RecordScreen } from '@screens/RecordScreen';
import { evaluateNewBadge } from '@services/badges';
import type { Spot, Stamp } from '@/types/supabase';
import { MAX_PHOTOS_PER_RECORD } from '@/constants/record';

jest
  .spyOn(Image, 'getSize')
  .mockImplementation((_uri: string, success: (width: number, height: number) => void) => {
    success(300, 400);
  });

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockSelectSpot = jest.fn();
const mockAddImages = jest.fn();
const mockRemoveImage = jest.fn();
const mockSetVisitedAt = jest.fn();
const mockSetMemo = jest.fn();
const mockValidate = jest.fn((): string[] => []);
const mockSubmit = jest.fn();
const mockReset = jest.fn();

const fakeSpot: Spot = {
  id: 'spot-1',
  name: '大崎八幡宮',
  lat: 38.2744,
  lng: 140.8577,
  type: 'shrine',
  address: '宮城県仙台市青葉区八幡4-6-1',
  prefecture: null,
  status: 'active',
  rank: 3,
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const mockSetIsPublic = jest.fn();

let mockFormState = {
  selectedSpot: null as Spot | null,
  imageUris: [] as string[],
  visitedAt: new Date('2024-06-01'),
  memo: '',
  isPublic: false,
  spotError: null as string | null,
  imageError: null as string | null,
  isSubmitting: false,
  savedCount: 0,
  submitError: null as string | null,
  selectSpot: mockSelectSpot,
  addImages: mockAddImages,
  removeImage: mockRemoveImage,
  setVisitedAt: mockSetVisitedAt,
  setMemo: mockSetMemo,
  setIsPublic: mockSetIsPublic,
  validate: mockValidate,
  submit: mockSubmit,
  reset: mockReset,
};

jest.mock('@hooks/useRecordForm', () => ({
  useRecordForm: () => mockFormState,
}));

jest.mock('@hooks/useNearbySpots', () => ({
  useNearbySpots: () => ({
    nearbySpots: [{ spot: fakeSpot, distanceKm: 1.2 }],
    filteredSpots: [{ spot: fakeSpot, distanceKm: 1.2 }],
    isLoading: false,
    error: null,
    searchQuery: '',
    setSearchQuery: jest.fn(),
  }),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, isAuthenticated: true }),
}));

jest.mock('@hooks/useLocation', () => ({
  useLocation: () => ({
    location: { latitude: 38.27, longitude: 140.86 },
    isLoading: false,
    error: null,
  }),
}));

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockTakePhoto = jest.fn();
const mockPickFromLibrary = jest.fn();

jest.mock('@hooks/usePhotoPicker', () => ({
  usePhotoPicker: () => ({
    takePhoto: mockTakePhoto,
    pickFromLibrary: mockPickFromLibrary,
  }),
}));

const mockFetchVisitedSpotIds = jest.fn();

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://example.com/stamps/${path}`,
  fetchVisitedSpotIds: (...args: unknown[]) => mockFetchVisitedSpotIds(...args),
}));

jest.mock('@services/badges', () => ({
  evaluateNewBadge: jest.fn(() => null),
}));

jest.mock('@services/spots', () => ({
  createSpot: jest.fn(),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
  };
});

const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
} as any;

const mockRoute = {
  key: 'test',
  name: 'Record' as const,
  params: undefined,
};

describe('RecordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = {
      selectedSpot: null,
      imageUris: [],
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      savedCount: 0,
      submitError: null,
      selectSpot: mockSelectSpot,
      addImages: mockAddImages,
      removeImage: mockRemoveImage,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
  });

  it('renders without crashing', () => {
    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('御朱印を記録')).toBeTruthy();
  });

  it('renders all form sections', () => {
    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('スポット')).toBeTruthy();
    expect(getByText('御朱印の写真')).toBeTruthy();
    expect(getByText('訪問日')).toBeTruthy();
    expect(getByText('メモ（任意）')).toBeTruthy();
  });

  it('renders spot selector trigger', () => {
    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByTestId('spot-selector-trigger')).toBeTruthy();
  });

  it('renders photo section', () => {
    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByTestId('photo-section')).toBeTruthy();
  });

  it('renders memo input', () => {
    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByTestId('memo-input')).toBeTruthy();
  });

  it('renders save button', () => {
    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('この内容で記録する')).toBeTruthy();
  });

  it('navigates back on close button press', () => {
    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('header-close-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('calls submit and navigates to RecordComplete on success', async () => {
    const fakeStamp: Stamp = {
      id: 'stamp-1',
      user_id: 'user-1',
      spot_id: 'spot-1',
      goshuincho_id: null,
      visited_at: '2024-06-01T00:00:00.000Z',
      image_path: 'user-1/12345.jpg',
      memo: '',
      is_public: false,
      extracted_info: null,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    };

    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-2']));

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);

    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });
  });

  it('navigates to RecordComplete with visitCount when recording new spot', async () => {
    const fakeStamp: Stamp = {
      id: 'stamp-1',
      user_id: 'user-1',
      spot_id: 'spot-1',
      goshuincho_id: null,
      visited_at: '2024-06-01T00:00:00.000Z',
      image_path: 'user-1/12345.jpg',
      memo: '',
      is_public: false,
      extracted_info: null,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    };

    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    // spot-1 is NOT in visited set -> new spot
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-2', 'spot-3']));

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'RecordComplete',
        expect.objectContaining({
          visitCount: 3, // previousCount=2 + 1 new spot
        })
      );
    });
  });

  it('navigates to RecordComplete with visitCount when re-visiting spot', async () => {
    const fakeStamp: Stamp = {
      id: 'stamp-2',
      user_id: 'user-1',
      spot_id: 'spot-1',
      goshuincho_id: null,
      visited_at: '2024-06-01T00:00:00.000Z',
      image_path: 'user-1/12345.jpg',
      memo: '',
      is_public: false,
      extracted_info: null,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    };

    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    // spot-1 is already in visited set -> re-visit
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-1', 'spot-2']));

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'RecordComplete',
        expect.objectContaining({
          visitCount: 2, // previousCount=2, no change for re-visit
        })
      );
    });
  });

  it('navigates to RecordComplete with badge when badge is earned', async () => {
    const fakeStamp: Stamp = {
      id: 'stamp-1',
      user_id: 'user-1',
      spot_id: 'spot-1',
      goshuincho_id: null,
      visited_at: '2024-06-01T00:00:00.000Z',
      image_path: 'user-1/12345.jpg',
      memo: '',
      is_public: false,
      extracted_info: null,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    };

    const mockBadge = { name: '初めての御朱印', description: '初めての御朱印を記録しました' };
    (evaluateNewBadge as jest.Mock).mockReturnValue(mockBadge);

    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'RecordComplete',
        expect.objectContaining({
          badge: mockBadge,
        })
      );
    });
  });

  it('メモ欄の下にガイドテキストが表示されること', () => {
    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText(/駐車場の有無、アクセス情報などを書くと/)).toBeTruthy();
  });

  // D-6（案A）: 受付時間は公式サイトから seed するようにしたので、
  // メモに書いてもらう対象から外す。駐車場とアクセス情報はメモが唯一の
  // 供給源なので残す（本番でそれぞれ 3件 / 1件しかない）
  // Guideline 1.2: 他ユーザーに見えるコンテンツを作らせない（Issue #147）。
  // トグルを外すと createStamp の `is_public: params.isPublic ?? false` により
  // 新規記録は必ず非公開になる
  it('公開トグルが表示されないこと', () => {
    const { queryByTestId, queryByText } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(queryByTestId('public-toggle')).toBeNull();
    expect(queryByText(/公開/)).toBeNull();
  });

  it('ガイドテキストが受付時間を書くよう促していないこと', () => {
    const { queryByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(queryByText(/受付時間/)).toBeNull();
  });

  it('navigates to Error screen when submit fails', async () => {
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockSubmit.mockResolvedValue({ success: false, stamps: [], failedCount: 1 });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Error', {
        type: 'upload',
        origin: 'record',
      });
    });
  });

  it('ネットワークエラーの場合は type: "network" でエラー画面に遷移する', async () => {
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockSubmit.mockResolvedValue({
      success: false,
      stamps: [],
      failedCount: 1,
      error: new Error('Network request failed'),
    });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Error', {
        type: 'network',
        origin: 'record',
      });
    });
  });

  it('ネットワーク以外のエラーの場合は type: "upload" でエラー画面に遷移する', async () => {
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockSubmit.mockResolvedValue({
      success: false,
      stamps: [],
      failedCount: 1,
      error: new Error('保存に失敗しました'),
    });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Error', {
        type: 'upload',
        origin: 'record',
      });
    });
  });

  it('失敗箇所とエラー原文をエラー画面へ引き渡す', async () => {
    // ここが抜けると「失敗しても詳細が出ない」形で実機で発覚する
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockSubmit.mockResolvedValue({
      success: false,
      stamps: [],
      failedCount: 1,
      error: new Error('insert failed (code=42501)'),
      stage: 'create',
      message: 'insert failed (code=42501)',
    });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Error', {
        type: 'upload',
        origin: 'record',
        stage: 'create',
        message: 'insert failed (code=42501)',
      });
    });
  });
});

describe('確認モーダルの廃止（Issue #130 / D-3）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = {
      selectedSpot: null,
      imageUris: [],
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      savedCount: 0,
      submitError: null,
      selectSpot: mockSelectSpot,
      addImages: mockAddImages,
      removeImage: mockRemoveImage,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
    mockValidate.mockReturnValue([]);
  });

  const fakeStamp: Stamp = {
    id: 'stamp-1',
    user_id: 'user-1',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-06-01T00:00:00.000Z',
    image_path: 'user-1/12345.jpg',
    memo: '',
    is_public: false,
    extracted_info: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  };

  // A-5: モーダルを挟まず1回で送信される
  it('「この内容で記録する」の1タップで submit が1回だけ呼ばれる', async () => {
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const { getByText, queryByText } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );

    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
    // 確認モーダルが出ていないこと
    expect(queryByText('登録内容の確認')).toBeNull();
    expect(queryByText('登録する')).toBeNull();
  });

  // 完了画面は来た場所に返すので、入口の origin を引き継ぐ
  it('完了画面へ origin を渡す', async () => {
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const route = { ...mockRoute, params: { origin: 'gallery' } } as never;
    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={route} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'RecordComplete',
        expect.objectContaining({ origin: 'gallery' })
      );
    });
  });

  // A-8: スポット未選択なら遷移しない
  it('スポット未選択なら送信も遷移もしない', async () => {
    mockFormState.selectedSpot = null;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockValidate.mockReturnValueOnce(['spot']);

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockSubmit).not.toHaveBeenCalled();
    });
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  // A-9: 写真未選択なら遷移しない
  it('写真未選択なら送信も遷移もしない', async () => {
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = [];
    mockValidate.mockReturnValueOnce(['image']);

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockSubmit).not.toHaveBeenCalled();
    });
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  // A-10: 送信中は二重タップできない。モーダルが無くなったぶん、これが唯一の二重送信防御になる。
  // toBeDisabled は @testing-library/jest-native 未導入のため使えないので挙動で確認する
  it('送信中は記録ボタンを押しても submit が呼ばれない', async () => {
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    mockFormState.isSubmitting = true;
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockFetchVisitedSpotIds).not.toHaveBeenCalled();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe('訪問日の和暦併記（監査 A-2 / 入力補助）', () => {
  it('日付の行に和暦のラベルが併記される', () => {
    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);

    // 紙の御朱印は和暦で書かれているため、ピッカーの西暦と照合できるようにする
    expect(getByTestId('date-era-label')).toBeTruthy();
  });

  it('和暦ラベルが選択中の日付に追随する', () => {
    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);

    const label = getByTestId('date-era-label');
    // 既定は今日。令和のいずれかの年になっているはず
    expect(String(label.props.children)).toMatch(/^令和(元|\d+)年\d+月\d+日$/);
  });
});

describe('日付ピッカーの表示形式（Issue #128）', () => {
  it('iOS ではホイール3列（spinner）を使う', () => {
    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);

    fireEvent.press(getByTestId('date-picker-trigger'));

    // inline は「カレンダー ⇄ 年月ホイール」の2モードを持ち、年月ホイールの
    // 途中で完了を押すと日が未確定のまま閉じてしまう（実機で判明）
    expect(getByTestId('date-picker').props.display).toBe('spinner');
  });
});

describe('写真のカメラ直起動（Issue #130 / S-3）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = {
      selectedSpot: null,
      imageUris: [],
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      savedCount: 0,
      submitError: null,
      selectSpot: mockSelectSpot,
      addImages: mockAddImages,
      removeImage: mockRemoveImage,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
    mockTakePhoto.mockReset();
    mockPickFromLibrary.mockReset();
  });

  // C-3: 選択モーダルを挟まない
  it('写真枠のタップでカメラが直接起動する', async () => {
    mockTakePhoto.mockResolvedValue('file:///photo.jpg');

    const { getByTestId, queryByText } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );
    fireEvent.press(getByTestId('photo-section'));

    await waitFor(() => {
      expect(mockTakePhoto).toHaveBeenCalledTimes(1);
    });
    // 選択モーダルが出ていないこと
    expect(queryByText('カメラで撮影')).toBeNull();
    expect(queryByText('ギャラリーから選択')).toBeNull();
    expect(mockAddImages).toHaveBeenCalledWith(['file:///photo.jpg']);
  });

  // C-7: キャンセル時に選択済みの写真を壊さない
  it('撮影をキャンセルしたら写真を増やさない', async () => {
    mockTakePhoto.mockResolvedValue(null);

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('photo-section'));

    await waitFor(() => {
      expect(mockTakePhoto).toHaveBeenCalled();
    });
    expect(mockAddImages).not.toHaveBeenCalled();
  });

  // C-6: モーダルを廃してもギャラリーに到達できる
  it('ギャラリーのリンクからライブラリを開ける', async () => {
    mockPickFromLibrary.mockResolvedValue(['file:///library.jpg']);

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('pick-from-library'));

    await waitFor(() => {
      expect(mockPickFromLibrary).toHaveBeenCalledTimes(1);
    });
    expect(mockAddImages).toHaveBeenCalledWith(['file:///library.jpg']);
  });

  it('ギャラリーの選択をキャンセルしたら写真を増やさない', async () => {
    mockPickFromLibrary.mockResolvedValue([]);

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('pick-from-library'));

    await waitFor(() => {
      expect(mockPickFromLibrary).toHaveBeenCalled();
    });
    expect(mockAddImages).not.toHaveBeenCalled();
  });
});

describe('最寄りスポットの自動選択ラベル（Issue #130 / S-5）', () => {
  const baseFormState = () => ({
    selectedSpot: null as Spot | null,
    imageUris: [] as string[],
    visitedAt: new Date('2024-06-01'),
    memo: '',
    isPublic: false,
    spotError: null as string | null,
    imageError: null as string | null,
    isSubmitting: false,
    savedCount: 0,
    submitError: null as string | null,
    selectSpot: mockSelectSpot,
    addImages: mockAddImages,
    removeImage: mockRemoveImage,
    setVisitedAt: mockSetVisitedAt,
    setMemo: mockSetMemo,
    setIsPublic: mockSetIsPublic,
    validate: mockValidate,
    submit: mockSubmit,
    reset: mockReset,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = baseFormState();
  });

  // D-7
  it('自動選択されたときはラベルを出す', () => {
    mockFormState = { ...baseFormState(), selectedSpot: fakeSpot, isSpotAutoSelected: true } as any;

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByTestId('spot-auto-selected-label')).toBeTruthy();
  });

  // D-8
  it('ユーザーが選んだ場合はラベルを出さない', () => {
    mockFormState = {
      ...baseFormState(),
      selectedSpot: fakeSpot,
      isSpotAutoSelected: false,
    } as any;

    const { queryByTestId } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(queryByTestId('spot-auto-selected-label')).toBeNull();
  });

  // D-9: ボトムシート経由の明示指定は「自動選択」ではない
  it('spotId 指定で入った場合はラベルを出さない', () => {
    mockFormState = {
      ...baseFormState(),
      selectedSpot: fakeSpot,
      isSpotAutoSelected: false,
    } as any;
    const routeWithSpot = { ...mockRoute, params: { spotId: 'spot-1' } };

    const { queryByTestId } = render(
      <RecordScreen navigation={mockNavigation} route={routeWithSpot as any} />
    );
    expect(queryByTestId('spot-auto-selected-label')).toBeNull();
  });
});

describe('タップ数（Issue #130 / F 群）', () => {
  const baseFormState = () => ({
    selectedSpot: null as Spot | null,
    imageUris: [] as string[],
    visitedAt: new Date('2024-06-01'),
    memo: '',
    isPublic: false,
    spotError: null as string | null,
    imageError: null as string | null,
    isSubmitting: false,
    savedCount: 0,
    submitError: null as string | null,
    selectSpot: mockSelectSpot,
    addImages: mockAddImages,
    removeImage: mockRemoveImage,
    setVisitedAt: mockSetVisitedAt,
    setMemo: mockSetMemo,
    setIsPublic: mockSetIsPublic,
    validate: mockValidate,
    submit: mockSubmit,
    reset: mockReset,
  });

  const fakeStamp: Stamp = {
    id: 'stamp-1',
    user_id: 'user-1',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-06-01T00:00:00.000Z',
    image_path: 'user-1/12345.jpg',
    memo: '',
    is_public: false,
    extracted_info: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = baseFormState();
    mockValidate.mockReturnValue([]);
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());
    mockTakePhoto.mockResolvedValue('file:///photo.jpg');
  });

  // F-1: 既定選択が効く典型ケース。地図の FAB を足して 3 タップになる
  it('既定選択が効けば記録画面での操作は2タップ', async () => {
    mockFormState = {
      ...baseFormState(),
      selectedSpot: fakeSpot,
      isSpotAutoSelected: true,
      // まだ1枚も無い状態から数える。写真枠をタップするところが1タップ目
      imageUris: [],
    } as any;

    const { getByTestId, getByText } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );

    let taps = 0;
    fireEvent.press(getByTestId('photo-section'));
    taps++;
    fireEvent.press(getByText('この内容で記録する'));
    taps++;

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });
    expect(taps).toBe(2);
  });

  // F-2: 既定選択が効かない場合。検索欄と候補で2タップ増える
  it('既定選択が効かなければ記録画面での操作は4タップ', async () => {
    const { getByTestId, getByText } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );

    let taps = 0;
    // 1. 検索欄をタップして候補を開く
    fireEvent(getByTestId('search-input'), 'focus');
    taps++;
    // 2. 候補をタップ
    fireEvent.press(getByText('大崎八幡宮'));
    taps++;
    expect(mockSelectSpot).toHaveBeenCalledWith(fakeSpot);

    // 3. 写真枠をタップ（カメラが直接起動する）
    fireEvent.press(getByTestId('photo-section'));
    taps++;
    await waitFor(() => {
      expect(mockTakePhoto).toHaveBeenCalled();
    });

    // 4. 記録する
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUris = ['file:///photo.jpg'];
    fireEvent.press(getByText('この内容で記録する'));
    taps++;

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
    });
    expect(taps).toBe(4);
  });
});

describe('二重送信の防止（Issue #130 / A-10 補強）', () => {
  const fakeStamp: Stamp = {
    id: 'stamp-1',
    user_id: 'user-1',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-06-01T00:00:00.000Z',
    image_path: 'user-1/12345.jpg',
    memo: '',
    is_public: false,
    extracted_info: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = {
      selectedSpot: fakeSpot,
      imageUris: ['file:///photo.jpg'],
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      savedCount: 0,
      submitError: null,
      selectSpot: mockSelectSpot,
      addImages: mockAddImages,
      removeImage: mockRemoveImage,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
    mockValidate.mockReturnValue([]);
  });

  // 確認モーダルを廃したことで、記録ボタンが唯一の入口になった。
  // isSubmitting は submit() の中で初めて true になるため、その手前の
  // fetchVisitedSpotIds を待っている間はボタンが押せてしまう。
  // ここを塞がないと素早い二度押しで御朱印が2件・画像も2枚できる
  it('fetchVisitedSpotIds の待ち時間に二度押ししても submit は1回だけ', async () => {
    let releaseFetch: (v: Set<string>) => void = () => {};
    mockFetchVisitedSpotIds.mockReturnValue(
      new Promise<Set<string>>(resolve => {
        releaseFetch = resolve;
      })
    );
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);

    const button = getByText('この内容で記録する');
    fireEvent.press(button);
    fireEvent.press(button);

    releaseFetch(new Set());

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
    expect(mockFetchVisitedSpotIds).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
  });

  it('送信が終われば次の記録を送信できる', async () => {
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    const button = getByText('この内容で記録する');

    fireEvent.press(button);
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(button);
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(2);
    });
  });

  it('送信に失敗した後も再送信できる', async () => {
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());
    mockSubmit.mockResolvedValue({
      success: false,
      stamps: [],
      failedCount: 1,
      error: new Error('boom'),
      stage: 'upload',
    });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    const button = getByText('この内容で記録する');

    fireEvent.press(button);
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(button);
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(2);
    });
  });
});

// 訪問済みスポットの取得だけが失敗したとき、0件として扱うと
// 「100箇所目なのに1箇所目」と祝い、獲得済みバッジが再発火する（Issue #133）
describe('訪問済みスポットの取得に失敗したとき（Issue #133）', () => {
  const fakeStamp: Stamp = {
    id: 'stamp-1',
    user_id: 'user-1',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-06-01T00:00:00.000Z',
    image_path: 'user-1/12345.jpg',
    memo: '',
    is_public: false,
    extracted_info: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  };

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = {
      selectedSpot: fakeSpot,
      imageUris: ['file:///photo.jpg'],
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      savedCount: 0,
      submitError: null,
      selectSpot: mockSelectSpot,
      addImages: mockAddImages,
      removeImage: mockRemoveImage,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
    mockValidate.mockReturnValue([]);
    mockFetchVisitedSpotIds.mockRejectedValue(new Error('訪問済みスポットの取得に失敗しました'));
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  const pressSave = () => {
    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));
  };

  // B-1 / B-2: 失敗しているのは表示用の前取得であって記録ではない
  it('記録そのものは続行して完了画面へ遷移する', async () => {
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    pressSave();

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });
  });

  // B-3 / B-4 / B-5: 誤った数字を祝うくらいなら出さない
  it('visitCount と badge を渡さず countUnavailable を渡す', async () => {
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    pressSave();

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });

    const params = mockNavigation.replace.mock.calls.find(
      (call: unknown[]) => call[0] === 'RecordComplete'
    )![1];

    expect(params).not.toHaveProperty('visitCount');
    expect(params).not.toHaveProperty('badge');
    expect(params.countUnavailable).toBe(true);
  });

  // B-6: previousCount が無い以上、判定できる材料が無い
  it('evaluateNewBadge を一度も呼ばない', async () => {
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    pressSave();

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
    });

    expect(evaluateNewBadge as jest.Mock).not.toHaveBeenCalled();
  });

  // 表示に要る params を巻き添えにしない
  it('表示に要る params は従来どおり渡す', async () => {
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    pressSave();

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });

    const params = mockNavigation.replace.mock.calls.find(
      (call: unknown[]) => call[0] === 'RecordComplete'
    )![1];

    expect(params.spotName).toBe(fakeSpot.name);
    expect(params.stampImageUrl).toBeDefined();
  });

  // B-8: 取得も保存も失敗したときの分岐は従来どおり
  it('保存も失敗したら従来どおりエラー画面へ原文を渡す', async () => {
    mockSubmit.mockResolvedValue({
      success: false,
      stamps: [],
      failedCount: 1,
      error: new Error('insert failed (code=42501)'),
      stage: 'create',
      message: 'insert failed (code=42501)',
    });
    pressSave();

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Error', {
        type: 'upload',
        origin: 'record',
        stage: 'create',
        message: 'insert failed (code=42501)',
      });
    });
  });

  // B-9: catch 漏れがあると記録画面が redbox になる。
  // ⚠️ 検出しているのは jest-circus 自身で、テスト実行中に unhandled rejection が
  // 起きればこのテストは落ちる。handleSavePress は save() の Promise を誰にも
  // 渡さないため、こちらで掴んで assert する手段が無い。
  // 自前で process.on('unhandledRejection') を張っても、その時点で jest が先に
  // テストを落とすのでアサーションまで到達せず、守っているように見えるだけになる
  it('reject を持ち越さず最後まで流れ切る', async () => {
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });

    pressSave();
    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });
    // 取りこぼした rejection がマイクロタスクの後に浮上してくる猶予を与える
    await new Promise(resolve => setImmediate(resolve));
  });

  // B-10: isSavingRef が張り付くと以降まったく記録できなくなる（issue-130 A-12/A-13 と同趣旨）
  it('失敗した後もう一度押せば再び記録できる', async () => {
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    const button = getByText('この内容で記録する');

    fireEvent.press(button);
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(button);
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(2);
    });
  });

  // B-13: 実機では Metro のログでしか追えないので、接頭辞を固定しておく
  it('診断できるよう [record] 接頭辞で警告を残す', async () => {
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
    pressSave();

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('[record]');
  });
});

// B-11 / B-12: 取得できたときの挙動は一切変えない
describe('訪問済みスポットの取得に成功したとき（Issue #133 の無回帰）', () => {
  const fakeStamp: Stamp = {
    id: 'stamp-1',
    user_id: 'user-1',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-06-01T00:00:00.000Z',
    image_path: 'user-1/12345.jpg',
    memo: '',
    is_public: false,
    extracted_info: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = {
      selectedSpot: fakeSpot,
      imageUris: ['file:///photo.jpg'],
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      savedCount: 0,
      submitError: null,
      selectSpot: mockSelectSpot,
      addImages: mockAddImages,
      removeImage: mockRemoveImage,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
    mockValidate.mockReturnValue([]);
    mockSubmit.mockResolvedValue({ success: true, stamps: [fakeStamp], failedCount: 0 });
  });

  const paramsOfRecordComplete = () =>
    mockNavigation.replace.mock.calls.find((call: unknown[]) => call[0] === 'RecordComplete')![1];

  it('新規スポットなら件数を1つ増やし、バッジ判定に前後の件数を渡す', async () => {
    (evaluateNewBadge as jest.Mock).mockReturnValue(null);
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-2', 'spot-3']));

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });

    expect(paramsOfRecordComplete().visitCount).toBe(3);
    expect(evaluateNewBadge as jest.Mock).toHaveBeenCalledWith(2, 3);
  });

  it('再訪なら件数を増やさない', async () => {
    (evaluateNewBadge as jest.Mock).mockReturnValue(null);
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-1', 'spot-2']));

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });

    expect(paramsOfRecordComplete().visitCount).toBe(2);
    expect(evaluateNewBadge as jest.Mock).toHaveBeenCalledWith(2, 2);
  });

  it('evaluateNewBadge の返り値をそのまま badge に渡す', async () => {
    const badge = { name: '初めての御朱印', description: '最初の1枚' };
    (evaluateNewBadge as jest.Mock).mockReturnValue(badge);
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });

    expect(paramsOfRecordComplete().badge).toEqual(badge);
  });

  // B-12: 成功経路に注記のフラグを混ぜない
  it('countUnavailable のキーを渡さない', async () => {
    (evaluateNewBadge as jest.Mock).mockReturnValue(null);
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-2']));

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });

    expect(paramsOfRecordComplete()).not.toHaveProperty('countUnavailable');
  });
});

describe('日付ピッカーを開いたときのスクロール', () => {
  /*
   * 訪問日の行を画面最上部まで持ち上げると、上にある御朱印の写真が画面外に出る。
   * 写真の日付を見ながら訪問日を決めたいので、必要な分だけ動かす。
   *
   * ScrollView.prototype.scrollTo を spy する。ローカルの jest.fn() を作っても
   * ref には配線されないため、何も検証できない
   */
  const VIEWPORT = 600;
  let scrollTo: jest.SpyInstance;

  beforeEach(() => {
    scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    scrollTo.mockRestore();
  });

  const setup = () => {
    const r = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent(r.getByTestId('record-scroll'), 'layout', {
      nativeEvent: { layout: { height: VIEWPORT } },
    });
    return r;
  };

  it('タップしただけでは動かさない。高さが分かるまで動かす量を決められない', () => {
    jest.useFakeTimers();
    try {
      const r = setup();

      fireEvent.press(r.getByTestId('date-picker-trigger'));
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('ピッカーの下端が入る分だけ動かす。行を最上部に持ち上げない', () => {
    const r = setup();
    fireEvent.press(r.getByTestId('date-picker-trigger'));

    fireEvent(r.getByTestId('date-picker-block'), 'layout', {
      nativeEvent: { layout: { y: 460, height: 260 } },
    });

    // 下端 720 / 画面 600 → 120 + 余白。行の位置(460)まで上げてはいけない
    expect(scrollTo).toHaveBeenCalledTimes(1);
    const { y } = scrollTo.mock.calls[0][0] as { y: number };
    expect(y).toBeGreaterThanOrEqual(120);
    expect(y).toBeLessThan(460);
  });

  it('すでに見えていれば動かさない', () => {
    const r = setup();
    fireEvent.press(r.getByTestId('date-picker-trigger'));

    fireEvent(r.getByTestId('date-picker-block'), 'layout', {
      nativeEvent: { layout: { y: 100, height: 200 } },
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  // メモ欄も同じ不具合を抱えていた（行を最上部に持ち上げる）
  it('メモ欄も下端が入る分だけ動かす', () => {
    jest.useFakeTimers();
    try {
      const r = setup();
      fireEvent(r.getByTestId('memo-block'), 'layout', {
        nativeEvent: { layout: { y: 700, height: 120 } },
      });

      fireEvent(r.getByTestId('memo-input'), 'focus');
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(scrollTo).toHaveBeenCalledTimes(1);
      const { y } = scrollTo.mock.calls[0][0] as { y: number };
      // 下端 820 / 画面 600 → 220 + 余白。行の位置(700)まで上げてはいけない
      expect(y).toBeGreaterThanOrEqual(220);
      expect(y).toBeLessThan(700);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('複数枚をまとめて登録する（Issue #180）', () => {
  const stampFor = (id: string): Stamp => ({
    id,
    user_id: 'user-1',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-06-01T00:00:00.000Z',
    image_path: `user-1/${id}.jpg`,
    memo: '',
    is_public: false,
    extracted_info: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = {
      selectedSpot: fakeSpot,
      imageUris: ['file:///a.jpg'],
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      savedCount: 0,
      submitError: null,
      selectSpot: mockSelectSpot,
      addImages: mockAddImages,
      removeImage: mockRemoveImage,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
    mockValidate.mockReturnValue([]);
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-1']));
    mockTakePhoto.mockReset();
    mockPickFromLibrary.mockReset();
  });

  it('ギャラリーは残り枚数を上限にして開く', async () => {
    mockFormState.imageUris = ['file:///a.jpg', 'file:///b.jpg'];
    mockPickFromLibrary.mockResolvedValue([]);

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('pick-from-library'));

    await waitFor(() => {
      expect(mockPickFromLibrary).toHaveBeenCalledWith(MAX_PHOTOS_PER_RECORD - 2);
    });
  });

  it('選んだ複数枚をまとめてフォームに渡す', async () => {
    mockPickFromLibrary.mockResolvedValue(['file:///b.jpg', 'file:///c.jpg']);

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('pick-from-library'));

    await waitFor(() => {
      expect(mockAddImages).toHaveBeenCalledWith(['file:///b.jpg', 'file:///c.jpg']);
    });
  });

  // selectionLimit: 0 は expo-image-picker では「無制限」なので、
  // 残り0枚のまま呼ぶと上限が外れる
  it('上限まで入っていたらギャラリーのリンクを出さない', () => {
    mockFormState.imageUris = Array.from(
      { length: MAX_PHOTOS_PER_RECORD },
      (_, i) => `file:///${i}.jpg`
    );

    const { queryByTestId } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(queryByTestId('pick-from-library')).toBeNull();
  });

  it('全部保存できたら完了画面に枚数を渡す', async () => {
    mockFormState.imageUris = ['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg'];
    mockSubmit.mockResolvedValue({
      success: true,
      stamps: [stampFor('s1'), stampFor('s2'), stampFor('s3')],
      failedCount: 0,
    });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'RecordComplete',
        expect.objectContaining({
          stampCount: 3,
          stampImageUrl: 'https://example.com/stamps/user-1/s1.jpg',
        })
      );
    });
  });

  // 全部失敗したように見せると、やり直して重複ができる
  it('一部だけ失敗したら画面に留まり、保存できた枚数を伝える', async () => {
    mockFormState.imageUris = ['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg'];
    mockSubmit.mockResolvedValue({
      success: false,
      stamps: [stampFor('s1'), stampFor('s2')],
      failedCount: 1,
      error: new Error('Upload failed'),
      stage: 'upload',
      message: 'Upload failed',
    });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(getByText(/2枚を記録しました/)).toBeTruthy();
    });
    expect(getByText(/残り1枚/)).toBeTruthy();
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('1枚も保存できなければ従来どおりエラー画面へ', async () => {
    mockFormState.imageUris = ['file:///a.jpg', 'file:///b.jpg'];
    mockSubmit.mockResolvedValue({
      success: false,
      stamps: [],
      failedCount: 2,
      error: new Error('Network request failed'),
      stage: 'upload',
      message: 'Network request failed',
    });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Error', {
        type: 'network',
        origin: 'record',
        stage: 'upload',
        message: 'Network request failed',
      });
    });
  });

  // 5枚登録しても訪問したスポットは1つ。バッジが枚数で進んではいけない
  it('枚数ではなくスポット数でバッジを判定する', async () => {
    mockFormState.imageUris = ['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg'];
    mockSubmit.mockResolvedValue({
      success: true,
      stamps: [stampFor('s1'), stampFor('s2'), stampFor('s3')],
      failedCount: 0,
    });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-2', 'spot-3']));

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(evaluateNewBadge).toHaveBeenCalledWith(2, 3);
    });
  });
});

describe('バリデーションエラーのある欄まで連れていく', () => {
  /*
   * 記録ボタンは画面下に固定されているので、下までスクロールしたまま押せる。
   * そのときスポット欄や写真欄のエラーは画面の外にあり、押しても何も起きて
   * いないように見えていた。
   */
  const VIEWPORT = 600;
  let scrollTo: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    mockFormState = {
      selectedSpot: null,
      imageUris: [],
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      savedCount: 0,
      submitError: null,
      selectSpot: mockSelectSpot,
      addImages: mockAddImages,
      removeImage: mockRemoveImage,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
  });

  afterEach(() => {
    scrollTo.mockRestore();
  });

  /** 画面より下までスクロールした状態にして、欄の位置を教える */
  const setup = () => {
    const r = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent(r.getByTestId('record-scroll'), 'layout', {
      nativeEvent: { layout: { height: VIEWPORT } },
    });
    fireEvent(r.getByTestId('spot-block'), 'layout', {
      nativeEvent: { layout: { y: 0, height: 120 } },
    });
    fireEvent(r.getByTestId('photo-block'), 'layout', {
      nativeEvent: { layout: { y: 160, height: 280 } },
    });
    // メモ欄まで下げた状態
    fireEvent.scroll(r.getByTestId('record-scroll'), {
      nativeEvent: { contentOffset: { y: 700 } },
    });
    return r;
  };

  it('スポット未選択ならスポット欄まで戻る', async () => {
    mockValidate.mockReturnValue(['spot']);

    const r = setup();
    fireEvent.press(r.getByText('この内容で記録する'));

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalled();
    });
    const { y } = scrollTo.mock.calls[0][0] as { y: number };
    // スポット欄は先頭にあるので一番上まで
    expect(y).toBe(0);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('写真が無ければ写真欄まで戻る', async () => {
    mockValidate.mockReturnValue(['image']);

    const r = setup();
    fireEvent.press(r.getByText('この内容で記録する'));

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalled();
    });
    const { y } = scrollTo.mock.calls[0][0] as { y: number };
    // 写真欄の上端(160)が見える位置。スポット欄まで戻しすぎない
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThanOrEqual(160);
  });

  it('両方欠けていたら上の欄へ連れていく', async () => {
    mockValidate.mockReturnValue(['spot', 'image']);

    const r = setup();
    fireEvent.press(r.getByText('この内容で記録する'));

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalled();
    });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    const { y } = scrollTo.mock.calls[0][0] as { y: number };
    expect(y).toBe(0);
  });

  // 日付ピッカーの枠は onLayout で自分を画面に入れ直す。エラー文が増えると
  // 枠の位置が動いて onLayout が再発火し、せっかく欄まで戻したスクロールを
  // 上書きしてしまう。実機で「写真欄に飛ばされる」形で出た
  it('日付ピッカーが開いていたら閉じてから連れていく', async () => {
    mockValidate.mockReturnValue(['spot']);

    const r = setup();
    fireEvent.press(r.getByTestId('date-picker-trigger'));
    expect(r.getByTestId('date-picker-block')).toBeTruthy();

    fireEvent.press(r.getByText('この内容で記録する'));

    await waitFor(() => {
      expect(r.queryByTestId('date-picker-block')).toBeNull();
    });
  });

  it('入力がそろっていれば動かさない', async () => {
    mockValidate.mockReturnValue([]);
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());
    mockSubmit.mockResolvedValue({ success: true, stamps: [], failedCount: 0 });

    const r = setup();
    fireEvent.press(r.getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('その欄がすでに見えていれば動かさない', async () => {
    mockValidate.mockReturnValue(['spot']);

    const r = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent(r.getByTestId('record-scroll'), 'layout', {
      nativeEvent: { layout: { height: VIEWPORT } },
    });
    fireEvent(r.getByTestId('spot-block'), 'layout', {
      nativeEvent: { layout: { y: 0, height: 120 } },
    });
    // スクロールしていない = スポット欄は見えている
    fireEvent.press(r.getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalled();
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

// 記録済みのフォームを履歴に残すと、完了画面の「もう1枚記録する」から戻ったとき
// ✕ が完了画面に帰ってしまう。しかも押すたびに履歴が2つずつ伸びる（Issue #188）
describe('記録を終えたら、そのフォームを履歴に残さない', () => {
  const savedStamp: Stamp = {
    id: 'stamp-1',
    user_id: 'user-1',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-06-01T00:00:00.000Z',
    image_path: 'user-1/12345.jpg',
    memo: '',
    is_public: false,
    extracted_info: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = {
      selectedSpot: fakeSpot,
      imageUris: ['file:///a.jpg'],
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      savedCount: 0,
      submitError: null,
      selectSpot: mockSelectSpot,
      addImages: mockAddImages,
      removeImage: mockRemoveImage,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
    mockValidate.mockReturnValue([]);
  });

  it('完了画面へは push ではなく置き換えで行く', async () => {
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-1']));
    mockSubmit.mockResolvedValue({ success: true, stamps: [savedStamp], failedCount: 0 });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
    });
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('件数が取れなかったときも置き換えで行く', async () => {
    mockFetchVisitedSpotIds.mockRejectedValue(new Error('network'));
    mockSubmit.mockResolvedValue({ success: true, stamps: [savedStamp], failedCount: 0 });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'RecordComplete',
        expect.objectContaining({ countUnavailable: true })
      );
    });
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  // 失敗はやり直せる必要があるので、エラー画面は今までどおり push
  it('失敗したときのエラー画面は置き換えない', async () => {
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());
    mockSubmit.mockResolvedValue({
      success: false,
      stamps: [],
      failedCount: 1,
      error: new Error('boom'),
      stage: 'upload',
    });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Error', expect.any(Object));
    });
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });
});

describe('保存中の覆い（Issue #190）', () => {
  const submitting = (imageUris: string[], savedCount: number) => {
    mockFormState = {
      ...mockFormState,
      selectedSpot: fakeSpot,
      imageUris,
      isSubmitting: true,
      savedCount,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormState = {
      ...mockFormState,
      selectedSpot: null,
      imageUris: [],
      isSubmitting: false,
      savedCount: 0,
      spotError: null,
      imageError: null,
    };
  });

  it('保存していないときは覆いを出さない', () => {
    const { queryByTestId } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(queryByTestId('saving-overlay')).toBeNull();
  });

  it('保存中は覆いを出し、選んだ枚数ぶんの点を並べる', () => {
    submitting(['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg'], 1);

    const { getByTestId, queryByTestId } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(getByTestId('saving-overlay')).toBeTruthy();
    expect(getByTestId('saving-dot-2')).toBeTruthy();
    expect(queryByTestId('saving-dot-3')).toBeNull();
    expect(getByTestId('saving-count').props.children).toBe('1 / 3枚');
  });

  // アップロードにタイムアウトが無いので、全面を塞ぐと回線が死んだとき
  // 強制終了しか道が無くなる。覆いはヘッダーの下から敷く
  it('保存中でもヘッダーの ✕ は押せる', () => {
    submitting(['file:///a.jpg'], 0);

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('header-close-button'));

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  // 絶対配置の基準は SafeAreaView の外枠で、セーフエリアの余白はその内側にある。
  // 高さだけ見るとステータスバーのぶん足りず、覆いがヘッダーに乗る
  it('覆いはヘッダーの下端から敷く（セーフエリアのぶんを含む）', () => {
    submitting(['file:///a.jpg'], 0);

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent(getByTestId('header-block'), 'layout', {
      nativeEvent: { layout: { y: 59, height: 65 } },
    });

    expect(StyleSheet.flatten(getByTestId('saving-overlay').props.style).top).toBe(124);
  });

  // メモを書いている途中で押されると、覆いがキーボードの下に潜る
  it('保存を始めるときキーボードを閉じる', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    mockFormState = { ...mockFormState, selectedSpot: fakeSpot, imageUris: ['file:///a.jpg'] };
    mockValidate.mockReturnValue([]);
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());
    mockSubmit.mockResolvedValue({
      success: true,
      stamps: [{ id: 'stamp-1', spot_id: 'spot-1', image_path: 'user-1/1.jpg' } as Stamp],
      failedCount: 0,
    });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
    });
    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });
});
