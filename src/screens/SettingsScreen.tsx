import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@components/common/Card';
import { useAuth } from '@hooks/useAuth';
import { useDefaultPublicSetting } from '@hooks/useDefaultPublicSetting';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { MainTabScreenProps } from '@/navigation/types';

type Props = MainTabScreenProps<'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { user, isAuthenticated, signOut } = useAuth();
  const { defaultPublic, updateDefaultPublic } = useDefaultPublicSetting();
  const appVersion = Constants.expoConfig?.version ?? '不明';
  // OS の権限はアプリから直接トグルできないため、状態の表示と設定アプリへの導線だけ持つ
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (!cancelled) setLocationGranted(status === Location.PermissionStatus.GRANTED);
      } catch (e) {
        // 取得に失敗しても行自体は出す。握り潰さずログには残す
        console.warn('[settings] failed to read location permission:', e);
        if (!cancelled) setLocationGranted(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = isAuthenticated
    ? (user?.user_metadata?.full_name as string) || 'ユーザー'
    : 'ゲスト';

  const displayEmail = isAuthenticated ? (user?.email ?? '未設定') : '未設定';

  const handleLogout = async () => {
    const result = await signOut();
    if (!result.success) {
      Alert.alert('エラー', result.error.message);
    }
  };

  const handleLogin = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Login');
    }
  };

  const handleDeleteAccount = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('AccountDeletion');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>自分</Text>

        {/* Account Section */}
        <Text style={styles.sectionTitle}>アカウント</Text>
        <Card style={styles.sectionCard}>
          <View style={styles.row}>
            <MaterialIcons name="person" size={24} color={colors.gray[500]} />
            <Text style={styles.rowLabel}>{displayName}</Text>
          </View>
          <View style={styles.row}>
            <MaterialIcons name="email" size={24} color={colors.gray[500]} />
            <Text style={styles.rowLabel}>{displayEmail}</Text>
          </View>
          <View style={styles.divider} />
          {isAuthenticated ? (
            <>
              <TouchableOpacity
                style={styles.row}
                accessibilityRole="button"
                onPress={handleLogout}
              >
                <MaterialIcons name="logout" size={24} color={colors.error} />
                <Text style={styles.logoutText}>ログアウト</Text>
              </TouchableOpacity>
              {/* App Store Guideline 5.1.1(v): アカウント作成があるアプリは
                  アプリ内から削除を開始できなければならない（Issue #134） */}
              <TouchableOpacity
                style={styles.row}
                accessibilityRole="button"
                onPress={handleDeleteAccount}
                testID="delete-account-row"
              >
                <MaterialIcons name="delete-forever" size={24} color={colors.error} />
                <Text style={styles.logoutText}>アカウントを削除</Text>
                <MaterialIcons name="chevron-right" size={24} color={colors.gray[400]} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.row} accessibilityRole="button" onPress={handleLogin}>
              <MaterialIcons name="login" size={24} color={colors.primary[500]} />
              <Text style={styles.loginText}>ログイン</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Public Settings Section - only for authenticated users */}
        {isAuthenticated && (
          <>
            <Text style={styles.sectionTitle}>公開設定</Text>
            <Card style={styles.sectionCard}>
              <View style={styles.publicRow}>
                <View style={styles.publicLabelContainer}>
                  <Text style={styles.rowLabel}>御朱印のデフォルト公開設定</Text>
                  <Text style={styles.publicDescription}>
                    新しく記録する御朱印を自動的に公開します
                  </Text>
                </View>
                <Switch
                  value={defaultPublic}
                  onValueChange={updateDefaultPublic}
                  trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
                  thumbColor={defaultPublic ? colors.primary[500] : colors.gray[100]}
                  testID="default-public-toggle"
                />
              </View>
            </Card>
          </>
        )}

        {/* App Info Section */}
        <Text style={styles.sectionTitle}>位置情報</Text>
        <Card>
          <TouchableOpacity
            style={styles.row}
            accessibilityRole="button"
            onPress={() => Linking.openSettings()}
            testID="location-settings-row"
          >
            <Text style={styles.rowLabel}>現在地の利用</Text>
            <View style={styles.rowRight}>
              {locationGranted !== null && (
                <Text style={styles.rowValue}>{locationGranted ? '許可済み' : '未許可'}</Text>
              )}
              <MaterialIcons name="chevron-right" size={24} color={colors.gray[400]} />
            </View>
          </TouchableOpacity>
        </Card>

        <Text style={styles.sectionTitle}>アプリ情報</Text>
        <Card style={styles.sectionCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>バージョン</Text>
            <Text style={styles.rowValue}>{appVersion}</Text>
          </View>
          <TouchableOpacity
            style={styles.row}
            accessibilityRole="button"
            onPress={() => {
              const parent = navigation.getParent();
              if (parent) parent.navigate('TermsOfService');
            }}
          >
            <Text style={styles.rowLabel}>利用規約</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.gray[400]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            accessibilityRole="button"
            onPress={() => {
              const parent = navigation.getParent();
              if (parent) parent.navigate('PrivacyPolicy');
            }}
          >
            <Text style={styles.rowLabel}>プライバシーポリシー</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.gray[400]} />
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  header: {
    ...typography.h2,
    color: colors.gray[900],
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.md,
  },
  sectionCard: {
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    color: colors.gray[700],
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    ...typography.body,
    color: colors.gray[500],
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
  },
  logoutText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
  loginText: {
    ...typography.body,
    color: colors.primary[500],
    flex: 1,
  },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  publicLabelContainer: {
    flex: 1,
  },
  publicDescription: {
    ...typography.caption,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
});
