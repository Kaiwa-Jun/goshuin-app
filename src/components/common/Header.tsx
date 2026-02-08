import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface HeaderProps {
  title: string;
  variant?: 'page' | 'modal';
  onBack?: () => void;
  onClose?: () => void;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
}

export function Header({
  title,
  variant = 'page',
  onBack,
  onClose,
  rightElement,
  style,
}: HeaderProps) {
  return (
    <View
      style={[styles.container, variant === 'modal' && styles.modalVariant, style]}
      testID="header"
    >
      <View style={styles.leftSlot}>
        {onBack && (
          <TouchableOpacity onPress={onBack} testID="header-back-button">
            <MaterialIcons name="arrow-back" size={24} color={colors.gray[800]} />
          </TouchableOpacity>
        )}
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={styles.iconButton}
            testID="header-close-button"
          >
            <MaterialIcons name="close" size={24} color={colors.gray[800]} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title} testID="header-title">
        {title}
      </Text>
      <View style={styles.rightSlot}>{rightElement}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalVariant: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  leftSlot: {
    width: 40,
    alignItems: 'flex-start',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.gray[800],
    flex: 1,
    textAlign: 'center',
  },
  rightSlot: {
    width: 40,
    alignItems: 'flex-end',
  },
});
