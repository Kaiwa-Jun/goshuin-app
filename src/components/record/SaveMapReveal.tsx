import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Polygon, G } from 'react-native-svg';

import { prefectureTier } from '@components/collection/JapanMap';
import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_BOXES,
  JAPAN_PREFECTURE_NAMES,
  JAPAN_PREFECTURE_PATHS,
} from '@/constants/japanMap';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';

/** 全国が見えている間 → 寄る → ピンが落ちる */
export const HOLD_MS = 560;
export const ZOOM_MS = 1100;
export const PIN_MS = 520;

/** 県そのものより広く取って「地方くらい」の寄りにする */
const REGION_SPAN = 5.5;
/** 尾の先が県を指す。形は地図タブのピン（scripts/generate-map-pins.py）と同じ */
const PIN_W = 84;
const PIN_H = 120;
const PIN_SCALE = 0.34;

export interface ZoomTarget {
  /** 寄せたあとの倍率 */
  scale: number;
  /** 県の中心を枠の中心へ持ってくるための移動量（描画後の px） */
  translateX: number;
  translateY: number;
}

/**
 * その県を枠の真ん中に持ってくる寄り。
 *
 * 枠の中心を軸に拡大されるので、拡大後の中心からのずれを打ち消す。
 */
export function zoomTo(prefecture: string, width: number): ZoomTarget {
  const box = JAPAN_PREFECTURE_BOXES[prefecture];
  const height = (width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;
  const k = width / JAPAN_MAP_WIDTH;
  const span = Math.max(box.width, box.height) * REGION_SPAN;
  const scale = JAPAN_MAP_WIDTH / span;
  const px = (box.x + box.width / 2) * k;
  const py = (box.y + box.height / 2) * k;

  return {
    scale,
    translateX: -scale * (px - width / 2),
    translateY: -scale * (py - height / 2),
  };
}

interface Props {
  /** 寄る先。いま記録した寺社の県 */
  prefecture: string;
  /** 県ごとの枚数（いま記録したぶんを含む） */
  stampCountByPrefecture: Record<string, number>;
  /** ピンの色。記録した寺社の種別に合わせる */
  spotType?: 'shrine' | 'temple';
  width: number;
}

/**
 * 保存した直後の地図。**全国 → その県へ寄る**。
 *
 * いきなり地方だけを出すと「自分の日本が埋まっていく」という一番効く感覚を、
 * 一番受け取りやすい瞬間に捨てることになる。先に全国を見せてから寄る。
 */
export function SaveMapReveal({
  prefecture,
  stampCountByPrefecture,
  spotType = 'shrine',
  width,
}: Props) {
  const height = (width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;
  const target = useMemo(() => zoomTo(prefecture, width), [prefecture, width]);

  const progress = useRef(new Animated.Value(0)).current;
  const pinDrop = useRef(new Animated.Value(0)).current;
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => {
        if (cancelled) return;
        // 動きを減らす設定なら、寄り終わった状態をすぐ出す
        if (reduce) {
          progress.setValue(1);
          pinDrop.setValue(1);
          setSettled(true);
          return;
        }
        Animated.sequence([
          Animated.delay(HOLD_MS),
          Animated.timing(progress, {
            toValue: 1,
            duration: ZOOM_MS,
            easing: Easing.bezier(0.35, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(pinDrop, {
            toValue: 1,
            duration: PIN_MS,
            easing: Easing.bezier(0.3, 0.9, 0.3, 1.1),
            useNativeDriver: true,
          }),
        ]).start(() => !cancelled && setSettled(true));
      })
      .catch(() => {
        progress.setValue(1);
        pinDrop.setValue(1);
        setSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [progress, pinDrop]);

  const zoomStyle = {
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, target.translateX],
        }),
      },
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, target.translateY],
        }),
      },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, target.scale] }) },
    ],
  };

  const pinStyle = {
    opacity: pinDrop,
    transform: [{ translateY: pinDrop.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }],
  };

  const tierOf = (name: string) => {
    // 寄り終わるまで、今回の県は色をつけない。ピンと同時に色づく
    if (name === prefecture && !settled) return 'empty';
    return prefectureTier(stampCountByPrefecture[name] ?? 0);
  };

  const pinColor = spotType === 'temple' ? colors.pin.templeVisited : colors.pin.shrineVisited;

  return (
    <View
      style={[styles.window, { width, height }]}
      testID="save-map"
      accessibilityLabel={`${prefecture}が色づきました`}
      accessible
    >
      <Animated.View style={zoomStyle}>
        <Svg width={width} height={height} viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`}>
          {JAPAN_PREFECTURE_NAMES.map(name => (
            <Path
              key={name}
              testID={`save-map-${name}`}
              d={JAPAN_PREFECTURE_PATHS[name]}
              fill={colors.prefectureFill[tierOf(name)]}
              stroke={colors.prefectureFill.border}
              strokeWidth={2}
            />
          ))}
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.pin,
          { left: width / 2 - (PIN_W * PIN_SCALE) / 2, top: height / 2 - PIN_H * PIN_SCALE },
          pinStyle,
        ]}
        pointerEvents="none"
        testID="save-map-pin"
      >
        <Svg width={PIN_W * PIN_SCALE} height={PIN_H * PIN_SCALE} viewBox={`0 0 ${PIN_W} ${PIN_H}`}>
          {/* 白フチ → 色。地図タブのピンと同じ重ね方 */}
          <G>
            <Circle cx={42} cy={44} r={41.5} fill={colors.white} />
            <Polygon points="15.5,54 68.5,54 42,124" fill={colors.white} />
            <Circle cx={42} cy={44} r={34} fill={pinColor} />
            <Polygon points="23,54 61,54 42,112" fill={pinColor} />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  window: {
    overflow: 'hidden',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundGrouped,
  },
  pin: { position: 'absolute' },
});
