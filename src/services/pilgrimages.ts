import { supabase } from '@services/supabase';
import type { Spot } from '@/types/supabase';

export interface PilgrimageProgress {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  totalSpots: number;
  visitedCount: number;
}

type PilgrimageRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  total_spots: number;
  pilgrimage_spots: { spot_id: string }[];
};

export async function fetchPilgrimageProgress(userId: string): Promise<PilgrimageProgress[]> {
  const { data: pilgrimages, error: pilgrimagesError } = await supabase
    .from('pilgrimages')
    .select('id, name, description, category, total_spots, pilgrimage_spots(spot_id)')
    .eq('is_active', true);

  if (pilgrimagesError) {
    console.warn('fetchPilgrimageProgress error:', pilgrimagesError.message);
    return [];
  }

  const { data: stamps, error: stampsError } = await supabase
    .from('stamps')
    .select('spot_id')
    .eq('user_id', userId);

  if (stampsError) {
    console.warn('fetchPilgrimageProgress error:', stampsError.message);
    return [];
  }

  const visitedSpotIds = new Set((stamps as { spot_id: string }[]).map(s => s.spot_id));

  const rows = pilgrimages as unknown as PilgrimageRow[];

  const result: PilgrimageProgress[] = rows.map(pilgrimage => {
    const spotIds = pilgrimage.pilgrimage_spots.map(ps => ps.spot_id);
    const visitedCount = spotIds.filter(id => visitedSpotIds.has(id)).length;

    return {
      id: pilgrimage.id,
      name: pilgrimage.name,
      description: pilgrimage.description,
      category: pilgrimage.category,
      totalSpots: pilgrimage.total_spots,
      visitedCount,
    };
  });

  result.sort((a, b) => {
    const rateA = a.totalSpots > 0 ? a.visitedCount / a.totalSpots : 0;
    const rateB = b.totalSpots > 0 ? b.visitedCount / b.totalSpots : 0;
    return rateB - rateA;
  });

  return result;
}

export interface PilgrimageSpotWithDetail {
  id: string;
  sortOrder: number | null;
  label: string | null;
  spot: Spot;
}

type PilgrimageSpotRow = {
  id: string;
  sort_order: number | null;
  label: string | null;
  spots: Spot;
};

export async function fetchPilgrimageSpots(
  pilgrimageId: string
): Promise<PilgrimageSpotWithDetail[]> {
  const { data, error } = await supabase
    .from('pilgrimage_spots')
    .select('id, sort_order, label, spots!inner(*)')
    .eq('pilgrimage_id', pilgrimageId)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (error) {
    console.warn('fetchPilgrimageSpots error:', error.message);
    return [];
  }

  const rows = data as unknown as PilgrimageSpotRow[];

  return rows.map(row => ({
    id: row.id,
    sortOrder: row.sort_order,
    label: row.label,
    spot: row.spots,
  }));
}
