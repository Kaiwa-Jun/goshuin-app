import React from 'react';
import { StyleSheet, Text, TextInput as RNTextInput, View, ViewStyle } from 'react-native';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

interface TextInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  multiline?: boolean;
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
  maxLength?: number;
}

export function TextInput({
  label,
  placeholder,
  value,
  onChangeText,
  multiline = false,
  error,
  disabled = false,
  style,
  maxLength,
}: TextInputProps) {
  return (
    <View style={style}>
      {label && (
        <Text style={styles.label} testID="text-input-label">
          {label}
        </Text>
      )}
      <RNTextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          error && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.gray[400]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        editable={!disabled}
        maxLength={maxLength}
        testID="text-input"
      />
      {error && (
        <Text style={styles.error} testID="text-input-error">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: colors.gray[600],
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    backgroundColor: colors.white,
    color: colors.gray[800],
  },
  multiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    backgroundColor: colors.gray[100],
    color: colors.gray[400],
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
