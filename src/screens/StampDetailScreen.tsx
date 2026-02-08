import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Badge } from '@components/common/Badge';
import { Card } from '@components/common/Card';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';
import type { GalleryStackScreenProps } from '@/navigation/types';

type Props = GalleryStackScreenProps<'StampDetail'>;

export function StampDetailScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          testID="back-button"
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>御朱印詳細</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageArea} testID="stamp-image">
          <MaterialIcons name="image" size={48} color={colors.gray[400]} />
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.spotName}>明治神宮</Text>
          <Badge type="shrine" />
          <Text style={styles.visitDate}>2024年1月15日</Text>
        </View>

        <Card style={styles.memoCard}>
          <Text style={styles.memoLabel}>メモ</Text>
          <Text style={styles.memoText}>初めての御朱印。天気が良くて気持ちの良い参拝でした。</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.gray[800],
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },
  imageArea: {
    width: '100%',
    height: 300,
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  spotName: {
    ...typography.h2,
    color: colors.gray[800],
  },
  visitDate: {
    ...typography.body,
    color: colors.gray[500],
  },
  memoCard: {
    marginHorizontal: spacing.lg,
  },
  memoLabel: {
    ...typography.label,
    color: colors.gray[500],
    marginBottom: spacing.sm,
  },
  memoText: {
    ...typography.body,
    color: colors.gray[800],
  },
});
