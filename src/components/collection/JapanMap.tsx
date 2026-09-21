import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_BOXES,
  JAPAN_PREFECTURE_NAMES,
  JAPAN_PREFECTURE_PATHS,
} from '@/constants/japanMap';
import { colors } from '@theme/colors';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import { clampPan, panForPinch, pinchScale, touchDistance, type Pan } from '@utils/japanMapZoom';

/** 1県が塗られてから次の県までの間 */
export const REVEAL_STEP_MS = 90;
/** 全体に戻すときの長さ */
export const MAP_ZOOM_MS = 380;
/** これ以上なら「寄っている」とみなす */
const ZOOMED_AT = 1.01;

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
  /** 地図を描く幅。指で動かす計算に実寸が要る */
  width: number;
  /**
   * 地図をいま操作しているか。
   *
   * 親の縦スクロールを止めるのに使う。iOS の ScrollView はネイティブの
   * ジェスチャなので、JS 側で指を引き取っても一緒に動いてしまう。
   * 指が乗っている間だけ止めるのが定番の解き方。
   */
  onInteraction?: (active: boolean) => void;
  /**
   * いま何県まで塗ったか。上の数字を一緒に増やすのに使う。
   * 数字だけ最初から最終値だと、塗り広がりと噛み合わない
   */
  onRevealed?: (count: number) => void;
}

/**
 * 日本地図。47県を御朱印の枚数で塗る。
 *
 * **色に載せる意味は枚数ひとつだけ**。「いちばん新しい」は載せない
 * （docs/design/2026-09-ayumi-map-spec.md §0）。
 *
 * 操作は地図アプリと同じで、**二本指で広げて寄り、一本指で動かし、タップで選ぶ**。
 * react-native-gesture-handler は入れない。PanResponder は指の本数も座標も
 * 持っているので、二本指の距離からピンチを組める。依存を増やすと dev build の
 * 焼き直しがもう1回要る。
 */
export function JapanMap({
  stampCountByPrefecture,
  onPressPrefecture,
  animate = false,
  width,
  onInteraction,
  onRevealed,
}: Props) {
  const height = (width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;

  const visited = useMemo(
    () => JAPAN_PREFECTURE_NAMES.filter(name => (stampCountByPrefecture.get(name) ?? 0) > 0),
    [stampCountByPrefecture]
  );
  const order = useMemo(() => revealOrder(visited), [visited]);

  // 塗り終わった県の数。アニメーションしないときは最初から全部
  const [revealed, setRevealed] = useState(animate ? 0 : order.length);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** 前に塗った県ぶれ。画面を離れて戻るたびに塗り直さないための目印 */
  const painted = useRef<string | null>(null);
  const signature = order.join(',');

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    // 塗る県が前と同じなら、動かさず最後の状態を出す。戻るたびに
    // 塗り広がりが再生すると、ただうるさい
    if (!animate || painted.current === signature) {
      painted.current = signature;
      setRevealed(order.length);
      return;
    }
    painted.current = signature;

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
  }, [animate, order, signature]);

  const revealedRef = useRef(onRevealed);
  revealedRef.current = onRevealed;
  useEffect(() => {
    revealedRef.current?.(revealed);
  }, [revealed]);

  const [zoomed, setZoomed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  /** いまの値。ジェスチャの途中で読むので Animated とは別に持つ */
  const now = useRef<{ scale: number; pan: Pan }>({ scale: 1, pan: { x: 0, y: 0 } });
  const start = useRef<{ distance: number; scale: number; pan: Pan }>({
    distance: 0,
    scale: 1,
    pan: { x: 0, y: 0 },
  });
  const resetting = useRef<Animated.CompositeAnimation | null>(null);
  const interacting = useRef(false);

  /** 同じ値を何度も親へ渡さない（そのたびに親が描き直される） */
  const setInteracting = useCallback(
    (active: boolean) => {
      if (interacting.current === active) return;
      interacting.current = active;
      onInteraction?.(active);
    },
    [onInteraction]
  );

  const apply = useCallback(
    (nextScale: number, nextPan: Pan) => {
      const limited = clampPan(nextScale, nextPan, width, height);
      now.current = { scale: nextScale, pan: limited };
      scale.setValue(nextScale);
      pan.setValue(limited);
      setZoomed(nextScale > ZOOMED_AT);
    },
    [height, pan, scale, width]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        // タップは下の県に通す。動いたとき・二本指のときだけ引き取る
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (event, gesture) =>
          event.nativeEvent.touches.length >= 2 ||
          (now.current.scale > ZOOMED_AT && Math.hypot(gesture.dx, gesture.dy) > 4),
        onPanResponderGrant: event => {
          resetting.current?.stop();
          setInteracting(true);
          start.current = {
            distance: touchDistance(event.nativeEvent.touches),
            scale: now.current.scale,
            pan: now.current.pan,
          };
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const distance = touchDistance(touches);
            // 一本指から二本指に増えた瞬間は、その距離を基準にし直す
            if (start.current.distance <= 0) {
              start.current = {
                ...start.current,
                distance,
                scale: now.current.scale,
                pan: now.current.pan,
              };
              return;
            }
            const next = pinchScale(start.current.scale, start.current.distance, distance);
            const focus = {
              x: (touches[0].locationX + touches[1].locationX) / 2,
              y: (touches[0].locationY + touches[1].locationY) / 2,
            };
            apply(
              next,
              panForPinch(start.current.pan, focus, start.current.scale, next, width, height)
            );
            return;
          }

          // 一本指は移動。全体表示では引き取らないので、縦スクロールを邪魔しない
          apply(now.current.scale, {
            x: start.current.pan.x + gesture.dx,
            y: start.current.pan.y + gesture.dy,
          });
        },
        onPanResponderRelease: () => {
          start.current.distance = 0;
          setInteracting(false);
        },
        onPanResponderTerminate: () => {
          start.current.distance = 0;
          setInteracting(false);
        },
      }),
    [apply, height, setInteracting, width]
  );

  /*
   * 指が触れた時点で止める。動き出してからでは、最初の数 px ぶん画面が
   * 流れてしまう。全体表示の一本指だけは、縦スクロールの邪魔をしないよう
   * そのまま通す
   */
  const handleTouchStart = (event: GestureResponderEvent) => {
    if (event.nativeEvent.touches.length >= 2 || now.current.scale > ZOOMED_AT) {
      setInteracting(true);
    }
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    if (event.nativeEvent.touches.length === 0) setInteracting(false);
  };

  const resetZoom = useCallback(() => {
    resetting.current?.stop();
    resetting.current = Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: MAP_ZOOM_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(pan, {
        toValue: { x: 0, y: 0 },
        duration: MAP_ZOOM_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    resetting.current.start(() => {
      now.current = { scale: 1, pan: { x: 0, y: 0 } };
      setZoomed(false);
    });
  }, [pan, scale]);

  // 画面から外れたら止める。動いたままにするとタイマーが生き残る。
  // スクロールも必ず戻す（止めたまま外れると、二度と縦に動かせなくなる）
  useEffect(
    () => () => {
      resetting.current?.stop();
      if (interacting.current) onInteraction?.(false);
    },
    [onInteraction]
  );

  const shown = new Set(order.slice(0, revealed));

  return (
    <View
      accessible={false}
      accessibilityLabel={`47都道府県のうち${visited.length}県`}
      testID="japan-map"
      style={[styles.window, { width, height }]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      {...responder.panHandlers}
    >
      <Animated.View
        style={{ transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }] }}
      >
        <Svg viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`} width={width} height={height}>
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
                // ⚠️ accessibilityRole は react-native-svg の Path が受け付けない。
                // 読み上げは accessible + accessibilityLabel で届くので、
                // 「ボタン」と付かないのは既知の天井として受け入れる
                accessibilityLabel={stampCount > 0 ? `${name}、${stampCount}枚` : `${name}、まだ`}
              />
            );
          })}
        </Svg>
      </Animated.View>

      {zoomed && (
        <TouchableOpacity
          style={styles.reset}
          onPress={resetZoom}
          testID="japan-map-reset"
          accessibilityRole="button"
          accessibilityLabel="地図を全体に戻す"
        >
          <Text style={styles.resetText}>全体に戻す</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 寄せた地図が枠からはみ出さないようにする
  window: { overflow: 'hidden', borderRadius: borderRadius.md },
  reset: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  resetText: { ...typography.caption, fontWeight: '700', color: colors.gray[700] },
});
