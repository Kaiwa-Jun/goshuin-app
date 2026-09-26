import { render, within } from '@testing-library/react-native';

import { Seal } from '@components/common/Seal';
import { BadgesScene } from '@components/annual-report/scenes/BadgesScene';
import type { AnnualReport } from '@utils/annualReport';

import { at, fullReport, newClock, styleOf, transformOf } from './sceneTestUtils';

function setup(report: AnnualReport = fullReport()) {
  const clock = newClock();
  const ui = render(<BadgesScene report={report} clock={clock} />);
  const s = (id: string) => styleOf(ui.getByTestId(id));
  const tf = (id: string) => transformOf(ui.getByTestId(id));
  return { ui, clock, s, tf };
}

const PILGRIMAGE_2 = { id: 'x', name: '奥州三十三観音', spots: 33, completedAt: '2026-06-01' };

describe('BadgesScene（AC-42）', () => {
  it('印が3つ、この順で、下に名前', () => {
    const { ui } = setup();
    expect(ui.getByText('今年いただいた印')).toBeTruthy();
    expect(ui.getByText('3 つの印')).toBeTruthy();
    const ids = ui.getAllByTestId(/^annual-seal-/).map(el => el.props.testID);
    expect(ids).toEqual(['annual-seal-visit-10', 'annual-seal-mangan', 'annual-seal-same-day-3']);
    expect(within(ui.getByTestId('annual-seal-visit-10')).getByText('10箇所達成')).toBeTruthy();
    expect(within(ui.getByTestId('annual-seal-mangan')).getByText('満願')).toBeTruthy();
    expect(within(ui.getByTestId('annual-seal-same-day-3')).getByText('1日に3箇所')).toBeTruthy();
  });

  it('印は大きく出て少し沈んで戻る（linear）', () => {
    const { clock, s, tf } = setup();
    at(clock, 500);
    expect(s('annual-seal-visit-10').opacity).toBeCloseTo(0);
    expect(tf('annual-seal-visit-10').scale).toBeCloseTo(1.6);
    at(clock, 794);
    expect(tf('annual-seal-visit-10').scale).toBeCloseTo(0.92);
    at(clock, 920);
    expect(s('annual-seal-visit-10').opacity).toBeCloseTo(1);
    expect(tf('annual-seal-visit-10').scale).toBeCloseTo(1);
  });

  it('3つ目の印は 1800ms から', () => {
    const { clock, s, tf } = setup();
    at(clock, 1800);
    expect(s('annual-seal-same-day-3').opacity).toBeCloseTo(0);
    expect(tf('annual-seal-same-day-3').scale).toBeCloseTo(1.6);
    at(clock, 1900);
    expect(Number(s('annual-seal-same-day-3').opacity)).toBeGreaterThan(0);
  });

  it('満願のカードは印のあと（2750ms から 700ms）', () => {
    const { ui, clock, s } = setup();
    const card = within(ui.getByTestId('annual-pilgrimage-card'));
    expect(card.getByText('満願')).toBeTruthy();
    expect(card.getByText('仙台六芒星巡り')).toBeTruthy();
    expect(card.getByText('6社 ・ 10月18日')).toBeTruthy();
    at(clock, 2750);
    expect(s('annual-pilgrimage-card').opacity).toBeCloseTo(0);
    at(clock, 3450);
    expect(s('annual-pilgrimage-card').opacity).toBeCloseTo(1);
    expect(ui.queryByTestId('annual-pilgrimage-more')).toBeNull();
  });

  it('満願が2つなら「ほかに 1つの巡礼も満願」', () => {
    const base = fullReport();
    const { ui } = setup({ ...base, pilgrimages: [...base.pilgrimages, PILGRIMAGE_2] });
    expect(ui.getByText('ほかに 1つの巡礼も満願')).toBeTruthy();
  });

  it('UI-2: 印の名前は 13・700。印は朱で押されている', () => {
    const { ui } = setup();
    expect(styleOf(ui.getByText('10箇所達成'))).toMatchObject({ fontSize: 13, fontWeight: '700' });
    expect(ui.UNSAFE_getAllByType(Seal).every(el => el.props.earned === true)).toBe(true);
    expect(ui.UNSAFE_getAllByType(Seal)[0].props.size).toBe(88);
  });
});

describe('BadgesScene（AC-43）', () => {
  it('印が0で満願だけなら、見出しは「今年の満願」で、印の並びは無い。カードは 500ms から', () => {
    const base = fullReport();
    const { ui, clock, s } = setup({ ...base, badges: [] });
    expect(ui.getByText('今年の満願')).toBeTruthy();
    expect(ui.queryByText(/つの印/)).toBeNull();
    expect(ui.queryAllByTestId(/^annual-seal-/)).toHaveLength(0);
    at(clock, 500);
    expect(s('annual-pilgrimage-card').opacity).toBeCloseTo(0);
    at(clock, 1200);
    expect(s('annual-pilgrimage-card').opacity).toBeCloseTo(1);
    expect(s('annual-pilgrimage-card').marginTop).toBe(22);
  });

  it('過ぎた年の満願だけの見出しは「2026年の満願」', () => {
    const base = fullReport(2027);
    const { ui } = setup({ ...base, badges: [] });
    expect(ui.getByText('2026年の満願')).toBeTruthy();
  });

  it('印が4つなら印の大きさは 64', () => {
    const base = fullReport();
    const { ui } = setup({
      ...base,
      badges: [
        { id: 'first-stamp', name: '初めての御朱印', mark: 'ichi' },
        { id: 'visit-5', name: '5箇所達成', mark: 'go' },
        ...base.badges,
      ],
    });
    expect(ui.UNSAFE_getAllByType(Seal)).toHaveLength(5);
    expect(ui.UNSAFE_getAllByType(Seal).every(el => el.props.size === 64)).toBe(true);
  });
});
