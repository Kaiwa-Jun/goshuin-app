import React from 'react';
import { Modal as RNModal, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  variant?: 'center' | 'bottom';
  title?: string;
  children: React.ReactNode;
  closeOnBackdrop?: boolean;
}

export function Modal({
  visible,
  onClose,
  variant = 'center',
  title,
  children,
  closeOnBackdrop = true,
}: ModalProps) {
  const handleBackdropPress = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={variant === 'center' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.overlay, variant === 'bottom' && styles.overlayBottom]}
        onPress={handleBackdropPress}
        testID="modal-overlay"
      >
        <Pressable
          style={[styles.content, variant === 'bottom' && styles.contentBottom]}
          testID="modal-content"
        >
          {title && (
            <Text style={styles.title} testID="modal-title">
              {title}
            </Text>
          )}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  overlayBottom: {
    justifyContent: 'flex-end',
    padding: 0,
  },
  content: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    width: '100%',
    ...shadows.lg,
  },
  contentBottom: {
    borderRadius: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  title: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.lg,
  },
});
