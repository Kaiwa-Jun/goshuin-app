import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';

interface CheckmarkAnimationProps {
  size?: number;
}

export const CheckmarkAnimation: React.FC<CheckmarkAnimationProps> = ({ size = 80 }) => {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1.0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        { transform: [{ scale }], opacity },
      ]}
      testID="checkmark-animation"
    >
      <MaterialIcons name="check" size={size * 0.6} color={colors.primary[500]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
