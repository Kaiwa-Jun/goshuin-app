// 縦の一覧を長押しで並べ替えるときの計算（Issue #258 の予定の順番）。
// 行の高さはそろっていなくてよい（区間の行を含む）。onLayout で測った y と height を渡す

export interface RowLayout {
  y: number;
  height: number;
}

/** 持っている行（from）を dy だけ動かしたとき、入る位置。ほかの行の真ん中を越えたら入れ替わる */
export function dragTarget(layouts: RowLayout[], from: number, dy: number): number {
  const self = layouts[from];
  if (!self) return from;
  const center = self.y + self.height / 2 + dy;
  let to = from;
  if (dy > 0) {
    for (let j = from + 1; j < layouts.length; j++) {
      if (center > layouts[j].y + layouts[j].height / 2) to = j;
    }
  } else if (dy < 0) {
    for (let j = from - 1; j >= 0; j--) {
      if (center < layouts[j].y + layouts[j].height / 2) to = j;
    }
  }
  return to;
}

/** 行 j がよける量。持っている行の高さ分だけ、入る場所を空ける向きへ */
export function dragShift(j: number, from: number, to: number, fromHeight: number): number {
  if (j === from || from === to) return 0;
  if (from < to && j > from && j <= to) return -fromHeight;
  if (to < from && j >= to && j < from) return fromHeight;
  return 0;
}
