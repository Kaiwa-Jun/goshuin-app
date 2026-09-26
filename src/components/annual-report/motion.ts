import { Animated, Easing, type EasingFunction } from 'react-native';

/**
 * 年報の動きの部品（Issue #274 D-11）。
 *
 * **すべての動きはシーンの時計（1本の Animated.Value・単位は ms）から interpolate で作る**。
 * 要素ごとに timing や delay を持たせると、押して止めたときに止まらない要素が出る。
 * 値は動きの試作 v1 の tween(delay, duration) の書き写し
 */

/** 試作の easeOut = 1 − (1 − p)³ */
export const easeOut: EasingFunction = Easing.out(Easing.cubic);
/** 試作の easeInOut */
export const easeInOut: EasingFunction = Easing.inOut(Easing.cubic);
export const linear: EasingFunction = Easing.linear;

export type Clock = Animated.Value;

/** 時計の [delay, delay + duration] で from → to。前後は clamp（最後の形で止まる） */
export function tween(
  clock: Clock,
  delay: number,
  duration: number,
  from: number,
  to: number,
  easing: EasingFunction = easeOut
): Animated.AnimatedInterpolation<number> {
  return clock.interpolate({
    inputRange: [delay, delay + duration],
    outputRange: [from, to],
    easing,
    extrapolate: 'clamp',
  });
}

/** 角度など字の値の tween（'-10deg' → '-4deg'） */
export function tweenText(
  clock: Clock,
  delay: number,
  duration: number,
  from: string,
  to: string,
  easing: EasingFunction = easeOut
): Animated.AnimatedInterpolation<string> {
  return clock.interpolate({
    inputRange: [delay, delay + duration],
    outputRange: [from, to],
    easing,
    extrapolate: 'clamp',
  });
}

/** 透明度 0 → 1 */
export function fade(clock: Clock, delay: number, duration: number) {
  return { opacity: tween(clock, delay, duration, 0, 1) };
}

/** 透明度 0 → 1 と、下から dy 上がる */
export function fadeUp(clock: Clock, delay: number, duration: number, dy: number) {
  return {
    opacity: tween(clock, delay, duration, 0, 1),
    transform: [{ translateY: tween(clock, delay, duration, dy, 0) }],
  };
}

/**
 * 時計の今の値。数え上げの**最初の表示**に使う（listener だけに頼ると、
 * 視差効果を減らす で最初から最後の値に置かれた時計が「0」のまま残る）。
 * Animated.Value の型に読み出しが無いので、ここだけで読む
 */
export function readClock(clock: Clock): number {
  return (clock as unknown as { __getValue: () => number }).__getValue();
}
