// 契約書（docs/issues/issue-311-place-search.md）の「テストの寺社」と国土地理院の答えの見本。
// placeSearch と検索画面のフックのテストで共有する。
// ファイル名に .test を付けない（jest の testMatch に拾わせない）
import type { Spot } from '@/types/supabase';
import type { GsiFeature, SpotWithDistance } from '@utils/placeSearch';

export function makeSpot(
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

export function near(distance: number, spot: Spot): SpotWithDistance {
  return { spot, distance };
}

// 契約書「テストの寺社」。この順＝近い順（distance は自分からの距離 km）。n1・s1・q2・x1 の住所は架空
const T = '東京都';
const K = '神奈川県';
export const TEST_SPOTS: SpotWithDistance[] = [
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

/** 国土地理院の住所検索の答えの1件。coordinates は [経度, 緯度] */
export function gsi(
  title: string,
  addressCode: string,
  dataSource: string | undefined,
  coordinates: [number, number]
): GsiFeature {
  return {
    geometry: { coordinates },
    properties:
      dataSource === undefined ? { title, addressCode } : { title, addressCode, dataSource },
  };
}

// 契約書の「国土地理院の答えの見本」
export const F1 = gsi('千葉県茂原市渋谷', '', undefined, [140.3016, 35.4667]);
export const F2 = gsi('渋谷警察署渋谷駅前交番', '13113', '3', [139.7011, 35.6593]);
export const F3 = gsi('高座渋谷駅', '14213', '1', [139.4649, 35.4324]);
export const F4 = gsi('渋谷駅', '13113', '1', [139.7029, 35.6588]);
export const F5 = gsi('渋谷駅', '13113', '1', [139.6967, 35.6586]);
export const SHIBUYA_STATION = [F1, F2, F3, F4, F5];

export const G1 = gsi('東京スカイツリー', '13107', '1', [139.8107, 35.7095]);
export const G2 = gsi('とうきょうスカイツリー駅', '13107', '1', [139.8093, 35.7167]);

export const H1 = gsi('北海道札幌市東区', '', undefined, [141.36, 43.08]);
export const H2 = gsi('愛宕警察署東京タワー前交番', '13103', '3', [139.748, 35.659]);
export const H3 = gsi('東京タワー', '13103', '1', [139.7454, 35.6586]);
export const TOKYO_TOWER = [H1, H2, H3];

export const I3 = gsi('埼玉県比企郡嵐山町', '', undefined, [139.32, 36.057]);
export const I1 = gsi('嵐山', '26111', '4', [135.6735, 35.011]);
export const I2 = gsi('阪急嵐山線', '26111', '1', [135.7, 34.99]);
