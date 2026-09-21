import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_BOXES,
  JAPAN_PREFECTURE_PATHS,
} from '@/constants/japanMap';
import { colors } from '@theme/colors';

/**
 * オンボーディングの日本地図。**見せるだけで、触らせない**。
 *
 * `JapanMap` は流用しない。あちらは `onPressPrefecture` が必須で、
 * ピンチとパンの PanResponder を持ち、塗る間隔も 90ms（47県で4.2秒）。
 * オンボーディングでは操作させないし、4秒は待たせすぎる。
 * 共有しているのは県の形（`JAPAN_PREFECTURE_PATHS`）と南→北の並べ方で、
 * そこさえ一致していれば、実機の地図と絵がずれることはない
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** 1県塗り始めてから次まで */
export const ONBOARDING_REVEAL_STEP_MS = 46;
/**
 * 1県が染まりきるまで。**間隔より長くして重ねる**。
 *
 * 色を瞬時に差し替えると、県が1つずつパッパッと切り替わって見える
 * （実機で見て分かった）。染まる時間を間隔より長く取ると、隣同士が
 * 重なって西から東へ流れる波になる
 */
export const ONBOARDING_FADE_MS = 520;

/**
 * 南から北へ。`JapanMap.revealOrder` と同じ考え方
 * （viewBox は上が北なので y の大きい順）
 */
export const ONBOARDING_ORDER = Object.keys(JAPAN_PREFECTURE_PATHS).sort(
  (a, b) => JAPAN_PREFECTURE_BOXES[b].y - JAPAN_PREFECTURE_BOXES[a].y
);

export const ONBOARDING_SWEEP_MS =
  (ONBOARDING_ORDER.length - 1) * ONBOARDING_REVEAL_STEP_MS + ONBOARDING_FADE_MS;

/**
 * 濃さの並び。**同じ模様の繰り返しに見せない**ための並べ方で、
 * 本物の枚数とは関係ない（オンボーディングには記録がまだ無い）
 */
const TIERS = [
  colors.prefectureFill.tier1,
  colors.prefectureFill.tier2,
  colors.prefectureFill.tier1,
  colors.prefectureFill.tier3,
  colors.prefectureFill.tier1,
  colors.prefectureFill.tier2,
  colors.prefectureFill.tier2,
  colors.prefectureFill.tier1,
  colors.prefectureFill.tier3,
  colors.prefectureFill.tier2,
] as const;

export const tierOf = (index: number) => TIERS[index % TIERS.length];

/** その県が染まる区間を、全体（0〜1）のどこに当てるか */
export function fadeWindow(index: number): [number, number] {
  const start = (index * ONBOARDING_REVEAL_STEP_MS) / ONBOARDING_SWEEP_MS;
  const end = (index * ONBOARDING_REVEAL_STEP_MS + ONBOARDING_FADE_MS) / ONBOARDING_SWEEP_MS;
  return [start, end];
}

interface Props {
  width: number;
  /** 塗り広がりを見せるか。false なら最初から全部塗った状態 */
  animate: boolean;
  /** 塗らずに灰色のままにする。記録の画で、地図だけ先に出すのに使う */
  blank?: boolean;
  testID?: string;
}

export function PrefectureMap({ width, animate, blank = false, testID }: Props) {
  /*
   * 47個の値を持たずに、波ひとつで駆動する。県ごとに state を持つと
   * 塗るたびに画面全体を組み直すことになる（47回の再描画）
   */
  const sweep = useRef(new Animated.Value(animate && !blank ? 0 : 1)).current;

  useEffect(() => {
    if (blank) {
      sweep.setValue(0);
      return;
    }
    if (!animate) {
      sweep.setValue(1);
      return;
    }
    sweep.setValue(0);
    const running = Animated.timing(sweep, {
      toValue: 1,
      duration: ONBOARDING_SWEEP_MS,
      // 波の速さは変えない。県ごとの染まりが等間隔でずれていくため
      easing: Easing.linear,
      /*
       * SVG の中身は native driver に載せられない。値は1つだけで、
       * そこから47県の透明度を引いている（県ごとに値を持つより軽い）
       */
      useNativeDriver: false,
    });
    running.start();
    return () => running.stop();
  }, [animate, blank, sweep]);

  return (
    <Svg
      width={width}
      height={(width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH}
      viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`}
      testID={testID}
    >
      {/* まだ行っていない県。この上に、色のついた県を重ねて染み込ませる */}
      {ONBOARDING_ORDER.map(name => (
        <Path key={name} d={JAPAN_PREFECTURE_PATHS[name]} fill={colors.prefectureFill.empty} />
      ))}
      {ONBOARDING_ORDER.map((name, i) => {
        const [start, end] = fadeWindow(i);
        return (
          <AnimatedPath
            key={name}
            testID={`onboarding-prefecture-${name}`}
            d={JAPAN_PREFECTURE_PATHS[name]}
            fill={tierOf(i)}
            opacity={
              blank
                ? 0
                : sweep.interpolate({
                    inputRange: [start, end],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                  })
            }
          />
        );
      })}
    </Svg>
  );
}
