import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';

type ErrorType = 'network' | 'location' | 'upload';

const errorIconConfig: Record<
  ErrorType,
  { icon: keyof typeof MaterialIcons.glyphMap; color: string }
> = {
  network: { icon: 'wifi-off', color: colors.gray[400] },
  location: { icon: 'location-off', color: colors.primary[500] },
  upload: { icon: 'cloud-off', color: colors.error },
};

interface ErrorIconProps {
  type: ErrorType;
  size?: number;
}

export const ErrorIcon: React.FC<ErrorIconProps> = ({ type, size = 64 }) => {
  const config = errorIconConfig[type];

  return (
    <View style={styles.container} testID={`error-icon-${type}`}>
      <MaterialIcons
        name={config.icon as keyof typeof MaterialIcons.glyphMap}
        size={size}
        color={config.color}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
