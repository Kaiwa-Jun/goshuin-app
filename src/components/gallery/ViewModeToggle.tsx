import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, TouchableOpacity, View, StyleSheet } from 'react-native';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';
import type { GalleryViewMode } from '@hooks/useGalleryViewMode';
import {
  BOOK_OPEN_MS,
  FACE_DOWN_DEG,
  THUMB_SLIDE_MS,
  THUMB_TRAVEL,
  TILE_POP_MS,
  TILE_POP_STAGGER_MS,
  easeOutCubic,
  thumbSpring,
  tilePop,
} from './viewModeMotion';

/*
 * 図形の寸法。試作 docs/design/mockups/2026-09-viewmode-toggle-v1.html の A
 * （`.segA` 以下）のまま。押す所の高さだけ 36 → 38（見出しの高さ 44 を保つ。#276 D-2 の (a)）
 */
/** 灰色の台の内側の余白。白い台の上と左もこれ */
const TRACK_PADDING = 3;
/** 押す所と白い台の幅。白い台が動く幅と同じ */
const SEGMENT_WIDTH = THUMB_TRAVEL;
const SEGMENT_HEIGHT = 38;
const THUMB_RADIUS = 9;
const ICON_SIZE = 24;

/** 本: 背と2枚のページ。左のページが背を軸に開く */
const BOOK_PERSPECTIVE = 120;
const BOOK_PAGE_WIDTH = 10;
const BOOK_PAGE_HEIGHT = 14;
const BOOK_PAGE_TOP = 5;
const BOOK_PAGE_RADIUS = 1.5;
const BOOK_LEFT_PAGE_LEFT = 1.5;
const BOOK_RIGHT_PAGE_LEFT = 12.5;
const BOOK_SPINE_LEFT = 11.5;
const BOOK_SPINE_TOP = 4;
const BOOK_SPINE_WIDTH = 1;
const BOOK_SPINE_HEIGHT = 16;
const BOOK_SPINE_OPACITY = 0.5;

/** 一覧: 4枚のタイル。左上 → 右上 → 左下 → 右下 */
const GRID_TILE_SIZE = 9;
const GRID_TILE_RADIUS = 2;
const GRID_TILE_POSITIONS = [
  { left: 2.5, top: 2.5 },
  { left: 12.5, top: 2.5 },
  { left: 2.5, top: 12.5 },
  { left: 12.5, top: 12.5 },
] as const;

interface ViewModeToggleProps {
  mode: GalleryViewMode;
  onChange: (mode: GalleryViewMode) => void;
  /**
   * 視差効果を減らす。白い台はその場で移り、アイコンは動かさない。
   * 設定の読み出しは画面で1回にするので、ここでは読まずに受け取る（#275 AC-33）
   */
  reduceMotion?: boolean;
  /** 切り替えの動きの間・詳細を開いている間。押しても何もしない */
  locked?: boolean;
}

const OPTIONS: { mode: GalleryViewMode; label: string }[] = [
  { mode: 'flip', label: 'めくって表示' },
  { mode: 'grid', label: '一覧で表示' },
];

const thumbOffsetOf = (mode: GalleryViewMode) => (mode === 'grid' ? THUMB_TRAVEL : 0);

/**
 * 御朱印帳の表示の切り替え（Issue #276）。灰色の台の中を白い台がばねですべって移り、
 * 選んだ方のアイコンが動く（めくる = 本が開く、一覧 = タイルが1枚ずつ並ぶ）。
 *
 * アイコンは静止しているときも View の組み立て。静止をグリフにすると、動き出す瞬間に
 * グリフの輪郭と組み立てた形が合わずに跳ぶ
 */
export function ViewModeToggle({
  mode,
  onChange,
  reduceMotion = false,
  locked = false,
}: ViewModeToggleProps) {
  const thumbX = useRef(new Animated.Value(thumbOffsetOf(mode))).current;
  /** 本の左のページの進み。0 = 閉じて右のページに重なる、1 = 開いた（静止の形） */
  const bookOpen = useRef(new Animated.Value(1)).current;
  const tileScales = useRef(GRID_TILE_POSITIONS.map(() => new Animated.Value(1))).current;
  const bookRotate = useMemo(
    () =>
      bookOpen.interpolate({
        inputRange: [0, 1],
        outputRange: [`${FACE_DOWN_DEG}deg`, '0deg'],
      }),
    [bookOpen]
  );

  const running = useRef<Animated.CompositeAnimation[]>([]);
  /** 白い台の行き先。押して動かした先と、外から変わった mode を見分ける */
  const thumbTarget = useRef<GalleryViewMode>(mode);

  const stopRunning = () => {
    running.current.forEach(animation => animation.stop());
    running.current = [];
  };

  /*
   * 外から mode が変わった（保存値の読み出し）。その場に置くだけで動かさない。
   * 起動直後に勝手に動かない
   */
  useEffect(() => {
    if (thumbTarget.current === mode) return;
    thumbTarget.current = mode;
    running.current.forEach(animation => animation.stop());
    running.current = [];
    thumbX.setValue(thumbOffsetOf(mode));
    bookOpen.setValue(1);
    tileScales.forEach(scale => scale.setValue(1));
  }, [mode, thumbX, bookOpen, tileScales]);

  useEffect(
    () => () => {
      running.current.forEach(animation => animation.stop());
      running.current = [];
    },
    []
  );

  const handlePress = (next: GalleryViewMode) => {
    if (next === mode || locked) return;

    // 動いているボタンを止め、選ばれなくなった方のアイコンを静止の形に戻す
    stopRunning();
    if (next === 'flip') tileScales.forEach(scale => scale.setValue(1));
    else bookOpen.setValue(1);
    thumbTarget.current = next;

    onChange(next);

    if (reduceMotion) {
      thumbX.setValue(thumbOffsetOf(next));
      return;
    }

    // 今の位置から。押し直しても白い台は跳ばない
    const slide = Animated.timing(thumbX, {
      toValue: thumbOffsetOf(next),
      duration: THUMB_SLIDE_MS,
      easing: thumbSpring,
      useNativeDriver: true,
    });
    const animations = [slide];

    if (next === 'flip') {
      bookOpen.setValue(0);
      animations.push(
        Animated.timing(bookOpen, {
          toValue: 1,
          duration: BOOK_OPEN_MS,
          easing: easeOutCubic,
          useNativeDriver: true,
        })
      );
    } else {
      // tilePop(0) = 0.1。各タイルは順番が来た瞬間に小さいところから出る（試作と同じ）
      tileScales.forEach(scale => scale.setValue(0));
      tileScales.forEach((scale, i) =>
        animations.push(
          Animated.timing(scale, {
            toValue: 1,
            duration: TILE_POP_MS,
            delay: TILE_POP_STAGGER_MS * i,
            easing: tilePop,
            useNativeDriver: true,
          })
        )
      );
    }

    animations.forEach(animation => animation.start());
    running.current = animations;
  };

  return (
    <View style={styles.track} testID="view-mode-toggle">
      <Animated.View
        pointerEvents="none"
        testID="view-mode-thumb"
        style={[styles.thumb, { transform: [{ translateX: thumbX }] }]}
      />
      {OPTIONS.map(option => {
        const isSelected = option.mode === mode;
        const color = isSelected ? colors.primary[500] : colors.gray[400];
        return (
          <TouchableOpacity
            key={option.mode}
            testID={`view-mode-${option.mode}`}
            onPress={() => handlePress(option.mode)}
            style={styles.segment}
            hitSlop={{ top: TRACK_PADDING, bottom: TRACK_PADDING }}
            // 押した合図は台とアイコンの動き。薄くなると動きの手前に一手挟まる
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
          >
            {option.mode === 'flip' ? (
              <View style={styles.icon} testID="view-mode-flip-icon">
                <View
                  testID="view-mode-flip-icon-spine"
                  style={[styles.bookSpine, { backgroundColor: color }]}
                />
                <View
                  testID="view-mode-flip-icon-page-right"
                  style={[styles.bookPage, styles.bookPageRight, { backgroundColor: color }]}
                />
                <Animated.View
                  testID="view-mode-flip-icon-page-left"
                  style={[
                    styles.bookPage,
                    styles.bookPageLeft,
                    {
                      backgroundColor: color,
                      // 右の辺（背）を軸に回す。transformOrigin は使わない（TabBarIcon と同じ組み方）
                      transform: [
                        { perspective: BOOK_PERSPECTIVE },
                        { translateX: BOOK_PAGE_WIDTH / 2 },
                        { rotateY: bookRotate },
                        { translateX: -BOOK_PAGE_WIDTH / 2 },
                      ],
                    },
                  ]}
                />
              </View>
            ) : (
              <View style={styles.icon} testID="view-mode-grid-icon">
                {GRID_TILE_POSITIONS.map((position, i) => (
                  <Animated.View
                    key={i}
                    testID={`view-mode-grid-icon-tile-${i}`}
                    style={[
                      styles.gridTile,
                      position,
                      { backgroundColor: color, transform: [{ scale: tileScales[i] }] },
                    ]}
                  />
                ))}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: TRACK_PADDING,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[100],
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    borderRadius: THUMB_RADIUS,
    backgroundColor: colors.white,
    ...shadows.toggleThumb,
  },
  segment: {
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  bookSpine: {
    position: 'absolute',
    left: BOOK_SPINE_LEFT,
    top: BOOK_SPINE_TOP,
    width: BOOK_SPINE_WIDTH,
    height: BOOK_SPINE_HEIGHT,
    opacity: BOOK_SPINE_OPACITY,
  },
  bookPage: {
    position: 'absolute',
    top: BOOK_PAGE_TOP,
    width: BOOK_PAGE_WIDTH,
    height: BOOK_PAGE_HEIGHT,
    borderRadius: BOOK_PAGE_RADIUS,
  },
  bookPageRight: {
    left: BOOK_RIGHT_PAGE_LEFT,
  },
  bookPageLeft: {
    left: BOOK_LEFT_PAGE_LEFT,
  },
  gridTile: {
    position: 'absolute',
    width: GRID_TILE_SIZE,
    height: GRID_TILE_SIZE,
    borderRadius: GRID_TILE_RADIUS,
  },
});
