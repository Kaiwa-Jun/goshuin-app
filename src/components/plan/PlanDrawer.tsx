import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';

import { colors } from '@theme/colors';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

/** ドロワーの2段（画面の高さに対する割合） */
export const DRAWER_LOW = 0.45;
export const DRAWER_HIGH = 0.8;

interface Props {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
  onHeightChange?: (height: number) => void;
}

/**
 * 予定を組む画面の下のドロワー（Issue #258）。つまみを引いたときだけ動く
 * （中の「⋮⋮」の並べ替えと取り合わないように、ドロワー全体では指を取らない）
 */
export function PlanDrawer({ header, footer, children, onHeightChange }: Props) {
  const { height: screen } = useWindowDimensions();
  const low = screen * DRAWER_LOW;
  const high = screen * DRAWER_HIGH;
  const height = useRef(new Animated.Value(low)).current;
  const current = useRef(low);
  const bounds = useRef({ low, high });
  bounds.current = { low, high };

  const snapTo = (to: number) => {
    current.current = to;
    onHeightChange?.(to);
    Animated.spring(height, { toValue: to, useNativeDriver: false, bounciness: 0 }).start();
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const { low: l, high: h } = bounds.current;
        height.setValue(Math.max(l, Math.min(h, current.current - g.dy)));
      },
      onPanResponderRelease: (_, g) => {
        const { low: l, high: h } = bounds.current;
        const next = current.current - g.dy;
        // 少し引いただけ（タップ）なら反対側へ
        if (Math.abs(g.dy) < 6) snapTo(current.current === l ? h : l);
        else snapTo(next > (l + h) / 2 ? h : l);
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.drawer, { height }]} testID="plan-drawer">
      <View {...responder.panHandlers} style={styles.grabArea} testID="plan-drawer-handle">
        <View style={styles.grab} />
      </View>
      {header}
      <View style={styles.body}>{children}</View>
      <View style={styles.footer}>{footer}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.lg,
  },
  grabArea: { alignItems: 'center', paddingVertical: spacing.sm },
  grab: {
    width: 40,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[300],
  },
  body: { flex: 1 },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
});
