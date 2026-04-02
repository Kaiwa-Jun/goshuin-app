import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@components/common/Badge';
import { Card } from '@components/common/Card';
import { WishlistButton } from '@components/animated/WishlistButton';
import { useAuth } from '@hooks/useAuth';
import { useCollectionStats } from '@hooks/useCollectionStats';
import { useWishlistSpots } from '@hooks/useWishlistSpots';
import { getAllBadges } from '@services/badges';
import { removeFromWishlist } from '@services/wishlist';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { MainTabScreenProps } from '@/navigation/types';

type Props = MainTabScreenProps<'Collection'>;

export function CollectionScreen(_props: Props) {
  const { user } = useAuth();
  const { spots: wishlistSpots, refetch: refetchWishlist } = useWishlistSpots();
  const { spotCount, stampCount, regionStats, isLoading } = useCollectionStats();

  const handleRemoveFromWishlist = async (spotId: string) => {
    if (!user) return;
    await removeFromWishlist(user.id, spotId);
    refetchWishlist();
  };

  const badges = getAllBadges();
  const badgesWithStatus = badges.map(badge => ({
    ...badge,
    earned: spotCount >= badge.condition.threshold,
  }));

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
            <Text style={styles.summaryNumber}>
              {isLoading ? <ActivityIndicator size="small" /> : spotCount}
            </Text>
            <Text style={styles.summaryLabel}>箇所</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <MaterialIcons name="collections" size={28} color={colors.primary[500]} />
            <Text style={styles.summaryNumber}>
              {isLoading ? <ActivityIndicator size="small" /> : stampCount}
            </Text>
            <Text style={styles.summaryLabel}>枚</Text>
          </Card>
        </View>

        {/* Region Section */}
        <Text style={styles.sectionTitle}>地域別</Text>
        {regionStats.length === 0 ? (
          <Card style={styles.regionEmptyCard}>
            <MaterialIcons name="map" size={40} color={colors.gray[300]} />
            <Text style={styles.regionEmptyText}>御朱印を記録すると地域別の統計が表示されます</Text>
          </Card>
        ) : (
          <Card style={styles.sectionCard}>
            {regionStats.map(region => (
              <View key={region.prefecture} style={styles.regionRow}>
                <Text style={styles.regionName}>{region.prefecture}</Text>
                <Text style={styles.regionCount}>{region.visitedCount}箇所</Text>
              </View>
            ))}
          </Card>
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
                    <Text style={styles.wishlistSpotName} numberOfLines={1}>
                      {item.spots.name}
                    </Text>
                    <View style={styles.wishlistBadgeRow}>
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

        {/* Badge Section */}
        <Text style={styles.sectionTitle}>バッジ</Text>
        <View style={styles.badgeGrid}>
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
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  regionName: {
    ...typography.bodySmall,
    color: colors.gray[700],
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
  regionCount: {
    ...typography.bodySmall,
    color: colors.gray[700],
    textAlign: 'right',
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
  wishlistSpotName: {
    ...typography.body,
    color: colors.gray[800],
    marginBottom: spacing.xs,
  },
  wishlistBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
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
