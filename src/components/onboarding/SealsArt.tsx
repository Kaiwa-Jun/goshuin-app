import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Seal, type SealMark } from '@components/common/Seal';
import { BADGE_STEP_MS } from '@components/record/NewBadgeRow';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { spacing } from '@theme/spacing';

/**
 * 「続けると、印が増えていく。」
 *
 * 保存直後のバッジ行と**同じ印・同じ間**で押す。オンボーディングだけ別物の
 * 絵を描くと、実際に取ったときに「これのことか」と繋がらない
 */
const MARKS: SealMark[] = ['ichi', 'go', 'juu', 'mangan', 'shiki', 'mitsu'];
const POP_MS = 420;

interface Props {
  width: number;
  active: boolean;
}

export function SealsArt({ width, active }: Props) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(MARKS.map(() => new Animated.Value(0))).current;

  const size = Math.min((width - spacing.lg * 2) / 3, 88);

  useEffect(() => {
    if (!active) {
      progress.forEach(v => v.setValue(0));
      return;
    }
    if (reduceMotion) {
      progress.forEach(v => v.setValue(1));
      return;
    }
    const running = Animated.stagger(
      BADGE_STEP_MS,
      progress.map(value =>
        Animated.timing(value, {
          toValue: 1,
          duration: POP_MS,
          delay: 280,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: true,
        })
      )
    );
    running.start();
    return () => running.stop();
  }, [active, reduceMotion, progress]);

  return (
    <View style={[styles.grid, { width: size * 3 + spacing.md * 2 }]} testID="onboarding-art-seals">
      {MARKS.map((mark, i) => (
        <Animated.View
          key={mark}
          testID={`onboarding-seal-${mark}`}
          style={{
            opacity: progress[i],
            transform: [
              { scale: progress[i].interpolate({ inputRange: [0, 1], outputRange: [2.1, 1] }) },
            ],
          }}
        >
          <Seal mark={mark} earned size={size} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
