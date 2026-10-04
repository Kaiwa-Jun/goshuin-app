import { Animated } from 'react-native';

/**
 * 地図のシートの上の帯（「場所の顔」）の値と動き（Issue #293）。
 *
 * 値の正は試作 docs/design/mockups/2026-09-spot-sheet-hero-v2.html（案B ＋ 案い 空押し）。
 * 帯は 208 で描いたまま動かさず、名前から下の中身を最大 128 持ち上げて、帯の下の端に
 * 重ねる。開き（半分 0 ↔ 大きく 1）はシートの位置そのものから補間で引くので、ドラッグと
 * spring にそのままついていき、どれも transform と opacity だけ（native driver のまま）。
 */

type AnimatedNumber = Animated.Value | Animated.AnimatedInterpolation<number>;

/* ── 帯の寸法 ── */

/** 試作の画面の幅。印とページの左の位置はこの幅で決めてあり、幅の違う端末では右端に合わせる */
export const HERO_DESIGN_WIDTH = 390;
/** 大きく開いたときの帯の高さ（試作 `BAND_E`）。帯はいつもこの高さで描く */
export const HERO_EXPANDED_HEIGHT = 208;
/** 半分のときに見える帯の高さ（`BAND_C`） */
export const HERO_COMPACT_HEIGHT = 80;
/** 半分のときに中身を持ち上げる量（`LIFT`） */
export const HERO_LIFT = HERO_EXPANDED_HEIGHT - HERO_COMPACT_HEIGHT;
/** 帯の下の端に重なる、白くぼける所の高さ（`.fadeTop`） */
export const HERO_FADE_HEIGHT = 56;
/** 中身の上の端（大きく開いたとき。`.panel{margin-top}`） */
export const HERO_BODY_TOP = HERO_EXPANDED_HEIGHT - HERO_FADE_HEIGHT;
/** 中身の上の端から名前の行まで（`.nameRow{bottom:6px}`） */
export const HERO_NAME_INSET = 26;
/** 半分のときの、シートの上の端から名前の行まで（178 − 128） */
export const HERO_COMPACT_NAME_TOP = HERO_BODY_TOP + HERO_NAME_INSET - HERO_LIFT;
/** 中身の白い地が、少なくとも帯の下の端まで届く高さ（`.body{padding-bottom:128px}` の代わり） */
export const HERO_BODY_MIN_HEIGHT = HERO_LIFT + HERO_FADE_HEIGHT;
/** ぼかしを白い地に 1 だけ重ねる（`.fadeBg{bottom:-1px}`）。境目に線を出さない */
export const HERO_FADE_BLEED = 1;
/** ぼかしの色の止まる所（高さ 57 の上から: 透明 5・0.92 が 29・白 47） */
export const HERO_FADE_LOCATIONS = [5 / 57, 29 / 57, 47 / 57] as const;

/* ── 帯の中の物の置き場所（試作 `RECT`）。[左, 上, 幅] を半分と大きくで持ち、間は直線 ── */

export interface HeroRect {
  compact: { x: number; y: number; width: number };
  expanded: { x: number; y: number; width: number };
  /** 高さ ÷ 幅 */
  ratio: number;
}

/** 帯いっぱいの空押しの印。半分では鳥居の笠木（お堂の屋根）が帯を横切る */
export const CREST_RECT: HeroRect = {
  compact: { x: 115, y: -47, width: 250 },
  expanded: { x: 90, y: -28, width: 300 },
  ratio: 1,
};

/** 自分の御朱印のページ */
export const PAGE_RECT: HeroRect = {
  compact: { x: 298, y: 4, width: 62 },
  expanded: { x: 234, y: 22, width: 120 },
  ratio: 4 / 3,
};

/**
 * 写真の帯に挟まる自分の御朱印のページ（Issue #302・試作 `RECT.tuck`）。
 * 半分では右上の小さな束、大きく開くと名前の上まで降りてくる
 */
export const TUCK_RECT: HeroRect = {
  compact: { x: 336, y: 12, width: 34 },
  expanded: { x: 290, y: 88, width: 80 },
  ratio: 4 / 3,
};

/** 印と表の紙の傾き（`.crestBox`・`pageInner()`） */
export const HERO_TILT_DEG = -4;
/** 後ろの紙の傾きとずらし。ずらしは紙の幅・高さに対する割合（`pageInner()` の `LEAF`） */
export const PAGE_LEAVES = [
  { rotateDeg: 6, dx: 0.07, dy: -0.02 },
  { rotateDeg: -2, dx: -0.08, dy: 0.01 },
] as const;
/** 束の枚数の上限（`Math.min(stamps, 3)`） */
export const HERO_MAX_PAGES = 3;
/** 紙の角（`.pg{border-radius:3px}`） */
export const PAGE_RADIUS = 3;

/* ── 記録した瞬間（`playRecord()`） ── */

/** 印に朱が乗る（`SEAL_MS`。ManganSeal と同じ長さ） */
export const SEAL_PRESS_MS = 500;
/** 朱が薄い跡になり、ページに替わる（`CROSSFADE_MS`） */
export const PAGE_REVEAL_MS = 250;
/** 捺す動きの倍率。1.3 倍から押し込まれ、0.55 のところで 0.92 まで沈んで 1 に戻る */
export const PRESS_FROM_SCALE = 1.3;
export const PRESS_DIP_SCALE = 0.92;
export const PRESS_DIP_AT = 0.55;

/* ── 印の見た目（`crestMada()`・`crestPress()`・`GHOST`） ── */

/** 朱の不透明度。下の紙が少し透ける */
export const INK_OPACITY = 0.9;
/** 行った寺社で残る朱の跡 */
export const GHOST_OPACITY = 0.2;
/** 空押しの型: 左上の陰と、右下の光 */
export const MADA_SHADE_OPACITY = 0.26;
export const MADA_SHADE_OFFSET = -1;
export const MADA_LIGHT_OPACITY = 0.9;
export const MADA_LIGHT_OFFSET = 0.9;

/* ── 和紙の筋（`grainSvg()`） ── */

export const GRAIN_STEP = 11.4;
export const GRAIN_OPACITY = 0.025;

/** 小数1桁に丸める（試作の `toFixed(1)`。1.4 + 0.9 を 2.3 にそろえる） */
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * 帯の開き。シートの位置から、大きく 1・半分 0。半分より下（出てくる途中・閉じる途中）は 0
 * （試作 `t = (compactY − y) ÷ (compactY − EXPANDED_Y)`）
 */
export function heroOpenOf(
  sheetY: Animated.Value,
  expandedPosition: number,
  compactPosition: number
): Animated.AnimatedInterpolation<number> {
  return sheetY.interpolate({
    inputRange: [expandedPosition, compactPosition],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
}

/** 中身の持ち上げ。半分 −128・大きく 0（試作 `translateY(−128·(1 − t))`） */
export function bodyLiftOf(open: AnimatedNumber): Animated.AnimatedInterpolation<number> {
  return open.interpolate({ inputRange: [0, 1], outputRange: [-HERO_LIFT, 0] });
}

/** 大きくの rect の置き場所。幅の違う端末では左の位置だけ (W − 390) ずらす（#293 D-2 の (c)） */
export function heroRectLayout(
  rect: HeroRect,
  windowWidth: number
): { left: number; top: number; width: number; height: number } {
  const { x, y, width } = rect.expanded;
  return {
    left: x + (windowWidth - HERO_DESIGN_WIDTH),
    top: y,
    width,
    height: width * rect.ratio,
  };
}

/**
 * 半分 ↔ 大きく の間の rect の動き。RN の scale は真ん中が軸なので、試作の
 * `transform-origin: 0 0` を真ん中の移動に直す。大きくの置き場所に置いて、
 * translate は (1 − open)·(半分の中心 − 大きくの中心)、scale は幅の比
 */
export function heroRectMotion(
  open: AnimatedNumber,
  rect: HeroRect
): {
  translateX: Animated.AnimatedInterpolation<number>;
  translateY: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
} {
  const { compact, expanded, ratio } = rect;
  const centerOf = (r: { x: number; y: number; width: number }) => ({
    x: r.x + r.width / 2,
    y: r.y + (r.width * ratio) / 2,
  });
  const c = centerOf(compact);
  const e = centerOf(expanded);
  const line = (from: number, to: number) =>
    open.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  return {
    translateX: line(c.x - e.x, 0),
    translateY: line(c.y - e.y, 0),
    scale: line(compact.width / expanded.width, 1),
  };
}

/**
 * 記録した瞬間の見た目。`press`（朱が乗る）と `reveal`（ページに替わる）の2つだけから決める。
 * 行っていない = (0, 0)、行った = (1, 1)
 */
export function heroMomentStyle(
  press: Animated.Value,
  reveal: Animated.Value
): {
  inkOpacity: Animated.AnimatedMultiplication<number>;
  inkScale: Animated.AnimatedInterpolation<number>;
  madaOpacity: Animated.AnimatedInterpolation<number>;
  pagesOpacity: Animated.Value;
} {
  return {
    inkOpacity: Animated.multiply(
      press,
      reveal.interpolate({ inputRange: [0, 1], outputRange: [1, GHOST_OPACITY] })
    ),
    inkScale: press.interpolate({
      inputRange: [0, PRESS_DIP_AT, 1],
      outputRange: [PRESS_FROM_SCALE, PRESS_DIP_SCALE, 1],
    }),
    madaOpacity: reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    pagesOpacity: reveal,
  };
}

/** 束の枚数。記録が無くても1枚（記録した瞬間に出す紙）、多くても3枚 */
export function pageCountOf(count: number): number {
  return Math.min(Math.max(count, 1), HERO_MAX_PAGES);
}

/** 紙の大きさ（大きくのとき） */
const PAGE_WIDTH = PAGE_RECT.expanded.width;
const PAGE_HEIGHT = PAGE_RECT.expanded.width * PAGE_RECT.ratio;

/** 後ろの紙の transform（紙 120 × 160 のときの pt）。CSS の `rotate() translate(%)` と同じ順 */
export function pageLeafTransform(
  index: number
): [{ rotate: string }, { translateX: number }, { translateY: number }] {
  const leaf = PAGE_LEAVES[index];
  return [
    { rotate: `${leaf.rotateDeg}deg` },
    { translateX: leaf.dx * PAGE_WIDTH },
    { translateY: leaf.dy * PAGE_HEIGHT },
  ];
}

/** 表の紙の transform */
export const TOP_PAGE_TRANSFORM: [{ rotate: string }] = [{ rotate: `${HERO_TILT_DEG}deg` }];

/** 和紙の筋。i 本目は x = i·11.4、幅は 5 本で1周（1.4 + (i mod 5)·0.9）、高さは帯いっぱい */
export function grainRects(width: number): { x: number; width: number; height: number }[] {
  return Array.from({ length: Math.ceil(width / GRAIN_STEP) }, (_, i) => ({
    x: round1(i * GRAIN_STEP),
    width: round1(1.4 + (i % 5) * 0.9),
    height: HERO_EXPANDED_HEIGHT,
  }));
}
