import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '@theme/colors';
import { LoadingBook } from '@components/gallery/LoadingBook';
import { CROSSFADE_MS, useLoadingClock } from '@components/gallery/loadingClock';

/** CSS の ease。RN の Easing.ease は別の曲線なので使わない */
const CROSSFADE_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

export type LoadingBookMode = 'flip' | 'still' | 'none';

interface ImageLoadingCoverProps {
  /** 写真がまだ届いていない */
  loading: boolean;
  variant: 'page' | 'tile';
  /** めくる表示の本。'flip' は動く・'still' は止まった本・'none' は描かない */
  book?: LoadingBookMode;
  reduceMotion: boolean;
  testID: string;
}

/**
 * 御朱印帳の写真の読み込み中に、**写真の枠の中だけ**に敷く下地（Issue #275）。
 *
 * 和紙の色の地に薄い枠。めくる表示のページは真ん中に小さな御朱印帳を置く。
 * 写真が届いたら 0.25秒でふわっと消えて、下の写真が出る（写真の方は動かさない）。
 *
 * 時計の登録は、読み込み中か**ふわっと消えている最中**のあいだ続ける。
 * 届いた瞬間に離すと、最後の1枚のときに時計が止まり、消えている間に本の紙が固まる
 */
export function ImageLoadingCover({
  loading,
  variant,
  book = 'still',
  testID,
}: ImageLoadingCoverProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [fading, setFading] = useState(false);

  // 読み込み中が終わった描画でふわっとを始める。戻ったらやめる
  const [wasLoading, setWasLoading] = useState(loading);
  if (wasLoading !== loading) {
    setWasLoading(loading);
    setFading(!loading);
  }

  const shown = loading || fading;
  const bookMoves = variant === 'page' && book === 'flip';
  useLoadingClock(shown && bookMoves);

  useEffect(() => {
    if (!fading) {
      // 読み込み中に戻ったとき・外し終わったとき。次に出すときは不透明から
      opacity.setValue(1);
      return undefined;
    }
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: CROSSFADE_MS,
      easing: CROSSFADE_EASING,
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) setFading(false);
    });
    return () => fade.stop();
  }, [fading, opacity]);

  if (!shown) return null;

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { opacity }]}
    >
      <View testID={`${testID}-ground`} style={styles.ground}>
        <View testID={`${testID}-frame`} style={[styles.frame, styles.framePage]} />
        {variant === 'page' && book !== 'none' && (
          <LoadingBook animated={bookMoves} testID={`${testID}-book`} />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.washi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.washiFrame,
  },
  framePage: {
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 8,
  },
});
