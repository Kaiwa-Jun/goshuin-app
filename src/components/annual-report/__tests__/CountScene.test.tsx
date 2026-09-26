import { render } from '@testing-library/react-native';

import { CountScene } from '@components/annual-report/scenes/CountScene';
import { colors } from '@theme/colors';
import { FINAL_CLOCK_MS } from '@utils/annualReport';

import { at, fullReport, newClock, num, styleOf } from './sceneTestUtils';

function setup(currentYear = 2026, start = 0) {
  const clock = newClock(start);
  const ui = render(<CountScene report={fullReport(currentYear)} clock={clock} />);
  const s = (id: string) => styleOf(ui.getByTestId(id));
  return { ui, clock, s };
}

describe('CountScene（AC-37）', () => {
  it('社数を 200ms から 1300ms で数え上げる', () => {
    const { ui, clock } = setup();
    at(clock, 200);
    expect(ui.getByTestId('annual-count-spots').props.children).toBe(0);
    at(clock, 850);
    expect(ui.getByTestId('annual-count-spots').props.children).toBe(21);
    at(clock, 1500);
    expect(ui.getByTestId('annual-count-spots').props.children).toBe(24);
  });

  it('時計が最初から最後にあれば（視差効果を減らす）、最初から「24」', () => {
    const { ui } = setup(2026, FINAL_CLOCK_MS);
    expect(ui.getByTestId('annual-count-spots').props.children).toBe(24);
  });

  it('枚数は 1400〜2000ms で出る', () => {
    const { ui, clock, s } = setup();
    expect(ui.getByText('31 枚の御朱印を')).toBeTruthy();
    expect(ui.getByText('いただきました')).toBeTruthy();
    at(clock, 1400);
    expect(s('annual-count-stamps').opacity).toBeCloseTo(0);
    at(clock, 2000);
    expect(s('annual-count-stamps').opacity).toBeCloseTo(1);
  });

  it('神社とお寺の帯は 2100ms から 900ms で伸びる', () => {
    const { clock, s } = setup();
    at(clock, 2100);
    expect(num(s('annual-count-split-shrine').width)).toBeCloseTo(0);
    at(clock, 3000);
    expect(num(s('annual-count-split-shrine').width)).toBeCloseTo(70.8, 0);
    expect(Math.abs(num(s('annual-count-split-shrine').width) - 70.8)).toBeLessThan(0.1);
    expect(Math.abs(num(s('annual-count-split-temple').width) - 29.2)).toBeLessThan(0.1);
  });

  it('凡例', () => {
    const { ui, clock, s } = setup();
    expect(ui.getByText('神社 17')).toBeTruthy();
    expect(ui.getByText('お寺 7')).toBeTruthy();
    at(clock, 2800);
    expect(s('annual-count-legend').opacity).toBeCloseTo(0);
    at(clock, 3300);
    expect(s('annual-count-legend').opacity).toBeCloseTo(1);
  });

  it('見出しは今年なら「今年めぐった寺社」、過ぎた年なら「2026年にめぐった寺社」', () => {
    expect(setup().ui.getByText('今年めぐった寺社')).toBeTruthy();
    expect(setup(2027).ui.getByText('2026年にめぐった寺社')).toBeTruthy();
  });

  it('UI-2・UI-3: 社数は朱。帯の地は washiShade、神社・お寺の色', () => {
    const { s } = setup();
    expect(s('annual-count-spots').color).toBe(colors.seal);
    expect(s('annual-count-split').backgroundColor).toBe(colors.washiShade);
    expect(s('annual-count-split-shrine').backgroundColor).toBe(colors.shrine[600]);
    expect(s('annual-count-split-temple').backgroundColor).toBe(colors.temple[600]);
  });
});
