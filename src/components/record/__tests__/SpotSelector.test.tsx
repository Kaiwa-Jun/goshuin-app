import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SpotSelector } from '../SpotSelector';
import type { Spot } from '@/types/supabase';

const makeSpot = (overrides: Partial<Spot> = {}): Spot => ({
  id: 'spot-1',
  name: '仙台東照宮',
  lat: 38.2682,
  lng: 140.8694,
  type: 'shrine',
  address: '仙台市青葉区',
  status: 'active',
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
});

const nearbySpots = [
  { spot: makeSpot(), distanceKm: 0.5 },
  { spot: makeSpot({ id: 'spot-2', name: '大崎八幡宮', type: 'shrine' }), distanceKm: 1.2 },
  { spot: makeSpot({ id: 'spot-3', name: '瑞鳳殿', type: 'temple' }), distanceKm: 2.0 },
];

describe('SpotSelector', () => {
  const mockOnSelectSpot = jest.fn();
  const mockOnSearchQueryChange = jest.fn();
  const mockOnAddSpotPress = jest.fn();

  const defaultProps = {
    selectedSpot: null,
    nearbySpots,
    searchQuery: '',
    onSearchQueryChange: mockOnSearchQueryChange,
    onSelectSpot: mockOnSelectSpot,
    onAddSpotPress: mockOnAddSpotPress,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('未選択時に検索バーが表示される', () => {
    const { getByPlaceholderText } = render(<SpotSelector {...defaultProps} />);

    expect(getByPlaceholderText('スポット名で検索')).toBeTruthy();
  });

  it('選択済みスポット名表示', () => {
    const { getByText } = render(<SpotSelector {...defaultProps} selectedSpot={makeSpot()} />);

    expect(getByText('仙台東照宮')).toBeTruthy();
  });

  it('検索バーフォーカスで候補ドロップダウンが開く', () => {
    const { getByPlaceholderText, getByText } = render(<SpotSelector {...defaultProps} />);

    fireEvent(getByPlaceholderText('スポット名で検索'), 'focus');

    expect(getByText('仙台東照宮')).toBeTruthy();
    expect(getByText('大崎八幡宮')).toBeTruthy();
  });

  it('スポットをタップすると onSelectSpot 呼出', () => {
    const { getByPlaceholderText, getByText } = render(<SpotSelector {...defaultProps} />);

    fireEvent(getByPlaceholderText('スポット名で検索'), 'focus');
    fireEvent.press(getByText('仙台東照宮'));

    expect(mockOnSelectSpot).toHaveBeenCalledWith(nearbySpots[0].spot);
  });

  it('「追加」リンクタップで onAddSpotPress 呼出', () => {
    const { getByPlaceholderText, getByText } = render(<SpotSelector {...defaultProps} />);

    fireEvent(getByPlaceholderText('スポット名で検索'), 'focus');
    fireEvent.press(getByText('スポットが見つからない場合は追加'));

    expect(mockOnAddSpotPress).toHaveBeenCalled();
  });
});
