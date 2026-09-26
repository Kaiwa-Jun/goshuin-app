import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useReduceMotion } from '@hooks/useReduceMotion';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

/** プラスのカードが浮く動き（試作 v3 の lift .5s .35s） */
const LIFT_DELAY_MS = 350;
const LIFT_MS = 500;

/**
 * 無料とプラスのカード2枚（Issue #270 D-14）。有料の機能を足すときは両方に行を足す。
 * 値段は App Store の表示（priceString）をそのまま出す
 */
export function PlusPlanCards({ priceString }: { priceString: string | null }) {
  const reduceMotion = useReduceMotion();
  const lift = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      lift.setValue(1);
      return;
    }
    lift.setValue(0);
    // Jest で途中の値が見えるように JS で動かす（#213）
    const a = Animated.timing(lift, {
      toValue: 1,
      delay: LIFT_DELAY_MS,
      duration: LIFT_MS,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [lift, reduceMotion]);

  return (
    <View style={styles.row}>
      <View style={[styles.card, styles.free]} testID="plus-card-free">
        <Text style={styles.name}>無料</Text>
        <Text style={styles.price}>0円</Text>
        <Rows plus={false} />
      </View>
      <Animated.View
        style={[
          styles.card,
          styles.plus,
          {
            opacity: lift.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
            ],
          },
        ]}
        testID="plus-card-plus"
      >
        <View style={styles.tag} testID="plus-card-tag">
          <Text style={styles.tagText}>おすすめ</Text>
        </View>
        <Text style={[styles.name, styles.plusName]}>プラス</Text>
        <Text style={styles.price}>
          {priceString ?? '—'}
          <Text style={styles.once}> 1回だけ</Text>
        </Text>
        <Rows plus />
      </Animated.View>
    </View>
  );
}

function Rows({ plus }: { plus: boolean }) {
  const icon = plus ? colors.primary[500] : colors.pin.wishlisted;
  const line = (label: React.ReactNode, key?: boolean) => (
    <View style={styles.line}>
      <MaterialIcons name="check" size={17} color={icon} />
      <Text style={[styles.lineText, key && styles.key]}>{label}</Text>
    </View>
  );
  return (
    <View style={styles.lines}>
      {line('記録・地図')}
      {line('御朱印帳・あゆみ')}
      {plus
        ? line(
            <>
              予定 <Text style={styles.many}>いくつでも</Text>
            </>,
            true
          )
        : line('予定 1件', true)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  card: { flex: 1, borderRadius: borderRadius.xl, padding: spacing.md, borderWidth: 1 },
  free: { borderColor: colors.gray[200], backgroundColor: colors.white },
  plus: { borderWidth: 2, borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  tag: {
    position: 'absolute',
    top: -10,
    left: spacing.md,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: { ...typography.caption, fontSize: 10, fontWeight: '800', color: colors.white },
  name: { ...typography.caption, fontWeight: '800', color: colors.gray[500] },
  plusName: { color: colors.primary[700] },
  price: { ...typography.h3, fontWeight: '800', color: colors.gray[900], marginTop: 2 },
  once: { ...typography.caption, fontSize: 11, fontWeight: '700', color: colors.gray[500] },
  lines: { marginTop: spacing.sm, gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  lineText: { ...typography.bodySmall, color: colors.gray[800], flexShrink: 1 },
  key: { fontWeight: '800' },
  many: { color: colors.primary[700], fontWeight: '800' },
});
