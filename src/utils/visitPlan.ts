// 参拝の予定の計算（Issue #258 / 契約書 D-6〜D-11）。入力を壊さない純関数だけ
import { calculateDistance } from '@utils/geo';

/** 寺社どうしの直線距離に掛ける（道なりはまっすぐではない） */
export const ROUTE_FACTOR = 1.3;
/** ここまでは歩く（直線 × 1.3 の m） */
export const WALK_MAX_METERS = 1500;
/** 歩く速さ（m/分） */
export const WALK_METERS_PER_MINUTE = 80;
/** 電車などの見積もり: 1km あたりの分と、乗り換えなどの分 */
export const TRANSIT_MINUTES_PER_KM = 4;
export const TRANSIT_OVERHEAD_MINUTES = 10;
/** 出発 9:00・各寺社に 30分 */
export const PLAN_START_MINUTES = 9 * 60;
export const STAY_MINUTES = 30;
/** 着く時刻がこれだけ受付の終わりより前でないと「間に合わないかも」（滞在のうちに受付を済ませる） */
export const LATE_MARGIN_MINUTES = 30;

export interface PlanPoint {
  spotId: string;
  lat: number;
  lng: number;
  /** 受付の終わり（0時からの分）。分からなければ null */
  closeMinutes: number | null;
}

export interface PlanLeg {
  mode: 'walk' | 'transit';
  minutes: number;
  km: number;
  label: string;
}

export interface ScheduledStop {
  spotId: string;
  arriveMinutes: number;
  late: boolean;
  /** 次の寺社までの区間。最後の寺社は null */
  leg: PlanLeg | null;
}

/** 直線距離（m）から区間の目安 */
export function estimateLegByMeters(straightMeters: number): PlanLeg {
  const d = straightMeters * ROUTE_FACTOR;
  const km = Math.round(d / 100) / 10;
  if (d <= WALK_MAX_METERS) {
    const minutes = Math.round(d / WALK_METERS_PER_MINUTE);
    return { mode: 'walk', minutes, km, label: `徒歩 約${minutes}分` };
  }
  const minutes = Math.round((d / 1000) * TRANSIT_MINUTES_PER_KM + TRANSIT_OVERHEAD_MINUTES);
  return { mode: 'transit', minutes, km, label: `電車などで移動・約${km.toFixed(1)}km` };
}

export function estimateLeg(
  a: Pick<PlanPoint, 'lat' | 'lng'>,
  b: Pick<PlanPoint, 'lat' | 'lng'>
): PlanLeg {
  return estimateLegByMeters(calculateDistance(a.lat, a.lng, b.lat, b.lng) * 1000);
}

/** 'H:MM' / 'HH:MM' を 0時からの分に。それ以外（「17時まで」など）は null */
export function parseClock(s: string | null | undefined): number | null {
  const m = s?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

export function formatClock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export function isLate(arriveMinutes: number, closeMinutes: number | null): boolean {
  return closeMinutes !== null && arriveMinutes > closeMinutes - LATE_MARGIN_MINUTES;
}

/** 回る順の着く時刻・間に合うか・区間 */
export function buildSchedule(stops: PlanPoint[]): ScheduledStop[] {
  let t = PLAN_START_MINUTES;
  return stops.map((s, i) => {
    const arriveMinutes = t;
    const next = stops[i + 1];
    const leg = next ? estimateLeg(s, next) : null;
    t += STAY_MINUTES + (leg?.minutes ?? 0);
    return { spotId: s.spotId, arriveMinutes, late: isLate(arriveMinutes, s.closeMinutes), leg };
  });
}

/**
 * 順番の提案。出発点を全通り試し、それぞれ「いまいる寺社から一番近い寺社へ」を繰り返す（最近傍）。
 * ①受付に間に合わない数 → ②区間の分の合計 が少ない方を採る。同点は先に試した方（入力順）
 */
export function suggestOrder(stops: PlanPoint[]): string[] {
  let best: { order: PlanPoint[]; late: number; total: number } | null = null;
  for (const start of stops) {
    const rest = stops.filter(s => s !== start);
    const order = [start];
    while (rest.length > 0) {
      const cur = order[order.length - 1];
      let bi = 0;
      for (let i = 1; i < rest.length; i++) {
        const di = calculateDistance(cur.lat, cur.lng, rest[i].lat, rest[i].lng);
        const db = calculateDistance(cur.lat, cur.lng, rest[bi].lat, rest[bi].lng);
        if (di < db) bi = i;
      }
      order.push(rest.splice(bi, 1)[0]);
    }
    const sch = buildSchedule(order);
    const late = sch.filter(s => s.late).length;
    const total = sch.reduce((a, s) => a + (s.leg?.minutes ?? 0), 0);
    if (!best || late < best.late || (late === best.late && total < best.total)) {
      best = { order, late, total };
    }
  }
  return best ? best.order.map(s => s.spotId) : [];
}

/** その1区間を電車＋徒歩で開く（Google マップは電車の経路で複数の目的地を扱えない） */
export function googleMapsTransitUrl(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=transit`;
}

/** 過ぎた予定で、その日に記録した寺社（予定に無い寺社は数えない） */
export function countVisited(
  stopSpotIds: string[],
  visitedOn: Set<string>
): { done: Set<string>; count: number } {
  const done = new Set(stopSpotIds.filter(id => visitedOn.has(id)));
  return { done, count: done.size };
}

/** 今日の予定は過ぎていない */
export function isPastPlan(plannedOn: string, today: Date): boolean {
  const [y, m, d] = plannedOn.split('-').map(Number);
  return new Date(y, m - 1, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}
