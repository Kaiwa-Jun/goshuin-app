import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { borderRadius, spacing } from '@theme/spacing';
import { shadows } from '@theme/shadows';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = '神社・寺院を検索',
  value,
  onChangeText,
  onFocus,
}) => {
  return (
    <View style={styles.container} testID="search-bar">
      <MaterialIcons name="search" size={20} color={colors.gray[400]} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.gray[400]}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.gray[800],
    padding: 0,
  },
});
