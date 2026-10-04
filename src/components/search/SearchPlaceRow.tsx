import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import type { PlaceRow } from '@utils/placeSearch';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { borderRadius, spacing } from '@theme/spacing';

interface SearchPlaceRowProps {
  row: PlaceRow;
  onPress: () => void;
  testID?: string;
}

/**
 * 検索の一覧のいちばん上に出す「場所の帯」（Issue #311。S0 でオーナーが選んだ B）。
 * 押すと地図をその地域に寄せる。帯全体が1つのボタン
 */
export const SearchPlaceRow: React.FC<SearchPlaceRowProps> = ({ row, onPress, testID }) => {
  const sub = row.prefecture ? `${row.prefecture}・寺社 ${row.count}` : `寺社 ${row.count}`;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.label}のあたりを地図で見る`}
      style={styles.band}
    >
      <MaterialIcons name="map" size={24} color={colors.primary[500]} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {`${row.label}のあたり`}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Text style={styles.action}>地図で見る</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
  },
  text: {
    flex: 1,
  },
  title: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.gray[800],
  },
  sub: {
    ...typography.caption,
    color: colors.gray[500],
  },
  action: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary[600],
  },
});
