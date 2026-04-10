import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ToriiIcon } from '@components/animated/ToriiIcon';
import { colors } from '@theme/colors';

interface SplashAnimationProps {
  onAnimationComplete: () => void;
}

export const SplashAnimation: React.FC<SplashAnimationProps> = ({ onAnimationComplete }) => {
  const backgroundOpacity = useRef(new Animated.Value(0)).current;
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
      // 1. 背景フェードイン
      Animated.timing(backgroundOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
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
  }, [backgroundOpacity, iconScale, iconOpacity, textTranslateY, textOpacity, playExit]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, { opacity: exitOpacity }]}
      testID="splash-animation"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backgroundOpacity }]}>
        <LinearGradient
          colors={[colors.primary[400], colors.primary[500], colors.primary[600]]}
          style={StyleSheet.absoluteFill}
          testID="splash-gradient"
        />
      </Animated.View>

      <View style={styles.content}>
        <Animated.View
          style={{
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          }}
        >
          <ToriiIcon size={100} />
        </Animated.View>

        <Animated.View
          style={{
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          }}
        >
          <Text style={styles.title}>御朱印めぐり</Text>
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
    color: colors.white,
    marginTop: 16,
  },
});
