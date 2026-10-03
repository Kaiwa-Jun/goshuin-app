import React from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { Path, Svg } from 'react-native-svg';

import { TabBarIcon, resetTabBarIconMotion } from '@components/animated/TabBarIcon';
import { colors } from '@theme/colors';

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

  // open-book / draw は補間の塊で、壊れても発火条件のテストでは気づけない。
  // 最低限、例外なく描けることと発火することを見る
  it.each([
    ['open-book', 'menu-book', 'GalleryTab'],
    ['draw', 'timeline', 'CollectionTab'],
    ['emboss', 'event', 'PlanTab'],
  ] as const)('%s は描画できて、選び直しで発火する', async (motion, icon, route) => {
    const render1 = () => (
      <TabBarIcon name={icon} routeName={route} motion={motion} color="#f27f0d" focused />
    );
    mockActiveRoute = route;
    const { rerender, findByTestId, getByTestId } = render(render1());
    expect(await findByTestId(`tab-icon-${icon}`)).toBeTruthy();

    mockActiveRoute = 'MapTab';
    rerender(render1());
    mockActiveRoute = route;
    rerender(render1());

    expect(timing).toHaveBeenCalledTimes(1);
    expect(getByTestId(`tab-icon-${icon}`)).toBeTruthy();
  });

  describe('emboss（予定。空押しから色が差す #305）', () => {
    /** event から日付の四角を除いた枠（契約書 D-2） */
    const FRAME =
      'M16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z';

    interface Config {
      inputRange: number[];
      outputRange: number[];
    }
    /** interpolate の設定 c の、x での値（区分線形） */
    const at = (c: Config, x: number) => {
      const { inputRange: i, outputRange: o } = c;
      for (let k = 1; k < i.length; k++) {
        if (x <= i[k]) return o[k - 1] + ((o[k] - o[k - 1]) * (x - i[k - 1])) / (i[k] - i[k - 1]);
      }
      return o[o.length - 1];
    };
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

    let interpolate: jest.SpyInstance;
    let setValue: jest.SpyInstance;

    beforeEach(() => {
      interpolate = jest.spyOn(Animated.Value.prototype, 'interpolate');
      setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    });

    afterEach(() => {
      interpolate.mockRestore();
      setValue.mockRestore();
    });

    const plan = (props: { focused?: boolean; size?: number } = {}) => (
      <TabBarIcon
        name="event"
        routeName="PlanTab"
        motion="emboss"
        color="#f27f0d"
        focused={props.focused ?? true}
        size={props.size}
      />
    );

    const reselect = async (props: { focused?: boolean } = {}) => {
      mockActiveRoute = 'PlanTab';
      const utils = render(plan(props));
      await utils.findByTestId('tab-icon-event');
      mockActiveRoute = 'MapTab';
      utils.rerender(plan(props));
      mockActiveRoute = 'PlanTab';
      utils.rerender(plan(props));
      return utils;
    };

    const styleOf = (utils: ReturnType<typeof render>, layer: string) =>
      StyleSheet.flatten(utils.getByTestId(`tab-icon-event-${layer}`).props.style);

    it('AC-2: event の枠を SVG で描き、フォントのグリフは描かない', () => {
      const utils = render(plan());
      expect(utils.getByTestId('tab-icon-event')).toBeTruthy();
      expect(utils.getByTestId('tab-icon-event-frame')).toBeTruthy();
      expect(utils.queryByText('event')).toBeNull();

      const svgs = utils.UNSAFE_getAllByType(Svg);
      expect(svgs).toHaveLength(1);
      expect(svgs[0].props).toMatchObject({ viewBox: '0 0 24 24', width: 24, height: 24 });
      const paths = utils.UNSAFE_getAllByType(Path);
      expect(paths).toHaveLength(1);
      expect(paths[0].props).toMatchObject({ d: FRAME, fill: '#f27f0d' });
    });

    it('AC-3: 日付の四角に、輪郭・四角・朱の3枚を重ねる', () => {
      const utils = render(plan());
      const box = { position: 'absolute', left: 12, top: 12, width: 5, height: 5 };
      for (const layer of ['ring', 'square', 'seal']) {
        expect(styleOf(utils, layer)).toMatchObject(box);
      }
      expect(styleOf(utils, 'ring')).toMatchObject({ borderWidth: 1, borderColor: '#f27f0d' });
      expect(styleOf(utils, 'square')).toMatchObject({ backgroundColor: '#f27f0d' });
      expect(styleOf(utils, 'seal')).toMatchObject({ backgroundColor: colors.seal });
    });

    it('AC-4: 大きさに比例する', () => {
      const utils = render(plan({ size: 48 }));
      expect(utils.UNSAFE_getAllByType(Svg)[0].props).toMatchObject({ width: 48, height: 48 });
      expect(styleOf(utils, 'square')).toMatchObject({ left: 24, top: 24, width: 10, height: 10 });
      expect(styleOf(utils, 'ring')).toMatchObject({ borderWidth: 2 });
    });

    it('AC-5: 後ろから 枠 → 輪郭 → 四角 → 朱 の順に重ねる', () => {
      const utils = render(plan());
      expect(
        utils
          .getAllByTestId(/^tab-icon-event-(frame|ring|square|seal)$/)
          .map(node => node.props.testID)
      ).toEqual([
        'tab-icon-event-frame',
        'tab-icon-event-ring',
        'tab-icon-event-square',
        'tab-icon-event-seal',
      ]);
    });

    it('AC-6/7: interpolate には数の節だけを渡し（native driver で落ちない）、試作の形を持たせる', async () => {
      await reselect();
      const configs = interpolate.mock.calls.map(call => call[0] as Config);
      expect(configs.length).toBeGreaterThan(0);
      const allowed = [
        'inputRange',
        'outputRange',
        'extrapolate',
        'extrapolateLeft',
        'extrapolateRight',
      ];
      for (const c of configs) {
        expect(Object.keys(c).every(key => allowed.includes(key))).toBe(true);
        expect(c.outputRange.every(v => typeof v === 'number')).toBe(true);
        expect(c.inputRange[0]).toBe(0);
        expect(c.inputRange[c.inputRange.length - 1]).toBe(1);
        c.inputRange.slice(1).forEach((x, k) => expect(x).toBeGreaterThan(c.inputRange[k]));
      }

      const ringOpacity = configs.some(
        c =>
          near(at(c, 0), 0) &&
          near(at(c, 0.35), 0.55) &&
          near(at(c, 0.75), 0.55) &&
          near(at(c, 1), 0) &&
          Math.max(...c.outputRange) <= 0.55 + 1e-12
      );
      const ringScale = configs.some(
        c =>
          near(at(c, 0), 1.12) &&
          near(at(c, 0.35), 1) &&
          near(at(c, 1), 1) &&
          c.outputRange.every((v, k, all) => k === 0 || v <= all[k - 1]) &&
          Math.min(...c.outputRange) >= 1 - 1e-12
      );
      const sealOpacity = configs.some(
        c => near(at(c, 0), 0) && near(at(c, 0.3), 0) && near(at(c, 0.65), 1) && near(at(c, 1), 0)
      );
      const squareOpacity = configs.some(
        c =>
          JSON.stringify(c.inputRange) === '[0,0.64,0.65,1]' &&
          JSON.stringify(c.outputRange) === '[0,0,1,1]'
      );
      expect({ ringOpacity, ringScale, sealOpacity, squareOpacity }).toEqual({
        ringOpacity: true,
        ringScale: true,
        sealOpacity: true,
        squareOpacity: true,
      });
    });

    it('AC-8: 起動直後に予定タブが選ばれていても動かさない', async () => {
      mockActiveRoute = 'PlanTab';
      const { findByTestId } = render(plan());
      await findByTestId('tab-icon-event');
      expect(timing).not.toHaveBeenCalled();
    });

    it('AC-9: 選び直すと、600ms 以内・一定の速さ・native driver で1回動く', async () => {
      await reselect();
      expect(timing).toHaveBeenCalledTimes(1);
      const config = timing.mock.calls[0][1];
      expect(config).toMatchObject({ toValue: 1, useNativeDriver: true });
      expect(config.duration).toBeGreaterThan(0);
      expect(config.duration).toBeLessThanOrEqual(600);
      // 形は interpolate の節に持たせ、時間は一定の速さで進める
      expect(config.easing).toBe(Easing.linear);
    });

    it('AC-10: 連打されても毎回先頭から動かす', async () => {
      const { rerender } = await reselect();
      mockActiveRoute = 'MapTab';
      rerender(plan());
      mockActiveRoute = 'PlanTab';
      rerender(plan());

      expect(timing).toHaveBeenCalledTimes(2);
      expect(timing.mock.calls.map(call => call[1].toValue)).toEqual([1, 1]);
      const resets = setValue.mock.calls
        .map((call, k) => ({ value: call[0], order: setValue.mock.invocationCallOrder[k] }))
        .filter(call => call.value === 0);
      const [first, second] = timing.mock.invocationCallOrder;
      expect(resets).toHaveLength(2);
      expect(resets[0].order).toBeLessThan(first);
      expect(resets[1].order).toBeGreaterThan(first);
      expect(resets[1].order).toBeLessThan(second);
    });

    it('AC-11: 重なっている非アクティブ側の複製では動かさない', async () => {
      await reselect({ focused: false });
      expect(timing).not.toHaveBeenCalled();
    });

    it('AC-12: 視差効果を減らす設定がオンなら動かさない', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await reselect();
      expect(timing).not.toHaveBeenCalled();
    });
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
