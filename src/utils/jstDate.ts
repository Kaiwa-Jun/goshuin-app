/**
 * 日本時間（UTC+9 固定・日本に夏時間は無い）の日付。
 *
 * 端末のタイムゾーンに依らないように、瞬間に9時間を足して UTC として読む。
 * 端末の時刻の getter は使わない（Jest は TZ=Asia/Tokyo で走るので、
 * 使っても誤りがテストに出ない。Issue #274 D-2）
 */
export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** JST の YYYY-MM-DD を返す */
export function toJstDateString(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** JST の年と月（1〜12） */
export function jstYearMonth(now: Date): { year: number; month: number } {
  const ymd = toJstDateString(now);
  return { year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)) };
}
