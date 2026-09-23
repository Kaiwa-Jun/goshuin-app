import { JAPAN_MAP_HEIGHT, JAPAN_MAP_WIDTH } from '@/constants/japanMap';
import { spacing } from '@theme/spacing';

/** 完了画面で縮められるもの。最大が今までの見た目 */
export const COMPLETE_LAYOUT = {
  mapMaxWidth: 210,
  /** これより小さいとピンの県が読めない */
  mapMinWidth: 90,
  mapAspect: JAPAN_MAP_HEIGHT / JAPAN_MAP_WIDTH,
  stampMaxWidth: 150,
  /** 御朱印の字が読める下限（iPhone SE 相当でここまで縮む） */
  stampMinWidth: 90,
  /** 写真の枠は 3:4 */
  stampAspect: 4 / 3,
  gapMax: spacing.md,
  gapMin: spacing.xs,
} as const;

export interface CompleteLayout {
  mapWidth: number;
  stampWidth: number;
  gap: number;
}

/**
 * 完了画面のカードに収まる大きさを決める（1.2.0 の実機で発覚）。
 *
 * カードは中身を上下中央に置いていて、入りきらないと上下に同じだけはみ出す。
 * 初回投稿は「1枚目」「〇〇、はじめて」「印」まで全部出るので、小さい画面で
 * 写真がカードの上に飛び出していた。
 *
 * 縮める順は **地図 → 要素の間の余白 → 写真**。写真は主役なので最後。
 * content は current の大きさで測った中身の高さ。縮めるもの以外の高さは
 * 大きさに依らないので、1回測れば決まる（測り直しても同じ値になり、揺れない）
 */
export function fitCompleteLayout({
  available,
  content,
  gapCount,
  current,
}: {
  /** カードの中で中身に使える高さ（余白を引いたもの） */
  available: number;
  content: number;
  /** 中身の要素の間の数 */
  gapCount: number;
  current: CompleteLayout;
}): CompleteLayout {
  const L = COMPLETE_LAYOUT;
  const full = { mapWidth: L.mapMaxWidth, stampWidth: L.stampMaxWidth, gap: L.gapMax };
  if (available <= 0 || content <= 0) return full;

  const heightOf = (l: CompleteLayout) =>
    l.mapWidth * L.mapAspect + l.stampWidth * L.stampAspect + gapCount * l.gap;
  // 縮められない部分（文字・チップ・印）
  const fixed = content - heightOf(current);
  const budget = available - fixed;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(v)));

  // 1. 地図
  const mapWidth = clamp(
    (budget - L.stampMaxWidth * L.stampAspect - gapCount * L.gapMax) / L.mapAspect,
    L.mapMinWidth,
    L.mapMaxWidth
  );
  const afterMap = { ...full, mapWidth };
  if (mapWidth > L.mapMinWidth || heightOf(afterMap) <= budget) return afterMap;

  // 2. 余白
  const restAfterMap = budget - L.mapMinWidth * L.mapAspect - L.stampMaxWidth * L.stampAspect;
  const gap = gapCount > 0 ? clamp(restAfterMap / gapCount, L.gapMin, L.gapMax) : L.gapMax;
  const afterGap = { ...afterMap, gap };
  if (gap > L.gapMin || heightOf(afterGap) <= budget) return afterGap;

  // 3. 写真
  const stampWidth = clamp(
    (budget - L.mapMinWidth * L.mapAspect - gapCount * L.gapMin) / L.stampAspect,
    L.stampMinWidth,
    L.stampMaxWidth
  );
  return { ...afterGap, stampWidth };
}
