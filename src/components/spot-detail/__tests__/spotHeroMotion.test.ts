import { Animated } from 'react-native';
import {
  CREST_RECT,
  GRAIN_OPACITY,
  GRAIN_STEP,
  HERO_BODY_MIN_HEIGHT,
  HERO_BODY_TOP,
  HERO_COMPACT_HEIGHT,
  HERO_COMPACT_NAME_TOP,
  HERO_DESIGN_WIDTH,
  HERO_EXPANDED_HEIGHT,
  HERO_FADE_BLEED,
  HERO_FADE_HEIGHT,
  HERO_FADE_LOCATIONS,
  HERO_LIFT,
  HERO_MAX_PAGES,
  HERO_NAME_INSET,
  HERO_TILT_DEG,
  INK_OPACITY,
  GHOST_OPACITY,
  MADA_LIGHT_OFFSET,
  MADA_LIGHT_OPACITY,
  MADA_SHADE_OFFSET,
  MADA_SHADE_OPACITY,
  PAGE_LEAVES,
  PAGE_RADIUS,
  PAGE_RECT,
  PAGE_REVEAL_MS,
  PRESS_DIP_AT,
  PRESS_DIP_SCALE,
  PRESS_FROM_SCALE,
  SEAL_PRESS_MS,
  TOP_PAGE_TRANSFORM,
  bodyLiftOf,
  grainRects,
  heroMomentStyle,
  heroOpenOf,
  heroRectLayout,
  heroRectMotion,
  pageCountOf,
  pageLeafTransform,
} from '@components/spot-detail/spotHeroMotion';

/** 補間のノードの値 */
const read = (node: unknown): number => (node as { __getValue: () => number }).__getValue();

/** 位置・倍率は小数3桁、曲線・不透明度は 1e-6（契約書のテスト方針） */
const closeTo3 = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 3);
const closeTo6 = (value: number, expected: number) =>
  expect(Math.abs(value - expected)).toBeLessThan(1e-6);

describe('spotHeroMotion の定数（Issue #293 AC-8）', () => {
  it('試作の値と一致する', () => {
    expect(HERO_DESIGN_WIDTH).toBe(390);
    expect(HERO_EXPANDED_HEIGHT).toBe(208);
    expect(HERO_COMPACT_HEIGHT).toBe(80);
    expect(HERO_LIFT).toBe(128);
    expect(HERO_FADE_HEIGHT).toBe(56);
    expect(HERO_BODY_TOP).toBe(152);
    expect(HERO_NAME_INSET).toBe(26);
    expect(HERO_COMPACT_NAME_TOP).toBe(50);
    expect(HERO_BODY_MIN_HEIGHT).toBe(184);
    expect(HERO_FADE_BLEED).toBe(1);
    expect(HERO_FADE_LOCATIONS).toEqual([5 / 57, 29 / 57, 47 / 57]);
    expect(CREST_RECT).toEqual({
      compact: { x: 115, y: -47, width: 250 },
      expanded: { x: 90, y: -28, width: 300 },
      ratio: 1,
    });
    expect(PAGE_RECT).toEqual({
      compact: { x: 298, y: 4, width: 62 },
      expanded: { x: 234, y: 22, width: 120 },
      ratio: 4 / 3,
    });
    expect(HERO_TILT_DEG).toBe(-4);
    expect(PAGE_LEAVES).toEqual([
      { rotateDeg: 6, dx: 0.07, dy: -0.02 },
      { rotateDeg: -2, dx: -0.08, dy: 0.01 },
    ]);
    expect(HERO_MAX_PAGES).toBe(3);
    expect(PAGE_RADIUS).toBe(3);
    expect(SEAL_PRESS_MS).toBe(500);
    expect(PAGE_REVEAL_MS).toBe(250);
    expect(PRESS_FROM_SCALE).toBe(1.3);
    expect(PRESS_DIP_SCALE).toBe(0.92);
    expect(PRESS_DIP_AT).toBe(0.55);
    expect(INK_OPACITY).toBe(0.9);
    expect(GHOST_OPACITY).toBe(0.2);
    expect(MADA_SHADE_OPACITY).toBe(0.26);
    expect(MADA_SHADE_OFFSET).toBe(-1);
    expect(MADA_LIGHT_OPACITY).toBe(0.9);
    expect(MADA_LIGHT_OFFSET).toBe(0.9);
    expect(GRAIN_STEP).toBe(11.4);
    expect(GRAIN_OPACITY).toBe(0.025);
  });

  it('寸法どうしの関係が成り立つ', () => {
    expect(HERO_BODY_TOP).toBe(HERO_EXPANDED_HEIGHT - HERO_FADE_HEIGHT);
    expect(HERO_LIFT).toBe(HERO_EXPANDED_HEIGHT - HERO_COMPACT_HEIGHT);
    expect(HERO_COMPACT_NAME_TOP).toBe(HERO_BODY_TOP + HERO_NAME_INSET - HERO_LIFT);
    expect(HERO_BODY_MIN_HEIGHT).toBe(HERO_LIFT + HERO_FADE_HEIGHT);
    expect(SEAL_PRESS_MS + PAGE_REVEAL_MS).toBe(750);
  });
});

describe('heroRectLayout（AC-9）', () => {
  it('大きくの rect を、右端に合わせて置く', () => {
    expect(heroRectLayout(CREST_RECT, 390)).toEqual({
      left: 90,
      top: -28,
      width: 300,
      height: 300,
    });
    expect(heroRectLayout(PAGE_RECT, 390)).toEqual({ left: 234, top: 22, width: 120, height: 160 });
    expect(heroRectLayout(PAGE_RECT, 375).left).toBe(219);
    expect(heroRectLayout(CREST_RECT, 430).left).toBe(130);
  });
});

describe('heroOpenOf（AC-10）', () => {
  it('大きく 1・半分 0。外は端に留める', () => {
    const sheetY = new Animated.Value(0);
    const open = heroOpenOf(sheetY, 100, 400);
    const at = (y: number) => {
      sheetY.setValue(y);
      return read(open);
    };
    closeTo6(at(100), 1);
    closeTo6(at(250), 0.5);
    closeTo6(at(400), 0);
    closeTo6(at(50), 1);
    closeTo6(at(900), 0);
  });
});

describe('bodyLiftOf（AC-11）', () => {
  it('半分で 128 持ち上げ、大きくで 0', () => {
    const open = new Animated.Value(0);
    const lift = bodyLiftOf(open);
    const at = (v: number) => {
      open.setValue(v);
      return read(lift);
    };
    closeTo3(at(0), -128);
    closeTo3(at(0.5), -64);
    closeTo3(at(1), 0);
  });
});

describe('heroRectMotion（AC-12）', () => {
  const motionAt = (rect: typeof CREST_RECT, v: number) => {
    const open = new Animated.Value(v);
    const m = heroRectMotion(open, rect);
    return [read(m.translateX), read(m.translateY), read(m.scale)];
  };

  it('印: 半分では少し上で小さく、大きくで置き場所どおり', () => {
    const cases: [number, number[]][] = [
      [0, [0, -44, 0.833]],
      [0.5, [0, -22, 0.917]],
      [1, [0, 0, 1]],
    ];
    for (const [v, expected] of cases) {
      motionAt(CREST_RECT, v).forEach((value, i) => closeTo3(value, expected[i]));
    }
  });

  it('ページ: 半分では右上で小さく、大きくで置き場所どおり', () => {
    const cases: [number, number[]][] = [
      [0, [35, -56.667, 0.517]],
      [0.5, [17.5, -28.333, 0.758]],
      [1, [0, 0, 1]],
    ];
    for (const [v, expected] of cases) {
      motionAt(PAGE_RECT, v).forEach((value, i) => closeTo3(value, expected[i]));
    }
  });
});

describe('heroMomentStyle（AC-13）', () => {
  const styleAt = (p: number, r: number) => {
    const press = new Animated.Value(p);
    const reveal = new Animated.Value(r);
    const s = heroMomentStyle(press, reveal);
    return {
      inkOpacity: read(s.inkOpacity),
      inkScale: read(s.inkScale),
      madaOpacity: read(s.madaOpacity),
      pagesOpacity: read(s.pagesOpacity),
    };
  };

  it('行っていない (0, 0): 朱は無く 1.3 倍、型あり、ページ無し', () => {
    const s = styleAt(0, 0);
    closeTo6(s.inkOpacity, 0);
    closeTo6(s.inkScale, 1.3);
    closeTo6(s.madaOpacity, 1);
    closeTo6(s.pagesOpacity, 0);
  });

  it('捺す途中: 1.3 倍から 0.55 で 0.92 まで沈み、1 に戻る', () => {
    closeTo6(styleAt(0.275, 0).inkOpacity, 0.275);
    closeTo6(styleAt(0.275, 0).inkScale, 1.11);
    closeTo6(styleAt(0.55, 0).inkScale, 0.92);
    closeTo6(styleAt(0.775, 0).inkScale, 0.96);
    const pressed = styleAt(1, 0);
    closeTo6(pressed.inkOpacity, 1);
    closeTo6(pressed.inkScale, 1);
    closeTo6(pressed.madaOpacity, 1);
    closeTo6(pressed.pagesOpacity, 0);
  });

  it('替わる途中と、行った (1, 1): 朱は薄い跡、型は消え、ページが出る', () => {
    const half = styleAt(1, 0.5);
    closeTo6(half.inkOpacity, 0.6);
    closeTo6(half.madaOpacity, 0.5);
    closeTo6(half.pagesOpacity, 0.5);
    const done = styleAt(1, 1);
    closeTo6(done.inkOpacity, 0.2);
    closeTo6(done.inkScale, 1);
    closeTo6(done.madaOpacity, 0);
    closeTo6(done.pagesOpacity, 1);
  });
});

describe('ページの束（AC-14）', () => {
  it('枚数は 1〜3', () => {
    expect([0, 1, 2, 3, 7].map(pageCountOf)).toEqual([1, 1, 2, 3, 3]);
  });

  it('後ろの紙は傾けて少しずらし、表の紙は −4°', () => {
    const numbers = (t: Record<string, string | number>[]) =>
      t.map(entry => {
        const [key, value] = Object.entries(entry)[0];
        return [key, typeof value === 'string' ? value : Number(value.toFixed(6))];
      });
    expect(numbers(pageLeafTransform(0))).toEqual([
      ['rotate', '6deg'],
      ['translateX', 8.4],
      ['translateY', -3.2],
    ]);
    expect(numbers(pageLeafTransform(1))).toEqual([
      ['rotate', '-2deg'],
      ['translateX', -9.6],
      ['translateY', 1.6],
    ]);
    expect(TOP_PAGE_TRANSFORM).toEqual([{ rotate: '-4deg' }]);
  });
});

describe('grainRects（AC-15）', () => {
  it('11.4 おきに、幅が 5 本で1周する筋', () => {
    const rects = grainRects(390);
    expect(rects).toHaveLength(35);
    expect(rects[0]).toEqual({ x: 0, width: 1.4, height: 208 });
    expect(rects[1]).toEqual({ x: 11.4, width: 2.3, height: 208 });
    expect(rects[3].x).toBe(34.2);
    expect(rects[4]).toEqual({ x: 45.6, width: 5, height: 208 });
    expect(rects[5]).toEqual({ x: 57, width: 1.4, height: 208 });
    expect(grainRects(750)).toHaveLength(66);
  });
});
