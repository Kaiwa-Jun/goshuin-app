import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#F97316', // orange
  '#EF4444', // red
  '#A855F7', // purple
  '#EAB308', // yellow
  '#22C55E', // green
  '#3B82F6', // blue
];

const CONFETTI_COUNT = 12;

interface ConfettiPiece {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;
  color: string;
  left: number;
}

interface ConfettiEffectProps {
  trigger?: boolean;
}

export const ConfettiEffect: React.FC<ConfettiEffectProps> = ({ trigger = true }) => {
  const pieces = useRef<ConfettiPiece[]>(
    Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(-20),
      opacity: new Animated.Value(1),
      rotation: new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: Math.random() * SCREEN_WIDTH,
    }))
  ).current;

  useEffect(() => {
    if (!trigger) return;

    const animations = pieces.map(piece => {
      piece.x.setValue(0);
      piece.y.setValue(-20);
      piece.opacity.setValue(1);
      piece.rotation.setValue(0);

      const delay = Math.random() * 500;
      const duration = 1500 + Math.random() * 500;

      return Animated.parallel([
        Animated.timing(piece.y, {
          toValue: SCREEN_HEIGHT * 0.6,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(piece.x, {
          toValue: (Math.random() - 0.5) * 100,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(piece.rotation, {
          toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(delay + duration * 0.7),
          Animated.timing(piece.opacity, {
            toValue: 0,
            duration: duration * 0.3,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(animations).start();
  }, [trigger, pieces]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="confetti-effect">
      {pieces.map((piece, i) => {
        const rotate = piece.rotation.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                backgroundColor: piece.color,
                left: piece.left,
                transform: [{ translateX: piece.x }, { translateY: piece.y }, { rotate }],
                opacity: piece.opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
    width: 8,
    height: 8,
    borderRadius: 2,
  },
});
