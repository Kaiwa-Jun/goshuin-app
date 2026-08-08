import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import type { GalleryViewMode } from '@hooks/useGalleryViewMode';

const ICON_SIZE = 24;
const MIN_TAP_SIZE = 44;

interface ViewModeToggleProps {
  mode: GalleryViewMode;
  onChange: (mode: GalleryViewMode) => void;
}

const OPTIONS: {
  mode: GalleryViewMode;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}[] = [
  { mode: 'flip', icon: 'auto-stories', label: 'めくって表示' },
  { mode: 'grid', icon: 'grid-view', label: '一覧で表示' },
];

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <View style={styles.container} testID="view-mode-toggle">
      {OPTIONS.map(option => {
        const isSelected = option.mode === mode;
        return (
          <TouchableOpacity
            key={option.mode}
            testID={`view-mode-${option.mode}`}
            onPress={() => onChange(option.mode)}
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
          >
            <MaterialIcons
              testID={`view-mode-${option.mode}-icon`}
              name={option.icon}
              size={ICON_SIZE}
              color={isSelected ? colors.primary[500] : colors.gray[400]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    minHeight: MIN_TAP_SIZE,
    minWidth: MIN_TAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
});
