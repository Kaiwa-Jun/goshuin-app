import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Defs, G, Mask, Path, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';

import { MapPin } from '@components/onboarding/MapPin';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { colors } from '@theme/colors';

/**
 * 「近くの寺社を見つけます。」
 *
 * **ここだけは本物の地図を出せない**。位置情報の許可をもらう前なので、
 * その人の周りを本当に表示することはできない。だから地は描いたものだが、
 * 色は `assets/map-style.json` の実際の値を使う。
 *
 * ⚠️ 以前ここに #fafafa / #dddddd を「地図と同じ色」として置いていたが、
 * あれは **鉄道レイヤ**の色だった。色の出現回数を数えただけで、
 * どのレイヤのものか見ていなかった
 */

/** 地 background / 建物 building / 幹線の縁 highway_major_casing / 幹線 highway_major_inner */
const GROUND = 'rgb(242,243,240)';
const BUILDING = 'rgb(234,234,229)';
const ROAD_CASING = 'rgb(213,213,213)';
const ROAD_INNER = '#fff';
const ROAD_MINOR = 'hsl(0,0%,88%)';
/** water / park / landcover_wood */
const WATER = '#A9CFE8';
const PARK = '#D2E7CB';
const WOOD = '#C3DCBA';

const SIZE = 250;
const RIPPLE_MS = 2400;
const RIPPLE_COUNT = 3;
const PIN_STEP_MS = 260;

const NEAR_PINS = [
  { key: 'a', left: 0.1, top: 0.16 },
  { key: 'b', left: 0.74, top: 0.3 },
  { key: 'c', left: 0.26, top: 0.7 },
] as const;

interface Props {
  width: number;
  active: boolean;
}

export function NearbyArt({ width, active }: Props) {
  const reduceMotion = useReduceMotion();
  const ripples = useRef(Array.from({ length: RIPPLE_COUNT }, () => new Animated.Value(0))).current;
  const pins = useRef(NEAR_PINS.map(() => new Animated.Value(0))).current;

  const size = Math.min(width, SIZE);
  const pinHeight = size * 0.13;

  useEffect(() => {
    if (!active) {
      ripples.forEach(v => v.setValue(0));
      pins.forEach(v => v.setValue(0));
      return;
    }
    if (reduceMotion) {
      // 波紋は出さない。ピンは出す（消すのは動きだけで、情報は落とさない）
      ripples.forEach(v => v.setValue(0));
      pins.forEach(v => v.setValue(1));
      return;
    }

    const loops = ripples.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i * RIPPLE_MS) / RIPPLE_COUNT),
          Animated.timing(value, {
            toValue: 1,
            duration: RIPPLE_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    const drops = Animated.stagger(
      PIN_STEP_MS,
      pins.map(value =>
        Animated.timing(value, {
          toValue: 1,
          duration: 450,
          delay: 600,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        })
      )
    );
    loops.forEach(l => l.start());
    drops.start();
    return () => {
      loops.forEach(l => l.stop());
      drops.stop();
    };
  }, [active, reduceMotion, ripples, pins]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]} testID="onboarding-art-nearby">
      <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} testID="onboarding-ground">
        <Defs>
          {/* 四角いカードが貼ってあるように見せない。外周を丸くぼかす */}
          <RadialGradient id="fade" cx="50%" cy="50%" r="50%">
            <Stop offset="52%" stopColor="#fff" stopOpacity={1} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
          <Mask id="nearby-fade">
            <Rect width={SIZE} height={SIZE} fill="url(#fade)" />
          </Mask>
        </Defs>
        <G mask="url(#nearby-fade)">
          <Rect width={SIZE} height={SIZE} fill={GROUND} />
          <Path
            d="M0 196 C60 186 96 214 148 206 C196 199 222 214 250 208 L250 250 L0 250 Z"
            fill={WATER}
          />
          <Rect x={16} y={24} width={58} height={44} rx={3} fill={PARK} />
          <Rect x={170} y={128} width={52} height={40} rx={3} fill={WOOD} />
          <G fill={BUILDING}>
            <Rect x={108} y={30} width={22} height={18} />
            <Rect x={152} y={66} width={18} height={16} />
            <Rect x={58} y={112} width={20} height={16} />
            <Rect x={200} y={46} width={16} height={20} />
          </G>
          <G stroke={ROAD_MINOR} strokeWidth={3.5}>
            <Path d="M-10 52 H260" />
            <Path d="M140 -10 V260" />
            <Path d="M-10 124 H260" />
          </G>
          <G stroke={ROAD_CASING} strokeWidth={9} strokeLinecap="round">
            <Path d="M-10 92 H260" />
            <Path d="M-10 158 H260" />
            <Path d="M96 -10 V260" />
            <Path d="M186 -10 V260" />
            <Path d="M40 -10 V196" />
          </G>
          <G stroke={ROAD_INNER} strokeWidth={6} strokeLinecap="round">
            <Path d="M-10 92 H260" />
            <Path d="M-10 158 H260" />
            <Path d="M96 -10 V260" />
            <Path d="M186 -10 V260" />
            <Path d="M40 -10 V196" />
          </G>
        </G>
      </Svg>

      {ripples.map((value, i) => (
        <Animated.View
          key={i}
          testID="onboarding-wave"
          pointerEvents="none"
          style={[
            styles.wave,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [
                { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.18, 1] }) },
              ],
            },
          ]}
        />
      ))}

      <View style={[styles.me, { backgroundColor: colors.pin.currentLocation }]} />

      {NEAR_PINS.map((p, i) => (
        <Animated.View
          key={p.key}
          testID="onboarding-near-pin"
          pointerEvents="none"
          style={[
            styles.near,
            {
              left: size * p.left,
              top: size * p.top,
              opacity: pins[i],
              transform: [
                {
                  translateY: pins[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [-pinHeight * 0.8, 0],
                  }),
                },
                { scale: pins[i] },
              ],
            },
          ]}
        >
          {/* 未訪問はブランド色1色。神社と寺で分けないのが実物 */}
          <MapPin height={pinHeight} color={colors.pin.unvisited} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  wave: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  /*
   * 絶対配置にしないと、地図（Svg）の**下に**並んでしまう。
   * 波紋と同じく地図に重ねる
   */
  me: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
  },
  near: { position: 'absolute' },
});
