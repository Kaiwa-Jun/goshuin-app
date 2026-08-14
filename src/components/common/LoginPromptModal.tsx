import React from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';

import { Modal } from '@components/common/Modal';
import { useAuth } from '@hooks/useAuth';
import type { AuthResult } from '@services/auth';
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
  const { signInWithGoogle, signInWithApple } = useAuth();

  const handleResult = (result: AuthResult) => {
    if (result.success) {
      onLoginSuccess();
      return;
    }

    if (result.error.code !== 'CANCELLED') {
      Alert.alert('ログインエラー', result.error.message);
    }
  };

  const handleGoogleLogin = async () => {
    handleResult(await signInWithGoogle());
  };

  const handleAppleLogin = async () => {
    handleResult(await signInWithApple());
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="center" closeOnBackdrop={false}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="camera-alt" size={32} color={colors.primary[500]} />
        </View>

        <Text style={styles.title}>ログインが必要です</Text>
        <Text style={styles.description}>御朱印を記録するにはログインしてください</Text>

        {/* Guideline 4.8: 第三者ログインと同等の選択肢を必ず併置する。
            Google より上に置くこと（下や折りたたみだと「同等」に見えない） */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={borderRadius.lg}
            style={styles.appleButton}
            onPress={handleAppleLogin}
            testID="modal-apple-login-button"
          />
        )}

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
  appleButton: {
    width: '100%',
    height: 48,
    marginBottom: spacing.md,
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
