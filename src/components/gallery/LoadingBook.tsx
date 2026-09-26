import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Defs, Ellipse, RadialGradient, Stop, Svg } from 'react-native-svg';

import { Seal } from '@components/common/Seal';
import { colors } from '@theme/colors';
import {
  loadingMotion,
  sealMarksOnFace,
  sealOpacity,
  type LoadingSealFace,
} from '@components/gallery/loadingClock';

/**
 * 御朱印帳の写真の読み込み中に、下地の真ん中でめくれ続ける小さな御朱印帳（Issue #275）。
 *
 * 布の表紙・見開きの紙・紙の厚み・綴じ目の陰・めくれる紙の表裏と陰・
 * 下のページに落ちる影。寸法と色は試作 v2 の `.rb` 以下のまま（px で固定。
 * ページ幅に合わせて伸び縮みさせない）。
 *
 * **この部品は内部の状態を持たず、時計の登録もしない**（登録は下地がする）。
 * 印の差し替えも、4つの面それぞれに印を3つずつ重ね、時計から引いた不透明度の段で
 * 切り替える。回転も切り替えもネイティブで同じ時計から計算されるので、
 * めくれる紙が右へ戻る瞬間に前の印が一瞬戻って見えることがない。
 *
 * animated が false なら時計のノードに一切つながず、周 0 の開いた形で止まる。
 */

type GradientColors = React.ComponentProps<typeof LinearGradient>['colors'];
type GradientLocations = NonNullable<React.ComponentProps<typeof LinearGradient>['locations']>;

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const BOOK_WIDTH = 128;
const BOOK_HEIGHT = 88;
/** 見開きの1枚の幅。めくれる紙もこの幅で、綴じ目（左の辺）を軸に回る */
const PAGE_WIDTH = 58;
const PERSPECTIVE = 420;
const SEAL_SIZE = 26;
/** 紙に押した印は少し透ける（試作の `.seal` の opacity） */
const SEAL_OPACITY = 0.9;

/*
 * 紙の厚み。高さ 79（88 − 上 5 − 下 4）に、上から 3 ごとに 1 の線を 27 本。
 * 同じ location を2つ並べて硬い境目にし、縞をグラデーション1枚で描く
 * （線を View や Rect で 27 本並べてネイティブのビューを増やさない）
 */
const EDGE_HEIGHT = 79;
const EDGE_PITCH = 3;
const EDGE_LINES = 27;

function edgeStripes() {
  const { paper, paperEdge } = colors.loadingBook;
  const stripeColors: string[] = [];
  const locations: number[] = [];
  for (let i = 0; i < EDGE_LINES - 1; i++) {
    const top = i * EDGE_PITCH;
    stripeColors.push(paperEdge, paperEdge, paper, paper);
    locations.push(
      top / EDGE_HEIGHT,
      (top + 1) / EDGE_HEIGHT,
      (top + 1) / EDGE_HEIGHT,
      (top + EDGE_PITCH) / EDGE_HEIGHT
    );
  }
  stripeColors.push(paperEdge, paperEdge);
  locations.push(((EDGE_LINES - 1) * EDGE_PITCH) / EDGE_HEIGHT, 1);
  return {
    colors: stripeColors as unknown as GradientColors,
    locations: locations as unknown as GradientLocations,
  };
}

const EDGE = edgeStripes();

const TOP_TO_BOTTOM = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
const LEFT_TO_RIGHT = { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };

/** 止まっている本。周 0 の開いた形 */
const STILL = { rotateY: '0deg', scaleX: 1, shade: 0, cast: 0 };

interface LoadingBookProps {
  animated: boolean;
  testID: string;
}

/*
 * ページはめくるたび（中央のページが替わるたび）に全部描き直される。
 * 本は props が変わらなければ描き直さない（1冊に Seal が 4〜12 個ある）
 */
export const LoadingBook = React.memo(function LoadingBook({ animated, testID }: LoadingBookProps) {
  const motion = animated
    ? {
        rotateY: loadingMotion.leafRotateY,
        scaleX: loadingMotion.leafScaleX,
        shade: loadingMotion.leafShadeOpacity,
        cast: loadingMotion.castOpacity,
      }
    : STILL;

  /*
   * 綴じ目（左の辺）を軸に回す。translateX で軸を左の辺に寄せて回し、戻す
   * （TabBarIcon の本と同じ組み方。transformOrigin は使わない）。perspective は先頭
   */
  const leafTransform = [
    { perspective: PERSPECTIVE },
    { translateX: -PAGE_WIDTH / 2 },
    { rotateY: motion.rotateY },
    { scaleX: motion.scaleX },
    { translateX: PAGE_WIDTH / 2 },
  ];
  const shadowFill = `${testID}-shadow-fill`;

  return (
    <View testID={testID} style={styles.book}>
      {/* RN に blur は無いので、ぼかしの広がりを足した箱に放射状のグラデーションで描く */}
      <Svg testID={`${testID}-shadow`} width={124} height={30} style={styles.shadow}>
        <Defs>
          <RadialGradient id={shadowFill} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset={0} stopColor={colors.loadingBook.shadow} stopOpacity={0.15} />
            <Stop offset={0.47} stopColor={colors.loadingBook.shadow} stopOpacity={0.08} />
            <Stop offset={1} stopColor={colors.loadingBook.shadow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={62} cy={15} rx={62} ry={15} fill={`url(#${shadowFill})`} />
      </Svg>

      <LinearGradient
        testID={`${testID}-cover`}
        colors={[colors.primary[700], colors.loadingBook.coverEnd]}
        {...TOP_TO_BOTTOM}
        style={styles.cover}
      />
      <LinearGradient
        testID={`${testID}-edge-left`}
        colors={EDGE.colors}
        locations={EDGE.locations}
        {...TOP_TO_BOTTOM}
        style={[styles.edge, styles.edgeLeft]}
      />
      <LinearGradient
        testID={`${testID}-edge-right`}
        colors={EDGE.colors}
        locations={EDGE.locations}
        {...TOP_TO_BOTTOM}
        style={[styles.edge, styles.edgeRight]}
      />

      <View testID={`${testID}-page-left`} style={[styles.page, styles.pageLeft]}>
        <SealSlots face="left" animated={animated} testID={testID} />
        <LinearGradient
          testID={`${testID}-gutter-left`}
          colors={[colors.loadingBook.gutterClear, colors.loadingBook.gutter]}
          {...LEFT_TO_RIGHT}
          style={[styles.gutter, styles.gutterLeft]}
        />
      </View>
      <View testID={`${testID}-page-right`} style={[styles.page, styles.pageRight]}>
        <SealSlots face="under" animated={animated} testID={testID} />
        <LinearGradient
          testID={`${testID}-gutter-right`}
          colors={[colors.loadingBook.gutter, colors.loadingBook.gutterClear]}
          {...LEFT_TO_RIGHT}
          style={[styles.gutter, styles.gutterRight]}
        />
      </View>

      <AnimatedLinearGradient
        testID={`${testID}-cast`}
        colors={[colors.loadingBook.castStart, colors.loadingBook.castEnd]}
        locations={[0, 0.7]}
        {...LEFT_TO_RIGHT}
        style={[styles.cast, { opacity: motion.cast }]}
      />

      {/*
       * めくれる紙の表と裏は兄弟の2枚にする。iOS はビューの子の 3D を親の面に潰すので、
       * 親を回して子を裏返す形では裏が出ず、表が鏡に映ったように見える
       */}
      <Animated.View
        testID={`${testID}-leaf-back`}
        style={[
          styles.leaf,
          styles.leafBack,
          { transform: [...leafTransform, { rotateY: '180deg' }] },
        ]}
      >
        <SealSlots face="back" animated={animated} testID={testID} />
        <AnimatedLinearGradient
          testID={`${testID}-shade-back`}
          colors={[colors.loadingBook.leafShadeStart, colors.loadingBook.leafShadeEnd]}
          {...LEFT_TO_RIGHT}
          style={[StyleSheet.absoluteFill, { opacity: motion.shade }]}
        />
      </Animated.View>
      <Animated.View
        testID={`${testID}-leaf-front`}
        style={[styles.leaf, styles.leafFront, { transform: leafTransform }]}
      >
        <SealSlots face="front" animated={animated} testID={testID} />
        <AnimatedLinearGradient
          testID={`${testID}-shade-front`}
          colors={[colors.loadingBook.leafShadeStart, colors.loadingBook.leafShadeEnd]}
          {...LEFT_TO_RIGHT}
          style={[StyleSheet.absoluteFill, { opacity: motion.shade }]}
        />
      </Animated.View>
    </View>
  );
});

/**
 * 1つの面の印。動いている本は、その面に出る3つを同じ位置に重ね、時計の段で1つだけ見せる。
 * 止まっている本は周 0 の印を1つだけ置く
 */
function SealSlots({
  face,
  animated,
  testID,
}: {
  face: LoadingSealFace;
  animated: boolean;
  testID: string;
}) {
  const marks = sealMarksOnFace(face);

  if (!animated) {
    return (
      <View testID={`${testID}-seal-${face}-${marks[0]}`} style={styles.sealSlot}>
        <Seal mark={marks[0]} earned size={SEAL_SIZE} opacity={SEAL_OPACITY} />
      </View>
    );
  }

  return (
    <>
      {marks.map(mark => (
        <Animated.View
          key={mark}
          testID={`${testID}-seal-${face}-${mark}`}
          style={[styles.sealSlot, { opacity: sealOpacity(face, mark) }]}
        >
          <Seal mark={mark} earned size={SEAL_SIZE} opacity={SEAL_OPACITY} />
        </Animated.View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  book: {
    width: BOOK_WIDTH,
    height: BOOK_HEIGHT,
  },
  shadow: {
    position: 'absolute',
    left: 2,
    top: 75,
  },
  cover: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 6,
  },
  edge: {
    position: 'absolute',
    top: 5,
    bottom: 4,
    width: 4,
    borderRadius: 2,
  },
  edgeLeft: {
    left: 3,
  },
  edgeRight: {
    right: 3,
  },
  page: {
    position: 'absolute',
    top: 0,
    bottom: 6,
    width: PAGE_WIDTH,
    backgroundColor: colors.loadingBook.paper,
    overflow: 'hidden',
  },
  pageLeft: {
    left: 6,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
  },
  pageRight: {
    right: 6,
    borderTopLeftRadius: 1,
    borderBottomLeftRadius: 1,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  gutter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 14,
  },
  gutterLeft: {
    right: 0,
  },
  gutterRight: {
    left: 0,
  },
  cast: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 6,
    width: PAGE_WIDTH,
    borderTopLeftRadius: 1,
    borderBottomLeftRadius: 1,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  leaf: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 6,
    width: PAGE_WIDTH,
    backgroundColor: colors.loadingBook.paper,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  leafFront: {
    borderTopLeftRadius: 1,
    borderBottomLeftRadius: 1,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  leafBack: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
  },
  sealSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
