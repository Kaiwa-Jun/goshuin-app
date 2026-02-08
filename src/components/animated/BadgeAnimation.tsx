import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface BadgeAnimationProps {
  badgeName: string;
  description?: string;
}

export const BadgeAnimation: React.FC<BadgeAnimationProps> = ({ badgeName, description }) => {
  return (
    <View style={styles.container} testID="badge-animation">
      <View style={styles.iconContainer}>
        <MaterialIcons name="military-tech" size={40} color={colors.warning} />
      </View>
      <Text style={styles.name}>{badgeName}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.h3,
    color: colors.white,
  },
  description: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
});
