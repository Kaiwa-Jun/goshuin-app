import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface LoadingIndicatorProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function LoadingIndicator({
  size = 'large',
  color = colors.primary[500],
  message,
  fullScreen = false,
  style,
}: LoadingIndicatorProps) {
  return (
    <View
      style={[styles.container, fullScreen && styles.fullScreen, style]}
      testID="loading-indicator"
    >
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text style={styles.message} testID="loading-message">
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  message: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
});
