import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

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

/** 24px のアイコン枠に対する、組み立てた本のページ1枚の寸法（book グリフに寄せる） */
const PAGE_WIDTH_RATIO = 0.46;
const PAGE_HEIGHT_RATIO = 0.68;
/** 背（綴じ目）の隙間 */
const SPINE_GAP_RATIO = 0.05;

/**
 * タブごとの「直前にアクティブだったか」。
 * タブバーのアイコンは再マウントされることがあり、コンポーネント内に持つと
 * 直前の状態が消えてしまうのでモジュール側に置く
 */
const lastActive = new Map<string, boolean>();

/** テスト用。モジュールに溜まった直前状態を捨てる */
export function resetTabBarIconMotion() {
  lastActive.clear();
}

export type TabIconMotion = 'spin' | 'open-book' | 'gear';

interface TabBarIconProps {
  name: IconName;
  /** このアイコンが属するタブの route 名。選択の変化を拾うのに使う */
  routeName: string;
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
  const [reduceMotion, setReduceMotion] = useState(false);

  // 「視差効果を減らす」がオンなら動かさない（色の切り替えだけにする）
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

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
      duration: motion === 'spin' ? SPIN_DURATION_MS : OPEN_DURATION_MS,
      // 回転は行き過ぎて戻す（方位磁針が揺れて落ち着く）。本は素直に開く
      easing: motion === 'spin' ? Easing.out(Easing.back(2)) : Easing.inOut(Easing.cubic),
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
