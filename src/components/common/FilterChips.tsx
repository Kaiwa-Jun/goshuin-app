import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { borderRadius, spacing } from '@theme/spacing';

interface FilterChipsProps {
  options: { key: string; label: string }[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

export const FilterChips: React.FC<FilterChipsProps> = ({ options, selectedKey, onSelect }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map(option => {
        const isSelected = option.key === selectedKey;
        return (
          <TouchableOpacity
            key={option.key}
            testID={`filter-chip-${option.key}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(option.key)}
            style={[styles.chip, isSelected ? styles.chipActive : styles.chipInactive]}
          >
            <Text style={[styles.label, isSelected ? styles.labelActive : styles.labelInactive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  chipActive: {
    backgroundColor: colors.primary[500],
  },
  chipInactive: {
    backgroundColor: colors.gray[100],
  },
  label: {
    ...typography.bodySmall,
  },
  labelActive: {
    color: colors.white,
  },
  labelInactive: {
    color: colors.gray[700],
  },
});
