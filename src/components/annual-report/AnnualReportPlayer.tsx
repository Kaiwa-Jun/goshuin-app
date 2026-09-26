import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '@hooks/useReduceMotion';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import {
  END_SETTLE_MS,
  FINAL_CLOCK_MS,
  OPEN_MS,
  PAUSE_TAG_DELAY_MS,
  SCENE_MS,
  TAP_MAX_MS,
  type AnnualReport,
  type AnnualSceneId,
} from '@utils/annualReport';

import { easeOut, type Clock } from './motion';
import { ProgressBars } from './ProgressBars';
import { CloseButton } from './ReportButtons';

interface Props {
  report: AnnualReport;
  onClose: () => void;
}

/** 1つのシーンの再生。シーンごとに時計を1本持つ（D-11） */
interface Run {
  index: number;
  clock: Clock;
  key: number;
}

/** 時計がここまで進んだらシーンの動きは終わり。締めは自動で次へ行かず、中の動きの分だけ進める */
const clockEnd = (id: AnnualSceneId) => (id === 'end' ? END_SETTLE_MS : SCENE_MS[id]);

/**
 * 年報の再生（Issue #274 D-11・D-12・D-23）。
 *
 * 自動で進む。押している間は止まる。左 1/3 を短く押すと前のシーンの頭、それ以外で次。
 * 視差効果を減らす がオンなら（途中でオンになっても）各シーンの最後の形をすぐ出し、
 * 自動では進まない（押して進める）
 */
export function AnnualReportPlayer({ report, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const reduceRef = useRef(reduceMotion);
  reduceRef.current = reduceMotion;

  const scenes = report.scenes;
  const last = scenes.length - 1;

  const keyRef = useRef(0);
  const makeRun = useCallback((index: number): Run => {
    keyRef.current += 1;
    return {
      index,
      clock: new Animated.Value(reduceRef.current ? FINAL_CLOCK_MS : 0),
      key: keyRef.current,
    };
  }, []);
  const [run, setRun] = useState<Run>(() => makeRun(0));

  const goTo = useCallback(
    (index: number) => setRun(makeRun(Math.max(0, Math.min(last, index)))),
    [makeRun, last]
  );

  /** 時計を今の値から、そのシーンの終わりまで進める。止めたあとの再開も同じ */
  const play = useCallback(
    (target: Run) => {
      const id = scenes[target.index];
      const to = clockEnd(id);
      target.clock.stopAnimation(current => {
        if (current >= to) return;
        Animated.timing(target.clock, {
          toValue: to,
          duration: to - current,
          easing: Easing.linear,
          useNativeDriver: false,
        }).start(({ finished }) => {
          // 止めた（押した・シーンが替わった・画面を閉じた）ときは finished が false
          if (finished && id !== 'end') goTo(target.index + 1);
        });
      });
    },
    [scenes, goTo]
  );

  useEffect(() => {
    if (reduceMotion) {
      run.clock.stopAnimation();
      run.clock.setValue(FINAL_CLOCK_MS);
      return;
    }
    play(run);
    return () => run.clock.stopAnimation();
  }, [run, reduceMotion, play]);

  // 画面の外れでは、listener（数え上げ）も外す
  useEffect(() => () => run.clock.removeAllListeners(), [run]);

  /* ── 開く動き（時計とは別の値。視差効果を減らす では動かさない） ── */
  const open = useRef(new Animated.Value(0)).current;
  const playOpen = useCallback(() => {
    open.stopAnimation();
    if (reduceRef.current) {
      open.setValue(1);
      return;
    }
    open.setValue(0);
    Animated.timing(open, {
      toValue: 1,
      duration: OPEN_MS,
      easing: easeOut,
      useNativeDriver: false,
    }).start();
  }, [open]);

  useEffect(() => {
    playOpen();
    return () => open.stopAnimation();
  }, [playOpen, open]);

  useEffect(() => {
    if (!reduceMotion) return;
    open.stopAnimation();
    open.setValue(1);
  }, [reduceMotion, open]);

  /* ── 押す操作（D-12） ── */
  const [paused, setPaused] = useState(false);
  const pressedAt = useRef<number | null>(null);
  const pausedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPausedTimer = () => {
    if (pausedTimer.current) clearTimeout(pausedTimer.current);
    pausedTimer.current = null;
  };
  useEffect(() => clearPausedTimer, []);

  const handlePressIn = () => {
    pressedAt.current = Date.now();
    run.clock.stopAnimation();
    clearPausedTimer();
    // 視差効果を減らす では何も動いていないので出さない
    if (!reduceRef.current) {
      pausedTimer.current = setTimeout(() => setPaused(true), PAUSE_TAG_DELAY_MS);
    }
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    const held = pressedAt.current === null ? Infinity : Date.now() - pressedAt.current;
    pressedAt.current = null;
    clearPausedTimer();
    setPaused(false);

    if (held < TAP_MAX_MS) {
      if (event.nativeEvent.pageX < width / 3) {
        goTo(run.index - 1);
        return;
      }
      if (run.index < last) {
        goTo(run.index + 1);
        return;
      }
    }
    if (!reduceRef.current) play(run);
  };

  /** もう一度見る: 最初のシーンの頭から、開く動きも */
  const restart = useCallback(() => {
    goTo(0);
    playOpen();
  }, [goTo, playOpen]);

  const id = scenes[run.index];

  return (
    <Animated.View
      testID="annual-report"
      style={[
        styles.root,
        {
          opacity: open,
          transform: [{ scale: open.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
        },
      ]}
    >
      <View style={[styles.barsWrap, { top: insets.top + 4 }]}>
        <ProgressBars
          count={scenes.length}
          index={run.index}
          clock={run.clock}
          sceneMs={SCENE_MS[id]}
          full={reduceMotion}
        />
      </View>

      <Pressable
        testID="annual-report-stage"
        style={[styles.stage, { top: insets.top + 30, bottom: insets.bottom }]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View key={run.key} style={styles.scene} testID={`annual-report-scene-${id}`}>
          {renderScene(id, { report, clock: run.clock, onAgain: restart, onClose })}
        </View>
      </Pressable>

      <CloseButton onPress={onClose} top={insets.top + 14} />

      {paused && (
        <View style={styles.pausedWrap} pointerEvents="none">
          <View testID="annual-report-paused" style={styles.paused}>
            <View testID="annual-report-paused-bg" style={styles.pausedBg} />
            <Text style={styles.pausedText}>止まっています</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

export interface SceneProps {
  report: AnnualReport;
  clock: Clock;
  onAgain: () => void;
  onClose: () => void;
}

function renderScene(id: AnnualSceneId, { report }: SceneProps) {
  // シーンの中身は S5〜S7 で入れる。いまは見出しだけ
  if (id === 'cover') return <Text>{`${report.year}年のふりかえり`}</Text>;
  return <Text>{id}</Text>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.washi,
  },
  barsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 5,
  },
  stage: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingVertical: 22,
    paddingHorizontal: 26,
  },
  scene: { flex: 1 },
  pausedWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 7,
  },
  paused: {
    borderRadius: borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  // 字は白のまま、地だけ半透明にする（D-21。トークンの色の面に opacity）
  pausedBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.sumi,
    opacity: 0.8,
  },
  pausedText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
});
