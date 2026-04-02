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

    // Press save button -> opens confirm modal
    fireEvent.press(getByText('この内容で記録する'));

    // Press confirm button inside modal
    fireEvent.press(getByText('登録する'));

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
    fireEvent.press(getByText('登録する'));

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
    fireEvent.press(getByText('登録する'));

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
    fireEvent.press(getByText('登録する'));

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

  it('shows submit error when submit fails', async () => {
    mockFormState.submitError = '保存に失敗しました';

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('保存に失敗しました')).toBeTruthy();
  });
});
