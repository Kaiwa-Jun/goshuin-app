import React from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { render } from '@testing-library/react-native';

import { TabBarIcon } from '@components/animated/TabBarIcon';

describe('TabBarIcon', () => {
  let timing: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
    timing = jest.spyOn(Animated, 'timing');
  });

  afterEach(() => {
    timing.mockRestore();
  });

  const renderIcon = (focused: boolean) =>
    render(<TabBarIcon name="explore" color="#f27f0d" focused={focused} />);

  it('アイコンを描画する', () => {
    const { getByTestId } = renderIcon(false);
    expect(getByTestId('tab-icon-explore')).toBeTruthy();
  });

  it('最初から選択されている場合は回さない（起動時に勝手に動かない）', () => {
    renderIcon(true);
    expect(timing).not.toHaveBeenCalled();
  });

  it('未選択から選択に変わったときだけ回す', async () => {
    const { rerender } = renderIcon(false);
    expect(timing).not.toHaveBeenCalled();

    rerender(<TabBarIcon name="explore" color="#f27f0d" focused />);
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 1, useNativeDriver: true });
  });

  it('選択が外れるときは回さない', () => {
    const { rerender } = renderIcon(true);
    rerender(<TabBarIcon name="explore" color="#f27f0d" focused={false} />);
    expect(timing).not.toHaveBeenCalled();
  });

  it('視差効果を減らす設定がオンなら回さない', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { rerender, findByTestId } = renderIcon(false);
    await findByTestId('tab-icon-explore');

    rerender(<TabBarIcon name="explore" color="#f27f0d" focused />);
    expect(timing).not.toHaveBeenCalled();
  });
});
