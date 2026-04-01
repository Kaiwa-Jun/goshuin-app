import React from 'react';
import { render } from '@testing-library/react-native';
import { SpotBottomSheet } from '../SpotBottomSheet';
import type { Spot } from '@/types/supabase';

jest.mock('@services/stamps', () => ({
  fetchStampsBySpotId: jest.fn(() => Promise.resolve([])),
  getStampImageUrl: jest.fn((path: string) => `https://example.com/${path}`),
}));

const mockSpot: Spot = {
  id: 'spot-1',
  name: '仙台東照宮',
  lat: 38.28,
  lng: 140.88,
  type: 'shrine',
  address: '宮城県仙台市青葉区東照宮一丁目6-1',
  status: 'active',
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

jest.mock('@hooks/useSpotDetail', () => ({
  useSpotDetail: (spotId: string | null) => ({
    spot: spotId === 'spot-1' ? mockSpot : null,
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@hooks/useSpotStamps', () => ({
  useSpotStamps: () => ({
    stamps: [],
    publicStamps: [],
    visitCount: 2,
    latestVisitDate: '2024-06-15',
    isLoading: false,
  }),
}));

jest.mock('@hooks/useSpotInfo', () => ({
  useSpotInfo: () => ({
    spotInfo: null,
    isLoading: false,
  }),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'user-1' },
  }),
}));

describe('SpotBottomSheet', () => {
  const defaultProps = {
    spotId: 'spot-1' as string | null,
    visitedSpotIds: new Set(['spot-1']),
    onDismiss: jest.fn(),
    onRecord: jest.fn(),
    wishlistSpotIds: new Set<string>(),
    onWishlistToggle: jest.fn(),
  };

  it('renders bottom sheet when spotId is provided', () => {
    const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
    expect(getByTestId('bottom-sheet')).toBeTruthy();
  });

  it('does not render when spotId is null', () => {
    const { queryByTestId } = render(<SpotBottomSheet {...defaultProps} spotId={null} />);
    expect(queryByTestId('bottom-sheet')).toBeNull();
  });

  it('renders spot name', () => {
    const { getAllByText } = render(<SpotBottomSheet {...defaultProps} />);
    expect(getAllByText('仙台東照宮').length).toBeGreaterThanOrEqual(1);
  });

  it('renders shrine badge', () => {
    const { getAllByTestId } = render(<SpotBottomSheet {...defaultProps} />);
    expect(getAllByTestId('badge-shrine').length).toBeGreaterThanOrEqual(1);
  });

  it('renders visited badge when spot is visited', () => {
    const { getAllByTestId } = render(<SpotBottomSheet {...defaultProps} />);
    const visitedBadges = getAllByTestId('badge-visited');
    expect(visitedBadges.length).toBeGreaterThanOrEqual(1);
  });
});
