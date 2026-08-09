import * as Location from 'expo-location';
import { pickAutoSelectableSpot } from '@utils/autoSelectSpot';
import type { SpotWithDistance } from '@hooks/useNearbySpots';
import type { Spot } from '@/types/supabase';

function makeSpot(id: string, name: string): Spot {
  return {
    id,
    name,
    lat: 38.2744,
    lng: 140.8577,
    type: 'shrine',
    address: '宮城県仙台市青葉区八幡4-6-1',
    prefecture: null,
    status: 'active',
    rank: 3,
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };
}

const near: SpotWithDistance = { spot: makeSpot('spot-1', '大崎八幡宮'), distanceKm: 0.12 };
const far: SpotWithDistance = { spot: makeSpot('spot-2', '榴岡天満宮'), distanceKm: 3.4 };

describe('pickAutoSelectableSpot', () => {
  // D-2
  it('許可済みで最寄りが 0.5km 以内なら、そのスポットを返す', () => {
    expect(pickAutoSelectableSpot([near, far], Location.PermissionStatus.GRANTED)).toEqual(
      near.spot
    );
  });

  // D-3: useLocation は未許可でも DEFAULT_LOCATION（仙台）を返すため、
  // 距離だけを見ると東京にいるユーザーに仙台のスポットを選んでしまう
  it('位置情報が未許可なら、距離が近くても選ばない', () => {
    expect(pickAutoSelectableSpot([near], Location.PermissionStatus.DENIED)).toBeNull();
    expect(pickAutoSelectableSpot([near], Location.PermissionStatus.UNDETERMINED)).toBeNull();
    expect(pickAutoSelectableSpot([near], null)).toBeNull();
  });

  // D-4: 帰宅後の記録で自宅近くの寺社を選ばないための境界
  it('最寄りが 0.5km を超えるなら選ばない', () => {
    expect(pickAutoSelectableSpot([far], Location.PermissionStatus.GRANTED)).toBeNull();
  });

  it('ちょうど 0.5km は選ぶ', () => {
    const boundary: SpotWithDistance = { spot: makeSpot('spot-3', '境界'), distanceKm: 0.5 };
    expect(pickAutoSelectableSpot([boundary], Location.PermissionStatus.GRANTED)).toEqual(
      boundary.spot
    );
  });

  it('0.5km をわずかに超えたら選ばない', () => {
    const justOver: SpotWithDistance = { spot: makeSpot('spot-4', '境界外'), distanceKm: 0.501 };
    expect(pickAutoSelectableSpot([justOver], Location.PermissionStatus.GRANTED)).toBeNull();
  });

  it('候補が無ければ null', () => {
    expect(pickAutoSelectableSpot([], Location.PermissionStatus.GRANTED)).toBeNull();
  });

  // useNearbySpots は距離昇順で返すが、先頭が最寄りである前提に依存しない
  it('配列の順序に関係なく最も近いものを選ぶ', () => {
    expect(pickAutoSelectableSpot([far, near], Location.PermissionStatus.GRANTED)).toEqual(
      near.spot
    );
  });
});
