import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface BadgeData {
  name: string;
  description?: string;
}

interface BadgeAnimationProps {
  // Legacy props (backward compat)
  badgeName?: string;
  description?: string;
  // New unified prop
  badge?: BadgeData | null;
}

export const BadgeAnimation: React.FC<BadgeAnimationProps> = ({
  badgeName,
  description,
  badge,
}) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const resolvedName = badge?.name ?? badgeName;
  const resolvedDescription = badge?.description ?? description;

  useEffect(() => {
    if (!resolvedName) return;

    scale.setValue(0);
    opacity.setValue(0);

    Animated.sequence([
      Animated.delay(1000),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [resolvedName, scale, opacity]);

  if (!resolvedName) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ scale }], opacity }]}
      testID="badge-animation"
    >
      <View style={styles.iconContainer}>
        <MaterialIcons name="military-tech" size={40} color={colors.warning} />
      </View>
      <Text style={styles.name}>{resolvedName}</Text>
      {resolvedDescription && <Text style={styles.description}>{resolvedDescription}</Text>}
    </Animated.View>
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
