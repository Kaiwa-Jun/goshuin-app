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
  memo?: string | null;
  visitedAt?: string | null;
}

interface ImageGalleryModalProps {
  visible: boolean;
  onClose: () => void;
  images: GalleryImage[];
  initialIndex: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = SCREEN_HEIGHT * 0.2;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const VELOCITY_THRESHOLD = 0.5;
const TAP_MAX_DURATION = 200;
const TAP_MAX_DISTANCE = 10;

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
}: ImageGalleryModalProps) {
  // currentIndex is only used for info display (userName, memo, counter)
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageHeights, setImageHeights] = useState<Record<string, number>>({});

  // Single animated value for the entire strip position
  const stripX = useRef(new Animated.Value(-initialIndex * SCREEN_WIDTH)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const gestureStartTime = useRef(0);
  const directionLocked = useRef<'horizontal' | 'vertical' | null>(null);
  // settledIndex tracks which image the strip is centered on (mutable, no re-render)
  const settledIndex = useRef(initialIndex);
  // baseX is the strip translateX when settled (no drag offset)
  const baseX = useRef(-initialIndex * SCREEN_WIDTH);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      settledIndex.current = initialIndex;
      baseX.current = -initialIndex * SCREEN_WIDTH;
      stripX.setValue(-initialIndex * SCREEN_WIDTH);
      panY.setValue(0);
      opacity.setValue(1);
    }
  }, [visible, initialIndex, stripX, panY, opacity]);

  useEffect(() => {
    if (!visible || images.length === 0) return;
    images.forEach(img => {
      if (imageHeights[img.id] !== undefined) return;
      Image.getSize(
        img.imageUrl,
        (w, h) => {
          setImageHeights(prev => ({ ...prev, [img.id]: SCREEN_WIDTH * (h / w) }));
        },
        () => {
          setImageHeights(prev => ({ ...prev, [img.id]: SCREEN_WIDTH }));
        }
      );
    });
  }, [visible, images, imageHeights]);

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
        });
      } else {
        stripX.setValue(targetX);
        setCurrentIndex(newIndex);
      }
    },
    [stripX]
  );

  const handleTap = useCallback(
    (locationX: number) => {
      const idx = settledIndex.current;
      if (locationX < SCREEN_WIDTH / 2) {
        if (idx > 0) navigateTo(idx - 1, false);
      } else {
        if (idx < images.length - 1) navigateTo(idx + 1, false);
      }
    },
    [images.length, navigateTo]
  );

  const handleHorizontalRelease = useCallback(
    (dx: number, vx: number) => {
      const idx = settledIndex.current;
      if ((dx < -SWIPE_THRESHOLD || vx < -VELOCITY_THRESHOLD) && idx < images.length - 1) {
        navigateTo(idx + 1, true);
      } else if ((dx > SWIPE_THRESHOLD || vx > VELOCITY_THRESHOLD) && idx > 0) {
        navigateTo(idx - 1, true);
      } else {
        // Snap back
        Animated.spring(stripX, {
          toValue: baseX.current,
          useNativeDriver: true,
        }).start();
      }
    },
    [images.length, stripX, navigateTo]
  );

  const handleVerticalRelease = useCallback(
    (dy: number, vy: number) => {
      if (dy > DISMISS_THRESHOLD || vy > VELOCITY_THRESHOLD) {
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
          onClose();
        });
      } else {
        Animated.parallel([
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }),
          Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
        ]).start();
      }
    },
    [onClose, panY, opacity]
  );

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
          if (Math.abs(gs.dx) > Math.abs(gs.dy)) {
            directionLocked.current = 'horizontal';
          } else if (gs.dy > 0) {
            directionLocked.current = 'vertical';
          }
        }

        if (directionLocked.current === 'horizontal') {
          stripX.setValue(baseX.current + gs.dx);
        } else if (directionLocked.current === 'vertical') {
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
          handleTap(evt.nativeEvent.locationX);
          return;
        }

        if (directionLocked.current === 'horizontal') {
          handleHorizontalRelease(gs.dx, gs.vx);
        } else if (directionLocked.current === 'vertical') {
          handleVerticalRelease(gs.dy, gs.vy);
        } else {
          stripX.setValue(baseX.current);
          panY.setValue(0);
        }

        directionLocked.current = null;
      },
    })
  ).current;

  if (!visible || images.length === 0) return null;

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity }]} testID="gallery-overlay">
        <Animated.View
          style={[
            styles.stripContainer,
            {
              width: images.length * SCREEN_WIDTH,
              transform: [{ translateX: stripX }, { translateY: panY }],
            },
          ]}
          {...panResponder.panHandlers}
          testID="gallery-gesture-area"
        >
          {images.map((img, index) => (
            <View key={img.id} style={styles.imageSlot}>
              <Image
                source={{ uri: img.imageUrl }}
                style={[styles.image, { height: imageHeights[img.id] ?? SCREEN_WIDTH }]}
                resizeMode="contain"
                testID={index === currentIndex ? 'gallery-image' : undefined}
              />
            </View>
          ))}
        </Animated.View>

        <View style={styles.infoContainer} pointerEvents="none">
          {currentImage.userName && (
            <Text style={styles.userName} testID="gallery-username">
              {currentImage.userName}
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

        <View style={styles.counterContainer} pointerEvents="none">
          <Text style={styles.counter} testID="gallery-counter">
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        <View style={styles.closeButtonContainer}>
          <MaterialIcons
            name="close"
            size={28}
            color={colors.white}
            onPress={onClose}
            testID="gallery-close-button"
          />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(50, 50, 50, 0.85)',
    justifyContent: 'center',
    overflow: 'hidden',
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
  closeButtonContainer: {
    position: 'absolute',
    top: spacing['4xl'],
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.sm,
  },
  infoContainer: {
    position: 'absolute',
    bottom: spacing['5xl'],
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  userName: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  memo: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  visitedAt: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.6)',
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
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
