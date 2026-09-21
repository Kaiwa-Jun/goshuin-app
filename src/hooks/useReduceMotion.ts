import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * OS の「視差効果を減らす」がオンかどうか。
 *
 * オンのときはアニメーションを飛ばして最終状態に切り替える。動きを消すだけで、
 * 機能は落とさないこと（出るものは出る、消えるものは消える）。
 *
 * 取得に失敗したときは false のまま＝動かす側に倒す。動かないより動く方が
 * 既定として自然で、設定を読めないことを理由に演出を止める必要はない。
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
