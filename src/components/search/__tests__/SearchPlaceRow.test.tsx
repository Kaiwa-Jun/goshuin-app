import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SearchPlaceRow } from '@components/search/SearchPlaceRow';
import type { PlaceRow } from '@utils/placeSearch';

const row: PlaceRow = {
  kind: 'place',
  key: 'area:神奈川県',
  label: '横浜',
  prefecture: '神奈川県',
  count: 3,
  region: {
    label: '横浜',
    bounds: [139.6267, 35.4497, 139.6302, 35.5103],
    spotIds: ['y3', 'y1', 'y2'],
  },
  external: false,
};

describe('SearchPlaceRow（Issue #311 の場所の帯）', () => {
  it('帯全体が1つのボタンで、読み上げは「{label}のあたりを地図で見る」', () => {
    const { getByTestId } = render(<SearchPlaceRow row={row} testID="band" onPress={jest.fn()} />);
    const band = getByTestId('band');

    expect(band.props.accessibilityRole).toBe('button');
    expect(band.props.accessibilityLabel).toBe('横浜のあたりを地図で見る');
  });

  it('押すと onPress', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<SearchPlaceRow row={row} testID="band" onPress={onPress} />);

    fireEvent.press(getByTestId('band'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('県が無いまとまりは「寺社 {count}」だけ', () => {
    const { getByText, queryByText } = render(
      <SearchPlaceRow row={{ ...row, prefecture: null }} testID="band" onPress={jest.fn()} />
    );

    expect(getByText('寺社 3')).toBeTruthy();
    expect(queryByText(/神奈川県/)).toBeNull();
  });
});
