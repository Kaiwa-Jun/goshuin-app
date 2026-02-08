import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { Header } from '@components/common/Header';
import type { MapStackScreenProps } from '@/navigation/types';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

type Props = MapStackScreenProps<'SpotDetail'>;

interface MockStamp {
  id: string;
  date: string;
}

const MOCK_STAMPS: MockStamp[] = [
  { id: '1', date: '2024/01/15' },
  { id: '2', date: '2023/05/20' },
  { id: '3', date: '2022/09/10' },
  { id: '4', date: '2022/03/05' },
];

export function SpotDetailScreen({ navigation }: Props) {
  const handleBack = () => {
    navigation.goBack();
  };

  const handleRecord = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Record');
    }
  };

  const renderStampItem = ({ item }: { item: MockStamp }) => (
    <View style={styles.stampItem} testID="stamp-item">
      <View style={styles.stampImagePlaceholder}>
        <MaterialIcons name="image" size={32} color={colors.gray[300]} />
      </View>
      <Text style={styles.stampDate}>{item.date}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} testID="spot-detail-screen">
      <Header title="スポット詳細" onBack={handleBack} />

      <FlatList
        data={MOCK_STAMPS}
        renderItem={renderStampItem}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.stampRow}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            <View style={styles.badgeRow}>
              <Badge type="shrine" />
              <Badge type="visited" />
            </View>

            <Text style={styles.spotName}>大崎八幡宮</Text>
            <View style={styles.addressRow}>
              <MaterialIcons name="place" size={16} color={colors.gray[400]} />
              <Text style={styles.address}>宮城県仙台市青葉区八幡4-6-1</Text>
            </View>

            <Card style={styles.visitCard}>
              <View style={styles.visitRow}>
                <View style={styles.visitItem}>
                  <Text style={styles.visitLabel}>訪問回数</Text>
                  <Text style={styles.visitValue}>3回</Text>
                </View>
                <View style={styles.visitDivider} />
                <View style={styles.visitItem}>
                  <Text style={styles.visitLabel}>最終訪問</Text>
                  <Text style={styles.visitValue}>2024/01/15</Text>
                </View>
              </View>
            </Card>

            <Button
              title="ここで記録する"
              onPress={handleRecord}
              variant="primary"
              style={styles.recordButton}
            />

            <Text style={styles.sectionTitle}>
              あなたが記録した御朱印（{MOCK_STAMPS.length}件）
            </Text>
          </>
        }
        ListFooterComponent={
          <>
            <Text style={styles.sectionTitle}>アクセス</Text>
            <View style={styles.miniMap} testID="mini-map">
              <MaterialIcons name="map" size={32} color={colors.gray[300]} />
              <Text style={styles.miniMapText}>地図</Text>
            </View>
            <View style={styles.miniMapAddress}>
              <MaterialIcons name="place" size={16} color={colors.primary[500]} />
              <Text style={styles.miniMapAddressText}>〒980-0871 宮城県仙台市青葉区八幡4-6-1</Text>
            </View>
          </>
        }
        testID="stamp-list"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  spotName: {
    ...typography.h2,
    color: colors.gray[900],
    marginBottom: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  address: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
  visitCard: {
    marginBottom: spacing.lg,
  },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  visitLabel: {
    ...typography.caption,
    color: colors.gray[500],
  },
  visitValue: {
    ...typography.h3,
    color: colors.gray[900],
  },
  visitDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.gray[200],
  },
  recordButton: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  stampRow: {
    gap: spacing.md,
  },
  stampItem: {
    flex: 1,
    gap: spacing.xs,
  },
  stampImagePlaceholder: {
    aspectRatio: 1,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampDate: {
    ...typography.caption,
    color: colors.gray[500],
    textAlign: 'center',
  },
  miniMap: {
    height: 150,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  miniMapText: {
    ...typography.bodySmall,
    color: colors.gray[400],
  },
  miniMapAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  miniMapAddressText: {
    ...typography.bodySmall,
    color: colors.gray[600],
    flex: 1,
  },
});
