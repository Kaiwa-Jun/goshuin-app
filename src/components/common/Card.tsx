import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@theme/colors';
import { borderRadius, spacing } from '@theme/spacing';
import { shadows } from '@theme/shadows';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({ children, style }) => {
  return (
    <View style={[styles.card, style]} testID="card">
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
});
