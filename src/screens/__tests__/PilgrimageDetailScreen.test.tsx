import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { PilgrimageDetailScreen } from '../PilgrimageDetailScreen';
import type { CollectionStackScreenProps } from '@/navigation/types';

// react-native-maps モック
jest.mock('react-native-maps', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  const MockMapView = ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <View testID={testID ?? 'map-view'}>{children}</View>
  );
  MockMapView.displayName = 'MockMapView';
  const MockMarker = ({
    children,
    testID,
    onPress,
  }: {
    children?: React.ReactNode;
    testID?: string;
    onPress?: () => void;
  }) => (
    <View testID={testID ?? 'marker'} onTouchEnd={onPress}>
      {children}
    </View>
  );
  MockMarker.displayName = 'MockMarker';
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
  };
});

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const RN = require('react-native');
  return {
    SafeAreaView: RN.View,
    SafeAreaProvider: RN.View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    isAuthenticated: true,
  }),
}));

const mockVisitedSpotIds = new Set(['spot-1']);

jest.mock('@hooks/useUserStamps', () => ({
  useUserStamps: () => ({
    visitedSpotIds: mockVisitedSpotIds,
    isLoading: false,
  }),
}));

const mockSpots = [
  {
    id: 'pspot-1',
    sortOrder: 1,
    label: '第一番札所',
    spot: {
      id: 'spot-1',
      name: '霊山寺',
      lat: 34.0,
      lng: 134.0,
      type: 'temple',
      status: 'active',
      address: '徳島県鳴門市',
      created_by_user_id: null,
      merged_into_spot_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  },
  {
    id: 'pspot-2',
    sortOrder: 2,
    label: null,
    spot: {
      id: 'spot-2',
      name: '極楽寺',
      lat: 34.01,
      lng: 134.01,
      type: 'temple',
      status: 'active',
      address: '徳島県鳴門市',
      created_by_user_id: null,
      merged_into_spot_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  },
];

jest.mock('@services/pilgrimages', () => ({
  fetchPilgrimageSpots: jest.fn(() => Promise.resolve(mockSpots)),
}));

const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: jest.fn(),
  goBack: mockGoBack,
  getParent: jest.fn(),
} as unknown as CollectionStackScreenProps<'PilgrimageDetail'>['navigation'];

const mockRoute = {
  key: 'test',
  name: 'PilgrimageDetail' as const,
  params: {
    pilgrimageId: 'pilgrimage-1',
    pilgrimageName: '四国八十八ヶ所',
  },
} as unknown as CollectionStackScreenProps<'PilgrimageDetail'>['route'];

describe('PilgrimageDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ヘッダーに巡礼名が表示される', async () => {
    const { getByText } = render(
      <PilgrimageDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('四国八十八ヶ所')).toBeTruthy();
  });

  it('スポットカードが表示される', async () => {
    const { getAllByText } = render(
      <PilgrimageDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getAllByText('霊山寺').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('極楽寺').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('訪問済みスポットにチェックマークが表示される', async () => {
    const { getByText } = render(
      <PilgrimageDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByText('✓ 訪問済み')).toBeTruthy();
    });
  });

  it('戻るボタンが動作する', () => {
    const { getByTestId } = render(
      <PilgrimageDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    fireEvent.press(getByTestId('back-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('label がある場合はラベルが表示される', async () => {
    const { getByText } = render(
      <PilgrimageDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      expect(getByText('第一番札所')).toBeTruthy();
    });
  });

  it('進捗が表示される', async () => {
    const { getByText } = render(
      <PilgrimageDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    await waitFor(() => {
      // visitedSpotIds に spot-1 が含まれているので 1/2
      expect(getByText('1/2')).toBeTruthy();
    });
  });
});
