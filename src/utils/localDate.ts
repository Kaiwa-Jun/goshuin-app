/**
 * Date から、端末のタイムゾーンにおける YYYY-MM-DD を作る（Issue #204）。
 *
 * `visited_at` は DATE 型で、時刻を持たない。そこへ `toISOString()` の結果を
 * 渡すと Postgres は **UTC の日付部分**を取るため、JST の 00:00〜08:59 は
 * 前日として保存されてしまう。
 *
 *   端末の表示 2026-09-20 00:30
 *   → toISOString()  "2026-09-19T15:30:00.000Z" → DATE は 2026-09-19 ✗
 *   → この関数        "2026-09-20"               → DATE は 2026-09-20 ✓
 *
 * 画面に出ている日付をそのまま保存するのが正しいので、UTC を経由せず
 * ローカルの年月日をそのまま組み立てる。
 *
 * ⚠️ `visited_at` を作る経路で `toISOString()` を使わないこと。
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
