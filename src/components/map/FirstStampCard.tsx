import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

import { Button } from '@components/common/Button';
import { PrefectureEmboss } from '@components/common/PrefectureEmboss';
import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_NAMES,
  JAPAN_PREFECTURE_PATHS,
} from '@/constants/japanMap';
import { FIRST_STAMP_CARD_TITLE, firstStampCardSubtitle } from '@utils/firstStamp';
import { zoomToPrefecture } from '@utils/japanMapZoom';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { borderRadius, spacing } from '@theme/spacing';
import { shadows } from '@theme/shadows';

/** 小さな日本地図の幅。高さは日本地図の縦横比から */
const MAP_WIDTH = 84;
const MAP_HEIGHT = (MAP_WIDTH * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;
/** どの県でも「日本のどのあたりか」が分かる寄り（試作の値） */
const MAP_SCALE = 1.8;

/** 下から出る（RegionSpotSheet と同じ。行き過ぎ・弾みなし） */
const ENTER_MS = 300;
const ENTER_FROM_Y = 16;
/** 出てから、いる県が空押しで浮き始めるまで */
const EMBOSS_DELAY_MS = 320;
const EMBOSS_MS = 600;
/** ✕ で＋の位置へ縮んで消える */
const FOLD_MS = 280;
const FOLD_SCALE = 0.12;
/** ＋（FAB）の中心は、カードの右下の角から左へ 32・上へ 32 */
const FAB_CENTER_INSET = 32;

interface FirstStampCardProps {
  /** 色が差す県。null なら全国・空押しなし・「その県」 */
  prefecture: string | null;
  /** ［近くの寺社を見る］を出すか */
  showNearby: boolean;
  reduceMotion: boolean;
  onShoot: () => void;
  onNearby: () => void;
  /** ✕。畳む動き（280ms）が終わってから呼ぶ。視差効果を減らすなら押してすぐ */
  onDismiss: () => void;
  /** カードの高さ（地図の出典を上へ逃がすため） */
  onHeightChange?: (height: number) => void;
}

/**
 * 記録 0 枚の間だけ地図の下に出すカード（Issue #327 案①）。
 *
 * 「参拝したら、写真1枚で日本地図に。」と、いる県が空押しでうっすら浮く小さな日本地図。
 * ［御朱印を撮る］［近くの寺社を見る］で最初の 1 枚へ連れていく。✕ はその回だけ＋の位置へ畳む
 * （覚えない）。動きはどれも 1 回だけ・opacity と transform だけ・native driver
 */
export function FirstStampCard({
  prefecture,
  showNearby,
  reduceMotion,
  onShoot,
  onNearby,
  onDismiss,
  onHeightChange,
}: FirstStampCardProps) {
  const appear = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const emboss = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const fold = useRef(new Animated.Value(0)).current;
  const foldAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const hasEmboss = prefecture !== null;

  useEffect(() => {
    if (reduceMotion) {
      // 動いている最中に設定が変わったら、その場で最後の姿にする
      appear.stopAnimation();
      emboss.stopAnimation();
      appear.setValue(1);
      emboss.setValue(1);
      if (foldAnimation.current) {
        foldAnimation.current.stop();
        fold.setValue(1);
        onDismissRef.current();
      }
      return;
    }

    const enter = Animated.timing(appear, {
      toValue: 1,
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    enter.start();

    // 待ちは setTimeout で（Animated の delay は既定の Easing.ease の遅延 require が Jest で壊れる。SaveMapReveal と同じ）
    let embossIn: Animated.CompositeAnimation | null = null;
    const timer = hasEmboss
      ? setTimeout(() => {
          embossIn = Animated.timing(emboss, {
            toValue: 1,
            duration: EMBOSS_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          });
          embossIn.start();
        }, EMBOSS_DELAY_MS)
      : null;

    return () => {
      if (timer) clearTimeout(timer);
      enter.stop();
      embossIn?.stop();
    };
  }, [reduceMotion, hasEmboss, appear, emboss, fold]);

  // 畳んでいる途中で外れたら止める（終わりの onDismiss は呼ばない）
  useEffect(() => () => foldAnimation.current?.stop(), []);

  const handleClose = () => {
    if (reduceMotion) {
      onDismiss();
      return;
    }
    if (foldAnimation.current) return;
    const animation = Animated.timing(fold, {
      toValue: 1,
      duration: FOLD_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    foldAnimation.current = animation;
    animation.start(({ finished }) => {
      if (finished) onDismissRef.current();
    });
  };

  const zoom = prefecture ? zoomToPrefecture(prefecture, MAP_WIDTH, MAP_SCALE) : null;
  const opacity = Animated.multiply(
    appear,
    fold.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
  );
  const translateY = appear.interpolate({ inputRange: [0, 1], outputRange: [ENTER_FROM_Y, 0] });
  const scale = fold.interpolate({ inputRange: [0, 1], outputRange: [1, FOLD_SCALE] });

  return (
    <Animated.View
      testID="first-stamp-card"
      style={[
        styles.card,
        size && {
          transformOrigin: `${size.width - FAB_CENTER_INSET}px ${size.height - FAB_CENTER_INSET}px`,
        },
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
        onHeightChange?.(height);
      }}
    >
      <View style={styles.head}>
        <View testID="first-stamp-card-map" style={styles.map}>
          <View
            testID="first-stamp-card-zoom"
            style={[
              styles.zoom,
              zoom && {
                transform: [
                  { translateX: zoom.translateX },
                  { translateY: zoom.translateY },
                  { scale: zoom.scale },
                ],
              },
            ]}
          >
            <Svg
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`}
            >
              {JAPAN_PREFECTURE_NAMES.map(name => (
                <Path
                  key={name}
                  d={JAPAN_PREFECTURE_PATHS[name]}
                  fill={colors.prefectureFill.empty}
                  stroke={colors.prefectureFill.border}
                  strokeWidth={3}
                />
              ))}
            </Svg>
            {prefecture && (
              <Animated.View
                testID="first-stamp-card-emboss"
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { opacity: emboss }]}
              >
                <Svg
                  width={MAP_WIDTH}
                  height={MAP_HEIGHT}
                  viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`}
                >
                  <PrefectureEmboss prefecture={prefecture} offset={8} shadeOpacity={0.45} />
                </Svg>
              </Animated.View>
            )}
          </View>
        </View>
        <View style={styles.texts}>
          <Text testID="first-stamp-card-title" style={styles.title}>
            {FIRST_STAMP_CARD_TITLE}
          </Text>
          <Text testID="first-stamp-card-subtitle" style={styles.subtitle}>
            {firstStampCardSubtitle(prefecture)}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          testID="first-stamp-shoot"
          title="御朱印を撮る"
          icon="photo-camera"
          variant="primary"
          onPress={onShoot}
          style={styles.action}
          textStyle={styles.actionText}
        />
        {showNearby && (
          <Button
            testID="first-stamp-nearby"
            title="近くの寺社を見る"
            icon="near-me"
            variant="outline"
            onPress={onNearby}
            style={styles.action}
            textStyle={styles.actionText}
          />
        )}
      </View>

      <Pressable
        testID="first-stamp-close"
        accessibilityRole="button"
        accessibilityLabel="閉じる"
        hitSlop={6}
        onPress={handleClose}
        style={styles.close}
      >
        <MaterialIcons name="close" size={20} color={colors.gray[400]} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    // あゆみの地図のカードと同じ
    padding: 14,
    ...shadows.floating,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  map: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  // 枠の中心を軸に寄せる（zoomToPrefecture の前提）
  zoom: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  },
  texts: {
    flex: 1,
    minWidth: 0,
  },
  // 試作の値（typography.h3 を元に、太さと大きさだけ上書き）
  title: {
    ...typography.h3,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    color: colors.gray[900],
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray[600],
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  action: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  // 試作は 16pt。393pt 幅の iPhone で「近くの寺社を見る」が 1 行に収まるよう 14pt（D-14）
  actionText: {
    ...typography.buttonSmall,
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
