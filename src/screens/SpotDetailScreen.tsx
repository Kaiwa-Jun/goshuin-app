import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { Header } from '@components/common/Header';
import { SpotDetailContent } from '@components/spot-detail/SpotDetailContent';
import { useSpotDetail } from '@hooks/useSpotDetail';
import { useAuth } from '@hooks/useAuth';
import { useSpotStamps } from '@hooks/useSpotStamps';
import type { MapStackScreenProps } from '@/navigation/types';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

type Props = MapStackScreenProps<'SpotDetail'>;

export function SpotDetailScreen({ navigation, route }: Props) {
  const { spotId } = route.params;
  const { spot, isLoading, error } = useSpotDetail(spotId);
  const { isAuthenticated } = useAuth();
  const { stamps, visitCount, latestVisitDate } = useSpotStamps(spotId);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleRecord = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Record', { spotId });
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

  return (
    <SafeAreaView style={styles.container} testID="spot-detail-screen">
      <Header title="スポット詳細" onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SpotDetailContent
          spot={spot}
          stamps={stamps}
          visitCount={visitCount}
          latestVisitDate={latestVisitDate}
          isAuthenticated={isAuthenticated}
          onRecord={handleRecord}
        />
      </ScrollView>
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
    flexGrow: 1,
  },
});
