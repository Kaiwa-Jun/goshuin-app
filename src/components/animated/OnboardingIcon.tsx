import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';
import { colors } from '@theme/colors';

type IconName = 'map' | 'camera-alt' | 'emoji-events' | 'place';

interface OnboardingIconProps {
  name: IconName;
  backgroundColor: string;
}

export const OnboardingIcon: React.FC<OnboardingIconProps> = ({ name, backgroundColor }) => {
  return (
    <View style={[styles.container, { backgroundColor }]} testID="onboarding-icon">
      <MaterialIcons name={name} size={48} color={colors.white} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 96,
    height: 96,
    borderRadius: borderRadius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
});
