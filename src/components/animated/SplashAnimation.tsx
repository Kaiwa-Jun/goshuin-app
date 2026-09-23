import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import { SEAL_FRAMES } from '@components/common/Seal';
import { colors } from '@theme/colors';

/**
 * 起動画面に出す印。**アイコンと同じ絵**（12ヶ月の環と、真ん中のひとつ）。
 *
 * ⚠️ ここが合っていないと、ネイティブの起動画面（assets/splash.png）から
 * この画面へ移るときに絵が入れ替わって見える。実際、以前はここが
 * オレンジ地に鳥居の絵文字のままで、**焼いたアイコンが一度も見えていなかった**。
 * 変えるときは scripts/icon/render.html も一緒に。
 */
const APP_MARK_RING = Array.from({ length: 12 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 6;
  return { cx: +(50 + 28 * Math.cos(a)).toFixed(2), cy: +(50 + 28 * Math.sin(a)).toFixed(2) };
});

function AppMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" testID="splash-mark">
      <Path fillRule="evenodd" d={SEAL_FRAMES[0]} fill={colors.seal} />
      {APP_MARK_RING.map((c, i) => (
        <Circle key={i} cx={c.cx} cy={c.cy} r={5.8} fill={colors.seal} />
      ))}
      <Circle cx={50} cy={50} r={10} fill={colors.seal} />
    </Svg>
  );
}

interface SplashAnimationProps {
  onAnimationComplete: () => void;
}

export const SplashAnimation: React.FC<SplashAnimationProps> = ({ onAnimationComplete }) => {
  const iconScale = useRef(new Animated.Value(0.3)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  const playExit = useCallback(() => {
    Animated.timing(exitOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onAnimationComplete();
    });
  }, [exitOpacity, onAnimationComplete]);

  useEffect(() => {
    Animated.sequence([
      // 2. アイコン: スケールアップ + フェードイン
      Animated.parallel([
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      // 3. テキスト: スライドイン + フェードイン (0.2s遅延)
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // 4. 待機
      Animated.delay(500),
    ]).start(() => {
      // 5. 退場アニメーション
      playExit();
    });
  }, [iconScale, iconOpacity, textTranslateY, textOpacity, playExit]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, { opacity: exitOpacity }]}
      testID="splash-animation"
    >
      {/*
       * 地は最初のフレームから不透明にする。この画面は RootNavigator の上に重なって
       * いるので、フェードインさせると下のオンボーディングが一瞬透けて見える（1.2.0 の実機）。
       * 色はネイティブの起動画面と同じにして、切り替わりの継ぎ目を消す
       */}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.splash }]}
        testID="splash-ground"
      />

      <View style={styles.content}>
        <Animated.View
          style={{
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          }}
        >
          <AppMark size={104} />
        </Animated.View>

        <Animated.View
          style={{
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          }}
        >
          <Text style={styles.title}>御朱印さんぽ</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    // 地を和紙にしたので白では読めない
    color: colors.gray[800],
    marginTop: 16,
  },
});
