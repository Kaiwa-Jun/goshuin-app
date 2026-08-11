import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { Header } from '@components/common/Header';
import { useAuth } from '@hooks/useAuth';
import { deleteAccount } from '@services/account';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'AccountDeletion'>;

// src/constants/legal.ts のプライバシーポリシー「アカウント削除時のデータの
// 取り扱い」に書いてある内容と一致させる（すでに公開済みの約束）
const DELETED_ITEMS = [
  '御朱印記録（画像・メモ・訪問日・スポット情報）',
  '御朱印帳',
  '行きたいリスト',
  'プロフィール情報（表示名・プロフィール画像）',
];

export function AccountDeletionScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runDeletion = async () => {
    // 二度押しの穴を塞ぐ（Issue #130 で記録の送信に同じ対処をしている）
    if (isDeleting) return;
    setIsDeleting(true);
    setErrorMessage(null);

    const result = await deleteAccount();

    if (!result.success) {
      // 失敗時はサインアウトしない。中途半端な状態をユーザーが確認できるようにする
      setErrorMessage(result.error.message);
      setIsDeleting(false);
      return;
    }

    await signOut();
    navigation.navigate('MainTabs', { screen: 'MapTab', params: { screen: 'Map' } });
  };

  const handlePress = () => {
    if (isDeleting) return;
    Alert.alert(
      'アカウントを削除しますか？',
      'すべての御朱印記録と画像が削除されます。元に戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除する', style: 'destructive', onPress: runDeletion },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} testID="account-deletion-screen" edges={['top']}>
      <Header title="アカウントを削除" onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>アカウントを削除すると、以下がすべて削除されます。</Text>

        <Card style={styles.itemsCard}>
          {DELETED_ITEMS.map(item => (
            <View key={item} style={styles.item}>
              <MaterialIcons name="delete-outline" size={20} color={colors.error} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </Card>

        <View style={styles.warning}>
          <MaterialIcons name="warning-amber" size={20} color={colors.error} />
          <Text style={styles.warningText}>
            一度削除すると元に戻せません。同じアカウントでログインし直しても、記録は復元されません。
          </Text>
        </View>

        {errorMessage !== null && (
          <View style={styles.errorBox} testID="account-deletion-error">
            <Text style={styles.errorTitle}>削除できませんでした</Text>
            <Text style={styles.errorBody}>{errorMessage}</Text>
          </View>
        )}

        <Button
          title={isDeleting ? '削除しています…' : 'アカウントを削除する'}
          onPress={handlePress}
          disabled={isDeleting}
          style={styles.deleteButton}
          textStyle={styles.deleteButtonText}
          testID="delete-account-button"
        />
        <Button
          title="キャンセル"
          onPress={() => navigation.goBack()}
          variant="ghost"
          disabled={isDeleting}
        />
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
    gap: spacing.lg,
  },
  lead: {
    ...typography.body,
    color: colors.gray[700],
  },
  itemsCard: {
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemText: {
    ...typography.body,
    color: colors.gray[700],
    flex: 1,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  warningText: {
    ...typography.caption,
    color: colors.error,
    flex: 1,
  },
  errorBox: {
    backgroundColor: colors.gray[100],
    borderRadius: spacing.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  errorTitle: {
    ...typography.body,
    color: colors.error,
  },
  errorBody: {
    ...typography.caption,
    color: colors.gray[700],
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  deleteButtonText: {
    color: colors.white,
  },
});
