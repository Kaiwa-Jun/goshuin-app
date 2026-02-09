import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { Header } from '@components/common/Header';
import { useSpotDetail } from '@hooks/useSpotDetail';
import type { MapStackScreenProps } from '@/navigation/types';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

type Props = MapStackScreenProps<'SpotDetail'>;

export function SpotDetailScreen({ navigation, route }: Props) {
  const { spotId } = route.params;
  const { spot, isLoading, error } = useSpotDetail(spotId);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleRecord = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Record');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} testID="spot-detail-screen">
        <Header title="スポット詳細" onBack={handleBack} />
        <View style={styles.centerContent} testID="spot-detail-loading">
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !spot) {
    return (
      <SafeAreaView style={styles.container} testID="spot-detail-screen">
        <Header title="スポット詳細" onBack={handleBack} />
        <View style={styles.centerContent} testID="spot-detail-error">
          <MaterialIcons name="error-outline" size={48} color={colors.gray[400]} />
          <Text style={styles.errorText}>{error ?? 'スポットが見つかりません'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const badgeType = spot.type === 'shrine' ? 'shrine' : 'temple';

  return (
    <SafeAreaView style={styles.container} testID="spot-detail-screen">
      <Header title="スポット詳細" onBack={handleBack} />

      <View style={styles.scrollContent}>
        <View style={styles.badgeRow}>
          <Badge type={badgeType} />
        </View>

        <Text style={styles.spotName} testID="spot-name">
          {spot.name}
        </Text>
        {spot.address && (
          <View style={styles.addressRow}>
            <MaterialIcons name="place" size={16} color={colors.gray[400]} />
            <Text style={styles.address}>{spot.address}</Text>
          </View>
        )}

        <Card style={styles.visitCard}>
          <View style={styles.visitRow}>
            <View style={styles.visitItem}>
              <Text style={styles.visitLabel}>種別</Text>
              <Text style={styles.visitValue}>{spot.type === 'shrine' ? '神社' : '寺院'}</Text>
            </View>
          </View>
        </Card>

        <Button
          title="ここで記録する"
          onPress={handleRecord}
          variant="primary"
          style={styles.recordButton}
        />

        <Text style={styles.sectionTitle}>アクセス</Text>
        <View style={styles.miniMap} testID="mini-map">
          <MaterialIcons name="map" size={32} color={colors.gray[300]} />
          <Text style={styles.miniMapText}>地図</Text>
        </View>
        {spot.address && (
          <View style={styles.miniMapAddress}>
            <MaterialIcons name="place" size={16} color={colors.primary[500]} />
            <Text style={styles.miniMapAddressText}>{spot.address}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.gray[500],
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
    flex: 1,
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
  recordButton: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.md,
    marginTop: spacing.lg,
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
