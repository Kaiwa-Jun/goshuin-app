import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Polygon, G } from 'react-native-svg';

import { prefectureTier } from '@components/collection/JapanMap';
import { PrefectureEmboss } from '@components/common/PrefectureEmboss';
import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_NAMES,
  JAPAN_PREFECTURE_PATHS,
} from '@/constants/japanMap';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { prefectureScreenPoint, zoomToPrefecture } from '@utils/japanMapZoom';

/** 全国が見えている間 → 寄る → ピンが落ちる */
export const HOLD_MS = 560;
export const ZOOM_MS = 1100;
export const PIN_MS = 520;

/*
 * 1 枚目（firstStamp）だけ。寄り始めから少しして、その県が空押しでうっすら浮く。
 * ピンが落ちきったら、色が 0.6 秒で差し、空押しは引く（点滅しない。Issue #327 D-10）
 */
/** 寄り始めから空押しが浮き始めるまで */
export const EMBOSS_IN_DELAY_MS = 600;
export const EMBOSS_FADE_MS = 600;
export const TINT_FADE_MS = 600;

/** 尾の先が県を指す。形は地図タブのピン（scripts/generate-map-pins.py）と同じ */
const PIN_W = 84;
const PIN_H = 120;
const PIN_SCALE = 0.34;

interface Props {
  /** 寄る先。いま記録した寺社の県 */
  prefecture: string;
  /** 県ごとの枚数（いま記録したぶんを含む） */
  stampCountByPrefecture: Record<string, number>;
  /** いま記録した枚数。寄り終わるまでは、この分を引いた「前の濃さ」で出す */
  addedCount?: number;
  /** ピンの色。記録した寺社の種別に合わせる */
  spotType?: 'shrine' | 'temple';
  width: number;
  /** 寄り終わってピンが落ちたとき。枚数の数え上げをここに合わせる */
  onSettled?: () => void;
  /** 記録全体の 1 枚目。空押しから色が差す（Issue #327） */
  firstStamp?: boolean;
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
  addedCount = 1,
  spotType = 'shrine',
  width,
  onSettled,
  firstStamp = false,
}: Props) {
  const height = (width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;
  const target = useMemo(() => zoomToPrefecture(prefecture, width), [prefecture, width]);
  /*
   * ピンは**その県の上**に刺す。端の県は移動量を頭打ちにしていて中心まで
   * 寄り切らないので、枠の中心に置くと県から外れる
   */
  const pinPoint = useMemo(() => prefectureScreenPoint(prefecture, width), [prefecture, width]);

  const progress = useRef(new Animated.Value(0)).current;
  const pinDrop = useRef(new Animated.Value(0)).current;
  const embossOpacity = useRef(new Animated.Value(0)).current;
  const tintOpacity = useRef(new Animated.Value(0)).current;
  const [settled, setSettled] = useState(false);
  // 1 枚目は、色の層が差しきってから下の県を最後の濃さにする（上の層と同じ色なので見た目は変わらない）
  const [tinted, setTinted] = useState(false);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  const finish = useCallback(() => {
    setSettled(true);
    settledRef.current?.();
  }, []);
  const running = useRef<Animated.CompositeAnimation | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embossTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embossIn = useRef<Animated.CompositeAnimation | null>(null);
  const tintIn = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => {
        if (cancelled) return;
        // 動きを減らす設定なら、寄り終わった状態をすぐ出す
        if (reduce) {
          progress.setValue(1);
          pinDrop.setValue(1);
          if (firstStamp) {
            tintOpacity.setValue(1);
            embossOpacity.setValue(0);
            setTinted(true);
          }
          finish();
          return;
        }
        /*
         * ⚠️ Animated の delay を使わないこと。イージングを渡せないので既定の
         * Easing.ease になり、その遅延 require が jest.resetModules() の
         * あとに発火すると壊れる（全国を見せている間の「待ち」でしかないので、
         * ただの setTimeout で足りる）
         */
        holdTimer.current = setTimeout(() => {
          if (cancelled) return;
          running.current = Animated.sequence([
            Animated.timing(progress, {
              toValue: 1,
              duration: ZOOM_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(pinDrop, {
              toValue: 1,
              duration: PIN_MS,
              easing: Easing.out(Easing.back(1.4)),
              useNativeDriver: true,
            }),
          ]);
          running.current.start(() => {
            if (cancelled) return;
            finish();
            if (firstStamp) tint();
          });
        }, HOLD_MS);
        if (firstStamp) {
          embossTimer.current = setTimeout(() => {
            if (cancelled) return;
            embossIn.current = Animated.timing(embossOpacity, {
              toValue: 1,
              duration: EMBOSS_FADE_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            });
            embossIn.current.start();
          }, HOLD_MS + EMBOSS_IN_DELAY_MS);
        }
      })
      .catch(() => {
        progress.setValue(1);
        pinDrop.setValue(1);
        if (firstStamp) {
          tintOpacity.setValue(1);
          embossOpacity.setValue(0);
          setTinted(true);
        }
        finish();
      });

    // ピンが落ちきったら、色が差し、空押しが引く
    const tint = () => {
      embossIn.current?.stop();
      tintIn.current = Animated.parallel([
        Animated.timing(tintOpacity, {
          toValue: 1,
          duration: TINT_FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(embossOpacity, {
          toValue: 0,
          duration: EMBOSS_FADE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      tintIn.current.start(({ finished }) => {
        if (finished && !cancelled) setTinted(true);
      });
    };

    /*
     * 外れたら必ず止める。止めないとタイマーが生き残り、画面が無くなった
     * あとに動き続ける（テストでは別のテストの最中に発火して、Easing の
     * 遅延 require を壊した）
     */
    return () => {
      cancelled = true;
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (embossTimer.current) clearTimeout(embossTimer.current);
      running.current?.stop();
      running.current = null;
      embossIn.current?.stop();
      tintIn.current?.stop();
    };
  }, [progress, pinDrop, embossOpacity, tintOpacity, firstStamp, finish]);

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

  /*
   * 寄り終わるまで、今回の県は**記録する前の濃さ**で出す。ピンと同時に濃くなる。
   * 初めての県なら「まだ」の灰から色がつく。
   *
   * 試作には朱の点滅があったが、入れていない。理由は
   * docs/issues/issue-209-ayumi-japan-map.md の「朱の点滅を入れない理由」
   */
  const revealed = firstStamp ? tinted : settled;
  const tierOf = (name: string) => {
    const count = stampCountByPrefecture[name] ?? 0;
    if (name === prefecture && !revealed) return prefectureTier(count - addedCount);
    return prefectureTier(count);
  };

  const pinColor = spotType === 'temple' ? colors.pin.templeVisited : colors.pin.shrineVisited;
  const paintedCount = JAPAN_PREFECTURE_NAMES.filter(
    name => (stampCountByPrefecture[name] ?? 0) > 0
  ).length;

  return (
    <View
      style={[styles.window, { width, height }]}
      testID="save-map"
      accessibilityLabel={`${prefecture}がいま色づきました。47都道府県のうち${paintedCount}県`}
      accessible
    >
      <Animated.View style={zoomStyle} testID="save-reveal-zoom">
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
        {/*
         * 1 枚目の空押しと色の層。寄りと一緒に動くよう、ここ（ピンより下）に重ねる。
         * 動かすのは層の opacity だけ（native driver）。SVG の fill は動かさない
         */}
        {firstStamp && (
          <>
            <Animated.View
              testID="save-reveal-emboss"
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { opacity: embossOpacity }]}
            >
              <Svg
                width={width}
                height={height}
                viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`}
              >
                <PrefectureEmboss prefecture={prefecture} offset={2.5} shadeOpacity={0.26} />
              </Svg>
            </Animated.View>
            <Animated.View
              testID="save-reveal-tint"
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { opacity: tintOpacity }]}
            >
              <Svg
                width={width}
                height={height}
                viewBox={`0 0 ${JAPAN_MAP_WIDTH} ${JAPAN_MAP_HEIGHT}`}
              >
                <Path
                  d={JAPAN_PREFECTURE_PATHS[prefecture]}
                  fill={
                    colors.prefectureFill[prefectureTier(stampCountByPrefecture[prefecture] ?? 0)]
                  }
                  stroke={colors.prefectureFill.border}
                  strokeWidth={2}
                />
              </Svg>
            </Animated.View>
          </>
        )}
      </Animated.View>

      <Animated.View
        style={[
          styles.pin,
          { left: pinPoint.x - (PIN_W * PIN_SCALE) / 2, top: pinPoint.y - PIN_H * PIN_SCALE },
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
