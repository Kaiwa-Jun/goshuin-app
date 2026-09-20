import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { heroFlight, topLeftDelta, type Rect } from '@utils/heroTransition';
import { GALLERY_INFO_BOTTOM, GALLERY_INFO_LEFT } from '@components/common/ImageGalleryModal';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

export interface HeroFlyerProps {
  imageUrl: string;
  /** 写真の 横 ÷ 縦。まだ測れていなければ null */
  imageAspect: number | null;
  /** 一覧のタイル（画像部分）の画面座標 */
  sourceRect: Rect;
  /** 一覧のタイルの、名前と日付の行の画面座標 */
  sourceTextRect: Rect | null;
  spotName: string;
  visitedAt: string;
  /** 'in' = 一覧から詳細へ / 'out' = 詳細から一覧へ */
  direction: 'in' | 'out';
  /**
   * 実際に動き出した合図。飛ぶと決めた時ではなくここで呼ぶ。
   * 写真の読み込みを待つぶん間があり、その間に元を隠すと穴があき、
   * 隠さないまま飛び始めると同じ御朱印が二重に見える
   */
  onStart?: () => void;
  /**
   * 詳細を開いたまま待機しているか。姿は消すが、この1枚は持ったままにする。
   * 作り直すと写真の読み込みからやり直しになり、閉じるときに間に合わない
   */
  resting?: boolean;
  onDone: () => void;
}

const DURATION = 320;
/**
 * 写真が出てくるのを待つ上限。飛ぶ1枚は新しい <Image> なので、一覧に出ていても
 * 読み込み直しが要る。待たずに飛ばすと最初の数フレームが空になる（実機で確認）
 */
const IMAGE_WAIT_MS = 200;

/**
 * 一覧のタイルと詳細の画像をつなぐ、飛んでいる最中だけの1枚（Issue #192）。
 *
 * 位置はタップのたびに `measureInWindow` で測る。だから左列でも右列でも、
 * スクロールして上下どこにあっても同じように繋がる。固定値は持たない。
 *
 * 動かすのは transform と opacity だけ。width / height はネイティブドライバに
 * 載らず、飛んでいる最中に JS スレッドが詰まると跳ねる
 */
export function HeroFlyer({
  imageUrl,
  imageAspect,
  sourceRect,
  sourceTextRect,
  spotName,
  visitedAt,
  direction,
  onStart,
  resting = false,
  onDone,
}: HeroFlyerProps) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(direction === 'in' ? 0 : 1)).current;
  const [container, setContainer] = useState<Rect | null>(null);
  /** 写真が出せる状態か。出る前に飛ぶと、空の枠だけが動く */
  const [imageReady, setImageReady] = useState(false);
  const containerRef = useRef<View>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  // 写真を待つのは飛び始めだけ。いつまでも待つと詳細が開かない
  useEffect(() => {
    const timer = setTimeout(() => setImageReady(true), IMAGE_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!container || !imageReady || resting) return;

    const to = direction === 'in' ? 1 : 0;
    onStartRef.current?.();

    // 動きを消す設定のときは、飛ばさずに着いた状態へ渡す。
    // 出るものは出る（詳細は開く）。演出だけ落とす
    if (reduceMotion) {
      progress.setValue(to);
      onDoneRef.current();
      return;
    }

    const anim = Animated.timing(progress, {
      toValue: to,
      duration: DURATION,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) onDoneRef.current();
    });

    return () => anim.stop();
  }, [container, imageReady, direction, resting, reduceMotion, progress]);

  /**
   * 飛ぶ枠の位置。タイルは画面座標で測っているので、こちらも画面座標で欲しい。
   * measureInWindow は返ってこないことがあるので、onLayout で取れた枠を先に置き、
   * 画面座標が来たら上書きする。先に置いておかないと、測れない環境で
   * 何も描かれないまま終わる
   */
  const measure = (fallback: Rect) => {
    setContainer(prev => prev ?? fallback);
    containerRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setContainer({ x, y, width, height });
    });
  };

  // 目的地は詳細と同じ置き方にする。全幅で、枠の中央
  const targetHeight = container && imageAspect ? container.width / imageAspect : 0;
  const target: Rect | null = container
    ? {
        x: container.x,
        y: container.y + (container.height - targetHeight) / 2,
        width: container.width,
        height: targetHeight,
      }
    : null;

  const flight = target && imageAspect ? heroFlight(sourceRect, target, imageAspect) : null;

  // 大きさが取れていなければ飛ばしようがない。詰まらせずに先へ進める
  useEffect(() => {
    if (container && !flight && !resting) onDoneRef.current();
  }, [container, flight, resting]);

  const textTarget: Rect | null =
    container && sourceTextRect
      ? {
          x: container.x + GALLERY_INFO_LEFT,
          y: container.y + container.height - GALLERY_INFO_BOTTOM - sourceTextRect.height,
          width: container.width - GALLERY_INFO_LEFT * 2,
          height: sourceTextRect.height,
        }
      : null;
  const textDelta = sourceTextRect && textTarget ? topLeftDelta(sourceTextRect, textTarget) : null;

  const between = (from: number, to: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

  return (
    <View
      ref={containerRef}
      // 詳細の地は zIndex 1000 を持っている。飛ぶ1枚はその上に出す。
      // 待機中は姿だけ消す。外すと写真の読み込みからやり直しになる
      style={[StyleSheet.absoluteFill, { zIndex: 2000 }, resting && styles.resting]}
      onLayout={e => measure(e.nativeEvent.layout)}
      pointerEvents="none"
      testID="hero-flyer"
    >
      <Animated.View style={[styles.backdrop, { opacity: between(0, 1) }]} testID="hero-backdrop" />

      {flight && target && (
        <Animated.View
          style={[
            styles.box,
            {
              left: target.x - (container?.x ?? 0),
              top: target.y - (container?.y ?? 0),
              width: target.width,
              height: target.height,
              transform: [
                { translateX: between(flight.translateX, 0) },
                { translateY: between(flight.translateY, 0) },
                { scaleX: between(flight.boxScaleX, 1) },
                { scaleY: between(flight.boxScaleY, 1) },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: imageUrl }}
            style={{ width: target.width, height: target.height }}
            resizeMode="cover"
            onLoad={() => setImageReady(true)}
            testID="hero-image"
          />
        </Animated.View>
      )}

      {textDelta && textTarget && (
        <Animated.View
          style={[
            styles.text,
            {
              left: textTarget.x - (container?.x ?? 0),
              top: textTarget.y - (container?.y ?? 0),
              width: textTarget.width,
              transform: [
                { translateX: between(textDelta.translateX, 0) },
                { translateY: between(textDelta.translateY, 0) },
              ],
            },
          ]}
        >
          {/* 色は transform では動かせないので、2枚を重ねて入れ替える */}
          <Animated.View style={{ opacity: between(1, 0) }}>
            <Text style={styles.gridName} numberOfLines={1}>
              {spotName}
            </Text>
            <Text style={styles.gridDate}>{visitedAt}</Text>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: between(0, 1) }]}>
            <Text style={styles.detailName} numberOfLines={1}>
              {spotName}
            </Text>
            <Text style={styles.detailDate}>{visitedAt}</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  resting: {
    opacity: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // 詳細の地と同じ色。違う色だと、着いた瞬間に地が切り替わって見える
    backgroundColor: colors.gray[900],
  },
  box: {
    position: 'absolute',
    // 角丸は入れない。外枠を非等倍で拡大すると角が楕円に歪む（Issue #192）
    overflow: 'hidden',
  },
  text: {
    position: 'absolute',
  },
  gridName: {
    ...typography.caption,
    color: colors.gray[800],
    marginTop: spacing.xs,
  },
  gridDate: {
    ...typography.caption,
    color: colors.gray[400],
  },
  detailName: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  detailDate: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
