import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Animated, Dimensions, Easing, StyleSheet, Text } from 'react-native';
import { G, Rect, Svg } from 'react-native-svg';

import { SpotSheetHero } from '@components/spot-detail/SpotSheetHero';
import { SealGlyph } from '@components/common/Seal';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

type Props = React.ComponentProps<typeof SpotSheetHero>;
type Node = { props: Record<string, unknown>; children: (Node | string)[] };
type Found = { props: Record<string, unknown> };

const W = Dimensions.get('window').width;

const flatten = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;

/** 描いた値を読む。ノードならその値、値そのものならそれ */
const read = (value: unknown): number => {
  const v =
    value && typeof value === 'object' && '__getValue' in value
      ? (value as { __getValue: () => unknown }).__getValue()
      : value;
  return typeof v === 'string' ? parseFloat(v) : (v as number);
};
const transformOf = (node: { props: { style?: unknown } }) =>
  (flatten(node).transform ?? []) as Record<string, unknown>[];
const transformValue = (node: { props: { style?: unknown } }, key: string) =>
  read(transformOf(node).find(t => key in t)?.[key]);
const opacityOf = (node: { props: { style?: unknown } }) => read(flatten(node).opacity);

const close3 = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 3);
const close6 = (value: number, expected: number) =>
  expect(Math.abs(value - expected)).toBeLessThan(1e-6);

/** 木を深さ優先でたどって、testID の出てくる順 */
const idsIn = (root: Node, pick: (id: string) => boolean) => {
  const seen: string[] = [];
  const walk = (node: Node) => {
    const id = node.props?.testID;
    if (typeof id === 'string' && pick(id) && !seen.includes(id)) seen.push(id);
    node.children?.forEach(c => typeof c !== 'string' && walk(c));
  };
  walk(root);
  return seen;
};

function renderHero(props: Partial<Props> = {}) {
  const base: Props = {
    spotType: 'shrine',
    visited: false,
    visitedReady: true,
    reduceMotion: false,
    pageCount: 1,
    pageImageUri: null,
    open: new Animated.Value(0),
    onPress: jest.fn(),
  };
  const merged = { ...base, ...props };
  const ui = render(<SpotSheetHero {...merged} />);
  const rerender = (next: Partial<Props>) => {
    Object.assign(merged, next);
    ui.rerender(<SpotSheetHero {...merged} />);
  };
  // 飾り（筋・印・ページ）は読み上げから外してあるので、隠れた要素も探す
  const hidden = { includeHiddenElements: true };
  return {
    ...ui,
    props: merged,
    rerender,
    getByTestId: (id: string) => ui.getByTestId(id, hidden),
    queryByTestId: (id: string) => ui.queryByTestId(id, hidden),
  };
}

/** 記録した瞬間の見た目（朱・型・ページ） */
const momentOf = (ui: ReturnType<typeof renderHero>) => {
  const ink = ui.getByTestId('spot-hero-crest-ink');
  return {
    inkOpacity: opacityOf(ink),
    inkScale: transformValue(ink, 'scale'),
    madaOpacity: opacityOf(ui.getByTestId('spot-hero-crest-mada')),
    revealOpacity: opacityOf(ui.getByTestId('spot-hero-pages-reveal')),
  };
};

describe('SpotSheetHero の形（Issue #293）', () => {
  it('帯の箱・中の並び・飾りは読み上げない・文字は描かない（AC-16）', () => {
    const ui = renderHero();
    const hero = ui.getByTestId('spot-hero');
    expect(flatten(hero)).toEqual(
      expect.objectContaining({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 208,
        overflow: 'hidden',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        backgroundColor: colors.washi,
      })
    );
    expect(hero.props.accessible).toBe(false);
    expect(idsIn(hero as unknown as Node, id => id.startsWith('spot-hero-'))).toEqual([
      'spot-hero-grain',
      'spot-hero-crest',
      'spot-hero-crest-box',
      'spot-hero-crest-mada',
      'spot-hero-crest-ink',
      'spot-hero-pages',
      'spot-hero-pages-reveal',
      'spot-hero-page-top',
      'spot-hero-page-top-clip',
    ]);
    for (const id of ['spot-hero-grain', 'spot-hero-crest', 'spot-hero-pages']) {
      const node = ui.getByTestId(id);
      expect(node.props.pointerEvents).toBe('none');
      expect(node.props.accessibilityElementsHidden).toBe(true);
      expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
    }
    expect(ui.UNSAFE_queryAllByType(Text)).toHaveLength(0);
  });

  it('印は −4° 傾け、空押しの型3枚と朱1枚を重ねる（AC-17）', () => {
    const ui = renderHero();
    expect(transformOf(ui.getByTestId('spot-hero-crest-box'))).toEqual([{ rotate: '-4deg' }]);

    const mada = ui.getByTestId('spot-hero-crest-mada');
    expect(mada.findAllByType(SealGlyph).map((g: Found) => g.props)).toEqual([
      { mark: 'torii', fill: colors.washiSub, opacity: 0.26, offset: -1 },
      { mark: 'torii', fill: colors.white, opacity: 0.9, offset: 0.9 },
      { mark: 'torii', fill: colors.washiShade },
    ]);
    const shade = mada.findAllByType(SealGlyph)[2].props;
    expect(shade.opacity).toBeUndefined();
    expect(shade.offset).toBeUndefined();

    const ink = ui.getByTestId('spot-hero-crest-ink');
    expect(ink.findAllByType(SealGlyph).map((g: Found) => g.props)).toEqual([
      { mark: 'torii', fill: colors.seal, opacity: 0.9 },
    ]);
    for (const node of [mada, ink]) {
      expect(node.findAllByType(Svg).map((s: Found) => s.props.viewBox)).toEqual(['0 0 100 100']);
    }

    const temple = renderHero({ spotType: 'temple' });
    expect(temple.UNSAFE_getAllByType(SealGlyph).map(g => g.props.mark)).toEqual([
      'dou',
      'dou',
      'dou',
      'dou',
    ]);
  });

  it('印とページは大きくの置き場所に置き、開きに合わせて動く（AC-18）', () => {
    const open = new Animated.Value(0);
    const ui = renderHero({ open });
    const crest = ui.getByTestId('spot-hero-crest');
    const pages = ui.getByTestId('spot-hero-pages');
    expect(flatten(crest)).toEqual(
      expect.objectContaining({
        position: 'absolute',
        left: 90 + (W - 390),
        top: -28,
        width: 300,
        height: 300,
      })
    );
    expect(flatten(pages)).toEqual(
      expect.objectContaining({
        position: 'absolute',
        left: 234 + (W - 390),
        top: 22,
        width: 120,
        height: 160,
      })
    );
    expect(transformOf(crest).map(t => Object.keys(t)[0])).toEqual([
      'translateX',
      'translateY',
      'scale',
    ]);
    expect(transformOf(pages).map(t => Object.keys(t)[0])).toEqual([
      'translateX',
      'translateY',
      'scale',
    ]);

    const motion = (id: string) =>
      ['translateX', 'translateY', 'scale'].map(key => transformValue(ui.getByTestId(id), key));
    const expectMotion = (id: string, expected: number[]) =>
      motion(id).forEach((v, i) => close3(v, expected[i]));

    expectMotion('spot-hero-crest', [0, -44, 0.833]);
    expectMotion('spot-hero-pages', [35, -56.667, 0.517]);
    act(() => open.setValue(0.5));
    expectMotion('spot-hero-crest', [0, -22, 0.917]);
    act(() => open.setValue(1));
    expectMotion('spot-hero-crest', [0, 0, 1]);
    expectMotion('spot-hero-pages', [0, 0, 1]);
  });

  it('行っていない寺社: 朱は無く、型だけ。ページは隠れている（AC-19）', () => {
    const ui = renderHero();
    const m = momentOf(ui);
    close6(m.inkOpacity, 0);
    close6(m.inkScale, 1.3);
    close6(m.madaOpacity, 1);
    close6(m.revealOpacity, 0);
    expect(ui.queryByTestId('spot-hero-page-leaf-0')).toBeNull();
    expect(ui.queryByTestId('spot-hero-page-image')).toBeNull();
  });

  it('行った寺社: 朱の跡とページの束。表の紙に自分の御朱印の写真（AC-20）', () => {
    const ui = renderHero({
      visited: true,
      pageCount: 3,
      pageImageUri: 'https://example.com/a.jpg',
    });
    const m = momentOf(ui);
    close6(m.inkOpacity, 0.2);
    close6(m.inkScale, 1);
    close6(m.madaOpacity, 0);
    close6(m.revealOpacity, 1);

    const reveal = ui.getByTestId('spot-hero-pages-reveal') as unknown as Node;
    const PAPERS = ['spot-hero-page-leaf-0', 'spot-hero-page-leaf-1', 'spot-hero-page-top'];
    expect(idsIn(reveal, id => PAPERS.includes(id))).toEqual(PAPERS);

    const numbers = (node: { props: { style?: unknown } }) =>
      transformOf(node).map(entry => {
        const [key, value] = Object.entries(entry)[0];
        return [key, typeof value === 'string' ? value : Number((value as number).toFixed(6))];
      });
    expect(numbers(ui.getByTestId('spot-hero-page-leaf-0'))).toEqual([
      ['rotate', '6deg'],
      ['translateX', 8.4],
      ['translateY', -3.2],
    ]);
    expect(numbers(ui.getByTestId('spot-hero-page-leaf-1'))).toEqual([
      ['rotate', '-2deg'],
      ['translateX', -9.6],
      ['translateY', 1.6],
    ]);
    expect(transformOf(ui.getByTestId('spot-hero-page-top'))).toEqual([{ rotate: '-4deg' }]);

    for (const id of PAPERS) {
      expect(flatten(ui.getByTestId(id))).toEqual(
        expect.objectContaining({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 3,
          borderWidth: 1,
          borderColor: colors.spotHero.pageEdge,
          backgroundColor: colors.washi,
          shadowColor: shadows.md.shadowColor,
          shadowOffset: shadows.md.shadowOffset,
          shadowOpacity: shadows.md.shadowOpacity,
          shadowRadius: shadows.md.shadowRadius,
          elevation: shadows.md.elevation,
        })
      );
    }

    expect(flatten(ui.getByTestId('spot-hero-page-top-clip'))).toEqual(
      expect.objectContaining({ borderRadius: 2, overflow: 'hidden' })
    );
    const image = ui.getByTestId('spot-hero-page-image');
    expect(image.props.source).toEqual({ uri: 'https://example.com/a.jpg' });
    expect(image.props.resizeMode).toBe('cover');

    const two = renderHero({ visited: true, pageCount: 2 });
    expect(two.getByTestId('spot-hero-page-leaf-0')).toBeTruthy();
    expect(two.queryByTestId('spot-hero-page-leaf-1')).toBeNull();
    expect(two.queryByTestId('spot-hero-page-image')).toBeNull();

    const one = renderHero({ visited: true, pageCount: 1, pageImageUri: 'x' });
    expect(one.queryByTestId('spot-hero-page-leaf-0')).toBeNull();
    expect(one.getByTestId('spot-hero-page-image')).toBeTruthy();
  });

  it('和紙の筋は 11.4 おきの細い縦の線（AC-21）', () => {
    const ui = renderHero();
    const grain = ui.getByTestId('spot-hero-grain');
    const groups = grain
      .findAllByType(G)
      .filter((g: Found) => g.props.fill === colors.spotHero.grain && g.props.opacity === 0.025);
    expect(groups).toHaveLength(1);
    const rects = groups[0].findAllByType(Rect);
    expect(rects).toHaveLength(Math.ceil(W / 11.4));
    expect([rects[0].props.x, rects[0].props.width, rects[0].props.height]).toEqual([0, 1.4, 208]);
    expect([rects[1].props.x, rects[1].props.width]).toEqual([11.4, 2.3]);
  });

  it('帯を押すと onPress（AC-26）', () => {
    const onPress = jest.fn();
    const ui = renderHero({ onPress });
    fireEvent.press(ui.getByTestId('spot-hero'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('SpotSheetHero の記録した瞬間（Issue #293）', () => {
  type Stub = { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };
  const stub = (): Stub => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  let timing: jest.SpyInstance;
  let sequence: jest.SpyInstance;
  let timingStubs: Stub[];
  let sequenceStubs: Stub[];

  beforeEach(() => {
    timingStubs = [];
    sequenceStubs = [];
    timing = jest.spyOn(Animated, 'timing').mockImplementation(() => {
      const s = stub();
      timingStubs.push(s);
      return s as unknown as Animated.CompositeAnimation;
    });
    sequence = jest.spyOn(Animated, 'sequence').mockImplementation(() => {
      const s = stub();
      sequenceStubs.push(s);
      return s as unknown as Animated.CompositeAnimation;
    });
  });

  afterEach(() => {
    timing.mockRestore();
    sequence.mockRestore();
  });

  /** 行っていない寺社を描いてから、行った に変える */
  const startMoment = () => {
    const ui = renderHero();
    ui.rerender({ visited: true });
    return ui;
  };

  it('行った に変わると、朱が乗る 0.5秒・ページに替わる 0.25秒を続けて1回（AC-22）', () => {
    const ui = startMoment();

    expect(timing).toHaveBeenCalledTimes(2);
    const first = timing.mock.calls[0][1] as Animated.TimingAnimationConfig;
    expect(first).toEqual(
      expect.objectContaining({ toValue: 1, duration: 500, useNativeDriver: true })
    );
    close6(first.easing!(0.5), 0.875);
    close6(first.easing!(1), 1);
    const second = timing.mock.calls[1][1] as Animated.TimingAnimationConfig;
    expect(second).toEqual(
      expect.objectContaining({ toValue: 1, duration: 250, useNativeDriver: true })
    );
    const bezier = Easing.bezier(0.25, 0.1, 0.25, 1);
    for (const x of [0.25, 0.5, 0.75]) close6(second.easing!(x), bezier(x));

    expect(sequence).toHaveBeenCalledTimes(1);
    expect(sequence.mock.calls[0][0]).toEqual([timingStubs[0], timingStubs[1]]);
    expect(sequence.mock.calls[0][0][0]).toBe(timingStubs[0]);
    expect(sequence.mock.calls[0][0][1]).toBe(timingStubs[1]);
    expect(sequenceStubs[0].start).toHaveBeenCalledTimes(1);

    const m = momentOf(ui);
    close6(m.inkOpacity, 0);
    close6(m.inkScale, 1.3);
    close6(m.madaOpacity, 1);
    close6(m.revealOpacity, 0);
  });

  it('途中の値は press と reveal の2つから決まる（AC-23）', () => {
    const ui = startMoment();
    const press = timing.mock.calls[0][0] as Animated.Value;
    const reveal = timing.mock.calls[1][0] as Animated.Value;
    const at = (p: number, r: number) => {
      act(() => {
        press.setValue(p);
        reveal.setValue(r);
      });
      return momentOf(ui);
    };

    let m = at(0.275, 0);
    close6(m.inkOpacity, 0.275);
    close6(m.inkScale, 1.11);
    close6(at(0.775, 0).inkScale, 0.96);
    m = at(1, 0.5);
    close6(m.inkOpacity, 0.6);
    close6(m.madaOpacity, 0.5);
    close6(m.revealOpacity, 0.5);
    m = at(1, 1);
    close6(m.inkOpacity, 0.2);
    close6(m.inkScale, 1);
    close6(m.madaOpacity, 0);
    close6(m.revealOpacity, 1);
  });

  describe('動かないとき（AC-24）', () => {
    it('① 視差効果を減らす のまま 行った になると、その場で終わりの形', () => {
      const ui = renderHero({ reduceMotion: true });
      ui.rerender({ visited: true });
      expect(timing).not.toHaveBeenCalled();
      const m = momentOf(ui);
      close6(m.inkOpacity, 0.2);
      close6(m.madaOpacity, 0);
      close6(m.revealOpacity, 1);
    });

    it('② 確かめていない描画から、確かめたのと 行った が同時に来たら動かさない', () => {
      const ui = renderHero({ visitedReady: false, visited: false });
      ui.rerender({ visitedReady: true, visited: true });
      expect(timing).not.toHaveBeenCalled();
      const m = momentOf(ui);
      close6(m.inkOpacity, 0.2);
      close6(m.madaOpacity, 0);
      close6(m.revealOpacity, 1);
    });

    it('③ 行った から 行っていない に戻ると、その場で行っていない形', () => {
      const ui = renderHero({ visited: true });
      ui.rerender({ visited: false });
      expect(timing).not.toHaveBeenCalled();
      const m = momentOf(ui);
      close6(m.inkOpacity, 0);
      close6(m.madaOpacity, 1);
      close6(m.revealOpacity, 0);
    });

    it('④ 行ったまま枚数や写真が変わっても動かさない（2回目の記録）', () => {
      const ui = renderHero({ visited: true });
      ui.rerender({ pageCount: 2 });
      ui.rerender({ pageImageUri: 'x' });
      expect(timing).not.toHaveBeenCalled();
    });

    it('⑤ 確かめたのが先に来て、あとで 行った になれば動かす', () => {
      const ui = renderHero({ visitedReady: false, visited: false });
      ui.rerender({ visitedReady: true });
      expect(timing).not.toHaveBeenCalled();
      ui.rerender({ visited: true });
      expect(timing).toHaveBeenCalledTimes(2);
    });
  });

  describe('取りやめ（AC-25）', () => {
    it('① 視差効果を減らす がオンになると、止めて終わりの形', () => {
      const ui = startMoment();
      ui.rerender({ reduceMotion: true });
      expect(sequenceStubs[0].stop).toHaveBeenCalledTimes(1);
      const m = momentOf(ui);
      close6(m.inkOpacity, 0.2);
      close6(m.madaOpacity, 0);
      close6(m.revealOpacity, 1);
    });

    it('② 行っていない に戻ると、止めて行っていない形', () => {
      const ui = startMoment();
      ui.rerender({ visited: false });
      expect(sequenceStubs[0].stop).toHaveBeenCalledTimes(1);
      const m = momentOf(ui);
      close6(m.inkOpacity, 0);
      close6(m.madaOpacity, 1);
      close6(m.revealOpacity, 0);
    });

    it('③ 帯が外れると止める', () => {
      const ui = startMoment();
      ui.unmount();
      expect(sequenceStubs[0].stop).toHaveBeenCalledTimes(1);
    });
  });
});
