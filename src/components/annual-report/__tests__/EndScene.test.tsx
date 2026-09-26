import { fireEvent, render, within } from '@testing-library/react-native';

import { EndScene } from '@components/annual-report/scenes/EndScene';
import { colors } from '@theme/colors';

import {
  asPayload,
  at,
  fullReport,
  newClock,
  paintOf,
  styleOf,
  transformOf,
} from './sceneTestUtils';

function setup() {
  const clock = newClock();
  const onAgain = jest.fn();
  const onClose = jest.fn();
  const ui = render(
    <EndScene report={fullReport()} clock={clock} onAgain={onAgain} onClose={onClose} />
  );
  const s = (id: string) => styleOf(ui.getByTestId(id));
  const tf = (id: string) => transformOf(ui.getByTestId(id));
  return { ui, clock, s, tf, onAgain, onClose };
}

describe('EndScene（AC-44）', () => {
  it('字とまとめのカード、地図、ボタン', () => {
    const { ui } = setup();
    expect(ui.getByText('来年も、よい参拝を。')).toBeTruthy();
    const card = within(ui.getByTestId('annual-end-card'));
    expect(card.getByText('2026')).toBeTruthy();
    expect(card.getByText('24社')).toBeTruthy();
    expect(card.getByText('31枚')).toBeTruthy();
    expect(card.getByText('6県')).toBeTruthy();
    expect(ui.getByTestId('annual-end-map')).toBeTruthy();
    expect(ui.getByText('もう一度見る')).toBeTruthy();
    expect(ui.getByText('閉じる')).toBeTruthy();
  });

  it('見出し・カード・ボタンの順に出る', () => {
    const { clock, s, tf } = setup();
    at(clock, 0);
    expect(s('annual-end-title').opacity).toBeCloseTo(0);
    at(clock, 700);
    expect(s('annual-end-title').opacity).toBeCloseTo(1);

    at(clock, 400);
    expect(s('annual-end-card').opacity).toBeCloseTo(0);
    expect(tf('annual-end-card').translateY).toBeCloseTo(40);
    expect(tf('annual-end-card').scale).toBeCloseTo(0.96);
    at(clock, 1200);
    expect(s('annual-end-card').opacity).toBeCloseTo(1);
    expect(tf('annual-end-card').translateY).toBeCloseTo(0);
    expect(tf('annual-end-card').scale).toBeCloseTo(1);

    at(clock, 1100);
    expect(s('annual-end-buttons').opacity).toBeCloseTo(0);
    at(clock, 1700);
    expect(s('annual-end-buttons').opacity).toBeCloseTo(1);
  });

  it('もう一度見る・閉じる', () => {
    const { ui, onAgain, onClose } = setup();
    fireEvent.press(ui.getByText('もう一度見る'));
    expect(onAgain).toHaveBeenCalledTimes(1);
    fireEvent.press(ui.getByText('閉じる'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('UI-4: 締めの地図は、まだの県が prefectureFill.empty・境目が border、行った県は濃さの色', () => {
    const { ui } = setup();
    const empty = ui.getByTestId('annual-end-map-北海道');
    expect(paintOf(empty, 'fill')).toBe(asPayload(colors.prefectureFill.empty));
    expect(paintOf(empty, 'stroke')).toBe(asPayload(colors.prefectureFill.border));
    expect(empty.props.strokeWidth).toBe(3);
    expect(paintOf(ui.getByTestId('annual-end-map-宮城県'), 'fill')).toBe(
      asPayload(colors.prefectureFill.tier3)
    );
    expect(paintOf(ui.getByTestId('annual-end-map-東京都'), 'fill')).toBe(
      asPayload(colors.prefectureFill.tier2)
    );
  });

  it('UI-5・UI-6: カードとボタンの見た目', () => {
    const { ui, s } = setup();
    expect(s('annual-end-card')).toMatchObject({
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 16,
    });
    expect(s('annual-end-again')).toMatchObject({
      backgroundColor: colors.seal,
      height: 48,
      borderRadius: 14,
    });
    expect(styleOf(ui.getByText('もう一度見る'))).toMatchObject({
      color: colors.white,
      fontSize: 16,
      fontWeight: '800',
    });
    expect(s('annual-end-close')).toMatchObject({
      borderWidth: 1,
      borderColor: colors.gray[300],
    });
    expect(styleOf(ui.getByText('閉じる')).color).toBe(colors.gray[900]);
  });
});
