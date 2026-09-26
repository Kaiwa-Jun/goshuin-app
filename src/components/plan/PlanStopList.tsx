import React, { useRef, useState } from 'react';
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
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

/** 並べ替えを始めるまでの長押し（D-5） */
const LONG_PRESS_MS = 300;

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
}

function openLeg(url: string) {
  Linking.openURL(url).catch(() => Alert.alert('Google マップを開けませんでした'));
}

/**
 * 順番の行（Issue #258 の③）。寺社 → 区間 → 寺社… 。区間ごとに「Google マップで」
 * （Google マップは電車の経路で複数の目的地を扱えないので、1区間ずつ渡す）
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
}: Props) {
  const schedule = buildSchedule(points);
  const rowHeight = useRef(72);
  const [drag, setDrag] = useState<{ index: number; dy: number } | null>(null);

  return (
    <View>
      {schedule.map((s, i) => {
        if (i >= revealed) return null;
        const spot = spots.get(s.spotId);
        const close = reception.get(s.spotId);
        const showClose = parseClock(close) !== null;
        const done = visited.has(s.spotId);
        const next = points[i + 1];
        const dragging = drag?.index === i;
        return (
          <Animated.View
            key={s.spotId}
            style={dragging ? { transform: [{ translateY: drag.dy }], zIndex: 2 } : undefined}
            onLayout={i === 0 ? e => (rowHeight.current = e.nativeEvent.layout.height) : undefined}
          >
            <View
              style={styles.stop}
              testID={`plan-stop-${i}`}
              accessible
              accessibilityLabel={`${i + 1}番目 ${spot?.name ?? ''}`}
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
              <View style={[styles.num, past && !done && styles.numMissed]}>
                <Text style={styles.numText}>{i + 1}</Text>
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
              {!readonly && (
                <DragHandle
                  index={i}
                  count={points.length}
                  rowHeight={rowHeight}
                  onDrag={dy => setDrag({ index: i, dy })}
                  onDrop={to => {
                    setDrag(null);
                    onMove(i, to);
                  }}
                />
              )}
            </View>
            {s.leg && next && i + 1 < revealed && (
              <View style={styles.leg} testID={`plan-leg-${i}`}>
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

/** 「⋮⋮」を長押ししてから縦にドラッグ。指の位置 ÷ 行の高さで入る位置を決める */
function DragHandle({
  index,
  count,
  rowHeight,
  onDrag,
  onDrop,
}: {
  index: number;
  count: number;
  rowHeight: React.MutableRefObject<number>;
  onDrag: (dy: number) => void;
  onDrop: (to: number) => void;
}) {
  const armed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => armed.current,
      onPanResponderTerminationRequest: () => !armed.current,
      onPanResponderGrant: () => {
        timer.current = setTimeout(() => (armed.current = true), LONG_PRESS_MS);
      },
      onPanResponderMove: (_, g) => {
        if (armed.current) onDrag(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (timer.current) clearTimeout(timer.current);
        if (armed.current) {
          const to = Math.max(0, Math.min(count - 1, index + Math.round(g.dy / rowHeight.current)));
          onDrop(to);
        }
        armed.current = false;
      },
      onPanResponderTerminate: () => {
        if (timer.current) clearTimeout(timer.current);
        armed.current = false;
        onDrop(index);
      },
    })
  ).current;
  return (
    <View {...responder.panHandlers} hitSlop={8} testID={`plan-stop-handle-${index}`}>
      <Text style={styles.handle}>⋮⋮</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  num: {
    width: 26,
    height: 26,
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
    marginLeft: 12,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderLeftColor: colors.gray[300],
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
