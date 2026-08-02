import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { WishlistButton } from '@components/animated/WishlistButton';
import { useAuth } from '@hooks/useAuth';
import { useCollectionStats } from '@hooks/useCollectionStats';
import { useWishlistSpots } from '@hooks/useWishlistSpots';
import { getAllBadges } from '@services/badges';
import { removeFromWishlist } from '@services/wishlist';
import { colors } from '@theme/colors';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import { groupByRegionBlock } from '@utils/regionBlocks';
import type { CollectionStackScreenProps } from '@/navigation/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = CollectionStackScreenProps<'CollectionList'>;

export function CollectionScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const { spots: wishlistSpots, refetch: refetchWishlist } = useWishlistSpots();
  const { spotCount, stampCount, regionStats, pilgrimageProgress, isLoading } =
    useCollectionStats();

  const [showAllPilgrimages, setShowAllPilgrimages] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

  const groupedRegions = useMemo(() => groupByRegionBlock(regionStats), [regionStats]);

  const toggleRegionBlock = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedRegions(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleRemoveFromWishlist = async (spotId: string) => {
    if (!user) return;
    await removeFromWishlist(user.id, spotId);
    refetchWishlist();
  };

  const handlePilgrimageDetail = (pilgrimageId: string, pilgrimageName: string) => {
    navigation.navigate('PilgrimageDetail', { pilgrimageId, pilgrimageName });
  };

  const handleRegionPress = (prefecture: string) => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('MapTab', {
        screen: 'Map',
        params: { focusPrefecture: prefecture },
      });
    }
  };

  const badges = getAllBadges();
  const badgesWithStatus = badges.map(badge => ({
    ...badge,
    earned: spotCount >= badge.condition.threshold,
  }));

  const topPilgrimage = pilgrimageProgress.length > 0 ? pilgrimageProgress[0] : null;
  const otherPilgrimages = pilgrimageProgress.slice(1);
  const progressPercent = topPilgrimage
    ? Math.round((topPilgrimage.visitedCount / topPilgrimage.totalSpots) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>コレクション</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Guest Card（未ログイン時のみ） */}
        {!isAuthenticated && (
          <View testID="collection-guest-empty-state">
            <Card style={styles.guestCard}>
              <MaterialIcons name="emoji-events" size={40} color={colors.primary[500]} />
              <Text style={styles.guestCardTitle}>記録するとここに集計されます</Text>
              <Text style={styles.guestCardDescription}>
                訪れた寺社の数・都道府県の埋まり方・巡礼の進捗・獲得バッジが自動でたまります
              </Text>
              <Button
                title="ログインして始める"
                variant="primary"
                testID="collection-login-cta"
                onPress={() => navigation.navigate('Login')}
                style={styles.guestCardCta}
              />
            </Card>
          </View>
        )}

        {/* Achievement Summary Card */}
        <View style={styles.summaryCardOuter}>
          {/* 右上の装飾アイコン */}
          <View style={styles.summaryDecoration}>
            <MaterialIcons name="temple-buddhist" size={140} color="rgba(255,255,255,0.1)" />
          </View>
          <View style={styles.summaryContent}>
            <View style={styles.summarySubtitleRow}>
              <MaterialIcons name="emoji-events" size={16} color={colors.white} />
              <Text style={styles.summarySubtitle}>これまでの達成</Text>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  {isLoading ? <ActivityIndicator size="small" color={colors.white} /> : spotCount}
                </Text>
                <Text style={styles.summaryLabel}>箇所</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItemRight}>
                <Text style={styles.summaryNumber}>
                  {isLoading ? <ActivityIndicator size="small" color={colors.white} /> : stampCount}
                </Text>
                <Text style={styles.summaryLabel}>御朱印（枚）</Text>
              </View>
            </View>
          </View>
        </View>
        {/* Badge Section */}
        <Text style={styles.sectionTitle}>獲得バッジ</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.badgeScrollView}
          contentContainerStyle={styles.badgeScrollContent}
        >
          {badgesWithStatus.map(badge => (
            <View key={badge.id} style={styles.badgeItem}>
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
        </ScrollView>

        {/* Pilgrimage Challenge Section */}
        <Text style={styles.sectionTitle}>巡礼チャレンジ</Text>
        {topPilgrimage === null ? (
          <Card style={styles.pilgrimageEmptyCard}>
            <MaterialIcons name="explore" size={40} color={colors.gray[300]} />
            <Text style={styles.pilgrimageEmptyText}>巡礼チャレンジに挑戦してみましょう</Text>
          </Card>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handlePilgrimageDetail(topPilgrimage.id, topPilgrimage.name)}
            >
              <Card style={styles.pilgrimageCard}>
                <View style={styles.pilgrimageHeader}>
                  <Text style={styles.pilgrimageGoalLabel}>現在の目標</Text>
                  <View style={styles.pilgrimageBadge}>
                    <Text style={styles.pilgrimageBadgeText}>
                      {topPilgrimage.visitedCount > 0 ? '進行中' : '未着手'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.pilgrimageName}>{topPilgrimage.name}</Text>
                <View style={styles.pilgrimageStatsRow}>
                  <Text style={styles.pilgrimagePercent}>{progressPercent}%</Text>
                  <Text style={styles.pilgrimageCount}>
                    {topPilgrimage.visitedCount}/{topPilgrimage.totalSpots}
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
              </Card>
            </TouchableOpacity>

            {otherPilgrimages.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowAllPilgrimages(!showAllPilgrimages)}
                style={styles.toggleButton}
              >
                <Text style={styles.toggleText}>
                  {showAllPilgrimages ? '閉じる' : `他の巡礼を見る (${otherPilgrimages.length})`}
                </Text>
                <MaterialIcons
                  name={showAllPilgrimages ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={20}
                  color={colors.gray[500]}
                />
              </TouchableOpacity>
            )}

            {showAllPilgrimages &&
              otherPilgrimages.map(p => {
                const percent = Math.round((p.visitedCount / p.totalSpots) * 100);
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handlePilgrimageDetail(p.id, p.name)}
                    activeOpacity={0.8}
                  >
                    <Card style={styles.pilgrimageCompactCard}>
                      <Text style={styles.pilgrimageCompactName}>{p.name}</Text>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                      </View>
                      <Text style={styles.pilgrimageCompactCount}>
                        {p.visitedCount}/{p.totalSpots}
                      </Text>
                    </Card>
                  </TouchableOpacity>
                );
              })}
          </>
        )}

        {/* Region Section */}
        <Text style={[styles.sectionTitle, styles.sectionTitleSpacing]}>地域別</Text>
        {regionStats.length === 0 ? (
          <Card style={styles.regionEmptyCard}>
            <MaterialIcons name="map" size={40} color={colors.gray[300]} />
            <Text style={styles.regionEmptyText}>御朱印を記録すると地域別の統計が表示されます</Text>
          </Card>
        ) : (
          groupedRegions.map(block => {
            const isExpanded = expandedRegions.has(block.key);
            const blockPercent =
              block.totalPrefCount > 0
                ? Math.round((block.visitedPrefCount / block.totalPrefCount) * 100)
                : 0;
            return (
              <Card key={block.key} style={styles.regionBlockCard}>
                <TouchableOpacity
                  style={styles.regionBlockHeader}
                  onPress={() => toggleRegionBlock(block.key)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={isExpanded ? 'expand-more' : 'chevron-right'}
                    size={24}
                    color={colors.gray[700]}
                  />
                  <Text style={styles.regionBlockName}>{block.label}</Text>
                  <View style={styles.regionBlockProgressContainer}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${blockPercent}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.regionBlockCount}>
                    {block.visitedPrefCount}/{block.totalPrefCount}
                  </Text>
                </TouchableOpacity>
                {isExpanded &&
                  block.prefectures.map(pref => {
                    const prefColor = pref.hasVisited ? colors.primary[500] : colors.gray[400];
                    return (
                      <TouchableOpacity
                        key={pref.prefecture}
                        style={styles.regionPrefRow}
                        onPress={() => handleRegionPress(pref.prefecture)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="location-on" size={18} color={prefColor} />
                        <Text style={[styles.regionPrefName, { color: prefColor }]}>
                          {pref.prefecture}
                        </Text>
                        <Text style={[styles.regionPrefCount, { color: prefColor }]}>
                          {pref.visitedCount}/{pref.totalCount}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </Card>
            );
          })
        )}

        {/* Wishlist Section */}
        <Text style={styles.sectionTitle}>行きたいリスト</Text>
        {wishlistSpots.length === 0 ? (
          <Card style={styles.wishlistEmptyCard}>
            <MaterialIcons name="outlined-flag" size={40} color={colors.gray[300]} />
            <Text style={styles.wishlistEmptyText}>行きたいスポットをマップで保存しましょう</Text>
          </Card>
        ) : (
          wishlistSpots.map(item => (
            <View key={item.id} testID={`wishlist-item-${item.spot_id}`}>
              <Card style={styles.wishlistCard}>
                <View style={styles.wishlistRow}>
                  <View style={styles.wishlistInfo}>
                    <View style={styles.wishlistNameRow}>
                      <Text style={styles.wishlistSpotName} numberOfLines={1}>
                        {item.spots.name}
                      </Text>
                      <Badge type={item.spots.type === 'shrine' ? 'shrine' : 'temple'} />
                    </View>
                    {item.spots.address && (
                      <View style={styles.wishlistAddressRow}>
                        <MaterialIcons name="place" size={14} color={colors.gray[400]} />
                        <Text style={styles.wishlistAddress} numberOfLines={1}>
                          {item.spots.address}
                        </Text>
                      </View>
                    )}
                  </View>
                  <WishlistButton
                    isWishlisted={true}
                    onPress={() => handleRemoveFromWishlist(item.spot_id)}
                  />
                </View>
              </Card>
            </View>
          ))
        )}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerText: {
    ...typography.h2,
    color: colors.gray[900],
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  guestCard: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  guestCardTitle: {
    ...typography.h3,
    color: colors.gray[800],
    marginTop: spacing.md,
    textAlign: 'center',
  },
  guestCardDescription: {
    ...typography.bodySmall,
    color: colors.gray[500],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  guestCardCta: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  summaryCardOuter: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  summaryDecoration: {
    position: 'absolute',
    top: -20,
    right: -20,
  },
  summaryContent: {
    padding: spacing.xl,
  },
  summarySubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    opacity: 0.9,
  },
  summarySubtitle: {
    ...typography.label,
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryItemRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  summaryDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
    marginHorizontal: spacing.lg,
  },
  summaryNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
    lineHeight: 52,
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.md,
  },
  sectionTitleSpacing: {
    marginTop: spacing.xl,
  },
  badgeScrollView: {
    marginBottom: spacing.xl,
  },
  badgeScrollContent: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xs,
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
  pilgrimageCard: {
    marginBottom: spacing.sm,
  },
  pilgrimageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pilgrimageGoalLabel: {
    ...typography.caption,
    color: colors.gray[500],
  },
  pilgrimageBadge: {
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pilgrimageBadgeText: {
    ...typography.caption,
    color: colors.primary[600],
  },
  pilgrimageName: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.sm,
  },
  pilgrimageStatsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pilgrimagePercent: {
    ...typography.h2,
    color: colors.primary[500],
  },
  pilgrimageCount: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  toggleText: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
  pilgrimageCompactCard: {
    marginBottom: spacing.sm,
  },
  pilgrimageCompactName: {
    ...typography.body,
    color: colors.gray[800],
    marginBottom: spacing.sm,
  },
  pilgrimageCompactCount: {
    ...typography.caption,
    color: colors.gray[500],
    textAlign: 'right',
  },
  pilgrimageEmptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  pilgrimageEmptyText: {
    ...typography.bodySmall,
    color: colors.gray[400],
    textAlign: 'center',
  },
  regionBlockCard: {
    marginBottom: spacing.sm,
  },
  regionBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  regionBlockName: {
    ...typography.body,
    color: colors.gray[800],
    fontWeight: '600',
    minWidth: 100,
  },
  regionBlockProgressContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  regionBlockCount: {
    ...typography.bodySmall,
    color: colors.gray[600],
    minWidth: 32,
    textAlign: 'right',
  },
  regionPrefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xl + spacing.sm,
    paddingVertical: spacing.xs,
  },
  regionPrefName: {
    ...typography.bodySmall,
    flex: 1,
  },
  regionPrefCount: {
    ...typography.bodySmall,
    textAlign: 'right',
    minWidth: 40,
  },
  regionEmptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  regionEmptyText: {
    ...typography.bodySmall,
    color: colors.gray[400],
    textAlign: 'center',
  },
  wishlistEmptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  wishlistEmptyText: {
    ...typography.bodySmall,
    color: colors.gray[400],
    textAlign: 'center',
  },
  wishlistCard: {
    marginBottom: spacing.md,
  },
  wishlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wishlistInfo: {
    flex: 1,
  },
  wishlistNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  wishlistSpotName: {
    ...typography.body,
    color: colors.gray[800],
    flexShrink: 1,
  },
  wishlistAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  wishlistAddress: {
    ...typography.bodySmall,
    color: colors.gray[500],
    flex: 1,
  },
});
