import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { PlanSpot } from '@hooks/usePlanEditor';
import {
  buildSchedule,
  formatClock,
  googleMapsTransitUrl,
  parseClock,
  type PlanPoint,
} from '@utils/visitPlan';
import { dragShift, dragTarget, type RowLayout } from '@utils/dragReorder';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';
import Svg, { Line } from 'react-native-svg';

/** 並べ替えを始めるまでの長押し（D-5） */
const LONG_PRESS_MS = 250;
/** ほかの行がよける・持った行が収まる動きの長さ */
const SHIFT_MS = 120;
/** 番号の丸をつなぐ点線の太さ */
const RAIL_WIDTH = 2;
/** 番号の丸の直径。点線の列の幅もこれにそろえる */
const NUM_SIZE = 26;

interface Props {
  points: PlanPoint[];
  spots: Map<string, PlanSpot>;
  reception: Map<string, string>;
  /** 1番から何社目まで出すか（順に描く途中 / D-12） */
  revealed: number;
  readonly: boolean;
  past: boolean;
  visited: Set<string>;
  onMove: (from: number, to: number) => void;
  /** 並べ替えで行を持っている間 true（親はスクロールを止める。指を取り合わないため） */
  onDragStateChange?: (dragging: boolean) => void;
}

function openLeg(url: string) {
  Linking.openURL(url).catch(() => Alert.alert('Google マップを開けませんでした'));
}

/**
 * 順番の行（Issue #258 の③）。寺社 → 区間 → 寺社… 。区間ごとに「Google マップで」
 * （Google マップは電車の経路で複数の目的地を扱えないので、1区間ずつ渡す）。
 * 行を長押しすると持ち上がり、動かすとほかの行がよけて入る場所が空く
 */
export function PlanStopList({
  points,
  spots,
  reception,
  revealed,
  readonly,
  past,
  visited,
  onMove,
  onDragStateChange,
}: Props) {
  const schedule = buildSchedule(points);
  const layouts = useRef<RowLayout[]>([]);
  const shifts = useRef(new Map<string, Animated.Value>()).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const hover = useRef(0);
  const resetOnNextOrder = useRef(false);
  const [dragging, setDragging] = useState<number | null>(null);

  const shiftOf = (id: string) => {
    let v = shifts.get(id);
    if (!v) {
      v = new Animated.Value(0);
      shifts.set(id, v);
    }
    return v;
  };

  // 並べ替えを確定したら、新しい順で描かれるのと同時にずらしを戻す（先に戻すと一瞬元の順に見える）
  const orderKey = points.map(p => p.spotId).join(',');
  useLayoutEffect(() => {
    if (!resetOnNextOrder.current) return;
    resetOnNextOrder.current = false;
    dragY.setValue(0);
    shifts.forEach(v => v.setValue(0));
  }, [orderKey, dragY, shifts]);

  const lift = (i: number) => {
    hover.current = i;
    dragY.setValue(0);
    setDragging(i);
    onDragStateChange?.(true);
  };

  const drag = (i: number, dy: number) => {
    dragY.setValue(dy);
    const to = dragTarget(layouts.current, i, dy);
    if (to === hover.current) return;
    hover.current = to;
    const h = layouts.current[i]?.height ?? 0;
    points.forEach((p, j) => {
      Animated.timing(shiftOf(p.spotId), {
        toValue: dragShift(j, i, to, h),
        duration: SHIFT_MS,
        useNativeDriver: true,
      }).start();
    });
  };

  const drop = (i: number, cancel = false) => {
    const to = cancel ? i : hover.current;
    const L = layouts.current;
    // 入る場所まで滑らせてから確定する
    let offset = 0;
    if (to > i) for (let j = i + 1; j <= to; j++) offset += L[j]?.height ?? 0;
    if (to < i) for (let j = to; j < i; j++) offset -= L[j]?.height ?? 0;
    Animated.timing(dragY, { toValue: offset, duration: SHIFT_MS, useNativeDriver: true }).start(
      () => {
        setDragging(null);
        onDragStateChange?.(false);
        if (to === i) {
          dragY.setValue(0);
          shifts.forEach(v => v.setValue(0));
          return;
        }
        resetOnNextOrder.current = true;
        onMove(i, to);
      }
    );
  };

  return (
    <View>
      {schedule.map((s, i) => {
        if (i >= revealed) return null;
        const spot = spots.get(s.spotId);
        const close = reception.get(s.spotId);
        const showClose = parseClock(close) !== null;
        const done = visited.has(s.spotId);
        const next = points[i + 1];
        const held = dragging === i;
        // 次の寺社まで描けているときだけ、区間と点線を出す（順に描く途中 / D-12）
        const hasLeg = Boolean(s.leg && next && i + 1 < revealed);
        return (
          <Animated.View
            key={s.spotId}
            onLayout={e => {
              const { y, height } = e.nativeEvent.layout;
              layouts.current[i] = { y, height };
            }}
            style={[
              styles.block,
              held
                ? [styles.held, { transform: [{ translateY: dragY }, { scale: 1.03 }] }]
                : { transform: [{ translateY: shiftOf(s.spotId) }] },
            ]}
          >
            <DraggableRow index={i} enabled={!readonly} onLift={lift} onDrag={drag} onDrop={drop}>
              <View
                style={styles.stop}
                testID={`plan-stop-${i}`}
                accessible
                accessibilityLabel={`${i + 1}番目 ${spot?.name ?? ''}`}
                accessibilityHint={
                  readonly ? undefined : '長押しして上下に動かすと順番を変えられます'
                }
                accessibilityActions={
                  readonly
                    ? undefined
                    : [
                        { name: 'moveUp', label: '上へ' },
                        { name: 'moveDown', label: '下へ' },
                      ]
                }
                onAccessibilityAction={e =>
                  onMove(i, e.nativeEvent.actionName === 'moveUp' ? i - 1 : i + 1)
                }
              >
                {/* 番号の丸を朱の点線でつなぐ（地図の点線と同じステップ感） */}
                <View style={styles.numCol}>
                  <Rail visible={i > 0} testID={`plan-rail-top-${i}`} />
                  <View style={[styles.num, past && !done && styles.numMissed]}>
                    <Text style={styles.numText}>{i + 1}</Text>
                  </View>
                  <Rail visible={hasLeg} testID={`plan-rail-bottom-${i}`} />
                </View>
                <View style={styles.nameBox}>
                  <Text style={styles.name}>{spot?.name}</Text>
                  {showClose && (
                    <Text style={[styles.close, s.late && !past && styles.late]}>
                      {`受付 〜${close}${s.late && !past ? '　間に合わないかも' : ''}`}
                    </Text>
                  )}
                </View>
                {past ? (
                  <Text style={done ? styles.done : styles.missed}>
                    {done ? '✓ 記録' : '行けなかった'}
                  </Text>
                ) : (
                  <Text style={styles.time}>{formatClock(s.arriveMinutes)}</Text>
                )}
                {!readonly && <Text style={styles.handle}>⋮⋮</Text>}
              </View>
            </DraggableRow>
            {hasLeg && s.leg && (
              // 並べ替えの途中は区間が変わるので薄くする（離すと計算し直す）
              <View
                style={[styles.leg, dragging !== null && styles.legStale]}
                testID={`plan-leg-${i}`}
              >
                <View style={styles.numCol}>
                  <Rail visible testID={`plan-rail-leg-${i}`} />
                </View>
                <Text style={styles.legText}>{s.leg.label}</Text>
                {!past && (
                  <TouchableOpacity
                    style={styles.gm}
                    onPress={() => openLeg(googleMapsTransitUrl(points[i], next))}
                    testID={`plan-leg-open-${i}`}
                    accessibilityRole="link"
                  >
                    <Text style={styles.gmText}>Google マップで</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

/** 丸と丸のあいだの縦の点線。iOS は View の片側だけの点線の枠を描けないので SVG で引く */
function Rail({ visible, testID }: { visible: boolean; testID: string }) {
  if (!visible) return <View style={styles.rail} />;
  return (
    <View style={styles.rail} testID={testID}>
      <Svg width={RAIL_WIDTH} height="100%">
        <Line
          x1={RAIL_WIDTH / 2}
          y1={0}
          x2={RAIL_WIDTH / 2}
          y2="100%"
          stroke={colors.seal}
          strokeWidth={RAIL_WIDTH}
          strokeDasharray="3 4"
          testID={`${testID}-line`}
        />
      </Svg>
    </View>
  );
}

/**
 * 寺社の行を長押しで持つ。持つ前に指が動いたらスクロールに譲る（ドロワーの中を上下に見られるように）。
 * 持ったあとは離すまで指を渡さない
 */
function DraggableRow({
  index,
  enabled,
  onLift,
  onDrag,
  onDrop,
  children,
}: {
  index: number;
  enabled: boolean;
  onLift: (i: number) => void;
  onDrag: (i: number, dy: number) => void;
  onDrop: (i: number, cancel?: boolean) => void;
  children: React.ReactNode;
}) {
  const latest = useRef({ index, enabled, onLift, onDrag, onDrop });
  latest.current = { index, enabled, onLift, onDrag, onDrop };
  const armed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.enabled,
      onPanResponderTerminationRequest: () => !armed.current,
      onPanResponderGrant: () => {
        armed.current = false;
        timer.current = setTimeout(() => {
          armed.current = true;
          latest.current.onLift(latest.current.index);
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (_, g) => {
        if (armed.current) latest.current.onDrag(latest.current.index, g.dy);
        // 持つ前に動いた = スクロールしたい。長押しを取り消す
        else if (Math.abs(g.dy) > 8 || Math.abs(g.dx) > 8) clear();
      },
      onPanResponderRelease: () => {
        clear();
        if (armed.current) latest.current.onDrop(latest.current.index);
        armed.current = false;
      },
      onPanResponderTerminate: () => {
        clear();
        if (armed.current) latest.current.onDrop(latest.current.index, true);
        armed.current = false;
      },
    })
  ).current;

  useEffect(() => clear, []);

  return <View {...responder.panHandlers}>{children}</View>;
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.white },
  // 持ち上げた行。ほかの行の上に出す
  held: { zIndex: 10, elevation: 8, borderRadius: borderRadius.lg, ...shadows.lg },
  legStale: { opacity: 0.3 },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  // 丸の列。行の上下の余白まで伸ばして、前後の行の点線とつなげる
  numCol: {
    width: NUM_SIZE,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginVertical: -spacing.sm,
  },
  rail: { flex: 1, width: RAIL_WIDTH, minHeight: spacing.sm },
  num: {
    width: NUM_SIZE,
    height: NUM_SIZE,
    borderRadius: borderRadius.full,
    backgroundColor: colors.seal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numMissed: { backgroundColor: colors.gray[300] },
  numText: { ...typography.caption, fontWeight: '800', color: colors.white },
  nameBox: { flex: 1 },
  name: { ...typography.body, fontWeight: '600', color: colors.gray[900] },
  close: { ...typography.caption, color: colors.gray[500], marginTop: 1 },
  late: { color: colors.seal, fontWeight: '700' },
  time: { ...typography.caption, color: colors.gray[400], minWidth: 40, textAlign: 'right' },
  done: { ...typography.caption, fontWeight: '800', color: colors.primary[500] },
  missed: { ...typography.caption, color: colors.gray[400] },
  handle: { ...typography.h3, color: colors.gray[300], paddingHorizontal: spacing.xs },
  leg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  legText: { ...typography.caption, color: colors.gray[600], flex: 1 },
  gm: {
    borderWidth: 1,
    borderColor: colors.primary[100],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  gmText: { ...typography.caption, fontWeight: '700', color: colors.primary[600] },
});
