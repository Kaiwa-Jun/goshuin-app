import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
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
import { getStampImageUrl, getStampViewUrl } from '@services/stamps';
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
  /**
   * 省略時は getStampViewUrl（R2 の 1200 の変換）で、出せなければ getStampImageUrl（元の写真）に
   * 落とす（Issue #227 S4a-2）。web プレビューが data URI を差し込むために使う（落とす先は無い）
   */
  resolveImageUrl?: (stamp: StampWithSpot) => string;
  /** ページの写真が元の写真に落ちたとき。飛ぶ1枚を出ている URL に合わせるために使う */
  onImageFallback?: (stampId: string) => void;
  /**
   * ページの写真が元の写真ではない方で読めたとき。一時の失敗で落ちたページが、外れて
   * 付け直されたら読めた、を画面に返す（落ちた控えを消す）
   */
  onPrimaryImageLoad?: (stampId: string) => void;
  /** 詳細へ連続的に繋ぐために、ページの位置を測れるようにする（Issue #202） */
  registerNode?: (stampId: string, part: 'image' | 'text', node: View | null) => void;
  /** 読み込んだ写真の実寸 */
  onImageLoad?: (stampId: string, width: number, height: number) => void;
  /** 飛んでいる最中の1枚。出したままだと同じ御朱印が二重に見える */
  hiddenStampId?: string | null;
  /** 視差効果を減らす。オンなら写真が届くまでの本は止まる（Issue #275） */
  reduceMotion?: boolean;
  /**
   * 開くページの御朱印（Issue #276）。**最初に開くときだけ**使う。
   * 見つからない・null なら最新で開く（今と同じ）
   */
  initialStampId?: string | null;
  /**
   * 出ているページが決まった・変わった（開いた・めくり終えた・覗いているページで送った）。
   * 白紙のページなら null（Issue #276）
   */
  onCurrentStampChange?: (stampId: string | null) => void;
  /**
   * 表示の切り替えの動き（Issue #276）。渡されている間、出ているページの紙が縮む・広がり、
   * 周り（ページの下の名前と日付・ほかのページ・`n ／ m`）が消える・出る
   */
  motion?: FlipViewMotion | null;
}

export interface FlipViewMotion {
  pageScale: Animated.AnimatedInterpolation<number>;
  surroundOpacity: Animated.AnimatedInterpolation<number>;
}

/**
 * 表示の切り替えで周りと一緒に消える・出るほかのページの遠さ。画面に出ているのは両隣までで、
 * 2つ離れたページはめくる途中で入ってくる。それより先は画面に出ないので値を付けない
 * （付けると、動きの値が変わるたびに描いている全部のページを描き直す。Issue #276 S6）
 */
const SURROUND_FADE_DEPTH = 2;

/**
 * 表示の切り替えの動きの間に描くページの範囲（画面の幅の何枚分か）。広いままだと、開いた直後に
 * 数十ページの本を描き足して、ページが広がる動きのコマが飛ぶ（Issue #276 S6）
 */
const WINDOW_SIZE_WHILE_MOTION = 3;

interface FlipPageItemProps {
  page: Page;
  index: number;
  /** 出ているページからの遠さ */
  depth: number;
  zIndex: number;
  pageWidth: number;
  snapInterval: number;
  scrollX: Animated.Value;
  onPressPage: (page: Page, index: number) => void;
  registerNode?: (stampId: string, part: 'image' | 'text', node: View | null) => void;
  onImageLoad?: (stampId: string, width: number, height: number) => void;
  /** 御朱印のページの写真の URL */
  imageUrl?: string;
  /** imageUrl が出せなかったときの元の写真（Issue #227 S4a-2） */
  fallbackUrl?: string;
  onImageFallback?: (stampId: string) => void;
  onPrimaryImageLoad?: (stampId: string) => void;
  hidden: boolean;
  reduceMotion: boolean;
  surfaceScale?: Animated.AnimatedInterpolation<number>;
  footerOpacity?: Animated.AnimatedInterpolation<number>;
  foldOpacity?: Animated.AnimatedInterpolation<number>;
}

/**
 * 蛇腹の1ページ。渡すものが変わらなければ描き直さない。表示の切り替えの動きの値が
 * 付くのは出ているページと近いページだけなので、ほかのページは描き直さずに済む
 */
const FlipPageItem = memo(function FlipPageItem({
  page,
  index,
  depth,
  zIndex,
  pageWidth,
  snapInterval,
  scrollX,
  onPressPage,
  registerNode,
  onImageLoad,
  imageUrl,
  fallbackUrl,
  onImageFallback,
  onPrimaryImageLoad,
  hidden,
  reduceMotion,
  surfaceScale,
  footerOpacity,
  foldOpacity,
}: FlipPageItemProps) {
  const isCurrent = depth === 0;
  const onPress = () => onPressPage(page, index);

  // 前後1ページ分のスクロール量に対して折れ角と影を連続で動かす。
  // これで「カードが横に流れる」ではなく「蛇腹が畳まれていく」動きになる。
  const { rotateY, shadeOpacity, translateX } = useMemo(() => {
    const inputRange = [
      (index - 1) * snapInterval,
      index * snapInterval,
      (index + 1) * snapInterval,
    ];
    const shift = computeFoldShift(pageWidth);
    return {
      rotateY: scrollX.interpolate({
        inputRange,
        // 折り目（中央側の辺）を軸に、外側の辺が奥へ倒れる向き
        outputRange: [`${FOLD_ANGLE_DEG}deg`, '0deg', `-${FOLD_ANGLE_DEG}deg`],
        extrapolate: 'clamp',
      }),
      shadeOpacity: scrollX.interpolate({
        inputRange,
        outputRange: [FOLD_SHADE_OPACITY, 0, FOLD_SHADE_OPACITY],
        extrapolate: 'clamp',
      }),
      translateX: scrollX.interpolate({
        inputRange,
        // inverted なので、data 上の「次のページ」は画面では左に来る。
        // 折れて縮んだ分を中央側へ寄せて、折り目で接したままにする
        outputRange: [shift, 0, -shift],
        extrapolate: 'clamp',
      }),
    };
  }, [index, pageWidth, scrollX, snapInterval]);

  /*
   * 写真が届くまでの本（Issue #275）。動かすのは画面に出ているページと両隣だけ。
   * 2つ離れたページはめくる途中で入ってくるので止まった本、それより先は画面に
   * 出ないので本を描かない（開いた直後に FlatList が描く数十ページぶんの本を作らない）
   */
  const loadingBook = depth <= 1 ? 'flip' : depth === 2 ? 'still' : 'none';

  return (
    <Animated.View
      testID={`flip-fold-${page.key}`}
      style={[
        styles.foldWrapper,
        // 中央のページが必ず手前に来るようにする。折れただけでは描画順が変わらず、
        // 隣のページが中央に被ってしまう
        { zIndex },
        { transform: [{ perspective: PERSPECTIVE }, { translateX }, { rotateY }] },
        foldOpacity && { opacity: foldOpacity },
      ]}
    >
      {page.kind === 'blank' ? (
        <GoshuinchoPage
          variant="blank"
          width={pageWidth}
          isCurrent={isCurrent}
          onPress={onPress}
          surfaceScale={surfaceScale}
        />
      ) : (
        <GoshuinchoPage
          variant="stamp"
          width={pageWidth}
          isCurrent={isCurrent}
          onPress={onPress}
          stampId={page.stamp.id}
          registerNode={(part, node) => registerNode?.(page.stamp.id, part, node)}
          onImageLoad={(w, h) => onImageLoad?.(page.stamp.id, w, h)}
          hidden={hidden}
          loadingBook={loadingBook}
          reduceMotion={reduceMotion}
          imageUrl={imageUrl ?? ''}
          fallbackUrl={fallbackUrl}
          onImageFallback={() => onImageFallback?.(page.stamp.id)}
          onPrimaryImageLoad={() => onPrimaryImageLoad?.(page.stamp.id)}
          spotName={page.stamp.spots.name}
          visitedAt={page.stamp.visited_at}
          surfaceScale={surfaceScale}
          footerOpacity={footerOpacity}
        />
      )}
      <Animated.View pointerEvents="none" style={[styles.foldShade, { opacity: shadeOpacity }]} />
    </Animated.View>
  );
});

// Animated.FlatList の型は総称を保てないので、ここで Page 版として与え直す
const AnimatedFlatList = Animated.FlatList as unknown as React.ComponentType<
  FlatListProps<Page> & { ref?: React.Ref<FlatList<Page>> }
>;

/**
 * 渡すものが変わらなければ描き直さない（画面は表示の切り替えの動きの間にも描き直すので。
 * Issue #276 S6）
 */
export const GoshuinchoFlipView = memo(function GoshuinchoFlipView({
  stamps,
  onPressStamp,
  onPressBlank,
  resolveImageUrl,
  onImageFallback,
  onPrimaryImageLoad,
  registerNode,
  onImageLoad,
  hiddenStampId,
  reduceMotion = false,
  initialStampId = null,
  onCurrentStampChange,
  motion = null,
}: GoshuinchoFlipViewProps) {
  const { width } = useWindowDimensions();
  const layout = useMemo(() => computePageLayout(width || Dimensions.get('window').width), [width]);

  const listRef = useRef<FlatList<Page>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  /*
   * 開くページを指定されたら、最初の描画からそのページのあたりを描く（Issue #276）。
   * 0 から描いてめくり直しを待つと、離れたページ（65枚の 43 ページ目など）が描かれるまでに
   * 表示を切り替える動きの準備が間に合わない。指定が無いときは今と同じく 0 から描く
   */
  const [requestedIndex] = useState<number | undefined>(() => {
    const index = initialStampId ? stamps.findIndex(s => s.id === initialStampId) : -1;
    return index > 0 ? index : undefined;
  });
  const [currentIndex, setCurrentIndex] = useState(requestedIndex ?? 0);

  // stamps は昇順（古い順）で渡ってくる。1ページ目 = 先頭 = 最も古い。
  // 末尾の白紙が一番新しい側（＝記録の入口）になる。
  const pages: Page[] = useMemo(() => {
    const ascending: Page[] = stamps.map((stamp, sourceIndex) => ({
      key: stamp.id,
      kind: 'stamp' as const,
      stamp,
      sourceIndex,
    }));
    return [...ascending, { key: 'blank', kind: 'blank' }];
  }, [stamps]);

  /*
   * 出ているページを知らせる（Issue #276）。知らせる先は描くたびに作り直されうるので、
   * 最新を控えておき、知らせる処理の依存に入れない
   */
  const onCurrentStampChangeRef = useRef(onCurrentStampChange);
  useEffect(() => {
    onCurrentStampChangeRef.current = onCurrentStampChange;
  }, [onCurrentStampChange]);
  const notifyCurrent = useCallback(
    (index: number) => {
      const page = pages[index];
      onCurrentStampChangeRef.current?.(page?.kind === 'stamp' ? page.stamp.id : null);
    },
    [pages]
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = Math.round(event.nativeEvent.contentOffset.x / layout.snapInterval);
      const index = Math.max(0, Math.min(raw, pages.length - 1));
      setCurrentIndex(index);
      notifyCurrent(index);
    },
    [layout.snapInterval, pages.length, notifyCurrent]
  );

  /*
   * **最後に書いてもらったページから開く**。
   *
   * 綴じる順（古い→新しい）は実物の御朱印帳どおりで変えない。変えるのは
   * 開く場所だけ。人に見せるとき1ページ目からめくる人はいないし、
   * 「最近の参拝」から来た人を本の一番遠い端に降ろすことになる。
   *
   * 末尾の白紙（記録の入口）ではなく、その1つ手前＝最後の御朱印を出す。
   *
   * **最初の1回だけ**。御朱印帳は画面に戻るたびに取り直すので、毎回
   * 飛ばすと、途中まで見て他のタブへ行って戻った人の位置が失われる。
   *
   * 表示の切り替えボタンで一覧から戻ったときは、めくる表示で見ていたページで開く
   * （initialStampId。Issue #276）
   */
  const openedAtLatest = useRef(false);
  useEffect(() => {
    if (openedAtLatest.current || stamps.length === 0) return;
    openedAtLatest.current = true;

    const requested = initialStampId ? stamps.findIndex(s => s.id === initialStampId) : -1;
    const lastStamp = requested >= 0 ? requested : stamps.length - 1;
    setCurrentIndex(lastStamp);
    notifyCurrent(lastStamp);
    listRef.current?.scrollToIndex({ index: lastStamp, animated: false });
    /*
     * 折れ角は scrollX から引いている。飛ばしただけだと scrollX が 0 の
     * ままになることがあり、**開いたページが折れたまま（斜めに）描かれる**。
     * 飛ばした先を scrollX にも教える。
     * このあと onScroll が届けばそれで上書きされるので、二重でも困らない
     */
    scrollX.setValue(lastStamp * layout.snapInterval);
  }, [stamps, initialStampId, layout.snapInterval, scrollX, notifyCurrent]);

  const goToPage = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      notifyCurrent(index);
      listRef.current?.scrollToIndex({ index, animated: true });
    },
    [notifyCurrent]
  );

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
      const depth = Math.abs(index - currentIndex);
      const isCurrent = depth === 0;
      /*
       * 表示の切り替えの動き（Issue #276）。出ているページは紙が縮む・広がり、
       * ほかのページは折りの包みごと消える・出る
       */
      return (
        <FlipPageItem
          page={item}
          index={index}
          depth={depth}
          zIndex={pages.length - depth}
          pageWidth={layout.pageWidth}
          snapInterval={layout.snapInterval}
          scrollX={scrollX}
          onPressPage={handlePressPage}
          registerNode={registerNode}
          onImageLoad={onImageLoad}
          imageUrl={
            item.kind === 'blank'
              ? undefined
              : resolveImageUrl
                ? resolveImageUrl(item.stamp)
                : getStampViewUrl(item.stamp.image_path)
          }
          fallbackUrl={
            item.kind === 'blank' || resolveImageUrl
              ? undefined
              : getStampImageUrl(item.stamp.image_path)
          }
          onImageFallback={onImageFallback}
          onPrimaryImageLoad={onPrimaryImageLoad}
          hidden={item.kind === 'stamp' && hiddenStampId === item.stamp.id}
          reduceMotion={reduceMotion}
          surfaceScale={motion && isCurrent ? motion.pageScale : undefined}
          footerOpacity={motion && isCurrent ? motion.surroundOpacity : undefined}
          foldOpacity={
            motion && !isCurrent && depth <= SURROUND_FADE_DEPTH
              ? motion.surroundOpacity
              : undefined
          }
        />
      );
    },
    [
      currentIndex,
      handlePressPage,
      hiddenStampId,
      layout.pageWidth,
      layout.snapInterval,
      motion,
      onImageFallback,
      onImageLoad,
      onPrimaryImageLoad,
      pages.length,
      reduceMotion,
      registerNode,
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
        initialScrollIndex={requestedIndex}
        initialNumToRender={requestedIndex === undefined ? undefined : 3}
        windowSize={motion ? WINDOW_SIZE_WHILE_MOTION : undefined}
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
      <Animated.Text
        style={[styles.counter, motion && { opacity: motion.surroundOpacity }]}
        testID="flip-page-counter"
      >
        {counterLabel}
      </Animated.Text>
    </View>
  );
});

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
