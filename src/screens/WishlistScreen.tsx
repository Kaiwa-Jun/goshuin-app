import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@components/common/Badge';
import { Card } from '@components/common/Card';
import { WishlistButton } from '@components/animated/WishlistButton';
import { useAuth } from '@hooks/useAuth';
import { useWishlistSpots } from '@hooks/useWishlistSpots';
import { removeFromWishlist } from '@services/wishlist';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { MapStackScreenProps } from '@/navigation/types';

type Props = MapStackScreenProps<'Wishlist'>;

export function WishlistScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { spots, refetch } = useWishlistSpots();

  const handleRemove = async (spotId: string) => {
    if (!user) return;
    await removeFromWishlist(user.id, spotId);
    refetch();
  };

  const handleOpenOnMap = (spotId: string) => {
    navigation.navigate('Map', { focusSpotId: spotId });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']} testID="wishlist-screen">
      <ScrollView contentContainerStyle={styles.content}>
        {spots.length === 0 ? (
          /* Card は testID を受け取らないため View で包む */
          <View testID="wishlist-empty-state">
            <Card style={styles.emptyCard}>
              <MaterialIcons name="bookmark-border" size={40} color={colors.gray[300]} />
              <Text style={styles.emptyText}>行きたいスポットをマップで保存しましょう</Text>
            </Card>
          </View>
        ) : (
          spots.map(item => (
            <View key={item.id} testID={`wishlist-item-${item.spot_id}`}>
              {/* カード全体をタップ可能にする（監査 A-13）。
                  削除ボタンは内側の TouchableOpacity なのでタップは奪われない */}
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.7}
                onPress={() => handleOpenOnMap(item.spot_id)}
                testID={`wishlist-card-${item.spot_id}`}
              >
                <Card style={styles.card}>
                  <View style={styles.row}>
                    <View style={styles.info}>
                      <View style={styles.nameRow}>
                        <Text style={styles.spotName} numberOfLines={1}>
                          {item.spots.name}
                        </Text>
                        <Badge type={item.spots.type === 'shrine' ? 'shrine' : 'temple'} />
                      </View>
                      {item.spots.address && (
                        <View style={styles.addressRow}>
                          <MaterialIcons name="place" size={14} color={colors.gray[400]} />
                          <Text style={styles.address} numberOfLines={1}>
                            {item.spots.address}
                          </Text>
                        </View>
                      )}
                    </View>
                    <WishlistButton
                      isWishlisted={true}
                      onPress={() => handleRemove(item.spot_id)}
                    />
                  </View>
                </Card>
              </TouchableOpacity>
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
  content: {
    padding: spacing.lg,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.gray[400],
    textAlign: 'center',
  },
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  spotName: {
    ...typography.body,
    color: colors.gray[800],
    flexShrink: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  address: {
    ...typography.bodySmall,
    color: colors.gray[500],
    flex: 1,
  },
});
