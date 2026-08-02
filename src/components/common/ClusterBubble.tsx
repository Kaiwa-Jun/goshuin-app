import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { shadows } from '@theme/shadows';

interface ClusterBubbleProps {
  count: number;
}

/** クラスタに含まれるスポット数を表示する円形バブル。桁数に応じて3段階に拡大する */
export const ClusterBubble = React.memo(function ClusterBubble({ count }: ClusterBubbleProps) {
  const sizeStyle = count >= 100 ? styles.large : count >= 10 ? styles.medium : styles.small;
  return (
    <View style={[styles.bubble, sizeStyle]} testID="cluster-bubble">
      <Text style={styles.count} testID="cluster-bubble-count">
        {String(count)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    borderWidth: 2.5,
    borderColor: colors.white,
    ...shadows.md,
  },
  small: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  medium: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  large: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  count: {
    ...typography.label,
    color: colors.white,
    fontWeight: '700',
  },
});
