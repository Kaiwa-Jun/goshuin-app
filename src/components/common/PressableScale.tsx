import React, { useCallback, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';

import { useReduceMotion } from '@hooks/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** 押し込んだときの縮み具合 */
const PRESSED_SCALE = 0.92;
/** 押し込みは速く。指が触れた瞬間に反応してほしい */
const PRESS_IN_MS = 90;

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 押し込んだときの倍率。既定 0.92 */
  pressedScale?: number;
}

/**
 * 押すと少し縮んで、離すとバネで戻る。
 *
 * `TouchableOpacity` の既定（activeOpacity 0.2）は押した瞬間に 20% まで
 * 一気に薄くなるため、点滅して見える。触った手応えは不透明度より
 * 大きさの方が伝わる。
 *
 * 「視差効果を減らす」がオンなら縮まない。押せることは色や配置で伝わるので、
 * 動き以外の情報は落とさない。
 *
 * style は Pressable 自体に当たるので、タップ領域と見た目がズレない
 * （内側の View に当てると flex や position を渡したときに食い違う）。
 */
export function PressableScale({
  children,
  style,
  pressedScale = PRESSED_SCALE,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReduceMotion();

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!reduceMotion) {
        Animated.timing(scale, {
          toValue: pressedScale,
          duration: PRESS_IN_MS,
          useNativeDriver: true,
        }).start();
      }
      onPressIn?.(event);
    },
    [onPressIn, pressedScale, reduceMotion, scale]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      if (!reduceMotion) {
        // 戻りはバネ。押し込みと同じ直線で戻すと機械的に見える
        Animated.spring(scale, {
          toValue: 1,
          speed: 24,
          bounciness: 8,
          useNativeDriver: true,
        }).start();
      }
      onPressOut?.(event);
    },
    [onPressOut, reduceMotion, scale]
  );

  return (
    <AnimatedPressable
      style={[style, { transform: [{ scale }] }]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
