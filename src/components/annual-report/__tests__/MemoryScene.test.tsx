import { render, within } from '@testing-library/react-native';

import { MemoryScene } from '@components/annual-report/scenes/MemoryScene';
import type { AnnualReport } from '@utils/annualReport';

import { at, fullReport, newClock, styleOf, transformOf } from './sceneTestUtils';

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://img/${path}`,
  getStampThumbUrl: (path: string) => `https://img/thumb/${path}`,
  getStampViewUrl: (path: string) => `https://img/view/${path}`,
}));

function setup(report: AnnualReport = fullReport()) {
  const clock = newClock();
  const ui = render(<MemoryScene report={report} clock={clock} />);
  const s = (id: string) => styleOf(ui.getByTestId(id));
  const tf = (id: string) => transformOf(ui.getByTestId(id));
  return { ui, clock, s, tf };
}

describe('MemoryScene（AC-41）', () => {
  it('いちばん多く参った寺社と、はじめて足を運んだ県', () => {
    const { ui } = setup();
    expect(ui.getByText('印象に残った寺社')).toBeTruthy();
    const top = within(ui.getByTestId('annual-memory-top'));
    expect(top.getByText('いちばん多く参った')).toBeTruthy();
    expect(top.getByText('大崎八幡宮')).toBeTruthy();
    expect(top.getByText('宮城県 ・ 4回')).toBeTruthy();
    const fresh = within(ui.getByTestId('annual-memory-new'));
    expect(fresh.getByText('はじめて足を運んだ県')).toBeTruthy();
    expect(fresh.getByText('京都府')).toBeTruthy();
    expect(fresh.getByText('5月2日 伏見稲荷大社 から')).toBeTruthy();
  });

  it('1枚目は 300ms から、2枚目は 1500ms から 700ms で下から上がる', () => {
    const { clock, s, tf } = setup();
    at(clock, 300);
    expect(s('annual-memory-top').opacity).toBeCloseTo(0);
    expect(tf('annual-memory-top').translateY).toBeCloseTo(40);
    at(clock, 1000);
    expect(s('annual-memory-top').opacity).toBeCloseTo(1);
    expect(tf('annual-memory-top').translateY).toBeCloseTo(0);
    at(clock, 1500);
    expect(s('annual-memory-new').opacity).toBeCloseTo(0);
    at(clock, 2200);
    expect(s('annual-memory-new').opacity).toBeCloseTo(1);
  });

  it('いちばん多く参った が無ければ、はじめての県のカードが 300ms から', () => {
    const base = fullReport();
    const { ui, clock, s } = setup({ ...base, memory: { ...base.memory, top: null } });
    expect(ui.queryByTestId('annual-memory-top')).toBeNull();
    at(clock, 300);
    expect(s('annual-memory-new').opacity).toBeCloseTo(0);
    at(clock, 1000);
    expect(s('annual-memory-new').opacity).toBeCloseTo(1);
    expect(s('annual-memory-new').marginTop).toBe(22);
  });

  it('県の無い寺社なら回数だけ', () => {
    const base = fullReport();
    const { ui } = setup({
      ...base,
      memory: {
        top: { spotName: '名もなき社', prefecture: null, days: 3, imagePath: null },
        newPrefecture: null,
      },
    });
    expect(ui.getByText('3回')).toBeTruthy();
    expect(ui.queryByTestId('annual-memory-new')).toBeNull();
  });

  it('UI-5: カードは白・角 18・内側 16', () => {
    const { s } = setup();
    expect(s('annual-memory-top')).toMatchObject({ borderRadius: 18, padding: 16 });
  });
});
