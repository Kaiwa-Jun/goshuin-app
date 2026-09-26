import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import type { usePlus } from '@hooks/usePlus';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

interface Props {
  plus: ReturnType<typeof usePlus>;
  isAuthenticated: boolean;
  onPress: () => void;
}

/** 設定の「御朱印さんぽ プラス」（Issue #270 の D / D-13）。自分から見に行く入口 */
export function PlusSettingsCard({ plus, isAuthenticated, onPress }: Props) {
  const owned = plus.isPlus;
  const price = isAuthenticated && !owned && plus.status === 'ready' ? plus.priceString : null;
  return (
    <TouchableOpacity
      style={[styles.card, owned && styles.owned]}
      onPress={onPress}
      accessibilityRole="button"
      testID="plus-settings-card"
    >
      <View style={styles.icon}>
        <MaterialIcons name="auto-awesome" size={24} color={colors.primary[500]} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>御朱印さんぽ プラス</Text>
        <Text style={styles.sub}>
          {isAuthenticated ? '予定をいくつでも入れられます' : 'ログインすると購入できます'}
        </Text>
      </View>
      {owned && <Text style={styles.ownedText}>購入済み</Text>}
      {price && <Text style={styles.price}>{price}</Text>}
      <MaterialIcons name="chevron-right" size={22} color={colors.gray[400]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[100],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  owned: { backgroundColor: colors.white, borderColor: colors.gray[200] },
  icon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { ...typography.body, fontWeight: '700', color: colors.gray[900] },
  sub: { ...typography.caption, color: colors.gray[600], marginTop: 2 },
  price: { ...typography.bodySmall, fontWeight: '800', color: colors.primary[700] },
  ownedText: { ...typography.bodySmall, fontWeight: '800', color: colors.pin.wishlisted },
});
