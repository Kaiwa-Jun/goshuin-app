import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SpotDetailScreen } from '@screens/SpotDetailScreen';
import type { Spot } from '@/types/supabase';

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

const defaultSpot: Spot = {
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

let mockUseSpotDetailReturn: {
  spot: Spot | null;
  isLoading: boolean;
  error: string | null;
} = {
  spot: defaultSpot,
  isLoading: false,
  error: null,
};

jest.mock('@hooks/useSpotDetail', () => ({
  useSpotDetail: () => mockUseSpotDetailReturn,
}));

const mockParentNavigate = jest.fn();
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: mockParentNavigate })),
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
  params: { spotId: 'spot-1' },
};

describe('SpotDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSpotDetailReturn = {
      spot: defaultSpot,
      isLoading: false,
      error: null,
    };
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
    expect(getByTestId('header-back-button')).toBeTruthy();
  });

  it('displays header title', () => {
    const { getByText } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByText('スポット詳細')).toBeTruthy();
  });

  it('displays spot name from data', () => {
    const { getByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('spot-name').props.children).toBe('大崎八幡宮');
  });

  it('displays different spot name for different data', () => {
    mockUseSpotDetailReturn = {
      ...mockUseSpotDetailReturn,
      spot: {
        ...mockUseSpotDetailReturn.spot!,
        id: 'spot-2',
        name: '瑞鳳殿',
        type: 'temple',
      },
    };

    const { getByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('spot-name').props.children).toBe('瑞鳳殿');
  });

  it('displays shrine badge for shrine type', () => {
    const { getByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('badge-shrine')).toBeTruthy();
  });

  it('displays temple badge for temple type', () => {
    mockUseSpotDetailReturn = {
      ...mockUseSpotDetailReturn,
      spot: {
        ...mockUseSpotDetailReturn.spot!,
        type: 'temple',
      },
    };

    const { getByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('badge-temple')).toBeTruthy();
  });

  it('displays address when available', () => {
    const { getAllByText } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getAllByText('宮城県仙台市青葉区八幡4-6-1').length).toBeGreaterThanOrEqual(1);
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
    fireEvent.press(getByTestId('header-back-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    mockUseSpotDetailReturn = {
      ...mockUseSpotDetailReturn,
      spot: null,
      isLoading: true,
    };

    const { getByTestId } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('spot-detail-loading')).toBeTruthy();
  });

  it('shows error state', () => {
    mockUseSpotDetailReturn = {
      spot: null,
      isLoading: false,
      error: 'スポットが見つかりません',
    };

    const { getByTestId, getByText } = render(
      <SpotDetailScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('spot-detail-error')).toBeTruthy();
    expect(getByText('スポットが見つかりません')).toBeTruthy();
  });
});
