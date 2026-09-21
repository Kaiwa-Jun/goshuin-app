import React from 'react';
import { StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { PressableScale } from '@components/common/PressableScale';
import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';

/**
 * 地図に重ねる記録ボタン。
 *
 * 角丸スクエアなのは Material 3 の FAB に合わせたもの。完全な円は一世代前の形。
 * 影は shadows.floating。「大きくぼかす」より「小さく濃く」した方が、
 * ぼやけた染みではなく浮いた物体に見える。
 */
/** Material の標準に合わせる。64pt は標準(56)と大型(96)の中間で、地図の上では過剰 */
const SIZE = 56;
const RADIUS = 18;
/**
 * MaterialIcons の add は、墨が指定サイズの約57%しかない。
 * 32 指定で墨 18pt ＝ 56pt 容器の 32% になり、Material の比率と揃う。
 * 以前は同じ 32 でも容器が 64pt だったので 28% まで下がり、
 * 「大きな円に小さな印」に見えていた
 */
const ICON_SIZE = 32;

interface FABButtonProps {
  onPress: () => void;
}

export const FABButton: React.FC<FABButtonProps> = ({ onPress }) => {
  return (
    <PressableScale
      style={styles.fab}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="御朱印を記録する"
      testID="fab-button"
    >
      <MaterialIcons name="add" size={ICON_SIZE} color={colors.white} />
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
  },
});
