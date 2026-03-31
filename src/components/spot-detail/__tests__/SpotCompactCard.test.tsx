import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SpotCompactCard } from '../SpotCompactCard';
import type { Spot } from '@/types/supabase';

const mockShrine: Spot = {
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

const mockTemple: Spot = {
  ...mockShrine,
  id: 'spot-2',
  name: '瑞巌寺',
  type: 'temple',
  address: '宮城県宮城郡松島町松島字町内91',
};

describe('SpotCompactCard', () => {
  const defaultProps = {
    spot: mockShrine,
    isVisited: false,
  };

  it('renders spot name', () => {
    const { getByText } = render(<SpotCompactCard {...defaultProps} />);
    expect(getByText('仙台東照宮')).toBeTruthy();
  });

  it('renders shrine badge for shrine type', () => {
    const { getByTestId } = render(<SpotCompactCard {...defaultProps} />);
    expect(getByTestId('badge-shrine')).toBeTruthy();
  });

  it('renders temple badge for temple type', () => {
    const { getByTestId } = render(<SpotCompactCard {...defaultProps} spot={mockTemple} />);
    expect(getByTestId('badge-temple')).toBeTruthy();
  });

  it('renders address', () => {
    const { getByText } = render(<SpotCompactCard {...defaultProps} />);
    expect(getByText('宮城県仙台市青葉区東照宮一丁目6-1')).toBeTruthy();
  });

  it('renders visited badge when isVisited is true', () => {
    const { getByTestId } = render(<SpotCompactCard {...defaultProps} isVisited={true} />);
    expect(getByTestId('badge-visited')).toBeTruthy();
  });

  it('does not render visited badge when isVisited is false', () => {
    const { queryByTestId } = render(<SpotCompactCard {...defaultProps} isVisited={false} />);
    expect(queryByTestId('badge-visited')).toBeNull();
  });

  it('handles null address gracefully', () => {
    const spotNoAddress = { ...mockShrine, address: null };
    const { queryByTestId } = render(<SpotCompactCard {...defaultProps} spot={spotNoAddress} />);
    expect(queryByTestId('spot-compact-address')).toBeNull();
  });

  it('renders wishlist button when props are provided', () => {
    const onWishlistPress = jest.fn();
    const { getByTestId } = render(
      <SpotCompactCard {...defaultProps} isWishlisted={false} onWishlistPress={onWishlistPress} />
    );
    expect(getByTestId('wishlist-button')).toBeTruthy();
  });

  it('does not render wishlist button when props are not provided', () => {
    const { queryByTestId } = render(<SpotCompactCard {...defaultProps} />);
    expect(queryByTestId('wishlist-button')).toBeNull();
  });

  it('calls onWishlistPress when wishlist button is tapped', () => {
    const onWishlistPress = jest.fn();
    const { getByTestId } = render(
      <SpotCompactCard {...defaultProps} isWishlisted={false} onWishlistPress={onWishlistPress} />
    );
    fireEvent.press(getByTestId('wishlist-button'));
    expect(onWishlistPress).toHaveBeenCalledTimes(1);
  });
});
