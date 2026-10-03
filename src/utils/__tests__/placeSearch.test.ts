import type { Spot } from '@/types/supabase';
import {
  buildSearchRows,
  hasLocalHits,
  normalizeQuery,
  regionOfSpots,
  type PlaceRow,
  type SearchRow,
  type SpotWithDistance,
} from '@utils/placeSearch';

function makeSpot(
  id: string,
  name: string,
  type: Spot['type'],
  prefecture: string | null,
  address: string | null,
  lat: number,
  lng: number
): Spot {
  return {
    id,
    name,
    type,
    prefecture,
    address,
    lat,
    lng,
    rank: 3,
    status: 'active',
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function near(distance: number, spot: Spot): SpotWithDistance {
  return { spot, distance };
}

// 契約書「テストの寺社」。この順＝近い順（distance は自分からの距離 km）。n1・s1・q2・x1 の住所は架空
const T = '東京都';
const K = '神奈川県';
const TEST_SPOTS: SpotWithDistance[] = [
  near(
    3,
    makeSpot(
      'x1',
      '明治神宮内の稲荷社',
      'shrine',
      T,
      '東京都渋谷区代々木神園町1-2',
      35.675,
      139.699
    )
  ),
  near(4, makeSpot('t4', '靖國神社', 'shrine', T, '東京都千代田区九段北3-1-1', 35.6942, 139.7437)),
  near(
    5,
    makeSpot('t1', '明治神宮', 'shrine', T, '東京都渋谷区代々木神園町1-1', 35.6764, 139.6993)
  ),
  near(6, makeSpot('t2', '金王八幡宮', 'shrine', T, '東京都渋谷区渋谷3-5-12', 35.6575, 139.705)),
  near(7, makeSpot('t5', '増上寺', 'temple', T, '東京都港区芝公園4-7-35', 35.6574, 139.7484)),
  near(9, makeSpot('t6', '牛嶋神社', 'shrine', T, '東京都墨田区向島1-4-5', 35.7109, 139.8048)),
  near(20, makeSpot('t3', '大國魂神社', 'shrine', T, '東京都府中市宮町3-1', 35.6693, 139.478)),
  near(22, makeSpot('q2', '八坂神社', 'shrine', T, '東京都東村山市野口町1-1', 35.76, 139.47)),
  near(
    25,
    makeSpot('y3', '菊名神社', 'shrine', K, '神奈川県横浜市港北区菊名6-5-14', 35.5103, 139.6302)
  ),
  near(
    30,
    makeSpot(
      'y1',
      '成田山横浜別院延命院',
      'temple',
      K,
      '神奈川県横浜市西区宮崎町30',
      35.4497,
      139.6267
    )
  ),
  near(
    31,
    makeSpot('y2', '伊勢山皇大神宮', 'shrine', K, '神奈川県横浜市西区宮崎町64', 35.4503, 139.6275)
  ),
  near(
    45,
    makeSpot('k1', '鶴岡八幡宮', 'shrine', K, '神奈川県鎌倉市雪ノ下2-1-31', 35.3259, 139.5565)
  ),
  near(100, makeSpot('n1', '八幡神社', 'shrine', '山梨県', '山梨県甲府市府中町1', 35.662, 138.568)),
  near(
    200,
    makeSpot('s1', '若宮神社', 'shrine', '静岡県', '静岡県浜松市中央区八坂町1', 34.71, 137.73)
  ),
  near(
    370,
    makeSpot(
      'q1',
      '八坂神社',
      'shrine',
      '京都府',
      '京都府京都市東山区祇園町北側625',
      35.0037,
      135.7785
    )
  ),
  near(400, makeSpot('m1', '手で足した寺', 'temple', null, null, 35.0, 135.0)),
];

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
