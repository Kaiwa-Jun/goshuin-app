import React, { useCallback, useMemo, useState } from 'react';
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
import { useStampDetail } from '@hooks/useStampDetail';
import { getStampImageUrl } from '@services/stamps';
import { ImageGalleryModal, GalleryImage } from '@components/common/ImageGalleryModal';
import { EditStampModal } from '@components/stamp-detail/EditStampModal';
import { DeleteConfirmModal } from '@components/stamp-detail/DeleteConfirmModal';
import type { StampWithSpot } from '@/types/supabase';

type SortOrder = 'date' | 'spot';

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_MARGIN = spacing.xs;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - ITEM_MARGIN * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export function GalleryScreen() {
  const [sortOrder, setSortOrder] = useState<SortOrder>('date');
  const { stamps, totalCount, isLoading } = useGalleryStamps(sortOrder);

  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const currentStamp = selectedImageIndex !== null ? stamps[selectedImageIndex] : null;
  const { isUpdating, isDeleting, handleUpdate, handleDelete } = useStampDetail(
    currentStamp?.id ?? ''
  );

  const sortLabel = sortOrder === 'date' ? '日付順' : 'スポット順';

  const handleToggleSort = () => {
    setSortOrder(prev => (prev === 'date' ? 'spot' : 'date'));
  };

  const galleryImages: GalleryImage[] = useMemo(
    () =>
      stamps.map(s => ({
        id: s.id,
        imageUrl: getStampImageUrl(s.image_path),
        memo: s.memo,
        visitedAt: s.visited_at,
      })),
    [stamps]
  );

  const handleEdit = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setEditModalVisible(true);
  }, []);

  const handleDeletePress = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setDeleteModalVisible(true);
  }, []);

  const onSave = useCallback(
    async (params: { visited_at: string; memo: string | null }) => {
      const success = await handleUpdate(params);
      if (success) {
        setEditModalVisible(false);
      }
    },
    [handleUpdate]
  );

  const onConfirmDelete = useCallback(async () => {
    const success = await handleDelete();
    if (success) {
      setDeleteModalVisible(false);
      setSelectedImageIndex(null);
    }
  }, [handleDelete]);

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, '/');

  const renderItem = ({ item, index }: { item: StampWithSpot; index: number }) => {
    const isMiddleColumn = index % NUM_COLUMNS === 1;
    const imageUrl = getStampImageUrl(item.image_path);

    return (
      <TouchableOpacity
        style={[styles.gridItem, isMiddleColumn && styles.gridItemMiddle]}
        onPress={() => setSelectedImageIndex(index)}
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
    <View style={styles.rootContainer}>
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
            <ActivityIndicator
              size="large"
              color={colors.primary[500]}
              testID="loading-indicator"
            />
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

        {currentStamp && (
          <>
            <EditStampModal
              visible={editModalVisible}
              onClose={() => setEditModalVisible(false)}
              onSave={onSave}
              isUpdating={isUpdating}
              initialVisitedAt={currentStamp.visited_at}
              initialMemo={currentStamp.memo}
            />
            <DeleteConfirmModal
              visible={deleteModalVisible}
              onClose={() => setDeleteModalVisible(false)}
              onConfirm={onConfirmDelete}
              isDeleting={isDeleting}
              spotName={currentStamp.spots.name}
            />
          </>
        )}
      </SafeAreaView>
      <ImageGalleryModal
        visible={selectedImageIndex !== null}
        onClose={() => setSelectedImageIndex(null)}
        images={galleryImages}
        initialIndex={selectedImageIndex ?? 0}
        onEdit={handleEdit}
        onDelete={handleDeletePress}
        useModal={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
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
