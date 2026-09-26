import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { borderRadius, spacing } from '@theme/spacing';

type BadgeType = 'shrine' | 'temple' | 'visited' | 'registered';

interface BadgeProps {
  type: BadgeType;
  label?: string;
}

const badgeConfig: Record<BadgeType, { bg: string; text: string; defaultLabel: string }> = {
  shrine: {
    bg: colors.shrine[100],
    text: colors.shrine[600],
    defaultLabel: '神社',
  },
  temple: {
    bg: colors.temple[100],
    text: colors.temple[600],
    defaultLabel: '寺院',
  },
  visited: {
    bg: colors.primary[100],
    text: colors.primary[600],
    defaultLabel: '訪問済み',
  },
  /** 調べた候補がアプリに登録済みの寺社と同じ（Issue #278） */
  registered: {
    bg: colors.gray[100],
    text: colors.gray[600],
    defaultLabel: '登録済み',
  },
};

export const Badge: React.FC<BadgeProps> = ({ type, label }) => {
  const config = badgeConfig[type];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]} testID={`badge-${type}`}>
      <Text style={[styles.text, { color: config.text }]}>{label ?? config.defaultLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.label,
    fontWeight: '600',
  },
});
