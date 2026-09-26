import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Badge } from '@components/common/Badge';
import type { PlanSpot } from '@hooks/usePlanEditor';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

/** カードがドロワーへ流れ込む長さ（D-12） */
export const FLY_MS = 400;

interface Props {
  spot: PlanSpot;
  close: string | null;
  isWishlisted: boolean;
  isVisited: boolean;
  chosen: boolean;
  reduceMotion: boolean;
  /** カードからドロワーの一覧の末尾までの縦の距離（流れ込む先） */
  flyDistance: number;
  onAdd: () => void;
  onRemove: () => void;
}

/**
 * 予定を組む画面で押したピンのカード（Issue #258）。「＋ 予定に入れる」でドロワーへ流れ込む
 * （EC の「カゴに入る」動き）。視差効果を減らすがオンなら動かさずに足す
 */
export function PlanSpotCard({
  spot,
  close,
  isWishlisted,
  isVisited,
  chosen,
  reduceMotion,
  flyDistance,
  onAdd,
  onRemove,
}: Props) {
  const fly = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fly.setValue(0);
  }, [fly, spot.id]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const handleAdd = () => {
    if (reduceMotion) {
      onAdd();
      return;
    }
    Animated.timing(fly, { toValue: 1, duration: FLY_MS, useNativeDriver: true }).start();
    // 行を足すのは動きが終わってから（途中で一覧が伸びると行き先がずれる）
    timer.current = setTimeout(onAdd, FLY_MS);
  };

  const sub = [
    close ? `受付 〜${close}` : null,
    isWishlisted ? '行きたい' : null,
    isVisited ? '参拝済み' : null,
  ]
    .filter(Boolean)
    .join('・');

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }),
          transform: [
            { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, flyDistance] }) },
            { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) },
          ],
        },
      ]}
      testID="plan-spot-card"
    >
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {spot.name}
          </Text>
          <Badge type={spot.type} />
        </View>
        {sub !== '' && <Text style={styles.sub}>{sub}</Text>}
      </View>
      <TouchableOpacity
        style={[styles.button, chosen && styles.removeButton]}
        onPress={chosen ? onRemove : handleAdd}
        testID={chosen ? 'plan-card-remove' : 'plan-card-add'}
        accessibilityRole="button"
      >
        <Text style={[styles.buttonText, chosen && styles.removeText]}>
          {chosen ? '予定から外す' : '＋ 予定に入れる'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.lg,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.body, fontWeight: '700', color: colors.gray[900], flexShrink: 1 },
  sub: { ...typography.caption, color: colors.gray[500], marginTop: 2 },
  button: {
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
  },
  removeButton: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
  },
  buttonText: { ...typography.bodySmall, fontWeight: '700', color: colors.white },
  removeText: { color: colors.gray[600] },
});
