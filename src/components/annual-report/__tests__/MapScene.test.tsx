import { render } from '@testing-library/react-native';

import { MapScene } from '@components/annual-report/scenes/MapScene';
import { colors } from '@theme/colors';
import { fitPrefectures, toViewTransform } from '@utils/annualReport';

import {
  asPayload,
  at,
  fullReport,
  newClock,
  paintOf,
  styleOf,
  transformOf,
} from './sceneTestUtils';

const SIX = ['宮城県', '山形県', '東京都', '神奈川県', '京都府', '奈良県'];

function setup() {
  const clock = newClock();
  const ui = render(<MapScene report={fullReport()} clock={clock} />);
  const s = (id: string) => styleOf(ui.getByTestId(id));
  const op = (name: string) => Number(ui.getByTestId(`annual-map-fill-${name}`).props.opacity);
  return { ui, clock, s, op };
}

describe('MapScene（AC-39）', () => {
  it('見出しと県の名前の行', () => {
    const { ui } = setup();
    expect(ui.getByText('足を運んだ県')).toBeTruthy();
    expect(ui.getByText('6 つの県へ')).toBeTruthy();
    expect(ui.getByText('宮城 ・ 山形 ・ 東京 ・ 神奈川 ・ 京都 ・ 奈良')).toBeTruthy();
  });

  it('県は参った順に 380ms ずつ遅れて色づく', () => {
    const { clock, op } = setup();
    at(clock, 500);
    expect(op('宮城県')).toBeCloseTo(0);
    at(clock, 920);
    expect(op('宮城県')).toBeCloseTo(1);
    at(clock, 2400);
    expect(op('奈良県')).toBeCloseTo(0);
    at(clock, 2820);
    expect(op('奈良県')).toBeCloseTo(1);
  });

  it('重ねるのは足を運んだ県だけ。色はその年の濃さ', () => {
    const { ui } = setup();
    expect(ui.queryByTestId('annual-map-fill-北海道')).toBeNull();
    expect(ui.getAllByTestId(/^annual-map-fill-/)).toHaveLength(6);
    expect(paintOf(ui.getByTestId('annual-map-fill-宮城県'), 'fill')).toBe(
      asPayload(colors.prefectureFill.tier3)
    );
    expect(paintOf(ui.getByTestId('annual-map-fill-東京都'), 'fill')).toBe(
      asPayload(colors.prefectureFill.tier2)
    );
  });

  it('足を運んだ県すべてが収まるように寄る（3080ms から 1100ms）', () => {
    const { ui, clock } = setup();
    const width = Number(ui.getByTestId('annual-map-svg').props.width);
    const target = toViewTransform(fitPrefectures(SIX), width);

    at(clock, 3080);
    const start = transformOf(ui.getByTestId('annual-map-zoom'));
    expect(start.translateX).toBeCloseTo(0);
    expect(start.translateY).toBeCloseTo(0);
    expect(start.scale).toBeCloseTo(1);

    at(clock, 4180);
    const end = transformOf(ui.getByTestId('annual-map-zoom'));
    expect(end.translateX).toBeCloseTo(target.translateX);
    expect(end.translateY).toBeCloseTo(target.translateY);
    expect(end.scale).toBeCloseTo(target.scale);
    expect(target.scale).toBeGreaterThan(1);
  });

  it('寄ったあとに見出し、そのあと県の名前', () => {
    const { clock, s } = setup();
    at(clock, 3779);
    expect(s('annual-map-title').opacity).toBeCloseTo(0);
    at(clock, 4380);
    expect(s('annual-map-title').opacity).toBeCloseTo(1);
    at(clock, 4180);
    expect(s('annual-map-names').opacity).toBeCloseTo(0);
    at(clock, 4680);
    expect(s('annual-map-names').opacity).toBeCloseTo(1);
  });

  it('UI-4: 47県の地は白・境目は和紙・線の太さ 3。UI-2: 県の名前は washiSub', () => {
    const { ui, s } = setup();
    expect(ui.getAllByTestId(/^annual-map-base-/)).toHaveLength(47);
    const base = ui.getByTestId('annual-map-base-北海道');
    expect(paintOf(base, 'fill')).toBe(asPayload(colors.white));
    expect(paintOf(base, 'stroke')).toBe(asPayload(colors.washi));
    expect(base.props.strokeWidth).toBe(3);
    expect(s('annual-map-names').color).toBe(colors.washiSub);
  });
});
