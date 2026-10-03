// 参拝の予定（Issue #258）。表は visit_plans / visit_plan_stops（本人だけが読み書き）
import { supabase } from '@services/supabase';
import type { VisitPlan, VisitPlanStop } from '@/types/visitPlan';

/** 同じ日にもう予定がある（UNIQUE (user_id, planned_on) / D-2） */
export class VisitPlanDateTakenError extends Error {
  constructor() {
    super('visit plan date taken');
    this.name = 'VisitPlanDateTakenError';
  }
}

interface PlanRow {
  id: string;
  planned_on: string;
  name: string;
  visit_plan_stops: {
    position: number;
    spot_id: string;
    spots: VisitPlanStop['spot'] | null;
  }[];
}

/**
 * 本人の予定をすべて、日付の昇順で。寺社が見えない stop（merged・他人の pending）は落とす（D-4）。
 * 失敗は投げる（空のカレンダーと区別する / D-25）
 */
export async function fetchVisitPlans(): Promise<VisitPlan[]> {
  const { data, error } = await supabase
    .from('visit_plans')
    .select(
      'id, planned_on, name, visit_plan_stops(position, spot_id, spots(id, name, type, lat, lng))'
    )
    .order('planned_on', { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as PlanRow[]).map(row => ({
    id: row.id,
    plannedOn: row.planned_on,
    name: row.name,
    stops: row.visit_plan_stops
      .filter(s => s.spots !== null)
      .sort((a, b) => a.position - b.position)
      .map(s => ({ spotId: s.spot_id, position: s.position, spot: s.spots! })),
  }));
}

/** 予定を1回で保存する（新規は planId なし）。寺社は渡した順に position 0.. で入る（D-1） */
export async function saveVisitPlan(params: {
  planId?: string;
  plannedOn: string;
  name: string;
  spotIds: string[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_visit_plan', {
    p_plan_id: params.planId ?? null,
    p_planned_on: params.plannedOn,
    p_name: params.name,
    p_spot_ids: params.spotIds,
  });
  if (error) {
    if (error.code === '23505') throw new VisitPlanDateTakenError();
    throw new Error(error.message);
  }
  return data as string;
}

/** 予定を消す（寺社の行は CASCADE で消える / D-15） */
export async function deleteVisitPlan(id: string): Promise<void> {
  const { error } = await supabase.from('visit_plans').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * その日付に本人が記録した寺社（過ぎた予定の ✓ / D-11）。日付 → spot_id の Set。
 * user_id で絞る（公開の御朱印は他人にも見えるので、RLS だけに任せると他人の記録で ✓ が付く）。
 * 失敗は空（✓ を出さないだけ / D-25）
 */
export async function fetchVisitedSpotIdsByDate(
  userId: string,
  dates: string[]
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (dates.length === 0) return result;

  const { data, error } = await supabase
    .from('stamps')
    .select('spot_id, visited_at')
    .eq('user_id', userId)
    .in('visited_at', dates);
  if (error) {
    console.warn('fetchVisitedSpotIdsByDate error:', error.message);
    return result;
  }

  for (const row of (data ?? []) as { spot_id: string; visited_at: string }[]) {
    const set = result.get(row.visited_at) ?? new Set<string>();
    set.add(row.spot_id);
    result.set(row.visited_at, set);
  }
  return result;
}
