import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  LayoutChangeEvent,
  PanResponder,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

import { SpotSheetHeader } from './SpotSheetHeader';
import { SpotSheetActions } from './SpotSheetActions';
import { SpotThumbnailStrip } from './SpotThumbnailStrip';
import { SpotDetailContent } from './SpotDetailContent';
import { SpotInfoSection } from './SpotInfoSection';
import { LimitedGoshuinSection } from './LimitedGoshuinSection';
import { useSpotDetail } from '@hooks/useSpotDetail';
import { useSpotStamps } from '@hooks/useSpotStamps';
import { useSpotInfo } from '@hooks/useSpotInfo';
import { useAuth } from '@hooks/useAuth';
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

export const COMPACT_MIN_HEIGHT = 176;
export const COMPACT_MAX_HEIGHT = 380;
/** レイアウト計測が終わるまでの初期値 */
export const COMPACT_FALLBACK_HEIGHT = 240;

/**
 * 実測した中身の高さを compact の高さに丸める。
 * 上限を画面の半分に抑えているのは、小型端末で compact が地図を覆わないようにするため。
 */
export function resolveCompactHeight(contentHeight: number, screenHeight: number): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return COMPACT_FALLBACK_HEIGHT;
  const upper = Math.min(COMPACT_MAX_HEIGHT, Math.round(screenHeight * 0.5));
  const lower = Math.min(COMPACT_MIN_HEIGHT, upper);
  return Math.min(Math.max(Math.round(contentHeight), lower), upper);
}

type SheetMode = 'hidden' | 'compact' | 'expanded';

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
  const { stamps, visitCount, latestVisitDate, publicStamps } = useSpotStamps(spotId ?? '');
  const { spotInfo } = useSpotInfo(spotId ?? '');
  const { isAuthenticated } = useAuth();

  const [mode, setMode] = useState<SheetMode>('hidden');
  const [compactHeight, setCompactHeight] = useState(COMPACT_FALLBACK_HEIGHT);
  const galleryOpenRef = useRef(false);
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

  const handlePrimaryLayout = useCallback((event: LayoutChangeEvent) => {
    if (modeRef.current === 'expanded') return;
    const measured = resolveCompactHeight(
      event.nativeEvent.layout.height,
      availableHeightRef.current
    );
    setCompactHeight(previous => (previous === measured ? previous : measured));
  }, []);

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

  const handleGalleryVisibleChange = useCallback((visible: boolean) => {
    galleryOpenRef.current = visible;
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

  return (
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
      {/* 両モードで常に出す部分。展開しても内容が差し替わらない */}
      <View style={styles.primary} onLayout={handlePrimaryLayout} testID="spot-sheet-primary">
        <TouchableOpacity
          style={styles.handleContainer}
          onPress={toggleMode}
          activeOpacity={0.7}
          testID="sheet-handle"
        >
          <View style={styles.handle} />
        </TouchableOpacity>

        <SpotSheetHeader spot={spot} isVisited={isVisited} isWishlisted={isWishlisted} />

        {spotInfo && <SpotInfoSection spotInfo={spotInfo} />}

        {/* compact でだけ出す要約。展開時は下の詳細が同等以上を描画する */}
        {!isExpanded && (
          <>
            {spotInfo && <LimitedGoshuinSection info={spotInfo.limitedGoshuin} variant="compact" />}
            <SpotThumbnailStrip stamps={stamps} publicStamps={publicStamps} onPress={toggleMode} />
          </>
        )}

        <SpotSheetActions
          isWishlisted={isWishlisted}
          onWishlistPress={onWishlistToggle ? handleWishlistPress : undefined}
          onRecordPress={handleRecord}
        />
      </View>

      {/* 展開時に下へ足される情報 */}
      {isExpanded && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          <SpotDetailContent
            variant="sheet"
            spot={spot}
            stamps={stamps}
            visitCount={visitCount}
            latestVisitDate={latestVisitDate}
            isAuthenticated={isAuthenticated}
            onRecord={handleRecord}
            showMiniMap={false}
            isWishlisted={isWishlisted}
            onWishlistPress={onWishlistToggle ? handleWishlistPress : undefined}
            publicStamps={publicStamps}
            spotInfo={spotInfo ?? undefined}
            onGalleryVisibleChange={handleGalleryVisibleChange}
          />
        </ScrollView>
      )}
    </Animated.View>
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
  primary: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
  },
});
