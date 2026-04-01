import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Image } from 'react-native';
import { SpotDetailContent } from '../SpotDetailContent';
import type { Spot, PublicStampWithUser } from '@/types/supabase';

jest
  .spyOn(Image, 'getSize')
  .mockImplementation((_uri: string, success: (width: number, height: number) => void) => {
    success(800, 1200);
  });

jest.mock('react-native-maps', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
  };
});

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://example.com/${path}`,
}));

const mockSpot: Spot = {
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

const mockPublicStamps: PublicStampWithUser[] = [
  {
    id: 'ps-1',
    user_id: 'other-user-1',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-05-01',
    image_path: 'other-user-1/stamp1.jpg',
    memo: '天気がよかった',
    is_public: true,
    extracted_info: null,
    created_at: '2024-05-01T00:00:00Z',
    updated_at: '2024-05-01T00:00:00Z',
    profiles: {
      display_name: 'ユーザーA',
      avatar_url: null,
    },
  },
  {
    id: 'ps-2',
    user_id: 'other-user-2',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-06-01',
    image_path: 'other-user-2/stamp2.jpg',
    memo: null,
    is_public: true,
    extracted_info: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    profiles: {
      display_name: 'ユーザーB',
      avatar_url: null,
    },
  },
];

const defaultProps = {
  spot: mockSpot,
  stamps: [],
  visitCount: 0,
  latestVisitDate: null,
  isAuthenticated: true,
  onRecord: jest.fn(),
  showMiniMap: false,
};

describe('SpotDetailContent - みんなの御朱印', () => {
  it('publicStamps がある場合グリッドに表示されること', () => {
    const { getByTestId } = render(
      <SpotDetailContent {...defaultProps} publicStamps={mockPublicStamps} />
    );
    expect(getByTestId('public-stamp-image-ps-1')).toBeTruthy();
    expect(getByTestId('public-stamp-image-ps-2')).toBeTruthy();
  });

  it('publicStamps が空の場合、自分のstampsもなければグリッド非表示', () => {
    const { queryByTestId } = render(
      <SpotDetailContent {...defaultProps} stamps={[]} publicStamps={[]} />
    );
    expect(queryByTestId('stamp-grid')).toBeNull();
  });

  it('画像タップでギャラリーモーダルが開くこと', () => {
    const { getByTestId } = render(
      <SpotDetailContent {...defaultProps} publicStamps={mockPublicStamps} />
    );
    fireEvent.press(getByTestId('public-stamp-image-ps-1'));
    expect(getByTestId('gallery-image')).toBeTruthy();
  });
});
