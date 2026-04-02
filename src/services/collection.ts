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

export async function fetchRegionStats(userId: string): Promise<
  {
    prefecture: string;
    visitedCount: number;
    totalCount: number;
  }[]
> {
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

  const rows = stampsData as unknown as { spot_id: string; spots: { prefecture: string | null } }[];

  const prefectureMap = new Map<string, Set<string>>();

  for (const row of rows) {
    const prefecture = row.spots.prefecture;
    if (prefecture === null) continue;

    const spotIds = prefectureMap.get(prefecture) ?? new Set<string>();
    spotIds.add(row.spot_id);
    prefectureMap.set(prefecture, spotIds);
  }

  const totalCountMap = new Map<string, number>();
  for (const spot of allSpotsData as { prefecture: string }[]) {
    const current = totalCountMap.get(spot.prefecture) ?? 0;
    totalCountMap.set(spot.prefecture, current + 1);
  }

  const allPrefectures = new Set([...prefectureMap.keys(), ...totalCountMap.keys()]);

  return Array.from(allPrefectures).map(prefecture => ({
    prefecture,
    visitedCount: prefectureMap.get(prefecture)?.size ?? 0,
    totalCount: totalCountMap.get(prefecture) ?? 0,
  }));
}
