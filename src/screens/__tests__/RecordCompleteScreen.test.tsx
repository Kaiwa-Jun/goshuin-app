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

const mockRoute = {
  key: 'test',
  name: 'RecordComplete' as const,
  params: undefined,
};

describe('RecordCompleteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('登録完了！')).toBeTruthy();
  });

  it('renders checkmark animation', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByTestId('checkmark-animation')).toBeTruthy();
  });

  it('renders stamp image placeholder', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByTestId('stamp-image-placeholder')).toBeTruthy();
  });

  it('renders count text', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('33箇所目の御朱印！')).toBeTruthy();
  });

  it('renders badge animation', () => {
    const { getByTestId, getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByTestId('badge-animation')).toBeTruthy();
    expect(getByText('初めての御朱印')).toBeTruthy();
  });

  it('renders three action buttons', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('もう1枚記録する')).toBeTruthy();
    expect(getByText('地図を見る')).toBeTruthy();
    expect(getByText('コレクションを確認')).toBeTruthy();
  });

  it('navigates to Record on "record another" press', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );
    fireEvent.press(getByTestId('button-record-another'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Record');
  });

  it('navigates to MainTabs on "view map" press', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );
    fireEvent.press(getByTestId('button-view-map'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });

  it('navigates to Collection on "view collection" press', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRoute} />
    );
    fireEvent.press(getByTestId('button-view-collection'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'Collection',
    });
  });
});
