import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { G, Rect, Svg } from 'react-native-svg';

import { FallbackImage } from '@components/common/FallbackImage';
import { SealGlyph, type SealMark } from '@components/common/Seal';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';
import type { SpotPhoto } from '@/types/supabase';
import {
  CREST_RECT,
  GRAIN_OPACITY,
  HERO_COMPACT_HEIGHT,
  HERO_EXPANDED_HEIGHT,
  HERO_TILT_DEG,
  INK_OPACITY,
  MADA_LIGHT_OFFSET,
  MADA_LIGHT_OPACITY,
  MADA_SHADE_OFFSET,
  MADA_SHADE_OPACITY,
  PAGE_LEAVES,
  PAGE_RADIUS,
  PAGE_RECT,
  PAGE_REVEAL_MS,
  SEAL_PRESS_MS,
  TOP_PAGE_TRANSFORM,
  TUCK_RECT,
  grainRects,
  heroMomentStyle,
  heroRectLayout,
  heroRectMotion,
  pageLeafTransform,
  type HeroRect,
} from './spotHeroMotion';
import { photoGeometry } from './spotPhotoGeometry';

type AnimatedNumber = Animated.Value | Animated.AnimatedInterpolation<number>;

/** 飾り。押せず、読み上げない */
const DECORATION = {
  pointerEvents: 'none' as const,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};

const CREST_TILT = [{ rotate: `${HERO_TILT_DEG}deg` }];

/** 写真を置く帯の高さ（半分・大きく） */
const PHOTO_BAND = { compact: HERO_COMPACT_HEIGHT, expanded: HERO_EXPANDED_HEIGHT };

interface Props {
  spotType: 'shrine' | 'temple';
  visited: boolean;
  /** 訪問済みを一度でも取れたか。取れる前の 行っていない → 行った では動かさない */
  visitedReady: boolean;
  reduceMotion: boolean;
  /** 束の枚数（1〜3） */
  pageCount: number;
  /** 表の紙の写真（自分のいちばん新しい御朱印）。無ければ和紙の紙 */
  pageImageUri: string | null;
  /** 表の紙の写真が読めないときに1回だけ戻す先（原本。#227 S4a） */
  pageFallbackUri?: string | null;
  /** 帯の開き。大きく 1・半分 0 */
  open: AnimatedNumber;
  onPress: () => void;
  /** 寺社の写真（Issue #302）。無ければ空押しの地のまま */
  photo?: SpotPhoto | null;
  /** 写真が読めたか。読めるまで・読めなかったときは写真を透明にして、空押しの地を見せる */
  photoReady?: boolean;
  onPhotoLoad?: () => void;
  onPhotoError?: () => void;
}

/**
 * 地図のシートの上の帯（「場所の顔」。Issue #293・試作 2026-09-spot-sheet-hero-v2 の案B ＋ 案い）。
 *
 * 帯は 208 で描いたまま動かさず、中の印とページだけが開きに合わせて伸び縮みする。
 * 行っていない寺社は、和紙に寺社の印（鳥居・お堂）の型だけを空押しする。行った寺社は
 * 印に薄い朱の跡が残り、右に自分の御朱印のページが重なる。記録した瞬間は、印に朱が乗って
 * （0.5秒）ページに替わる（0.25秒）。
 *
 * 行っていない寺社でも朱とページを描いておき、不透明度 0 で隠す（記録した瞬間に木の形を
 * 変えない）。文字は描かない。
 */
export function SpotSheetHero({
  spotType,
  visited,
  visitedReady,
  reduceMotion,
  pageCount,
  pageImageUri,
  pageFallbackUri = null,
  open,
  onPress,
  photo = null,
  photoReady = false,
  onPhotoLoad,
  onPhotoError,
}: Props) {
  const windowWidth = Dimensions.get('window').width;
  const mark: SealMark = spotType === 'shrine' ? 'torii' : 'dou';

  // 記録した瞬間の2つの値。見た目はこの2つだけから決める。寺社ごとに作り直す（key）
  const [press] = useState(() => new Animated.Value(visited ? 1 : 0));
  const [reveal] = useState(() => new Animated.Value(visited ? 1 : 0));
  const moment = useMemo(() => heroMomentStyle(press, reveal), [press, reveal]);

  // 確かめた訪問（visitedReady の描画でだけ覚える。それ以外は未確定 = null）
  const confirmedRef = useRef<boolean | null>(null);
  const runningRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const previous = confirmedRef.current;
    confirmedRef.current = visitedReady ? visited : null;

    // 確かめて 行っていない だった寺社が、確かめて 行った になった = 記録した瞬間
    if (visited && visitedReady && !reduceMotion && previous === false) {
      press.setValue(0);
      reveal.setValue(0);
      const played = Animated.sequence([
        Animated.timing(press, {
          toValue: 1,
          duration: SEAL_PRESS_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(reveal, {
          toValue: 1,
          duration: PAGE_REVEAL_MS,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
      ]);
      runningRef.current = played;
      played.start(() => {
        if (runningRef.current === played) runningRef.current = null;
      });
      return;
    }

    // 動いている途中で、行ったまま（視差効果を減らす でもない）なら最後まで動かす
    if (runningRef.current && visited && !reduceMotion) return;

    // それ以外は、止めてその場で終わりの形
    runningRef.current?.stop();
    runningRef.current = null;
    const end = visited ? 1 : 0;
    press.setValue(end);
    reveal.setValue(end);
  }, [visited, visitedReady, reduceMotion, press, reveal]);

  // 帯が外れたら（寺社を切り替えた・シートを閉じた）止める
  useEffect(
    () => () => {
      runningRef.current?.stop();
      runningRef.current = null;
    },
    []
  );

  return (
    <Pressable testID="spot-hero" style={styles.hero} accessible={false} onPress={onPress}>
      <SpotHeroWashiGround
        mark={mark}
        open={open}
        windowWidth={windowWidth}
        inkOpacity={moment.inkOpacity}
        inkScale={moment.inkScale}
        madaOpacity={moment.madaOpacity}
      />
      {photo && (
        <SpotHeroPhoto
          photo={photo}
          ready={photoReady}
          open={open}
          windowWidth={windowWidth}
          onLoad={onPhotoLoad}
          onError={onPhotoError}
        />
      )}
      {/* 写真が読めたら、ページは写真の右下に挟まる（試作 RECT.tuck） */}
      <SpotHeroPages
        open={open}
        windowWidth={windowWidth}
        pageCount={pageCount}
        pageImageUri={pageImageUri}
        pageFallbackUri={pageFallbackUri}
        revealOpacity={moment.pagesOpacity}
        rect={photoReady ? TUCK_RECT : PAGE_RECT}
        onPhoto={photoReady}
      />
    </Pressable>
  );
}

interface GroundProps {
  mark: SealMark;
  open: AnimatedNumber;
  windowWidth: number;
  inkOpacity: Animated.AnimatedMultiplication<number>;
  inkScale: Animated.AnimatedInterpolation<number>;
  madaOpacity: Animated.AnimatedInterpolation<number>;
}

/**
 * 帯の「地」: 和紙の筋と、空押しの印（その上に乗る朱）。
 * 第2段で写真の地に替わる所（Issue #293 D-16）
 */
function SpotHeroWashiGround({
  mark,
  open,
  windowWidth,
  inkOpacity,
  inkScale,
  madaOpacity,
}: GroundProps) {
  const grain = useMemo(() => grainRects(windowWidth), [windowWidth]);
  const crestMotion = useMemo(() => heroRectMotion(open, CREST_RECT), [open]);
  const crestLayout = heroRectLayout(CREST_RECT, windowWidth);

  return (
    <>
      <View testID="spot-hero-grain" style={StyleSheet.absoluteFill} {...DECORATION}>
        <Svg width={windowWidth} height={HERO_EXPANDED_HEIGHT}>
          <G fill={colors.spotHero.grain} opacity={GRAIN_OPACITY}>
            {grain.map(r => (
              <Rect key={r.x} x={r.x} y={0} width={r.width} height={r.height} />
            ))}
          </G>
        </Svg>
      </View>

      {/* 帯の開きの transform と、記録の動きの transform は別のビューに持つ */}
      <Animated.View
        testID="spot-hero-crest"
        style={[
          styles.placed,
          crestLayout,
          {
            transform: [
              { translateX: crestMotion.translateX },
              { translateY: crestMotion.translateY },
              { scale: crestMotion.scale },
            ],
          },
        ]}
        {...DECORATION}
      >
        <View
          testID="spot-hero-crest-box"
          style={[StyleSheet.absoluteFill, { transform: CREST_TILT }]}
        >
          {/* 空押し: 左上に薄い陰、右下に光、面は和紙の「まだ」の色 */}
          <Animated.View
            testID="spot-hero-crest-mada"
            style={[StyleSheet.absoluteFill, { opacity: madaOpacity }]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <SealGlyph
                mark={mark}
                fill={colors.washiSub}
                opacity={MADA_SHADE_OPACITY}
                offset={MADA_SHADE_OFFSET}
              />
              <SealGlyph
                mark={mark}
                fill={colors.white}
                opacity={MADA_LIGHT_OPACITY}
                offset={MADA_LIGHT_OFFSET}
              />
              <SealGlyph mark={mark} fill={colors.washiShade} />
            </Svg>
          </Animated.View>
          <Animated.View
            testID="spot-hero-crest-ink"
            style={[
              StyleSheet.absoluteFill,
              { opacity: inkOpacity, transform: [{ scale: inkScale }] },
            ]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <SealGlyph mark={mark} fill={colors.seal} opacity={INK_OPACITY} />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
    </>
  );
}

interface PhotoProps {
  photo: SpotPhoto;
  ready: boolean;
  open: AnimatedNumber;
  windowWidth: number;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * 帯の写真の地（Issue #302 D-12・試作 `SpotHeroPhoto`）。幅いっぱいに置き、見せたい所が名前の行に
 * 隠れないように、半分 ↔ 大きく の開きに合わせて縦にずらす。読めるまでは透明にして、
 * 下の空押しの地を見せる（ふわっと出す動きは無い）
 */
function SpotHeroPhoto({ photo, ready, open, windowWidth, onLoad, onError }: PhotoProps) {
  const placed = useMemo(() => {
    const geometry = photoGeometry(photo, windowWidth, PHOTO_BAND);
    return {
      geometry,
      translateY: open.interpolate({
        inputRange: [0, 1],
        outputRange: [geometry.compactY, geometry.expandedY],
      }),
    };
  }, [open, photo, windowWidth]);
  const { geometry, translateY } = placed;

  return (
    <Animated.View
      testID="spot-hero-photo"
      style={[
        styles.placed,
        {
          top: 0,
          left: geometry.left,
          width: geometry.width,
          height: geometry.height,
          opacity: ready ? 1 : 0,
          transform: [{ translateY }],
        },
      ]}
      {...DECORATION}
    >
      <Image
        testID="spot-hero-photo-image"
        source={{ uri: photo.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={onLoad}
        onError={onError}
      />
    </Animated.View>
  );
}

interface PagesProps {
  open: AnimatedNumber;
  windowWidth: number;
  pageCount: number;
  pageImageUri: string | null;
  pageFallbackUri?: string | null;
  revealOpacity: Animated.Value;
  /** ページの置き場所。写真に挟まるときは TUCK_RECT（試作 `RECT.tuck`） */
  rect?: HeroRect;
  /** 写真に挟む（白い縁・濃い影。試作 `.gpage.onPhoto`） */
  onPhoto?: boolean;
}

/** 自分の御朱印のページ。回数の分だけ後ろに紙が重なる（3枚まで） */
function SpotHeroPages({
  open,
  windowWidth,
  pageCount,
  pageImageUri,
  pageFallbackUri = null,
  revealOpacity,
  rect = PAGE_RECT,
  onPhoto = false,
}: PagesProps) {
  const motion = useMemo(() => heroRectMotion(open, rect), [open, rect]);
  const layout = heroRectLayout(rect, windowWidth);
  const leaves = Math.min(Math.max(pageCount - 1, 0), PAGE_LEAVES.length);

  return (
    <Animated.View
      testID="spot-hero-pages"
      style={[
        styles.placed,
        layout,
        {
          transform: [
            { translateX: motion.translateX },
            { translateY: motion.translateY },
            { scale: motion.scale },
          ],
        },
      ]}
      {...DECORATION}
    >
      <Animated.View
        testID="spot-hero-pages-reveal"
        style={[StyleSheet.absoluteFill, { opacity: revealOpacity }]}
      >
        {Array.from({ length: leaves }, (_, i) => (
          <View
            key={i}
            testID={`spot-hero-page-leaf-${i}`}
            style={[
              styles.page,
              onPhoto && styles.pageOnPhoto,
              { transform: pageLeafTransform(i) },
            ]}
          />
        ))}
        {/* 影を持つ紙と、写真を角で切る枠を分ける（iOS は overflow: hidden で影が切れる） */}
        <View
          testID="spot-hero-page-top"
          style={[styles.page, onPhoto && styles.pageOnPhoto, { transform: TOP_PAGE_TRANSFORM }]}
        >
          <View testID="spot-hero-page-top-clip" style={styles.pageClip}>
            {pageImageUri && (
              <FallbackImage
                testID="spot-hero-page-image"
                uri={pageImageUri}
                fallbackUri={pageFallbackUri ?? undefined}
                resizeMode="cover"
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_EXPANDED_HEIGHT,
    overflow: 'hidden',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    backgroundColor: colors.washi,
  },
  placed: {
    position: 'absolute',
  },
  page: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: PAGE_RADIUS,
    borderWidth: 1,
    borderColor: colors.spotHero.pageEdge,
    backgroundColor: colors.washi,
    ...shadows.md,
  },
  // 写真の上の紙（試作 `.gpage.onPhoto`）。白い縁と濃い影で写真から浮かせる
  pageOnPhoto: {
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  pageClip: {
    ...StyleSheet.absoluteFillObject,
    // 縁の 1 の内側で切る
    borderRadius: PAGE_RADIUS - 1,
    overflow: 'hidden',
  },
});
