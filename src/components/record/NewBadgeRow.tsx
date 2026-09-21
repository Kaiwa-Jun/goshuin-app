import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors } from '@theme/colors';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';

/** 1つ前のバッジが出てから次まで */
export const BADGE_STEP_MS = 150;
const POP_MS = 420;

export interface NewBadge {
  id: string;
  name: string;
  icon: string;
}

interface Props {
  badges: NewBadge[];
  /** 出し始めるまでの待ち。地図が落ち着いてから出す */
  delayMs?: number;
}

/**
 * 今回の記録で新しく取れたバッジ。
 *
 * **文章の行を増やさず、横に並べる。** 同じ日に満願と「1日に3箇所」が揃うことがあり、
 * 行で出すと縦に伸びて、御朱印と地図の場所を奪う。横なら3つでも4つでも高さが変わらない。
 */
export function NewBadgeRow({ badges, delayMs = 0 }: Props) {
  const progress = useRef(badges.map(() => new Animated.Value(0))).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => {
        if (cancelled) return;
        if (reduce) {
          progress.forEach(v => v.setValue(1));
          return;
        }
        running.current = Animated.stagger(
          BADGE_STEP_MS,
          progress.map(value =>
            Animated.timing(value, {
              toValue: 1,
              duration: POP_MS,
              delay: delayMs,
              easing: Easing.out(Easing.back(1.6)),
              useNativeDriver: true,
            })
          )
        );
        running.current.start();
      })
      .catch(() => progress.forEach(v => v.setValue(1)));

    return () => {
      cancelled = true;
      running.current?.stop();
    };
  }, [delayMs, progress]);

  if (badges.length === 0) return null;

  return (
    <View style={styles.row} testID="new-badges">
      {badges.map((badge, index) => (
        <Animated.View
          key={badge.id}
          style={[
            styles.item,
            { opacity: progress[index], transform: [{ scale: progress[index] }] },
          ]}
          testID={`new-badge-${badge.id}`}
          accessible
          accessibilityLabel={`バッジ獲得、${badge.name}`}
        >
          <View style={[styles.circle, badge.id === 'mangan' && styles.manganCircle]}>
            <Text style={styles.icon}>{badge.icon}</Text>
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {badge.name}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  item: { width: 62, alignItems: 'center' },
  circle: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  // 満願だけ朱に寄せる。作法の軸でいちばん重い1つ
  manganCircle: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(220, 38, 38, 0.35)',
  },
  icon: { fontSize: 21 },
  name: { ...typography.caption, fontSize: 10, color: colors.gray[600], textAlign: 'center' },
});
