import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { SaveMapReveal, HOLD_MS, ZOOM_MS, PIN_MS } from '@components/record/SaveMapReveal';
import { zoomToPrefecture } from '@utils/japanMapZoom';
import { JAPAN_MAP_HEIGHT, JAPAN_MAP_WIDTH, JAPAN_PREFECTURE_BOXES } from '@/constants/japanMap';

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
