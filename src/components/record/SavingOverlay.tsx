import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

interface SavingOverlayProps {
  visible: boolean;
  /** 保存しようとしている写真の枚数 */
  total: number;
  /** 保存できた枚数 */
  saved: number;
  /**
   * 覆いを敷き始める高さ。ヘッダーの下から敷いて ✕ を残すために使う。
   * アップロードにタイムアウトが無いので、全面を塞ぐと回線が死んだとき
   * 強制終了しか道が無くなる（Issue #190）
   */
  top?: number;
}

/** 1文字ずつ動かすので、文字列ではなく文字の並びとして持つ */
const LABEL = ['保', '存', '中'];

/** 文字が湧いてくる距離。大きくすると重たく見える */
const RISE = 14;
/** 点が波打つ振れ幅 */
const HOP = 8;

/**
 * 御朱印を保存している間の覆い（Issue #190）。
 *
 * 点の数は写真の枚数で、保存できたものから染まる。つまり波は「生きている」の
 * 合図だけでなく進捗そのものになる。submit() は1枚ずつ順に上げている
 * （並列だと綴じた順が崩れる / Issue #180）ので、何枚目までかは既に分かっている。
 *
 * 覆いの仕事は演出だけではない。これが無いと、保存中にスポットを選び直したり
 * 写真を消したりできてしまう
 */
export function SavingOverlay({ visible, total, saved, top = 0 }: SavingOverlayProps) {
  const reduceMotion = useReduceMotion();

  const chars = useRef(LABEL.map(() => new Animated.Value(0))).current;
  // 枚数が変わると点の数も変わる。値の本数を合わせておく
  const hops = useMemo(() => Array.from({ length: total }, () => new Animated.Value(0)), [total]);

  // 入場。1文字ずつ下から上がってきて、行き過ぎて戻る
  useEffect(() => {
    if (!visible) return;

    if (reduceMotion) {
      chars.forEach(value => value.setValue(1));
      return;
    }

    chars.forEach(value => value.setValue(0));
    const entrance = Animated.stagger(
      70,
      chars.map(value =>
        // バウンドは friction を下げて出す。spring の行き過ぎがそのまま跳ね返り
        Animated.spring(value, {
          toValue: 1,
          friction: 4,
          tension: 140,
          useNativeDriver: true,
        })
      )
    );
    entrance.start();

    return () => entrance.stop();
  }, [visible, reduceMotion, chars]);

  // 点の波。文字が出揃うのを待たずに走らせる（待つと最初の1秒が無音になる）
  useEffect(() => {
    if (!visible || reduceMotion) return;

    const wave = Animated.loop(
      Animated.stagger(
        110,
        hops.map(value =>
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: 240,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(value, {
              toValue: 0,
              duration: 240,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        )
      )
    );
    wave.start();

    // ⚠️ 止めないとループは画面を離れても回り続ける
    return () => wave.stop();
  }, [visible, reduceMotion, hops]);

  if (!visible) return null;

  return (
    <View
      style={[styles.scrim, { top }]}
      // 素通しにしないこと。これが保存中の編集を止めている
      testID="saving-overlay"
      accessible
      accessibilityLabel={`保存中 ${saved} / ${total}枚`}
    >
      <View style={styles.label}>
        {LABEL.map((char, index) => (
          <Animated.Text
            key={char}
            style={[
              styles.char,
              {
                opacity: chars[index],
                transform: [
                  {
                    translateY: chars[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [RISE, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {char}
          </Animated.Text>
        ))}
      </View>

      <View style={styles.dots}>
        {hops.map((hop, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              index < saved && styles.dotFilled,
              {
                transform: [
                  { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -HOP] }) },
                ],
              },
            ]}
            testID={`saving-dot-${index}`}
          />
        ))}
      </View>

      <Text style={styles.count} testID="saving-count">{`${saved} / ${total}枚`}</Text>
    </View>
  );
}

const DOT_SIZE = 10;

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    // モーダルの地と同じ。別の濃さにすると同じアプリの中で覆いが2種類になる
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  label: {
    flexDirection: 'row',
    // 1文字ずつ動かすと字面が詰まって見えるので、少し開ける
    gap: spacing.xs,
  },
  char: {
    ...typography.h2,
    color: colors.white,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // 点が跳ねる分の高さを先に確保する。取らないと波で下の数字が揺れる
    height: DOT_SIZE + HOP,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dotFilled: {
    backgroundColor: colors.primary[500],
  },
  count: {
    ...typography.bodySmall,
    color: colors.white,
  },
});
