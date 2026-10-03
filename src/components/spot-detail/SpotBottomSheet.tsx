import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  LayoutAnimation,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

import { SpotSheetHeader } from './SpotSheetHeader';
import { SpotSheetActions } from './SpotSheetActions';
import { SpotThumbnailStrip, buildSpotGalleryImages } from './SpotThumbnailStrip';
import { SpotInfoSection } from './SpotInfoSection';
import { LimitedGoshuinSection } from './LimitedGoshuinSection';
import { SpotTsukimairi } from './SpotTsukimairi';
import { ImageGalleryModal } from '@components/common/ImageGalleryModal';
import { useSpotDetail } from '@hooks/useSpotDetail';
import { useSpotStamps } from '@hooks/useSpotStamps';
import { useSpotInfo } from '@hooks/useSpotInfo';
import { colors } from '@theme/colors';
import { borderRadius, spacing } from '@theme/spacing';
import { shadows } from '@theme/shadows';

interface SpotBottomSheetProps {
  spotId: string | null;
  visitedSpotIds: Set<string>;
  onDismiss: () => void;
  onRecord: (spotId: string) => void;
  wishlistSpotIds?: Set<string>;
  onWishlistToggle?: (spotId: string) => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

// 限定御朱印の中身が伸びる動き（LayoutAnimation）を Android でも効かせる
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const COMPACT_MIN_HEIGHT = 176;
export const COMPACT_MAX_HEIGHT = 380;
/** レイアウト計測が終わるまでの初期値 */
export const COMPACT_FALLBACK_HEIGHT = 240;

/** compact の高さの上限（画面に対する割合）。ボタンのフッターを含めるので 0.5 から上げた（Issue #253） */
export const COMPACT_SCREEN_RATIO = 0.6;

/**
 * 実測した中身の高さを compact の高さに丸める。
 * 上限を画面の 6 割に抑えているのは、小型端末で compact が地図を覆わないようにするため。
 */
export function resolveCompactHeight(contentHeight: number, screenHeight: number): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return COMPACT_FALLBACK_HEIGHT;
  const upper = Math.min(COMPACT_MAX_HEIGHT, Math.round(screenHeight * COMPACT_SCREEN_RATIO));
  const lower = Math.min(COMPACT_MIN_HEIGHT, upper);
  return Math.min(Math.max(Math.round(contentHeight), lower), upper);
}

/** compact の高さ = ハンドル + 限定御朱印の見出しまでの中身 + ボタンのフッター（未計測は 0） */
export function sumCompactParts(parts: {
  handle: number;
  primary: number;
  footer: number;
}): number {
  return parts.handle + parts.primary + parts.footer;
}

type SheetMode = 'hidden' | 'compact' | 'expanded';

/** 開閉のときに、限定御朱印の中身が見出しの下で伸びる（縮む）ように */
function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export function SpotBottomSheet({
  spotId,
  visitedSpotIds,
  onDismiss,
  onRecord,
  wishlistSpotIds,
  onWishlistToggle,
}: SpotBottomSheetProps) {
  const insets = useSafeAreaInsets();
  // シートの親はタブバーを除いた領域なので、ウィンドウ高だけで位置を決めると
  // 下端がタブバーの裏に潜り込み、アクション行のタップがタブに奪われる。
  // タブバーの高さは下部セーフエリアを含むため、両方を引くと二重に差し引かれる。
  // タブナビゲーターの外で使われたときは undefined が返るので、その場合だけ
  // セーフエリアを使う。
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const bottomOffset = tabBarHeight ?? insets.bottom;
  const availableHeight = SCREEN_HEIGHT - bottomOffset;
  const expandedHeight = availableHeight * 0.85;
  const { spot } = useSpotDetail(spotId ?? '');
  const { stamps, publicStamps } = useSpotStamps(spotId ?? '');
  const { spotInfo } = useSpotInfo(spotId ?? '');

  const [mode, setMode] = useState<SheetMode>('hidden');
  const [compactHeight, setCompactHeight] = useState(COMPACT_FALLBACK_HEIGHT);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const galleryOpenRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  // compact の高さを作る3つの部品の実測値
  const parts = useRef({ handle: 0, primary: 0, footer: 0 });
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const compactPosition = availableHeight - compactHeight;
  const expandedPosition = availableHeight - expandedHeight;

  // Keep mutable refs so PanResponder always reads latest values
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const compactPosRef = useRef(compactPosition);
  compactPosRef.current = compactPosition;
  const expandedPosRef = useRef(expandedPosition);
  expandedPosRef.current = expandedPosition;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const animateTo = useCallback(
    (toValue: number, callback?: () => void) => {
      Animated.spring(translateY, {
        toValue,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(callback);
    },
    [translateY]
  );

  const animateToRef = useRef(animateTo);
  animateToRef.current = animateTo;

  /**
   * compact の中身の高さを実測する。expanded では compact 専用の要素が描画されず
   * 不当に縮んだ値を拾ってしまうため、そのときは採用しない。
   */
  const availableHeightRef = useRef(availableHeight);
  availableHeightRef.current = availableHeight;

  const remeasure = useCallback(() => {
    const measured = resolveCompactHeight(
      sumCompactParts(parts.current),
      availableHeightRef.current
    );
    setCompactHeight(previous => (previous === measured ? previous : measured));
  }, []);

  // 見出しまでの中身。expanded では限定御朱印の中身が開いて伸びるので、その値は採らない
  const handlePrimaryLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (modeRef.current === 'expanded') return;
      parts.current.primary = event.nativeEvent.layout.height;
      remeasure();
    },
    [remeasure]
  );
  const handleHandleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      parts.current.handle = event.nativeEvent.layout.height;
      remeasure();
    },
    [remeasure]
  );
  const handleFooterLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const h = event.nativeEvent.layout.height;
      parts.current.footer = h;
      setFooterHeight(previous => (previous === h ? previous : h));
      remeasure();
    },
    [remeasure]
  );

  // 開閉。compactPosition に依存させると、計測のたびに expanded から引き戻される
  useEffect(() => {
    if (spotId && spot) {
      setMode('compact');
      animateToRef.current(availableHeightRef.current - COMPACT_FALLBACK_HEIGHT);
    } else {
      animateToRef.current(SCREEN_HEIGHT, () => {
        setMode('hidden');
      });
    }
  }, [spotId, spot]);

  // 計測で高さが変わったときの再配置。compact のときだけ動かす
  useEffect(() => {
    if (mode === 'compact') {
      animateToRef.current(compactPosition);
    }
  }, [compactPosition, mode]);

  // compact に戻したら中身を先頭へ（見出しまでが見える状態に戻す）
  useEffect(() => {
    if (mode === 'compact') scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [mode]);

  // ボタンのフッターは、シートが compact の位置より上にいる間は画面の下端に留まり、
  // それより下へ（閉じる・開き始め）はシートと一緒に動く
  const footerTranslateY = useMemo(
    () =>
      translateY.interpolate({
        inputRange: [compactPosition, compactPosition + 1],
        outputRange: [0, 1],
        extrapolateLeft: 'clamp',
      }),
    [translateY, compactPosition]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (galleryOpenRef.current) return false;
          // Only capture vertical drags
          return (
            Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
          );
        },
        onPanResponderMove: (_, gestureState) => {
          const currentPos =
            modeRef.current === 'expanded' ? expandedPosRef.current : compactPosRef.current;
          const newY = currentPos + gestureState.dy;
          const clampedY = Math.max(expandedPosRef.current, newY);
          translateY.setValue(clampedY);
        },
        onPanResponderRelease: (_, gestureState) => {
          const { dy, vy } = gestureState;
          const animate = animateToRef.current;

          if (modeRef.current === 'compact') {
            if (dy < -40 || vy < -0.3) {
              animateLayout();
              setMode('expanded');
              animate(expandedPosRef.current);
            } else if (dy > 40 || vy > 0.3) {
              animate(SCREEN_HEIGHT, () => {
                setMode('hidden');
                onDismissRef.current();
              });
            } else {
              animate(compactPosRef.current);
            }
          } else if (modeRef.current === 'expanded') {
            if (dy > 80 || vy > 0.5) {
              animateLayout();
              setMode('compact');
              animate(compactPosRef.current);
            } else {
              animate(expandedPosRef.current);
            }
          }
        },
      }),
    [translateY]
  );

  const handleRecord = useCallback(() => {
    if (spotId) {
      onRecord(spotId);
    }
  }, [spotId, onRecord]);

  // 写真はシートを開かずにギャラリーで見る。開いている間はシートのドラッグを止める
  const galleryImages = useMemo(
    () => buildSpotGalleryImages(stamps, publicStamps),
    [stamps, publicStamps]
  );
  const openGallery = useCallback((index: number) => {
    galleryOpenRef.current = true;
    setGalleryIndex(index);
  }, []);
  const closeGallery = useCallback(() => {
    galleryOpenRef.current = false;
    setGalleryIndex(null);
  }, []);

  const isVisited = spotId ? visitedSpotIds.has(spotId) : false;
  const isWishlisted = spotId && wishlistSpotIds ? wishlistSpotIds.has(spotId) : false;

  const handleWishlistPress = useCallback(() => {
    if (spotId && onWishlistToggle) {
      onWishlistToggle(spotId);
    }
  }, [spotId, onWishlistToggle]);

  // ドラッグでしか展開できないとタップ手段が無く、Web での検証もできない
  const toggleMode = useCallback(() => {
    animateLayout();
    setMode(current => {
      const next = current === 'expanded' ? 'compact' : 'expanded';
      animateToRef.current(next === 'expanded' ? expandedPosRef.current : compactPosRef.current);
      return next;
    });
  }, []);

  if (!spotId || !spot) {
    return null;
  }

  const isExpanded = mode === 'expanded';
  // タブの中はタブバーがセーフエリアを持つ。タブの外では自分で下のセーフエリアを空ける
  const footerPaddingBottom = tabBarHeight != null ? spacing.md : spacing.md + insets.bottom;

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            height: expandedHeight,
            transform: [{ translateY }],
          },
        ]}
        testID="bottom-sheet"
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.handleContainer}
          onPress={toggleMode}
          onLayout={handleHandleLayout}
          activeOpacity={0.7}
          testID="sheet-handle"
        >
          <View style={styles.handle} />
        </TouchableOpacity>

        {/*
          閉じても開いても同じ木（Issue #253）。開くと限定御朱印の中身が見出しの下で伸び、
          その下に月参りが続くだけ。要素の入れ替え・出し入れはしない
        */}
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: footerHeight + spacing.lg },
          ]}
          scrollEnabled={isExpanded}
          showsVerticalScrollIndicator={isExpanded}
          scrollEventThrottle={16}
          testID="spot-sheet-scroll"
        >
          <View onLayout={handlePrimaryLayout} testID="spot-sheet-primary">
            <SpotSheetHeader spot={spot} isVisited={isVisited} isWishlisted={isWishlisted} />
            {spotInfo && <SpotInfoSection spotInfo={spotInfo} />}
            <SpotThumbnailStrip
              stamps={stamps}
              publicStamps={publicStamps}
              onPressThumbnail={openGallery}
            />
            {spotInfo && (
              <LimitedGoshuinSection
                info={spotInfo.limitedGoshuin}
                snsLinks={spotInfo.snsLinks}
                variant="sheet"
                expanded={isExpanded}
                onHeadingPress={toggleMode}
              />
            )}
          </View>
          <View style={styles.more}>
            <SpotTsukimairi stamps={stamps} />
          </View>
        </ScrollView>
      </Animated.View>

      {/* ボタンは画面の下端に固定。シートの外に置き、シートのドラッグでは動かない */}
      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: footerPaddingBottom, transform: [{ translateY: footerTranslateY }] },
        ]}
        onLayout={handleFooterLayout}
        testID="spot-sheet-footer"
      >
        <SpotSheetActions
          isWishlisted={isWishlisted}
          onWishlistPress={onWishlistToggle ? handleWishlistPress : undefined}
          onRecordPress={handleRecord}
          style={styles.footerActions}
        />
      </Animated.View>

      {galleryIndex !== null && (
        <ImageGalleryModal
          visible
          onClose={closeGallery}
          images={galleryImages}
          initialIndex={galleryIndex}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray[300],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  more: {
    marginTop: spacing.lg,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    // Android は重なりの順を elevation で決める。シート（shadows.lg = 5）より上に置かないと、
    // compact のときシートの箱の裏にボタンが回って押せなくなる
    elevation: 6,
  },
  footerActions: {
    marginTop: 0,
  },
});
