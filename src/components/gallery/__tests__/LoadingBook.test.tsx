import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, render, within } from '@testing-library/react-native';
import { Stop, Svg } from 'react-native-svg';

import { LoadingBook } from '@components/gallery/LoadingBook';
import {
  isLoadingClockRunning,
  loadingClock,
  resetLoadingClockForTests,
  sealMarkAt,
  type LoadingSealFace,
} from '@components/gallery/loadingClock';
import { Seal } from '@components/common/Seal';
import { colors } from '@theme/colors';

type Styled = { props: { style?: unknown } };
type Transform = Record<string, unknown>[];

const flat = (el: Styled) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

/** 描いた値を読む。ノードならその値、値そのものならそれ */
const read = (value: unknown): number => {
  const v =
    value && typeof value === 'object' && '__getValue' in value
      ? (value as { __getValue: () => unknown }).__getValue()
      : value;
  return typeof v === 'string' ? parseFloat(v) : (v as number);
};

const transformOf = (el: Styled) => (flat(el).transform ?? []) as Transform;
const firstRotateY = (el: Styled) => read(transformOf(el).find(t => 'rotateY' in t)?.rotateY);
const scaleXOf = (el: Styled) => read(transformOf(el).find(t => 'scaleX' in t)?.scaleX);
const opacityOf = (el: Styled) => read(flat(el).opacity ?? 1);

const at = (t: number) => act(() => loadingClock.setValue(t));

const FACES: LoadingSealFace[] = ['left', 'front', 'back', 'under'];

describe('LoadingBook', () => {
  let loop: jest.SpyInstance;

  beforeEach(() => {
    resetLoadingClockForTests();
    loop = jest.spyOn(Animated, 'loop').mockImplementation(
      () =>
        ({
          start: jest.fn(),
          stop: jest.fn(),
          reset: jest.fn(),
        }) as unknown as Animated.CompositeAnimation
    );
  });

  afterEach(() => {
    loop.mockRestore();
    // 描いたままの部品がある。値を戻すと描き直しが走るので act で包む
    act(() => resetLoadingClockForTests());
  });

  describe('止まっている本（AC-11）', () => {
    const setup = () => render(<LoadingBook animated={false} testID="b" />);

    it('1面に印が1つずつ、周 0 の形で出る', () => {
      const { getAllByTestId } = setup();
      const ids = getAllByTestId(/^b-seal-/).map(el => el.props.testID as string);

      expect(ids.sort()).toEqual([
        'b-seal-back-go',
        'b-seal-front-ichi',
        'b-seal-left-mitsu',
        'b-seal-under-juu',
      ]);
    });

    it('印は左右のページとめくれる紙の表裏の中にある', () => {
      const { getByTestId } = setup();

      expect(within(getByTestId('b-page-left')).getByTestId('b-seal-left-mitsu')).toBeTruthy();
      expect(within(getByTestId('b-page-right')).getByTestId('b-seal-under-juu')).toBeTruthy();
      expect(within(getByTestId('b-leaf-front')).getByTestId('b-seal-front-ichi')).toBeTruthy();
      expect(within(getByTestId('b-leaf-back')).getByTestId('b-seal-back-go')).toBeTruthy();
    });

    it.each([425, 1200])('時計が %d に進んでも開いた形のまま動かない', t => {
      const { getByTestId } = setup();
      at(t);

      expect(firstRotateY(getByTestId('b-leaf-front'))).toBe(0);
      expect(firstRotateY(getByTestId('b-leaf-back'))).toBe(0);
      expect(scaleXOf(getByTestId('b-leaf-front'))).toBe(1);
      expect(opacityOf(getByTestId('b-cast'))).toBe(0);
      expect(opacityOf(getByTestId('b-shade-front'))).toBe(0);
      expect(opacityOf(getByTestId('b-shade-back'))).toBe(0);
    });

    it('本は時計を登録しない', () => {
      setup();

      expect(loop).not.toHaveBeenCalled();
      expect(isLoadingClockRunning()).toBe(false);
    });
  });

  describe('動いている本（AC-12）', () => {
    const setup = () => render(<LoadingBook animated testID="b" />);

    it('4つの面それぞれに、その面に出る印を3つずつ重ねる', () => {
      const { getAllByTestId } = setup();
      const ids = getAllByTestId(/^b-seal-/).map(el => el.props.testID as string);
      const marksOn = (face: LoadingSealFace) =>
        ids
          .filter(id => id.startsWith(`b-seal-${face}-`))
          .map(id => id.slice(`b-seal-${face}-`.length))
          .sort();

      expect(ids).toHaveLength(12);
      expect(marksOn('left')).toEqual(['go', 'mangan', 'mitsu']);
      expect(marksOn('front')).toEqual(['ichi', 'juu', 'shiki']);
      expect(marksOn('back')).toEqual(['go', 'mangan', 'mitsu']);
      expect(marksOn('under')).toEqual(['ichi', 'juu', 'shiki']);
    });

    it('めくりの途中（425ms）で紙が真横を向き、陰と影がいちばん濃い', () => {
      const { getByTestId } = setup();
      at(425);

      const front = getByTestId('b-leaf-front');
      const back = getByTestId('b-leaf-back');
      expect(firstRotateY(front)).toBeCloseTo(-90, 3);
      expect(scaleXOf(front)).toBeCloseTo(0.92, 3);
      expect(firstRotateY(back)).toBeCloseTo(-90, 3);
      expect(transformOf(back)[transformOf(back).length - 1]).toEqual({ rotateY: '180deg' });
      expect(opacityOf(getByTestId('b-cast'))).toBeCloseTo(0.9, 3);
      expect(opacityOf(getByTestId('b-shade-front'))).toBeCloseTo(1, 3);
      expect(opacityOf(getByTestId('b-shade-back'))).toBeCloseTo(1, 3);
    });

    it('めくり終わると紙は左へ倒れきっている', () => {
      const { getByTestId } = setup();
      at(1000);

      expect(firstRotateY(getByTestId('b-leaf-front'))).toBeCloseTo(-179.9, 3);
    });

    it.each([100, 1600, 3100])('t = %d で、各面は sealMarkAt の印だけが見えている', t => {
      const { getAllByTestId } = setup();
      at(t);

      for (const face of FACES) {
        const shown = getAllByTestId(new RegExp(`^b-seal-${face}-`)).map(el => [
          el.props.testID,
          opacityOf(el),
        ]);
        const expected = shown.map(([id]) => [
          id,
          id === `b-seal-${face}-${sealMarkAt(face, t)}` ? 1 : 0,
        ]);
        expect(shown).toEqual(expected);
      }
    });

    it('本は時計を登録しない', () => {
      setup();

      expect(loop).not.toHaveBeenCalled();
      expect(isLoadingClockRunning()).toBe(false);
    });
  });

  // ネイティブで動かせるのは transform と opacity。レイアウトの値を時計につながない
  it('時計につないでいるのは opacity と transform の rotateY・scaleX だけ（AC-13）', () => {
    const { UNSAFE_root } = render(<LoadingBook animated testID="b" />);
    const isNode = (v: unknown) => !!v && typeof v === 'object' && '__getValue' in v;
    const styleKeys = new Set<string>();
    const transformKeys = new Set<string>();

    for (const instance of UNSAFE_root.findAll(() => true)) {
      const style = flat(instance as Styled);
      for (const [key, value] of Object.entries(style)) {
        if (key === 'transform' && Array.isArray(value)) {
          for (const step of value as Transform) {
            for (const [k, v] of Object.entries(step)) {
              if (isNode(v)) {
                transformKeys.add(k);
                styleKeys.add('transform');
              }
            }
          }
        } else if (isNode(value)) {
          styleKeys.add(key);
        }
      }
    }

    expect([...styleKeys].sort()).toEqual(['opacity', 'transform']);
    expect([...transformKeys].sort()).toEqual(['rotateY', 'scaleX']);
  });

  describe('見た目（UI-1）', () => {
    const setup = () => render(<LoadingBook animated testID="b" />);
    const lb = colors.loadingBook;

    it('本の外寸は 128 × 88', () => {
      const style = flat(setup().getByTestId('b'));
      expect(style.width).toBe(128);
      expect(style.height).toBe(88);
    });

    it('表紙は橙から朱のグラデーションで、上に 3 だけ余白がある', () => {
      const cover = setup().getByTestId('b-cover');
      expect(cover.props.colors).toEqual([colors.primary[700], lb.coverEnd]);
      expect(cover.props.start).toEqual({ x: 0.5, y: 0 });
      expect(cover.props.end).toEqual({ x: 0.5, y: 1 });
      expect(flat(cover)).toEqual(
        expect.objectContaining({ top: 3, left: 0, right: 0, bottom: 0, borderRadius: 6 })
      );
    });

    it('紙の厚みは 3 ごとに 1 の線の縞で、左右に 3 寄せて置く', () => {
      const { getByTestId } = setup();
      const left = getByTestId('b-edge-left');
      const right = getByTestId('b-edge-right');

      expect(flat(left)).toEqual(
        expect.objectContaining({ top: 5, bottom: 4, left: 3, width: 4, borderRadius: 2 })
      );
      expect(flat(right)).toEqual(
        expect.objectContaining({ top: 5, bottom: 4, right: 3, width: 4, borderRadius: 2 })
      );

      for (const edge of [left, right]) {
        const edgeColors = edge.props.colors as string[];
        const locations = edge.props.locations as number[];
        expect(edgeColors).toHaveLength(106);
        expect(locations).toHaveLength(106);
        expect(edgeColors.slice(0, 4)).toEqual([lb.paperEdge, lb.paperEdge, lb.paper, lb.paper]);
        expect(edgeColors.slice(-2)).toEqual([lb.paperEdge, lb.paperEdge]);
        [0, 1 / 79, 1 / 79, 3 / 79].forEach((v, i) => expect(locations[i]).toBeCloseTo(v, 6));
        expect(locations[104]).toBeCloseTo(78 / 79, 6);
        expect(locations[105]).toBeCloseTo(1, 6);
        // 同じ location は2つまで（硬い境目）。3つ並べない
        const triples = locations.filter(
          (v, i) => i >= 2 && v === locations[i - 1] && v === locations[i - 2]
        );
        expect(triples).toEqual([]);
        expect(edge.props.start).toEqual({ x: 0.5, y: 0 });
        expect(edge.props.end).toEqual({ x: 0.5, y: 1 });
      }
    });

    it('見開きの紙は左右に 58 ずつ、綴じ目側の角を小さく丸める', () => {
      const { getByTestId } = setup();

      expect(flat(getByTestId('b-page-left'))).toEqual(
        expect.objectContaining({
          top: 0,
          bottom: 6,
          left: 6,
          width: 58,
          backgroundColor: lb.paper,
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
          borderTopRightRadius: 1,
          borderBottomRightRadius: 1,
          overflow: 'hidden',
        })
      );
      expect(flat(getByTestId('b-page-right'))).toEqual(
        expect.objectContaining({
          top: 0,
          bottom: 6,
          right: 6,
          width: 58,
          backgroundColor: lb.paper,
          borderTopLeftRadius: 1,
          borderBottomLeftRadius: 1,
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
          overflow: 'hidden',
        })
      );
    });

    it('綴じ目の陰は綴じ目の側が濃い', () => {
      const { getByTestId } = setup();
      const left = getByTestId('b-gutter-left');
      const right = getByTestId('b-gutter-right');

      expect(flat(left)).toEqual(expect.objectContaining({ right: 0, width: 14 }));
      expect(left.props.colors).toEqual([lb.gutterClear, lb.gutter]);
      expect(flat(right)).toEqual(expect.objectContaining({ left: 0, width: 14 }));
      expect(right.props.colors).toEqual([lb.gutter, lb.gutterClear]);
      for (const gutter of [left, right]) {
        expect(gutter.props.start).toEqual({ x: 0, y: 0.5 });
        expect(gutter.props.end).toEqual({ x: 1, y: 0.5 });
      }
    });

    it('下に落ちる影は右のページに重なり、7割で消える', () => {
      const cast = setup().getByTestId('b-cast');

      expect(flat(cast)).toEqual(
        expect.objectContaining({ right: 6, top: 0, bottom: 6, width: 58 })
      );
      expect(cast.props.colors).toEqual([lb.castStart, lb.castEnd]);
      expect(cast.props.locations).toEqual([0, 0.7]);
    });

    it('めくれる紙は兄弟の2枚で、綴じ目を軸に回す', () => {
      const { getByTestId } = setup();

      for (const id of ['b-leaf-front', 'b-leaf-back']) {
        const leaf = getByTestId(id);
        expect(flat(leaf)).toEqual(
          expect.objectContaining({
            right: 6,
            top: 0,
            bottom: 6,
            width: 58,
            backgroundColor: lb.paper,
            backfaceVisibility: 'hidden',
          })
        );
        const transform = transformOf(leaf);
        expect(transform[0]).toEqual({ perspective: 420 });
        expect(transform[1]).toEqual({ translateX: -29 });
      }

      const front = transformOf(getByTestId('b-leaf-front'));
      expect(front[front.length - 1]).toEqual({ translateX: 29 });
      const back = transformOf(getByTestId('b-leaf-back'));
      expect(back[back.length - 2]).toEqual({ translateX: 29 });
      expect(back[back.length - 1]).toEqual({ rotateY: '180deg' });
    });

    it('紙の面の陰', () => {
      const { getByTestId } = setup();

      expect(getByTestId('b-shade-front').props.colors).toEqual([
        lb.leafShadeStart,
        lb.leafShadeEnd,
      ]);
      expect(getByTestId('b-shade-back').props.colors).toEqual([
        lb.leafShadeStart,
        lb.leafShadeEnd,
      ]);
    });

    it('印は押された朱の Seal を 26 の大きさで、少し透かして置く', () => {
      const { UNSAFE_getAllByType } = setup();
      const seals = UNSAFE_getAllByType(Seal);

      expect(seals).toHaveLength(12);
      for (const seal of seals) {
        expect(seal.props).toEqual(
          expect.objectContaining({ size: 26, earned: true, opacity: 0.9 })
        );
      }
    });

    it('地に落ちる影はぼかした楕円を放射状のグラデーションで描く', () => {
      const { UNSAFE_getAllByType } = setup();
      const shadow = UNSAFE_getAllByType(Svg).find(svg => svg.props.testID === 'b-shadow');

      expect(shadow?.props.width).toBe(124);
      expect(shadow?.props.height).toBe(30);
      expect(StyleSheet.flatten(shadow?.props.style)).toEqual(
        expect.objectContaining({ left: 2, top: 75 })
      );

      const stops = UNSAFE_getAllByType(Stop);
      expect(stops.map(s => s.props.offset)).toEqual([0, 0.47, 1]);
      expect(stops.map(s => s.props.stopColor)).toEqual([lb.shadow, lb.shadow, lb.shadow]);
      expect(stops.map(s => s.props.stopOpacity)).toEqual([0.15, 0.08, 0]);
    });
  });
});
