import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@components/common/Card';
import { colors } from '@theme/colors';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { MainTabScreenProps } from '@/navigation/types';

type Props = MainTabScreenProps<'Collection'>;

const REGION_DATA = [
  { name: '東京都', count: 15, total: 50 },
  { name: '京都府', count: 8, total: 40 },
  { name: '宮城県', count: 5, total: 30 },
];

const CHALLENGE_DATA = [
  { name: '四国八十八ヶ所', progress: 12, total: 88 },
  { name: '西国三十三所', progress: 5, total: 33 },
];

const BADGE_DATA = [
  { name: '初参拝', earned: true },
  { name: '10箇所達成', earned: true },
  { name: '御朱印マスター', earned: true },
  { name: '巡礼者', earned: false },
  { name: '全国制覇', earned: false },
  { name: '伝説', earned: false },
];

export function CollectionScreen(_props: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>コレクション</Text>

        {/* Achievement Summary */}
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <MaterialIcons name="place" size={28} color={colors.primary[500]} />
            <Text style={styles.summaryNumber}>33</Text>
            <Text style={styles.summaryLabel}>箇所</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <MaterialIcons name="collections" size={28} color={colors.primary[500]} />
            <Text style={styles.summaryNumber}>45</Text>
            <Text style={styles.summaryLabel}>枚</Text>
          </Card>
        </View>

        {/* Region Section */}
        <Text style={styles.sectionTitle}>地域別</Text>
        <Card style={styles.sectionCard}>
          {REGION_DATA.map(region => (
            <View key={region.name} style={styles.regionRow}>
              <Text style={styles.regionName}>{region.name}</Text>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${(region.count / region.total) * 100}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.regionCount}>{region.count}</Text>
            </View>
          ))}
        </Card>

        {/* Challenge Section */}
        <Text style={styles.sectionTitle}>巡礼チャレンジ</Text>
        {CHALLENGE_DATA.map(challenge => (
          <Card key={challenge.name} style={styles.challengeCard}>
            <Text style={styles.challengeName}>{challenge.name}</Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(challenge.progress / challenge.total) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.challengeProgress}>
              {challenge.progress}/{challenge.total}
            </Text>
          </Card>
        ))}

        {/* Badge Section */}
        <Text style={styles.sectionTitle}>バッジ</Text>
        <View style={styles.badgeGrid}>
          {BADGE_DATA.map(badge => (
            <View key={badge.name} style={styles.badgeItem}>
              <View
                style={[
                  styles.badgeCircle,
                  badge.earned ? styles.badgeEarned : styles.badgeUnearned,
                ]}
              >
                <MaterialIcons
                  name={badge.earned ? 'military-tech' : 'lock'}
                  size={28}
                  color={badge.earned ? colors.white : colors.gray[400]}
                />
              </View>
              <Text style={styles.badgeName}>{badge.name}</Text>
            </View>
          ))}
        </View>
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
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  summaryNumber: {
    ...typography.h1,
    color: colors.gray[900],
    marginTop: spacing.sm,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.md,
  },
  sectionCard: {
    marginBottom: spacing.xl,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  regionName: {
    ...typography.bodySmall,
    color: colors.gray[700],
    width: 56,
  },
  progressBarContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  regionCount: {
    ...typography.bodySmall,
    color: colors.gray[700],
    width: 28,
    textAlign: 'right',
  },
  challengeCard: {
    marginBottom: spacing.md,
  },
  challengeName: {
    ...typography.body,
    color: colors.gray[800],
    marginBottom: spacing.sm,
  },
  challengeProgress: {
    ...typography.bodySmall,
    color: colors.gray[500],
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  badgeItem: {
    alignItems: 'center',
    width: 80,
  },
  badgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEarned: {
    backgroundColor: colors.warning,
  },
  badgeUnearned: {
    backgroundColor: colors.gray[200],
  },
  badgeName: {
    ...typography.caption,
    color: colors.gray[600],
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
