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
import { useAuth } from '@hooks/useAuth';
import { useGalleryStamps } from '@hooks/useGalleryStamps';
import { useGalleryViewMode } from '@hooks/useGalleryViewMode';
import { useStampDetail } from '@hooks/useStampDetail';
import { getStampImageUrl } from '@services/stamps';
import { Button } from '@components/common/Button';
import { ImageGalleryModal, GalleryImage } from '@components/common/ImageGalleryModal';
import { GoshuinchoFlipView } from '@components/gallery/GoshuinchoFlipView';
import { HeroFlyer } from '@components/gallery/HeroFlyer';
import { useHeroTransition } from '@hooks/useHeroTransition';
import { ViewModeToggle } from '@components/gallery/ViewModeToggle';
import { getWebPreviewStamps, previewImageUrl } from '@components/gallery/webPreview';
import { EditStampModal } from '@components/stamp-detail/EditStampModal';
import { DeleteConfirmModal } from '@components/stamp-detail/DeleteConfirmModal';
import type { StampWithSpot } from '@/types/supabase';
import type { GalleryStackScreenProps } from '@/navigation/types';

type SortOrder = 'date' | 'spot';
type Props = GalleryStackScreenProps<'Gallery'>;

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_MARGIN = spacing.xs;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - ITEM_MARGIN * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const GUEST_PREVIEW_ITEMS = [
  { icon: 'photo-camera', label: '写真で御朱印を残す' },
  { icon: 'sort', label: '日付順・スポット順で並べ替え' },
  { icon: 'fullscreen', label: 'タップで大きく表示' },
] as const;

export function GalleryScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  const [sortOrder, setSortOrder] = useState<SortOrder>('date');
  const {
    stamps,
    isLoading,
    removeStamp,
    updateStamp: updateGalleryStamp,
  } = useGalleryStamps(sortOrder);
  const { viewMode, setViewMode } = useGalleryViewMode();

  // Expo Web の検証イネーブラ（Issue #116 S-7）。native では常に null
  const previewStamps = getWebPreviewStamps();
  const isPreview = previewStamps !== null;
  const displayStamps = previewStamps ?? stamps;
  const showsGallery = isAuthenticated || isPreview;

  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  /** 詳細で今どの1枚を見ているか。横スワイプで変わる。閉じるときの行き先になる */
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const hero = useHeroTransition();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const currentStamp = selectedImageIndex !== null ? displayStamps[selectedImageIndex] : null;
  // プレビューの ID は DB に無いので、そのまま渡すと 404 相当の 400 を叩き続ける。
  // 検証用の経路が本番には無いエラーを生まないよう、ここでは問い合わせない
  const { isUpdating, isDeleting, handleUpdate, handleDelete } = useStampDetail(
    isPreview ? '' : (currentStamp?.id ?? '')
  );

  const sortLabel = sortOrder === 'date' ? '日付順' : 'スポット順';

  const handleToggleSort = () => {
    setSortOrder(prev => (prev === 'date' ? 'spot' : 'date'));
  };

  const galleryImages: GalleryImage[] = useMemo(
    () =>
      displayStamps.map(s => ({
        id: s.id,
        imageUrl: isPreview ? previewImageUrl(s) : getStampImageUrl(s.image_path),
        spotName: s.spots.name,
        memo: s.memo,
        visitedAt: s.visited_at,
      })),
    [displayStamps, isPreview]
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
    async (params: { visited_at: string; memo: string | null; newImageUri?: string }) => {
      const updated = await handleUpdate(params);
      if (updated) {
        updateGalleryStamp(updated);
        setEditModalVisible(false);
      }
    },
    [handleUpdate, updateGalleryStamp]
  );

  const onConfirmDelete = useCallback(async () => {
    const stampId = currentStamp?.id;
    const success = await handleDelete();
    if (success) {
      setDeleteModalVisible(false);
      setSelectedImageIndex(null);
      if (stampId) {
        removeStamp(stampId);
      }
    }
  }, [handleDelete, currentStamp?.id, removeStamp]);

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, '/');

  const imageUrlOf = (stamp: StampWithSpot) =>
    isPreview ? previewImageUrl(stamp) : getStampImageUrl(stamp.image_path);

  /** 押したタイルから詳細へ飛ばす。測れなければ演出を諦めて開く（Issue #192） */
  const openStamp = (index: number, stamp: StampWithSpot) => {
    setViewingIndex(index);
    hero.start(
      {
        stampId: stamp.id,
        index,
        direction: 'in',
        imageUrl: imageUrlOf(stamp),
        spotName: stamp.spots.name,
        visitedAt: formatDate(stamp.visited_at),
      },
      // 開かないのが一番まずい。飛べないときはそのまま出す
      started => {
        if (!started) setSelectedImageIndex(index);
      }
    );
  };

  /** 閉じるときは「今見ている1枚」のタイルへ戻す。横スワイプで別の1枚になっている */
  const closeStamp = () => {
    const index = viewingIndex ?? selectedImageIndex;
    const stamp = index !== null ? displayStamps[index] : null;

    if (!stamp || index === null) {
      setSelectedImageIndex(null);
      return;
    }

    hero.start(
      {
        stampId: stamp.id,
        index,
        direction: 'out',
        imageUrl: imageUrlOf(stamp),
        spotName: stamp.spots.name,
        visitedAt: formatDate(stamp.visited_at),
      },
      // 飛ぶ1枚が地を覆ってから詳細を外す。先に外すと一覧が1フレーム見える
      () => setSelectedImageIndex(null)
    );
  };

  const handleFlightDone = () => {
    if (hero.flight?.direction === 'in') setSelectedImageIndex(hero.flight.index);
    hero.end();
  };

  const renderItem = ({ item, index }: { item: StampWithSpot; index: number }) => {
    const isMiddleColumn = index % NUM_COLUMNS === 1;
    const imageUrl = imageUrlOf(item);

    return (
      <TouchableOpacity
        style={[styles.gridItem, isMiddleColumn && styles.gridItemMiddle]}
        onPress={() => openStamp(index, item)}
        testID={`gallery-item-${item.id}`}
      >
        {/* 飛んでいる間もタイルは隠さない。飛ぶ1枚は出発時にタイルとぴったり
            重なるので二重には見えないし、隠すと写真を待っている間だけ穴があく */}
        <View
          ref={node => {
            hero.registerTile(item.id, 'image', node);
          }}
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.stampImage}
            // 読み込んだついでに縦横比を控える。飛ぶ先の高さがこれで決まる
            onLoad={e =>
              hero.rememberAspect(item.id, e.nativeEvent.source.width, e.nativeEvent.source.height)
            }
            testID={`stamp-image-${item.id}`}
          />
        </View>
        <View
          ref={node => {
            hero.registerTile(item.id, 'text', node);
          }}
        >
          <Text style={styles.itemSpotName} numberOfLines={1}>
            {item.spots.name}
          </Text>
          {sortOrder === 'date' && (
            <Text style={styles.itemDate}>{formatDate(item.visited_at)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.rootContainer}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>御朱印帳</Text>
          {showsGallery && <ViewModeToggle mode={viewMode} onChange={setViewMode} />}
        </View>

        {showsGallery && viewMode === 'grid' && (
          <View style={styles.sortRow}>
            <TouchableOpacity onPress={handleToggleSort} testID="sort-button">
              <Text style={styles.sortText}>{sortLabel} ▼</Text>
            </TouchableOpacity>
          </View>
        )}

        {!showsGallery ? (
          <View style={styles.centerContainer} testID="gallery-guest-empty-state">
            <MaterialIcons name="photo-library" size={48} color={colors.gray[400]} />
            <Text style={styles.emptyText}>あなたの御朱印帳</Text>
            <Text style={styles.emptySubText}>記録した御朱印がここに一覧で並びます</Text>
            <View style={styles.guestPreviewList}>
              {GUEST_PREVIEW_ITEMS.map(item => (
                <View key={item.icon} style={styles.guestPreviewRow}>
                  <MaterialIcons name={item.icon} size={20} color={colors.gray[400]} />
                  <Text style={styles.guestPreviewText}>{item.label}</Text>
                </View>
              ))}
            </View>
            <Button
              title="ログインして始める"
              variant="primary"
              testID="gallery-login-cta"
              onPress={() => navigation.navigate('Login')}
              style={styles.guestCta}
            />
          </View>
        ) : isLoading && !isPreview ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator
              size="large"
              color={colors.primary[500]}
              testID="loading-indicator"
            />
          </View>
        ) : viewMode === 'flip' ? (
          <GoshuinchoFlipView
            stamps={displayStamps}
            resolveImageUrl={isPreview ? previewImageUrl : undefined}
            onPressStamp={setSelectedImageIndex}
            onPressBlank={() => navigation.navigate('Record', { origin: 'gallery' })}
          />
        ) : displayStamps.length === 0 ? (
          <View style={styles.centerContainer} testID="empty-state">
            <MaterialIcons name="photo-library" size={48} color={colors.gray[400]} />
            <Text style={styles.emptyText}>御朱印がまだありません</Text>
            <Text style={styles.emptySubText}>御朱印を記録して、コレクションを始めましょう</Text>
            {/* めくり表示は白紙ページが記録の入口になるが、グリッドには入口が無い（監査 A-10） */}
            <Button
              title="御朱印を記録する"
              variant="primary"
              testID="gallery-record-cta"
              onPress={() => navigation.navigate('Record', { origin: 'gallery' })}
              style={styles.emptyCta}
            />
          </View>
        ) : (
          <FlatList
            data={displayStamps}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            numColumns={NUM_COLUMNS}
            key={sortOrder}
            contentContainerStyle={styles.listContent}
            testID="gallery-list"
          />
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
              initialImageUrl={getStampImageUrl(currentStamp.image_path)}
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
        onClose={closeStamp}
        images={galleryImages}
        initialIndex={selectedImageIndex ?? 0}
        onEdit={handleEdit}
        onDelete={handleDeletePress}
        onIndexChange={setViewingIndex}
        useModal={false}
      />

      {hero.flight && (
        <HeroFlyer
          key={`${hero.flight.stampId}-${hero.flight.direction}`}
          imageUrl={hero.flight.imageUrl}
          imageAspect={hero.flight.imageAspect}
          sourceRect={hero.flight.sourceRect}
          sourceTextRect={hero.flight.sourceTextRect}
          spotName={hero.flight.spotName}
          visitedAt={hero.flight.visitedAt}
          direction={hero.flight.direction}
          onDone={handleFlightDone}
        />
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  guestPreviewList: {
    marginTop: spacing.xl,
    alignSelf: 'center',
  },
  guestPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  guestPreviewText: {
    ...typography.bodySmall,
    color: colors.gray[500],
    marginLeft: spacing.sm,
  },
  guestCta: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  emptyCta: {
    marginTop: spacing.lg,
  },
});
