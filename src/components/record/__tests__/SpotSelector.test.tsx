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
  prefecture: null,
  status: 'active',
  rank: 3,
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

describe('都道府県の表示', () => {
  // 白山神社が4件、日枝神社が3件など、同名のスポットが 27 種 60 件ある。
  // 名前と距離だけでは、どの県のものか判別できない
  const props = {
    selectedSpot: null,
    nearbySpots,
    searchQuery: '',
    onSearchQueryChange: jest.fn(),
    onSelectSpot: jest.fn(),
    onAddSpotPress: jest.fn(),
    error: null,
  };

  const openDropdown = (spots: typeof nearbySpots) => {
    const r = render(<SpotSelector {...props} nearbySpots={spots} />);
    fireEvent(r.getByPlaceholderText('スポット名で検索'), 'focus');
    return r;
  };

  it('候補に都道府県を出す', () => {
    const r = openDropdown([
      { spot: makeSpot({ name: '白山神社', prefecture: '岩手県' }), distanceKm: 0.5 },
    ]);

    expect(r.getByText('岩手県')).toBeTruthy();
  });

  it('同名でも県で見分けられる', () => {
    const r = openDropdown([
      { spot: makeSpot({ id: 'a', name: '白山神社', prefecture: '岩手県' }), distanceKm: 0.5 },
      { spot: makeSpot({ id: 'b', name: '白山神社', prefecture: '新潟県' }), distanceKm: 1.2 },
    ]);

    expect(r.getAllByText('白山神社')).toHaveLength(2);
    expect(r.getByText('岩手県')).toBeTruthy();
    expect(r.getByText('新潟県')).toBeTruthy();
  });

  it('都道府県が無いスポットでも落ちない', () => {
    const r = openDropdown([
      { spot: makeSpot({ name: '名無し神社', prefecture: null }), distanceKm: 0.5 },
    ]);

    expect(r.getByText('名無し神社')).toBeTruthy();
  });
});
