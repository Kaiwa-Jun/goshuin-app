import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Badge } from '@components/common/Badge';
import type { Spot } from '@/types/supabase';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface SpotSheetHeaderProps {
  spot: Spot;
  isVisited: boolean;
  isWishlisted?: boolean;
}

/**
 * ボトムシートとスポット詳細で共通のヘッダー。
 * compact / expanded のどちらでも同じ並び順で描画し、展開時に内容が飛ばないようにする。
 * 行きたいの操作系はアクション行に一本化しているため、ここでは状態の標示だけを出す。
 */
export function SpotSheetHeader({ spot, isVisited, isWishlisted }: SpotSheetHeaderProps) {
  const badgeType = spot.type === 'shrine' ? 'shrine' : 'temple';

  return (
    <View style={styles.container} testID="spot-sheet-header">
      <View style={styles.nameRow} testID="spot-sheet-name-row">
        <Text style={styles.spotName} numberOfLines={1} testID="spot-name">
          {spot.name}
        </Text>
        <Badge type={badgeType} />
        {isVisited && <Badge type="visited" />}
        {isWishlisted === true && (
          <MaterialIcons
            name="bookmark"
            size={18}
            color={colors.pin.wishlisted}
            testID="spot-sheet-wishlist-indicator"
          />
        )}
      </View>

      {spot.address && (
        <View style={styles.addressRow} testID="spot-sheet-address">
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
  // 水平パディングは配置側のコンテナが持つ（シート / スポット詳細で二重にしない）
  container: {},
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spotName: {
    ...typography.h3,
    color: colors.gray[900],
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  address: {
    ...typography.bodySmall,
    color: colors.gray[500],
    flex: 1,
  },
});
