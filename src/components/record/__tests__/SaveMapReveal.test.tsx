import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { SaveMapReveal, HOLD_MS, ZOOM_MS, PIN_MS } from '@components/record/SaveMapReveal';
import { prefectureScreenPoint } from '@utils/japanMapZoom';

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
  it('端の県でも、ピンがその県の上に来る', async () => {
    const width = 210;
    for (const prefecture of ['沖縄県', '北海道', '東京都']) {
      const tree = render(
        <SaveMapReveal
          prefecture={prefecture}
          stampCountByPrefecture={{ [prefecture]: 1 }}
          width={width}
        />
      );
      await act(async () => {});

      const expected = prefectureScreenPoint(prefecture, width);
      const placed = StyleSheet.flatten(tree.getByTestId('save-map-pin').props.style);

      // 尾の先（left + 幅/2, top + 高さ）が県を指す
      expect(placed.left + (84 * 0.34) / 2).toBeCloseTo(expected.x, 1);
      expect(placed.top + 120 * 0.34).toBeCloseTo(expected.y, 1);
      tree.unmount();
    }
  });

  it('読み上げで、どの県が色づいたか分かる', async () => {
    const { getByTestId } = setup({ stampCountByPrefecture: { 東京都: 1, 宮城県: 9 } });
    await act(async () => {});

    expect(getByTestId('save-map').props.accessibilityLabel).toBe(
      '東京都がいま色づきました。47都道府県のうち2県'
    );
  });
});
