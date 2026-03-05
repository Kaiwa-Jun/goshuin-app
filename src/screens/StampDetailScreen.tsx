import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Badge } from '@components/common/Badge';
import { Card } from '@components/common/Card';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';
import { fetchStampById, getStampImageUrl } from '@services/stamps';
import type { StampWithSpot } from '@/types/supabase';
import type { GalleryStackScreenProps } from '@/navigation/types';

type Props = GalleryStackScreenProps<'StampDetail'>;

export function StampDetailScreen({ navigation, route }: Props) {
  const { stampId } = route.params;
  const [stamp, setStamp] = useState<StampWithSpot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStampById(stampId)
      .then(data => {
        setStamp(data);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : '取得に失敗しました');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [stampId]);

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, '/');

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

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} testID="loading-indicator" />
        </View>
      ) : error || !stamp ? (
        <View style={styles.centerContainer} testID="error-state">
          <MaterialIcons name="error-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>データを取得できませんでした</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Image
            source={{ uri: getStampImageUrl(stamp.image_path) }}
            style={styles.stampImage}
            testID="stamp-image"
          />

          <View style={styles.infoSection}>
            <Text style={styles.spotName}>{stamp.spots.name}</Text>
            <Badge type={stamp.spots.type} />
            <Text style={styles.visitDate}>{formatDate(stamp.visited_at)}</Text>
          </View>

          {stamp.memo && (
            <Card style={styles.memoCard}>
              <Text style={styles.memoLabel}>メモ</Text>
              <Text style={styles.memoText}>{stamp.memo}</Text>
            </Card>
          )}
        </ScrollView>
      )}
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },
  stampImage: {
    width: '100%',
    height: 300,
    backgroundColor: colors.gray[200],
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
