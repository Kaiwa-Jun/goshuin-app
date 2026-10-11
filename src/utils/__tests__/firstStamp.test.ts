import type { Spot } from '@/types/supabase';
import {
  FIRST_STAMP_CARD_TITLE,
  NEARBY_LIMIT,
  NEARBY_MAX_KM,
  ayumiFirstStampLine,
  firstStampCardSubtitle,
  nearbySheetTitle,
  nearbySpots,
  nearestPrefecture,
} from '@utils/firstStamp';

/** 今いる所。寺社はどれも経度 135 で、北へ km だけ離す（緯度 1 度 ≒ 111.195km） */
const O = { latitude: 35, longitude: 135 };
const KM_PER_DEG = 111.195;

function spotAt(id: string, km: number, prefecture: string | null, name: string): Spot {
  return {
    id,
    name,
    lat: 35 + km / KM_PER_DEG,
    lng: 135,
    type: 'shrine',
    address: null,
    prefecture,
    status: 'active',
    rank: 3,
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const s1 = spotAt('s1', 0.3, null, 'あ');
const s2 = spotAt('s2', 0.8, '京都府', 'い');
const s3 = spotAt('s3', 1.2, '滋賀県', 'う');
const s4 = spotAt('s4', 2.0, '京都府', 'え');
const s5 = spotAt('s5', 3.0, '大阪府', 'お');
const s6 = spotAt('s6', 4.0, '奈良県', 'か');
const s7 = spotAt('s7', 60, '兵庫県', 'き');

/** 並べ替えていない入力 */
const F = [s5, s7, s2, s6, s1, s4, s3];

describe('nearbySpots', () => {
  it('50km 以内を近い順に 5 件、距離つきで返す', () => {
    const result = nearbySpots(F, O);

    expect(result.map(r => r.spot.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    [0.3, 0.8, 1.2, 2.0, 3.0].forEach((km, i) => {
      expect(result[i].distanceKm).toBeCloseTo(km, 2);
    });
  });

  it('入力の並びを変えない', () => {
    const before = F.map(s => s.id);
    nearbySpots(F, O);
    expect(F.map(s => s.id)).toEqual(before);
  });

  it('件数を広げても、50km より遠い寺社は入らない', () => {
    const result = nearbySpots(F, O, { limit: 10 });
    expect(result).toHaveLength(6);
    expect(result.map(r => r.spot.id)).not.toContain('s7');
  });

  it('今いる所が分からなければ空', () => {
    expect(nearbySpots(F, null)).toEqual([]);
  });

  it('範囲と件数の既定は 50km・5 件', () => {
    expect(NEARBY_MAX_KM).toBe(50);
    expect(NEARBY_LIMIT).toBe(5);
  });

  it('同じ距離なら名前の順', () => {
    const a = spotAt('k', 1, '京都府', '清水寺');
    const b = spotAt('y', 1, '京都府', '八坂神社');
    const expected = ['八坂神社', '清水寺'].sort((x, y) => x.localeCompare(y, 'ja'));

    expect(nearbySpots([a, b], O).map(r => r.spot.name)).toEqual(expected);
    expect(nearbySpots([b, a], O).map(r => r.spot.name)).toEqual(expected);
  });
});

describe('nearestPrefecture', () => {
  it('県の分かる寺社のうち、いちばん近い寺社の県（県が null の寺社は飛ばす）', () => {
    expect(nearestPrefecture(F, O)).toBe('京都府');
  });

  it('50km 以内に無い・県が分からない・今いる所が分からないときは null', () => {
    expect(nearestPrefecture([s7], O)).toBeNull();
    expect(nearestPrefecture([s1], O)).toBeNull();
    expect(nearestPrefecture(F, null)).toBeNull();
  });
});

describe('言葉', () => {
  it('カードの見出しは「日本地図に。」で改行する', () => {
    expect(FIRST_STAMP_CARD_TITLE).toBe('参拝したら、写真1枚で\n日本地図に。');
  });

  it('カードの下の行は、県が分かればその県、分からなければ「その県」', () => {
    expect(firstStampCardSubtitle('京都府')).toBe('撮ると、京都府に色が差します');
    expect(firstStampCardSubtitle('北海道')).toBe('撮ると、北海道に色が差します');
    expect(firstStampCardSubtitle(null)).toBe('撮ると、その県に色が差します');
  });

  it('あゆみの一言は、県が分からなければ日本地図', () => {
    expect(ayumiFirstStampLine('京都府')).toBe('最初の1枚で、京都府に色が差します。');
    expect(ayumiFirstStampLine(null)).toBe('最初の1枚で、日本地図に色が差します。');
  });

  it('近くの寺社の一覧の見出し（括弧は全角）', () => {
    expect(nearbySheetTitle(5)).toBe('近くの寺社（5）');
  });
});
