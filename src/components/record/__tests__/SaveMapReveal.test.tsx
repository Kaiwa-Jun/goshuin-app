import { act, render, within } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { Path } from 'react-native-svg';

import {
  SaveMapReveal,
  HOLD_MS,
  ZOOM_MS,
  PIN_MS,
  EMBOSS_IN_DELAY_MS,
  EMBOSS_FADE_MS,
  TINT_FADE_MS,
} from '@components/record/SaveMapReveal';
import { PrefectureEmboss } from '@components/common/PrefectureEmboss';
import { zoomToPrefecture } from '@utils/japanMapZoom';
import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_BOXES,
  JAPAN_PREFECTURE_PATHS,
} from '@/constants/japanMap';

import { colors } from '@theme/colors';

const asPayload = (hex: string) => 0xff000000 + parseInt(hex.slice(1), 16);
const fillOf = (el: { props: { fill: { payload: number } } }) => el.props.fill?.payload;

const setup = (props: Partial<React.ComponentProps<typeof SaveMapReveal>> = {}) =>
  render(
    <SaveMapReveal
      prefecture="東京都"
      stampCountByPrefecture={{ 東京都: 1, 宮城県: 9 }}
      width={210}
      {...props}
    />
  );

describe('SaveMapReveal', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('47県ぶん描く', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false as never);
    const { getAllByTestId } = setup();
    await act(async () => {});

    expect(getAllByTestId(/^save-map-(?!pin)/)).toHaveLength(47);
  });

  // 寄り終わるまで色をつけない。先に色づくと、ピンが落ちる意味がなくなる
  it('寄り終わってから、その県が色づく', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false as never);
    const { getByTestId } = setup();
    await act(async () => {});

    expect(fillOf(getByTestId('save-map-東京都'))).toBe(asPayload(colors.prefectureFill.empty));
    expect(fillOf(getByTestId('save-map-宮城県'))).toBe(asPayload(colors.prefectureFill.tier3));

    await act(async () => {
      jest.advanceTimersByTime(HOLD_MS + ZOOM_MS + PIN_MS + 50);
    });

    expect(fillOf(getByTestId('save-map-東京都'))).toBe(asPayload(colors.prefectureFill.tier1));
  });

  // 落ちてきたピンが、地図タブで見るのと同じピンになる
  /*
   * 2回目以降の県は、寄っている間「記録する前の濃さ」で出る。empty に戻すと
   * 一度も行っていない県のように見えるし、最終の濃さを先に出すと
   * 「1段濃くなる」瞬間が消える
   */
  it('2回目以降の県は、記録する前の濃さから1段濃くなる', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false as never);
    // 5枚目まで持っていて、いま1枚足して6枚目 = tier2 → tier3
    const { getByTestId } = render(
      <SaveMapReveal
        prefecture="東京都"
        stampCountByPrefecture={{ 東京都: 6 }}
        addedCount={1}
        width={210}
      />
    );
    await act(async () => {});

    expect(fillOf(getByTestId('save-map-東京都'))).toBe(asPayload(colors.prefectureFill.tier2));

    await act(async () => {
      jest.advanceTimersByTime(HOLD_MS + ZOOM_MS + PIN_MS + 50);
    });

    expect(fillOf(getByTestId('save-map-東京都'))).toBe(asPayload(colors.prefectureFill.tier3));
  });

  // 初めての県は「まだ」の灰から色がつく
  it('初めての県は、まだの灰から色がつく', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false as never);
    const { getByTestId } = setup({ stampCountByPrefecture: { 東京都: 1 }, addedCount: 1 });
    await act(async () => {});

    expect(fillOf(getByTestId('save-map-東京都'))).toBe(asPayload(colors.prefectureFill.empty));

    await act(async () => {
      jest.advanceTimersByTime(HOLD_MS + ZOOM_MS + PIN_MS + 50);
    });

    expect(fillOf(getByTestId('save-map-東京都'))).toBe(asPayload(colors.prefectureFill.tier1));
  });

  it.each([
    ['shrine', colors.pin.shrineVisited],
    ['temple', colors.pin.templeVisited],
  ])('%s のピンは %s', async (spotType, expected) => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true as never);
    const { getByTestId } = setup({ spotType: spotType as 'shrine' | 'temple' });
    await act(async () => {});

    const fills = getByTestId('save-map-pin')
      .findAllByType('RNSVGCircle' as never)
      .map((el: { props: { fill?: { payload: number } } }) => el.props.fill?.payload);

    // 白フチの円と、色の円。色の方が種別に合っている
    expect(fills).toContain(asPayload(expected));
  });

  it('動きを減らす設定なら、寄り終わった状態をすぐ出す', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true as never);
    const { getByTestId } = setup();

    await act(async () => {});

    expect(fillOf(getByTestId('save-map-東京都'))).toBe(asPayload(colors.prefectureFill.tier1));
  });
});

describe('ピンの位置と読み上げ', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true as never);
  });

  /*
   * 端の県は移動量を頭打ちにしていて中心まで寄り切らない。枠の中心に置くと
   * 県から外れたところに刺さる
   */
  /*
   * 端の県は移動量を頭打ちにしていて中心まで寄り切らない。枠の中心に置くと
   * 県から外れたところに刺さる。**その県の上**に来ているかを、県の範囲で見る
   */
  it.each(['沖縄県', '鹿児島県', '北海道', '東京都'])(
    '%s でも、ピンがその県の上に来る',
    async name => {
      const width = 210;
      const tree = render(
        <SaveMapReveal prefecture={name} stampCountByPrefecture={{ [name]: 1 }} width={width} />
      );
      await act(async () => {});

      const placed = StyleSheet.flatten(tree.getByTestId('save-map-pin').props.style);
      // 尾の先（left + 幅/2, top + 高さ）が指す点
      const tip = { x: placed.left + (84 * 0.34) / 2, y: placed.top + 120 * 0.34 };

      // その県が、寄せたあと画面のどこに広がっているか
      const box = JAPAN_PREFECTURE_BOXES[name];
      const { scale, translateX, translateY } = zoomToPrefecture(name, width);
      const height = (width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;
      const k = width / JAPAN_MAP_WIDTH;
      const toScreen = (v: number, center: number, t: number) =>
        scale * (v * k - center) + t + center;
      const left = toScreen(box.x, width / 2, translateX);
      const right = toScreen(box.x + box.width, width / 2, translateX);
      const top = toScreen(box.y, height / 2, translateY);
      const bottom = toScreen(box.y + box.height, height / 2, translateY);

      expect({ name, inside: tip.x >= left && tip.x <= right }).toEqual({ name, inside: true });
      expect({ name, inside: tip.y >= top && tip.y <= bottom }).toEqual({ name, inside: true });
      tree.unmount();
    }
  );

  it('読み上げで、どの県が色づいたか分かる', async () => {
    const { getByTestId } = setup({ stampCountByPrefecture: { 東京都: 1, 宮城県: 9 } });
    await act(async () => {});

    expect(getByTestId('save-map').props.accessibilityLabel).toBe(
      '東京都がいま色づきました。47都道府県のうち2県'
    );
  });
});

/* Issue #327: 記録全体の 1 枚目だけ、寄る間にその県を空押しで浮かせ、ピンが落ちたら 0.6 秒で色を差す */
describe('SaveMapReveal（#327 1 枚目）', () => {
  type Styled = { props: { style?: unknown } };
  type Found = { props: Record<string, unknown>; findAllByType: (t: unknown) => Found[] };
  const read = (value: unknown): number => {
    const v =
      value && typeof value === 'object' && '__getValue' in value
        ? (value as { __getValue: () => unknown }).__getValue()
        : value;
    return typeof v === 'string' ? parseFloat(v) : (v as number);
  };
  const opacityOf = (el: Styled) =>
    read((StyleSheet.flatten(el.props.style) as { opacity?: unknown } | undefined)?.opacity ?? 1);

  /*
   * native driver の動きは Jest では値が進まない。Animated.timing を spy して設定（useNativeDriver: true）を
   * 記録しつつ、中身は JS で動かして時間を進めた後の値を読む
   */
  const realTiming = Animated.timing;
  let timing: jest.SpyInstance;
  const fades = () =>
    timing.mock.calls
      .map(c => c[1] as Animated.TimingAnimationConfig)
      .filter(c => c.duration === 600);

  const renderFirst = (reduce = false) => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduce as never);
    const onSettled = jest.fn();
    const r = render(
      <SaveMapReveal
        firstStamp
        prefecture="東京都"
        stampCountByPrefecture={{ 東京都: 1 }}
        addedCount={1}
        width={210}
        onSettled={onSettled}
      />
    );
    return { ...r, onSettled };
  };
  const emboss = (r: ReturnType<typeof render>) => opacityOf(r.getByTestId('save-reveal-emboss'));
  const tint = (r: ReturnType<typeof render>) => opacityOf(r.getByTestId('save-reveal-tint'));
  const fill = (r: ReturnType<typeof render>) => fillOf(r.getByTestId('save-map-東京都'));
  const advanceTo = (now: { t: number }, to: number) =>
    act(() => {
      jest.advanceTimersByTime(to - now.t);
      now.t = to;
    });

  beforeEach(() => {
    jest.useFakeTimers();
    timing = jest
      .spyOn(Animated, 'timing')
      .mockImplementation((value, config) =>
        realTiming(value, { ...config, useNativeDriver: false })
      );
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('AC-42: firstStamp を渡さなければ層を足さない', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false as never);
    const r = setup();
    await act(async () => {});

    expect(r.queryByTestId('save-reveal-emboss')).toBeNull();
    expect(r.queryByTestId('save-reveal-tint')).toBeNull();
  });

  it('AC-43: 空押しと色の層を、寄りと一緒に動く所（ピンより下）に重ねる', async () => {
    const r = renderFirst();
    await act(async () => {});

    const embossLayer = r.getByTestId('save-reveal-emboss');
    const embosses = (embossLayer as unknown as Found).findAllByType(PrefectureEmboss);
    expect(embosses).toHaveLength(1);
    expect(embosses[0].props).toEqual({ prefecture: '東京都', offset: 2.5, shadeOpacity: 0.26 });

    const tintPaths = (r.getByTestId('save-reveal-tint') as unknown as Found).findAllByType(Path);
    expect(tintPaths).toHaveLength(1);
    expect(tintPaths[0].props).toEqual(
      expect.objectContaining({
        d: JAPAN_PREFECTURE_PATHS['東京都'],
        fill: colors.prefectureFill.tier1,
        stroke: colors.prefectureFill.border,
        strokeWidth: 2,
      })
    );
    expect(emboss(r)).toBe(0);
    expect(tint(r)).toBe(0);

    const zoom = within(r.getByTestId('save-reveal-zoom'));
    expect(zoom.getByTestId('save-reveal-emboss')).toBeTruthy();
    expect(zoom.getByTestId('save-reveal-tint')).toBeTruthy();
    expect(zoom.queryByTestId('save-map-pin')).toBeNull();
    expect(r.getByTestId('save-map-pin')).toBeTruthy();
  });

  it('AC-44・45: 寄る間に空押しが浮き、ピンが落ちてから 0.6 秒で色が差す（点滅しない）', async () => {
    const r = renderFirst();
    await act(async () => {});
    const now = { t: 0 };
    const settle = HOLD_MS + ZOOM_MS + PIN_MS;

    expect([EMBOSS_IN_DELAY_MS, EMBOSS_FADE_MS, TINT_FADE_MS]).toEqual([600, 600, 600]);

    advanceTo(now, HOLD_MS + EMBOSS_IN_DELAY_MS - 50);
    expect(emboss(r)).toBe(0);
    advanceTo(now, HOLD_MS + EMBOSS_IN_DELAY_MS + EMBOSS_FADE_MS + 50);
    expect(emboss(r)).toBeCloseTo(1, 2);

    advanceTo(now, settle - 50);
    expect(tint(r)).toBe(0);
    expect(fill(r)).toBe(asPayload(colors.prefectureFill.empty));
    expect(r.onSettled).toHaveBeenCalledTimes(0);

    advanceTo(now, settle + 50);
    expect(r.onSettled).toHaveBeenCalledTimes(1);
    expect(fill(r)).toBe(asPayload(colors.prefectureFill.empty));

    const tints: number[] = [tint(r)];
    const embs: number[] = [emboss(r)];
    for (const at of [150, 300, 450, 600]) {
      advanceTo(now, settle + at);
      tints.push(tint(r));
      embs.push(emboss(r));
      if (at === 300) {
        expect(tint(r)).toBeGreaterThan(0);
        expect(tint(r)).toBeLessThan(1);
        expect(emboss(r)).toBeGreaterThan(0);
        expect(emboss(r)).toBeLessThan(1);
      }
    }
    tints.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(tints[i]));
    embs.slice(1).forEach((v, i) => expect(v).toBeLessThanOrEqual(embs[i]));

    advanceTo(now, settle + TINT_FADE_MS + 50);
    expect(tint(r)).toBeCloseTo(1, 2);
    expect(emboss(r)).toBeCloseTo(0, 2);
    expect(fill(r)).toBe(asPayload(colors.prefectureFill.tier1));

    // AC-45: 浮く・差す・引くの 3 つ
    const three = fades();
    expect(three).toHaveLength(3);
    three.forEach(c => expect(c).toEqual(expect.objectContaining({ useNativeDriver: true })));
    expect(three.map(c => c.toValue)).toEqual([1, 1, 0]);
    [0.75, 0.875, 0.75].forEach((v, i) => expect(three[i].easing!(0.5)).toBeCloseTo(v, 3));
  });

  it('AC-46: 視差効果を減らすなら、色が入りきった姿をすぐ出す', async () => {
    const r = renderFirst(true);
    await act(async () => {});

    expect(tint(r)).toBe(1);
    const layer = r.queryByTestId('save-reveal-emboss');
    if (layer) expect(opacityOf(layer)).toBe(0);
    expect(fill(r)).toBe(asPayload(colors.prefectureFill.tier1));
    expect(fades()).toHaveLength(0);
  });

  it('AC-47: 途中で外しても、待ちと動きが残らない', async () => {
    const r = renderFirst();
    await act(async () => {});
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    r.unmount();

    // Animated.View を外すと RN の中に 1 回きりの timer が残る（すぐ消える）。50ms 進めて、
    // それ以外（寄り・空押しの待ち・動きのコマ）が残っていないことを見る
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(jest.getTimerCount()).toBe(0);
  });
});
