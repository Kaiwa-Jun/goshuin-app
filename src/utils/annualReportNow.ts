import { jstYearMonth } from '@utils/jstDate';

/**
 * 年報の「今」（Issue #274 D-19）。
 *
 * 開発用の「12月として自動再生を試す」で読み込み直したときだけ、その起動の中は
 * 今の年（日本時間）の12月1日 12:00（日本時間）を返す。本番の束では __DEV__ が
 * false なので、常に今の日時
 */
let devAsDecember = false;

export function setDevAsDecember(value: boolean): void {
  devAsDecember = value;
}

export function resolveReportNow(real: Date, isDev: boolean, asDecember: boolean): Date {
  if (!(isDev && asDecember)) return real;
  const { year } = jstYearMonth(real);
  // 12月1日 12:00 JST = 12月1日 03:00 UTC
  return new Date(Date.UTC(year, 11, 1, 3));
}

export function annualReportNow(): Date {
  return resolveReportNow(new Date(), __DEV__, devAsDecember);
}
