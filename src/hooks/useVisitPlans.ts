import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '@hooks/useAuth';
import { fetchVisitPlans, fetchVisitedSpotIdsByDate } from '@services/visitPlans';
import type { VisitPlan } from '@/types/visitPlan';
import { isPastPlan } from '@utils/visitPlan';

interface UseVisitPlansReturn {
  plans: VisitPlan[];
  /** 過ぎた予定の日付 → その日に記録した寺社（✓ の判定。取れなければ空） */
  visitedByDate: Map<string, Set<string>>;
  isLoading: boolean;
  /** 予定を読み込めなかった（空のカレンダーと区別する / D-25） */
  error: boolean;
  reload: () => void;
}

/** 予定の一覧（Issue #258）。予定を組む画面から戻ったときに取り直すので、フォーカスのたびに読む */
export function useVisitPlans(today: Date = new Date()): UseVisitPlansReturn {
  const { isAuthenticated, user } = useAuth();
  const [plans, setPlans] = useState<VisitPlan[]>([]);
  const [visitedByDate, setVisitedByDate] = useState<Map<string, Set<string>>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const todayKey = today.toDateString();

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated || !user) {
        setPlans([]);
        setIsLoading(false);
        return;
      }
      let cancelled = false;
      (async () => {
        setIsLoading(true);
        try {
          const loaded = await fetchVisitPlans();
          if (cancelled) return;
          setPlans(loaded);
          setError(false);
          const pastDates = loaded
            .map(p => p.plannedOn)
            .filter(d => isPastPlan(d, new Date(todayKey)));
          // その日の記録が取れなくても、✓ を出さないだけにする（誤情報にしない）
          const visited =
            pastDates.length > 0
              ? await fetchVisitedSpotIdsByDate(user.id, pastDates).catch(() => new Map())
              : new Map();
          if (!cancelled) setVisitedByDate(visited);
        } catch {
          if (!cancelled) setError(true);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [isAuthenticated, user, nonce, todayKey])
  );

  const reload = useCallback(() => setNonce(n => n + 1), []);

  return { plans, visitedByDate, isLoading, error, reload };
}
