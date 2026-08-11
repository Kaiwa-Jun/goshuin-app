import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Image } from 'react-native';
import { RecordScreen } from '@screens/RecordScreen';
import { evaluateNewBadge } from '@services/badges';
import type { Spot, Stamp } from '@/types/supabase';

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
const mockSetImageUri = jest.fn();
const mockSetVisitedAt = jest.fn();
const mockSetMemo = jest.fn();
const mockValidate = jest.fn(() => true);
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
  imageUri: null as string | null,
  visitedAt: new Date('2024-06-01'),
  memo: '',
  isPublic: false,
  spotError: null as string | null,
  imageError: null as string | null,
  isSubmitting: false,
  submitError: null as string | null,
  selectSpot: mockSelectSpot,
  setImageUri: mockSetImageUri,
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
      imageUri: null,
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      submitError: null,
      selectSpot: mockSelectSpot,
      setImageUri: mockSetImageUri,
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
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({ success: true, stamp: fakeStamp });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-2']));

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);

    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
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
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({ success: true, stamp: fakeStamp });
    // spot-1 is NOT in visited set -> new spot
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-2', 'spot-3']));

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
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
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({ success: true, stamp: fakeStamp });
    // spot-1 is already in visited set -> re-visit
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-1', 'spot-2']));

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
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
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({ success: true, stamp: fakeStamp });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        'RecordComplete',
        expect.objectContaining({
          badge: mockBadge,
        })
      );
    });
  });

  it('公開トグルが表示されること', () => {
    const { getByText, getByTestId } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('この御朱印を公開する')).toBeTruthy();
    expect(getByTestId('public-toggle')).toBeTruthy();
  });

  it('トグル操作で setIsPublic が呼ばれること', () => {
    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent(getByTestId('public-toggle'), 'valueChange', true);
    expect(mockSetIsPublic).toHaveBeenCalledWith(true);
  });

  it('メモ欄の下にガイドテキストが表示されること', () => {
    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText(/駐車場の有無、受付時間、アクセス情報などを書くと/)).toBeTruthy();
  });

  it('navigates to Error screen when submit fails', async () => {
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({ success: false });
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
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({
      success: false,
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
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({
      success: false,
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
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({
      success: false,
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
      imageUri: null,
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      submitError: null,
      selectSpot: mockSelectSpot,
      setImageUri: mockSetImageUri,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
    mockValidate.mockReturnValue(true);
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
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({ success: true, stamp: fakeStamp });
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

  // B-2: 取り消しに要る stampId / imagePath を完了画面へ渡す
  it('完了画面へ stampId と imagePath を渡す', async () => {
    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({ success: true, stamp: fakeStamp });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('この内容で記録する'));

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        'RecordComplete',
        expect.objectContaining({
          stampId: 'stamp-1',
          imagePath: 'user-1/12345.jpg',
        })
      );
    });
  });

  // A-8: スポット未選択なら遷移しない
  it('スポット未選択なら送信も遷移もしない', async () => {
    mockFormState.selectedSpot = null;
    mockFormState.imageUri = 'file:///photo.jpg';
    mockValidate.mockReturnValueOnce(false);

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
    mockFormState.imageUri = null;
    mockValidate.mockReturnValueOnce(false);

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
    mockFormState.imageUri = 'file:///photo.jpg';
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
      imageUri: null,
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      submitError: null,
      selectSpot: mockSelectSpot,
      setImageUri: mockSetImageUri,
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
    expect(mockSetImageUri).toHaveBeenCalledWith('file:///photo.jpg');
  });

  // C-7: キャンセル時に選択済みの写真を壊さない
  it('撮影をキャンセルしたら imageUri を更新しない', async () => {
    mockTakePhoto.mockResolvedValue(null);

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('photo-section'));

    await waitFor(() => {
      expect(mockTakePhoto).toHaveBeenCalled();
    });
    expect(mockSetImageUri).not.toHaveBeenCalled();
  });

  // C-6: モーダルを廃してもギャラリーに到達できる
  it('ギャラリーのリンクからライブラリを開ける', async () => {
    mockPickFromLibrary.mockResolvedValue('file:///library.jpg');

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('pick-from-library'));

    await waitFor(() => {
      expect(mockPickFromLibrary).toHaveBeenCalledTimes(1);
    });
    expect(mockSetImageUri).toHaveBeenCalledWith('file:///library.jpg');
  });

  it('ギャラリーの選択をキャンセルしたら imageUri を更新しない', async () => {
    mockPickFromLibrary.mockResolvedValue(null);

    const { getByTestId } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('pick-from-library'));

    await waitFor(() => {
      expect(mockPickFromLibrary).toHaveBeenCalled();
    });
    expect(mockSetImageUri).not.toHaveBeenCalled();
  });
});

describe('最寄りスポットの自動選択ラベル（Issue #130 / S-5）', () => {
  const baseFormState = () => ({
    selectedSpot: null as Spot | null,
    imageUri: null as string | null,
    visitedAt: new Date('2024-06-01'),
    memo: '',
    isPublic: false,
    spotError: null as string | null,
    imageError: null as string | null,
    isSubmitting: false,
    submitError: null as string | null,
    selectSpot: mockSelectSpot,
    setImageUri: mockSetImageUri,
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
    imageUri: null as string | null,
    visitedAt: new Date('2024-06-01'),
    memo: '',
    isPublic: false,
    spotError: null as string | null,
    imageError: null as string | null,
    isSubmitting: false,
    submitError: null as string | null,
    selectSpot: mockSelectSpot,
    setImageUri: mockSetImageUri,
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
    mockValidate.mockReturnValue(true);
    mockSubmit.mockResolvedValue({ success: true, stamp: fakeStamp });
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());
    mockTakePhoto.mockResolvedValue('file:///photo.jpg');
  });

  // F-1: 既定選択が効く典型ケース。地図の FAB を足して 3 タップになる
  it('既定選択が効けば記録画面での操作は2タップ', async () => {
    mockFormState = {
      ...baseFormState(),
      selectedSpot: fakeSpot,
      isSpotAutoSelected: true,
      imageUri: 'file:///photo.jpg',
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
      expect(mockNavigation.navigate).toHaveBeenCalledWith('RecordComplete', expect.any(Object));
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
    mockFormState.imageUri = 'file:///photo.jpg';
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
      imageUri: 'file:///photo.jpg',
      visitedAt: new Date('2024-06-01'),
      memo: '',
      isPublic: false,
      spotError: null,
      imageError: null,
      isSubmitting: false,
      submitError: null,
      selectSpot: mockSelectSpot,
      setImageUri: mockSetImageUri,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
      setIsPublic: mockSetIsPublic,
      validate: mockValidate,
      submit: mockSubmit,
      reset: mockReset,
    };
    mockValidate.mockReturnValue(true);
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
    mockSubmit.mockResolvedValue({ success: true, stamp: fakeStamp });

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);

    const button = getByText('この内容で記録する');
    fireEvent.press(button);
    fireEvent.press(button);

    releaseFetch(new Set());

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
    expect(mockFetchVisitedSpotIds).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('送信が終われば次の記録を送信できる', async () => {
    mockFetchVisitedSpotIds.mockResolvedValue(new Set());
    mockSubmit.mockResolvedValue({ success: true, stamp: fakeStamp });

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
    mockSubmit.mockResolvedValue({ success: false, error: new Error('boom'), stage: 'upload' });

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
