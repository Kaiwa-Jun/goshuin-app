import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AnnualReportCard } from '@components/collection/AnnualReportCard';
import { colors } from '@theme/colors';

const s = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style) as Record<string, unknown>;

describe('AnnualReportCard（あゆみの12月のカード）', () => {
  const setup = () => {
    const onPress = jest.fn();
    const ui = render(
      <AnnualReportCard summary={{ year: 2026, spots: 6, stamps: 8 }} onPress={onPress} />
    );
    return { ui, onPress };
  };

  it('AC-47: 字と、押すと開く', () => {
    const { ui, onPress } = setup();
    expect(ui.getByText('12月の特別編')).toBeTruthy();
    expect(ui.getByText('2026年のふりかえり')).toBeTruthy();
    expect(ui.getByText('6社・8枚の一年を、動くふりかえりで')).toBeTruthy();
    fireEvent.press(ui.getByLabelText('2026年のふりかえりを見る'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('UI-7: 地・字・再生の丸', () => {
    const { ui } = setup();
    expect(s(ui.getByTestId('ayumi-annual-card'))).toMatchObject({
      backgroundColor: colors.washi,
      borderRadius: 18,
      padding: 16,
    });
    expect(s(ui.getByText('12月の特別編'))).toMatchObject({
      fontSize: 11.5,
      fontWeight: '800',
      color: colors.seal,
    });
    expect(s(ui.getByText('2026年のふりかえり'))).toMatchObject({
      fontSize: 17,
      fontWeight: '800',
    });
    expect(s(ui.getByText('6社・8枚の一年を、動くふりかえりで'))).toMatchObject({
      fontSize: 12.5,
      color: colors.gray[600],
    });
    expect(s(ui.getByTestId('ayumi-annual-card-play'))).toMatchObject({
      width: 44,
      height: 44,
      backgroundColor: colors.seal,
    });
    const icon = ui.getByText('play-arrow');
    expect(icon.props.size).toBe(26);
    expect(icon.props.color).toBe(colors.white);
  });
});
