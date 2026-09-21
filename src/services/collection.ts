import { supabase } from '@services/supabase';

export async function fetchCollectionStats(userId: string): Promise<{
  spotCount: number;
  stampCount: number;
}> {
  const { data, error } = await supabase.from('stamps').select('spot_id').eq('user_id', userId);

  if (error) {
    console.warn('fetchCollectionStats error:', error.message);
    return { spotCount: 0, stampCount: 0 };
  }

  const rows = data as { spot_id: string }[];
  const spotCount = new Set(rows.map(row => row.spot_id)).size;
  const stampCount = rows.length;

  return { spotCount, stampCount };
}

/**
 * 県ごとの集計。あゆみ画面の地図が使う。
 *
 * `visitedCount`（箇所数）と `stampCount`（枚数）は別物。**地図の濃さは枚数**で
 * 決めるので、同じ寺社に何度も通った県が「1」に潰れないようにする。
 */
export interface RegionStat {
  prefecture: string;
  /** その県で訪れた寺社の数（spot_id で重複排除） */
  visitedCount: number;
  /** その県で授かった御朱印の枚数 */
  stampCount: number;
  /** その県にある寺社の総数（県別画面の分母） */
  totalCount: number;
}

export async function fetchRegionStats(userId: string): Promise<RegionStat[]> {
  const { data: stampsData, error: stampsError } = await supabase
    .from('stamps')
    .select('spot_id, spots!inner(prefecture)')
    .eq('user_id', userId);

  if (stampsError) {
    console.warn('fetchRegionStats error:', stampsError.message);
    return [];
  }

  const { data: allSpotsData, error: allSpotsError } = await supabase
    .from('spots')
    .select('prefecture')
    .eq('status', 'active')
    .not('prefecture', 'is', null);

  if (allSpotsError) {
    console.warn('fetchRegionStats error:', allSpotsError.message);
    return [];
  }

  const rows = stampsData as unknown as {
    spot_id: string;
    spots: { prefecture: string | null };
  }[];

  const prefectureMap = new Map<string, { spotIds: Set<string>; stampCount: number }>();

  for (const row of rows) {
    const prefecture = row.spots.prefecture;
    if (prefecture === null) continue;

    const acc = prefectureMap.get(prefecture) ?? { spotIds: new Set<string>(), stampCount: 0 };
    acc.spotIds.add(row.spot_id);
    acc.stampCount += 1;
    prefectureMap.set(prefecture, acc);
  }

  const totalCountMap = new Map<string, number>();
  for (const spot of allSpotsData as { prefecture: string }[]) {
    totalCountMap.set(spot.prefecture, (totalCountMap.get(spot.prefecture) ?? 0) + 1);
  }

  const allPrefectures = new Set([...prefectureMap.keys(), ...totalCountMap.keys()]);

  return Array.from(allPrefectures).map(prefecture => {
    const acc = prefectureMap.get(prefecture);
    return {
      prefecture,
      visitedCount: acc?.spotIds.size ?? 0,
      stampCount: acc?.stampCount ?? 0,
      totalCount: totalCountMap.get(prefecture) ?? 0,
    };
  });
}

/**
 * その県にある寺社の数。県別画面の「3 / 20箇所」の分母。
 *
 * 県ごとの集計（fetchRegionStats）は47県ぶんを一度に出す重いクエリなので、
 * 1県だけ知りたいここでは使わない。
 */
export async function fetchSpotCountByPrefecture(prefecture: string): Promise<number> {
  const { count, error } = await supabase
    .from('spots')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('prefecture', prefecture);

  if (error) {
    console.warn('fetchSpotCountByPrefecture error:', error.message);
    return 0;
  }
  return count ?? 0;
}
