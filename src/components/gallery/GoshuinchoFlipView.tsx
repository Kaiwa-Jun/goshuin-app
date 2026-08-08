import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Animated,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type FlatListProps,
} from 'react-native';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';
import { getStampImageUrl } from '@services/stamps';
import { GoshuinchoPage } from '@components/gallery/GoshuinchoPage';
import type { StampWithSpot } from '@/types/supabase';

/** 画面幅に対するページ幅。残りが左右の「覗き」になる */
export const PAGE_WIDTH_RATIO = 0.68;

/**
 * ページ間の余白。
 *
 * 実物の御朱印帳は1枚ずつ独立した紙ではなく、地続きの紙が蛇腹に折られている。
 * 隙間を入れるとカードが並んでいるように見えてしまうので 0 にし、
 * 隣り合うページは折り目で接した状態にする。
 */
export const PAGE_GAP = 0;

/** 中央から1ページ離れたページが奥へ倒れる角度 */
export const FOLD_ANGLE_DEG = 48;

/** 折れて奥を向いたページに乗る影の濃さ */
export const FOLD_SHADE_OPACITY = 0.16;

/**
 * 折れたページが縮んで見える分を平行移動で詰め、折り目で隣と接したままにする。
 * 幅 w のページを中心まわりに θ 傾けると投影幅は w·cosθ になり、
 * 内側の辺が (w/2)(1 - cosθ) だけ中央から離れてしまう。
 */
export function computeFoldShift(pageWidth: number, angleDeg = FOLD_ANGLE_DEG): number {
  const rad = (angleDeg * Math.PI) / 180;
  return (pageWidth / 2) * (1 - Math.cos(rad));
}

/** 遠近の強さ。小さいほど折れが誇張される */
const PERSPECTIVE = 900;

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

// Animated.FlatList の型は総称を保てないので、ここで Page 版として与え直す
const AnimatedFlatList = Animated.FlatList as unknown as React.ComponentType<
  FlatListProps<Page> & { ref?: React.Ref<FlatList<Page>> }
>;

export function GoshuinchoFlipView({
  stamps,
  onPressStamp,
  onPressBlank,
  resolveImageUrl,
}: GoshuinchoFlipViewProps) {
  const { width } = useWindowDimensions();
  const layout = useMemo(() => computePageLayout(width || Dimensions.get('window').width), [width]);

  const listRef = useRef<FlatList<Page>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
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

      // 前後1ページ分のスクロール量に対して折れ角と影を連続で動かす。
      // これで「カードが横に流れる」ではなく「蛇腹が畳まれていく」動きになる。
      const inputRange = [
        (index - 1) * layout.snapInterval,
        index * layout.snapInterval,
        (index + 1) * layout.snapInterval,
      ];
      const rotateY = scrollX.interpolate({
        inputRange,
        // 折り目（中央側の辺）を軸に、外側の辺が奥へ倒れる向き
        outputRange: [`${FOLD_ANGLE_DEG}deg`, '0deg', `-${FOLD_ANGLE_DEG}deg`],
        extrapolate: 'clamp',
      });
      const shadeOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [FOLD_SHADE_OPACITY, 0, FOLD_SHADE_OPACITY],
        extrapolate: 'clamp',
      });
      const shift = computeFoldShift(layout.pageWidth);
      const translateX = scrollX.interpolate({
        inputRange,
        // inverted なので、data 上の「次のページ」は画面では左に来る。
        // 折れて縮んだ分を中央側へ寄せて、折り目で接したままにする
        outputRange: [shift, 0, -shift],
        extrapolate: 'clamp',
      });

      // 中央のページが必ず手前に来るようにする。折れただけでは描画順が変わらず、
      // 隣のページが中央に被ってしまう
      const depth = Math.abs(index - currentIndex);

      return (
        <Animated.View
          style={[
            styles.foldWrapper,
            { zIndex: pages.length - depth },
            { transform: [{ perspective: PERSPECTIVE }, { translateX }, { rotateY }] },
          ]}
        >
          {item.kind === 'blank' ? (
            <GoshuinchoPage
              variant="blank"
              width={layout.pageWidth}
              isCurrent={isCurrent}
              onPress={onPress}
            />
          ) : (
            <GoshuinchoPage
              variant="stamp"
              width={layout.pageWidth}
              isCurrent={isCurrent}
              onPress={onPress}
              stampId={item.stamp.id}
              imageUrl={
                resolveImageUrl
                  ? resolveImageUrl(item.stamp)
                  : getStampImageUrl(item.stamp.image_path)
              }
              spotName={item.stamp.spots.name}
              visitedAt={item.stamp.visited_at}
            />
          )}
          <Animated.View
            pointerEvents="none"
            style={[styles.foldShade, { opacity: shadeOpacity }]}
          />
        </Animated.View>
      );
    },
    [
      currentIndex,
      handlePressPage,
      layout.pageWidth,
      layout.snapInterval,
      pages.length,
      resolveImageUrl,
      scrollX,
    ]
  );

  const counterLabel =
    pages[currentIndex]?.kind === 'blank'
      ? `${pages.length}枚目`
      : `${currentIndex + 1} ／ ${stamps.length}`;

  return (
    <View style={styles.container} testID="flip-view">
      <AnimatedFlatList
        ref={listRef}
        testID="flip-list"
        horizontal
        // 御朱印帳は右綴じ。1ページ目（最も古い御朱印）が右端に来て、
        // 新しいページほど左に足されていく。inverted なら data の並び
        // （昇順 + 末尾に白紙）とページ番号の計算をそのまま使える
        inverted
        data={pages}
        keyExtractor={page => page.key}
        renderItem={renderItem}
        snapToInterval={layout.snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: layout.sidePadding }]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
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
  foldWrapper: {
    // 折り目で隣のページと接するので、ここに余白を入れない
    justifyContent: 'center',
  },
  foldShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.gray[900],
  },
  counter: {
    ...typography.caption,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.lg,
    // 下端に置く要素はタブバーに寄りすぎる（Issue #114 の W-3 と同じ罠）
    marginBottom: spacing.lg,
  },
});
