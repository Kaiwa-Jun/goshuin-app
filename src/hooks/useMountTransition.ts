import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import type { EasingFunction } from 'react-native';

import { useReduceMotion } from '@hooks/useReduceMotion';

interface Options {
  /** 出るときの時間(ms) */
  openMs: number;
  /** 消えるときの時間(ms)。出るときより短くすると、待たされる感じが残らない */
  closeMs: number;
  openEasing?: EasingFunction;
  closeEasing?: EasingFunction;
}

export interface MountTransition {
  /** 描くかどうか。消えるモーションの間も true */
  mounted: boolean;
  /** 0 = 消えている / 1 = 出ている */
  progress: Animated.Value;
}

/**
 * 「出ているか」と「描いているか」を分ける。
 *
 * `{open && <X />}` と書くと、消えるモーションを描く前に要素が外れてしまう。
 * このフックは出るときは先にマウントし、消えるときはモーションを描き切って
 * からアンマウントする。
 *
 *     const { mounted, progress } = useMountTransition(open, { openMs: 180, closeMs: 130 });
 *     {mounted && <Animated.View style={{ opacity: progress }} />}
 *
 * 「視差効果を減らす」がオンならモーションを飛ばして即座に切り替える。
 * 動きを消すだけで、出るものは出るし消えるものは消える。
 */
export function useMountTransition(open: boolean, options: Options): MountTransition {
  const { openMs, closeMs, openEasing, closeEasing } = options;
  const [mounted, setMounted] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;

    if (reduceMotion) {
      progress.setValue(open ? 1 : 0);
      if (!open) setMounted(false);
      return;
    }

    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? openMs : closeMs,
      easing: open
        ? (openEasing ?? Easing.out(Easing.cubic))
        : (closeEasing ?? Easing.in(Easing.cubic)),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });

    // 動いている途中で外れたら止める
    return () => progress.stopAnimation();
  }, [open, mounted, reduceMotion, progress, openMs, closeMs, openEasing, closeEasing]);

  return { mounted, progress };
}
