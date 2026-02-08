import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';

interface CheckmarkAnimationProps {
  size?: number;
}

export const CheckmarkAnimation: React.FC<CheckmarkAnimationProps> = ({ size = 80 }) => {
  return (
    <View
      style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}
      testID="checkmark-animation"
    >
      <MaterialIcons name="check" size={size * 0.6} color={colors.white} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.3,
  },
});
