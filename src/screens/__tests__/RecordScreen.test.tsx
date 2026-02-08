import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecordScreen } from '@screens/RecordScreen';

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
  name: 'Record' as const,
  params: undefined,
};

describe('RecordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('renders spot selector with placeholder', () => {
    const { getByText, getByTestId } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByTestId('spot-selector')).toBeTruthy();
    expect(getByText('スポットを選択')).toBeTruthy();
  });

  it('renders photo area', () => {
    const { getByTestId, getByText } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByTestId('photo-area')).toBeTruthy();
    expect(getByText('御朱印の写真を追加')).toBeTruthy();
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

  it('selects spot on spot selector press', () => {
    const { getByTestId, getByText } = render(
      <RecordScreen navigation={mockNavigation} route={mockRoute} />
    );
    fireEvent.press(getByTestId('spot-selector'));
    expect(getByText('明治神宮')).toBeTruthy();
  });
});
