import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';
import { getStampImageUrl } from '@services/stamps';
import { GoshuinchoPage } from '@components/gallery/GoshuinchoPage';
import type { StampWithSpot } from '@/types/supabase';

/** 画面幅に対するページ幅。残りが左右の「覗き」になる */
export const PAGE_WIDTH_RATIO = 0.68;

/** ページ間の余白 */
export const PAGE_GAP = spacing.md;

export interface PageLayout {
  pageWidth: number;
  sidePadding: number;
  snapInterval: number;
}

export function computePageLayout(screenWidth: number): PageLayout {
  const pageWidth = Math.round(screenWidth * PAGE_WIDTH_RATIO);
  return {
    pageWidth,
    sidePadding: Math.round((screenWidth - pageWidth) / 2),
    snapInterval: pageWidth + PAGE_GAP,
  };
}

type Page =
  | { key: string; kind: 'stamp'; stamp: StampWithSpot; sourceIndex: number }
  | { key: 'blank'; kind: 'blank' };

interface GoshuinchoFlipViewProps {
  /** useGalleryStamps と同じ visited_at 降順。表示時に昇順へ反転する */
  stamps: StampWithSpot[];
  /** 押されたページの、元の stamps 配列でのインデックスを渡す */
  onPressStamp: (sourceIndex: number) => void;
  onPressBlank: () => void;
  /** 省略時は getStampImageUrl。web プレビューが data URI を差し込むために使う */
  resolveImageUrl?: (stamp: StampWithSpot) => string;
}

export function GoshuinchoFlipView({
  stamps,
  onPressStamp,
  onPressBlank,
  resolveImageUrl,
}: GoshuinchoFlipViewProps) {
  const { width } = useWindowDimensions();
  const layout = useMemo(() => computePageLayout(width || Dimensions.get('window').width), [width]);

  const listRef = useRef<FlatList<Page>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 御朱印帳は古い順に綴じていくので、表示だけ昇順に反転する。
  // 親に返すのは常に元の（降順の）インデックス。
  const pages: Page[] = useMemo(() => {
    const ascending: Page[] = stamps
      .map((stamp, sourceIndex) => ({
        key: stamp.id,
        kind: 'stamp' as const,
        stamp,
        sourceIndex,
      }))
      .reverse();
    return [...ascending, { key: 'blank', kind: 'blank' }];
  }, [stamps]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / layout.snapInterval);
      setCurrentIndex(Math.max(0, Math.min(index, pages.length - 1)));
    },
    [layout.snapInterval, pages.length]
  );

  const goToPage = useCallback((index: number) => {
    setCurrentIndex(index);
    listRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const handlePressPage = useCallback(
    (page: Page, index: number) => {
      // 覗いている隣のページは「送る」だけ。誤って全画面や記録画面に飛ばさない
      if (index !== currentIndex) {
        goToPage(index);
        return;
      }
      if (page.kind === 'blank') {
        onPressBlank();
      } else {
        onPressStamp(page.sourceIndex);
      }
    },
    [currentIndex, goToPage, onPressBlank, onPressStamp]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Page; index: number }) => {
      const isCurrent = index === currentIndex;
      const onPress = () => handlePressPage(item, index);

      if (item.kind === 'blank') {
        return (
          <GoshuinchoPage
            variant="blank"
            width={layout.pageWidth}
            isCurrent={isCurrent}
            onPress={onPress}
          />
        );
      }

      return (
        <GoshuinchoPage
          variant="stamp"
          width={layout.pageWidth}
          isCurrent={isCurrent}
          onPress={onPress}
          stampId={item.stamp.id}
          imageUrl={
            resolveImageUrl ? resolveImageUrl(item.stamp) : getStampImageUrl(item.stamp.image_path)
          }
          spotName={item.stamp.spots.name}
          visitedAt={item.stamp.visited_at}
        />
      );
    },
    [currentIndex, handlePressPage, layout.pageWidth, resolveImageUrl]
  );

  const counterLabel =
    pages[currentIndex]?.kind === 'blank'
      ? `${pages.length}枚目`
      : `${currentIndex + 1} ／ ${stamps.length}`;

  return (
    <View style={styles.container} testID="flip-view">
      <FlatList
        ref={listRef}
        testID="flip-list"
        horizontal
        data={pages}
        keyExtractor={page => page.key}
        renderItem={renderItem}
        snapToInterval={layout.snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: layout.sidePadding }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: layout.snapInterval,
          offset: layout.snapInterval * index,
          index,
        })}
      />
      <Text style={styles.counter} testID="flip-page-counter">
        {counterLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  listContent: {
    alignItems: 'center',
  },
  separator: {
    width: PAGE_GAP,
  },
  counter: {
    ...typography.caption,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
