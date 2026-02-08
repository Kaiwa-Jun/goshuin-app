import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';

interface PageIndicatorProps {
  total: number;
  current: number;
}

export const PageIndicator: React.FC<PageIndicatorProps> = ({ total, current }) => {
  return (
    <View style={styles.container} testID="page-indicator">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current ? styles.activeDot : styles.inactiveDot]}
          testID={i === current ? 'dot-active' : 'dot-inactive'}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: colors.primary[500],
  },
  inactiveDot: {
    width: 8,
    backgroundColor: colors.gray[300],
  },
});
