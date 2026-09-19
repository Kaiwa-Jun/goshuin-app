import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** コンパスが1周して、行き過ぎてから落ち着くまで */
const SPIN_DURATION_MS = 700;

interface TabBarIconProps {
  name: IconName;
  color: string;
  focused: boolean;
  size?: number;
}

/**
 * 選択された瞬間だけ回る下タブのアイコン。
 *
 * `explore` は「塗りつぶした円 + 白い針」で円が回転対称なため、アイコン全体を
 * 回すと針だけが回って見える。1周させたあと少し行き過ぎて戻ることで、
 * 方位磁針が揺れて落ち着く感じになる。
 *
 * 一過性のアニメーションだけを持ち、常時動き続けるものは置かない
 * （#99 追補3: 無限ループのアニメがネイティブメモリを食い潰した）。
 */
export function TabBarIcon({ name, color, focused, size = 24 }: TabBarIconProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const wasFocused = useRef(focused);
  const [reduceMotion, setReduceMotion] = useState(false);

  // 「視差効果を減らす」がオンなら回さない（色の切り替えだけにする）
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const justFocused = focused && !wasFocused.current;
    wasFocused.current = focused;
    if (!justFocused || reduceMotion) return;

    // 連打されても毎回先頭から。走行中のものは setValue で打ち切られる
    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1,
      duration: SPIN_DURATION_MS,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver: true,
    }).start();
  }, [focused, reduceMotion, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }} testID={`tab-icon-${name}`}>
      <MaterialIcons name={name} size={size} color={color} />
    </Animated.View>
  );
}
