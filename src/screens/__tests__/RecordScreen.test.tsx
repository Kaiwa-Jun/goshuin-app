import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RecordScreen } from '@screens/RecordScreen';
import type { Spot, Stamp } from '@/types/supabase';

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
  status: 'active',
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

let mockFormState = {
  selectedSpot: null as Spot | null,
  imageUri: null as string | null,
  visitedAt: new Date('2024-06-01'),
  memo: '',
  spotError: null as string | null,
  imageError: null as string | null,
  isSubmitting: false,
  submitError: null as string | null,
  selectSpot: mockSelectSpot,
  setImageUri: mockSetImageUri,
  setVisitedAt: mockSetVisitedAt,
  setMemo: mockSetMemo,
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

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://example.com/stamps/${path}`,
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
      spotError: null,
      imageError: null,
      isSubmitting: false,
      submitError: null,
      selectSpot: mockSelectSpot,
      setImageUri: mockSetImageUri,
      setVisitedAt: mockSetVisitedAt,
      setMemo: mockSetMemo,
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
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    };

    mockFormState.selectedSpot = fakeSpot;
    mockFormState.imageUri = 'file:///photo.jpg';
    mockSubmit.mockResolvedValue({ success: true, stamp: fakeStamp });

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

  it('shows submit error when submit fails', async () => {
    mockFormState.submitError = '保存に失敗しました';

    const { getByText } = render(<RecordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('保存に失敗しました')).toBeTruthy();
  });
});
