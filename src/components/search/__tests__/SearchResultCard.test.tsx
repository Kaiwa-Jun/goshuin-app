import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchResultCard } from '../SearchResultCard';
import { Spot } from '@/types/supabase';

const shrineSpot: Spot = {
  id: '1',
  name: '仙台東照宮',
  lat: 38.268,
  lng: 140.869,
  type: 'shrine',
  address: '宮城県仙台市青葉区東照宮1-6-1',
  prefecture: null,
  status: 'active',
  rank: 3,
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const templeSpot: Spot = {
  ...shrineSpot,
  id: '2',
  name: '輪王寺',
  type: 'temple',
};

describe('SearchResultCard', () => {
  it('スポット名が表示される', () => {
    const { getByText } = render(
      <SearchResultCard spot={shrineSpot} distance={0.5} query="" onPress={jest.fn()} />
    );
    expect(getByText('仙台東照宮')).toBeTruthy();
  });

  it('住所が表示される', () => {
    const { getByText } = render(
      <SearchResultCard spot={shrineSpot} distance={0.5} query="" onPress={jest.fn()} />
    );
    expect(getByText('宮城県仙台市青葉区東照宮1-6-1')).toBeTruthy();
  });

  it('距離が正しくフォーマットされる（500m）', () => {
    const { getByText } = render(
      <SearchResultCard spot={shrineSpot} distance={0.5} query="" onPress={jest.fn()} />
    );
    expect(getByText('500m')).toBeTruthy();
  });

  it('距離が正しくフォーマットされる（1.5km）', () => {
    const { getByText } = render(
      <SearchResultCard spot={shrineSpot} distance={1.5} query="" onPress={jest.fn()} />
    );
    expect(getByText('1.5km')).toBeTruthy();
  });

  it('タップで onPress が呼ばれる', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SearchResultCard spot={shrineSpot} distance={0.5} query="" onPress={onPress} />
    );
    fireEvent.press(getByTestId('search-result-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('query に一致する部分がハイライトされる', () => {
    const { getByTestId } = render(
      <SearchResultCard spot={shrineSpot} distance={0.5} query="東照" onPress={jest.fn()} />
    );
    expect(getByTestId('highlight-東照')).toBeTruthy();
  });

  it('shrine のとき shrine アイコンコンテナが表示される', () => {
    const { getByTestId } = render(
      <SearchResultCard spot={shrineSpot} distance={0.5} query="" onPress={jest.fn()} />
    );
    expect(getByTestId('spot-icon-shrine')).toBeTruthy();
  });

  it('temple のとき temple アイコンコンテナが表示される', () => {
    const { getByTestId } = render(
      <SearchResultCard spot={templeSpot} distance={0.5} query="" onPress={jest.fn()} />
    );
    expect(getByTestId('spot-icon-temple')).toBeTruthy();
  });
});
