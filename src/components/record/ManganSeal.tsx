import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Seal } from '@components/common/Seal';
import { colors } from '@theme/colors';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';

export const SEAL_MS = 500;

/**
 * 御朱印の上に押される印。記録として下に並ぶもの（50）より大きく、傾いている。
 *
 * 承認された試作の値。枠は 150 幅で、-8度 回すと 135.5 まで広がるが収まる
 * （一度 88 に下げたが、その根拠にした「120 でははみ出す」という計算が
 *  間違っていた。RecordCompleteScreen.test.tsx が実寸で見張っている）
 */
const SEAL_SIZE = 120;

interface Props {
  spotName: string;
  /** 押し始めるまでの待ち。地図が落ち着いてから */
  delayMs?: number;
}

/**
 * 満願の朱印。**いま授かった御朱印の上に、上から押される**。
 *
 * 独立した画面は作らない。12ヶ月目を記録したその瞬間の続きとして出す。
 * **ご褒美はアプリの外にある** —「社務所で尋ねてみてください」を必ず添える。
 * バッジが賞品にならないように（docs/design/2026-09-tsukimairi-spec.md §4-3）。
 */
export function ManganSeal({ spotName, delayMs = 0 }: Props) {
  const press = useRef(new Animated.Value(0)).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => {
        if (cancelled) return;
        if (reduce) {
          press.setValue(1);
          return;
        }
        running.current = Animated.timing(press, {
          toValue: 1,
          duration: SEAL_MS,
          delay: delayMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
        running.current.start();
      })
      .catch(() => press.setValue(1));

    return () => {
      cancelled = true;
      running.current?.stop();
    };
  }, [delayMs, press]);

  return (
    <>
      <Animated.View
        style={[
          styles.seal,
          {
            opacity: press,
            // 上から降りてきて、押した瞬間に少し沈む
            transform: [
              {
                scale: press.interpolate({ inputRange: [0, 0.55, 1], outputRange: [2.4, 0.92, 1] }),
              },
              { rotate: '-8deg' },
            ],
          },
        ]}
        pointerEvents="none"
        testID="mangan-seal"
        accessible
        accessibilityLabel={`${spotName}、満願`}
      >
        {/* 下の墨が少し透ける。紙に押した朱肉は下を塗りつぶさない */}
        <Seal mark="mangan" earned size={SEAL_SIZE} opacity={0.9} />
      </Animated.View>
    </>
  );
}

/** ご褒美はアプリの外にある、と画面の文言として持つ */
export function ManganNote() {
  return (
    <View style={styles.note} testID="mangan-note">
      <Text style={styles.noteText}>
        満願の御朱印をいただけることがあります。{'\n'}社務所で尋ねてみてください
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  seal: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
  },
  note: {
    backgroundColor: colors.backgroundGrouped,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  noteText: {
    ...typography.bodySmall,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 22,
  },
});
