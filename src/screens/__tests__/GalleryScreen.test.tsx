import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GalleryScreen } from '@screens/GalleryScreen';

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
  name: 'Gallery' as const,
  params: undefined,
};

describe('GalleryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('ギャラリー')).toBeTruthy();
  });

  it('renders sort button', () => {
    const { getByTestId } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByTestId('sort-button')).toBeTruthy();
  });

  it('toggles sort label on press', () => {
    const { getByTestId, getByText } = render(
      <GalleryScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('日付順 ▼')).toBeTruthy();
    fireEvent.press(getByTestId('sort-button'));
    expect(getByText('スポット順 ▼')).toBeTruthy();
  });

  it('renders gallery list', () => {
    const { getByTestId } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByTestId('gallery-list')).toBeTruthy();
  });

  it('renders mock gallery items', () => {
    const { getByText } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('明治神宮')).toBeTruthy();
    expect(getByText('浅草寺')).toBeTruthy();
  });

  it('navigates to StampDetail on item press', () => {
    const { getByTestId } = render(<GalleryScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByTestId('gallery-item-1'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('StampDetail', { stampId: '1' });
  });
});
