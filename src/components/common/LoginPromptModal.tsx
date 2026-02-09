import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Modal } from '@components/common/Modal';
import { useAuth } from '@hooks/useAuth';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

interface LoginPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export function LoginPromptModal({ visible, onClose, onLoginSuccess }: LoginPromptModalProps) {
  const { signInWithGoogle } = useAuth();

  const handleGoogleLogin = async () => {
    const result = await signInWithGoogle();

    if (result.success) {
      onLoginSuccess();
      return;
    }

    if (result.error.code !== 'CANCELLED') {
      Alert.alert('ログインエラー', result.error.message);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="center" closeOnBackdrop={false}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="camera-alt" size={32} color={colors.primary[500]} />
        </View>

        <Text style={styles.title}>ログインが必要です</Text>
        <Text style={styles.description}>御朱印を記録するにはログインしてください</Text>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          activeOpacity={0.7}
          testID="modal-google-login-button"
        >
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleButtonText}>Google でログイン</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} testID="modal-later-button">
          <Text style={styles.laterText}>あとにする</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    width: '100%',
    gap: spacing.sm,
    ...shadows.sm,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray[700],
  },
  googleButtonText: {
    ...typography.button,
    color: colors.gray[700],
  },
  laterText: {
    ...typography.body,
    color: colors.gray[500],
    marginTop: spacing.lg,
  },
});
