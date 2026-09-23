import { areaLabel, frequentArea, type AreaVisit } from '@utils/frequentArea';

/*
 * よく行くエリア（Issue #245）。端末の位置情報は使わず、記録した寺社の位置から割り出す。
 * 数えるのは枚数ではなく「参拝した月」。旅行1回で10枚集めても、よく行く場所にはしない
 */
const SENDAI = { lat: 38.267, lng: 140.859 };
const KYOTO = { lat: 34.985, lng: 135.769 };

const visit = (
  spotId: string,
  visitedAt: string,
  at: { lat: number; lng: number },
  address: string | null = null,
  prefecture: string | null = null
): AreaVisit => ({ spotId, visitedAt, lat: at.lat, lng: at.lng, address, prefecture });

// 仙台の街なかに 7 ヶ月（本アカウントの試算に近い形）
const sendai = [
  '2024-05-04',
  '2024-05-17',
  '2024-06-01',
  '2024-07-05',
  '2025-03-19',
  '2025-12-31',
  '2026-01-09',
  '2026-04-09',
].map((d, i) =>
  visit(
    `s${i}`,
    d,
    { lat: SENDAI.lat + (i % 3) * 0.01, lng: SENDAI.lng - (i % 2) * 0.01 },
    '宮城県仙台市青葉区八幡4-6-1',
    '宮城県'
  )
);
// 京都に旅行2回（同じ月にたくさん）
const kyoto = Array.from({ length: 12 }, (_, i) =>
  visit(
    `k${i}`,
    i < 7 ? '2022-03-15' : '2025-12-07',
    { lat: KYOTO.lat + (i % 4) * 0.008, lng: KYOTO.lng },
    '京都府京都市東山区',
    '京都府'
  )
);

describe('frequentArea', () => {
  it('5km 以内の記録をまとめ、参拝した月が3以上のまとまりをよく行くエリアにする', () => {
    const area = frequentArea(sendai);
    expect(area).not.toBeNull();
    expect(area!.months).toBe(7);
    expect(area!.label).toBe('仙台');
    expect(area!.center.lat).toBeCloseTo(SENDAI.lat, 1);
  });

  it('旅行先は、記録が多くても月が少なければよく行くエリアにならない', () => {
    const area = frequentArea([...kyoto, ...sendai]);
    expect(area!.label).toBe('仙台');

    // 京都だけなら、12枚あっても 2 ヶ月なので出ない
    expect(frequentArea(kyoto)).toBeNull();
  });

  it('月が同じなら、記録が多い方', () => {
    const a = ['2025-01-01', '2025-02-01', '2025-03-01'].map((d, i) =>
      visit(`a${i}`, d, SENDAI, '宮城県仙台市青葉区')
    );
    const b = ['2025-01-01', '2025-02-01', '2025-03-01', '2025-03-02'].map((d, i) =>
      visit(`b${i}`, d, KYOTO, '京都府京都市東山区')
    );
    expect(frequentArea([...a, ...b])!.label).toBe('京都');
  });

  it('記録が無い・少ないときは null', () => {
    expect(frequentArea([])).toBeNull();
    expect(frequentArea(sendai.slice(0, 2))).toBeNull();
  });

  it('まとまりに入った寺社を持つ（まだの寺社から除くため）', () => {
    expect(frequentArea(sendai)!.spotIds.has('s0')).toBe(true);
  });
});

describe('areaLabel', () => {
  it.each([
    ['宮城県仙台市青葉区八幡4-6-1', '宮城県', '仙台'],
    ['東京都千代田区丸の内1', '東京都', '千代田'],
    ['宮城県柴田郡村田町足立', '宮城県', '村田'],
    ['北海道札幌市中央区宮ヶ丘474', '北海道', '札幌'],
    ['京都府京都市右京区嵯峨', '京都府', '京都'],
  ])('%s → %s', (address, prefecture, label) => {
    expect(areaLabel([{ address, prefecture }])).toBe(label);
  });

  it('住所が無ければ都道府県から', () => {
    expect(areaLabel([{ address: null, prefecture: '宮城県' }])).toBe('宮城');
    expect(areaLabel([{ address: null, prefecture: '北海道' }])).toBe('北海道');
  });

  it('いちばん多い市区町村を選ぶ', () => {
    expect(
      areaLabel([
        { address: '宮城県名取市', prefecture: '宮城県' },
        { address: '宮城県仙台市青葉区', prefecture: '宮城県' },
        { address: '宮城県仙台市宮城野区', prefecture: '宮城県' },
      ])
    ).toBe('仙台');
  });

  it('何も取れなければ null', () => {
    expect(areaLabel([{ address: null, prefecture: null }])).toBeNull();
  });
});
