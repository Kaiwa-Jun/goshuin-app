import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StampDetailScreen } from '@screens/StampDetailScreen';

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
  name: 'StampDetail' as const,
  params: { stampId: '1' },
};

describe('StampDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('御朱印詳細')).toBeTruthy();
  });

  it('renders stamp image area', () => {
    const { getByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByTestId('stamp-image')).toBeTruthy();
  });

  it('renders spot name', () => {
    const { getByText } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('明治神宮')).toBeTruthy();
  });

  it('renders shrine badge', () => {
    const { getByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByTestId('badge-shrine')).toBeTruthy();
  });

  it('renders visit date', () => {
    const { getByText } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('2024年1月15日')).toBeTruthy();
  });

  it('renders memo section', () => {
    const { getByText } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('メモ')).toBeTruthy();
    expect(getByText('初めての御朱印。天気が良くて気持ちの良い参拝でした。')).toBeTruthy();
  });

  it('navigates back on back button press', () => {
    const { getByTestId } = render(
      <StampDetailScreen navigation={mockNavigation} route={mockRoute} />
    );
    fireEvent.press(getByTestId('back-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});
