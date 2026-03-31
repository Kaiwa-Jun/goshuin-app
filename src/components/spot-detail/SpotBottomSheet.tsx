import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpotCompactCard } from './SpotCompactCard';
import { SpotDetailContent } from './SpotDetailContent';
import { useSpotDetail } from '@hooks/useSpotDetail';
import { useSpotStamps } from '@hooks/useSpotStamps';
import { useAuth } from '@hooks/useAuth';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

interface SpotBottomSheetProps {
  spotId: string | null;
  visitedSpotIds: Set<string>;
  onDismiss: () => void;
  onRecord: (spotId: string) => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const COMPACT_HEIGHT = 180;

type SheetMode = 'hidden' | 'compact' | 'expanded';

export function SpotBottomSheet({
  spotId,
  visitedSpotIds,
  onDismiss,
  onRecord,
}: SpotBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const expandedHeight = SCREEN_HEIGHT * 0.85;
  const { spot } = useSpotDetail(spotId ?? '');
  const { stamps, visitCount, latestVisitDate } = useSpotStamps(spotId ?? '');
  const { isAuthenticated } = useAuth();

  const [mode, setMode] = useState<SheetMode>('hidden');
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const compactPosition = SCREEN_HEIGHT - COMPACT_HEIGHT - insets.bottom;
  const expandedPosition = SCREEN_HEIGHT - expandedHeight;

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

  useEffect(() => {
    if (spotId && spot) {
      setMode('compact');
      animateTo(compactPosition);
    } else {
      animateTo(SCREEN_HEIGHT, () => {
        setMode('hidden');
      });
    }
  }, [spotId, spot, compactPosition, animateTo]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
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

  const isVisited = spotId ? visitedSpotIds.has(spotId) : false;

  if (!spotId || !spot) {
    return null;
  }

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
      {/* Drag handle */}
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>

      {/* Compact card (hidden when expanded) */}
      {mode !== 'expanded' && <SpotCompactCard spot={spot} isVisited={isVisited} />}

      {/* Scrollable detail content (visible when expanded) */}
      {mode === 'expanded' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          <SpotDetailContent
            spot={spot}
            stamps={stamps}
            visitCount={visitCount}
            latestVisitDate={latestVisitDate}
            isAuthenticated={isAuthenticated}
            onRecord={handleRecord}
            showMiniMap={false}
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
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[300],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
