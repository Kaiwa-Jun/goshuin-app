import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { RegionSpotSheet, sortRegionSpots } from '@components/map/RegionSpotSheet';
import type { Spot } from '@/types/supabase';
import { colors } from '@theme/colors';

function makeSpot(overrides: Partial<Spot> & Pick<Spot, 'id'>): Spot {
  return {
    name: `寺社${overrides.id}`,
    type: 'shrine',
    lat: 35.45,
    lng: 139.63,
    rank: 3,
    status: 'active',
    address: '神奈川県横浜市西区1',
    prefecture: '神奈川県',
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Spot;
}

const spots = [
  makeSpot({ id: 'y3', name: '菊名神社', rank: 3, lat: 35.5103, lng: 139.6302 }),
  makeSpot({ id: 'y1', name: '成田山横浜別院延命院', type: 'temple', rank: 4 }),
  makeSpot({ id: 'y2', name: '伊勢山皇大神宮', rank: 5, address: null }),
];

function renderSheet(props: Partial<React.ComponentProps<typeof RegionSpotSheet>> = {}) {
  return render(
    <RegionSpotSheet
      label="横浜"
      spots={spots}
      origin={null}
      reduceMotion={false}
      onSelectSpot={jest.fn()}
      {...props}
    />
  );
}

describe('RegionSpotSheet（Issue #311 の寄せた地図の下の一覧）', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('見出しは「{label}のあたりの寺社（{count}）」、行は rank の高い順', () => {
    const r = renderSheet();

    expect(r.getByText('横浜のあたりの寺社（3）')).toBeTruthy();
    expect(within(r.getByTestId('region-spot-0')).getByText('伊勢山皇大神宮')).toBeTruthy();
    expect(within(r.getByTestId('region-spot-1')).getByText('成田山横浜別院延命院')).toBeTruthy();
    expect(within(r.getByTestId('region-spot-2')).getByText('菊名神社')).toBeTruthy();
  });

  it('行には住所（1行）。住所の無い寺社でも落ちない', () => {
    const r = renderSheet();
    const address = within(r.getByTestId('region-spot-1')).getByText('神奈川県横浜市西区1');

    expect(address.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(address.props.style).color).toBe(colors.gray[500]);
  });

  it('神社・寺院のアイコンは今の検索の行と同じ色', () => {
    const r = renderSheet();

    expect(within(r.getByTestId('region-spot-0')).getByText('temple-hindu').props.color).toBe(
      colors.shrine[600]
    );
    expect(within(r.getByTestId('region-spot-1')).getByText('temple-buddhist').props.color).toBe(
      colors.temple[600]
    );
  });

  it('行を押すと、その寺社を選ぶ', () => {
    const onSelectSpot = jest.fn();
    const r = renderSheet({ onSelectSpot });

    fireEvent.press(r.getByTestId('region-spot-2'));

    expect(onSelectSpot).toHaveBeenCalledWith('y3');
  });

  it('高さを知らせる（地図の下の空け方に使う）', () => {
    const onLayout = jest.fn();
    const r = renderSheet({ onLayout });

    fireEvent(r.getByTestId('region-sheet'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 280 } },
    });

    expect(onLayout).toHaveBeenCalledWith(280);
  });

  it('下から 300ms で出る。「視差効果を減らす」なら動かさない', () => {
    const timing = jest.spyOn(Animated, 'timing');
    renderSheet();
    expect(timing).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({ toValue: 0, duration: 300 })
    );

    timing.mockClear();
    renderSheet({ reduceMotion: true });
    expect(timing).not.toHaveBeenCalled();
  });
});

describe('sortRegionSpots', () => {
  const a = makeSpot({ id: 'a', name: 'い', rank: 3, lat: 35.0, lng: 139.0 });
  const b = makeSpot({ id: 'b', name: 'あ', rank: 3, lat: 35.1, lng: 139.0 });
  const c = makeSpot({ id: 'c', name: 'う', rank: 5, lat: 36.0, lng: 139.0 });

  it('rank の高い順、同じなら今いる所から近い順', () => {
    const origin = { latitude: 35.11, longitude: 139.0 };
    expect(sortRegionSpots([a, b, c], origin).map(s => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('現在地が無ければ、同じ rank は名前順', () => {
    expect(sortRegionSpots([a, b, c], null).map(s => s.id)).toEqual(['c', 'b', 'a']);
    const d = makeSpot({ id: 'd', name: 'え', rank: 3 });
    expect(sortRegionSpots([d, a], null).map(s => s.id)).toEqual(['a', 'd']);
  });

  it('入力の配列を並べ替えない', () => {
    const input = [a, b, c];
    sortRegionSpots(input, null);
    expect(input.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });
});
