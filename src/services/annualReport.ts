import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@services/supabase';
import { autoPlayStorageKey, type AnnualPilgrimage, type AnnualVisit } from '@utils/annualReport';
import type { SpotType } from '@/types/supabase';

/**
 * 年報のデータ（Issue #274 D-14）。
 *
 * **失敗は throw する**。空の年報（その年の記録が0件）と、読めなかったことを区別するため
 */

type StampRow = {
  id: string;
  spot_id: string;
  visited_at: string;
  created_at: string;
  image_path: string | null;
  spots: { name: string; type: SpotType; prefecture: string | null };
};

type PilgrimageRow = {
  id: string;
  name: string;
  pilgrimage_spots: { spot_id: string }[];
};

/**
 * 本人の全件の記録と、巡礼の札所。前の年の記録も要る（印・はじめての県・満願）。
 * Supabase の既定の上限（1000行）を超える人は切れる（fetchVisitLog と同じ制約）
 */
export async function fetchAnnualReportSource(
  userId: string
): Promise<{ visits: AnnualVisit[]; pilgrimages: AnnualPilgrimage[] }> {
  const [stamps, pilgrimages] = await Promise.all([
    supabase
      .from('stamps')
      .select(
        'id, spot_id, visited_at, created_at, image_path, spots!inner(name, type, prefecture)'
      )
      .eq('user_id', userId),
    supabase
      .from('pilgrimages')
      .select('id, name, pilgrimage_spots(spot_id)')
      .eq('is_active', true),
  ]);

  if (stamps.error) throw new Error(stamps.error.message);
  if (pilgrimages.error) throw new Error(pilgrimages.error.message);

  const visits = (stamps.data as unknown as StampRow[]).map(row => ({
    id: row.id,
    spotId: row.spot_id,
    visitedAt: row.visited_at,
    createdAt: row.created_at,
    imagePath: row.image_path,
    spotName: row.spots.name,
    spotType: row.spots.type,
    prefecture: row.spots.prefecture,
  }));

  return {
    visits,
    pilgrimages: (pilgrimages.data as unknown as PilgrimageRow[]).map(row => ({
      id: row.id,
      name: row.name,
      spotIds: row.pilgrimage_spots.map(ps => ps.spot_id),
    })),
  };
}

/** その年（日本時間の暦年の visited_at）の本人の記録の数。自動再生の判定に使う */
export async function countStampsInYear(userId: string, year: number): Promise<number> {
  const { count, error } = await supabase
    .from('stamps')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('visited_at', `${year}-01-01`)
    .lte('visited_at', `${year}-12-31`);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/* ── 自動再生を出したかの印（その年・そのアカウントごと。端末に覚える） ── */

export async function readAutoPlayShown(year: number, userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(autoPlayStorageKey(year, userId))) === 'true';
}

export async function markAutoPlayShown(year: number, userId: string): Promise<void> {
  await AsyncStorage.setItem(autoPlayStorageKey(year, userId), 'true');
}

/** 開発用。「12月として自動再生を試す」で消す */
export async function clearAutoPlayShown(year: number, userId: string): Promise<void> {
  await AsyncStorage.removeItem(autoPlayStorageKey(year, userId));
}
