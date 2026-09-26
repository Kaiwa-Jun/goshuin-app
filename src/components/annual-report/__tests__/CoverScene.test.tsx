import { render } from '@testing-library/react-native';

import { CoverScene } from '@components/annual-report/scenes/CoverScene';
import { colors } from '@theme/colors';

import { at, fullReport, newClock, styleOf, transformOf } from './sceneTestUtils';

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://img/${path}`,
  getStampThumbUrl: (path: string) => `https://img/thumb/${path}`,
  getStampViewUrl: (path: string) => `https://img/view/${path}`,
}));

function setup() {
  const clock = newClock();
  const ui = render(<CoverScene report={fullReport()} clock={clock} />);
  const s = (id: string) => styleOf(ui.getByTestId(id));
  const tf = (id: string) => transformOf(ui.getByTestId(id));
  return { ui, clock, s, tf };
}

describe('CoverScene（AC-36）', () => {
  it('字が出る', () => {
    const { ui } = setup();
    expect(ui.getByText('2026年のふりかえり')).toBeTruthy();
    expect(ui.getByText('2026')).toBeTruthy();
    expect(ui.getByText('あなたの参拝')).toBeTruthy();
    expect(ui.getByText('1月3日 大崎八幡宮 ─ 最初の一枚')).toBeTruthy();
  });

  it('見出しは 0〜500ms で出る', () => {
    const { clock, s } = setup();
    at(clock, 0);
    expect(s('annual-cover-kick').opacity).toBeCloseTo(0);
    at(clock, 500);
    expect(s('annual-cover-kick').opacity).toBeCloseTo(1);
  });

  it('年は 100ms から 700ms で下から上がる（easeOut）', () => {
    const { clock, s, tf } = setup();
    at(clock, 100);
    expect(s('annual-cover-year').opacity).toBeCloseTo(0);
    expect(tf('annual-cover-year').translateY).toBeCloseTo(40);
    at(clock, 450);
    expect(s('annual-cover-year').opacity).toBeCloseTo(0.875);
    at(clock, 800);
    expect(s('annual-cover-year').opacity).toBeCloseTo(1);
    expect(tf('annual-cover-year').translateY).toBeCloseTo(0);
  });

  it('最初の一枚は 1100ms から 900ms で、傾いて小さい所から出る', () => {
    const { clock, s, tf } = setup();
    at(clock, 1100);
    expect(s('annual-cover-photo').opacity).toBeCloseTo(0);
    expect(tf('annual-cover-photo').scale).toBeCloseTo(0.86);
    expect(tf('annual-cover-photo').rotate).toBe('-10deg');
    expect(tf('annual-cover-photo').translateY).toBeCloseTo(30);
    at(clock, 2000);
    expect(s('annual-cover-photo').opacity).toBeCloseTo(1);
    expect(tf('annual-cover-photo').scale).toBeCloseTo(1);
    expect(tf('annual-cover-photo').rotate).toBe('-4deg');
    expect(tf('annual-cover-photo').translateY).toBeCloseTo(0);
  });

  it('説明の字は 1900〜2400ms', () => {
    const { clock, s } = setup();
    at(clock, 1900);
    expect(s('annual-cover-caption').opacity).toBeCloseTo(0);
    at(clock, 2400);
    expect(s('annual-cover-caption').opacity).toBeCloseTo(1);
  });

  it('UI-2・UI-5: 字の型と写真の大きさ', () => {
    const { s } = setup();
    expect(s('annual-cover-kick')).toMatchObject({
      fontSize: 13,
      fontWeight: '800',
      color: colors.seal,
    });
    expect(s('annual-cover-year')).toMatchObject({ fontSize: 104, fontWeight: '800' });
    expect(s('annual-cover-lead')).toMatchObject({ fontSize: 28, fontWeight: '800' });
    expect(s('annual-cover-photo')).toMatchObject({ width: 190, height: 260 });
  });
});
