import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { GoshuinArt } from '@components/onboarding/GoshuinArt';
import { MapPin, PIN_RATIO, PIN_TIP } from '@components/onboarding/MapPin';
import { PrefectureMap } from '@components/onboarding/PrefectureMap';
import { JAPAN_MAP_HEIGHT, JAPAN_MAP_WIDTH, JAPAN_PREFECTURE_BOXES } from '@/constants/japanMap';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { colors } from '@theme/colors';

/**
 * 「写真を1枚。それだけ。」
 *
 * 御朱印が出る → 引っ込む → 地図が出る → ピンが刺さる。
 * 重ならないよう順に出す（試作では御朱印が地図に重なったままだった。
 * style で opacity を書いても animation-fill-mode が勝っていた）。
 */

/** 段取り。前の動きが終わってから次を始める */
const SHOT_IN_MS = 200;
const SHOT_OUT_MS = 1250;
const MAP_IN_MS = 1600;
const PIN_DROP_MS = 2150;

/** ピンを刺す先。県の枠から引く（手で書いた座標を持たない） */
const TOKYO = JAPAN_PREFECTURE_BOXES['東京都'];
const PIN_TARGET = {
  x: (TOKYO.x + TOKYO.width / 2) / JAPAN_MAP_WIDTH,
  y: (TOKYO.y + TOKYO.height / 2) / JAPAN_MAP_HEIGHT,
} as const;

interface Props {
  width: number;
  /** この画が見えているか。離れたら最初から出し直す */
  active: boolean;
}

export function RecordArt({ width, active }: Props) {
  const reduceMotion = useReduceMotion();
  const shot = useRef(new Animated.Value(0)).current;
  const map = useRef(new Animated.Value(0)).current;
  const pin = useRef(new Animated.Value(0)).current;

  const mapWidth = width * 0.78;
  const mapHeight = (mapWidth * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;
  const pinHeight = mapWidth * 0.19;

  useEffect(() => {
    if (!active) {
      shot.setValue(0);
      map.setValue(0);
      pin.setValue(0);
      return;
    }
    if (reduceMotion) {
      // 動きは消すが、出るものは出す。最後の絵（地図とピン）で止める
      shot.setValue(0);
      map.setValue(1);
      pin.setValue(1);
      return;
    }

    const step = (value: Animated.Value, to: number, duration: number, delay: number) =>
      Animated.timing(value, {
        toValue: to,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    const running = Animated.parallel([
      step(shot, 1, 550, SHOT_IN_MS),
      step(shot, 0, 450, SHOT_OUT_MS),
      step(map, 1, 500, MAP_IN_MS),
      step(pin, 1, 500, PIN_DROP_MS),
    ]);
    running.start();
    return () => running.stop();
  }, [active, reduceMotion, shot, map, pin]);

  return (
    <View style={[styles.wrap, { width, height: mapHeight }]} testID="onboarding-art-record">
      <Animated.View
        testID="onboarding-minimap"
        style={[styles.layer, { opacity: map }]}
        pointerEvents="none"
      >
        {/*
         * 地図とピンは、地図の実寸ちょうどの入れ物に入れる。
         * 中央寄せの層に直接置くと、left/top が地図ではなく層からの
         * 距離になって、ピンが地図の外に出る
         */}
        <View style={{ width: mapWidth, height: mapHeight }}>
          <PrefectureMap width={mapWidth} animate={false} blank />
          {/*
           * 割合で置くと SVG の実寸に依存して先端が海に落ちる（試作でそうなった）。
           * 県の枠から引いた東京都の中心に、ピンの**先端**が来るようにする
           */}
          <Animated.View
            testID="onboarding-pin"
            style={[
              styles.pin,
              {
                left: mapWidth * PIN_TARGET.x - pinHeight * PIN_RATIO * PIN_TIP.x,
                top: mapHeight * PIN_TARGET.y - pinHeight * PIN_TIP.y,
                opacity: pin,
                transform: [
                  {
                    translateY: pin.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-pinHeight, 0],
                    }),
                  },
                  {
                    scale: pin.interpolate({
                      inputRange: [0, 0.6, 1],
                      outputRange: [0.5, 1.06, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <MapPin height={pinHeight} color={colors.pin.shrineVisited} />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View
        testID="onboarding-goshuin"
        style={[
          styles.layer,
          {
            opacity: shot,
            transform: [
              { translateY: shot.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              { scale: shot.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <GoshuinArt width={width * 0.45} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  layer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pin: { position: 'absolute' },
});
