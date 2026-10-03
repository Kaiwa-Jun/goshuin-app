import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PanResponderGestureState,
} from 'react-native';

import { colors } from '@theme/colors';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

/** ドロワーの2段（画面の高さに対する割合） */
export const DRAWER_LOW = 0.36;
export const DRAWER_HIGH = 0.8;

/** 縦に動いたと見なす指の移動（px）。これ未満はタップ・長押しとして中に任せる */
const MOVE_SLOP = 6;

/** 中の一覧（ScrollView）に渡す props。スクロールの位置をドロワーが知るため */
export interface DrawerScrollBind {
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onLayout: (e: LayoutChangeEvent) => void;
  onContentSizeChange: (w: number, h: number) => void;
  scrollEventThrottle: number;
  /** ドロワーを動かしている間は一覧を止める（両方が動かないように） */
  scrollEnabled: boolean;
}

/**
 * 指の動き始めで、ドロワー自体を動かすか（true）、中の一覧をスクロールするか（false）。
 * 一覧がいちばん上で下へ → ドロワーを下げる / いちばん下で上へ → ドロワーを広げる
 */
export function shouldDrawerTake({
  dy,
  dx = 0,
  scrollY,
  contentH,
  viewH,
  height,
  low,
  high,
}: {
  dy: number;
  dx?: number;
  scrollY: number;
  contentH: number;
  viewH: number;
  height: number;
  low: number;
  high: number;
}): boolean {
  if (Math.abs(dy) < MOVE_SLOP || Math.abs(dy) < Math.abs(dx)) return false;
  if (dy > 0) return scrollY <= 0 && height > low + 1;
  const atBottom = contentH - viewH - scrollY <= 1;
  return atBottom && height < high - 1;
}

/** ドロワーの2段の高さ。広げた段は maxHeight で抑える（低い段は割らない） */
export function drawerSnaps(screen: number, maxHeight?: number): { low: number; high: number } {
  const low = screen * DRAWER_LOW;
  const high = Math.max(low, Math.min(screen * DRAWER_HIGH, maxHeight ?? Infinity));
  return { low, high };
}

interface Props {
  header: React.ReactNode;
  footer: React.ReactNode;
  /** 中の一覧。渡された props を ScrollView に付ける */
  children: (bind: DrawerScrollBind) => React.ReactNode;
  onHeightChange?: (height: number) => void;
  /** 中の一覧が替わったら（② ↔ ③）スクロールの位置を忘れる */
  listKey?: string;
  /** 広げた段の上限（上のバーの下に地図を少し残す）。画面の DRAWER_HIGH より低ければこちら */
  maxHeight?: number;
}

/**
 * 予定を組む画面の下のドロワー（Issue #258）。つまみを引くか、中の一覧が端まで行った先へ
 * 指を動かすとドロワー自体が動く。一覧に続きがある間は一覧をスクロールする
 */
export function PlanDrawer({
  header,
  footer,
  children,
  onHeightChange,
  listKey,
  maxHeight,
}: Props) {
  const { height: screen } = useWindowDimensions();
  const { low, high } = drawerSnaps(screen, maxHeight);
  const height = useRef(new Animated.Value(low)).current;
  const current = useRef(low);
  const bounds = useRef({ low, high });
  bounds.current = { low, high };
  const scroll = useRef({ y: 0, contentH: 0, viewH: 0 });
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    scroll.current.y = 0;
  }, [listKey]);

  const snapTo = (to: number) => {
    current.current = to;
    onHeightChange?.(to);
    Animated.spring(height, { toValue: to, useNativeDriver: false, bounciness: 0 }).start();
  };

  const move = (g: PanResponderGestureState) => {
    const { low: l, high: h } = bounds.current;
    height.setValue(Math.max(l, Math.min(h, current.current - g.dy)));
  };
  const release = (g: PanResponderGestureState, tapToggles: boolean) => {
    const { low: l, high: h } = bounds.current;
    const next = current.current - g.dy;
    setMoving(false);
    // つまみを少し引いただけ（タップ）なら反対側へ
    if (tapToggles && Math.abs(g.dy) < MOVE_SLOP) snapTo(current.current === l ? h : l);
    else snapTo(next > (l + h) / 2 ? h : l);
  };

  const handleResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setMoving(true),
      onPanResponderMove: (_, g) => move(g),
      onPanResponderRelease: (_, g) => release(g, true),
      onPanResponderTerminate: (_, g) => release(g, false),
    })
  ).current;

  // 中の一覧の上で動いた指。端まで行っているときだけ横取りする
  const bodyResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        shouldDrawerTake({
          dy: g.dy,
          dx: g.dx,
          scrollY: scroll.current.y,
          contentH: scroll.current.contentH,
          viewH: scroll.current.viewH,
          height: current.current,
          low: bounds.current.low,
          high: bounds.current.high,
        }),
      onPanResponderGrant: () => setMoving(true),
      onPanResponderMove: (_, g) => move(g),
      onPanResponderRelease: (_, g) => release(g, false),
      onPanResponderTerminate: (_, g) => release(g, false),
    })
  ).current;

  const bind: DrawerScrollBind = {
    onScroll: e => {
      scroll.current.y = e.nativeEvent.contentOffset.y;
    },
    onLayout: e => {
      scroll.current.viewH = e.nativeEvent.layout.height;
    },
    onContentSizeChange: (_, h) => {
      scroll.current.contentH = h;
    },
    scrollEventThrottle: 16,
    scrollEnabled: !moving,
  };

  return (
    <Animated.View style={[styles.drawer, { height }]} testID="plan-drawer">
      <View {...handleResponder.panHandlers} style={styles.grabArea} testID="plan-drawer-handle">
        <View style={styles.grab} />
      </View>
      {header}
      <View {...bodyResponder.panHandlers} style={styles.body} testID="plan-drawer-body">
        {children(bind)}
      </View>
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
