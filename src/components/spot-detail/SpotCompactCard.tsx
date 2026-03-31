import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Badge } from '@components/common/Badge';
import type { Spot } from '@/types/supabase';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface SpotCompactCardProps {
  spot: Spot;
  isVisited: boolean;
}

export function SpotCompactCard({ spot, isVisited }: SpotCompactCardProps) {
  const badgeType = spot.type === 'shrine' ? 'shrine' : 'temple';

  return (
    <View style={styles.container} testID="spot-compact-card">
      <Text style={styles.spotName} numberOfLines={1}>
        {spot.name}
      </Text>
      <View style={styles.badgeRow}>
        <Badge type={badgeType} />
        {isVisited && <Badge type="visited" />}
      </View>
      {spot.address && (
        <View style={styles.addressRow} testID="spot-compact-address">
          <MaterialIcons name="place" size={14} color={colors.gray[400]} />
          <Text style={styles.address} numberOfLines={1}>
            {spot.address}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  spotName: {
    ...typography.h3,
    color: colors.gray[900],
    marginBottom: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  address: {
    ...typography.bodySmall,
    color: colors.gray[500],
    flex: 1,
  },
});
