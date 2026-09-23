import { fireEvent, render, within } from '@testing-library/react-native';

import { MouSukoshiCard } from '@components/collection/MouSukoshiCard';
import { FrequentAreaSheet } from '@components/collection/FrequentAreaSheet';
import { getAllBadges } from '@services/badges';
import type { MouSukoshiRow } from '@utils/mouSukoshi';
import type { TsukimairiEntry } from '@utils/tsukimairiList';

/*
 * あゆみの「もう少し」（Issue #245 / docs/design/mockups/2026-09-ayumi-grow-v3.html）
 */
type AreaRowT = Extract<MouSukoshiRow, { kind: 'area' }>;
const tsukiEntry: TsukimairiEntry = {
  spotId: 'takekoma',
  spotName: '竹駒神社',
  current: 9,
  longest: 9,
  startMonth: '2026-01',
  remaining: 3,
  isMangan: false,
  lapCount: 1,
  monthsInLap: 9,
  isBroken: false,
  shouldShowCard: true,
};
const seal = getAllBadges().find(b => b.id === 'visit-50')!;
const areaRow: MouSukoshiRow = {
  kind: 'area',
  label: '仙台',
  months: 7,
  spots: [
    {
      id: 'rinnoji',
      name: '輪王寺',
      address: '宮城県仙台市青葉区北山1-14-1',
      type: 'temple',
      distanceKm: 1.8,
    },
    {
      id: 'zuihoden',
      name: '瑞鳳殿',
      address: '宮城県仙台市青葉区霊屋下23-2',
      type: 'temple',
      distanceKm: 2.04,
    },
  ],
  alsoInCourse: [
    {
      id: 'kameoka',
      name: '亀岡八幡宮',
      address: null,
      type: 'shrine',
      distanceKm: 1.5,
      courseName: '仙台六芒星巡り',
      courseRemaining: 1,
    },
  ],
};
const rows: MouSukoshiRow[] = [
  {
    kind: 'pilgrimage',
    pilgrimage: {
      id: 'p1',
      name: '仙台六芒星巡り',
      description: null,
      category: null,
      totalSpots: 6,
      visitedCount: 5,
    },
    remaining: 1,
  },
  { kind: 'tsukimairi', entry: tsukiEntry, remaining: 3 },
  areaRow,
];

const handlers = () => ({
  onPressPilgrimage: jest.fn(),
  onPressSpot: jest.fn(),
  onPressSeal: jest.fn(),
  onPressArea: jest.fn(),
});

describe('MouSukoshiCard', () => {
  it('行が無ければ何も出さない（見出しも）', () => {
    const { toJSON } = render(<MouSukoshiCard rows={[]} {...handlers()} />);
    expect(toJSON()).toBeNull();
  });

  it('種類・名前・朱の「あと」を行ごとに出す', () => {
    const { getByTestId, getByText } = render(<MouSukoshiCard rows={rows} {...handlers()} />);
    expect(getByText('もう少し')).toBeTruthy();

    const p = within(getByTestId('mou-sukoshi-pilgrimage-p1'));
    expect(p.getByText('巡礼')).toBeTruthy();
    expect(p.getByText('仙台六芒星巡り')).toBeTruthy();
    expect(p.getByText('あと1社')).toBeTruthy();

    const t = within(getByTestId('mou-sukoshi-tsukimairi-takekoma'));
    expect(t.getByText('月参り')).toBeTruthy();
    expect(t.getByText('竹駒神社')).toBeTruthy();
    expect(t.getByText(/満願まで\s*あと3ヶ月/)).toBeTruthy();

    const a = within(getByTestId('mou-sukoshi-area'));
    expect(a.getByText('よく行くエリア')).toBeTruthy();
    expect(a.getByText('仙台のまわり')).toBeTruthy();
    expect(a.getByText('輪王寺・瑞鳳殿')).toBeTruthy();
    expect(a.getByText(/まだの\s*寺社\s*2/)).toBeTruthy();
  });

  it('巡礼は札所の数で、月参りは12の丸で、進み具合を名前の下に出す（v3 の①）', () => {
    const { getByTestId } = render(<MouSukoshiCard rows={rows} {...handlers()} />);
    const p = within(getByTestId('mou-sukoshi-pilgrimage-p1'));
    const seg = p.getAllByTestId(/^progress-seg-/);
    expect(seg).toHaveLength(6);
    expect(seg.filter(x => x.props.testID.endsWith('-on'))).toHaveLength(5);
    const t = within(getByTestId('mou-sukoshi-tsukimairi-takekoma'));
    const dots = t.getAllByTestId(/^progress-dot-/);
    expect(dots).toHaveLength(12);
    expect(dots.filter(x => x.props.testID.endsWith('-on'))).toHaveLength(9);
  });

  it('印の行', () => {
    const { getByTestId } = render(
      <MouSukoshiCard
        rows={[{ kind: 'seal', badge: seal, remaining: 7, unit: '箇所' }]}
        {...handlers()}
      />
    );
    const s = within(getByTestId('mou-sukoshi-seal'));
    expect(s.getByText('印')).toBeTruthy();
    expect(s.getByText(seal.name)).toBeTruthy();
    expect(s.getByText('あと7箇所')).toBeTruthy();
  });

  it('押すと、それぞれの場所へ', () => {
    const h = handlers();
    const { getByTestId } = render(
      <MouSukoshiCard
        rows={[...rows, { kind: 'seal', badge: seal, remaining: 7, unit: '箇所' }]}
        {...h}
      />
    );
    fireEvent.press(getByTestId('mou-sukoshi-pilgrimage-p1'));
    expect(h.onPressPilgrimage).toHaveBeenCalledWith('p1', '仙台六芒星巡り');
    fireEvent.press(getByTestId('mou-sukoshi-tsukimairi-takekoma'));
    expect(h.onPressSpot).toHaveBeenCalledWith('takekoma');
    fireEvent.press(getByTestId('mou-sukoshi-area'));
    expect(h.onPressArea).toHaveBeenCalledWith(areaRow);
    fireEvent.press(getByTestId('mou-sukoshi-seal'));
    expect(h.onPressSeal).toHaveBeenCalled();
  });

  it('「家」「あなたの位置」「現在地」とは言わない', () => {
    const { queryByText } = render(<MouSukoshiCard rows={rows} {...handlers()} />);
    for (const word of [/家/, /あなたの位置/, /現在地/]) expect(queryByText(word)).toBeNull();
  });
});

describe('FrequentAreaSheet', () => {
  it('よく行く、〇〇のまわりと、まだの寺社を近い順に（住所は区以下・距離つき）', () => {
    const { getByText, getAllByTestId } = render(
      <FrequentAreaSheet area={areaRow} visible onClose={jest.fn()} onPressSpot={jest.fn()} />
    );
    expect(getByText('よく行く、仙台のまわり')).toBeTruthy();
    expect(getByText(/この7ヶ月/)).toBeTruthy();
    const items = getAllByTestId(/^area-spot-/);
    expect(items.map(i => i.props.testID)).toEqual([
      'area-spot-rinnoji',
      'area-spot-zuihoden',
      'area-spot-kameoka',
    ]);
    expect(within(items[0]).getByText(/青葉区北山/)).toBeTruthy();
    expect(within(items[0]).getByText('1.8km')).toBeTruthy();
    expect(within(items[1]).getByText('2.0km')).toBeTruthy();
    // 巡礼の残りは薄く添える
    expect(within(items[2]).getByText('仙台六芒星巡りの、残りの1社')).toBeTruthy();
  });

  it('巡礼の残りが2社なら「残り2社のひとつ」', () => {
    const area = {
      ...areaRow,
      alsoInCourse: [{ ...(areaRow as AreaRowT).alsoInCourse[0], courseRemaining: 2 }],
    } as AreaRowT;
    const { getByText } = render(
      <FrequentAreaSheet area={area} visible onClose={jest.fn()} onPressSpot={jest.fn()} />
    );
    expect(getByText('仙台六芒星巡りの、残り2社のひとつ')).toBeTruthy();
  });

  it('寺社を押すと、その寺社へ', () => {
    const onPressSpot = jest.fn();
    const { getByTestId } = render(
      <FrequentAreaSheet area={areaRow} visible onClose={jest.fn()} onPressSpot={onPressSpot} />
    );
    fireEvent.press(getByTestId('area-spot-zuihoden'));
    expect(onPressSpot).toHaveBeenCalledWith('zuihoden');
  });

  it('「予定を組む」は出さない。「家」「現在地」とも言わない', () => {
    const { queryByText } = render(
      <FrequentAreaSheet area={areaRow} visible onClose={jest.fn()} onPressSpot={jest.fn()} />
    );
    for (const word of [/予定を組む/, /家/, /現在地/, /あなたの位置/])
      expect(queryByText(word)).toBeNull();
  });
});
