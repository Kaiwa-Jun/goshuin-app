/**
 * 月参り（つきまいり）の数え方。
 *
 * 同じ寺社に毎月1回参拝し、12ヶ月続けると「満願」。**もとからある作法**で、
 * ご褒美（満願の御朱印）は神社が実際にくれる。アプリの仕事は作り出すことではなく
 * 気づくことなので、「月参りをする」と宣言させず、記録から勝手に数える。
 *
 * 仕様: docs/design/2026-09-tsukimairi-spec.md §2
 */

/** 12ヶ月で満願 */
export const MANGAN_MONTHS = 12;
/** これ未満ではカードを出さない。1回来ただけの人に「月参り」を名乗らせない */
export const MIN_MONTHS_TO_SHOW = 2;

export interface Tsukimairi {
  /** いま続いている月数。途切れていれば 0 */
  current: number;
  /** これまでの最長。途切れても残る */
  longest: number;
  /** いまの連続が始まった月。YYYY-MM */
  startMonth: string | null;
  /** 満願まで残り何ヶ月。満願していれば 0 */
  remaining: number;
  isMangan: boolean;
  /** 何巡目か。12ヶ月で1巡 */
  lapCount: number;
  /** いまの巡りで何ヶ月目か（1〜12） */
  monthsInLap: number;
  /** 続いていたのに途切れた状態か */
  isBroken: boolean;
  /** カードを出すか */
  shouldShowCard: boolean;
}

/**
 * 参拝日から、重複を除いた `YYYY-MM` の並び（古い順）。
 *
 * ⚠️ **`new Date()` を挟まない。** `visited_at` は DATE 型で、Date にすると
 * 端末の時差で1日ずれる（Issue #204）。月境で数えるので、ずれると連続が理由もなく切れる。
 */
export function monthsOf(visitedAts: string[]): string[] {
  return [...new Set(visitedAts.map(d => d.slice(0, 7)))].sort();
}

/** YYYY-MM の1つ前の月 */
function previousMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function longestRun(months: string[]): number {
  let best = 0;
  let run = 0;
  for (let i = 0; i < months.length; i += 1) {
    run = i > 0 && months[i - 1] === previousMonth(months[i]) ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function tsukimairiOf(visitedAts: string[], today: string): Tsukimairi {
  const months = monthsOf(visitedAts);
  const empty: Tsukimairi = {
    current: 0,
    longest: 0,
    startMonth: null,
    remaining: MANGAN_MONTHS,
    isMangan: false,
    lapCount: 0,
    monthsInLap: 0,
    isBroken: false,
    shouldShowCard: false,
  };
  if (months.length === 0) return empty;

  const thisMonth = today.slice(0, 7);
  const lastMonth = previousMonth(thisMonth);
  const latest = months[months.length - 1];

  /*
   * 今月は猶予。前の月に来ていれば、今月まだでも続いている。
   * 月が変わった瞬間に消えると「まだ月半ばなのに」になる
   */
  const alive = latest === thisMonth || latest === lastMonth;
  const longest = longestRun(months);

  if (!alive) {
    return { ...empty, longest, isBroken: true };
  }

  // 最後の月から遡って、連続している月数を数える
  let current = 1;
  let startMonth = latest;
  for (let i = months.length - 1; i > 0; i -= 1) {
    if (months[i - 1] !== previousMonth(months[i])) break;
    current += 1;
    startMonth = months[i - 1];
  }

  const isMangan = current >= MANGAN_MONTHS;
  const monthsInLap = isMangan ? current % MANGAN_MONTHS || MANGAN_MONTHS : current;

  return {
    current,
    longest: Math.max(longest, current),
    startMonth,
    remaining: Math.max(0, MANGAN_MONTHS - current),
    isMangan,
    lapCount: Math.ceil(current / MANGAN_MONTHS),
    monthsInLap,
    isBroken: false,
    shouldShowCard: current >= MIN_MONTHS_TO_SHOW,
  };
}
