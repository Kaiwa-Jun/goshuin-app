import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

interface SpotMarkerProps {
  color: string;
  name: string;
  showLabel: boolean;
}

export const SpotMarker = React.memo(function SpotMarker({
  color,
  name,
  showLabel,
}: SpotMarkerProps) {
  return (
    <View style={styles.wrapper}>
      {showLabel && (
        <Text style={styles.label} numberOfLines={1} testID="spot-marker-label">
          {name}
        </Text>
      )}
      <View style={[styles.pinHead, { backgroundColor: color }]} testID="spot-marker-pin-head" />
      <View style={[styles.pinTail, { borderTopColor: color }]} testID="spot-marker-pin-tail" />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.gray[800],
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
    maxWidth: 80,
    marginBottom: 2,
    textAlign: 'center',
    overflow: 'hidden',
    ...shadows.sm,
  },
  pinHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: colors.white,
    ...shadows.sm,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
