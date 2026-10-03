import {
  buildSearchRows,
  hasLocalHits,
  MAX_PLACE_ROWS,
  normalizeQuery,
  PLACE_MERGE_KM,
  PLACE_RADIUS_KM,
  prefectureOfCode,
  rankGsiPlaces,
  regionOfSpots,
  type PlaceRow,
  type SearchRow,
  type SpotWithDistance,
} from '@utils/placeSearch';
import { getBoundingBox } from '@utils/geo';
import {
  F1,
  F2,
  F3,
  F4,
  F5,
  G1,
  G2,
  gsi,
  I1,
  I2,
  I3,
  makeSpot,
  near,
  SHIBUYA_STATION,
  TEST_SPOTS,
  TOKYO_TOWER,
} from './placeSearchFixtures';

/** 行を「place:県」「spot:id」の文字にして、種類と順を一目で比べる */
function shape(rows: SearchRow[]): string[] {
  return rows.map(r => (r.kind === 'place' ? `place:${r.prefecture}` : `spot:${r.spot.id}`));
}

function places(rows: SearchRow[]): PlaceRow[] {
  return rows.filter((r): r is PlaceRow => r.kind === 'place');
}

function rowsFor(
  query: string,
  overrides: Partial<Parameters<typeof buildSearchRows>[0]> = {}
): SearchRow[] {
  return buildSearchRows({
    query,
    spots: TEST_SPOTS,
    filterType: 'all',
    order: 'nearby',
    ...overrides,
  });
}

describe('normalizeQuery', () => {
  it('AC-1: 全角・半角と空白をそろえる', () => {
    expect(normalizeQuery(' 横 浜 ')).toBe('横浜');
    expect(normalizeQuery('ＡＢＣ')).toBe('abc');
    expect(normalizeQuery('　')).toBe('');
  });
});

describe('buildSearchRows（第1段）', () => {
  it('AC-2: 「横浜」は場所の行が上。名前の寺社、地名だけの寺社の順に続く', () => {
    const rows = rowsFor('横浜');

    expect(shape(rows)).toEqual(['place:神奈川県', 'spot:y1', 'spot:y3', 'spot:y2']);
    expect(rows[0]).toEqual({
      kind: 'place',
      key: 'area:神奈川県',
      label: '横浜',
      prefecture: '神奈川県',
      count: 3,
      external: false,
      region: {
        label: '横浜',
        bounds: [139.6267, 35.4497, 139.6302, 35.5103],
        spotIds: ['y3', 'y1', 'y2'],
      },
    });
  });

  it('場所の行の label は、前後の空白を落としただけの入れた言葉', () => {
    const [place] = places(rowsFor(' 横浜 '));
    expect(place.label).toBe('横浜');
    expect(place.region.label).toBe('横浜');
  });

  it('AC-3: 「京都」は京都府の寺社だけ。「東京都…」の住所には当たらない', () => {
    const rows = rowsFor('京都');

    expect(shape(rows)).toEqual(['place:京都府', 'spot:q1']);
    expect(places(rows)[0].count).toBe(1);
  });

  it('AC-4: 県名から「都」を落とした形・県名から始まる住所でも当たる', () => {
    const tokyo = places(rowsFor('東京'));
    expect(tokyo).toHaveLength(1);
    expect(tokyo[0]).toMatchObject({ prefecture: '東京都', count: 8 });

    const yokohama = places(rowsFor('神奈川県横浜市'));
    expect(yokohama).toHaveLength(1);
    expect(yokohama[0].count).toBe(3);
    expect(yokohama[0].region.spotIds).toEqual(['y3', 'y1', 'y2']);
  });

  it('AC-5: 1 文字は地名で当てない。住所も県も無い寺社は地名で当たらない', () => {
    expect(rowsFor('中')).toEqual([]);
    expect(shape(rowsFor('手で'))).toEqual(['spot:m1']);
  });

  it('AC-6: 県ごとに場所の行を分ける。近い順と、寺社の多い順（同じなら県コード順）', () => {
    expect(shape(rowsFor('府中'))).toEqual(['place:東京都', 'place:山梨県', 'spot:t3', 'spot:n1']);
    expect(places(rowsFor('府中')).map(p => p.count)).toEqual([1, 1]);

    const n1Near = TEST_SPOTS.map(s => (s.spot.id === 'n1' ? { ...s, distance: 10 } : s)).sort(
      (a, b) => a.distance - b.distance
    );
    expect(
      places(rowsFor('府中', { spots: n1Near, order: 'nearby' })).map(p => p.prefecture)
    ).toEqual(['山梨県', '東京都']);
    expect(
      places(rowsFor('府中', { spots: n1Near, order: 'popular' })).map(p => p.prefecture)
    ).toEqual(['東京都', '山梨県']);
  });

  it('AC-6 補: popular は寺社の多い県が先', () => {
    const extra = {
      spot: makeSpot('n2', '府中の宮', 'shrine', '山梨県', '山梨県甲府市府中町2', 35.663, 138.569),
      distance: 101,
    };
    const rows = rowsFor('府中', { spots: [...TEST_SPOTS, extra], order: 'popular' });
    expect(places(rows).map(p => [p.prefecture, p.count])).toEqual([
      ['山梨県', 2],
      ['東京都', 1],
    ]);
  });

  it('AC-7: 「八坂」は名前の寺社が地名の寺社より多いので、寺社が上', () => {
    expect(shape(rowsFor('八坂'))).toEqual(['spot:q2', 'spot:q1', 'place:静岡県', 'spot:s1']);
  });

  it('AC-8: 名前がそのまま一致する寺社を、より近い部分一致より先に置く', () => {
    expect(shape(rowsFor('明治神宮'))).toEqual(['spot:t1', 'spot:x1']);
    expect(shape(rowsFor('靖國'))).toEqual(['spot:t4']);
  });

  it('AC-9: 神社・寺院の絞り込みのあとで、場所の行と並べ方を決める', () => {
    const temple = rowsFor('横浜', { filterType: 'temple' });
    expect(shape(temple)).toEqual(['place:神奈川県', 'spot:y1']);
    expect(places(temple)[0].count).toBe(1);
    expect(places(temple)[0].region.spotIds).toEqual(['y1']);

    const shrine = rowsFor('横浜', { filterType: 'shrine' });
    expect(shape(shrine)).toEqual(['place:神奈川県', 'spot:y3', 'spot:y2']);
    expect(places(shrine)[0].count).toBe(2);
    expect(places(shrine)[0].region.spotIds).toEqual(['y3', 'y2']);
  });

  it('AC-10: 場所の行は最大 3 行。4 つ目の県の寺社も寺社の行には出る', () => {
    const spots: SpotWithDistance[] = (['宮城県', '福島県', '栃木県', '群馬県'] as const).map(
      (pref, i) => ({
        spot: makeSpot(`z${i}`, `寺${i}`, 'temple', pref, `${pref}テスト町${i}`, 37, 140),
        distance: i + 1,
      })
    );
    const rows = rowsFor('テスト町', { spots });

    expect(places(rows).map(p => p.prefecture)).toEqual(['宮城県', '福島県', '栃木県']);
    expect(rows.filter(r => r.kind === 'spot')).toHaveLength(4);
  });

  it('空の言葉は何も返さない', () => {
    expect(rowsFor('')).toEqual([]);
    expect(rowsFor('　')).toEqual([]);
  });

  it('県が入っていない寺社は住所の先頭の県でまとめる。どちらも無ければ null のまとまり', () => {
    const spots: SpotWithDistance[] = [
      { spot: makeSpot('a', '寺a', 'temple', null, '宮城県松島町1', 38.37, 141.06), distance: 1 },
      { spot: makeSpot('b', '寺b', 'temple', null, '松島町2', 38.38, 141.07), distance: 2 },
    ];
    const rows = rowsFor('松島', { spots, order: 'popular' });

    expect(places(rows).map(p => [p.key, p.prefecture, p.count])).toEqual([
      ['area:宮城県', '宮城県', 1],
      ['area:', null, 1],
    ]);
  });

  it('北海道は「北海道」だけで当たる（「北海」では県として当てない）', () => {
    const spots: SpotWithDistance[] = [
      { spot: makeSpot('h', '寺h', 'temple', '北海道', '北海道札幌市1', 43, 141), distance: 1 },
    ];
    expect(places(rowsFor('北海道', { spots }))).toHaveLength(1);
    expect(rowsFor('北海', { spots })).toEqual([]);
  });
});

describe('regionOfSpots', () => {
  it('AC-11: 寺社が1件なら範囲は点', () => {
    const spot = makeSpot('h1', '箱根神社', 'shrine', '神奈川県', null, 35.2041, 139.0253);
    expect(regionOfSpots('箱根', [spot])).toEqual({
      label: '箱根',
      bounds: [139.0253, 35.2041, 139.0253, 35.2041],
      spotIds: ['h1'],
    });
  });
});

describe('hasLocalHits', () => {
  it('AC-11: 名前か地名に1件でも当たるか', () => {
    expect(hasLocalHits('渋谷駅', TEST_SPOTS)).toBe(false);
    expect(hasLocalHits('渋谷', TEST_SPOTS)).toBe(true);
    expect(hasLocalHits('明治神宮', TEST_SPOTS)).toBe(true);
  });

  it('空の言葉は当たらない', () => {
    expect(hasLocalHits('', TEST_SPOTS)).toBe(false);
  });
});

describe('第2段（国土地理院）', () => {
  it('定数', () => {
    expect(PLACE_RADIUS_KM).toBe(2);
    expect(PLACE_MERGE_KM).toBe(1);
    expect(MAX_PLACE_ROWS).toBe(3);
  });

  it('AC-26: prefectureOfCode は 0 で 5 桁に埋めた先頭 2 桁を JIS の県コードとして読む', () => {
    expect(prefectureOfCode('13113')).toBe('東京都');
    expect(prefectureOfCode('4205')).toBe('宮城県');
    expect(prefectureOfCode('01100')).toBe('北海道');
    expect(prefectureOfCode('47201')).toBe('沖縄県');
    expect(prefectureOfCode('')).toBeNull();
    expect(prefectureOfCode('48000')).toBeNull();
    expect(prefectureOfCode('abcde')).toBeNull();
  });

  it('AC-27: 「渋谷駅」は5つの答えから1行。駅の点のまわり 2km の寺社', () => {
    const rows = rankGsiPlaces({
      query: '渋谷駅',
      features: SHIBUYA_STATION,
      spots: TEST_SPOTS,
      order: 'nearby',
    });

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      kind: 'place',
      label: '渋谷駅',
      prefecture: '東京都',
      key: 'gsi:渋谷駅:東京都',
      external: true,
      count: 3,
    });
    expect(row.region.label).toBe('渋谷駅');
    expect(row.region.spotIds).toEqual(['x1', 't1', 't2']);
    const box = getBoundingBox(35.6588, 139.7029, 2);
    const expected = [box.minLng, box.minLat, box.maxLng, box.maxLat];
    row.region.bounds.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6));
  });

  it('AC-28: 「スカイツリー」は近い2つが1行に。「東京タワー」は一部だけの当たり（北海道札幌市東区）を捨てる', () => {
    const sky = rankGsiPlaces({
      query: 'スカイツリー',
      features: [G1, G2],
      spots: TEST_SPOTS,
      order: 'nearby',
    });
    expect(sky).toHaveLength(1);
    expect(sky[0].label).toBe('東京スカイツリー');
    expect(sky[0].region.spotIds).toEqual(['t6']);

    const tower = rankGsiPlaces({
      query: '東京タワー',
      features: TOKYO_TOWER,
      spots: TEST_SPOTS,
      order: 'nearby',
    });
    expect(tower).toHaveLength(1);
    expect(tower[0]).toMatchObject({ label: '東京タワー', prefecture: '東京都' });
    expect(tower[0].region.spotIds).toEqual(['t5']);
  });

  it('AC-29: 段（名前が言葉そのもの・＋町など）→ 寺社の多い順／近い順 → 返った順。住所の答えは県と郡を落とす', () => {
    const at = (r1: number, r2: number, r3: number): SpotWithDistance[] =>
      [
        near(r1, makeSpot('r1', '寺r1', 'temple', '京都府', null, 35.0156, 135.6738)),
        near(r2, makeSpot('r2', '寺r2', 'temple', '埼玉県', null, 36.05, 139.32)),
        near(r3, makeSpot('r3', '寺r3', 'temple', '京都府', null, 34.989, 135.701)),
      ].sort((a, b) => a.distance - b.distance);

    const popular = rankGsiPlaces({
      query: '嵐山',
      features: [I3, I1, I2],
      spots: at(0, 0, 0),
      order: 'popular',
    });
    expect(popular.map(r => r.label)).toEqual(['嵐山町', '嵐山', '阪急嵐山線']);
    expect(popular[0].prefecture).toBe('埼玉県');

    const nearby = rankGsiPlaces({
      query: '嵐山',
      features: [I3, I1, I2],
      spots: at(5, 50, 6),
      order: 'nearby',
    });
    expect(nearby.map(r => r.label)).toEqual(['嵐山', '嵐山町', '阪急嵐山線']);
  });

  it('AC-30: 場所は最大 3 行', () => {
    const lats = [35.0, 35.1, 35.2, 35.3];
    const features = lats.map(lat => gsi('テスト駅', '13101', '1', [139.0, lat]));
    const spots = lats.map((lat, i) =>
      near(i + 1, makeSpot(`p${i}`, `寺${i}`, 'temple', '東京都', null, lat + 0.001, 139.0))
    );

    expect(rankGsiPlaces({ query: 'テスト駅', features, spots, order: 'nearby' })).toHaveLength(3);
  });

  it('2km 以内に寺社が無い場所は出さない', () => {
    expect(
      rankGsiPlaces({ query: '高座渋谷駅', features: [F3], spots: TEST_SPOTS, order: 'nearby' })
    ).toEqual([]);
  });

  it('寺社の数え方は渡された寺社（神社・寺院の絞り込みのあと）で', () => {
    const temples = TEST_SPOTS.filter(s => s.spot.type === 'temple');
    expect(
      rankGsiPlaces({ query: '渋谷駅', features: SHIBUYA_STATION, spots: temples, order: 'nearby' })
    ).toEqual([]);
  });

  it('AC-31: 第1段が0件なら、第2段の場所の行とその近くの寺社', () => {
    const rows = rowsFor('渋谷駅', { gsiFeatures: SHIBUYA_STATION });

    expect(shape(rows)).toEqual(['place:東京都', 'spot:x1', 'spot:t1', 'spot:t2']);
    expect((rows[0] as PlaceRow).label).toBe('渋谷駅');
    expect((rows[0] as PlaceRow).external).toBe(true);
  });

  it('AC-31: 第1段に当たる言葉では、第2段の答えを渡しても使わない', () => {
    expect(rowsFor('横浜', { gsiFeatures: SHIBUYA_STATION })).toEqual(rowsFor('横浜'));
  });

  it('第2段の答えが無い（null・空）なら行は無い', () => {
    expect(rowsFor('渋谷駅', { gsiFeatures: null })).toEqual([]);
    expect(rowsFor('渋谷駅', { gsiFeatures: [] })).toEqual([]);
    expect(rowsFor('渋谷駅', { gsiFeatures: [F1, F2] })).toEqual([]);
  });

  it('近くの寺社は、残った場所のどれかから 2km 以内を入力の順に1回ずつ', () => {
    // 渋谷駅と東京タワーの両方の場所が残る答え（D-9 ⑨）
    const features = [F4, gsi('渋谷駅', '13103', '1', [139.7454, 35.6586])];
    const rows = rowsFor('渋谷駅', { gsiFeatures: features });

    expect(places(rows)).toHaveLength(2);
    expect(
      rows.filter(r => r.kind === 'spot').map(r => (r.kind === 'spot' ? r.spot.id : ''))
    ).toEqual(['x1', 't1', 't2', 't5']);
  });

  it('F5 が F4 から 1km 以内なので1行にまとまる（念のため）', () => {
    expect(
      rankGsiPlaces({ query: '渋谷駅', features: [F5, F4], spots: TEST_SPOTS, order: 'nearby' })
    ).toHaveLength(1);
  });
});
