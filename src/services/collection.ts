import { supabase } from '@services/supabase';
import { PREFECTURE_NAMES } from '../../supabase/functions/_shared/prefectures';

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

/**
 * 月参りとバッジの判定に要る、参拝の記録だけ。
 *
 * 画像のパスやメモは要らないので、御朱印帳の取得（fetchAllStamps）は使わない。
 * この1本で、あゆみの月参り一覧とバッジの進み具合の両方が出せる。
 */
export interface VisitLogRow {
  spot_id: string;
  visited_at: string;
  spotName: string;
  spotType: string;
  /** 寺社の位置と住所。あゆみの「よく行くエリア」に使う（Issue #245） */
  lat?: number;
  lng?: number;
  address?: string | null;
  prefecture?: string | null;
}

export async function fetchVisitLog(userId: string): Promise<VisitLogRow[]> {
  const { data, error } = await supabase
    .from('stamps')
    .select('spot_id, visited_at, spots!inner(name, type, lat, lng, address, prefecture)')
    .eq('user_id', userId);

  if (error) {
    console.warn('fetchVisitLog error:', error.message);
    return [];
  }

  const rows = data as unknown as {
    spot_id: string;
    visited_at: string;
    spots: {
      name: string;
      type: string;
      lat: number;
      lng: number;
      address: string | null;
      prefecture: string | null;
    };
  }[];

  return rows.map(row => ({
    spot_id: row.spot_id,
    visited_at: row.visited_at,
    spotName: row.spots.name,
    spotType: row.spots.type,
    lat: row.spots.lat,
    lng: row.spots.lng,
    address: row.spots.address,
    prefecture: row.spots.prefecture,
  }));
}

/**
 * 寺社を調べる前に聞く地域の選択肢（Issue #277）。自分の記録にある県を、新しい順に最大3つ。
 *
 * 「新しい順」は御朱印帳と同じ 参拝日 → 記録した日。同じ県ばかり記録している人の2つ目・3つ目が
 * 落ちないよう、件数は絞らずに取って端末で重複を除く。手入力で追加した寺社（県が null）と、
 * 47都道府県に無い値（research-spot が捨てて全国になる）は飛ばす
 */
export const RECENT_PREFECTURE_COUNT = 3;
const PREFECTURES = new Set(PREFECTURE_NAMES);

export async function fetchRecentPrefectures(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('stamps')
    .select('spots!inner(prefecture)')
    .eq('user_id', userId)
    .order('visited_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchRecentPrefectures error:', error.message);
    return [];
  }

  const found: string[] = [];
  for (const row of data as unknown as { spots: { prefecture: string | null } }[]) {
    const prefecture = row.spots.prefecture;
    if (!prefecture || !PREFECTURES.has(prefecture) || found.includes(prefecture)) continue;
    found.push(prefecture);
    if (found.length === RECENT_PREFECTURE_COUNT) break;
  }
  return found;
}
