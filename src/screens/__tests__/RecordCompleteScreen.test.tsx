import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecordCompleteScreen } from '@screens/RecordCompleteScreen';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
} as any;

const mockRouteNoParams = {
  key: 'test',
  name: 'RecordComplete' as const,
  params: undefined,
};

const mockRouteWithParams = {
  key: 'test',
  name: 'RecordComplete' as const,
  params: {
    stampImageUrl: 'https://example.com/stamps/user-1/12345.jpg',
    spotName: '大崎八幡宮',
    visitCount: 5,
  },
};

describe('RecordCompleteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByText('登録完了！')).toBeTruthy();
  });

  it('renders checkmark animation', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByTestId('checkmark-animation')).toBeTruthy();
  });

  it('renders stamp image placeholder when no params', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByTestId('stamp-image-placeholder')).toBeTruthy();
  });

  it('renders default count text when no visitCount', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByText('御朱印を記録しました！')).toBeTruthy();
  });

  it('renders badge animation', () => {
    const { getByTestId, getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByTestId('badge-animation')).toBeTruthy();
    expect(getByText('初めての御朱印')).toBeTruthy();
  });

  it('renders three action buttons', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByText('もう1枚記録する')).toBeTruthy();
    expect(getByText('地図を見る')).toBeTruthy();
    expect(getByText('コレクションを確認')).toBeTruthy();
  });

  it('navigates to Record on "record another" press', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    fireEvent.press(getByTestId('button-record-another'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Record');
  });

  it('navigates to MainTabs on "view map" press', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    fireEvent.press(getByTestId('button-view-map'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });

  it('navigates to Collection on "view collection" press', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    fireEvent.press(getByTestId('button-view-collection'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'Collection',
    });
  });

  describe('with params', () => {
    it('renders stamp image when stampImageUrl is provided', () => {
      const { getByTestId } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithParams} />
      );
      expect(getByTestId('stamp-image')).toBeTruthy();
    });

    it('renders spot name when provided', () => {
      const { getByText } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithParams} />
      );
      expect(getByText('大崎八幡宮')).toBeTruthy();
    });

    it('renders visit count text when visitCount is provided', () => {
      const { getByText } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithParams} />
      );
      expect(getByText('5箇所目の御朱印！')).toBeTruthy();
    });
  });
});
