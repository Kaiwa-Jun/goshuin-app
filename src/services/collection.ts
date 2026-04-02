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
  }[]
> {
  const { data, error } = await supabase
    .from('stamps')
    .select('spot_id, spots!inner(prefecture)')
    .eq('user_id', userId);

  if (error) {
    console.warn('fetchRegionStats error:', error.message);
    return [];
  }

  const rows = data as unknown as { spot_id: string; spots: { prefecture: string | null } }[];

  const prefectureMap = new Map<string, Set<string>>();

  for (const row of rows) {
    const prefecture = row.spots.prefecture;
    if (prefecture === null) continue;

    const spotIds = prefectureMap.get(prefecture) ?? new Set<string>();
    spotIds.add(row.spot_id);
    prefectureMap.set(prefecture, spotIds);
  }

  return Array.from(prefectureMap.entries()).map(([prefecture, spotIds]) => ({
    prefecture,
    visitedCount: spotIds.size,
  }));
}
