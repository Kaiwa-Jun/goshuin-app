import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { Path } from 'react-native-svg';

import { FirstStampCard } from '@components/map/FirstStampCard';
import { PrefectureEmboss } from '@components/common/PrefectureEmboss';
import { FIRST_STAMP_CARD_TITLE } from '@utils/firstStamp';
import { zoomToPrefecture } from '@utils/japanMapZoom';
import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';

type Found = { props: Record<string, unknown>; findAllByType: (t: unknown) => Found[] };

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
const opacityOf = (el: Styled) => read(flat(el).opacity ?? 1);
const transformOf = (el: Styled) => (flat(el).transform ?? []) as Transform;
const transformValue = (el: Styled, key: string, fallback = 0) => {
  const t = transformOf(el).find(item => key in item);
  return t ? read(t[key]) : fallback;
};

type TimingConfig = Animated.TimingAnimationConfig;

/*
 * native driver の動きは Jest では値が進まない（描いたときの値のまま）。
 * Animated.timing を spy して、呼ばれた設定（useNativeDriver: true のまま）を記録しつつ、
 * 中身は JS で動かして時間を進めた後の値を読めるようにする
 */
const realTiming = Animated.timing;
let timing: jest.SpyInstance;
const timingCalls = () => timing.mock.calls.map(c => c[1] as TimingConfig);
const callsWith = (duration: number) => timingCalls().filter(c => c.duration === duration);

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

function renderCard(props: Partial<React.ComponentProps<typeof FirstStampCard>> = {}) {
  const handlers = {
    onShoot: jest.fn(),
    onNearby: jest.fn(),
    onDismiss: jest.fn(),
  };
  const all = {
    prefecture: '京都府' as string | null,
    showNearby: true,
    reduceMotion: false,
    ...handlers,
    ...props,
  };
  const r = render(<FirstStampCard {...all} />);
  return { ...r, ...handlers, props: all };
}

describe('FirstStampCard（記録 0 枚の地図のカード。#327）', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    timing = jest
      .spyOn(Animated, 'timing')
      .mockImplementation((value, config) =>
        realTiming(value, { ...config, useNativeDriver: false })
      );
  });

  afterEach(() => {
    timing.mockRestore();
    jest.useRealTimers();
  });

  it('AC-17: 見出し・下の行・2 つのボタン・✕', () => {
    const r = renderCard();

    expect(r.getByTestId('first-stamp-card-title').props.children).toBe(FIRST_STAMP_CARD_TITLE);
    expect(r.getByTestId('first-stamp-card-subtitle').props.children).toBe(
      '撮ると、京都府に色が差します'
    );
    const shoot = within(r.getByTestId('first-stamp-shoot'));
    expect(shoot.getByText('御朱印を撮る')).toBeTruthy();
    expect(shoot.getByText('photo-camera')).toBeTruthy();
    const nearby = within(r.getByTestId('first-stamp-nearby'));
    expect(nearby.getByText('近くの寺社を見る')).toBeTruthy();
    expect(nearby.getByText('near-me')).toBeTruthy();
    const close = r.getByTestId('first-stamp-close');
    expect(close.props.accessibilityLabel).toBe('閉じる');
    expect(close.props.accessibilityRole).toBe('button');
    expect(within(close).getByText('close')).toBeTruthy();
  });

  it('AC-18: カード・文字・ボタン・✕ の形', () => {
    const r = renderCard();

    expect(flat(r.getByTestId('first-stamp-card'))).toEqual(
      expect.objectContaining({
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 16,
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 14,
        ...shadows.floating,
      })
    );
    expect(flat(r.getByTestId('first-stamp-card-title'))).toEqual(
      expect.objectContaining({
        fontSize: 17,
        fontWeight: '700',
        lineHeight: 24,
        color: colors.gray[900],
      })
    );
    expect(flat(r.getByTestId('first-stamp-card-subtitle'))).toEqual(
      expect.objectContaining({ fontSize: 14, lineHeight: 20, color: colors.gray[600] })
    );
    for (const [id, label] of [
      ['first-stamp-shoot', '御朱印を撮る'],
      ['first-stamp-nearby', '近くの寺社を見る'],
    ]) {
      const button = r.getByTestId(id);
      expect(flat(button)).toEqual(expect.objectContaining({ flex: 1, minHeight: 44 }));
      expect(flat(within(button).getByText(label))).toEqual(
        expect.objectContaining({ fontSize: 14, fontWeight: '600' })
      );
    }
    expect(flat(r.getByTestId('first-stamp-shoot'))).toEqual(
      expect.objectContaining({ backgroundColor: colors.primary[500] })
    );
    expect(flat(r.getByTestId('first-stamp-nearby'))).toEqual(
      expect.objectContaining({ borderWidth: 1, borderColor: colors.primary[500] })
    );
    expect(flat(r.getByTestId('first-stamp-close'))).toEqual(
      expect.objectContaining({ position: 'absolute', top: 8, right: 8, width: 32, height: 32 })
    );
  });

  it('AC-19: 小さな日本地図（その県へ 1.8 倍で寄せ、空押しを重ねる）', () => {
    const r = renderCard();
    const map = r.getByTestId('first-stamp-card-map');

    const style = flat(map);
    expect(style).toEqual(
      expect.objectContaining({
        width: 84,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: colors.white,
      })
    );
    expect(style.height as number).toBeCloseTo((84 * 1132) / 1000, 2);

    const outlines = map.findAllByType(Path).filter((p: Found) => p.props.strokeWidth === 3);
    expect(outlines).toHaveLength(47);
    outlines.forEach((p: Found) => {
      expect(p.props.fill).toBe(colors.prefectureFill.empty);
      expect(p.props.stroke).toBe(colors.prefectureFill.border);
    });

    const zoom = zoomToPrefecture('京都府', 84, 1.8);
    const zoomView = r.getByTestId('first-stamp-card-zoom');
    expect(transformValue(zoomView, 'translateX')).toBeCloseTo(zoom.translateX, 6);
    expect(transformValue(zoomView, 'translateY')).toBeCloseTo(zoom.translateY, 6);
    expect(transformValue(zoomView, 'scale', 1)).toBe(1.8);

    const embosses = r.getByTestId('first-stamp-card-emboss').findAllByType(PrefectureEmboss);
    expect(embosses).toHaveLength(1);
    expect(embosses[0].props).toEqual({ prefecture: '京都府', offset: 8, shadeOpacity: 0.45 });
  });

  it('AC-19: 県が分からなければ全国のまま・空押しなし・「その県」', () => {
    const r = renderCard({ prefecture: null });

    expect(r.queryByTestId('first-stamp-card-emboss')).toBeNull();
    const zoomView = r.getByTestId('first-stamp-card-zoom');
    expect(transformValue(zoomView, 'scale', 1)).toBe(1);
    expect(transformValue(zoomView, 'translateX')).toBe(0);
    expect(transformValue(zoomView, 'translateY')).toBe(0);
    expect(r.getByTestId('first-stamp-card-subtitle').props.children).toBe(
      '撮ると、その県に色が差します'
    );
  });

  it('AC-20: 下から 300ms で出て、320ms 後に空押しが 600ms で 1 回だけ浮く', () => {
    const r = renderCard();

    const enter = callsWith(300).find(c => c.toValue === 1);
    expect(enter).toEqual(
      expect.objectContaining({ toValue: 1, duration: 300, useNativeDriver: true })
    );
    expect(enter!.easing!(0.5)).toBeCloseTo(0.875, 3);

    advance(310);
    expect(opacityOf(r.getByTestId('first-stamp-card-emboss'))).toBe(0);
    expect(callsWith(600)).toHaveLength(0);

    advance(20);
    const emboss = callsWith(600);
    expect(emboss).toHaveLength(1);
    expect(emboss[0]).toEqual(
      expect.objectContaining({ toValue: 1, duration: 600, useNativeDriver: true })
    );
    expect(emboss[0].easing!(0.5)).toBeCloseTo(0.75, 3);

    advance(320 + 600 + 50 - 330);
    expect(opacityOf(r.getByTestId('first-stamp-card-emboss'))).toBeCloseTo(1, 2);

    advance(3000);
    expect(callsWith(600)).toHaveLength(1);
  });

  it('AC-21: ✕ で＋の位置へ 280ms で縮んで消え、終わってから onDismiss', () => {
    const r = renderCard();
    advance(1000);
    fireEvent(r.getByTestId('first-stamp-card'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 361, height: 180 } },
    });

    fireEvent.press(r.getByTestId('first-stamp-close'));
    expect(r.onDismiss).toHaveBeenCalledTimes(0);
    const fold = callsWith(280);
    expect(fold).toHaveLength(1);
    expect(fold[0]).toEqual(expect.objectContaining({ duration: 280, useNativeDriver: true }));
    expect(fold[0].easing!(0.5)).toBeCloseTo(0.125, 3);

    // JS で動かしているので、終わりのコマは 280ms の直後のコマ
    advance(280 + 20);
    expect(r.onDismiss).toHaveBeenCalledTimes(1);
    const card = r.getByTestId('first-stamp-card');
    expect(opacityOf(card)).toBeCloseTo(0, 2);
    expect(transformValue(card, 'scale', 1)).toBeCloseTo(0.12, 2);
    const origin = flat(card).transformOrigin;
    expect([JSON.stringify([329, 148, 0]), JSON.stringify('329px 148px')]).toContain(
      JSON.stringify(origin)
    );
  });

  it('AC-22: 視差効果を減らすなら動かさない。✕ はすぐ', () => {
    const r = renderCard({ reduceMotion: true });

    expect(timing).not.toHaveBeenCalled();
    const card = r.getByTestId('first-stamp-card');
    expect(opacityOf(card)).toBe(1);
    expect(transformValue(card, 'translateY')).toBe(0);
    expect(opacityOf(r.getByTestId('first-stamp-card-emboss'))).toBe(1);

    fireEvent.press(r.getByTestId('first-stamp-close'));
    expect(r.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('AC-22: 動いている最中に「視差効果を減らす」になったら、その場で最後の姿', () => {
    const r = renderCard();
    advance(100);

    r.rerender(<FirstStampCard {...r.props} reduceMotion />);
    const card = r.getByTestId('first-stamp-card');
    expect(opacityOf(card)).toBe(1);
    expect(transformValue(card, 'translateY')).toBe(0);
    expect(opacityOf(r.getByTestId('first-stamp-card-emboss'))).toBe(1);

    advance(1000);
    expect(callsWith(600)).toHaveLength(0);
  });

  it('AC-23: 近くの寺社が無ければボタンは 1 つ。押すと呼ぶ', () => {
    const one = renderCard({ showNearby: false });
    expect(one.queryByTestId('first-stamp-nearby')).toBeNull();
    expect(one.getByTestId('first-stamp-shoot')).toBeTruthy();
    one.unmount();

    const r = renderCard();
    fireEvent.press(r.getByTestId('first-stamp-shoot'));
    expect(r.onShoot).toHaveBeenCalledTimes(1);
    fireEvent.press(r.getByTestId('first-stamp-nearby'));
    expect(r.onNearby).toHaveBeenCalledTimes(1);
  });

  it('AC-23: 動きの途中で外しても、待ちと動きが残らない', () => {
    const r = renderCard();
    advance(100);
    r.unmount();

    // Animated.View を外すと RN の中に 1 回きりの timer が 1 つ残る（すぐ消える）。
    // 50ms 進めて、それ以外（空押しの待ち 320ms・動きのコマ）が残っていないことを見る
    advance(50);
    expect(jest.getTimerCount()).toBe(0);
    expect(callsWith(600)).toHaveLength(0);
  });
});
