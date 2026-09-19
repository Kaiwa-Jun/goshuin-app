import React from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { render } from '@testing-library/react-native';

import { TabBarIcon, resetTabBarIconMotion } from '@components/animated/TabBarIcon';

// 実際の選択状態はナビゲーションの state から取るので、そこを差し替える
let mockActiveRoute = 'MapTab';
jest.mock('@react-navigation/native', () => ({
  useNavigationState: (selector: (state: unknown) => unknown) =>
    selector({ index: 0, routes: [{ name: mockActiveRoute }] }),
}));

describe('TabBarIcon', () => {
  let timing: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTabBarIconMotion();
    mockActiveRoute = 'MapTab';
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
    timing = jest.spyOn(Animated, 'timing');
  });

  afterEach(() => {
    timing.mockRestore();
  });

  const compass = (props: { focused?: boolean } = {}) => (
    <TabBarIcon
      name="explore"
      routeName="MapTab"
      motion="spin"
      color="#f27f0d"
      focused={props.focused ?? true}
    />
  );

  it('アイコンを描画する', () => {
    const { getByTestId } = render(compass());
    expect(getByTestId('tab-icon-explore')).toBeTruthy();
  });

  it('最初から選択されている場合は動かさない（起動時に勝手に動かない）', () => {
    render(compass());
    expect(timing).not.toHaveBeenCalled();
  });

  it('選択が外れたあと、選び直されたときに動かす', async () => {
    const { rerender, findByTestId } = render(compass());
    await findByTestId('tab-icon-explore');

    mockActiveRoute = 'Settings';
    rerender(compass());
    expect(timing).not.toHaveBeenCalled();

    mockActiveRoute = 'MapTab';
    rerender(compass());
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ useNativeDriver: true });
  });

  it('重なっている非アクティブ側の複製では動かさない', async () => {
    const { rerender, findByTestId } = render(compass({ focused: false }));
    await findByTestId('tab-icon-explore');

    mockActiveRoute = 'Settings';
    rerender(compass({ focused: false }));
    mockActiveRoute = 'MapTab';
    rerender(compass({ focused: false }));

    expect(timing).not.toHaveBeenCalled();
  });

  it('視差効果を減らす設定がオンなら動かさない', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { rerender, findByTestId } = render(compass());
    await findByTestId('tab-icon-explore');

    mockActiveRoute = 'Settings';
    rerender(compass());
    mockActiveRoute = 'MapTab';
    rerender(compass());

    expect(timing).not.toHaveBeenCalled();
  });

  it('歯車は戻さず、押すたびに1歯ぶん進む', async () => {
    const gear = () => (
      <TabBarIcon name="settings" routeName="Settings" motion="gear" color="#f27f0d" focused />
    );
    const { rerender, findByTestId } = render(gear());
    await findByTestId('tab-icon-settings');

    mockActiveRoute = 'Settings';
    rerender(gear());
    mockActiveRoute = 'MapTab';
    rerender(gear());
    mockActiveRoute = 'Settings';
    rerender(gear());

    expect(timing).toHaveBeenCalledTimes(2);
    // 戻さずに積み上がる
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 1 });
    expect(timing.mock.calls[1][1]).toMatchObject({ toValue: 2 });
  });
});
