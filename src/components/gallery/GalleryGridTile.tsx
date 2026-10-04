import React, { memo } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { GalleryTileImage } from '@components/gallery/GalleryTileImage';
import { TILE_PERSPECTIVE } from '@components/gallery/viewModeMotion';
import type { TransitionTileMotion } from '@hooks/useViewModeTransition';
import type { StampWithSpot } from '@/types/supabase';

interface GalleryGridTileProps {
  stamp: StampWithSpot;
  /** 一覧の並びの中の位置 */
  index: number;
  /** 一覧に出す写真の URL */
  imageUrl: string;
  /** タイルの一辺 */
  size: number;
  /** 3列の真ん中。左右に余白を入れる */
  middleColumn: boolean;
  /** 日付順のときだけ日付を出す */
  showDate: boolean;
  /** 飛んでいる最中（Issue #192）。出したままだと同じ御朱印が一覧と空中で二重に見える */
  hidden: boolean;
  reduceMotion: boolean;
  /** 表示の切り替わりの動き（Issue #276）。見えているタイルにだけ、動きの間だけ渡される */
  motion?: TransitionTileMotion;
  /** 束のいちばん上の1枚。ほかのタイルより上に出す */
  stackTop: boolean;
  onPress: (index: number, stamp: StampWithSpot) => void;
  onImageLoad: (stampId: string, width: number, height: number) => void;
  onThumbMissing: (stamp: StampWithSpot) => void;
  /** 詳細へ連続的に繋ぐために、写真と文字の位置を測れるようにする（Issue #192） */
  registerHero: (stampId: string, part: 'image' | 'text', node: View | null) => void;
  /** 表示の切り替わりの動きのために、タイルの位置を測れるようにする（Issue #276） */
  registerMotion: (stampId: string, node: View | null) => void;
}

const formatDate = (dateStr: string) => dateStr.replace(/-/g, '/');

/**
 * 御朱印帳の一覧の1枚。
 *
 * 渡すものが変わらなければ描き直さない。一覧は画面が描き直されるたびに全部のタイルを
 * 描き直していて、表示を切り替える動きの準備と動き出しの直前の描き直しが重くなっていた
 * （65枚で 0.8秒に収まらなかった。Issue #276 S6）
 */
export const GalleryGridTile = memo(function GalleryGridTile({
  stamp,
  index,
  imageUrl,
  size,
  middleColumn,
  showDate,
  hidden,
  reduceMotion,
  motion,
  stackTop,
  onPress,
  onImageLoad,
  onThumbMissing,
  registerHero,
  registerMotion,
}: GalleryGridTileProps) {
  return (
    <TouchableOpacity
      style={[
        styles.item,
        { width: size },
        middleColumn && styles.itemMiddle,
        stackTop && styles.stackTop,
      ]}
      // 指が離れるまでに読み込みを始めておく。飛ぶ1枚は新しい <Image> なので、
      // 一覧に出ていても読み込み直しが要る
      onPressIn={() => {
        Image.prefetch(imageUrl).catch(() => {});
      }}
      onPress={() => onPress(index, stamp)}
      // 押しても暗くしない。押した合図は「その写真が開いていく」動きの方で
      // 出しているので、ここで色が変わると遷移の手前に余計な一手が挟まる
      activeOpacity={1}
      testID={`gallery-item-${stamp.id}`}
    >
      {/*
       * 表示の切り替えの動き用の包み（Issue #276 D-15）。静かなときも描いておき、
       * 動きの間だけ値を付ける（木の形を変えると写真を読み直す）
       */}
      <Animated.View
        ref={node => {
          // Animated.View の ref は中の View。型だけ LegacyRef が混ざる
          registerMotion(stamp.id, node as View | null);
        }}
        testID={`gallery-tile-motion-${stamp.id}`}
        style={
          motion && {
            transform: [
              { translateX: motion.translateX },
              { translateY: motion.translateY },
              { rotateZ: motion.rotateZ },
            ],
          }
        }
      >
        {/* 表と裏は兄弟の2枚。iOS は子の 3D を親の面に潰す（#275 D-7） */}
        <Animated.View
          testID={`gallery-tile-front-${stamp.id}`}
          style={
            motion && {
              backfaceVisibility: 'hidden',
              transform: [{ perspective: TILE_PERSPECTIVE }, { rotateY: motion.rotateY }],
            }
          }
        >
          <View
            ref={node => {
              registerHero(stamp.id, 'image', node);
            }}
            style={hidden && styles.hidden}
          >
            {/* 写真が届くまでは和紙の下地が明滅する（Issue #275） */}
            <GalleryTileImage
              stampId={stamp.id}
              uri={imageUrl}
              size={size}
              reduceMotion={reduceMotion}
              // 読み込んだついでに縦横比を控える。飛ぶ先の高さがこれで決まる
              onLoad={(w, h) => onImageLoad(stamp.id, w, h)}
              // R2 に原本が無い（旧バージョンから Supabase にだけ上がった）。元の写真に落として表示を続ける
              onError={() => onThumbMissing(stamp)}
            />
          </View>
        </Animated.View>
        {motion?.faceDown && (
          <Animated.View
            testID={`gallery-tile-back-${stamp.id}`}
            style={[
              styles.back,
              {
                transform: [
                  { perspective: TILE_PERSPECTIVE },
                  { rotateY: motion.rotateY },
                  { rotateY: '180deg' },
                ],
              },
            ]}
          >
            <View testID={`gallery-tile-back-${stamp.id}-frame`} style={styles.backFrame} />
          </Animated.View>
        )}
      </Animated.View>
      <Animated.View
        ref={node => {
          registerHero(stamp.id, 'text', node as View | null);
        }}
        testID={`gallery-tile-caption-${stamp.id}`}
        style={[hidden && styles.hidden, motion && { opacity: motion.captionOpacity }]}
      >
        <Text style={styles.spotName} numberOfLines={1}>
          {stamp.spots.name}
        </Text>
        {showDate && <Text style={styles.date}>{formatDate(stamp.visited_at)}</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  item: {
    marginBottom: spacing.lg,
  },
  itemMiddle: {
    marginHorizontal: spacing.xs,
  },
  /** 束のいちばん上の1枚を、行の中のほかのタイルより上に出す（Issue #276 D-16） */
  stackTop: {
    zIndex: 1,
  },
  hidden: {
    opacity: 0,
  },
  spotName: {
    ...typography.caption,
    color: colors.gray[800],
    marginTop: spacing.xs,
  },
  date: {
    ...typography.caption,
    color: colors.gray[400],
  },
  /** めくれるタイルの紙の裏（試作 transition-v2 の `.face.back`） */
  back: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.tileBack.paper,
    borderWidth: 1,
    borderColor: colors.tileBack.edge,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  /** 紙の裏の内側の薄い朱の枠（試作 `.face.back::after`） */
  backFrame: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.tileBack.frame,
    borderRadius: borderRadius.sm,
  },
});
