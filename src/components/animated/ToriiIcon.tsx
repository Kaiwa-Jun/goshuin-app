import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@theme/colors';

interface ToriiIconProps {
  size?: number;
}

export const ToriiIcon: React.FC<ToriiIconProps> = ({ size = 80 }) => {
  return (
    <View
      style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}
      testID="torii-icon"
    >
      <Text style={[styles.icon, { fontSize: size * 0.5 }]}>⛩</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: colors.white,
  },
});
