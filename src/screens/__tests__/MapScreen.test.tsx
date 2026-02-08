import React from 'react';
import { render } from '@testing-library/react-native';
import { MapScreen } from '@screens/MapScreen';

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

const mockRoute = { key: 'test', name: 'Map' as const, params: undefined };

describe('MapScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('map-screen')).toBeTruthy();
  });

  it('displays search bar', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('search-bar')).toBeTruthy();
  });

  it('displays filter button', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('filter-button')).toBeTruthy();
  });

  it('displays map area placeholder', () => {
    const { getByTestId, getByText } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('map-area')).toBeTruthy();
    expect(getByText('地図エリア')).toBeTruthy();
  });

  it('displays FAB button', () => {
    const { getByTestId } = render(
      <MapScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('fab-button')).toBeTruthy();
  });
});
