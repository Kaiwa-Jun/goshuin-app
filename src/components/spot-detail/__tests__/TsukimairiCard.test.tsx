import { render } from '@testing-library/react-native';

import { TsukimairiCard, TsukimairiPast } from '@components/spot-detail/TsukimairiCard';
import { tsukimairiOf } from '@utils/tsukimairi';

const at = (months: string[], today: string) =>
  tsukimairiOf(
    months.map(m => `${m}-10`),
    today
  );

describe('TsukimairiCard', () => {
  // 1回来ただけの人に「月参り」を名乗らせない
  it('1ヶ月では出さない', () => {
    const { queryByTestId } = render(<TsukimairiCard tsukimairi={at(['2026-09'], '2026-09-20')} />);

    expect(queryByTestId('tsukimairi-card')).toBeNull();
  });

  // カードの仕事は「満願まであと◯ヶ月」を見失わせないこと。途切れたら役目が無い
  it('途切れていれば出さない', () => {
    const { queryByTestId } = render(
      <TsukimairiCard tsukimairi={at(['2026-01', '2026-02', '2026-03'], '2026-06-01')} />
    );

    expect(queryByTestId('tsukimairi-card')).toBeNull();
  });

  it('続いていれば、何ヶ月目かと、あと何ヶ月かを出す', () => {
    const { getByTestId } = render(
      <TsukimairiCard tsukimairi={at(['2026-07', '2026-08', '2026-09'], '2026-09-20')} />
    );

    expect(getByTestId('tsukimairi-chip').props.children).toBe('3ヶ月目');
    expect(getByTestId('tsukimairi-goal')).toBeTruthy();
  });

  it('12個の丸のうち、参拝した月だけ塗る', () => {
    const { getByTestId } = render(
      <TsukimairiCard tsukimairi={at(['2026-08', '2026-09'], '2026-09-20')} />
    );
    const filled = (i: number) =>
      getByTestId(`tsukimairi-dot-${i}`).props.style.some(
        (s: { backgroundColor?: string }) => s?.backgroundColor === '#DC2626'
      );

    expect(filled(0)).toBe(true);
    expect(filled(1)).toBe(true);
    expect(filled(2)).toBe(false);
  });

  it('満願なら、そう出す', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
    const { getByTestId } = render(<TsukimairiCard tsukimairi={at(twelve, '2026-12-20')} />);

    expect(getByTestId('tsukimairi-chip').props.children).toBe('12ヶ月目');
  });

  it('2周目に入ったら、何周目かを出す', () => {
    const months = Array.from({ length: 14 }, (_, i) => {
      const m = (i % 12) + 1;
      const y = 2026 + Math.floor(i / 12);
      return `${y}-${String(m).padStart(2, '0')}`;
    });
    const { getByTestId } = render(<TsukimairiCard tsukimairi={at(months, '2027-02-20')} />);

    expect(getByTestId('tsukimairi-chip').props.children).toBe('2周目 2ヶ月');
  });
});

describe('TsukimairiPast', () => {
  // 責める文言は出さない。記録として残すだけ
  it('最長だけを、静かに1行で残す', () => {
    const { getByTestId } = render(<TsukimairiPast longest={7} />);

    expect(getByTestId('tsukimairi-past')).toBeTruthy();
  });

  it('2ヶ月に満たなければ出さない', () => {
    const { queryByTestId } = render(<TsukimairiPast longest={1} />);

    expect(queryByTestId('tsukimairi-past')).toBeNull();
  });
});
