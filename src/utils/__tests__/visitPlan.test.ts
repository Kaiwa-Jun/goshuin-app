import {
  LATE_MARGIN_MINUTES,
  buildSchedule,
  countVisited,
  estimateLeg,
  estimateLegByMeters,
  formatClock,
  googleMapsTransitUrl,
  isLate,
  isPastPlan,
  parseClock,
  suggestOrder,
} from '@utils/visitPlan';
import { addDays, buildMonthGrid, formatPlanDate, nextSaturday } from '@utils/planDate';
import { canAddPlan } from '@utils/plus';
import { BILLING_ENABLED } from '@/constants/plus';
import { buildPlanRouteSources } from '@utils/planRoute';

/* 契約書: docs/issues/issue-258-visit-plan.md（S1 / AC-1〜17）。固定データは試作 v3 と同じ京都5社 */
const S = {
  yasaka: { spotId: 'yasaka', lat: 35.0036, lng: 135.778, closeMinutes: 1020 },
  kennin: { spotId: 'kennin', lat: 34.9996, lng: 135.7742, closeMinutes: 990 },
  kiyomizu: { spotId: 'kiyomizu', lat: 34.995, lng: 135.7843, closeMinutes: 1080 },
  sanju: { spotId: 'sanju', lat: 34.9897, lng: 135.7727, closeMinutes: 960 },
  fushimi: { spotId: 'fushimi', lat: 34.9672, lng: 135.7732, closeMinutes: 990 },
};

describe('estimateLeg', () => {
  it('AC-1: 近ければ徒歩', () => {
    expect(estimateLeg(S.yasaka, S.kennin)).toMatchObject({
      mode: 'walk',
      minutes: 9,
      label: '徒歩 約9分',
    });
  });
  it('AC-2: 遠ければ電車など', () => {
    expect(estimateLeg(S.sanju, S.fushimi)).toMatchObject({
      mode: 'transit',
      minutes: 23,
      label: '電車などで移動・約3.3km',
    });
  });
  it('AC-3: 直線×1.3 が 1500m ちょうどまで徒歩', () => {
    expect(estimateLegByMeters(1500 / 1.3)).toMatchObject({ mode: 'walk', minutes: 19 });
    expect(estimateLegByMeters(1501 / 1.3).mode).toBe('transit');
  });
});

describe('suggestOrder / buildSchedule', () => {
  const order = ['yasaka', 'kennin', 'kiyomizu', 'sanju', 'fushimi'];
  it('AC-4: 近い順・受付の早い順', () => {
    const input = [S.kiyomizu, S.yasaka, S.fushimi, S.kennin, S.sanju];
    expect(suggestOrder(input)).toEqual(order);
  });
  it('AC-5: 着く時刻と間に合うか', () => {
    const sch = buildSchedule(order.map(k => S[k as keyof typeof S]));
    expect(sch.map(s => formatClock(s.arriveMinutes))).toEqual([
      '9:00',
      '9:39',
      '10:26',
      '11:12',
      '12:05',
    ]);
    expect(sch.every(s => !s.late)).toBe(true);
    expect(sch.at(-1)?.leg).toBeNull();
  });
  it('AC-6: 移動の合計が同じでも、受付に間に合う順を採る', () => {
    const p1 = { spotId: 'p1', lat: 35.0, lng: 135.77, closeMinutes: null };
    const p2 = { spotId: 'p2', lat: 35.005, lng: 135.77, closeMinutes: null };
    const p3 = { spotId: 'p3', lat: 35.03, lng: 135.77, closeMinutes: 600 };
    expect(suggestOrder([p1, p2, p3])).toEqual(['p3', 'p2', 'p1']);
  });
  it('AC-7: 0社・1社・入力を壊さない', () => {
    expect(suggestOrder([])).toEqual([]);
    expect(suggestOrder([S.yasaka])).toEqual(['yasaka']);
    const input = [S.kiyomizu, S.yasaka];
    const copy = [...input];
    suggestOrder(input);
    expect(input).toEqual(copy);
  });
  it('AC-8: 間に合わない = 着く時刻 > 受付の終わり − 30分', () => {
    expect(LATE_MARGIN_MINUTES).toBe(30);
    expect(isLate(570, 600)).toBe(false);
    expect(isLate(571, 600)).toBe(true);
    expect(isLate(1380, null)).toBe(false);
  });
  it('AC-9: 受付の時刻', () => {
    expect(parseClock('17:00')).toBe(1020);
    expect(parseClock('9:30')).toBe(570);
    for (const s of ['17時まで', '', '25:00']) expect(parseClock(s)).toBeNull();
  });
});

describe('planDate', () => {
  it('AC-10: 次の土曜日（今日が土曜なら 7日後）', () => {
    expect(nextSaturday(new Date(2026, 8, 26))).toBe('2026-10-03');
    expect(nextSaturday(new Date(2026, 8, 28))).toBe('2026-10-03');
    expect(nextSaturday(new Date(2026, 9, 2))).toBe('2026-10-03');
    expect(nextSaturday(new Date(2026, 9, 3))).toBe('2026-10-10');
  });
  it('AC-11: 表示', () => {
    expect(formatPlanDate('2026-10-03')).toBe('10月3日（土）');
    expect(formatPlanDate('2026-10-12')).toBe('10月12日（月）');
  });
  it('AC-12: 月の格子は日曜始まり 42 日', () => {
    const g = buildMonthGrid(2026, 10);
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-09-27');
    expect(g[4]).toBe('2026-10-01');
    expect(g.at(-1)).toBe('2026-11-07');
  });
  it('addDays は月をまたぐ', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });
});

describe('その他', () => {
  it('AC-13: Google マップの URL', () => {
    expect(
      googleMapsTransitUrl({ lat: 35.0036, lng: 135.778 }, { lat: 34.9996, lng: 135.7742 })
    ).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=35.0036,135.778&destination=34.9996,135.7742&travelmode=transit'
    );
  });
  it('AC-14: 回れた数', () => {
    const r = countVisited(['a', 'b', 'c', 'd'], new Set(['a', 'c', 'x']));
    expect(r.count).toBe(2);
    expect([...r.done].sort()).toEqual(['a', 'c']);
  });
  it('AC-15: 過ぎた予定', () => {
    expect(isPastPlan('2026-09-25', new Date(2026, 8, 26))).toBe(true);
    expect(isPastPlan('2026-09-26', new Date(2026, 8, 26))).toBe(false);
  });
  it('AC-16: プラスの分かれ目', () => {
    expect(canAddPlan(1, false, false)).toBe(true);
    expect(canAddPlan(5, false, false)).toBe(true);
    expect(canAddPlan(0, false, true)).toBe(true);
    expect(canAddPlan(1, false, true)).toBe(false);
    expect(canAddPlan(1, true, true)).toBe(true);
    expect(BILLING_ENABLED).toBe(false);
  });
  it('AC-17: 地図に描く点線と番号（順に描くための revealedCount）', () => {
    const five = Object.values(S);
    const at = (n: number) => buildPlanRouteSources(five, n);
    expect([at(0).route.features.length, at(0).stops.features.length]).toEqual([0, 0]);
    expect(at(3).stops.features.map(f => f.properties?.number)).toEqual([1, 2, 3]);
    expect(at(3).route.features).toHaveLength(2);
    expect([at(5).route.features.length, at(5).stops.features.length]).toEqual([4, 5]);
  });
});
