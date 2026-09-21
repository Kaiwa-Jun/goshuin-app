import { useEffect, useRef, useState } from 'react';
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

/** 1県塗ってから次まで。47県で約2.2秒 */
export const ONBOARDING_REVEAL_STEP_MS = 46;

/**
 * 南から北へ。`JapanMap.revealOrder` と同じ考え方
 * （viewBox は上が北なので y の大きい順）
 */
export const ONBOARDING_ORDER = Object.keys(JAPAN_PREFECTURE_PATHS).sort(
  (a, b) => JAPAN_PREFECTURE_BOXES[b].y - JAPAN_PREFECTURE_BOXES[a].y
);

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

interface Props {
  width: number;
  /** 塗り広がりを見せるか。false なら最初から全部塗った状態 */
  animate: boolean;
  /** 塗らずに灰色のままにする。記録の画で、地図だけ先に出すのに使う */
  blank?: boolean;
  testID?: string;
}

export function PrefectureMap({ width, animate, blank = false, testID }: Props) {
  const [painted, setPainted] = useState(animate && !blank ? 0 : ONBOARDING_ORDER.length);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (blank || !animate) {
      setPainted(blank ? 0 : ONBOARDING_ORDER.length);
      return;
    }
    setPainted(0);
    timers.current = ONBOARDING_ORDER.map((_, i) =>
      setTimeout(() => setPainted(i + 1), (i + 1) * ONBOARDING_REVEAL_STEP_MS)
    );
    const running = timers.current;
    return () => running.forEach(clearTimeout);
  }, [animate, blank]);

  return (
    <Svg
      width={width}
      height={(width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH}
      viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`}
      testID={testID}
    >
      {ONBOARDING_ORDER.map((name, i) => (
        <Path
          key={name}
          testID={`onboarding-prefecture-${name}`}
          d={JAPAN_PREFECTURE_PATHS[name]}
          fill={i < painted ? tierOf(i) : colors.prefectureFill.empty}
        />
      ))}
    </Svg>
  );
}
