import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@components/common/Button';
import type { usePlus } from '@hooks/usePlus';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface Props {
  plus: ReturnType<typeof usePlus>;
  /** B（予定の2件目のシート）だけ「あとで」を出す */
  onLater?: () => void;
  onPurchased: () => void;
  /** 復元できたあと（Alert を出したあとに呼ぶ） */
  onRestored?: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
}

/** 購入のボタンまわり（Issue #270 D-10・D-15）。B と E で同じ */
export function PlusPurchasePanel({
  plus,
  onLater,
  onPurchased,
  onRestored,
  onTerms,
  onPrivacy,
}: Props) {
  const { isPlus, status, priceString, canRestore, busy } = plus;

  const buy = async () => {
    const result = await plus.purchase();
    if (result === 'purchased') onPurchased();
    // キャンセルは何も出さない
    else if (result === 'failed') Alert.alert('購入できませんでした');
  };

  const restore = async () => {
    const result = await plus.restore();
    if (result === 'restored') {
      Alert.alert('購入を復元しました');
      onRestored?.();
    } else if (result === 'none') Alert.alert('復元できる購入が見つかりませんでした');
    else Alert.alert('購入を復元できませんでした');
  };

  const title = isPlus
    ? '購入済み'
    : status === 'ready'
      ? `${priceString}でプラスにする`
      : status === 'loading'
        ? '読み込み中…'
        : 'プラスにする';

  return (
    <View>
      <Button
        title={title}
        onPress={() => void buy()}
        disabled={isPlus || status !== 'ready' || busy}
        testID="plus-buy"
        style={styles.buy}
      />
      {!isPlus && status === 'unavailable' && (
        <Text style={styles.unavailable} testID="plus-unavailable">
          いまは購入できません
        </Text>
      )}
      {!isPlus && (
        <Text style={styles.once}>
          <Text style={styles.onceStrong}>1回だけの支払い</Text>・毎月はかかりません
        </Text>
      )}
      <View style={styles.subRow}>
        {!isPlus && (
          <TouchableOpacity
            onPress={() => void restore()}
            disabled={!canRestore || busy}
            testID="plus-restore"
            accessibilityRole="button"
          >
            <Text style={[styles.sub, (!canRestore || busy) && styles.subDisabled]}>
              購入を復元
            </Text>
          </TouchableOpacity>
        )}
        {onLater && (
          <TouchableOpacity onPress={onLater} testID="plus-later" accessibilityRole="button">
            <Text style={styles.sub}>あとで</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.legal}>
        <TouchableOpacity onPress={onTerms} testID="plus-terms" accessibilityRole="link">
          <Text style={styles.link}>利用規約</Text>
        </TouchableOpacity>
        <Text style={styles.dot}>・</Text>
        <TouchableOpacity onPress={onPrivacy} testID="plus-privacy" accessibilityRole="link">
          <Text style={styles.link}>プライバシーポリシー</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  buy: { marginTop: spacing.lg },
  unavailable: {
    ...typography.caption,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  once: {
    ...typography.caption,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  onceStrong: { fontWeight: '800', color: colors.gray[700] },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  sub: { ...typography.bodySmall, fontWeight: '700', color: colors.gray[500] },
  subDisabled: { color: colors.gray[300] },
  legal: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
  link: { ...typography.caption, color: colors.gray[400], textDecorationLine: 'underline' },
  dot: { ...typography.caption, color: colors.gray[400] },
});
