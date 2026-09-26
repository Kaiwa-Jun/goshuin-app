import { Animated } from 'react-native';
import {
  BOOK_OPEN_MS,
  CAPTION_IN_MS,
  CAPTION_OUT_MS,
  CURVE_STEPS,
  FACE_DOWN_DEG,
  GATHER_LEAD_MS,
  GATHER_MS,
  GROW_MS,
  PREPARE_TIMEOUT_MS,
  SCATTER_FIRST_DELAY_MS,
  SCATTER_LAST_DELAY_MS,
  SCATTER_MS,
  SHRINK_MS,
  SWAP_RAMP_MS,
  THUMB_SLIDE_MS,
  THUMB_TRAVEL,
  TILE_PERSPECTIVE,
  TILE_POP_MS,
  TILE_POP_STAGGER_MS,
  TO_FLIP_MS,
  TO_GRID_MS,
  easeInQuad,
  easeOutCubic,
  flipPageMotion,
  gatherDelayOf,
  paneOpacity,
  sampledRange,
  scatterDelays,
  settleSpring,
  stackRectOf,
  stackScaleOf,
  thumbSpring,
  tileMotion,
  tilePop,
  tiltDegOf,
} from '@components/gallery/viewModeMotion';

/** 補間のノードの値。回転（'12deg'）は数にする */
const valueOf = (node: unknown): number => {
  const v = (node as { __getValue: () => unknown }).__getValue();
  return typeof v === 'string' ? parseFloat(v) : (v as number);
};

describe('viewModeMotion — ボタンの曲線（AC-11）', () => {
  it('thumbSpring は少し行き過ぎて戻り、1 で止まる', () => {
    expect(thumbSpring(0)).toBeCloseTo(0, 6);
    expect(thumbSpring(0.25)).toBeCloseTo(1.141831, 6);
    expect(thumbSpring(0.5)).toBeCloseTo(0.998542, 6);
    expect(thumbSpring(1)).toBe(1);
  });

  it('tilePop は 0.1 から出て、少し大きくなってから 1 で止まる', () => {
    expect(tilePop(0)).toBeCloseTo(0.1, 6);
    expect(tilePop(0.5)).toBeCloseTo(1.093633, 6);
    expect(tilePop(1)).toBeCloseTo(1, 6);
  });

  it('easeOutCubic(0.5) は 0.875', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 6);
  });

  it('ボタンの定数が試作 toggle-v1 の A の値', () => {
    expect(THUMB_SLIDE_MS).toBe(520);
    expect(BOOK_OPEN_MS).toBe(600);
    expect(TILE_POP_MS).toBe(260);
    expect(TILE_POP_STAGGER_MS).toBe(70);
    expect(THUMB_TRAVEL).toBe(44);
    // 本が閉じた角度。ちょうど 180° だと iOS は裏も描かない（#275 S6）
    expect(FACE_DOWN_DEG).toBe(179.9);
  });
});

describe('viewModeMotion — 切り替わりの曲線と定数（AC-11）', () => {
  it('settleSpring は少し行き過ぎて戻り、1 以上では 1', () => {
    expect(settleSpring(0)).toBeCloseTo(0, 6);
    expect(settleSpring(0.25)).toBeCloseTo(1.10916, 6);
    expect(settleSpring(0.5)).toBeCloseTo(1.006365, 6);
    expect(settleSpring(0.75)).toBeCloseTo(0.995314, 6);
    expect(settleSpring(1)).toBe(1);
    expect(settleSpring(1.5)).toBe(1);
  });

  it('easeInQuad(0.5) は 0.25', () => {
    expect(easeInQuad(0.5)).toBeCloseTo(0.25, 6);
  });

  it('定数が試作 transition-v2 の 5 の値', () => {
    expect(SHRINK_MS).toBe(100);
    expect(SCATTER_MS).toBe(345);
    expect(SCATTER_FIRST_DELAY_MS).toBe(20);
    expect(SCATTER_LAST_DELAY_MS).toBe(120);
    expect(GATHER_MS).toBe(250);
    expect(GATHER_LEAD_MS).toBe(80);
    expect(GROW_MS).toBe(260);
    expect(TO_GRID_MS).toBe(565);
    expect(TO_FLIP_MS).toBe(590);
    expect(TILE_PERSPECTIVE).toBe(700);
    expect(CAPTION_IN_MS).toBe(120);
    expect(CAPTION_OUT_MS).toBe(80);
    expect(SWAP_RAMP_MS).toBe(1);
    expect(CURVE_STEPS).toBe(16);
    expect(PREPARE_TIMEOUT_MS).toBe(300);
  });

  it('中身の動きはどちらも 0.6秒以内', () => {
    expect(TO_GRID_MS).toBeLessThanOrEqual(600);
    expect(TO_FLIP_MS).toBeLessThanOrEqual(600);
  });
});

describe('viewModeMotion — 傾き・束（AC-12）', () => {
  it('tiltDegOf は −8〜8° に散る（試作 rot(i)）', () => {
    const expected: [number, number][] = [
      [0, -8],
      [1, -5],
      [2, -2],
      [3, 1],
      [4, 4],
      [5, 7],
      [6, -7],
      [11, 8],
    ];
    for (const [index, deg] of expected) expect(tiltDegOf(index)).toBe(deg);
  });

  it('stackScaleOf はタイルの一辺 ÷ ページの幅', () => {
    expect(stackScaleOf(111.667, 255)).toBeCloseTo(111.667 / 255, 6);
  });

  it('stackRectOf は中心から一辺 T の正方形', () => {
    expect(stackRectOf({ x: 187.5, y: 400 }, 100)).toEqual({
      x: 137.5,
      y: 350,
      width: 100,
      height: 100,
    });
  });
});

describe('viewModeMotion — 順と遅れ（AC-13）', () => {
  it('見ていた1枚から近い順。同じ距離は index の小さい順', () => {
    const delays = scatterDelays(
      Array.from({ length: 12 }, (_, i) => i),
      4
    );
    const expected: [number, number][] = [
      [4, 0],
      [1, 20 + 100 / 11],
      [3, 20 + 200 / 11],
      [5, 20 + 300 / 11],
      [7, 20 + 400 / 11],
      [0, 20 + 500 / 11],
      [2, 20 + 600 / 11],
      [6, 20 + 700 / 11],
      [8, 20 + 800 / 11],
      [10, 20 + 900 / 11],
      [9, 20 + 1000 / 11],
      [11, 120],
    ];
    expect(delays.size).toBe(12);
    for (const [index, delay] of expected) expect(delays.get(index)).toBeCloseTo(delay, 6);
  });

  it('3枚で見ていた1枚が見えているとき', () => {
    const delays = scatterDelays([0, 1, 2], 2);
    expect(delays.get(2)).toBe(0);
    expect(delays.get(1)).toBeCloseTo(70, 6);
    expect(delays.get(0)).toBeCloseTo(120, 6);
  });

  it('見ていた1枚が見えていなければ、その index から数えて全員が遅れる', () => {
    const delays = scatterDelays([0, 1, 2], 14);
    expect(delays.size).toBe(3);
    expect(delays.get(2)).toBeCloseTo(20 + 100 / 3, 6);
    expect(delays.get(1)).toBeCloseTo(20 + 200 / 3, 6);
    expect(delays.get(0)).toBeCloseTo(120, 6);
  });

  it('gatherDelayOf は遅れの逆順（いちばん遠い1枚が最初）', () => {
    expect(gatherDelayOf(0)).toBeCloseTo(80, 6);
    expect(gatherDelayOf(60)).toBeCloseTo(40, 6);
    expect(gatherDelayOf(120)).toBeCloseTo(0, 6);
  });
});

describe('viewModeMotion — 点で刻む（AC-14）', () => {
  it('曲線を 17 点に刻む。入力は狭義の増加', () => {
    const range = sampledRange(settleSpring, 100, 345, 50, 0);
    expect(range.inputRange).toHaveLength(17);
    range.inputRange.forEach((input, k) => {
      expect(input).toBeCloseTo(100 + (345 * k) / 16, 6);
      if (k > 0) expect(input).toBeGreaterThan(range.inputRange[k - 1]);
    });
    expect(range.inputRange[0]).toBe(100);
    expect(range.inputRange[16]).toBe(445);
    range.outputRange.forEach((output, k) => {
      expect(output).toBeCloseTo(50 * (1 - settleSpring(k / 16)), 6);
    });
  });
});

describe('viewModeMotion — タイルの動き（AC-15・AC-16）', () => {
  const read = (motion: ReturnType<typeof tileMotion>) => ({
    translateX: valueOf(motion.translateX),
    translateY: valueOf(motion.translateY),
    rotateZ: valueOf(motion.rotateZ),
    rotateY: valueOf(motion.rotateY),
    caption: valueOf(motion.captionOpacity),
  });

  it('めくる → 一覧: 束から散って、めくれながら着く（AC-15）', () => {
    const clock = new Animated.Value(0);
    const motion = tileMotion(clock, {
      direction: 'toGrid',
      dx: -100,
      dy: 200,
      tiltDeg: 4,
      faceDown: true,
      delayMs: 20,
    });

    for (const t of [0, 120]) {
      clock.setValue(t);
      const v = read(motion);
      expect(v.translateX).toBeCloseTo(-100, 3);
      expect(v.translateY).toBeCloseTo(200, 3);
      expect(v.rotateZ).toBeCloseTo(4, 3);
      expect(v.rotateY).toBeCloseTo(179.9, 3);
      expect(v.caption).toBeCloseTo(0, 3);
    }

    clock.setValue(206.25);
    let v = read(motion);
    expect(v.translateX).toBeCloseTo(10.916, 3);
    expect(v.translateY).toBeCloseTo(-21.832, 3);
    expect(v.rotateZ).toBeCloseTo(3, 3);
    expect(v.rotateY).toBeCloseTo(75.895, 3);
    expect(v.caption).toBeCloseTo(0, 3);

    clock.setValue(405);
    expect(read(motion).caption).toBeCloseTo(0.5, 3);

    for (const t of [465, 565]) {
      clock.setValue(t);
      v = read(motion);
      expect(v.translateX).toBeCloseTo(0, 3);
      expect(v.translateY).toBeCloseTo(0, 3);
      expect(v.rotateZ).toBeCloseTo(0, 3);
      expect(v.rotateY).toBeCloseTo(0, 3);
      expect(v.caption).toBeCloseTo(1, 3);
    }
  });

  it('見ていた1枚は表のまま・傾かずに束のいちばん上から出る（AC-15）', () => {
    const clock = new Animated.Value(0);
    const motion = tileMotion(clock, {
      direction: 'toGrid',
      dx: -100,
      dy: 200,
      tiltDeg: 0,
      faceDown: false,
      delayMs: 0,
    });
    clock.setValue(100);
    expect(valueOf(motion.rotateY)).toBeCloseTo(0, 3);
    expect(valueOf(motion.rotateZ)).toBeCloseTo(0, 3);
  });

  it('一覧 → めくる: めくれながら束へ集まる（AC-16）', () => {
    const clock = new Animated.Value(0);
    const motion = tileMotion(clock, {
      direction: 'toFlip',
      dx: -100,
      dy: 200,
      tiltDeg: 4,
      faceDown: true,
      delayMs: 40,
    });

    for (const t of [0, 40]) {
      clock.setValue(t);
      const v = read(motion);
      expect(v.translateX).toBeCloseTo(0, 3);
      expect(v.translateY).toBeCloseTo(0, 3);
      expect(v.rotateZ).toBeCloseTo(0, 3);
      expect(v.rotateY).toBeCloseTo(0, 3);
      expect(v.caption).toBeCloseTo(1, 3);
    }

    clock.setValue(80);
    expect(read(motion).caption).toBeCloseTo(0.5, 3);

    clock.setValue(165);
    let v = read(motion);
    expect(v.translateX).toBeCloseTo(-87.5, 3);
    expect(v.translateY).toBeCloseTo(175, 3);
    expect(v.rotateZ).toBeCloseTo(3.5, 3);
    // 179.9 × 0.875 = 157.4125（契約書の 157.413 はこれを小数3桁に丸めた値）
    expect(v.rotateY).toBeCloseTo(157.4125, 3);
    expect(v.caption).toBeCloseTo(0, 3);

    for (const t of [290, 590]) {
      clock.setValue(t);
      v = read(motion);
      expect(v.translateX).toBeCloseTo(-100, 3);
      expect(v.translateY).toBeCloseTo(200, 3);
      expect(v.rotateZ).toBeCloseTo(4, 3);
      expect(v.rotateY).toBeCloseTo(179.9, 3);
    }
  });
});

describe('viewModeMotion — ページと面（AC-17）', () => {
  it('めくる → 一覧: ページが縮み、周りが消える', () => {
    const clock = new Animated.Value(0);
    const { pageScale, surroundOpacity } = flipPageMotion(clock, 'toGrid', 0.44);
    const at = (t: number) => {
      clock.setValue(t);
      return { scale: valueOf(pageScale), opacity: valueOf(surroundOpacity) };
    };
    expect(at(0).scale).toBeCloseTo(1, 4);
    expect(at(50).scale).toBeCloseTo(0.86, 4);
    expect(at(100).scale).toBeCloseTo(0.44, 4);
    expect(at(400).scale).toBeCloseTo(0.44, 4);
    expect(at(0).opacity).toBeCloseTo(1, 4);
    expect(at(50).opacity).toBeCloseTo(0.5, 4);
    expect(at(100).opacity).toBeCloseTo(0, 4);
  });

  it('一覧 → めくる: ページが広がって少し行き過ぎて戻り、周りが出る', () => {
    const clock = new Animated.Value(0);
    const { pageScale, surroundOpacity } = flipPageMotion(clock, 'toFlip', 0.44);
    const at = (t: number) => {
      clock.setValue(t);
      return { scale: valueOf(pageScale), opacity: valueOf(surroundOpacity) };
    };
    expect(at(0).scale).toBeCloseTo(0.44, 4);
    expect(at(330).scale).toBeCloseTo(0.44, 4);
    expect(at(395).scale).toBeCloseTo(1.06113, 4);
    expect(at(590).scale).toBeCloseTo(1, 4);
    expect(at(330).opacity).toBeCloseTo(0, 4);
    expect(at(460).opacity).toBeCloseTo(0.5, 4);
    expect(at(590).opacity).toBeCloseTo(1, 4);
  });

  it('面は 1ms の幅で入れ替わる', () => {
    const clock = new Animated.Value(0);
    const at = (node: Animated.AnimatedInterpolation<number>, t: number) => {
      clock.setValue(t);
      return valueOf(node);
    };

    const toGridFlip = paneOpacity(clock, 'toGrid', 'flip');
    const toGridGrid = paneOpacity(clock, 'toGrid', 'grid');
    expect(at(toGridFlip, 100)).toBeCloseTo(1, 4);
    expect(at(toGridFlip, 101)).toBeCloseTo(0, 4);
    expect(at(toGridGrid, 100)).toBeCloseTo(0, 4);
    expect(at(toGridGrid, 101)).toBeCloseTo(1, 4);

    const toFlipGrid = paneOpacity(clock, 'toFlip', 'grid');
    const toFlipFlip = paneOpacity(clock, 'toFlip', 'flip');
    expect(at(toFlipGrid, 330)).toBeCloseTo(1, 4);
    expect(at(toFlipGrid, 331)).toBeCloseTo(0, 4);
    expect(at(toFlipFlip, 330)).toBeCloseTo(0, 4);
    expect(at(toFlipFlip, 331)).toBeCloseTo(1, 4);
  });
});
