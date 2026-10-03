import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

/** 出しておく長さ（予定タブの「に保存しました」と同じ） */
export const PLUS_THANKS_MS = 3200;

/**
 * 買えたあとの一言（Issue #270 の F / D-19）。出ている間だけ描き、時間が来たら onDone。
 * タイマーは画面の params と切り離して、この部品の中で持つ
 */
export function PlusThanksToast({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, PLUS_THANKS_MS);
    return () => clearTimeout(t);
    // 出ている間に onDone が作り直されても、タイマーはかけ直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.toast} testID="plus-thanks-toast" pointerEvents="none">
      <MaterialIcons name="auto-awesome" size={20} color={colors.primary[300]} />
      <Text style={styles.text}>プラスになりました。ありがとうございます</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing['3xl'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gray[900],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  text: { ...typography.bodySmall, color: colors.white, flexShrink: 1 },
});
