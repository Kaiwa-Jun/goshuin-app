import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_BOXES,
  JAPAN_PREFECTURE_NAMES,
  JAPAN_PREFECTURE_PATHS,
} from '@/constants/japanMap';
import { colors } from '@theme/colors';

/** 1県が塗られてから次の県までの間 */
export const REVEAL_STEP_MS = 90;

export type PrefectureTier = 'empty' | 'tier1' | 'tier2' | 'tier3';

/**
 * 県の濃さ。基準は**御朱印の枚数**であって箇所数ではない。
 * 同じ寺社に何度も通う人の濃さが出るようにするため。
 */
export function prefectureTier(stampCount: number): PrefectureTier {
  if (stampCount <= 0) return 'empty';
  if (stampCount <= 2) return 'tier1';
  if (stampCount <= 5) return 'tier2';
  return 'tier3';
}

/**
 * 南から北へ。旅が進むように塗る。
 * viewBox は上が北なので、y の大きい順が南から。
 */
export function revealOrder(visited: string[]): string[] {
  return [...visited].sort(
    (a, b) => (JAPAN_PREFECTURE_BOXES[b]?.y ?? 0) - (JAPAN_PREFECTURE_BOXES[a]?.y ?? 0)
  );
}

interface Props {
  /** 県名 → その県の御朱印の枚数 */
  stampCountByPrefecture: Map<string, number>;
  onPressPrefecture: (prefecture: string) => void;
  /** 塗り広がりを見せるか。データが変わったときだけ true にする */
  animate?: boolean;
}

/**
 * 日本地図。47県を御朱印の枚数で塗る。
 *
 * **色に載せる意味は枚数ひとつだけ**。「いちばん新しい」は載せない
 * （docs/design/2026-09-ayumi-map-spec.md §0）。
 */
export function JapanMap({ stampCountByPrefecture, onPressPrefecture, animate = false }: Props) {
  const visited = useMemo(
    () => JAPAN_PREFECTURE_NAMES.filter(name => (stampCountByPrefecture.get(name) ?? 0) > 0),
    [stampCountByPrefecture]
  );
  const order = useMemo(() => revealOrder(visited), [visited]);

  // 塗り終わった県の数。アニメーションしないときは最初から全部
  const [revealed, setRevealed] = useState(animate ? 0 : order.length);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (!animate) {
      setRevealed(order.length);
      return;
    }

    let cancelled = false;
    setRevealed(0);
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => {
        if (cancelled) return;
        // 動きを減らす設定なら、最後の状態をすぐ出す
        if (reduce) {
          setRevealed(order.length);
          return;
        }
        order.forEach((_, i) => {
          timers.current.push(setTimeout(() => setRevealed(i + 1), (i + 1) * REVEAL_STEP_MS));
        });
      })
      .catch(() => setRevealed(order.length));

    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [animate, order]);

  const shown = new Set(order.slice(0, revealed));

  return (
    <View
      accessible={false}
      accessibilityLabel={`47都道府県のうち${visited.length}県`}
      testID="japan-map"
    >
      <Svg viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`} width="100%" height="100%">
        {JAPAN_PREFECTURE_NAMES.map(name => {
          const stampCount = stampCountByPrefecture.get(name) ?? 0;
          const tier = shown.has(name) ? prefectureTier(stampCount) : 'empty';
          return (
            <Path
              key={name}
              testID={`prefecture-${name}`}
              d={JAPAN_PREFECTURE_PATHS[name]}
              fill={colors.prefectureFill[tier]}
              stroke={colors.prefectureFill.border}
              strokeWidth={2}
              onPress={() => onPressPrefecture(name)}
              accessible
              accessibilityLabel={stampCount > 0 ? `${name}、${stampCount}枚` : `${name}、まだ`}
            />
          );
        })}
      </Svg>
    </View>
  );
}
