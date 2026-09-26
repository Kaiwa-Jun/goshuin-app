import { useEffect } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * 御朱印帳の写真の読み込み中に使う、動きの時計（Issue #275）。
 *
 * **時計はアプリで1本だけ**。読み込み中の枠がいくつあっても、登録の数を
 * モジュールで数えて、0 → 1 で回し始め、1 → 0 で止める。止まらない
 * アニメーションがネイティブのメモリを食い潰した #99 追補3 の教訓で、
 * 読み込み中の枠が1つも無いのに回し続けない。
 *
 * めくる・印・明滅の値は、すべてこの時計からネイティブで引く。
 * 読み込み中に JS へ値を運ばない（値を JS で見張らない・タイマーを使わない）。
 * 読み込み中の state 更新と再描画は 0 回。
 *
 * 値の正は docs/design/mockups/2026-09-gallery-loading-v2.html の paint()。
 */

/** めくる1周。ひとめくり 850ms と、間 650ms */
export const FLIP_PERIOD_MS = 1500;
/** ひとめくり */
export const FLIP_TURN_MS = 850;
/** 印の一巡。1周で印が2つ進み、6つの印を3周で回る */
export const SEAL_PERIOD_MS = 4500;
/** タイルの明滅の1周 */
export const BREATH_PERIOD_MS = 1600;
/** 明滅のいちばん暗いところ */
export const BREATH_MIN_OPACITY = 0.72;
/** 写真が届いてから下地が消えるまで */
export const CROSSFADE_MS = 250;
/**
 * 時計の1回り。めくる 1500・印 4500・明滅 1600 の最小公倍数なので、
 * つなぎ目で3つとも位相 0 に戻る
 */
export const LOADING_CLOCK_CYCLE_MS = 72000;

/** 試作の MARKS の順。めくるたびに2つ進む */
export const LOADING_SEAL_MARKS = ['ichi', 'go', 'juu', 'mangan', 'shiki', 'mitsu'] as const;
export type LoadingSealMark = (typeof LOADING_SEAL_MARKS)[number];

/** 印が出る4つの面。左のページ・めくれる紙の表・めくれる紙の裏・下の右ページ */
export type LoadingSealFace = 'left' | 'front' | 'back' | 'under';
export const LOADING_SEAL_FACES: readonly LoadingSealFace[] = ['left', 'front', 'back', 'under'];

/** 周 k のとき、面に出る印は MARKS[2k + この値]（試作の sealSvg(2k−1…2k+2)） */
const FACE_OFFSET: Record<LoadingSealFace, number> = { left: -1, front: 0, back: 1, under: 2 };

/**
 * 印を切り替える位置を周の境目からずらす量。
 *
 * **その面が見えていないときにだけ切り替える**。左と表は境目の 1ms 前
 * （紙は左に倒れきっていて、左は紙の下・表は向こうを向いている）、
 * 裏と下は境目の 1ms 後（紙は右に戻ったところで、裏は向こうを向き・下は紙の下）。
 * 4面を境目で一度に切り替えると、めくれる紙が右へ戻る瞬間に前の印が一瞬見える
 */
const FACE_SWITCH_DELAY_MS: Record<LoadingSealFace, 0 | 1> = {
  left: 0,
  front: 0,
  back: 1,
  under: 1,
};

/** 切り替えの傾きの幅。幅 0 の段にはしない（Android と C++ の実装は確かめていない） */
const SEAL_SWITCH_RAMP_MS = 1;

const mod = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;

const turnCurve = Easing.inOut(Easing.quad);

/** 1周の中の位置（0 ≤ phase ≤ FLIP_PERIOD_MS）でのめくりの進み */
const turnProgressInPhase = (phase: number) =>
  phase < FLIP_TURN_MS ? turnCurve(phase / FLIP_TURN_MS) : 1;

/** めくりの進み。0 = 紙が右のページの上、1 = 左へ倒れきった */
export function flipProgressAt(ms: number): number {
  return turnProgressInPhase(mod(ms, FLIP_PERIOD_MS));
}

/** タイルの明滅の不透明度。1 ↔ 0.72 */
export function breathOpacityAt(ms: number): number {
  const wave = 0.5 + 0.5 * Math.cos((2 * Math.PI * ms) / BREATH_PERIOD_MS);
  return BREATH_MIN_OPACITY + (1 - BREATH_MIN_OPACITY) * wave;
}

/** その時刻に面に出ている印。切り替えの傾きの外で、不透明度 1 の印を返す */
export function sealMarkAt(face: LoadingSealFace, ms: number): LoadingSealMark {
  const round = mod(Math.floor((ms - FACE_SWITCH_DELAY_MS[face]) / FLIP_PERIOD_MS), 3);
  return LOADING_SEAL_MARKS[mod(2 * round + FACE_OFFSET[face], LOADING_SEAL_MARKS.length)];
}

/** 面に出る3つの印（周 0・1・2 の順）。先頭が止まっている本の印 */
export function sealMarksOnFace(face: LoadingSealFace): LoadingSealMark[] {
  return [0, 1, 2].map(round => sealMarkAt(face, round * FLIP_PERIOD_MS + FLIP_PERIOD_MS / 2));
}

/* ── 時計 ── */

export const loadingClock = new Animated.Value(0);

let holders = 0;
let running: Animated.CompositeAnimation | null = null;
/** テストの後始末より前に取った登録を、後始末のあとで数えないため */
let generation = 0;

function startClock() {
  // ネイティブの loop は start したときの値から回る。途中の値から始めると1周の速さがずれる
  loadingClock.setValue(0);
  running = Animated.loop(
    Animated.timing(loadingClock, {
      toValue: LOADING_CLOCK_CYCLE_MS,
      duration: LOADING_CLOCK_CYCLE_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  );
  running.start();
}

function stopClock() {
  // 値は戻さない。ふわっと消えている最中の下地が跳ねないように
  running?.stop();
  running = null;
}

/** 時計を使う。戻り値で手放す（2回呼んでも1回分しか減らさない） */
export function acquireLoadingClock(): () => void {
  const acquiredIn = generation;
  holders += 1;
  if (holders === 1) startClock();

  let released = false;
  return () => {
    if (released || acquiredIn !== generation) return;
    released = true;
    holders -= 1;
    if (holders === 0) stopClock();
  };
}

/** active の間だけ時計を使う */
export function useLoadingClock(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    return acquireLoadingClock();
  }, [active]);
}

export function isLoadingClockRunning(): boolean {
  return running !== null;
}

/** テスト用。時計を止め、登録の数と値を 0 に戻す（resetTabBarIconMotion と同じ考え方） */
export function resetLoadingClockForTests(): void {
  running?.stop();
  running = null;
  holders = 0;
  generation += 1;
  loadingClock.setValue(0);
}

/* ── 時計から引く値。モジュールに1組だけ作り、全部の本・タイルで共有する ── */

const flipPhase = Animated.modulo<number>(loadingClock, FLIP_PERIOD_MS);
const sealPhase = Animated.modulo<number>(loadingClock, SEAL_PERIOD_MS);
const breathPhase = Animated.modulo<number>(loadingClock, BREATH_PERIOD_MS);

/*
 * ネイティブの補間は easing を受け付けないので、曲線は点で刻む。
 * めくる: 0〜850 を 10 等分した 11 点 ＋ 1500
 */
const FLIP_POINTS = [
  ...Array.from({ length: 11 }, (_, i) => (FLIP_TURN_MS * i) / 10),
  FLIP_PERIOD_MS,
];
const FLIP_PROGRESS = FLIP_POINTS.map(turnProgressInPhase);

const flipNode = (outputRange: number[] | string[]) =>
  flipPhase.interpolate({ inputRange: FLIP_POINTS, outputRange, extrapolate: 'clamp' });

/** 明滅: 0〜1600 を 100 ごとに 17 点 */
const BREATH_POINTS = Array.from({ length: BREATH_PERIOD_MS / 100 + 1 }, (_, i) => i * 100);

export const loadingMotion = {
  /** 紙の回転。0 → −180deg で、右のページの上から手前に起き上がって左へ倒れる */
  leafRotateY: flipNode(
    FLIP_PROGRESS.map(q => `${-180 * q}deg`)
  ) as unknown as Animated.AnimatedInterpolation<string>,
  /** 紙が真横を向くときに少し縮む */
  leafScaleX: flipNode(FLIP_PROGRESS.map(q => 1 - 0.08 * Math.sin(q * Math.PI))),
  /** 紙の面に乗る陰 */
  leafShadeOpacity: flipNode(FLIP_PROGRESS.map(q => Math.sin(q * Math.PI))),
  /** 右のページに落ちる影。真横でいちばん濃く、着いたら消える */
  castOpacity: flipNode(FLIP_PROGRESS.map(q => 0.9 * Math.sin(q * Math.PI))),
  /** タイルの下地の明滅。すべての下地がそろう */
  breathOpacity: breathPhase.interpolate({
    inputRange: BREATH_POINTS,
    outputRange: BREATH_POINTS.map(breathOpacityAt),
    extrapolate: 'clamp',
  }),
};

/** 面ごとの切り替えの傾きの両端（0〜4500 の中）と、1周の両端 */
function sealPointsOf(face: LoadingSealFace): number[] {
  const delay = FACE_SWITCH_DELAY_MS[face];
  const points = new Set<number>([0, SEAL_PERIOD_MS]);
  for (let boundary = 0; boundary <= SEAL_PERIOD_MS; boundary += FLIP_PERIOD_MS) {
    const end = boundary + delay;
    for (const point of [end - SEAL_SWITCH_RAMP_MS, end]) {
      if (point >= 0 && point <= SEAL_PERIOD_MS) points.add(point);
    }
  }
  return [...points].sort((a, b) => a - b);
}

const sealNodes = new Map<string, Animated.AnimatedInterpolation<number>>();

/** 面に出す印の不透明度（0 か 1 の段）。見えていないときにだけ切り替わる */
export function sealOpacity(
  face: LoadingSealFace,
  mark: LoadingSealMark
): Animated.AnimatedInterpolation<number> {
  const key = `${face}:${mark}`;
  const cached = sealNodes.get(key);
  if (cached) return cached;

  const inputRange = sealPointsOf(face);
  const node = sealPhase.interpolate({
    inputRange,
    outputRange: inputRange.map(point => (sealMarkAt(face, point) === mark ? 1 : 0)),
    extrapolate: 'clamp',
  });
  sealNodes.set(key, node);
  return node;
}
