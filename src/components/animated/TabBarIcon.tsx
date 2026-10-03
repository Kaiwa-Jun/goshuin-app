import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { useNavigationState } from '@react-navigation/native';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { MaterialIcons } from '@expo/vector-icons';

import type { MainTabParamList } from '@/navigation/types';
import { colors } from '@theme/colors';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** コンパスが1周して、行き過ぎてから落ち着くまで */
const SPIN_DURATION_MS = 700;
/** 本が閉じた状態から開ききるまで。認知できる速さにする */
const OPEN_DURATION_MS = 900;
/** 歯車が1歯ぶん回るまで。噛み合って止まる機械なので短く硬く */
const GEAR_DURATION_MS = 320;
/** 1タップで進む角度。settings の歯車は6歯なので 60° = ちょうど1歯分。
 * 回る前と後で見た目が完全に一致するため、傾いたまま残らない */
const GEAR_DETENT_DEG = 60;
/** 道が引かれきるまで */
const DRAW_DURATION_MS = 620;
/** 日付の四角が空押しされ、朱が差し、タブの色に戻るまで（#305） */
const EMBOSS_DURATION_MS = 600;
/** 押した瞬間に朱を差すか。朱をやめるなら、朱の層ごと描かない */
const EMBOSS_SEAL = true;

/** Material Icons `event` の枠（日付の四角を除いたもの）。24 の格子 */
const EVENT_FRAME_PATH =
  'M16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z';
/** `event` の日付の四角（24 の格子の x12〜17・y12〜17） */
const EVENT_SQUARE_ORIGIN = 12;
const EVENT_SQUARE_SIZE = 5;

interface Knot {
  at: number;
  value: number;
  /** 前の節からこの節までの進み方。無ければ一定の速さ */
  easing?: (t: number) => number;
}

/**
 * 節ごとの easing を、interpolate の節に焼き込む。
 * native driver の interpolate は easing を受け取れないので、
 * 時間は一定の速さで進め、形は細かい節で持たせる
 */
function bake(knots: Knot[], steps = 8) {
  const inputRange = [knots[0].at];
  const outputRange = [knots[0].value];
  for (let i = 1; i < knots.length; i++) {
    const from = knots[i - 1];
    const to = knots[i];
    if (to.easing) {
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        inputRange.push(from.at + (to.at - from.at) * t);
        outputRange.push(from.value + (to.value - from.value) * to.easing(t));
      }
    }
    inputRange.push(to.at);
    outputRange.push(to.value);
  }
  return { inputRange, outputRange };
}

// 試作 docs/design/mockups/2026-10-plan-tab-icon-v2.html の D と同じ値
const settle = Easing.bezier(0.22, 1, 0.36, 1);
const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);
/** 輪郭: 少し大きいところから、うっすら押される。色が入ったら溶ける */
const EMBOSS_RING_OPACITY = bake([
  { at: 0, value: 0 },
  { at: 0.35, value: 0.55, easing: settle },
  { at: 0.75, value: 0.55 },
  { at: 1, value: 0 },
]);
const EMBOSS_RING_SCALE = bake([
  { at: 0, value: 1.12 },
  { at: 0.35, value: 1, easing: settle },
  { at: 1, value: 1 },
]);
/** 朱: 輪郭のあとから差し、入りきったらすぐ引く */
const EMBOSS_SEAL_OPACITY = bake([
  { at: 0, value: 0 },
  { at: 0.3, value: 0 },
  { at: 0.65, value: 1, easing: easeInOut },
  { at: 1, value: 0, easing: easeInOut },
]);
/** 四角（タブの色）: 朱の下で入れ替わり、朱が引くと見えてくる */
const EMBOSS_SQUARE_OPACITY = { inputRange: [0, 0.64, 0.65, 1], outputRange: [0, 0, 1, 1] };

/** 24px のアイコン枠に対する、組み立てた本のページ1枚の寸法（book グリフに寄せる） */
const PAGE_WIDTH_RATIO = 0.46;
const PAGE_HEIGHT_RATIO = 0.68;
/** 背（綴じ目）の隙間 */
const SPINE_GAP_RATIO = 0.05;

/**
 * タブごとの「直前にアクティブだったか」。
 * タブバーのアイコンは再マウントされることがあり、コンポーネント内に持つと
 * 直前の状態が消えてしまうのでモジュール側に置く。
 *
 * 前提: TabNavigator はアプリに1つで、route 名は静的。複数のタブナビゲータで
 * 同じ route 名を使うと互いに汚染する。テストでは resetTabBarIconMotion() を呼ぶこと
 */
const lastActive = new Map<string, boolean>();

/** テスト用。モジュールに溜まった直前状態を捨てる */
export function resetTabBarIconMotion() {
  lastActive.clear();
}

export type TabIconMotion = 'spin' | 'open-book' | 'gear' | 'draw' | 'emboss';

interface TabBarIconProps {
  name: IconName;
  /** このアイコンが属するタブの route 名。選択の変化を拾うのに使う */
  routeName: keyof MainTabParamList;
  color: string;
  focused: boolean;
  motion: TabIconMotion;
  size?: number;
}

/**
 * 選択された瞬間だけ動く下タブのアイコン。
 *
 * 発火の判定に `focused` prop を使っていないのは、React Navigation が
 * **アイコンを active / inactive の2枚重ねで描き、opacity だけをクロスフェード
 * させている**ため（`BottomTabItem` → `TabBarIcon`）。各インスタンスの
 * `focused` は固定値で、タブを切り替えても変化しない。
 * 実際の選択状態はナビゲーションの state から取る。
 *
 * ⚠️ これは公開 API ではなく内部実装への依存。`@react-navigation/bottom-tabs`
 * 7.12.0 で確認。上げるときは `views/TabBarIcon.tsx` の2枚重ねが残っているか
 * 見ること。変わっていると発火しなくなるが、テストでは気づけない可能性がある。
 *
 * 一過性のアニメーションだけを持ち、常時動き続けるものは置かない
 * （#99 追補3: 無限ループのアニメがネイティブメモリを食い潰した）。
 */
export function TabBarIcon({
  name,
  routeName,
  color,
  focused,
  motion,
  size = 24,
}: TabBarIconProps) {
  const isActive = useNavigationState(state => state?.routes[state.index]?.name === routeName);
  // spin / open-book: 0 = 動き始め、1 = 落ち着いた状態（静止時は常に 1）
  // gear: タップのたびに 1 ずつ増える。1 = 歯1つ分
  const progress = useRef(new Animated.Value(motion === 'gear' ? 0 : 1)).current;
  const gearSteps = useRef(0);
  // 「視差効果を減らす」がオンなら動かさない（色の切り替えだけにする）
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    // 重なっている2枚のうち、非アクティブ側の複製では動かさない
    if (!focused) return;

    const previous = lastActive.get(routeName);
    lastActive.set(routeName, isActive);

    // previous === undefined は初回。起動直後に勝手に動かないようにする
    if (!isActive || previous !== false || reduceMotion) return;

    if (motion === 'gear') {
      // 歯車は戻さず、押すたびに1歯ぶん進める。行き過ぎて戻ることで
      // 「噛み合ってカチッと止まる」感じになる
      gearSteps.current += 1;
      Animated.timing(progress, {
        toValue: gearSteps.current,
        duration: GEAR_DURATION_MS,
        easing: Easing.out(Easing.back(2.6)),
        useNativeDriver: true,
      }).start();
      return;
    }

    // 連打されても毎回先頭から。走行中のものは setValue で打ち切られる
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration:
        motion === 'spin'
          ? SPIN_DURATION_MS
          : motion === 'draw'
            ? DRAW_DURATION_MS
            : motion === 'emboss'
              ? EMBOSS_DURATION_MS
              : OPEN_DURATION_MS,
      // 回転は行き過ぎて戻す（方位磁針が揺れて落ち着く）。
      // 本は素直に開き、道は書き終わりで筆を止めるように減速する。
      // 空押しは層ごとに進み方が違うので、時間は一定にして形は節に持たせる
      easing:
        motion === 'spin'
          ? Easing.out(Easing.back(2))
          : motion === 'draw'
            ? Easing.out(Easing.cubic)
            : motion === 'emboss'
              ? Easing.linear
              : Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [focused, isActive, motion, reduceMotion, routeName, progress]);

  if (motion === 'gear') {
    const rotate = progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', `${GEAR_DETENT_DEG}deg`],
      // 押すたびに進むので、1 を超えても外挿させる
      extrapolate: 'extend',
    });
    return (
      <Animated.View style={{ transform: [{ rotate }] }} testID={`tab-icon-${name}`}>
        <MaterialIcons name={name} size={size} color={color} />
      </Animated.View>
    );
  }

  if (motion === 'emboss') {
    // 予定に印を捺す。勢いは付けず、先に日付の四角の輪郭だけがうっすら押され（空押し）、
    // あとから朱が差して、タブの色に戻る。グリフの一部だけは動かせないので、
    // event の枠を SVG で描き、日付の四角を View で重ねる（形はフォントのグリフと一致する）
    const unit = size / 24;
    const squareBox = {
      left: EVENT_SQUARE_ORIGIN * unit,
      top: EVENT_SQUARE_ORIGIN * unit,
      width: EVENT_SQUARE_SIZE * unit,
      height: EVENT_SQUARE_SIZE * unit,
    };
    return (
      <View style={{ width: size, height: size }} testID={`tab-icon-${name}`}>
        <Svg width={size} height={size} viewBox="0 0 24 24" testID={`tab-icon-${name}-frame`}>
          <Path d={EVENT_FRAME_PATH} fill={color} />
        </Svg>
        <Animated.View
          testID={`tab-icon-${name}-ring`}
          style={[
            styles.embossLayer,
            squareBox,
            {
              borderWidth: unit,
              borderColor: color,
              opacity: progress.interpolate(EMBOSS_RING_OPACITY),
              transform: [{ scale: progress.interpolate(EMBOSS_RING_SCALE) }],
            },
          ]}
        />
        <Animated.View
          testID={`tab-icon-${name}-square`}
          style={[
            styles.embossLayer,
            squareBox,
            { backgroundColor: color, opacity: progress.interpolate(EMBOSS_SQUARE_OPACITY) },
          ]}
        />
        {EMBOSS_SEAL && (
          <Animated.View
            testID={`tab-icon-${name}-seal`}
            style={[
              styles.embossLayer,
              squareBox,
              {
                backgroundColor: colors.seal,
                opacity: progress.interpolate(EMBOSS_SEAL_OPACITY),
              },
            ]}
          />
        )}
      </View>
    );
  }

  if (motion === 'draw') {
    // 道が左から引かれていく。グリフの一部だけを動かすことはできないので、
    // 背景色の板でアイコンを覆っておき、それを右へ滑らせて出していく。
    // width を動かすとネイティブドライバが使えないため translateX にしている。
    // アプリは userInterfaceStyle: 'light' 固定なので、覆う色は白で足りる
    const revealX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, size + 2],
    });
    return (
      <Animated.View
        style={[styles.drawWrapper, { width: size, height: size }]}
        testID={`tab-icon-${name}`}
      >
        <MaterialIcons name={name} size={size} color={color} />
        <Animated.View
          style={[
            styles.drawCover,
            {
              width: size + 2,
              backgroundColor: colors.white,
              transform: [{ translateX: revealX }],
            },
          ]}
        />
      </Animated.View>
    );
  }

  if (motion === 'spin') {
    const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
      <Animated.View style={{ transform: [{ rotate }] }} testID={`tab-icon-${name}`}>
        <MaterialIcons name={name} size={size} color={color} />
      </Animated.View>
    );
  }

  // 本を開く。グリフの差し替えでは「開いていく途中」が描けないので、
  // 表紙を2枚の板として組み立て、綴じ目を軸に回して実際に開く。
  // 開ききる直前で本来の menu-book グリフへ渡し、静止状態は今までどおりにする
  const pageWidth = size * PAGE_WIDTH_RATIO;
  const pageHeight = size * PAGE_HEIGHT_RATIO;
  const spineGap = size * SPINE_GAP_RATIO;

  // 180° = 右ページに重なって閉じている / 0° = 左に開ききっている。
  // 180°→90° の間は右ページに重なったままで見た目が変わらない（死に時間）ので、
  // そこを短く済ませ、実際に左へ開いて見える 90°→0° に時間を割く
  const coverRotate = progress.interpolate({
    inputRange: [0, 0.22, 1],
    outputRange: ['180deg', '96deg', '0deg'],
  });
  // 表紙が持ち上がる間、本全体もわずかに起き上がる。前半を止まって見せない
  const bookTilt = progress.interpolate({
    inputRange: [0, 0.22, 1],
    outputRange: ['-10deg', '-7deg', '0deg'],
  });
  const bookScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });

  // 両端は本物のグリフに渡す。閉じ側は book（しおり付き）、開き側は menu-book。
  // どちらも輪郭が一致するタイミングで入れ替えるので切り替わりに気づかない
  const closedGlyphOpacity = progress.interpolate({
    inputRange: [0, 0.07, 0.12],
    outputRange: [1, 1, 0],
  });
  const builtOpacity = progress.interpolate({
    inputRange: [0, 0.07, 0.12, 0.86, 0.92],
    outputRange: [0, 0, 1, 1, 0],
  });
  const glyphOpacity = progress.interpolate({
    inputRange: [0.86, 0.92, 1],
    outputRange: [0, 1, 1],
  });

  const pageStyle = { width: pageWidth, height: pageHeight, backgroundColor: color };

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: [{ perspective: size * 10 }, { rotateZ: bookTilt }, { scale: bookScale }],
      }}
      testID={`tab-icon-${name}`}
    >
      <Animated.View style={[styles.bookFrame, { opacity: closedGlyphOpacity }]}>
        <MaterialIcons name="book" size={size} color={color} />
      </Animated.View>

      <Animated.View style={[styles.bookFrame, styles.bookRow, { opacity: builtOpacity }]}>
        {/* 左ページ（表紙）。綴じ目＝自分の右端を軸に回す */}
        <Animated.View
          style={[
            pageStyle,
            styles.pageLeft,
            {
              transform: [
                { perspective: size * 8 },
                { translateX: pageWidth / 2 },
                { rotateY: coverRotate },
                { translateX: -pageWidth / 2 },
              ],
            },
          ]}
        />
        <Animated.View style={{ width: spineGap }} />
        {/* 右ページは動かない（本を押さえている側） */}
        <Animated.View style={[pageStyle, styles.pageRight]} />
      </Animated.View>

      <Animated.View style={[styles.bookFrame, { opacity: glyphOpacity }]}>
        <MaterialIcons name={name} size={size} color={color} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  embossLayer: {
    position: 'absolute',
  },
  drawWrapper: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawCover: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    left: -1,
  },
  bookFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookRow: {
    flexDirection: 'row',
  },
  pageLeft: {
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  pageRight: {
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});
