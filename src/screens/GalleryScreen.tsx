import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { useGalleryStamps } from '@hooks/useGalleryStamps';
import { getStampImageUrl } from '@services/stamps';
import type { StampWithSpot } from '@/types/supabase';
import type { GalleryStackScreenProps } from '@/navigation/types';

type Props = GalleryStackScreenProps<'Gallery'>;
type SortOrder = 'date' | 'spot';

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_MARGIN = spacing.xs;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - ITEM_MARGIN * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export function GalleryScreen({ navigation }: Props) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('date');
  const { stamps, totalCount, isLoading } = useGalleryStamps(sortOrder);

  const sortLabel = sortOrder === 'date' ? '日付順' : 'スポット順';

  const handleToggleSort = () => {
    setSortOrder(prev => (prev === 'date' ? 'spot' : 'date'));
  };

  const handleItemPress = (stamp: StampWithSpot) => {
    navigation.navigate('StampDetail', { stampId: stamp.id });
  };

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, '/');

  const renderItem = ({ item, index }: { item: StampWithSpot; index: number }) => {
    const isMiddleColumn = index % NUM_COLUMNS === 1;
    const imageUrl = getStampImageUrl(item.image_path);

    return (
      <TouchableOpacity
        style={[styles.gridItem, isMiddleColumn && styles.gridItemMiddle]}
        onPress={() => handleItemPress(item)}
        testID={`gallery-item-${item.id}`}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.stampImage}
          testID={`stamp-image-${item.id}`}
        />
        <Text style={styles.itemSpotName} numberOfLines={1}>
          {item.spots.name}
        </Text>
        {sortOrder === 'date' && <Text style={styles.itemDate}>{formatDate(item.visited_at)}</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>御朱印</Text>
      </View>

      <View style={styles.sortRow}>
        <TouchableOpacity onPress={handleToggleSort} testID="sort-button">
          <Text style={styles.sortText}>{sortLabel} ▼</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} testID="loading-indicator" />
        </View>
      ) : stamps.length === 0 ? (
        <View style={styles.centerContainer} testID="empty-state">
          <MaterialIcons name="photo-library" size={48} color={colors.gray[400]} />
          <Text style={styles.emptyText}>御朱印がまだありません</Text>
          <Text style={styles.emptySubText}>御朱印を記録して、コレクションを始めましょう</Text>
        </View>
      ) : (
        <FlatList
          data={stamps}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          key={sortOrder}
          contentContainerStyle={styles.listContent}
          testID="gallery-list"
        />
      )}

      {totalCount > 20 && (
        <View style={styles.premiumBanner} testID="premium-banner">
          <MaterialIcons name="lock" size={16} color={colors.primary[600]} />
          <Text style={styles.premiumBannerText}>直近20件のみ表示中。プレミアムで全件表示</Text>
        </View>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.gray[800],
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  sortText: {
    ...typography.bodySmall,
    color: colors.gray[600],
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  gridItem: {
    width: ITEM_SIZE,
    marginBottom: spacing.lg,
  },
  gridItemMiddle: {
    marginHorizontal: ITEM_MARGIN,
  },
  stampImage: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.md,
  },
  itemSpotName: {
    ...typography.caption,
    color: colors.gray[800],
    marginTop: spacing.xs,
  },
  itemDate: {
    ...typography.caption,
    color: colors.gray[400],
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.gray[600],
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubText: {
    ...typography.bodySmall,
    color: colors.gray[400],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.primary[200],
  },
  premiumBannerText: {
    ...typography.bodySmall,
    color: colors.primary[700],
    flex: 1,
  },
});
