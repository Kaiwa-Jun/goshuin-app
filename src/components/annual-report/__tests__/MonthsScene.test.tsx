import { render } from '@testing-library/react-native';

import { MonthsScene } from '@components/annual-report/scenes/MonthsScene';
import { colors } from '@theme/colors';

import { at, fullReport, newClock, styleOf, transformOf } from './sceneTestUtils';

function setup() {
  const clock = newClock();
  const ui = render(<MonthsScene report={fullReport()} clock={clock} />);
  const s = (id: string) => styleOf(ui.getByTestId(id));
  const h = (month: number) => Number(s(`annual-month-bar-${month}`).height);
  return { ui, clock, s, h };
}

describe('MonthsScene（AC-38）', () => {
  it('字が出る', () => {
    const { ui } = setup();
    expect(ui.getByText('月ごとの参拝')).toBeTruthy();
    expect(ui.getByText('5月が、いちばん')).toBeTruthy();
    expect(ui.getByText('よく参った月')).toBeTruthy();
    expect(ui.getByText('7枚の御朱印')).toBeTruthy();
  });

  it('棒の高さは枚数の割合（いちばん多い月が 230）。0枚の月は 3%', () => {
    const { clock, h } = setup();
    at(clock, 3000);
    expect(h(5)).toBeCloseTo(230);
    expect(Math.abs(h(1) - 65.7)).toBeLessThan(0.5);
    expect(Math.abs(h(2) - 6.9)).toBeLessThan(0.5);
  });

  it('棒は 1月から順に 110ms ずつ遅れて伸びる', () => {
    const { clock, h } = setup();
    at(clock, 200);
    expect(h(1)).toBeCloseTo(0);
    at(clock, 580);
    expect(Math.abs(h(1) - 65.7)).toBeLessThan(0.5);
    at(clock, 1409);
    expect(h(12)).toBeCloseTo(0, 0);
    at(clock, 1790);
    // 12月は 2枚
    expect(Math.abs(h(12) - 65.7)).toBeLessThan(0.5);
  });

  it('いちばん多い月は 1870ms から朱が重なり、横に膨らんで戻る', () => {
    const { clock, s, ui } = setup();
    at(clock, 1870);
    expect(s('annual-month-top').opacity).toBeCloseTo(0);
    expect(transformOf(ui.getByTestId('annual-month-bar-5')).scaleX).toBeCloseTo(1);
    at(clock, 2570);
    expect(s('annual-month-top').opacity).toBeCloseTo(1);
    expect(transformOf(ui.getByTestId('annual-month-bar-5')).scaleX).toBeCloseTo(1);
  });

  it('見出しは 1900〜2500ms、下の字は 2300〜2800ms', () => {
    const { clock, s } = setup();
    at(clock, 1900);
    expect(s('annual-months-title').opacity).toBeCloseTo(0);
    at(clock, 2500);
    expect(s('annual-months-title').opacity).toBeCloseTo(1);
    at(clock, 2300);
    expect(s('annual-months-sub').opacity).toBeCloseTo(0);
    at(clock, 2800);
    expect(s('annual-months-sub').opacity).toBeCloseTo(1);
  });

  it('UI-2・UI-3: 色', () => {
    const { s, ui } = setup();
    expect(s('annual-month-bar-1').backgroundColor).toBe(colors.primary[300]);
    expect(s('annual-month-bar-2').backgroundColor).toBe(colors.washiShade);
    expect(s('annual-month-top').backgroundColor).toBe(colors.seal);
    expect(styleOf(ui.getByText('7枚の御朱印')).color).toBe(colors.washiSub);
  });
});
