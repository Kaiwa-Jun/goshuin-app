import React from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { PressableScale } from '@components/common/PressableScale';

describe('PressableScale', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('onPress を素通しする', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PressableScale onPress={onPress} testID="target">
        <Text>押す</Text>
      </PressableScale>
    );

    fireEvent.press(getByTestId('target'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // useNativeDriver: true だと JS 側の値は動かないので、
  // 「どう動かそうとしたか」を見る
  it('押し込むと縮め、離すとバネで戻す', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const spring = jest.spyOn(Animated, 'spring');
    const { getByTestId } = render(
      <PressableScale testID="target">
        <Text>押す</Text>
      </PressableScale>
    );

    fireEvent(getByTestId('target'), 'pressIn');
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 0.92, useNativeDriver: true })
    );

    fireEvent(getByTestId('target'), 'pressOut');
    expect(spring).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, useNativeDriver: true })
    );
  });

  it('pressedScale で縮み具合を変えられる', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const { getByTestId } = render(
      <PressableScale pressedScale={0.8} testID="target">
        <Text>押す</Text>
      </PressableScale>
    );

    fireEvent(getByTestId('target'), 'pressIn');

    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 0.8 })
    );
  });

  // style を内側の View に当てると、flex や position を渡したときに
  // タップ領域と見た目がズレる
  it('style はタップ領域そのものに当たる', () => {
    const { getByTestId } = render(
      <PressableScale style={{ width: 56, height: 56 }} testID="target">
        <Text>押す</Text>
      </PressableScale>
    );

    const style = StyleSheet.flatten(getByTestId('target').props.style) as Record<string, unknown>;
    expect(style.width).toBe(56);
    expect(style.height).toBe(56);
    expect(style.transform).toBeDefined();
  });

  it('渡した onPressIn / onPressOut も呼ぶ', () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const { getByTestId } = render(
      <PressableScale onPressIn={onPressIn} onPressOut={onPressOut} testID="target">
        <Text>押す</Text>
      </PressableScale>
    );

    fireEvent(getByTestId('target'), 'pressIn');
    fireEvent(getByTestId('target'), 'pressOut');

    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('「視差効果を減らす」がオンなら動かさない', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const spring = jest.spyOn(Animated, 'spring');
    const { getByTestId } = render(
      <PressableScale testID="target">
        <Text>押す</Text>
      </PressableScale>
    );
    // isReduceMotionEnabled() の解決を待つ
    await act(async () => {});

    fireEvent(getByTestId('target'), 'pressIn');
    fireEvent(getByTestId('target'), 'pressOut');

    expect(timing).not.toHaveBeenCalled();
    expect(spring).not.toHaveBeenCalled();
  });
});
