import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '@components/common/Header';
import { PRIVACY_POLICY } from '@/constants/legal';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'PrivacyPolicy'>;

export function PrivacyPolicyScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} testID="privacy-policy-screen" edges={['top']}>
      <Header title="プライバシーポリシー" onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>最終更新日: {PRIVACY_POLICY.lastUpdated}</Text>
        {PRIVACY_POLICY.sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
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
  lastUpdated: {
    ...typography.caption,
    color: colors.gray[500],
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.gray[900],
    marginBottom: spacing.sm,
  },
  sectionBody: {
    ...typography.body,
    color: colors.gray[700],
    lineHeight: 26,
  },
});
