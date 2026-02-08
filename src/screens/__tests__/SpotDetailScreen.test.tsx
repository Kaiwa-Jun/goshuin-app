import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SpotDetailScreen } from '@screens/SpotDetailScreen';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
      React.createElement(View, props, children),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(),
  canGoBack: jest.fn(),
  getId: jest.fn(),
  getState: jest.fn(),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  pop: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  popTo: jest.fn(),
  popToTop: jest.fn(),
};

const mockRoute = {
  key: 'test',
  name: 'SpotDetail' as const,
  params: { spotId: 'test-spot-1' },
};

describe('SpotDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('spot-detail-screen')).toBeTruthy();
  });

  it('displays back button', () => {
    const { getByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('back-button')).toBeTruthy();
  });

  it('displays header title', () => {
    const { getByText } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('スポット詳細')).toBeTruthy();
  });

  it('displays spot name', () => {
    const { getByText } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('大崎八幡宮')).toBeTruthy();
  });

  it('displays badges', () => {
    const { getByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('badge-shrine')).toBeTruthy();
    expect(getByTestId('badge-visited')).toBeTruthy();
  });

  it('displays visit info card', () => {
    const { getByText } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('訪問回数')).toBeTruthy();
    expect(getByText('3回')).toBeTruthy();
    expect(getByText('最終訪問')).toBeTruthy();
  });

  it('displays record button', () => {
    const { getByText } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('ここで記録する')).toBeTruthy();
  });

  it('displays mini map', () => {
    const { getByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('mini-map')).toBeTruthy();
  });

  it('navigates back when back button is pressed', () => {
    const { getByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByTestId('back-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('displays stamp items', () => {
    const { getAllByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    const stamps = getAllByTestId('stamp-item');
    expect(stamps.length).toBe(4);
  });
});
