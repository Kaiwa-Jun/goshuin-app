/**
 * 訪問日を和暦で表示するための純関数。
 *
 * Hermes の Intl は和暦カレンダー（ja-JP-u-ca-japanese）のサポートが環境依存で、
 * 実機とテストで結果が食い違うおそれがあるため自前で持つ。
 * また `new Date(dateStr)` は 'YYYY-MM-DD' を UTC 深夜として解釈するため、
 * ローカルタイムゾーンによっては前日にずれて改元日の判定を落とす。
 * そのため Date を経由せず文字列のまま分解する。
 */

interface EraDef {
  name: string;
  /** 改元日（この日を元年の初日とする） */
  start: { year: number; month: number; day: number };
}

// 新しいものから順に並べる（先に一致したものを採用する）
const ERAS: EraDef[] = [
  { name: '令和', start: { year: 2019, month: 5, day: 1 } },
  { name: '平成', start: { year: 1989, month: 1, day: 8 } },
  { name: '昭和', start: { year: 1926, month: 12, day: 25 } },
];

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

function toComparable(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

export function formatJapaneseEraDate(dateStr: string): string {
  const matched = DATE_PATTERN.exec(dateStr);
  if (!matched) return '';

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);

  const target = toComparable(year, month, day);
  const era = ERAS.find(e => target >= toComparable(e.start.year, e.start.month, e.start.day));

  if (!era) {
    return `${year}年${month}月${day}日`;
  }

  const eraYear = year - era.start.year + 1;
  const eraYearLabel = eraYear === 1 ? '元' : String(eraYear);

  return `${era.name}${eraYearLabel}年${month}月${day}日`;
}
