import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@hooks/useAuth';
import {
  deleteVisitPlan,
  fetchVisitPlans,
  fetchVisitedSpotIdsByDate,
  saveVisitPlan,
} from '@services/visitPlans';
import { fetchReceptionHours } from '@services/spotInfo';
import type { Spot } from '@/types/supabase';
import type { VisitPlan } from '@/types/visitPlan';
import { formatPlanDate } from '@utils/planDate';
import { isPastPlan, parseClock, suggestOrder, type PlanPoint } from '@utils/visitPlan';

export type PlanSpot = Pick<Spot, 'id' | 'name' | 'type' | 'lat' | 'lng'>;
export type PlanEditorMode = 'build' | 'order' | 'readonly';

interface Params {
  planId?: string;
  date?: string;
  /** 地図に出している寺社（useSpots）。予定の寺社の名前・座標はここと予定の中身から引く */
  spots: PlanSpot[];
  today: Date;
}

/** 空のまま保存したときの名前（D-18） */
export function defaultPlanName(plannedOn: string): string {
  const [, m, d] = plannedOn.split('-').map(Number);
  return `${m}月${d}日の予定`;
}

/**
 * 予定を組む画面の状態（Issue #258）。② 寺社を選ぶ → ③ 順番 → 保存、と保存済みを開いた ③' 読むだけ。
 * グローバル状態は使わない（画面のローカル state だけ）
 */
export function usePlanEditor({ planId, date, spots, today }: Params) {
  const { user } = useAuth();
  const [mode, setMode] = useState<PlanEditorMode>(planId ? 'readonly' : 'build');
  const [plannedOn, setPlannedOn] = useState(date ?? '');
  const [chosen, setChosen] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [suggested, setSuggested] = useState(false);
  const [plan, setPlan] = useState<VisitPlan | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(planId));
  const [reception, setReception] = useState<Map<string, string>>(new Map());
  const [visited, setVisited] = useState<Set<string>>(new Set());

  // 保存済みの予定を開いたとき
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    fetchVisitPlans()
      .then(plans => {
        if (cancelled) return;
        const found = plans.find(p => p.id === planId) ?? null;
        setPlan(found);
        if (found) {
          const ids = found.stops.map(s => s.spotId);
          setPlannedOn(found.plannedOn);
          setOrder(ids);
          setChosen(ids);
          // 受付時間は取れなければ出さないだけ（D-25）
          fetchReceptionHours(ids)
            .then(m => {
              if (!cancelled) setReception(m);
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const spotIndex = useMemo(() => {
    const m = new Map<string, PlanSpot>(spots.map(s => [s.id, s]));
    for (const s of plan?.stops ?? []) if (!m.has(s.spotId)) m.set(s.spotId, s.spot);
    return m;
  }, [spots, plan]);

  const past = mode === 'readonly' && plannedOn !== '' && isPastPlan(plannedOn, today);

  // 過ぎた予定は、その日に記録した寺社に ✓（D-11）
  useEffect(() => {
    if (!past || !user) return;
    let cancelled = false;
    fetchVisitedSpotIdsByDate(user.id, [plannedOn])
      .then(m => {
        if (!cancelled) setVisited(m.get(plannedOn) ?? new Set());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [past, plannedOn, user]);

  const pointOf = useCallback(
    (id: string): PlanPoint | null => {
      const s = spotIndex.get(id);
      if (!s) return null;
      return { spotId: id, lat: s.lat, lng: s.lng, closeMinutes: parseClock(reception.get(id)) };
    },
    [spotIndex, reception]
  );

  const add = useCallback((id: string) => setChosen(c => (c.includes(id) ? c : [...c, id])), []);
  const remove = useCallback((id: string) => setChosen(c => c.filter(x => x !== id)), []);

  /** 順番を決める: 位置と受付時間から提案する（無料 / D-6） */
  const decide = useCallback(async () => {
    const hours = await fetchReceptionHours(chosen).catch(() => new Map<string, string>());
    setReception(hours);
    const points = chosen
      .map(id => {
        const s = spotIndex.get(id);
        return s
          ? { spotId: id, lat: s.lat, lng: s.lng, closeMinutes: parseClock(hours.get(id)) }
          : null;
      })
      .filter((p): p is PlanPoint => p !== null);
    setOrder(suggestOrder(points));
    setSuggested(true);
    setMode('order');
  }, [chosen, spotIndex]);

  const move = useCallback(
    (from: number, to: number) => {
      // 動かない並べ替え（⋮⋮ を軽く押しただけ・端から外へ）では提案のバナーを消さない
      if (to < 0 || to >= order.length || from === to) return;
      setOrder(o => {
        const next = [...o];
        const [m] = next.splice(from, 1);
        next.splice(to, 0, m);
        return next;
      });
      setSuggested(false);
    },
    [order.length]
  );

  /** カードを開いた寺社の受付時間を先に引く（② のカードに「受付 〜」を出す） */
  const peekReception = useCallback((id: string) => {
    fetchReceptionHours([id])
      .then(m => {
        const close = m.get(id);
        if (close) setReception(r => new Map(r).set(id, close));
      })
      .catch(() => {});
  }, []);

  /** 選び直す: 今の順番のまま②へ */
  const reselect = useCallback(() => {
    setChosen(order);
    setMode('build');
  }, [order]);

  /** 編集: 見える寺社が1社以下なら②から（D-23） */
  const edit = useCallback(() => {
    setChosen(order);
    setMode(order.length >= 2 ? 'order' : 'build');
    setSuggested(false);
  }, [order]);

  const save = useCallback(
    async (name: string) => {
      await saveVisitPlan({
        planId: plan?.id,
        plannedOn,
        name: name.trim() || defaultPlanName(plannedOn),
        spotIds: order,
      });
      return plannedOn;
    },
    [plan, plannedOn, order]
  );

  const removePlan = useCallback(async () => {
    if (plan) await deleteVisitPlan(plan.id);
  }, [plan]);

  const points = order.map(pointOf).filter((p): p is PlanPoint => p !== null);

  return {
    mode,
    plannedOn,
    dateLabel: plannedOn ? formatPlanDate(plannedOn) : '',
    setPlannedOn,
    chosen,
    order,
    points,
    suggested,
    plan,
    isLoading,
    reception,
    visited,
    past,
    spotIndex,
    add,
    remove,
    decide,
    move,
    peekReception,
    reselect,
    edit,
    save,
    deletePlan: removePlan,
  };
}
