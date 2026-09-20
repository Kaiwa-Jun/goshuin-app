import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

export interface GalleryImage {
  id: string;
  imageUrl: string;
  userName?: string | null;
  /** 寺社の名前。一覧から飛んでくる文字の行き先になる（Issue #192） */
  spotName?: string | null;
  memo?: string | null;
  visitedAt?: string | null;
}

/**
 * 情報の行の置き場所。飛んでいる文字の行き先を合わせるため、
 * HeroFlyer から参照する（Issue #192）
 */
export const GALLERY_INFO_BOTTOM = spacing['5xl'];
export const GALLERY_INFO_LEFT = spacing.lg;

interface ImageGalleryModalProps {
  visible: boolean;
  onClose: () => void;
  images: GalleryImage[];
  initialIndex: number;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  /** When false, renders as absolute-positioned View instead of Modal to avoid native modal flicker. */
  useModal?: boolean;
  /** 横スワイプで見ている1枚が変わったとき。閉じるとき、その1枚のタイルへ戻すのに使う（#192） */
  onIndexChange?: (index: number) => void;
  /**
   * 今見ている1枚の写真が出せるようになったとき。
   * 一覧から飛んできた1枚を、いつ引っ込めてよいかの合図に使う（#192）
   */
  onImageReady?: (index: number) => void;
  /**
   * 横スワイプで隣の1枚へ移れるか。件数の表示もこれに従う。
   *
   * 御朱印帳は off。一覧のタイルと詳細が1対1で繋がる動きにしているので、
   * 途中で別の1枚に移ると、その結びつきが切れて元のタイルへ戻れなくなる。
   * 順に見る動線は蛇腹めくりが持っている（Issue #192）。
   * スポット詳細は on。あちらは1つのスポットの御朱印をまとめて見せる場で、
   * 連続遷移もしていない
   */
  swipeable?: boolean;
  /**
   * 下スワイプで写真が指についてくるか。閉じること自体はどちらでも起きる。
   *
   * 御朱印帳は off。指で写真を下へずらしてから離すと、そこから一覧へ戻る
   * 連続的な動きが始められない（写真がもう元の位置にいない）。
   * 写真は動かさず、離した時点で元の位置から戻す（Issue #192）
   */
  dismissFollowsFinger?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = SCREEN_HEIGHT * 0.2;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const VELOCITY_THRESHOLD = 0.5;
const TAP_MAX_DURATION = 200;
const TAP_MAX_DISTANCE = 10;
/** 今の1枚の前後いくつまで実際に描くか。横スワイプの先読みぶん */
const NEIGHBORS = 1;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export function ImageGalleryModal({
  visible,
  onClose,
  images,
  initialIndex,
  onEdit,
  onDelete,
  useModal = true,
  onIndexChange,
  onImageReady,
  swipeable = true,
  dismissFollowsFinger = true,
}: ImageGalleryModalProps) {
  // currentIndex is only used for info display (userName, memo, counter)
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;
  const onImageReadyRef = useRef(onImageReady);
  onImageReadyRef.current = onImageReady;
  const swipeableRef = useRef(swipeable);
  swipeableRef.current = swipeable;
  const followsFingerRef = useRef(dismissFollowsFinger);
  followsFingerRef.current = dismissFollowsFinger;
  const [imageHeights, setImageHeights] = useState<Record<string, number>>({});

  // Single animated value for the entire strip position
  const stripX = useRef(new Animated.Value(-initialIndex * SCREEN_WIDTH)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(useModal ? 1 : 0)).current;

  const gestureStartTime = useRef(0);
  const directionLocked = useRef<'horizontal' | 'vertical' | null>(null);
  // settledIndex tracks which image the strip is centered on (mutable, no re-render)
  const settledIndex = useRef(initialIndex);
  // baseX is the strip translateX when settled (no drag offset)
  const baseX = useRef(-initialIndex * SCREEN_WIDTH);
  // Ref to track images.length for PanResponder closures
  const imagesLengthRef = useRef(images.length);
  imagesLengthRef.current = images.length;

  // Reset animated values synchronously during render (not in useEffect)
  // to avoid 1-frame flicker when reopening after a swipe-dismiss
  const prevVisible = useRef(false);
  if (visible && !prevVisible.current) {
    // 番号も描画のうちに合わせる。useEffect だと1フレームだけ前の1枚が出て、
    // 地が不透明になってからはその瞬きが見える（Issue #192）
    setCurrentIndex(initialIndex);
    settledIndex.current = initialIndex;
    baseX.current = -initialIndex * SCREEN_WIDTH;
    stripX.setValue(-initialIndex * SCREEN_WIDTH);
    panY.setValue(0);
    opacity.setValue(1);
  }
  if (!visible && prevVisible.current && !useModal) {
    opacity.setValue(0);
  }
  prevVisible.current = visible;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  /*
   * 高さは、描いた画像の onLoad から受け取る。
   *
   * 以前はここで全枚数ぶん Image.getSize を呼んでいた。getSize は iOS では
   * 画像を丸ごと取りにいくので、57件あると 1.2MB × 57 の取得が同時に走り、
   * 画像ローダーが詰まる。新しく置いた <Image> が読み込まれず、load も error も
   * 返ってこない状態になっていた（実機で確認 / Issue #192）
   */
  const rememberHeight = useCallback((id: string, width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    setImageHeights(prev =>
      prev[id] !== undefined ? prev : { ...prev, [id]: SCREEN_WIDTH * (height / width) }
    );
  }, []);

  const navigateTo = useCallback(
    (newIndex: number, animated: boolean) => {
      const targetX = -newIndex * SCREEN_WIDTH;
      settledIndex.current = newIndex;
      baseX.current = targetX;
      if (animated) {
        Animated.timing(stripX, {
          toValue: targetX,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setCurrentIndex(newIndex);
          onIndexChangeRef.current?.(newIndex);
        });
      } else {
        stripX.setValue(targetX);
        setCurrentIndex(newIndex);
        onIndexChangeRef.current?.(newIndex);
      }
    },
    [stripX]
  );

  // Use refs so PanResponder always calls the latest versions
  const navigateToRef = useRef(navigateTo);
  navigateToRef.current = navigateTo;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => {
        return Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5;
      },
      onPanResponderGrant: () => {
        gestureStartTime.current = Date.now();
        directionLocked.current = null;
      },
      onPanResponderMove: (_, gs) => {
        if (!directionLocked.current) {
          // 横に移れない設定なら、横の動きは無視して縦だけ見る
          if (swipeableRef.current && Math.abs(gs.dx) > Math.abs(gs.dy)) {
            directionLocked.current = 'horizontal';
          } else if (gs.dy > 0) {
            directionLocked.current = 'vertical';
          }
        }

        if (directionLocked.current === 'horizontal') {
          stripX.setValue(baseX.current + gs.dx);
        } else if (directionLocked.current === 'vertical' && followsFingerRef.current) {
          panY.setValue(Math.max(0, gs.dy));
          opacity.setValue(Math.max(0, 1 - gs.dy / SCREEN_HEIGHT));
        }
      },
      onPanResponderRelease: (evt, gs) => {
        const elapsed = Date.now() - gestureStartTime.current;
        const isTap =
          elapsed < TAP_MAX_DURATION &&
          Math.abs(gs.dx) < TAP_MAX_DISTANCE &&
          Math.abs(gs.dy) < TAP_MAX_DISTANCE;

        if (isTap) {
          // 横に移れない設定では、左右のタップでも移らない
          if (!swipeableRef.current) return;
          // Tap handling - use refs for latest values
          const idx = settledIndex.current;
          const len = imagesLengthRef.current;
          if (evt.nativeEvent.locationX < SCREEN_WIDTH / 2) {
            if (idx > 0) navigateToRef.current(idx - 1, false);
          } else {
            if (idx < len - 1) navigateToRef.current(idx + 1, false);
          }
          return;
        }

        if (directionLocked.current === 'horizontal') {
          // Horizontal swipe - use refs for latest values
          const idx = settledIndex.current;
          const len = imagesLengthRef.current;
          if ((gs.dx < -SWIPE_THRESHOLD || gs.vx < -VELOCITY_THRESHOLD) && idx < len - 1) {
            navigateToRef.current(idx + 1, true);
          } else if ((gs.dx > SWIPE_THRESHOLD || gs.vx > VELOCITY_THRESHOLD) && idx > 0) {
            navigateToRef.current(idx - 1, true);
          } else {
            Animated.spring(stripX, {
              toValue: baseX.current,
              useNativeDriver: true,
            }).start();
          }
        } else if (directionLocked.current === 'vertical') {
          // Vertical swipe dismiss
          const dismissing = gs.dy > DISMISS_THRESHOLD || gs.vy > VELOCITY_THRESHOLD;

          // 写真を動かさない設定では、閉じる合図を出すだけ。戻る動きは
          // 呼び出し側が元の位置から始める（Issue #192）
          if (!followsFingerRef.current) {
            if (dismissing) onCloseRef.current();
            directionLocked.current = null;
            return;
          }

          if (dismissing) {
            Animated.parallel([
              Animated.timing(panY, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
              }),
            ]).start(() => {
              onCloseRef.current();
            });
          } else {
            Animated.parallel([
              Animated.spring(panY, { toValue: 0, useNativeDriver: true }),
              Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
            ]).start();
          }
        } else {
          stripX.setValue(baseX.current);
          panY.setValue(0);
        }

        directionLocked.current = null;
      },
    })
  ).current;

  // For useModal mode: return null when not visible
  if (useModal && (!visible || images.length === 0)) return null;

  const currentImage = visible ? images[currentIndex] : null;

  const renderContent = () => {
    if (!visible || images.length === 0 || !currentImage) return null;

    return (
      <>
        <Animated.View
          style={[
            styles.stripContainer,
            swipeable
              ? {
                  width: images.length * SCREEN_WIDTH,
                  transform: [{ translateX: stripX }, { translateY: panY }],
                }
              : { width: SCREEN_WIDTH, transform: [{ translateY: panY }] },
          ]}
          {...panResponder.panHandlers}
          testID="gallery-gesture-area"
        >
          {/* 横に移れないなら今の1枚だけ置く。隣を先に読み込まないぶん、
              今の1枚が早く出る（Issue #192） */}
          {(swipeable ? images : [currentImage]).map((img, slot) => {
            const index = swipeable ? slot : currentIndex;
            return (
              <View key={img.id} style={styles.imageSlot}>
                {/* 見えている前後だけ描く。全枚数を一度に置くと、そのぶんの取得が
                    同時に走って画像ローダーが詰まる（Issue #192） */}
                {Math.abs(index - currentIndex) <= NEIGHBORS && (
                  <Image
                    source={{ uri: img.imageUrl }}
                    style={[styles.image, { height: imageHeights[img.id] ?? SCREEN_WIDTH }]}
                    resizeMode="contain"
                    onLoad={e => {
                      rememberHeight(
                        img.id,
                        e.nativeEvent.source.width,
                        e.nativeEvent.source.height
                      );
                      if (index === currentIndex) onImageReadyRef.current?.(index);
                    }}
                    testID={index === currentIndex ? 'gallery-image' : undefined}
                  />
                )}
              </View>
            );
          })}
        </Animated.View>

        <View style={styles.infoContainer} pointerEvents="none">
          {currentImage.userName && (
            <Text style={styles.userName} testID="gallery-username">
              {currentImage.userName}
            </Text>
          )}
          {currentImage.spotName && (
            <Text style={styles.spotName} testID="gallery-spot-name" numberOfLines={1}>
              {currentImage.spotName}
            </Text>
          )}
          {currentImage.memo && (
            <Text style={styles.memo} testID="gallery-memo">
              {currentImage.memo}
            </Text>
          )}
          {currentImage.visitedAt && (
            <Text style={styles.visitedAt} testID="gallery-visited-at">
              {formatDate(currentImage.visitedAt)}
            </Text>
          )}
        </View>

        {/* 件数は「並びの何番目か」の目印。横に移れないなら数えるものが無い */}
        {swipeable && (
          <View style={styles.counterContainer} pointerEvents="none">
            <Text style={styles.counter} testID="gallery-counter">
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        <View style={styles.topBar}>
          <View style={styles.topBarActions}>
            {onEdit && (
              <MaterialIcons
                name="edit"
                size={24}
                color={colors.gray[800]}
                onPress={() => onEdit(currentIndex)}
                testID="gallery-edit-button"
                style={styles.topBarIcon}
              />
            )}
            {onDelete && (
              <MaterialIcons
                name="delete"
                size={24}
                color={colors.gray[800]}
                onPress={() => onDelete(currentIndex)}
                testID="gallery-delete-button"
                style={styles.topBarIcon}
              />
            )}
          </View>
          <MaterialIcons
            name="close"
            size={28}
            color={colors.gray[800]}
            onPress={onClose}
            testID="gallery-close-button"
          />
        </View>
      </>
    );
  };

  if (useModal) {
    return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <Animated.View style={[styles.overlay, { opacity }]} testID="gallery-overlay">
          {renderContent()}
        </Animated.View>
      </Modal>
    );
  }

  // Absolute positioning mode: always render the overlay, control with opacity + pointerEvents
  return (
    <Animated.View
      style={[styles.overlayAbsolute, { opacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
      testID="gallery-overlay"
    >
      {renderContent()}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    // 一覧と同じ地。暗くするとモーダルに見えるが、ここは画面が変わったのであって
    // 一覧の上に何かが乗ったのではない（Issue #192）
    backgroundColor: colors.background,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  overlayAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1000,
    elevation: 1000,
  },
  stripContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageSlot: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
  },
  topBar: {
    position: 'absolute',
    top: spacing['4xl'],
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarIcon: {
    padding: spacing.sm,
  },
  infoContainer: {
    position: 'absolute',
    bottom: GALLERY_INFO_BOTTOM,
    left: 0,
    right: 0,
    paddingHorizontal: GALLERY_INFO_LEFT,
    gap: spacing.xs,
  },
  userName: {
    ...typography.body,
    color: colors.gray[800],
    fontWeight: '600',
  },
  spotName: {
    ...typography.body,
    color: colors.gray[800],
    fontWeight: '600',
  },
  memo: {
    ...typography.bodySmall,
    color: colors.gray[600],
  },
  visitedAt: {
    ...typography.caption,
    color: colors.gray[500],
  },
  counterContainer: {
    position: 'absolute',
    bottom: spacing['3xl'],
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  counter: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
});
