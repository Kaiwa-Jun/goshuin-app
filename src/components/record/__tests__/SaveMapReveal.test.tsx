import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { SaveMapReveal, HOLD_MS, ZOOM_MS, PIN_MS } from '@components/record/SaveMapReveal';

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

  it('ピンの色を寺社の種別に合わせる', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true as never);
    const { getByTestId, rerender } = setup({ spotType: 'temple' });
    await act(async () => {});

    const polygons = getByTestId('save-map-pin').findAllByType('RNSVGPath' as never);
    expect(polygons.length).toBeGreaterThan(0);

    rerender(
      <SaveMapReveal
        prefecture="東京都"
        stampCountByPrefecture={{ 東京都: 1 }}
        width={210}
        spotType="shrine"
      />
    );
    expect(getByTestId('save-map-pin')).toBeTruthy();
  });

  it('動きを減らす設定なら、寄り終わった状態をすぐ出す', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true as never);
    const { getByTestId } = setup();

    await act(async () => {});

    expect(fillOf(getByTestId('save-map-東京都'))).toBe(asPayload(colors.prefectureFill.tier1));
  });
});
