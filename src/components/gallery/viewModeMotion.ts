import { Animated } from 'react-native';

/**
 * 御朱印帳の表示の切り替え（めくる ↔ 一覧）の動きの値（Issue #276）。
 *
 * 値の正は試作。ボタンは docs/design/mockups/2026-09-viewmode-toggle-v1.html の A
 * （`spring`・`openBook()`・`popGrid()`・`anim()`）、中身は
 * docs/design/mockups/2026-09-viewmode-transition-v2.html の 5
 * （`t5()`・`order()`・`rot()`・`spring`・`ease`・`easeIn`・`STACK`）。
 *
 * 中身の値は、切り替えのたびに作る時計（単位 ms）から補間で引く。ネイティブの補間は
 * easing を受け付けないので、曲線は点で刻む（#275 D-4）。
 */

/**
 * 裏返した角度。**ちょうど 180 にしない**。iOS はちょうど 180° のとき、裏の面
 * （最後に 180deg 足して表を向く面）も向こう向きとみなして描かない（#275 S6）
 */
export const FACE_DOWN_DEG = 179.9;

/* ── ボタン（toggle-v1 の A） ── */

/** 白い台がすべって移る（`anim(520, …, spring)`） */
export const THUMB_SLIDE_MS = 520;
/** 本の左のページが開く（`openBook`） */
export const BOOK_OPEN_MS = 600;
/** タイルが1枚飛び出す（`popGrid`） */
export const TILE_POP_MS = 260;
/** タイルが飛び出す間隔（`popGrid` の `i·70`） */
export const TILE_POP_STAGGER_MS = 70;
/** 白い台の動く幅（`to = 44`）。押す所の幅と同じ */
export const THUMB_TRAVEL = 44;

/** 白い台のばね。少し行き過ぎて戻る（toggle-v1 の `spring`）。いちばん行き過ぎるところで 1.145 */
export const thumbSpring = (t: number): number =>
  t >= 1 ? 1 : 1 - Math.exp(-6.5 * t) * Math.cos(9.5 * t);

/** タイルが飛び出す曲線（`popGrid`）。0 で 0.1 から出て、いちばん大きいところで 1.108 */
export const tilePop = (t: number): number => 1 - (1 - t) ** 2 * Math.cos(4 * t) * 0.9;

/** 終わりに向けてゆるむ（試作の `ease`） */
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/* ── 切り替わり（transition-v2 の 5） ── */

/** めくる → 一覧: 見ていたページが縮んで束になる（`anim(100, …, easeIn)`） */
export const SHRINK_MS = 100;
/** めくる → 一覧: 1枚が束から自分の場所へ散る（`anim(345, …, spring)`） */
export const SCATTER_MS = 345;
/** 見ていた1枚の次の1枚が出るまで（`order()` の 20） */
export const SCATTER_FIRST_DELAY_MS = 20;
/** 最後の1枚が出るまで（`order()` の 20 + 100） */
export const SCATTER_LAST_DELAY_MS = 120;
/** 一覧 → めくる: 1枚が束へ集まる（`anim(250, …, ease, 80 − 80·od/120)`） */
export const GATHER_MS = 250;
/** 一覧 → めくる: 見ていた1枚が集まり始めるまで（いちばん遠い1枚は 0） */
export const GATHER_LEAD_MS = 80;
/** 一覧 → めくる: 束がページに広がる（`anim(260, …, spring)`） */
export const GROW_MS = 260;
/** めくる → 一覧 の全体（100 + 120 + 345） */
export const TO_GRID_MS = SHRINK_MS + SCATTER_LAST_DELAY_MS + SCATTER_MS;
/** 一覧 → めくる の全体（80 + 250 + 260） */
export const TO_FLIP_MS = GATHER_LEAD_MS + GATHER_MS + GROW_MS;
/** タイルの裏返しの遠近（`perspective(700px)`） */
export const TILE_PERSPECTIVE = 700;
/** タイルの下の文字が、着く直前に出る長さ（試作に無い。#276 D-2 の (e)） */
export const CAPTION_IN_MS = 120;
/** タイルの下の文字が、動き出してすぐ消える長さ */
export const CAPTION_OUT_MS = 80;
/** 面の入れ替えの傾きの幅。幅 0 の段にはしない（#275 D-5） */
export const SWAP_RAMP_MS = 1;
/** 曲線を刻む数。17 点 */
export const CURVE_STEPS = 16;
/** 入ってくる側を描いて測り終えるまでの待ちの上限。過ぎたら動かさずに切り替える */
export const PREPARE_TIMEOUT_MS = 300;

/** 一覧 → めくる で面を入れ替える時刻（集まり終わり） */
const TO_FLIP_SWAP_MS = GATHER_LEAD_MS + GATHER_MS;
/** 一覧の列の数 */
const GRID_COLUMNS = 3;

/** 束から散って着く（transition-v2 の `spring`）。t = 1 で 1.0008 になるのを 1 にそろえる */
export const settleSpring = (t: number): number =>
  t >= 1 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(9 * t);

/** 始めはゆっくり（試作の `easeIn`） */
export const easeInQuad = (t: number): number => t * t;

/** 束のタイルの傾き。−8〜8°（試作 `rot(i)`） */
export const tiltDegOf = (index: number): number => ((index * 37) % 17) - 8;

/** 縮みきったページの幅がタイルと同じになる倍率（#276 D-2 の (c)） */
export const stackScaleOf = (tileSize: number, pageWidth: number): number => tileSize / pageWidth;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 束の矩形。中心から一辺 T の正方形 */
export const stackRectOf = (center: { x: number; y: number }, tileSize: number): Rect => ({
  x: center.x - tileSize / 2,
  y: center.y - tileSize / 2,
  width: tileSize,
  height: tileSize,
});

/**
 * 束から散る順と遅れ（試作 `order()`）。見えているタイルを、見ていた1枚からの
 * マス目の距離の近い順（同じ距離は index の小さい順）に並べる。見ていた1枚が
 * 見えていれば先頭で 0、残りが 20〜120。見えていなければ全員が 20 より後
 */
export function scatterDelays(visibleIndices: number[], currentIndex: number): Map<number, number> {
  const cellOf = (index: number) => ({
    row: Math.floor(index / GRID_COLUMNS),
    column: index % GRID_COLUMNS,
  });
  const origin = cellOf(currentIndex);
  const distanceOf = (index: number) => {
    const cell = cellOf(index);
    return Math.hypot(cell.column - origin.column, cell.row - origin.row);
  };
  const sorted = [...visibleIndices].sort((a, b) => distanceOf(a) - distanceOf(b) || a - b);

  const delays = new Map<number, number>();
  const spread = SCATTER_LAST_DELAY_MS - SCATTER_FIRST_DELAY_MS;
  if (sorted[0] === currentIndex) {
    delays.set(currentIndex, 0);
    const rest = sorted.length - 1;
    sorted.slice(1).forEach((index, i) => {
      delays.set(index, SCATTER_FIRST_DELAY_MS + (spread * (i + 1)) / rest);
    });
  } else {
    sorted.forEach((index, i) => {
      delays.set(index, SCATTER_FIRST_DELAY_MS + (spread * (i + 1)) / sorted.length);
    });
  }
  return delays;
}

/** 束へ集まり始める時刻。散る遅れの逆順（いちばん遠い1枚が最初、見ていた1枚が最後） */
export const gatherDelayOf = (scatterDelay: number): number =>
  GATHER_LEAD_MS - (GATHER_LEAD_MS * scatterDelay) / SCATTER_LAST_DELAY_MS;

export interface SampledRange {
  inputRange: number[];
  outputRange: number[];
}

/**
 * 曲線を 17 点に刻む。k 番目の入力 = start + duration · k ÷ 16、
 * 出力 = from + (to − from) · curve(k ÷ 16)。点の間は直線
 */
export function sampledRange(
  curve: (t: number) => number,
  start: number,
  duration: number,
  from: number,
  to: number
): SampledRange {
  const steps = Array.from({ length: CURVE_STEPS + 1 }, (_, k) => k / CURVE_STEPS);
  return {
    inputRange: steps.map(p => start + duration * p),
    outputRange: steps.map(p => from + (to - from) * curve(p)),
  };
}

const linear = (t: number) => t;

type Clock = Animated.Value;
type Node = Animated.AnimatedInterpolation<number>;
type DegNode = Animated.AnimatedInterpolation<string>;

const numberNode = (clock: Clock, range: SampledRange): Node =>
  clock.interpolate({ ...range, extrapolate: 'clamp' });

/** 回転の出力は '{数}deg'。小さすぎる値を指数の表記にしない */
const degNode = (clock: Clock, range: SampledRange): DegNode =>
  clock.interpolate({
    inputRange: range.inputRange,
    outputRange: range.outputRange.map(deg => `${Math.round(deg * 1e6) / 1e6}deg`),
    extrapolate: 'clamp',
  });

/** 直線は2点 */
const lineRange = (start: number, duration: number, from: number, to: number): SampledRange => ({
  inputRange: [start, start + duration],
  outputRange: [from, to],
});

export type ViewModeDirection = 'toGrid' | 'toFlip';

export interface TileMotionParams {
  direction: ViewModeDirection;
  /** 束の中心 − タイルの中心 */
  dx: number;
  dy: number;
  /** 束での傾き。見ていた1枚は 0 */
  tiltDeg: number;
  /** 束で裏を向いているか。見ていた1枚は表のまま */
  faceDown: boolean;
  /** めくる → 一覧 は散る遅れ（`scatterDelays`）、一覧 → めくる は集まり始める時刻（`gatherDelayOf`） */
  delayMs: number;
}

export interface TileMotion {
  translateX: Node;
  translateY: Node;
  rotateZ: DegNode;
  rotateY: DegNode;
  captionOpacity: Node;
}

/** 見えているタイル1枚の動き（#276 D-12・D-13） */
export function tileMotion(clock: Clock, params: TileMotionParams): TileMotion {
  const { dx, dy, tiltDeg, delayMs } = params;
  const flipDeg = params.faceDown ? FACE_DOWN_DEG : 0;

  if (params.direction === 'toGrid') {
    // 束の上で止まっていて、縮みきってから遅れの分だけ待って散る
    const start = SHRINK_MS + delayMs;
    return {
      translateX: numberNode(clock, sampledRange(settleSpring, start, SCATTER_MS, dx, 0)),
      translateY: numberNode(clock, sampledRange(settleSpring, start, SCATTER_MS, dy, 0)),
      rotateZ: degNode(clock, lineRange(start, SCATTER_MS, tiltDeg, 0)),
      rotateY: degNode(clock, sampledRange(easeOutCubic, start, SCATTER_MS, flipDeg, 0)),
      captionOpacity: numberNode(
        clock,
        lineRange(start + SCATTER_MS - CAPTION_IN_MS, CAPTION_IN_MS, 0, 1)
      ),
    };
  }

  const start = delayMs;
  return {
    translateX: numberNode(clock, sampledRange(easeOutCubic, start, GATHER_MS, 0, dx)),
    translateY: numberNode(clock, sampledRange(easeOutCubic, start, GATHER_MS, 0, dy)),
    rotateZ: degNode(clock, sampledRange(easeOutCubic, start, GATHER_MS, 0, tiltDeg)),
    rotateY: degNode(clock, sampledRange(easeOutCubic, start, GATHER_MS, 0, flipDeg)),
    captionOpacity: numberNode(clock, lineRange(start, CAPTION_OUT_MS, 1, 0)),
  };
}

export interface FlipPageMotion {
  /** 見ていた（開く）ページの紙の倍率 */
  pageScale: Node;
  /** 周り（ページの下の名前と日付・ほかのページ・`n ／ m`）の不透明度 */
  surroundOpacity: Node;
}

/** めくる表示のページの動き。`stackScale` は `stackScaleOf` */
export function flipPageMotion(
  clock: Clock,
  direction: ViewModeDirection,
  stackScale: number
): FlipPageMotion {
  if (direction === 'toGrid') {
    return {
      pageScale: numberNode(clock, sampledRange(easeInQuad, 0, SHRINK_MS, 1, stackScale)),
      surroundOpacity: numberNode(clock, lineRange(0, SHRINK_MS, 1, 0)),
    };
  }
  return {
    pageScale: numberNode(
      clock,
      sampledRange(settleSpring, TO_FLIP_SWAP_MS, GROW_MS, stackScale, 1)
    ),
    surroundOpacity: numberNode(clock, sampledRange(linear, TO_FLIP_SWAP_MS, GROW_MS, 0, 1)),
  };
}

/** 面の不透明度。入れ替えは 1ms の幅の傾き */
export function paneOpacity(
  clock: Clock,
  direction: ViewModeDirection,
  pane: 'flip' | 'grid'
): Node {
  const swapAt = direction === 'toGrid' ? SHRINK_MS : TO_FLIP_SWAP_MS;
  const incoming = direction === 'toGrid' ? 'grid' : 'flip';
  return pane === incoming
    ? numberNode(clock, lineRange(swapAt, SWAP_RAMP_MS, 0, 1))
    : numberNode(clock, lineRange(swapAt, SWAP_RAMP_MS, 1, 0));
}
