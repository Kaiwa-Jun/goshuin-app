import React from 'react';
import { Animated, Easing } from 'react-native';
import { act, render } from '@testing-library/react-native';

import {
  acquireLoadingClock,
  breathOpacityAt,
  flipProgressAt,
  isLoadingClockRunning,
  loadingClock,
  loadingMotion,
  resetLoadingClockForTests,
  sealMarkAt,
  sealOpacity,
  useLoadingClock,
  type LoadingSealFace,
  type LoadingSealMark,
} from '@components/gallery/loadingClock';

type Stub = { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };

/** 呼ぶたびに新しいスタブを返す。スタブごとに start / stop を数える */
function stubLoop() {
  const stubs: Stub[] = [];
  const spy = jest.spyOn(Animated, 'loop').mockImplementation(() => {
    const stub: Stub = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    stubs.push(stub);
    return stub as unknown as Animated.CompositeAnimation;
  });
  const started = () => stubs.reduce((n, s) => n + s.start.mock.calls.length, 0);
  const stopped = () => stubs.reduce((n, s) => n + s.stop.mock.calls.length, 0);
  return { spy, stubs, started, stopped };
}

function Holder({ active }: { active: boolean }) {
  useLoadingClock(active);
  return null;
}

/** 描いた値を読む。ノードならその値、値そのものならそれ */
const read = (node: unknown): number => {
  const v =
    node && typeof node === 'object' && '__getValue' in node
      ? (node as { __getValue: () => unknown }).__getValue()
      : node;
  return typeof v === 'string' ? parseFloat(v) : (v as number);
};

const at = (t: number) => act(() => loadingClock.setValue(t));

const FACES: LoadingSealFace[] = ['left', 'front', 'back', 'under'];
const MARKS_ON: Record<LoadingSealFace, LoadingSealMark[]> = {
  left: ['mitsu', 'go', 'mangan'],
  front: ['ichi', 'juu', 'shiki'],
  back: ['go', 'mangan', 'mitsu'],
  under: ['juu', 'shiki', 'ichi'],
};

describe('loadingClock', () => {
  let loop: ReturnType<typeof stubLoop>;

  beforeEach(() => {
    resetLoadingClockForTests();
    loop = stubLoop();
  });

  afterEach(() => {
    loop.spy.mockRestore();
    // 描いたままの部品がある。値を戻すと描き直しが走るので act で包む
    act(() => resetLoadingClockForTests());
  });

  describe('時計の登録（AC-1〜5）', () => {
    // 枠がいくつあっても時計は1本。枠ごとに loop を作らない
    it('3つが登録しても loop は1本だけ回る', () => {
      const timing = jest.spyOn(Animated, 'timing');
      render(
        <>
          <Holder active />
          <Holder active />
          <Holder active />
        </>
      );

      expect(loop.spy).toHaveBeenCalledTimes(1);
      expect(loop.stubs[0].start).toHaveBeenCalledTimes(1);
      expect(isLoadingClockRunning()).toBe(true);

      const clockCall = timing.mock.calls.find(([value]) => value === loadingClock);
      expect(clockCall?.[1]).toEqual(
        expect.objectContaining({ toValue: 72000, duration: 72000, useNativeDriver: true })
      );
      const easing = (clockCall?.[1] as { easing: (t: number) => number }).easing;
      expect(easing(0.25)).toBe(0.25);
      expect(easing(0.8)).toBe(0.8);
      timing.mockRestore();
    });

    it('最後の1つが外れたときだけ止める', () => {
      const { rerender } = render(
        <>
          <Holder active />
          <Holder active />
          <Holder active />
        </>
      );

      rerender(<Holder active />);
      expect(loop.stubs[0].stop).not.toHaveBeenCalled();
      expect(isLoadingClockRunning()).toBe(true);

      rerender(<></>);
      expect(loop.stubs[0].stop).toHaveBeenCalledTimes(1);
      expect(isLoadingClockRunning()).toBe(false);
    });

    // ネイティブの loop は start したときの値から回る。途中の値から始めると1周の速さがずれる
    it('回し始める直前に値を 0 に戻す', () => {
      const { rerender } = render(<Holder active />);
      rerender(<></>);
      loadingClock.setValue(12345);

      let valueAtStart: number | null = null;
      loop.spy.mockImplementationOnce(() => {
        const stub: Stub = {
          start: jest.fn(() => {
            valueAtStart = read(loadingClock);
          }),
          stop: jest.fn(),
          reset: jest.fn(),
        };
        loop.stubs.push(stub);
        return stub as unknown as Animated.CompositeAnimation;
      });
      rerender(<Holder active />);

      expect(loop.spy).toHaveBeenCalledTimes(2);
      expect(valueAtStart).toBe(0);
    });

    // ふわっと消えている最中の下地が跳ねないように
    it('止めるときは値を戻さない', () => {
      const { rerender } = render(<Holder active />);
      loadingClock.setValue(777);

      rerender(<></>);

      expect(loop.stubs[0].stop).toHaveBeenCalledTimes(1);
      expect(read(loadingClock)).toBe(777);
    });

    it('登録していなければ回さない', () => {
      render(<Holder active={false} />);

      expect(loop.spy).not.toHaveBeenCalled();
      expect(isLoadingClockRunning()).toBe(false);
    });

    it('登録の切り替えで start と stop が交互に呼ばれ、回っている本数は 0 か 1', () => {
      const balance = () => loop.started() - loop.stopped();
      const { rerender } = render(<Holder active={false} />);
      expect(balance()).toBe(0);
      expect(isLoadingClockRunning()).toBe(false);

      rerender(<Holder active />);
      expect(balance()).toBe(1);
      expect(isLoadingClockRunning()).toBe(true);

      rerender(<Holder active={false} />);
      expect(balance()).toBe(0);
      expect(isLoadingClockRunning()).toBe(false);

      rerender(<Holder active />);
      expect(balance()).toBe(1);
      expect(isLoadingClockRunning()).toBe(true);

      expect(loop.stubs[0].start).toHaveBeenCalledTimes(1);
      expect(loop.stubs[0].stop).toHaveBeenCalledTimes(1);
      expect(loop.stubs[1].start).toHaveBeenCalledTimes(1);
      expect(loop.stubs[0].start.mock.invocationCallOrder[0]).toBeLessThan(
        loop.stubs[0].stop.mock.invocationCallOrder[0]
      );
      expect(loop.stubs[0].stop.mock.invocationCallOrder[0]).toBeLessThan(
        loop.stubs[1].start.mock.invocationCallOrder[0]
      );
    });

    it('release を2回呼んでも1回分しか減らさない', () => {
      const a = acquireLoadingClock();
      const b = acquireLoadingClock();
      a();
      a();

      expect(isLoadingClockRunning()).toBe(true);
      expect(loop.stubs[0].stop).not.toHaveBeenCalled();

      b();
      expect(loop.stubs[0].stop).toHaveBeenCalledTimes(1);
      expect(isLoadingClockRunning()).toBe(false);
    });
  });

  describe('式（AC-6・7）', () => {
    it.each([
      [0, 0],
      [425, 0.5],
      [850, 1],
      [1200, 1],
      [1499, 1],
      [1500, 0],
      [1925, 0.5],
    ])('flipProgressAt(%d) は %d', (t, expected) => {
      expect(flipProgressAt(t)).toBeCloseTo(expected, 9);
    });

    it('めくりの曲線は Easing.inOut(Easing.quad)', () => {
      expect(flipProgressAt(212.5)).toBeCloseTo(Easing.inOut(Easing.quad)(0.25), 9);
      expect(flipProgressAt(212.5)).toBeCloseTo(0.125, 9);
    });

    it.each([
      [0, 1],
      [400, 0.86],
      [800, 0.72],
      [1200, 0.86],
      [1600, 1],
      [2400, 0.72],
    ])('breathOpacityAt(%d) は %d', (t, expected) => {
      expect(breathOpacityAt(t)).toBeCloseTo(expected, 9);
    });

    it.each([
      [[100, 1000, 1400, 4600], { left: 'mitsu', front: 'ichi', back: 'go', under: 'juu' }],
      [[1600, 2900], { left: 'go', front: 'juu', back: 'mangan', under: 'shiki' }],
      [[3100, 4400], { left: 'mangan', front: 'shiki', back: 'mitsu', under: 'ichi' }],
    ] as const)('sealMarkAt: t = %p で %p', (times, expected) => {
      for (const t of times) {
        for (const face of FACES) {
          expect([t, face, sealMarkAt(face, t)]).toEqual([t, face, expected[face]]);
        }
      }
    });
  });

  describe('共有のノード（AC-8・9）', () => {
    it.each([
      [0, 0],
      [425, -90],
      [850, -180],
      [1200, -180],
      [1500, 0],
      [1925, -90],
    ])('t = %d で紙の回転が %d deg', (t, deg) => {
      at(t);
      expect(read(loadingMotion.leafRotateY)).toBeCloseTo(deg, 3);
    });

    it('回転の点は flipProgressAt から作っている', () => {
      for (let i = 0; i <= 10; i++) {
        at(85 * i);
        expect(read(loadingMotion.leafRotateY)).toBeCloseTo(-180 * flipProgressAt(85 * i), 3);
      }
    });

    it('紙の縮み・陰・下に落ちる影', () => {
      at(425);
      expect(read(loadingMotion.leafScaleX)).toBeCloseTo(0.92, 3);
      expect(read(loadingMotion.leafShadeOpacity)).toBeCloseTo(1, 3);
      expect(read(loadingMotion.castOpacity)).toBeCloseTo(0.9, 3);

      at(850);
      expect(read(loadingMotion.leafScaleX)).toBeCloseTo(1, 3);

      at(0);
      expect(read(loadingMotion.leafShadeOpacity)).toBeCloseTo(0, 3);

      at(1200);
      expect(read(loadingMotion.castOpacity)).toBeCloseTo(0, 3);
    });

    it.each([
      [0, 1],
      [400, 0.86],
      [800, 0.72],
      [2400, 0.72],
    ])('t = %d で明滅が %d', (t, expected) => {
      at(t);
      expect(read(loadingMotion.breathOpacity)).toBeCloseTo(expected, 3);
    });

    it.each([100, 1000, 1600, 2900, 3100, 4400])(
      't = %d で、各面は sealMarkAt の印だけが見えている',
      t => {
        at(t);
        for (const face of FACES) {
          for (const mark of MARKS_ON[face]) {
            const expected = mark === sealMarkAt(face, t) ? 1 : 0;
            expect([face, mark, read(sealOpacity(face, mark))]).toEqual([face, mark, expected]);
          }
        }
      }
    );

    // 左と表は境目の1ms前、裏と下は1ms後に切り替える。見えている面は混ざらない
    it('左と表を切り替えている途中も、裏と下は1つの印のまま', () => {
      at(1499.5);
      expect(read(sealOpacity('back', 'go'))).toBe(1);
      expect(read(sealOpacity('under', 'juu'))).toBe(1);
      expect(read(sealOpacity('left', 'mitsu'))).toBeCloseTo(0.5, 2);
      expect(read(sealOpacity('left', 'go'))).toBeCloseTo(0.5, 2);
    });

    it('裏と下を切り替えている途中も、左と表は1つの印のまま', () => {
      at(1500.5);
      expect(read(sealOpacity('left', 'go'))).toBe(1);
      expect(read(sealOpacity('front', 'juu'))).toBe(1);
      expect(read(sealOpacity('back', 'go'))).toBeCloseTo(0.5, 2);
      expect(read(sealOpacity('back', 'mangan'))).toBeCloseTo(0.5, 2);
    });
  });
});
