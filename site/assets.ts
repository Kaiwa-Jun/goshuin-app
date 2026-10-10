// site/static の素材（そのまま dist に写す）。スクショ・バッジ・OGP の画像はリーダーが入れる。
// 無い間も生成器は止まらない（スクショは節を出さない。バッジは同じ形で出し、check が無いことを知らせる）。
// 契約書: docs/issues/issue-324-homepage.md D-12・D-18・「対象ファイル」の site/static
import type { Assets } from './pages.ts';
import { BADGE_SRC, SCREEN_WIDTHS, screenPath } from './pages.ts';

export const STATIC_DIR = 'site/static';
export const BADGE_FILE = BADGE_SRC.slice(1);
export const OGP_FILE = 'img/ogp.png';
export const ICON_FILES = ['favicon.png', 'apple-touch-icon.png'] as const;

/** スクショ 8 枚（01〜04 × 360・720） */
export const SCREEN_FILES: readonly string[] = [1, 2, 3, 4].flatMap(n =>
  SCREEN_WIDTHS.map(w => screenPath(n, w).slice(1))
);

/** SVG の大きさ（viewBox か width・height） */
export function svgSize(svg: string): { width: number; height: number } | null {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!root) return null;
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(
    root
  );
  if (vb) return { width: Number(vb[1]), height: Number(vb[2]) };
  const w = /\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i.exec(root);
  const h = /\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i.exec(root);
  if (w && h) return { width: Number(w[1]), height: Number(h[1]) };
  return null;
}

/**
 * site/static のファイルの一覧（相対パス）から、ページの作り方を決める。
 * スクショが 1〜7 枚だけなら止まる（半端な節を出さない）。無いものは notices に並べる
 */
export function detectAssets(
  files: readonly string[],
  badgeSvg: string | null
): { assets: Assets; notices: string[] } {
  const have = new Set(files);
  const notices: string[] = [];
  const shots = SCREEN_FILES.filter(f => have.has(f));
  if (shots.length > 0 && shots.length < SCREEN_FILES.length) {
    const missing = SCREEN_FILES.filter(f => !have.has(f)).map(f => `${STATIC_DIR}/${f}`);
    throw new Error(`スクショが ${shots.length}/8 枚だけ。足りない: ${missing.join('・')}`);
  }
  if (shots.length === 0) {
    notices.push(
      `スクショ（${STATIC_DIR}/img/screens/ の 8 枚）が無いので、トップのスクショの節を出さない`
    );
  }
  let badge: Assets['badge'] = null;
  if (!have.has(BADGE_FILE)) {
    notices.push(`${STATIC_DIR}/${BADGE_FILE} が無い（ページはこのパスを指す。check が止まる）`);
  } else {
    badge = badgeSvg === null ? null : svgSize(badgeSvg);
    if (!badge)
      notices.push(`${STATIC_DIR}/${BADGE_FILE} の大きさ（viewBox）が読めない（width を付けない）`);
  }
  for (const f of [OGP_FILE, ...ICON_FILES]) {
    if (!have.has(f)) notices.push(`${STATIC_DIR}/${f} が無い`);
  }
  return { assets: { screens: shots.length === SCREEN_FILES.length, badge }, notices };
}
