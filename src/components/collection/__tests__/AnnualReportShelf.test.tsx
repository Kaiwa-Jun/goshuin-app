import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AnnualReportShelf } from '@components/collection/AnnualReportShelf';
import { colors } from '@theme/colors';

const s = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style) as Record<string, unknown>;

const ITEMS = [
  { year: 2027, spots: 3, stamps: 4 },
  { year: 2026, spots: 6, stamps: 8 },
];

describe('AnnualReportShelf（あゆみの「ふりかえり」の欄）', () => {
  it('AC-48: 見出し「ふりかえり」と、年ごとの行（渡した順）', () => {
    const onPress = jest.fn();
    const ui = render(<AnnualReportShelf items={ITEMS} onPress={onPress} />);
    expect(ui.getByText('ふりかえり')).toBeTruthy();
    const rows = ui.getAllByTestId(/^ayumi-annual-row-\d+$/).map(el => el.props.testID);
    expect(rows).toEqual(['ayumi-annual-row-2027', 'ayumi-annual-row-2026']);
    const row = within(ui.getByTestId('ayumi-annual-row-2026'));
    expect(row.getByText('2026年のふりかえり')).toBeTruthy();
    expect(row.getByText('6社・8枚')).toBeTruthy();

    fireEvent.press(ui.getByTestId('ayumi-annual-row-2026'));
    expect(onPress).toHaveBeenCalledWith(2026);
  });

  it('行が無ければ何も出さない', () => {
    const ui = render(<AnnualReportShelf items={[]} onPress={jest.fn()} />);
    expect(ui.queryByTestId('ayumi-annual-section')).toBeNull();
  });

  it('見出しの見た目は渡したもの（あゆみの巡礼チャレンジと揃える）', () => {
    const ui = render(
      <AnnualReportShelf items={ITEMS} onPress={jest.fn()} titleStyle={{ fontSize: 18 }} />
    );
    expect(s(ui.getByText('ふりかえり')).fontSize).toBe(18);
  });

  it('UI-7: 行の見た目と、再生の丸 32×32・play-arrow 20', () => {
    const ui = render(<AnnualReportShelf items={ITEMS} onPress={jest.fn()} />);
    expect(s(ui.getByTestId('ayumi-annual-row-2026'))).toMatchObject({
      backgroundColor: colors.washi,
      borderRadius: 16,
      padding: 12,
    });
    const row = within(ui.getByTestId('ayumi-annual-row-2026'));
    expect(s(row.getByText('2026年のふりかえり'))).toMatchObject({
      fontSize: 14,
      fontWeight: '800',
    });
    expect(s(row.getByText('6社・8枚'))).toMatchObject({ fontSize: 12, color: colors.gray[600] });
    expect(s(ui.getByTestId('ayumi-annual-row-2026-play'))).toMatchObject({
      width: 32,
      height: 32,
      backgroundColor: colors.seal,
    });
    const icon = row.getByText('play-arrow');
    expect(icon.props.size).toBe(20);
    expect(icon.props.color).toBe(colors.white);
  });
});
