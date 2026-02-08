import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import type { RootStackScreenProps } from '@/navigation/types';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

type Props = RootStackScreenProps<'Login'>;

export function LoginScreen({ navigation }: Props) {
  const handleGoogleLogin = () => {
    // TODO: Supabase Auth with Google OAuth
  };

  const handleLater = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} testID="login-screen">
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="menu-book" size={64} color={colors.primary[500]} />
        </View>

        <Text style={styles.appName}>御朱印コレクション</Text>
        <Text style={styles.tagline}>集めるたび、地図があなたの旅になる。</Text>

        <View style={styles.loginSection}>
          <Text style={styles.loginPrompt}>旅の記録を保存しましょう</Text>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            activeOpacity={0.7}
            testID="google-login-button"
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>Google でログイン</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLater} testID="later-button">
            <Text style={styles.laterText}>あとにする</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.termsText}>
          ログインすると
          <Text style={styles.termsLink}> 利用規約 </Text>と
          <Text style={styles.termsLink}> プライバシーポリシー </Text>
          に同意したことになります
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[50],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: borderRadius['3xl'],
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    marginBottom: spacing.xl,
  },
  appName: {
    ...typography.h1,
    color: colors.gray[900],
    textAlign: 'center',
  },
  tagline: {
    ...typography.body,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  loginSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing['5xl'],
    gap: spacing.lg,
  },
  loginPrompt: {
    ...typography.bodySmall,
    color: colors.gray[500],
    marginBottom: spacing.sm,
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
    marginTop: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  termsText: {
    ...typography.caption,
    color: colors.gray[400],
    textAlign: 'center',
  },
  termsLink: {
    color: colors.primary[500],
  },
});
