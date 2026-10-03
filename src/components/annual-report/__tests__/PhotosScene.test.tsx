import { render } from '@testing-library/react-native';

import { PhotosScene } from '@components/annual-report/scenes/PhotosScene';
import { buildAnnualReport, type AnnualReport, type AnnualVisit } from '@utils/annualReport';

import { at, fullReport, newClock, styleOf, transformOf } from './sceneTestUtils';

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://img/${path}`,
  getStampThumbUrl: (path: string) => `https://img/thumb/${path}`,
  getStampViewUrl: (path: string) => `https://img/view/${path}`,
}));

function setup(report: AnnualReport = fullReport()) {
  const clock = newClock();
  const ui = render(<PhotosScene report={report} clock={clock} />);
  const s = (id: string) => styleOf(ui.getByTestId(id));
  const tf = (id: string) => transformOf(ui.getByTestId(id));
  return { ui, clock, s, tf };
}

describe('PhotosScene（AC-40）', () => {
  it('16枚と「31 枚」「ほか 15 枚」', () => {
    const { ui } = setup();
    expect(ui.getByText('今年の御朱印')).toBeTruthy();
    expect(ui.getByText('31 枚')).toBeTruthy();
    expect(ui.getAllByTestId(/^annual-photo-\d+$/)).toHaveLength(16);
    expect(ui.getByText('ほか 15 枚')).toBeTruthy();
  });

  it('1枚目は 250ms から 520ms で、上から傾いて落ちてくる', () => {
    const { clock, s, tf } = setup();
    at(clock, 250);
    expect(s('annual-photo-0').opacity).toBeCloseTo(0);
    expect(tf('annual-photo-0').translateY).toBeCloseTo(-60);
    expect(tf('annual-photo-0').scale).toBeCloseTo(1.15);
    expect(tf('annual-photo-0').rotate).toBe('-6deg');
    at(clock, 770);
    expect(s('annual-photo-0').opacity).toBeCloseTo(1);
    expect(tf('annual-photo-0').translateY).toBeCloseTo(0);
    expect(tf('annual-photo-0').scale).toBeCloseTo(1);
    expect(tf('annual-photo-0').rotate).toBe('0deg');
  });

  it('16枚目は 2500ms から。「ほか」は 2850ms から', () => {
    const { clock, s } = setup();
    at(clock, 2500);
    expect(s('annual-photo-15').opacity).toBeCloseTo(0);
    at(clock, 3020);
    expect(s('annual-photo-15').opacity).toBeCloseTo(1);
    at(clock, 2850);
    expect(s('annual-photos-more').opacity).toBeCloseTo(0);
    at(clock, 3350);
    expect(s('annual-photos-more').opacity).toBeCloseTo(1);
  });

  it('UI-5: コラージュの写真は 66×88', () => {
    const { s } = setup();
    expect(s('annual-photo-0')).toMatchObject({ width: 66, height: 88 });
  });

  it('16枚以下なら全部で、「ほか」は無い', () => {
    const visits: AnnualVisit[] = Array.from({ length: 8 }, (_, i) => ({
      id: `a${i}`,
      spotId: `s${i}`,
      visitedAt: `2026-0${(i % 8) + 1}-01`,
      createdAt: `2026-0${(i % 8) + 1}-01T01:00:00Z`,
      imagePath: `u/a${i}.jpg`,
      spotName: `寺社${i}`,
      spotType: 'shrine',
      prefecture: '宮城県',
    }));
    const report = buildAnnualReport({
      year: 2026,
      currentYear: 2026,
      visits,
      pilgrimages: [],
    }) as AnnualReport;
    const { ui } = setup(report);
    expect(ui.getAllByTestId(/^annual-photo-\d+$/)).toHaveLength(8);
    expect(ui.queryByTestId('annual-photos-more')).toBeNull();
    expect(ui.queryByText(/ほか/)).toBeNull();
  });
});
