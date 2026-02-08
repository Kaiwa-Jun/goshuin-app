import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '@theme/colors';

type PinType = 'shrine-visited' | 'temple-visited' | 'unvisited' | 'current-location';

interface MapPinProps {
  type: PinType;
}

const PIN_CONFIG: Record<PinType, { color: string; size: number }> = {
  'shrine-visited': { color: colors.pin.shrineVisited, size: 16 },
  'temple-visited': { color: colors.pin.templeVisited, size: 16 },
  unvisited: { color: colors.pin.unvisited, size: 12 },
  'current-location': { color: colors.pin.currentLocation, size: 20 },
};

export function MapPin({ type }: MapPinProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;
  const config = PIN_CONFIG[type];

  useEffect(() => {
    if (type !== 'current-location') return;

    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 2,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [type, pulseAnim, opacityAnim]);

  return (
    <View style={styles.wrapper} testID={`map-pin-${type}`}>
      {type === 'current-location' && (
        <Animated.View
          testID="map-pin-pulse"
          style={[
            styles.pulse,
            {
              width: config.size * 2,
              height: config.size * 2,
              borderRadius: config.size,
              backgroundColor: config.color,
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.pin,
          {
            width: config.size,
            height: config.size,
            borderRadius: config.size / 2,
            backgroundColor: config.color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
  },
  pin: {},
});
