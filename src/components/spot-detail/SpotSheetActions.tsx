import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@components/common/Button';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';

interface SpotSheetActionsProps {
  isWishlisted?: boolean;
  onWishlistPress?: () => void;
  onRecordPress: () => void;
}

/**
 * シート内で最も強い導線。「行きたい（これから）」と「記録する（行った）」を
 * 並べて置くことで、旗ひとつに両方の意味が寄っていた状態を解消する。
 * 記録するは塗り、行きたいは枠のみにして CTA の強さに差を付ける。
 */
export function SpotSheetActions({
  isWishlisted,
  onWishlistPress,
  onRecordPress,
}: SpotSheetActionsProps) {
  const showWishlist = onWishlistPress != null && isWishlisted != null;

  return (
    <View style={styles.container} testID="spot-sheet-actions">
      {showWishlist && (
        <Button
          title="行きたい"
          onPress={onWishlistPress}
          variant="outline"
          icon={isWishlisted ? 'bookmark' : 'bookmark-border'}
          style={{ ...styles.action, ...(isWishlisted ? styles.wishlistActive : null) }}
          textStyle={isWishlisted ? styles.wishlistActiveText : undefined}
          testID="wishlist-action-button"
        />
      )}
      <Button
        title="記録する"
        onPress={onRecordPress}
        variant="primary"
        icon="photo-camera"
        style={styles.action}
        testID="record-action-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  action: {
    flex: 1,
    minHeight: 44,
    // Button 既定の 24 では2つ並べたときに文言が窮屈になる
    paddingHorizontal: spacing.md,
  },
  wishlistActive: {
    backgroundColor: colors.primary[50],
  },
  wishlistActiveText: {
    color: colors.primary[700],
  },
});
