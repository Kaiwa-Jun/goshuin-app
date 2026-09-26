// 予定の日付（Issue #258 / D-3）。日付は 'YYYY-MM-DD' の文字列で持ち、new Date('YYYY-MM-DD')（UTC）を挟まない
import { toLocalDateString } from '@utils/localDate';

const WEEKDAYS = '日月火水木金土';

const parse = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** 今日より後の最初の土曜日（今日が土曜なら 7日後） */
export function nextSaturday(today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return toLocalDateString(d);
}

export function formatPlanDate(ymd: string): string {
  const d = parse(ymd);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

export function addDays(ymd: string, n: number): string {
  const d = parse(ymd);
  d.setDate(d.getDate() + n);
  return toLocalDateString(d);
}

/** その月を含む、日曜始まりの 6 週（42 日） */
export function buildMonthGrid(year: number, month: number): string[] {
  const first = new Date(year, month - 1, 1);
  const start = new Date(year, month - 1, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) =>
    toLocalDateString(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  );
}
